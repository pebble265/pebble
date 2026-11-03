import {
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
import { AlertsService } from './alerts.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** GET /alerts?open=true — my own alerts */
  @Get('alerts')
  mine(@CurrentUser() user: AuthUser, @Query('open') open?: string) {
    return this.alerts.listMine(user.id, open === 'true');
  }

  /** POST /alerts/:id/resolve */
  @Post('alerts/:id/resolve')
  @HttpCode(204)
  async resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alerts.resolve(user.id, id);
  }

  /** GET /caretaking-alerts?unacked=true — alerts about people I care for */
  @Get('caretaking-alerts')
  inbox(@CurrentUser() user: AuthUser, @Query('unacked') unacked?: string) {
    return this.alerts.caretakerInbox(user.id, unacked === 'true');
  }

  /** POST /caretaking-alerts/:deliveryId/ack */
  @Post('caretaking-alerts/:deliveryId/ack')
  @HttpCode(204)
  async ack(
    @CurrentUser() user: AuthUser,
    @Param('deliveryId', ParseUUIDPipe) id: string,
  ) {
    await this.alerts.acknowledge(user.id, id);
  }
}
