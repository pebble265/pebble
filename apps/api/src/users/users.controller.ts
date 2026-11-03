import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CompleteOnboardingDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /users/me */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  /** PATCH /users/me  { displayName?, timezone?, locale? } */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.update(user.id, dto);
  }

  /** POST /users/me/onboarding  { acceptTerms: true, acceptHealthData: true } */
  @Post('onboarding')
  @HttpCode(200)
  completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.users.completeOnboarding(user.id, dto);
  }
}
