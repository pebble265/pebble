import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { ConsentGuard } from '../privacy/consent.guard';
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
