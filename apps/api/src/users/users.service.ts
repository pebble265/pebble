import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidTimezone } from '../common/validation';
import { NO_PASSWORD } from '../auth/auth.service';
import { termsAsText, TERMS } from '../legal/terms';
import { CryptoService } from '../crypto/crypto.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../notifications/realtime.gateway';
import { ChangePasswordDto, CompleteOnboardingDto, UpdateProfileDto } from './dto/users.dto';
import * as argon2 from 'argon2';

type ProfileInput = Pick<UpdateProfileDto, 'displayName' | 'pronunciation' | 'sex' | 'birthYear' | 'phone'>;

/** Only the profile fields that were sent. */
function profileData(dto: ProfileInput) {
  return {
    ...(dto.displayName !== undefined && { display_name: dto.displayName.trim() }),
    ...(dto.pronunciation !== undefined && { pronunciation: dto.pronunciation.trim() || null }),
    ...(dto.sex !== undefined && { sex: dto.sex }),
    ...(dto.birthYear !== undefined && { birth_year: dto.birthYear }),
    ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
  };
}

/** Bump this when the terms / privacy policy text changes. */
export const POLICY_VERSION = '2026-11';

const profileSelect = {
  id: true,
  email: true,
  display_name: true,
  locale: true,
  timezone: true,
  uses_medication: true,
  onboarded_at: true,
  pronunciation: true,
  sex: true,
  birth_year: true,
  phone: true,
  avatar_enc: true,
  robot_setup_at: true,
  app_setup_done_at: true,
  created_at: true,
  password_hash: true, // only to report hasPassword, never returned
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly crypto: CryptoService,
      private readonly realtime: RealtimeGateway,
  ) {}

  /** Profile photo: a small JPEG as a data URL, stored encrypted. Empty string / null removes it. */
  async setAvatar(userId: string, image: string | null) {
    if (image) {
      const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(image);
      if (!m) throw new BadRequestException('รูปไม่ถูกต้อง');
      const bytes = Buffer.from(m[2], 'base64');
      const magicOk = m[1] === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 : bytes.subarray(1, 4).toString() === 'PNG';
      if (!magicOk) throw new BadRequestException('รูปไม่ถูกต้อง');
      if (bytes.length > 400_000) throw new BadRequestException('รูปใหญ่เกินไป');
    }
    await this.prisma.users.update({
      where: { id: userId },
      data: { avatar_enc: image ? this.crypto.encrypt(image) : null, updated_at: new Date() },
    });
    return this.me(userId);
  }

  async me(userId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      select: profileSelect,
    });
    if (!user) throw new NotFoundException();
    const ids = await this.prisma.auth_identities.findMany({ where: { user_id: userId }, select: { provider: true } });
    return {
      ...this.toResponse(user),
      /** how this account signs in: "password", "google", "apple" */
      loginMethods: [
        ...(user.password_hash !== NO_PASSWORD ? ['password'] : []),
        ...new Set(ids.map((i) => i.provider)),
      ],
    };
  }

  /** Signed-in password change: the current password must be right. Other sessions are signed out. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      select: { password_hash: true },
    });
    if (!user) throw new NotFoundException();
    if (user.password_hash === NO_PASSWORD) {
      throw new BadRequestException('This account signs in with Apple / Google and has no password');
    }
    const ok = await argon2.verify(user.password_hash, dto.currentPassword).catch(() => false);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const hash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { id: userId }, data: { password_hash: hash } }),
      this.prisma.refresh_tokens.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } }),
    ]);
    return { ok: true };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    if (dto.timezone !== undefined && !isValidTimezone(dto.timezone)) {
      throw new BadRequestException('Unknown timezone');
    }
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: {
        ...profileData(dto),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
      select: profileSelect,
    });
    return this.toResponse(user);
  }

  /** Records consent and marks onboarding done. Safe to call twice. */
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    await this.prisma.$transaction(async (tx) => {
      const profile = profileData(dto);
      if (Object.keys(profile).length) {
        await tx.users.update({ where: { id: userId }, data: profile });
      }
      for (const consentType of ['terms', 'health_data']) {
        const existing = await tx.consents.findFirst({
          where: {
            user_id: userId,
            consent_type: consentType,
            policy_version: POLICY_VERSION,
            revoked_at: null,
          },
        });
        if (!existing) {
          await tx.consents.create({
            data: {
              user_id: userId,
              consent_type: consentType,
              policy_version: POLICY_VERSION,
            },
          });
        }
      }
      await tx.users.updateMany({
        where: { id: userId, onboarded_at: null },
        data: { onboarded_at: new Date() },
      });
    });
    return this.me(userId);
  }

  /** The user finished the robot setup screens without pairing a robot. */
  async finishRobotSetup(userId: string) {
    await this.prisma.users.updateMany({
      where: { id: userId, robot_setup_at: null },
      data: { robot_setup_at: new Date() },
    });
    return this.me(userId);
  }

  /**
   * The first-run screens in the app are done (medicines picked, "All Set" closed).
   * The robot waits on "Welcome, <name>" until then, so tell it right away.
   */
  async finishAppSetup(userId: string) {
    const { count } = await this.prisma.users.updateMany({
      where: { id: userId, app_setup_done_at: null },
      data: { app_setup_done_at: new Date() },
    });
    if (count) {
      const robots = await this.prisma.devices.findMany({ where: { owner_user_id: userId }, select: { id: true } });
      for (const r of robots) this.realtime.toDevice(r.id, 'robot:setup-done', {});
    }
    return this.me(userId);
  }

  async emailTerms(userId: string) {
    const user = await this.prisma.users.findFirst({ where: { id: userId, deleted_at: null }, select: { email: true } });
    if (!user) throw new NotFoundException();
    await this.mail.send({ to: user.email, subject: TERMS.title, text: termsAsText() });
    return { ok: true, to: user.email };
  }

  private toResponse(user: {
    id: string;
    email: string;
    display_name: string;
    locale: string;
    timezone: string;
    uses_medication: boolean;
    onboarded_at: Date | null;
    pronunciation: string | null;
    sex: string | null;
    birth_year: number | null;
    phone: string | null;
    avatar_enc: Uint8Array | null;
    robot_setup_at: Date | null;
    app_setup_done_at: Date | null;
    created_at: Date;
    password_hash: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      locale: user.locale,
      timezone: user.timezone,
      usesMedication: user.uses_medication,
      onboardedAt: user.onboarded_at,
      pronunciation: user.pronunciation,
      sex: user.sex,
      birthYear: user.birth_year,
      phone: user.phone,
      /** profile photo as a data URL, or null for the default picture */
      avatar: this.crypto.decryptOptional(user.avatar_enc),
      /** null until the "connect your pebble(a)" screens are done */
      robotSetupAt: user.robot_setup_at,
      /** null until the first-run screens in the app are done; the robot waits for this */
      appSetupDoneAt: user.app_setup_done_at,
      createdAt: user.created_at,
      /** false for accounts made with Apple / Google (no Pebble password) */
      hasPassword: user.password_hash !== NO_PASSWORD,
    };
  }
}
