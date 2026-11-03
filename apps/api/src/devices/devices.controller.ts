import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { PairDeviceDto } from './dto/devices.dto';
import { ConsentGuard } from '../privacy/consent.guard';

/** Routes the MOBILE APP calls (user token). */
@Controller('devices')
@UseGuards(JwtAuthGuard, ConsentGuard, ThrottlerGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** GET /devices — my robots */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.devices.listMine(user.id);
  }

  /** POST /devices/pair  { code: "123456" } — code shown on the robot's screen */
  @Post('pair')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  pair(@CurrentUser() user: AuthUser, @Body() dto: PairDeviceDto) {
    return this.devices.pair(user.id, dto.code);
  }

  /** DELETE /devices/:id — unpair a robot */
  @Delete(':id')
  @HttpCode(204)
  async unpair(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.devices.unpair(user.id, id);
  }
}
