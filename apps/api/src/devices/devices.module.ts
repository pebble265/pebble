import { Module } from '@nestjs/common';
import { DosesModule } from '../doses/doses.module';
import { DeviceAuthGuard } from './device-auth.guard';
import { DevicesController } from './devices.controller';
import { DevicesJobs } from './devices.jobs';
import { DevicesService } from './devices.service';
import { RobotController } from './robot.controller';

@Module({
  imports: [DosesModule],
  controllers: [DevicesController, RobotController],
  providers: [DevicesService, DeviceAuthGuard, DevicesJobs],
})
export class DevicesModule {}
