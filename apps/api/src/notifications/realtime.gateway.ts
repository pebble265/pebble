import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Socket.IO endpoint at ws://<server>/realtime
 *
 * Connect with the same token used for HTTP:
 *   io('http://localhost:3000/realtime', { auth: { token } })
 *
 * App (user token)    -> joins room "user:<id>"
 * Robot (device token)-> joins room "device:<id>"
 *
 * Events sent by the server:
 *   "alert"          to the user and to caretakers allowed to see it
 *   "dose:due"       to the user and their robots when a dose is due
 *   "robot:command"  to a robot, from the app's "pebble" tab:
 *                    { action: "wake" | "forward" | "backward" | "left" | "right" | "stop" | "wave" | "box", at: ISO time }
 *                    forward/backward/left/right = keep moving until "stop" (sent when the button is released)
 *                    wave = wave the arm, box = open/close the pill box
 *   "robot:paired"   to a robot, right after someone typed its code in the app
 *   "robot:unpaired" to a robot, right after its owner removed it (show a new code)
 *   "mood:checkin"   to the user's robots after a mood check-in in the app: { score 1-7, label, at }
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      String(client.handshake.headers.authorization ?? '').replace(/^Bearer /, '');

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ?: string }>(token);

      if (payload.typ === 'device') {
        const device = await this.prisma.devices.findUnique({
          where: { id: payload.sub },
          select: { id: true },
        });
        if (!device) throw new Error('unknown device');
        await client.join(`device:${device.id}`);
        client.data = { kind: 'device', id: device.id };
      } else {
        const user = await this.prisma.users.findFirst({
          where: { id: payload.sub, deleted_at: null },
          select: { id: true },
        });
        if (!user) throw new Error('unknown user');
        await client.join(`user:${user.id}`);
        client.data = { kind: 'user', id: user.id };
      }
      client.emit('ready', { kind: client.data.kind });
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  toDevice(deviceId: string, event: string, payload: unknown) {
    this.server?.to(`device:${deviceId}`).emit(event, payload);
  }
}
