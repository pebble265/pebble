import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { UpdateRobotSettingsDto } from './dto/robot-settings.dto';
import { RobotSettingsService } from './robot-settings.service';

@Controller('robot-settings')
@UseGuards(JwtAuthGuard)
export class RobotSettingsController {
  constructor(private readonly settings: RobotSettingsService) {}

  /** GET /robot-settings */
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user.id);
  }

  /** PATCH /robot-settings  { robotName?, voiceId?, speechRate?, greetingText?, ... } */
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateRobotSettingsDto) {
    return this.settings.update(user.id, dto);
  }
}
