import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { CurrentDevice, DeviceAuthGuard } from '../devices/device-auth.guard';
import type { AuthDevice } from '../devices/device-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';
import { ConsentGuard, OwnerConsentGuard } from '../privacy/consent.guard';

/** Chat from the mobile app. */
@Controller('chat')
@UseGuards(JwtAuthGuard, ConsentGuard, ThrottlerGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** POST /chat/messages  { message, conversationId? } -> { conversationId, reply, crisis } */
  @Post('messages')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.chat.send(user.id, dto.message, dto.conversationId);
  }

  /** POST /chat/conversations/:id/end — summarise now instead of waiting 30 min */
  @Post('conversations/:id/end')
  @HttpCode(200)
  end(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.end(user.id, id);
  }

  /** GET /chat/conversations — past conversations (summaries only) */
  @Get('conversations')
  history(@CurrentUser() user: AuthUser) {
    return this.chat.history(user.id);
  }

  /** DELETE /chat/conversations/:id */
  @Delete('conversations/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.chat.deleteConversation(user.id, id);
  }

  /** GET /chat/memories — what Pebble remembers about me */
  @Get('memories')
  memories(@CurrentUser() user: AuthUser) {
    return this.chat.memories(user.id);
  }

  /** DELETE /chat/memories/:id — forget this */
  @Delete('memories/:id')
  @HttpCode(204)
  async forget(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.chat.deleteMemory(user.id, id);
  }
}

/** Chat from the robot (device token). */
@Controller('robot/chat')
@UseGuards(DeviceAuthGuard, OwnerConsentGuard, ThrottlerGuard)
export class RobotChatController {
  constructor(private readonly chat: ChatService) {}

  /** POST /robot/chat/messages  { message, conversationId? } */
  @Post('messages')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  send(@CurrentDevice() device: AuthDevice, @Body() dto: SendMessageDto) {
    if (!device.ownerUserId) {
      return { conversationId: null, reply: 'ยังไม่ได้จับคู่กับเจ้าของเลย ลองจับคู่ผ่านแอปก่อนนะ', crisis: null };
    }
    return this.chat.send(device.ownerUserId, dto.message, dto.conversationId, device.id);
  }

  /** POST /robot/chat/conversations/:id/end */
  @Post('conversations/:id/end')
  @HttpCode(200)
  end(@CurrentDevice() device: AuthDevice, @Param('id', ParseUUIDPipe) id: string) {
    if (!device.ownerUserId) return { conversationId: id, ended: true };
    return this.chat.end(device.ownerUserId, id);
  }
}
