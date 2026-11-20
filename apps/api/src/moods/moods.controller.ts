import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CurrentDevice, DeviceAuthGuard } from '../devices/device-auth.guard';
import type { AuthDevice } from '../devices/device-auth.guard';
import { ConsentGuard, OwnerConsentGuard } from '../privacy/consent.guard';
import { CreateMoodDto, MoodQueryDto, UpdateMoodNoteDto } from './dto/mood.dto';
import { MoodsService } from './moods.service';

/** Mood is health data, so it sits behind the same consent as medications. */
@Controller('moods')
@UseGuards(JwtAuthGuard, ConsentGuard)
export class MoodsController {
  constructor(private readonly moods: MoodsService) {}

  /** POST /moods  { score: 1..7, note? } */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMoodDto) {
    return this.moods.create(user.id, dto.score, dto.source, dto.note);
  }

  /** PATCH /moods/:id  { note } — "" clears it */
  @Patch(':id')
  setNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMoodNoteDto,
  ) {
    return this.moods.setNote(user.id, id, dto.note);
  }

  /** GET /moods?days=14 */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: MoodQueryDto) {
    return this.moods.list(user.id, q.days ?? 14);
  }
}

/** Mood check-in from the robot's touch screen (device token, for its owner). */
@Controller('robot/moods')
@UseGuards(DeviceAuthGuard, OwnerConsentGuard)
export class RobotMoodsController {
  constructor(private readonly moods: MoodsService) {}

  private owner(device: AuthDevice): string {
    if (!device.ownerUserId) throw new ForbiddenException('Robot is not paired to a user yet');
    return device.ownerUserId;
  }

  /** POST /robot/moods  { score: 1..7 } — saved with source "robot" */
  @Post()
  async create(@CurrentDevice() device: AuthDevice, @Body() dto: CreateMoodDto) {
    const m = await this.moods.create(this.owner(device), dto.score, 'robot');
    return { id: m.id, score: m.score, label: m.label };
  }

  /** GET /robot/moods/today — today's score only (notes stay on the phone) */
  @Get('today')
  async today(@CurrentDevice() device: AuthDevice) {
    const { today } = await this.moods.list(this.owner(device), 1);
    return { today: today ? { score: today.score, label: today.label } : null };
  }
}
