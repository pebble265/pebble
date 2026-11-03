import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { DosesService } from '../doses/doses.service';
import { OwnerConsentGuard } from '../privacy/consent.guard';
import { CurrentDevice, DeviceAuthGuard } from './device-auth.guard';
import type { AuthDevice } from './device-auth.guard';
import { DevicesService } from './devices.service';
import { HeartbeatDto, RobotAuthDto, RobotDoseTakeDto } from './dto/devices.dto';

/** Routes the ROBOT calls. */
@Controller('robot')
export class RobotController {
  constructor(
    private readonly devices: DevicesService,
    private readonly doses: DosesService,
  ) {}

  /** POST /robot/auth  { serialNumber, secret } -> device token (1 hour) */
  @Post('auth')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  auth(@Body() dto: RobotAuthDto) {
    return this.devices.robotLogin(dto.serialNumber, dto.secret);
  }

  /** POST /robot/pairing-code -> { code, expiresAt } to show on screen */
  @Post('pairing-code')
  @UseGuards(DeviceAuthGuard)
  pairingCode(@CurrentDevice() device: AuthDevice) {
    return this.devices.createPairingCode(device);
  }

  /** POST /robot/heartbeat  { batteryLevel, status?, firmwareVersion? } */
  @Post('heartbeat')
  @HttpCode(200)
  @UseGuards(DeviceAuthGuard)
  heartbeat(@CurrentDevice() device: AuthDevice, @Body() dto: HeartbeatDto) {
    return this.devices.heartbeat(device, dto);
  }

  /** GET /robot/me — owner name, greeting, voice, face theme ... */
  @Get('me')
  @UseGuards(DeviceAuthGuard)
  me(@CurrentDevice() device: AuthDevice) {
    return this.devices.robotProfile(device);
  }

  /** GET /robot/doses/today — the owner's doses for today */
  @Get('doses/today')
  @UseGuards(DeviceAuthGuard, OwnerConsentGuard)
  todayDoses(@CurrentDevice() device: AuthDevice) {
    return this.doses.today(this.devices.requireOwner(device));
  }

  /** POST /robot/doses/:id/dispensed — pill was ejected */
  @Post('doses/:id/dispensed')
  @HttpCode(200)
  @UseGuards(DeviceAuthGuard, OwnerConsentGuard)
  dispensed(
    @CurrentDevice() device: AuthDevice,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devices.markDispensed(device, id);
  }

  /** POST /robot/doses/:id/take  { via: "robot_button" | "robot_sensor" } */
  @Post('doses/:id/take')
  @HttpCode(200)
  @UseGuards(DeviceAuthGuard, OwnerConsentGuard)
  take(
    @CurrentDevice() device: AuthDevice,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RobotDoseTakeDto,
  ) {
    return this.doses.take(this.devices.requireOwner(device), id, { via: dto.via });
  }
}
