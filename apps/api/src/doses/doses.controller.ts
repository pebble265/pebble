import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { DosesService } from './doses.service';
import { DoseActionDto, HistoryQueryDto } from './dto/dose.dto';

@Controller('doses')
@UseGuards(JwtAuthGuard)
export class DosesController {
  constructor(private readonly doses: DosesService) {}

  /** GET /doses/today */
  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.doses.today(user.id);
  }

  /** GET /doses/history?days=7 */
  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() q: HistoryQueryDto) {
    return this.doses.history(user.id, q.days ?? 7);
  }

  /** POST /doses/:id/take  { via?: "app" | "robot_button" | "robot_sensor", note? } */
  @Post(':id/take')
  @HttpCode(200)
  take(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DoseActionDto,
  ) {
    return this.doses.take(user.id, id, dto);
  }

  /** POST /doses/:id/skip  { note? } */
  @Post(':id/skip')
  @HttpCode(200)
  skip(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DoseActionDto,
  ) {
    return this.doses.skip(user.id, id, dto);
  }
}
