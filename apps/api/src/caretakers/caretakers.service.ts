import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { addDays, localDateOf, zonedToUtc } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto, PermissionsDto } from './dto/caretakers.dto';
import {
  ALERT_PERMISSION,
  permissionsToData,
  permissionsToResponse,
} from './permissions';

const INVITE_DAYS = 7;
const MAX_CARETAKERS = 10;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class CaretakersService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================================
  // The person being cared for (manages their own caretakers)
  // =====================================================================

  async createInvite(userId: string, dto: CreateInviteDto) {
    const me = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const email = dto.email?.trim().toLowerCase();
    if (email && email === me.email.toLowerCase()) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const active = await this.prisma.caretaker_links.count({
      where: { user_id: userId, status: { in: ['pending', 'accepted'] } },
    });
    if (active >= MAX_CARETAKERS) {
      throw new ConflictException(`You can have at most ${MAX_CARETAKERS} caretakers`);
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

    const link = await this.prisma.$transaction(async (tx) => {
      const created = await tx.caretaker_links.create({
        data: {
          user_id: userId,
          invite_email: email ?? null,
          invite_token_hash: sha256(token),
          invite_expires_at: expiresAt,
          relationship_label: dto.relationshipLabel?.trim() ?? null,
        },
      });
      await tx.caretaker_permissions.create({
        data: { link_id: created.id, ...permissionsToData(dto.permissions) },
      });
      return created;
    });

    // The token is returned ONCE. The app turns it into a share link / QR.
    return { id: link.id, token, expiresAt };
  }

  async listMyCaretakers(userId: string) {
    const links = await this.prisma.caretaker_links.findMany({
      where: { user_id: userId, status: { in: ['pending', 'accepted'] } },
      include: { caretaker_permissions: true },
      orderBy: { created_at: 'asc' },
    });
    const people = await this.usersById(
      links.map((l) => l.caretaker_user_id).filter((id): id is string => !!id),
    );
    const now = new Date();
    return links.map((l) => ({
      id: l.id,
      status:
        l.status === 'pending' && l.invite_expires_at && l.invite_expires_at <= now
          ? 'expired'
          : l.status,
      relationshipLabel: l.relationship_label,
      inviteEmail: l.invite_email,
      caretaker: l.caretaker_user_id
        ? {
            displayName: people.get(l.caretaker_user_id)?.display_name ?? null,
            email: people.get(l.caretaker_user_id)?.email ?? null,
          }
        : null,
      permissions: permissionsToResponse(l.caretaker_permissions),
      createdAt: l.created_at,
      acceptedAt: l.accepted_at,
    }));
  }

  async updatePermissions(userId: string, linkId: string, dto: PermissionsDto) {
    const link = await this.prisma.caretaker_links.findFirst({
      where: { id: linkId, user_id: userId, status: { in: ['pending', 'accepted'] } },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Caretaker not found');

    const p = await this.prisma.caretaker_permissions.upsert({
      where: { link_id: link.id },
      create: { link_id: link.id, ...permissionsToData(dto) },
      update: permissionsToData(dto),
    });
    return permissionsToResponse(p);
  }

  /** Remove a caretaker (or cancel an invite). */
  async revoke(userId: string, linkId: string) {
    const { count } = await this.prisma.caretaker_links.updateMany({
      where: { id: linkId, user_id: userId, status: { in: ['pending', 'accepted'] } },
      data: { status: 'revoked', revoked_at: new Date(), invite_token_hash: null },
    });
    if (count === 0) throw new NotFoundException('Caretaker not found');
  }

  // =====================================================================
  // The caretaker
  // =====================================================================

  /** Show who is inviting before accepting. */
  async previewInvite(caretakerId: string, token: string) {
    const link = await this.findOpenInvite(token);
    await this.checkCanAccept(caretakerId, link);
    return {
      invitedBy: link.inviterName,
      relationshipLabel: link.relationship_label,
      permissions: permissionsToResponse(link.caretaker_permissions),
      expiresAt: link.invite_expires_at,
    };
  }

  async acceptInvite(caretakerId: string, token: string) {
    const link = await this.findOpenInvite(token);
    await this.checkCanAccept(caretakerId, link);

    const { count } = await this.prisma.caretaker_links.updateMany({
      where: { id: link.id, status: 'pending' },
      data: {
        status: 'accepted',
        caretaker_user_id: caretakerId,
        accepted_at: new Date(),
        invite_token_hash: null,
      },
    });
    if (count === 0) throw new ConflictException('Invite was already used');

    return {
      linkId: link.id,
      caringFor: link.inviterName,
      permissions: permissionsToResponse(link.caretaker_permissions),
    };
  }

  async declineInvite(caretakerId: string, token: string) {
    const link = await this.findOpenInvite(token);
    await this.checkCanAccept(caretakerId, link);
    await this.prisma.caretaker_links.update({
      where: { id: link.id },
      data: { status: 'declined', invite_token_hash: null },
    });
  }

  /** People I take care of. */
  async listCaringFor(caretakerId: string) {
    const links = await this.prisma.caretaker_links.findMany({
      where: { caretaker_user_id: caretakerId, status: 'accepted' },
      include: { caretaker_permissions: true },
      orderBy: { accepted_at: 'asc' },
    });
    const people = await this.usersById(links.map((l) => l.user_id));
    const active = links.filter((l) => people.has(l.user_id));

    const unacked = await this.prisma.alert_deliveries.groupBy({
      by: ['caretaker_link_id'],
      where: {
        caretaker_link_id: { in: active.map((l) => l.id) },
        acknowledged_at: null,
      },
      _count: { _all: true },
    });
    const unackedBy = new Map(
      unacked.map((u) => [u.caretaker_link_id, u._count._all]),
    );

    return active.map((l) => ({
      linkId: l.id,
      displayName: people.get(l.user_id)!.display_name,
      relationshipLabel: l.relationship_label,
      permissions: permissionsToResponse(l.caretaker_permissions),
      unacknowledgedAlerts: unackedBy.get(l.id) ?? 0,
      since: l.accepted_at,
    }));
  }

  /** What a caretaker sees for one person — only what they are allowed to. */
  async overview(caretakerId: string, linkId: string, ip?: string) {
    const link = await this.findAcceptedLink(caretakerId, linkId);
    const perms = permissionsToResponse(link.caretaker_permissions);
    const personId = link.user_id;

    const result: Record<string, unknown> = {
      linkId: link.id,
      displayName: link.person.display_name,
      relationshipLabel: link.relationship_label,
      permissions: perms,
    };

    if (perms.viewAdherence) {
      result.adherence = await this.adherenceLast7Days(personId, link.person.timezone);
    }

    if (perms.alertOnDeviceIssue) {
      const devices = await this.prisma.devices.findMany({
        where: { owner_user_id: personId },
        select: { status: true, battery_level: true, last_seen_at: true },
      });
      result.robots = devices.map((d) => ({
        status: d.status,
        batteryLevel: d.battery_level,
        lastSeenAt: d.last_seen_at,
      }));
    }

    if (perms.viewMoodTrend) {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const moods = await this.prisma.conversation_summaries.findMany({
        where: {
          created_at: { gte: since },
          mood_score: { not: null },
          conversations: { user_id: personId, deleted_at: null },
        },
        select: { mood_score: true, created_at: true },
        orderBy: { created_at: 'asc' },
      });
      result.moodTrend = moods.map((m) => ({ at: m.created_at, score: m.mood_score }));
    }

    // PDPA: record that someone else looked at this person's data.
    await this.prisma.audit_logs.create({
      data: {
        actor_user_id: caretakerId,
        action: 'caretaker_view_overview',
        target_user_id: personId,
        target_type: 'caretaker_link',
        target_id: link.id,
        ip_address: ip ?? null,
      },
    });

    return result;
  }

  /** Caretaker removes themselves. */
  async leave(caretakerId: string, linkId: string) {
    const { count } = await this.prisma.caretaker_links.updateMany({
      where: { id: linkId, caretaker_user_id: caretakerId, status: 'accepted' },
      data: { status: 'revoked', revoked_at: new Date() },
    });
    if (count === 0) throw new NotFoundException('Not found');
  }

  // =====================================================================
  // Used by AlertsService
  // =====================================================================

  /** Accepted caretakers of `userId` who are allowed to get this alert type. */
  async recipientsFor(userId: string, alertType: string) {
    const flag = ALERT_PERMISSION[alertType];
    if (!flag) return [];
    const links = await this.prisma.caretaker_links.findMany({
      where: { user_id: userId, status: 'accepted', caretaker_user_id: { not: null } },
      include: { caretaker_permissions: true },
    });
    return links
      .filter((l) => {
        const p = l.caretaker_permissions;
        return p ? p[flag] : flag === 'alert_on_crisis';
      })
      .map((l) => ({ linkId: l.id, caretakerUserId: l.caretaker_user_id! }));
  }

  // =====================================================================
  // Helpers
  // =====================================================================

  private async findOpenInvite(token: string) {
    const link = await this.prisma.caretaker_links.findUnique({
      where: { invite_token_hash: sha256(token) },
      include: { caretaker_permissions: true },
    });
    const inviter = link
      ? (await this.usersById([link.user_id])).get(link.user_id)
      : undefined;
    if (
      !link ||
      !inviter ||
      link.status !== 'pending' ||
      !link.invite_expires_at ||
      link.invite_expires_at <= new Date()
    ) {
      throw new NotFoundException('Invite is invalid or has expired');
    }
    return { ...link, inviterName: inviter.display_name };
  }

  private async checkCanAccept(
    caretakerId: string,
    link: { id: string; user_id: string; invite_email: string | null },
  ) {
    if (link.user_id === caretakerId) {
      throw new BadRequestException('You cannot accept your own invite');
    }
    if (link.invite_email) {
      const me = await this.prisma.users.findUniqueOrThrow({
        where: { id: caretakerId },
        select: { email: true },
      });
      if (me.email.toLowerCase() !== link.invite_email.toLowerCase()) {
        throw new ForbiddenException('This invite was sent to a different email');
      }
    }
    const already = await this.prisma.caretaker_links.findFirst({
      where: {
        user_id: link.user_id,
        caretaker_user_id: caretakerId,
        status: 'accepted',
      },
      select: { id: true },
    });
    if (already) throw new ConflictException('You are already a caretaker for this person');
  }

  private async findAcceptedLink(caretakerId: string, linkId: string) {
    const link = await this.prisma.caretaker_links.findFirst({
      where: { id: linkId, caretaker_user_id: caretakerId, status: 'accepted' },
      include: { caretaker_permissions: true },
    });
    const person = link
      ? (await this.usersById([link.user_id])).get(link.user_id)
      : undefined;
    if (!link || !person) throw new NotFoundException('Not found');
    return { ...link, person };
  }

  /**
   * caretaker_links has two foreign keys to users, which gives Prisma's
   * introspected relation fields long generated names. Looking users up by id
   * keeps this code independent of those names. Deleted accounts are skipped.
   */
  private async usersById(ids: string[]) {
    const rows = await this.prisma.users.findMany({
      where: { id: { in: [...new Set(ids)] }, deleted_at: null },
      select: { id: true, display_name: true, email: true, timezone: true },
    });
    return new Map(rows.map((u) => [u.id, u]));
  }

  /** Counts only — never medication names. */
  private async adherenceLast7Days(personId: string, tz: string) {
    const today = localDateOf(new Date(), tz);
    const from = zonedToUtc(addDays(today, -6), '00:00', tz);
    const rows = await this.prisma.dose_events.groupBy({
      by: ['status'],
      where: {
        user_id: personId,
        scheduled_at: { gte: from, lte: new Date() },
      },
      _count: { _all: true },
    });
    const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
    const taken = n('taken');
    const missed = n('missed');
    const skipped = n('skipped');
    const decided = taken + missed + skipped;
    return {
      days: 7,
      taken,
      missed,
      skipped,
      rate: decided ? Math.round((taken / decided) * 100) / 100 : null,
    };
  }
}
