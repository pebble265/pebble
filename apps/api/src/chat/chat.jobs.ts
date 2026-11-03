import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatService } from './chat.service';

@Injectable()
export class ChatJobs {
  private readonly logger = new Logger(ChatJobs.name);

  constructor(private readonly chat: ChatService) {}

  /** Conversations idle for 30 minutes get summarised and closed. */
  @Cron(CronExpression.EVERY_MINUTE)
  async closeIdle() {
    try {
      const n = await this.chat.endIdle();
      if (n) this.logger.log(`Closed ${n} idle conversation(s)`);
    } catch (e) {
      this.logger.error('Closing idle conversations failed', e as Error);
    }
  }
}
