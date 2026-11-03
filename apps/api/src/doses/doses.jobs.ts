import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DosesService } from './doses.service';

@Injectable()
export class DosesJobs implements OnApplicationBootstrap {
  private readonly logger = new Logger(DosesJobs.name);

  constructor(private readonly doses: DosesService) {}

  async onApplicationBootstrap() {
    await this.generate();
  }

  /** Keep today's and tomorrow's dose rows ready for every user. */
  @Cron(CronExpression.EVERY_HOUR)
  async generate() {
    try {
      const created = await this.doses.generateForAllUsers();
      if (created) this.logger.log(`Created ${created} upcoming dose(s)`);
    } catch (e) {
      this.logger.error('Dose generation failed', e as Error);
    }
  }

  /** Flag doses that passed their grace period. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async missed() {
    try {
      const count = await this.doses.markMissed();
      if (count) this.logger.warn(`Marked ${count} dose(s) as missed`);
    } catch (e) {
      this.logger.error('Missed-dose check failed', e as Error);
    }
  }
}
