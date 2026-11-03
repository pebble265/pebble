import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyJobs } from './privacy.jobs';
import { PrivacyService } from './privacy.service';

@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService, PrivacyJobs],
  exports: [PrivacyService],
})
export class PrivacyModule {}
