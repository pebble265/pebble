import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrivacyService } from './privacy.service';

@Injectable()
export class PrivacyJobs {
  private readonly logger = new Logger(PrivacyJobs.name);

  constructor(private readonly privacy: PrivacyService) {}

  /** Every night at 03:30: permanently remove items deleted 30+ days ago. */
  @Cron('30 3 * * *', { timeZone: 'Asia/Bangkok' })
  async purge() {
    try {
      const r = await this.privacy.purgeDeleted();
      if (r.medications || r.conversations) {
        this.logger.log(`Purged ${r.medications} medication(s), ${r.conversations} conversation(s)`);
      }
    } catch (e) {
      this.logger.error('Purge failed', e as Error);
    }
  }
}
