import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidTimezone } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto, UpdateProfileDto } from './dto/users.dto';

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
  created_at: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      select: profileSelect,
    });
    if (!user) throw new NotFoundException();
    return this.toResponse(user);
  }

  async update(userId: string, dto: UpdateProfileDto) {
    if (dto.timezone !== undefined && !isValidTimezone(dto.timezone)) {
      throw new BadRequestException('Unknown timezone');
    }
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && {
          display_name: dto.displayName.trim(),
        }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
      select: profileSelect,
    });
    return this.toResponse(user);
  }

  /** Records consent and marks onboarding done. Safe to call twice. */
  async completeOnboarding(userId: string, _dto: CompleteOnboardingDto) {
    await this.prisma.$transaction(async (tx) => {
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

  private toResponse(user: {
    id: string;
    email: string;
    display_name: string;
    locale: string;
    timezone: string;
    uses_medication: boolean;
    onboarded_at: Date | null;
    created_at: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      locale: user.locale,
      timezone: user.timezone,
      usesMedication: user.uses_medication,
      onboardedAt: user.onboarded_at,
      createdAt: user.created_at,
    };
  }
}
