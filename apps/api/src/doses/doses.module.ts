import { Module } from '@nestjs/common';
import { DosesController } from './doses.controller';
import { DosesJobs } from './doses.jobs';
import { DosesService } from './doses.service';

@Module({
  controllers: [DosesController],
  providers: [DosesService, DosesJobs],
  exports: [DosesService],
})
export class DosesModule {}
