import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_TOKEN_DAYS = 30;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until the access token expires
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  /**
   * Hash used when the email does not exist, so a failed login takes the
   * same time either way (stops attackers learning which emails exist).
   */
  private readonly dummyHash = argon2.hash('pebble-dummy-password');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------
  async register(dto: RegisterDto): Promise<AuthTokens> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.users.create({
          data: {
            email,
            password_hash: passwordHash,
            display_name: dto.displayName.trim(),
          },
        });

        // Every new user gets default robot settings ...
        await tx.robot_settings.create({ data: { user_id: created.id } });

        // ... and hotlines, so crisis handling works even with no Caretaker.
        await tx.emergency_contacts.createMany({
          data: [
            {
              user_id: created.id,
              label: 'สายด่วนสุขภาพจิต กรมสุขภาพจิต',
              phone: '1323',
              sort_order: 0,
            },
            {
              user_id: created.id,
              label: 'เจ็บป่วยฉุกเฉิน',
              phone: '1669',
              sort_order: 1,
            },
          ],
        });

        return created;
      });

      return this.issueTokens(user.id, dto.deviceInfo);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------
  async login(dto: LoginDto): Promise<AuthTokens> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.users.findUnique({ where: { email } });

    const hash =
      user && !user.deleted_at ? user.password_hash : await this.dummyHash;
    const valid = await argon2.verify(hash, dto.password);

    if (!user || user.deleted_at || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, dto.deviceInfo);
  }

  // ---------------------------------------------------------------------
  // Refresh (rotation: every refresh token can be used exactly once)
  // ---------------------------------------------------------------------
  async refresh(rawToken: string): Promise<AuthTokens> {
    const now = new Date();
    const stored = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: sha256(rawToken) },
    });

    if (!stored) throw new UnauthorizedException();

    // A token that was already used is being replayed: assume it was stolen
    // and log the user out everywhere.
    if (stored.revoked_at) {
      await this.prisma.refresh_tokens.updateMany({
        where: { user_id: stored.user_id, revoked_at: null },
        data: { revoked_at: now },
      });
      throw new UnauthorizedException();
    }

    if (stored.expires_at <= now) throw new UnauthorizedException();

    // Revoke atomically so two parallel refreshes cannot both succeed.
    const { count } = await this.prisma.refresh_tokens.updateMany({
      where: { id: stored.id, revoked_at: null },
      data: { revoked_at: now },
    });
    if (count === 0) throw new UnauthorizedException();

    const user = await this.prisma.users.findUnique({
      where: { id: stored.user_id },
      select: { deleted_at: true },
    });
    if (!user || user.deleted_at) throw new UnauthorizedException();

    return this.issueTokens(stored.user_id, stored.device_info ?? undefined);
  }

  // ---------------------------------------------------------------------
  // Logout (revokes this device's refresh token only)
  // ---------------------------------------------------------------------
  async logout(rawToken: string): Promise<void> {
    await this.prisma.refresh_tokens.updateMany({
      where: { token_hash: sha256(rawToken), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  private async issueTokens(
    userId: string,
    deviceInfo?: string,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    const { exp, iat } = this.jwt.decode(accessToken) as {
      exp: number;
      iat: number;
    };

    // Refresh token is random (not a JWT); only its hash is stored.
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: sha256(refreshToken),
        device_info: deviceInfo?.slice(0, 200),
        expires_at: new Date(
          Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return { accessToken, refreshToken, expiresIn: exp - iat };
  }
}
