import { Injectable, NotFoundException } from '@nestjs/common';
import { addDays, localDateOf, zonedToUtc } from '../common/time';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

/** Thai labels for the 7-step scale, shared with the app. */
export const MOOD_LABELS = ['', 'แย่มาก', 'เศร้า', 'ไม่ค่อยดี', 'เฉย ๆ', 'สงบ', 'ดี', 'ดีมาก'];

/** At most one check-in per this window; a new tap within it replaces the last one. */
const REPLACE_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class MoodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async create(userId: string, score: number, source: 'app' | 'robot' = 'app', note?: string) {
    const noteData = note !== undefined ? { note_enc: this.crypto.encryptOptional(note.trim() || null) } : {};
    const now = new Date();
    // Tapping a few emoji in a row is one check-in, not several.
    const recent = await this.prisma.mood_checkins.findFirst({
      where: { user_id: userId, created_at: { gte: new Date(now.getTime() - REPLACE_WINDOW_MS) } },
      orderBy: { created_at: 'desc' },
    });
    const row = recent
      ? await this.prisma.mood_checkins.update({ where: { id: recent.id }, data: { score, source, ...noteData } })
      : await this.prisma.mood_checkins.create({ data: { user_id: userId, score, source, ...noteData } });
    return this.toResponse(row);
  }

  /** Add / change / clear ("") the note of one of my check-ins. */
  async setNote(userId: string, id: string, note: string) {
    const row = await this.prisma.mood_checkins.findFirst({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('Check-in not found');
    const updated = await this.prisma.mood_checkins.update({
      where: { id },
      data: { note_enc: this.crypto.encryptOptional(note.trim() || null) },
    });
    return this.toResponse(updated);
  }

  /** Check-ins for the last `days` local days (today included), newest first. */
  async list(userId: string, days: number) {
    const { timezone } = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = localDateOf(new Date(), timezone);
    const from = zonedToUtc(addDays(today, -(days - 1)), '00:00', timezone);
    const rows = await this.prisma.mood_checkins.findMany({
      where: { user_id: userId, created_at: { gte: from } },
      orderBy: { created_at: 'desc' },
    });
    const entries = rows.map((r) => ({ ...this.toResponse(r), date: localDateOf(r.created_at, timezone) }));
    return {
      timezone,
      today: entries.find((e) => e.date === today) ?? null,
      entries,
    };
  }

  private toResponse(r: { id: string; score: number; source: string; created_at: Date; note_enc?: Uint8Array | null }) {
    return {
      id: r.id,
      score: r.score,
      label: MOOD_LABELS[r.score],
      source: r.source,
      note: this.crypto.decryptOptional(r.note_enc ?? null),
      createdAt: r.created_at,
    };
  }
}
