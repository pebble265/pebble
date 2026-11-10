import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  dateColumnToString,
  maskToDays,
  timeColumnToString,
} from '../common/time';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { POLICY_VERSION } from '../users/users.service';
import { ConsentType, CONSENT_TYPES, isConsentActive } from './consent';

/** Items the user deleted are kept this long, then removed for good. */
export const PURGE_AFTER_DAYS = 30;

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // =====================================================================
  // 1. Export everything we hold about the user (right of access / portability)
  // =====================================================================
  async exportAll(userId: string, ip?: string) {
    const p = this.prisma;
    const dec = (b: Uint8Array | null) => this.crypto.decryptOptional(b);

    const [
      user, consents, settings, contacts, meds, doses, devices,
      myCaretakers, caringFor, conversations, memories, alerts, tokens, accessLog, moods,
    ] = await Promise.all([
      p.users.findUniqueOrThrow({ where: { id: userId } }),
      p.consents.findMany({ where: { user_id: userId }, orderBy: { granted_at: 'asc' } }),
      p.robot_settings.findUnique({ where: { user_id: userId } }),
      p.emergency_contacts.findMany({ where: { user_id: userId }, orderBy: { sort_order: 'asc' } }),
      p.medications.findMany({
        where: { user_id: userId },
        include: { medication_schedules: true },
        orderBy: { created_at: 'asc' },
      }),
      p.dose_events.findMany({ where: { user_id: userId }, orderBy: { scheduled_at: 'asc' } }),
      p.devices.findMany({ where: { owner_user_id: userId } }),
      p.caretaker_links.findMany({ where: { user_id: userId }, include: { caretaker_permissions: true } }),
      p.caretaker_links.findMany({ where: { caretaker_user_id: userId } }),
      p.conversations.findMany({
        where: { user_id: userId },
        include: { conversation_summaries: true },
        orderBy: { started_at: 'asc' },
      }),
      p.companion_memories.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } }),
      p.alerts.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } }),
      p.push_tokens.findMany({ where: { user_id: userId } }),
      p.audit_logs.findMany({ where: { target_user_id: userId }, orderBy: { created_at: 'asc' } }),
      p.mood_checkins.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } }),
    ]);

    const otherIds = [
      ...myCaretakers.map((l) => l.caretaker_user_id),
      ...caringFor.map((l) => l.user_id),
      ...accessLog.map((a) => a.actor_user_id),
    ].filter((x): x is string => !!x);
    const others = await p.users.findMany({
      where: { id: { in: [...new Set(otherIds)] } },
      select: { id: true, display_name: true },
    });
    const nameOf = (id: string | null) =>
      id ? (others.find((o) => o.id === id)?.display_name ?? '(deleted account)') : null;

    await p.audit_logs.create({
      data: {
        actor_user_id: userId,
        action: 'export_data',
        target_user_id: userId,
        target_type: 'user',
        target_id: userId,
        ip_address: ip ?? null,
      },
    });

    return {
      exportedAt: new Date(),
      format: 'pebble-export-v1',
      profile: {
        email: user.email,
        displayName: user.display_name,
        locale: user.locale,
        timezone: user.timezone,
        usesMedication: user.uses_medication,
        onboardedAt: user.onboarded_at,
        createdAt: user.created_at,
      },
      consents: consents.map((c) => ({
        type: c.consent_type,
        policyVersion: c.policy_version,
        grantedAt: c.granted_at,
        revokedAt: c.revoked_at,
      })),
      robotSettings: settings && {
        robotName: settings.robot_name,
        voiceId: settings.voice_id,
        speechRate: Number(settings.speech_rate),
        greetingText: settings.greeting_text,
        wakeWord: settings.wake_word,
        faceTheme: settings.face_theme,
        quietHoursStart: settings.quiet_hours_start ? timeColumnToString(settings.quiet_hours_start) : null,
        quietHoursEnd: settings.quiet_hours_end ? timeColumnToString(settings.quiet_hours_end) : null,
      },
      emergencyContacts: contacts.map((c) => ({ label: c.label, phone: c.phone })),
      medications: meds.map((m) => ({
        id: m.id,
        name: dec(m.name_enc),
        dosage: dec(m.dosage_enc),
        instructions: dec(m.instructions_enc),
        dispenserSlot: m.dispenser_slot,
        pillsRemaining: m.pills_remaining,
        createdAt: m.created_at,
        deletedAt: m.deleted_at,
        schedules: m.medication_schedules.map((s) => ({
          time: timeColumnToString(s.time_of_day),
          daysOfWeek: maskToDays(s.days_of_week),
          startDate: dateColumnToString(s.start_date),
          endDate: s.end_date ? dateColumnToString(s.end_date) : null,
        })),
      })),
      doseHistory: doses.map((d) => ({
        medicationScheduleId: d.schedule_id,
        scheduledAt: d.scheduled_at,
        status: d.status,
        dispensedAt: d.dispensed_at,
        confirmedAt: d.confirmed_at,
        confirmedVia: d.confirmed_via,
        note: d.note,
      })),
      moodCheckins: moods.map((m) => ({
        score: m.score,
        source: m.source,
        createdAt: m.created_at,
      })),
      robots: devices.map((d) => ({
        serialNumber: d.serial_number,
        status: d.status,
        pairedAt: d.paired_at,
        lastSeenAt: d.last_seen_at,
      })),
      myCaretakers: myCaretakers.map((l) => ({
        name: nameOf(l.caretaker_user_id),
        inviteEmail: l.invite_email,
        relationshipLabel: l.relationship_label,
        status: l.status,
        createdAt: l.created_at,
        acceptedAt: l.accepted_at,
        revokedAt: l.revoked_at,
        permissions: l.caretaker_permissions && {
          alertOnCrisis: l.caretaker_permissions.alert_on_crisis,
          alertOnMissedDose: l.caretaker_permissions.alert_on_missed_dose,
          alertOnDeviceIssue: l.caretaker_permissions.alert_on_device_offline,
          viewAdherence: l.caretaker_permissions.view_adherence,
          viewMoodTrend: l.caretaker_permissions.view_mood_trend,
          viewConversationSummaries: l.caretaker_permissions.view_conversation_summaries,
        },
      })),
      peopleICareFor: caringFor.map((l) => ({
        name: nameOf(l.user_id),
        relationshipLabel: l.relationship_label,
        status: l.status,
        acceptedAt: l.accepted_at,
      })),
      conversations: conversations.map((c) => ({
        startedAt: c.started_at,
        endedAt: c.ended_at,
        messages: c.turn_count,
        viaRobot: c.device_id !== null,
        deletedAt: c.deleted_at,
        summary: c.conversation_summaries ? dec(c.conversation_summaries.summary_enc) : null,
        mood: c.conversation_summaries?.mood_score ?? null,
        riskFlagged: c.conversation_summaries?.risk_flagged ?? false,
      })),
      companionMemories: memories.map((m) => ({ content: dec(m.content_enc), createdAt: m.created_at })),
      alerts: alerts.map((a) => ({
        type: a.type,
        severity: a.severity,
        createdAt: a.created_at,
        resolvedAt: a.resolved_at,
      })),
      pushDevices: tokens.map((t) => ({ platform: t.platform, registeredAt: t.created_at })),
      whoAccessedMyData: accessLog.map((a) => ({
        at: a.created_at,
        action: a.action,
        by: a.actor_user_id === userId ? 'me' : nameOf(a.actor_user_id),
      })),
    };
  }

  // =====================================================================
  // 2. Consents
  // =====================================================================
  async consents(userId: string) {
    const out: Record<string, { active: boolean; since: Date | null }> = {};
    for (const type of CONSENT_TYPES) {
      const latest = await this.prisma.consents.findFirst({
        where: { user_id: userId, consent_type: type },
        orderBy: { granted_at: 'desc' },
      });
      const required = type === 'terms' || type === 'health_data';
      out[type] = {
        // Required ones are active only once granted; optional ones default to on.
        active: required ? !!latest && !latest.revoked_at : !latest || !latest.revoked_at,
        since: latest ? (latest.revoked_at ?? latest.granted_at) : null,
      };
    }
    return out;
  }

  async grant(userId: string, type: ConsentType) {
    this.assertType(type);
    const active = await this.prisma.consents.findFirst({
      where: { user_id: userId, consent_type: type, revoked_at: null },
    });
    if (!active) {
      await this.prisma.consents.create({
        data: { user_id: userId, consent_type: type, policy_version: POLICY_VERSION },
      });
    }
    return this.consents(userId);
  }

  /** Withdrawing consent stops the processing it covers — not just a flag. */
  async revoke(userId: string, type: ConsentType) {
    this.assertType(type);
    if (type === 'terms' || type === 'health_data') {
      throw new BadRequestException(
        'Pebble cannot work without this consent. To withdraw it, delete your account (DELETE /privacy/account).',
      );
    }
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.consents.updateMany({
        where: { user_id: userId, consent_type: type, revoked_at: null },
        data: { revoked_at: now },
      });
      if (count === 0) {
        // Never explicitly granted (default on): record the opt-out.
        await tx.consents.create({
          data: {
            user_id: userId,
            consent_type: type,
            policy_version: POLICY_VERSION,
            granted_at: now,
            revoked_at: now,
          },
        });
      }

      if (type === 'conversation_memory') {
        // Forget everything Pebble remembered.
        await tx.companion_memories.deleteMany({ where: { user_id: userId } });
        await tx.conversation_summaries.deleteMany({
          where: { conversations: { user_id: userId } },
        });
      }
      if (type === 'caretaker_sharing') {
        // Stop sharing with every caretaker.
        await tx.caretaker_links.updateMany({
          where: { user_id: userId, status: { in: ['pending', 'accepted'] } },
          data: { status: 'revoked', revoked_at: now, invite_token_hash: null },
        });
      }
    });
    return this.consents(userId);
  }

  async isActive(userId: string, type: ConsentType) {
    return isConsentActive(this.prisma, userId, type);
  }

  // =====================================================================
  // 3. Delete account (right to erasure) — immediate and permanent
  // =====================================================================
  async deleteAccount(userId: string, password: string, ip?: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true, password_hash: true },
    });
    if (!user || !(await argon2.verify(user.password_hash, password))) {
      throw new UnauthorizedException('Password is incorrect');
    }

    await this.prisma.$transaction(async (tx) => {
      // Alerts I received as someone's caretaker: remove them, otherwise the
      // FK's SET NULL would make them look like that person's own deliveries.
      const myCaretakerLinks = await tx.caretaker_links.findMany({
        where: { caretaker_user_id: userId },
        select: { id: true },
      });
      await tx.alert_deliveries.deleteMany({
        where: { caretaker_link_id: { in: myCaretakerLinks.map((l) => l.id) } },
      });

      // Robots go back to "unpaired" so they can be given to someone else.
      await tx.devices.updateMany({
        where: { owner_user_id: userId },
        data: {
          owner_user_id: null,
          paired_at: null,
          status: 'unpaired',
          pairing_code_hash: null,
          pairing_expires_at: null,
        },
      });
      // Everything else is removed by ON DELETE CASCADE in the schema:
      // medications, doses, conversations, summaries, memories, consents,
      // tokens, caretaker links (both directions), alerts, settings...
      await tx.users.delete({ where: { id: userId } });

      // Keep a record that the erasure happened, without personal data.
      await tx.audit_logs.create({
        data: {
          actor_user_id: null,
          action: 'account_deleted',
          target_user_id: userId,
          target_type: 'user',
          target_id: userId,
          ip_address: ip ?? null,
        },
      });
    });
    this.logger.log(`Account ${userId} deleted at user request`);
  }

  // =====================================================================
  // 4. Purge items the user deleted more than 30 days ago
  // =====================================================================
  async purgeDeleted(): Promise<{ medications: number; conversations: number }> {
    const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const meds = await this.prisma.medications.deleteMany({
      where: { deleted_at: { lt: cutoff } },
    });
    const convos = await this.prisma.conversations.deleteMany({
      where: { deleted_at: { lt: cutoff } },
    });
    return { medications: meds.count, conversations: convos.count };
  }

  private assertType(type: string): asserts type is ConsentType {
    if (!(CONSENT_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`Unknown consent type. Use one of: ${CONSENT_TYPES.join(', ')}`);
    }
  }
}
