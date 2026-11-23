import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CompleteOnboardingDto, RobotSetupDto, UpdateProfileDto, ChangePasswordDto, SetAvatarDto } from './dto/users.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /users/me */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  /** PATCH /users/me  { displayName?, pronunciation?, sex?, birthYear?, timezone?, locale? } */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.update(user.id, dto);
  }

  /** POST /users/me/avatar  { image: "data:image/jpeg;base64,..." } */
  @Post('avatar')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  setAvatar(@CurrentUser() user: AuthUser, @Body() dto: SetAvatarDto) {
    return this.users.setAvatar(user.id, dto.image);
  }

  /** DELETE /users/me/avatar — back to the default picture */
  @Delete('avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.users.setAvatar(user.id, null);
  }

  /** POST /users/me/onboarding  { acceptTerms: true, acceptHealthData: true, displayName?, pronunciation?, sex?, birthYear? } */
  @Post('onboarding')
  @HttpCode(200)
  completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.users.completeOnboarding(user.id, dto);
  }

  /** POST /users/me/robot-setup  { skipped: true } — done with setup without pairing */
  @Post('robot-setup')
  @HttpCode(200)
  finishRobotSetup(@CurrentUser() user: AuthUser, @Body() _dto: RobotSetupDto) {
    return this.users.finishRobotSetup(user.id);
  }

  /** POST /users/me/app-setup — first-run screens done (the robot leaves its "ready soon" page) */
  @Post('app-setup')
  @HttpCode(200)
  finishAppSetup(@CurrentUser() user: AuthUser) {
    return this.users.finishAppSetup(user.id);
  }

  /** POST /users/me/password  { currentPassword, newPassword } — signs out other devices */
  @Post('password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto);
  }

  /** POST /users/me/terms/email — sends the Terms and Conditions to the account's email */
  @Post('terms/email')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  emailTerms(@CurrentUser() user: AuthUser) {
    return this.users.emailTerms(user.id);
  }
}
