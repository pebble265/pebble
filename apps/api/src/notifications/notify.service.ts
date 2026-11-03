import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_PROVIDER } from './push.provider';
import type { PushMessage, PushProvider } from './push.provider';
import { RealtimeGateway } from './realtime.gateway';

/** Lock-screen wording. Medication names are never put in a push. */
export const ALERT_TEXT: Record<string, { self: string; caretaker: string }> = {
  crisis: {
    self: 'Pebble อยู่ตรงนี้นะ ถ้าต้องการคุยกับใครสักคน โทร 1323 ได้ตลอด 24 ชั่วโมง',
    caretaker: 'อาจต้องการความช่วยเหลือ กรุณาติดต่อโดยเร็ว',
  },
  missed_dose: {
    self: 'ยังไม่ได้กดยืนยันการกินยารอบล่าสุด',
    caretaker: 'ยังไม่ได้กินยาตามเวลา',
  },
  low_battery: {
    self: 'แบตเตอรี่หุ่น Pebble ใกล้หมด วางบนแท่นชาร์จด้วยนะ',
    caretaker: 'แบตเตอรี่หุ่น Pebble ใกล้หมด',
  },
  device_offline: {
    self: 'หุ่น Pebble ขาดการเชื่อมต่อ ลองเช็ก Wi-Fi หรือการชาร์จ',
    caretaker: 'หุ่น Pebble ขาดการเชื่อมต่อ',
  },
  dispenser_jam: {
    self: 'ช่องจ่ายยาของหุ่น Pebble ติดขัด',
    caretaker: 'ช่องจ่ายยาของหุ่น Pebble ติดขัด',
  },
};

export interface AlertFanout {
  alertId: string;
  userId: string;
  type: string;
  severity: string;
  createdAt: Date;
  deliveries: { deliveryId: string; caretakerUserId: string | null; linkId: string | null }[];
}

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  // ---------------------------------------------------------------------
  // Push tokens
  // ---------------------------------------------------------------------
  async registerToken(userId: string, token: string, platform: 'ios' | 'android') {
    // A phone can change hands (log out / log in): the token follows the current user.
    await this.prisma.push_tokens.upsert({
      where: { token },
      create: { user_id: userId, token, platform, last_used_at: new Date() },
      update: { user_id: userId, platform, last_used_at: new Date() },
    });
  }

  async removeToken(userId: string, token: string) {
    await this.prisma.push_tokens.deleteMany({ where: { token, user_id: userId } });
  }

  // ---------------------------------------------------------------------
  // Alerts -> push + realtime
  // ---------------------------------------------------------------------
  async alert(a: AlertFanout) {
    const text = ALERT_TEXT[a.type] ?? { self: a.type, caretaker: a.type };
    const priority = a.severity === 'critical' ? 'high' : 'normal';
    const person = await this.prisma.users.findUnique({
      where: { id: a.userId },
      select: { display_name: true },
    });
    const name = person?.display_name ?? '';

    const perRecipient: { userId: string; title: string; body: string; data: Record<string, unknown> }[] = [];
    for (const d of a.deliveries) {
      if (d.caretakerUserId) {
        const payload = {
          kind: 'caretaking_alert',
          deliveryId: d.deliveryId,
          linkId: d.linkId,
          person: name,
          type: a.type,
          severity: a.severity,
          createdAt: a.createdAt,
        };
        this.realtime.toUser(d.caretakerUserId, 'alert', payload);
        perRecipient.push({
          userId: d.caretakerUserId,
          title: `Pebble · ${name}`,
          body: `${name}: ${text.caretaker}`,
          data: payload,
        });
      } else {
        const payload = {
          kind: 'own_alert',
          alertId: a.alertId,
          type: a.type,
          severity: a.severity,
          createdAt: a.createdAt,
        };
        this.realtime.toUser(a.userId, 'alert', payload);
        perRecipient.push({ userId: a.userId, title: 'Pebble', body: text.self, data: payload });
      }
    }
    await this.pushToUsers(perRecipient, priority);
  }

  // ---------------------------------------------------------------------
  // Dose due -> push to user, realtime to user + robot(s)
  // ---------------------------------------------------------------------
  async doseDue(dose: {
    id: string;
    userId: string;
    scheduledAt: Date;
    medicationId: string;
    dispenserSlot: number | null;
  }) {
    const payload = {
      doseId: dose.id,
      scheduledAt: dose.scheduledAt,
      medicationId: dose.medicationId,
      dispenserSlot: dose.dispenserSlot,
    };
    this.realtime.toUser(dose.userId, 'dose:due', payload);

    const robots = await this.prisma.devices.findMany({
      where: { owner_user_id: dose.userId },
      select: { id: true },
    });
    for (const r of robots) this.realtime.toDevice(r.id, 'dose:due', payload);

    await this.pushToUsers(
      [
        {
          userId: dose.userId,
          title: 'Pebble',
          body: 'ถึงเวลากินยาแล้วนะ',
          data: { kind: 'dose_due', ...payload },
        },
      ],
      'high',
    );
  }

  // ---------------------------------------------------------------------
  private async pushToUsers(
    items: { userId: string; title: string; body: string; data: Record<string, unknown> }[],
    priority: 'high' | 'normal',
  ) {
    if (!items.length) return;
    const tokens = await this.prisma.push_tokens.findMany({
      where: {
        user_id: { in: [...new Set(items.map((i) => i.userId))] },
        platform: { in: ['ios', 'android'] },
      },
      select: { user_id: true, token: true },
    });

    const messages: PushMessage[] = [];
    for (const item of items) {
      for (const t of tokens.filter((t) => t.user_id === item.userId)) {
        messages.push({ to: t.token, title: item.title, body: item.body, data: item.data, priority });
      }
    }
    if (!messages.length) return;

    const result = await this.push.send(messages);
    if (result.invalidTokens.length) {
      await this.prisma.push_tokens.deleteMany({ where: { token: { in: result.invalidTokens } } });
      this.logger.log(`Removed ${result.invalidTokens.length} expired push token(s)`);
    }
    if (result.failed) this.logger.warn(`${result.failed} push message(s) failed`);
  }
}
