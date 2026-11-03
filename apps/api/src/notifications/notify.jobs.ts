import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyService } from './notify.service';

/** A dose counts as "just became due" if its time passed within this window. */
const DUE_WINDOW_MS = 2 * 60_000;

@Injectable()
export class NotifyJobs {
  private readonly logger = new Logger(NotifyJobs.name);
  /** Dose ids already announced (kept ~10 min) so a dose isn't announced twice. */
  private readonly announced = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
  ) {}

  /** When a dose time arrives: push to the phone, tell the robot to dispense. */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async dosesDue() {
    try {
      const now = Date.now();
      for (const [id, at] of this.announced) {
        if (now - at > 10 * 60_000) this.announced.delete(id);
      }

      const due = await this.prisma.dose_events.findMany({
        where: {
          status: 'pending',
          scheduled_at: { gt: new Date(now - DUE_WINDOW_MS), lte: new Date(now) },
        },
        include: {
          medication_schedules: {
            select: {
              medication_id: true,
              medications: { select: { dispenser_slot: true, deleted_at: true } },
            },
          },
        },
      });

      for (const d of due) {
        if (this.announced.has(d.id)) continue;
        if (d.medication_schedules.medications.deleted_at) continue;
        this.announced.set(d.id, now);
        await this.notify.doseDue({
          id: d.id,
          userId: d.user_id,
          scheduledAt: d.scheduled_at,
          medicationId: d.medication_schedules.medication_id,
          dispenserSlot: d.medication_schedules.medications.dispenser_slot,
        });
      }
      if (due.length) this.logger.log(`Dose due: announced ${due.length}`);
    } catch (e) {
      this.logger.error('Dose reminder failed', e as Error);
    }
  }
}
