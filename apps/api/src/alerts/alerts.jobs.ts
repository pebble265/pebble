import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertsService } from './alerts.service';

@Injectable()
export class AlertsJobs {
  private readonly logger = new Logger(AlertsJobs.name);
  private running = false;

  constructor(private readonly alerts: AlertsService) {}

  /** Route new alerts to the user and their caretakers. */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async dispatch() {
    if (this.running) return; // don't overlap if a run is slow
    this.running = true;
    try {
      const count = await this.alerts.dispatchPending();
      if (count) this.logger.log(`Dispatched ${count} alert(s)`);
    } catch (e) {
      this.logger.error('Alert dispatch failed', e as Error);
    } finally {
      this.running = false;
    }
  }
}
