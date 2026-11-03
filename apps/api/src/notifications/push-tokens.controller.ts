import { Body, Controller, Delete, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { RegisterPushTokenDto, RemovePushTokenDto } from './dto/push-token.dto';
import { NotifyService } from './notify.service';

@Controller('push-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(private readonly notify: NotifyService) {}

  /** POST /push-tokens  { token: "ExponentPushToken[...]", platform: "ios" | "android" } */
  @Post()
  @HttpCode(204)
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushTokenDto) {
    await this.notify.registerToken(user.id, dto.token, dto.platform);
  }

  /** DELETE /push-tokens  { token } — call on logout */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Body() dto: RemovePushTokenDto) {
    await this.notify.removeToken(user.id, dto.token);
  }
}
