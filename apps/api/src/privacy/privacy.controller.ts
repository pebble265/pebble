import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import type { ConsentType } from './consent';
import { DeleteAccountDto } from './dto/privacy.dto';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  /** GET /privacy/export — everything Pebble holds about me, as a JSON file */
  @Get('export')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  async export(
    @CurrentUser() user: AuthUser,
    @Req() req: { ip?: string },
    @Res({ passthrough: true })
    res: { setHeader(name: string, value: string): void },
  ) {
    const data = await this.privacy.exportAll(user.id, req.ip);
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="pebble-data-${day}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    return data;
  }

  /** GET /privacy/consents */
  @Get('consents')
  consents(@CurrentUser() user: AuthUser) {
    return this.privacy.consents(user.id);
  }

  /** POST /privacy/consents/:type/grant */
  @Post('consents/:type/grant')
  @HttpCode(200)
  grant(@CurrentUser() user: AuthUser, @Param('type') type: ConsentType) {
    return this.privacy.grant(user.id, type);
  }

  /** POST /privacy/consents/:type/revoke  (conversation_memory | caretaker_sharing) */
  @Post('consents/:type/revoke')
  @HttpCode(200)
  revoke(@CurrentUser() user: AuthUser, @Param('type') type: ConsentType) {
    return this.privacy.revoke(user.id, type);
  }

  /** DELETE /privacy/account  { password, confirm: "DELETE" } — permanent */
  @Delete('account')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Req() req: { ip?: string },
  ) {
    await this.privacy.deleteAccount(user.id, dto, req.ip);
  }
}
