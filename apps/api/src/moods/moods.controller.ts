import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { ConsentGuard } from '../privacy/consent.guard';
import { CreateMoodDto, MoodQueryDto } from './dto/mood.dto';
import { MoodsService } from './moods.service';

/** Mood is health data, so it sits behind the same consent as medications. */
@Controller('moods')
@UseGuards(JwtAuthGuard, ConsentGuard)
export class MoodsController {
  constructor(private readonly moods: MoodsService) {}

  /** POST /moods  { score: 1..7 } */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMoodDto) {
    return this.moods.create(user.id, dto.score, dto.source);
  }

  /** GET /moods?days=14 */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: MoodQueryDto) {
    return this.moods.list(user.id, q.days ?? 14);
  }
}
