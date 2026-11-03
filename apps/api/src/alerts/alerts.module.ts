import { Module } from '@nestjs/common';
import { CaretakersModule } from '../caretakers/caretakers.module';
import { AlertsController } from './alerts.controller';
import { AlertsJobs } from './alerts.jobs';
import { AlertsService } from './alerts.service';

@Module({
  imports: [CaretakersModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsJobs],
  exports: [AlertsService],
})
export class AlertsModule {}
