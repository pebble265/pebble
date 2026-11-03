import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  addDays,
  dateColumnToString,
  isoWeekday,
  localDateOf,
  timeColumnToString,
  zonedToUtc,
} from '../common/time';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { DoseActionDto } from './dto/dose.dto';

/** A dose may be confirmed at most this long before its scheduled time. */
const EARLY_WINDOW_MS = 60 * 60 * 1000;

const doseInclude = {
  medication_schedules: { include: { medications: true } },
} satisfies Prisma.dose_eventsInclude;

type DoseWithMedication = Prisma.dose_eventsGetPayload<{
  include: typeof doseInclude;
}>;

@Injectable()
export class DosesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ---------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------
  /** Today's doses in the user's timezone (creates them if missing). */
  async today(userId: string) {
    const tz = await this.timezoneOf(userId);
    const today = localDateOf(new Date(), tz);
    await this.ensureDoseEvents(userId, tz, today, 2);

    const doses = await this.prisma.dose_events.findMany({
      where: {
        user_id: userId,
        scheduled_at: {
          gte: zonedToUtc(today, '00:00', tz),
          lt: zonedToUtc(addDays(today, 1), '00:00', tz),
        },
      },
      include: doseInclude,
      orderBy: { scheduled_at: 'asc' },
    });

    return { date: today, timezone: tz, doses: doses.map((d) => this.toResponse(d)) };
  }

  /** Last N days of doses plus an adherence summary. */
  async history(userId: string, days = 7) {
    const tz = await this.timezoneOf(userId);
    const today = localDateOf(new Date(), tz);
    const from = zonedToUtc(addDays(today, -(days - 1)), '00:00', tz);

    const doses = await this.prisma.dose_events.findMany({
      where: {
        user_id: userId,
        scheduled_at: { gte: from },
        // past doses, plus upcoming ones already taken/skipped early
        OR: [
          { scheduled_at: { lte: new Date() } },
          { status: { in: ['taken', 'skipped'] } },
        ],
      },
      include: doseInclude,
      orderBy: { scheduled_at: 'desc' },
    });

    const count = (s: string) => doses.filter((d) => d.status === s).length;
    const taken = count('taken');
    const missed = count('missed');
    const skipped = count('skipped');
    const decided = taken + missed + skipped;

    return {
      from: addDays(today, -(days - 1)),
      to: today,
      summary: {
        taken,
        missed,
        skipped,
        pending: count('pending'),
        adherenceRate: decided ? Math.round((taken / decided) * 100) / 100 : null,
      },
      doses: doses.map((d) => this.toResponse(d)),
    };
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  async take(userId: string, doseId: string, dto: DoseActionDto) {
    const dose = await this.findOwned(userId, doseId);
    const now = new Date();

    if (dose.status === 'taken') {
      throw new ConflictException('Dose already taken');
    }
    if (dose.scheduled_at.getTime() - now.getTime() > EARLY_WINDOW_MS) {
      throw new BadRequestException('Too early to take this dose');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.dose_events.update({
        where: { id: dose.id },
        data: {
          status: 'taken',
          confirmed_at: now,
          confirmed_via: dto.via ?? 'app',
          note: dto.note ?? dose.note,
        },
        include: doseInclude,
      });
      await tx.medications.updateMany({
        where: {
          id: dose.medication_schedules.medication_id,
          pills_remaining: { gt: 0 },
        },
        data: { pills_remaining: { decrement: 1 } },
      });
      return result;
    });

    return this.toResponse(updated);
  }

  async skip(userId: string, doseId: string, dto: DoseActionDto) {
    const dose = await this.findOwned(userId, doseId);
    if (dose.status === 'taken') {
      throw new ConflictException('Dose already taken');
    }

    const updated = await this.prisma.dose_events.update({
      where: { id: dose.id },
      data: {
        status: 'skipped',
        confirmed_at: new Date(),
        confirmed_via: dto.via ?? 'app',
        note: dto.note ?? dose.note,
      },
      include: doseInclude,
    });
    return this.toResponse(updated);
  }

  // ---------------------------------------------------------------------
  // Used by the background jobs
  // ---------------------------------------------------------------------
  /** Create dose_events rows for `days` days starting at `fromDate`. Safe to re-run. */
  async ensureDoseEvents(
    userId: string,
    tz: string,
    fromDate: string,
    days: number,
  ): Promise<number> {
    const schedules = await this.prisma.medication_schedules.findMany({
      where: {
        medications: { user_id: userId, deleted_at: null, is_active: true },
      },
    });

    const rows: Prisma.dose_eventsCreateManyInput[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(fromDate, i);
      const weekdayBit = 1 << (isoWeekday(date) - 1);

      for (const s of schedules) {
        if (dateColumnToString(s.start_date) > date) continue;
        if (s.end_date && dateColumnToString(s.end_date) < date) continue;
        if (!(s.days_of_week & weekdayBit)) continue;

        const scheduledAt = zonedToUtc(date, timeColumnToString(s.time_of_day), tz);
        // Don't create doses that were already in the past when the schedule was added.
        if (scheduledAt < s.created_at) continue;

        rows.push({ schedule_id: s.id, user_id: userId, scheduled_at: scheduledAt });
      }
    }

    if (!rows.length) return 0;
    const { count } = await this.prisma.dose_events.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return count;
  }

  /** Every user taking medication: make sure today + tomorrow exist. */
  async generateForAllUsers(): Promise<number> {
    const users = await this.prisma.users.findMany({
      where: { uses_medication: true, deleted_at: null },
      select: { id: true, timezone: true },
    });
    let total = 0;
    for (const u of users) {
      const today = localDateOf(new Date(), u.timezone);
      total += await this.ensureDoseEvents(u.id, u.timezone, today, 2);
    }
    return total;
  }

  /** Pending doses past their grace period become "missed" and raise an alert. */
  async markMissed(): Promise<number> {
    const missed = await this.prisma.$queryRaw<{ id: string; user_id: string }[]>`
      UPDATE dose_events d
         SET status = 'missed'
        FROM medication_schedules s
       WHERE d.schedule_id = s.id
         AND d.status = 'pending'
         AND d.scheduled_at + make_interval(mins => s.grace_minutes) < now()
   RETURNING d.id, d.user_id`;

    if (missed.length) {
      await this.prisma.alerts.createMany({
        data: missed.map((d) => ({
          user_id: d.user_id,
          type: 'missed_dose' as const,
          severity: 'warning' as const,
          related_dose_id: d.id,
        })),
      });
    }
    return missed.length;
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  private async findOwned(userId: string, doseId: string): Promise<DoseWithMedication> {
    const dose = await this.prisma.dose_events.findFirst({
      where: { id: doseId, user_id: userId },
      include: doseInclude,
    });
    if (!dose) throw new NotFoundException('Dose not found');
    return dose;
  }

  private async timezoneOf(userId: string): Promise<string> {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    return user.timezone;
  }

  private toResponse(d: DoseWithMedication) {
    const med = d.medication_schedules.medications;
    return {
      id: d.id,
      scheduledAt: d.scheduled_at,
      status: d.status,
      confirmedAt: d.confirmed_at,
      confirmedVia: d.confirmed_via,
      note: d.note,
      medication: {
        id: med.id,
        name: this.crypto.decrypt(med.name_enc),
        dosage: this.crypto.decryptOptional(med.dosage_enc),
        instructions: this.crypto.decryptOptional(med.instructions_enc),
        dispenserSlot: med.dispenser_slot,
      },
    };
  }
}
