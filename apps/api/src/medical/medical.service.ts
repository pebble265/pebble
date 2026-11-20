import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmergencyContactDto, MedicalInfoDto } from './dto/medical.dto';

/** The hotlines every account starts with (see AuthService). Shown to the user but not editable. */
export const HOTLINES = ['1323', '1669'];
const MAX_CONTACTS = 5;

export type MedicalInfo = {
  allergies: string[];
  conditions: string[];
  doctor: { name: string; place: string; phone: string };
};

const EMPTY: MedicalInfo = { allergies: [], conditions: [], doctor: { name: '', place: '', phone: '' } };

/** Clean a free-text list: trimmed, no blanks, no repeats (case-insensitive). */
function tidy(list: string[]) {
  const seen = new Set<string>();
  return list
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

/**
 * Allergies, conditions and the regular doctor live in one encrypted JSON blob on the user
 * (health data: never stored in plain text). Emergency contacts use their own table, which the
 * chat already reads when it detects a crisis.
 */
@Injectable()
export class MedicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async get(userId: string) {
    const [user, contacts] = await Promise.all([
      this.prisma.users.findUniqueOrThrow({ where: { id: userId }, select: { medical_enc: true } }),
      this.prisma.emergency_contacts.findMany({
        where: { user_id: userId },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      ...this.decode(user.medical_enc),
      contacts: contacts.map((c) => ({
        id: c.id,
        label: c.label,
        phone: c.phone,
        hotline: HOTLINES.includes(c.phone.replace(/\D/g, '')),
      })),
    };
  }

  /** Just the info part, for other services (e.g. allergy checks). */
  async info(userId: string): Promise<MedicalInfo> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { id: userId }, select: { medical_enc: true } });
    return this.decode(user.medical_enc);
  }

  async update(userId: string, dto: MedicalInfoDto) {
    const info: MedicalInfo = {
      allergies: tidy(dto.allergies),
      conditions: tidy(dto.conditions),
      doctor: {
        name: dto.doctor?.name?.trim() ?? '',
        place: dto.doctor?.place?.trim() ?? '',
        phone: dto.doctor?.phone?.trim() ?? '',
      },
    };
    const empty = !info.allergies.length && !info.conditions.length && !info.doctor.name && !info.doctor.place && !info.doctor.phone;
    await this.prisma.users.update({
      where: { id: userId },
      data: { medical_enc: empty ? null : this.crypto.encrypt(JSON.stringify(info)), updated_at: new Date() },
    });
    return this.get(userId);
  }

  async addContact(userId: string, dto: EmergencyContactDto) {
    const mine = await this.prisma.emergency_contacts.findMany({ where: { user_id: userId }, select: { phone: true, sort_order: true } });
    const personal = mine.filter((c) => !HOTLINES.includes(c.phone.replace(/\D/g, '')));
    if (personal.length >= MAX_CONTACTS) throw new BadRequestException(`At most ${MAX_CONTACTS} emergency contacts`);
    const digits = dto.phone.replace(/\D/g, '');
    if (mine.some((c) => c.phone.replace(/\D/g, '') === digits)) throw new BadRequestException('This number is already a contact');
    await this.prisma.emergency_contacts.create({
      data: {
        user_id: userId,
        label: dto.label.trim(),
        phone: dto.phone.trim(),
        // personal contacts come after the hotlines
        sort_order: Math.max(1, ...mine.map((c) => c.sort_order)) + 1,
      },
    });
    return this.get(userId);
  }

  async updateContact(userId: string, id: string, dto: EmergencyContactDto) {
    await this.ownContact(userId, id);
    await this.prisma.emergency_contacts.update({ where: { id }, data: { label: dto.label.trim(), phone: dto.phone.trim() } });
    return this.get(userId);
  }

  async removeContact(userId: string, id: string) {
    await this.ownContact(userId, id);
    await this.prisma.emergency_contacts.delete({ where: { id } });
    return this.get(userId);
  }

  private async ownContact(userId: string, id: string) {
    const c = await this.prisma.emergency_contacts.findFirst({ where: { id, user_id: userId } });
    if (!c) throw new NotFoundException('Contact not found');
    if (HOTLINES.includes(c.phone.replace(/\D/g, ''))) throw new BadRequestException('Hotlines cannot be changed');
  }

  private decode(enc: Uint8Array | null): MedicalInfo {
    const raw = this.crypto.decryptOptional(enc);
    if (!raw) return structuredClone(EMPTY);
    try {
      const v = JSON.parse(raw) as Partial<MedicalInfo>;
      return {
        allergies: v.allergies ?? [],
        conditions: v.conditions ?? [],
        doctor: { ...EMPTY.doctor, ...(v.doctor ?? {}) },
      };
    } catch {
      return structuredClone(EMPTY);
    }
  }
}
