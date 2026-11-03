import { Module } from '@nestjs/common';
import { DeviceAuthGuard } from '../devices/device-auth.guard';
import { DosesModule } from '../doses/doses.module';
import { ChatController, RobotChatController } from './chat.controller';
import { ChatJobs } from './chat.jobs';
import { ChatService } from './chat.service';

@Module({
  imports: [DosesModule],
  controllers: [ChatController, RobotChatController],
  providers: [ChatService, ChatJobs, DeviceAuthGuard],
})
export class ChatModule {}
