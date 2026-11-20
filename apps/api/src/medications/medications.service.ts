import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  addDays,
  ALL_DAYS,
  dateColumnToString,
  daysToMask,
  localDateOf,
  maskToDays,
  stringToDateColumn,
  stringToTimeColumn,
  timeColumnToString,
} from '../common/time';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { ScheduleDto } from './dto/schedule.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

type MedicationWithSchedules = Prisma.medicationsGetPayload<{
  include: { medication_schedules: true };
}>;

@Injectable()
export class MedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async list(userId: string) {
    const today = await this.todayFor(userId);
    const meds = await this.prisma.medications.findMany({
      where: { user_id: userId, deleted_at: null },
      include: { medication_schedules: true },
      orderBy: { created_at: 'asc' },
    });
    return meds.map((m) => this.toResponse(m, today));
  }

  async get(userId: string, id: string) {
    const med = await this.findOwned(userId, id);
    return this.toResponse(med, await this.todayFor(userId));
  }

  async create(userId: string, dto: CreateMedicationDto) {
    const today = await this.todayFor(userId);

    const med = await this.prisma.$transaction(async (tx) => {
      const created = await tx.medications.create({
        data: {
          user_id: userId,
          name_enc: this.crypto.encrypt(dto.name.trim()),
          dosage_enc: this.crypto.encryptOptional(dto.dosage?.trim()),
          instructions_enc: this.crypto.encryptOptional(
            dto.instructions?.trim(),
          ),
          dispenser_slot: dto.dispenserSlot ?? null,
          pills_remaining: dto.pillsRemaining ?? null,
          ...(dto.sound && { alarm_sound: dto.sound }),
        },
      });

      if (dto.schedules.length) {
        await tx.medication_schedules.createMany({
          data: dto.schedules.map((s) =>
            this.scheduleData(created.id, s, today),
          ),
        });
      }

      await tx.users.update({
        where: { id: userId },
        data: { uses_medication: true },
      });

      return tx.medications.findUniqueOrThrow({
        where: { id: created.id },
        include: { medication_schedules: true },
      });
    });

    return this.toResponse(med, today);
  }

  async update(userId: string, id: string, dto: UpdateMedicationDto) {
    const existing = await this.findOwned(userId, id);
    const today = await this.todayFor(userId);
    const now = new Date();

    const med = await this.prisma.$transaction(async (tx) => {
      await tx.medications.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined && {
            name_enc: this.crypto.encrypt(dto.name.trim()),
          }),
          ...(dto.dosage !== undefined && {
            dosage_enc: this.crypto.encryptOptional(dto.dosage.trim()),
          }),
          ...(dto.instructions !== undefined && {
            instructions_enc: this.crypto.encryptOptional(
              dto.instructions.trim(),
            ),
          }),
          ...(dto.dispenserSlot !== undefined && {
            dispenser_slot: dto.dispenserSlot,
          }),
          ...(dto.pillsRemaining !== undefined && {
            pills_remaining: dto.pillsRemaining,
          }),
          ...(dto.sound !== undefined && { alarm_sound: dto.sound }),
        },
      });

      if (dto.schedules) {
        // Old schedules are retired (not deleted) so dose history is kept.
        const oldIds = existing.medication_schedules.map((s) => s.id);
        await tx.dose_events.deleteMany({
          where: {
            schedule_id: { in: oldIds },
            status: 'pending',
            scheduled_at: { gt: now },
          },
        });
        await tx.medication_schedules.updateMany({
          where: {
            id: { in: oldIds },
            OR: [
              { end_date: null },
              { end_date: { gte: stringToDateColumn(today) } },
            ],
          },
          data: { end_date: stringToDateColumn(addDays(today, -1)) },
        });
        if (dto.schedules.length) {
          await tx.medication_schedules.createMany({
            data: dto.schedules.map((s) =>
              this.scheduleData(existing.id, s, today),
            ),
          });
        }
      }

      return tx.medications.findUniqueOrThrow({
        where: { id: existing.id },
        include: { medication_schedules: true },
      });
    });

    return this.toResponse(med, today);
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOwned(userId, id);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.dose_events.deleteMany({
        where: {
          schedule_id: { in: existing.medication_schedules.map((s) => s.id) },
          status: 'pending',
          scheduled_at: { gt: now },
        },
      }),
      this.prisma.medications.update({
        where: { id: existing.id },
        data: { deleted_at: now, is_active: false },
      }),
    ]);
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  private async findOwned(
    userId: string,
    id: string,
  ): Promise<MedicationWithSchedules> {
    const med = await this.prisma.medications.findFirst({
      where: { id, user_id: userId, deleted_at: null },
      include: { medication_schedules: true },
    });
    if (!med) throw new NotFoundException('Medication not found');
    return med;
  }

  private async todayFor(userId: string): Promise<string> {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    return localDateOf(new Date(), user.timezone);
  }

  private scheduleData(medicationId: string, s: ScheduleDto, today: string) {
    return {
      medication_id: medicationId,
      time_of_day: stringToTimeColumn(s.time),
      days_of_week: daysToMask(s.daysOfWeek ?? ALL_DAYS),
      start_date: stringToDateColumn(s.startDate ?? today),
      end_date: s.endDate ? stringToDateColumn(s.endDate) : null,
      grace_minutes: s.graceMinutes ?? 60,
    };
  }

  private toResponse(m: MedicationWithSchedules, today: string) {
    const current = m.medication_schedules
      .filter((s) => !s.end_date || dateColumnToString(s.end_date) >= today)
      .sort((a, b) => a.time_of_day.getTime() - b.time_of_day.getTime());

    return {
      id: m.id,
      name: this.crypto.decrypt(m.name_enc),
      dosage: this.crypto.decryptOptional(m.dosage_enc),
      instructions: this.crypto.decryptOptional(m.instructions_enc),
      dispenserSlot: m.dispenser_slot,
      pillsRemaining: m.pills_remaining,
      sound: m.alarm_sound,
      isActive: m.is_active,
      schedules: current.map((s) => ({
        id: s.id,
        time: timeColumnToString(s.time_of_day),
        daysOfWeek: maskToDays(s.days_of_week),
        startDate: dateColumnToString(s.start_date),
        endDate: s.end_date ? dateColumnToString(s.end_date) : null,
        graceMinutes: s.grace_minutes,
      })),
      createdAt: m.created_at,
    };
  }
}
