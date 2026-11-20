import { Module } from '@nestjs/common';
import { DeviceAuthGuard } from '../devices/device-auth.guard';
import { MoodsController, RobotMoodsController } from './moods.controller';
import { MoodsService } from './moods.service';

@Module({
  controllers: [MoodsController, RobotMoodsController],
  providers: [MoodsService, DeviceAuthGuard],
  exports: [MoodsService],
})
export class MoodsModule {}
