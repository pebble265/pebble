import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DevicesService } from './devices.service';

@Injectable()
export class DevicesJobs {
  private readonly logger = new Logger(DevicesJobs.name);

  constructor(private readonly devices: DevicesService) {}

  /** Paired robots that went quiet -> offline + alert. */
  @Cron(CronExpression.EVERY_MINUTE)
  async offline() {
    try {
      const count = await this.devices.markOffline();
      if (count) this.logger.warn(`Marked ${count} robot(s) offline`);
    } catch (e) {
      this.logger.error('Offline check failed', e as Error);
    }
  }
}
