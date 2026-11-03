import { Module } from '@nestjs/common';
import { RobotSettingsController } from './robot-settings.controller';
import { RobotSettingsService } from './robot-settings.service';

@Module({
  controllers: [RobotSettingsController],
  providers: [RobotSettingsService],
  exports: [RobotSettingsService],
})
export class RobotSettingsModule {}
