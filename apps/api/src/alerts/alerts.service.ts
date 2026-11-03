import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CaretakersService } from '../caretakers/caretakers.service';
import { NotifyService } from '../notifications/notify.service';
import { PrismaService } from '../prisma/prisma.service';

/** Only alerts newer than this get delivered (avoids flooding after downtime). */
const DISPATCH_WINDOW_HOURS = 24;

const MESSAGES: Record<string, string> = {
  crisis: 'อาจต้องการความช่วยเหลือ กรุณาติดต่อโดยเร็ว',
  missed_dose: 'ยังไม่ได้กินยาตามเวลา',
  low_battery: 'แบตเตอรี่หุ่น Pebble ใกล้หมด',
  device_offline: 'หุ่น Pebble ขาดการเชื่อมต่อ',
  dispenser_jam: 'ช่องจ่ายยาของหุ่น Pebble ติดขัด',
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caretakers: CaretakersService,
    private readonly notify: NotifyService,
  ) {}

  // =====================================================================
  // Delivery
  // =====================================================================

  /**
   * Finds alerts nobody has been told about yet and records who should see
   * them: the user themself + caretakers whose permissions allow that type,
   * then sends push notifications and realtime events to each of them.
   */
  async dispatchPending(): Promise<number> {
    const since = new Date(Date.now() - DISPATCH_WINDOW_HOURS * 60 * 60 * 1000);
    const pending = await this.prisma.alerts.findMany({
      where: { created_at: { gte: since }, alert_deliveries: { none: {} } },
      select: { id: true, user_id: true, type: true, severity: true, created_at: true },
      orderBy: { created_at: 'asc' },
      take: 200,
    });

    for (const a of pending) {
      const recipients = await this.caretakers.recipientsFor(a.user_id, a.type);
      const rows = await this.prisma.alert_deliveries.createManyAndReturn({
        data: [
          { alert_id: a.id, caretaker_link_id: null, channel: 'push' },
          ...recipients.map((r) => ({
            alert_id: a.id,
            caretaker_link_id: r.linkId,
            channel: 'push',
          })),
        ],
        select: { id: true, caretaker_link_id: true },
      });

      const caretakerOf = new Map(recipients.map((r) => [r.linkId, r.caretakerUserId]));
      try {
        await this.notify.alert({
          alertId: a.id,
          userId: a.user_id,
          type: a.type,
          severity: a.severity,
          createdAt: a.created_at,
          deliveries: rows.map((r) => ({
            deliveryId: r.id,
            linkId: r.caretaker_link_id,
            caretakerUserId: r.caretaker_link_id
              ? (caretakerOf.get(r.caretaker_link_id) ?? null)
              : null,
          })),
        });
      } catch (e) {
        // Delivery rows are saved; the inbox still shows the alert even if push failed.
        this.logger.error(`Notify failed for alert ${a.id}: ${(e as Error).message}`);
      }
    }
    return pending.length;
  }

  // =====================================================================
  // The user's own alerts
  // =====================================================================

  async listMine(userId: string, openOnly: boolean) {
    const rows = await this.prisma.alerts.findMany({
      where: { user_id: userId, ...(openOnly && { resolved_at: null }) },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return rows.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      message: MESSAGES[a.type] ?? a.type,
      createdAt: a.created_at,
      resolvedAt: a.resolved_at,
    }));
  }

  async resolve(userId: string, alertId: string) {
    const { count } = await this.prisma.alerts.updateMany({
      where: { id: alertId, user_id: userId, resolved_at: null },
      data: { resolved_at: new Date() },
    });
    if (count === 0) throw new NotFoundException('Alert not found or already resolved');
  }

  // =====================================================================
  // Caretaker inbox
  // =====================================================================

  async caretakerInbox(caretakerId: string, unackedOnly: boolean) {
    const links = await this.prisma.caretaker_links.findMany({
      where: { caretaker_user_id: caretakerId, status: 'accepted' },
      select: { id: true, user_id: true, relationship_label: true },
    });
    if (!links.length) return [];

    const people = await this.prisma.users.findMany({
      where: { id: { in: links.map((l) => l.user_id) }, deleted_at: null },
      select: { id: true, display_name: true },
    });
    const nameOf = new Map(people.map((p) => [p.id, p.display_name]));
    const linkById = new Map(links.map((l) => [l.id, l]));

    const rows = await this.prisma.alert_deliveries.findMany({
      where: {
        caretaker_link_id: { in: links.map((l) => l.id) },
        ...(unackedOnly && { acknowledged_at: null }),
      },
      include: {
        alerts: { select: { type: true, severity: true, created_at: true, resolved_at: true } },
      },
      orderBy: { sent_at: 'desc' },
      take: 100,
    });

    return rows
      .filter((d) => nameOf.has(linkById.get(d.caretaker_link_id!)!.user_id))
      .map((d) => {
        const link = linkById.get(d.caretaker_link_id!)!;
        const name = nameOf.get(link.user_id)!;
        return {
          deliveryId: d.id,
          linkId: link.id,
          person: name,
          relationshipLabel: link.relationship_label,
          type: d.alerts.type,
          severity: d.alerts.severity,
          message: `${name}: ${MESSAGES[d.alerts.type] ?? d.alerts.type}`,
          createdAt: d.alerts.created_at,
          resolvedAt: d.alerts.resolved_at,
          acknowledgedAt: d.acknowledged_at,
        };
      });
  }

  /** Caretaker taps "I've seen this". */
  async acknowledge(caretakerId: string, deliveryId: string) {
    const links = await this.prisma.caretaker_links.findMany({
      where: { caretaker_user_id: caretakerId, status: 'accepted' },
      select: { id: true },
    });
    const { count } = await this.prisma.alert_deliveries.updateMany({
      where: {
        id: deliveryId,
        caretaker_link_id: { in: links.map((l) => l.id) },
        acknowledged_at: null,
      },
      data: { acknowledged_at: new Date() },
    });
    if (count === 0) throw new NotFoundException('Alert not found or already acknowledged');
  }
}
