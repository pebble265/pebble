import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyResetCodeDto } from './dto/password-reset.dto';
import { AppleSignInDto, GoogleSignInDto } from './dto/social.dto';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  /** POST /auth/register  { email, password, displayName } */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /** POST /auth/login  { email, password } */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** POST /auth/apple  { identityToken, fullName? } — creates the account on first use */
  @Post('apple')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  apple(@Body() dto: AppleSignInDto) {
    return this.auth.signInWithApple(dto);
  }

  /** POST /auth/google  { idToken } — creates the account on first use */
  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  google(@Body() dto: GoogleSignInDto) {
    return this.auth.signInWithGoogle(dto);
  }

  /** POST /auth/password/forgot  { email } — emails a 5-digit code (same answer for unknown emails) */
  @Post('password/forgot')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestCode(dto.email);
  }

  /** POST /auth/password/verify  { email, code } -> { resetToken } */
  @Post('password/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.passwordReset.verifyCode(dto.email, dto.code);
  }

  /** POST /auth/password/reset  { resetToken, newPassword } -> tokens (signed in, other devices signed out) */
  @Post('password/reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto.resetToken, dto.newPassword, dto.deviceInfo);
  }

  /** POST /auth/refresh  { refreshToken } -> new pair (old one stops working) */
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** POST /auth/logout  { refreshToken } */
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }
}
