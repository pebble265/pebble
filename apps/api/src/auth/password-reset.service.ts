import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type AuthTokens } from './auth.service';

const CODE_MINUTES = 10; // the emailed code works this long
const RESEND_SECONDS = 30; // wait before another code can be sent
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const MAX_CODES_PER_HOUR = 5;
const RESET_MINUTES = 15; // time to choose a new password after the code is confirmed

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * "Forget Password":
 *   1. POST /auth/password/forgot  { email }            -> emails a 5-digit code
 *   2. POST /auth/password/verify  { email, code }      -> { resetToken }
 *   3. POST /auth/password/reset   { resetToken, newPassword } -> signed in
 *
 * Step 1 answers the same whether or not the email has an account, so it
 * cannot be used to find out who uses Pebble.
 */
@Injectable()
export class PasswordResetService {
  private readonly log = new Logger('PasswordReset');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async requestCode(rawEmail: string) {
    const answer = { ok: true, resendAfter: RESEND_SECONDS, expiresIn: CODE_MINUTES * 60 };
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user || user.deleted_at) return answer;

    const now = Date.now();
    const recent = await this.prisma.password_resets.findMany({
      where: { user_id: user.id, created_at: { gt: new Date(now - 60 * 60 * 1000) } },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    if (recent.length >= MAX_CODES_PER_HOUR) return answer;
    if (recent[0] && now - recent[0].created_at.getTime() < RESEND_SECONDS * 1000) return answer;

    const code = randomInt(0, 100_000).toString().padStart(5, '0');
    await this.prisma.$transaction([
      // Only the newest code works.
      this.prisma.password_resets.updateMany({
        where: { user_id: user.id, used_at: null },
        data: { used_at: new Date(now) },
      }),
      this.prisma.password_resets.create({
        data: {
          user_id: user.id,
          code_hash: this.codeHash(user.id, code),
          expires_at: new Date(now + CODE_MINUTES * 60 * 1000),
        },
      }),
    ]);

    // Not awaited, so the answer takes the same time for unknown emails.
    this.mail
      .send(this.codeMail(user.email, user.display_name, code))
      .catch((e) => this.log.error(`Could not send the reset code to ${user.email}: ${e?.message ?? e}`));
    return answer;
  }

  async verifyCode(rawEmail: string, code: string): Promise<{ resetToken: string }> {
    const invalid = new BadRequestException('Invalid or expired code');
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user || user.deleted_at) throw invalid;

    const now = new Date();
    const row = await this.prisma.password_resets.findFirst({
      where: { user_id: user.id, used_at: null, reset_token_hash: null, expires_at: { gt: now } },
      orderBy: { created_at: 'desc' },
    });
    if (!row) throw invalid;

    // Count the guess first (atomically), so parallel guesses cannot skip the limit.
    const { count } = await this.prisma.password_resets.updateMany({
      where: { id: row.id, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (count === 0) {
      await this.prisma.password_resets.update({ where: { id: row.id }, data: { used_at: now } });
      throw new BadRequestException('Too many attempts, request a new code');
    }

    const given = Buffer.from(this.codeHash(user.id, code));
    if (!timingSafeEqual(given, Buffer.from(row.code_hash))) throw invalid;

    const resetToken = randomBytes(32).toString('base64url');
    const done = await this.prisma.password_resets.updateMany({
      where: { id: row.id, used_at: null, reset_token_hash: null },
      data: {
        reset_token_hash: sha256(resetToken),
        reset_expires_at: new Date(now.getTime() + RESET_MINUTES * 60 * 1000),
      },
    });
    if (done.count === 0) throw invalid;
    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string, deviceInfo?: string): Promise<AuthTokens> {
    const expired = new BadRequestException('Reset session expired, please start again');
    const row = await this.prisma.password_resets.findUnique({
      where: { reset_token_hash: sha256(resetToken) },
      include: { users: { select: { deleted_at: true } } },
    });
    const now = new Date();
    if (!row || row.used_at || !row.reset_expires_at || row.reset_expires_at <= now || row.users.deleted_at) {
      throw expired;
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.password_resets.updateMany({
        where: { id: row.id, used_at: null },
        data: { used_at: now },
      });
      if (count === 0) throw expired;
      await tx.users.update({ where: { id: row.user_id }, data: { password_hash: passwordHash } });
      // Whoever knew the old password is signed out everywhere.
      await tx.refresh_tokens.updateMany({
        where: { user_id: row.user_id, revoked_at: null },
        data: { revoked_at: now },
      });
    });

    return this.auth.startSession(row.user_id, deviceInfo);
  }

  /** Keyed hash: a leaked database alone is not enough to brute-force the 5 digits. */
  private codeHash(userId: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update(`password-reset:${userId}:${code}`)
      .digest('hex');
  }

  private codeMail(to: string, name: string, code: string) {
    const text =
      `สวัสดี ${name}\n\n` +
      `รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของ Pebble(a) คือ ${code}\n` +
      `รหัสนี้ใช้ได้ ${CODE_MINUTES} นาที ถ้าไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ\n\n` +
      `Your Pebble(a) password reset code is ${code}. It expires in ${CODE_MINUTES} minutes.\n` +
      `If you didn't ask for this, you can ignore this email.`;
    const html =
      `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:420px;margin:auto;padding:24px;color:#000">` +
      `<p style="font-weight:700;font-size:15px">pebble™</p>` +
      `<p>สวัสดี ${escapeHtml(name)}</p><p>รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของคุณคือ</p>` +
      `<p style="font-size:36px;letter-spacing:12px;font-weight:700;margin:16px 0">${code}</p>` +
      `<p style="color:#6C6969;font-size:13px">ใช้ได้ ${CODE_MINUTES} นาที ถ้าไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร<br>` +
      `Expires in ${CODE_MINUTES} minutes. If you didn't ask for this, ignore this email.</p></div>`;
    return { to, subject: `Pebble(a) รหัสยืนยัน ${code}`, text, html };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
