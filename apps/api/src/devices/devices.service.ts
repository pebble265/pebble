import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDevice } from './device-auth.guard';
import { HeartbeatDto, type RobotAction } from './dto/devices.dto';
import { RealtimeGateway } from '../notifications/realtime.gateway';

const PAIRING_CODE_MINUTES = 10;
const DEVICE_TOKEN_TTL = '1h';
const LOW_BATTERY_PERCENT = 15;
/** Robot counts as offline if it hasn't sent a heartbeat for this long. */
export const OFFLINE_AFTER_MINUTES = 10;

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const deviceSelect = {
  id: true,
  serial_number: true,
  status: true,
  battery_level: true,
  firmware_version: true,
  pill_slots_total: true,
  last_seen_at: true,
  paired_at: true,
} as const;

type DeviceRow = {
  id: string;
  serial_number: string;
  status: string;
  battery_level: number | null;
  firmware_version: string | null;
  pill_slots_total: number;
  last_seen_at: Date | null;
  paired_at: Date | null;
};

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * App -> robot remote control. Sent over the realtime socket as
   * "robot:command" { action, at } to the robot's room. Returns whether the
   * robot looked online (it may still miss it if it just dropped off).
   */
  async command(userId: string, deviceId: string, action: RobotAction) {
    const device = await this.prisma.devices.findFirst({
      where: { id: deviceId, owner_user_id: userId },
      select: { id: true, status: true },
    });
    if (!device) throw new NotFoundException('Robot not found');
    this.realtime.toDevice(device.id, 'robot:command', { action, at: new Date().toISOString() });
    return { sent: true, online: ['online', 'charging'].includes(device.status) };
  }

  // =====================================================================
  // Robot side
  // =====================================================================

  /** Robot logs in with serial + factory secret, gets a 1-hour device token. */
  async robotLogin(serialNumber: string, secret: string) {
    const device = await this.prisma.devices.findUnique({
      where: { serial_number: serialNumber },
      select: { id: true, device_secret_hash: true, owner_user_id: true },
    });

    // Always hash + compare, so a wrong serial takes the same time as a wrong secret.
    const given = Buffer.from(sha256(secret), 'hex');
    const expected = Buffer.from(
      device?.device_secret_hash ?? sha256('no-such-device'),
      'hex',
    );
    const match =
      given.length === expected.length && timingSafeEqual(given, expected);
    if (!device || !match) {
      throw new UnauthorizedException('Invalid device credentials');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: device.id, typ: 'device' },
      { expiresIn: DEVICE_TOKEN_TTL },
    );
    return {
      accessToken,
      expiresIn: 3600,
      paired: device.owner_user_id !== null,
    };
  }

  /** Robot asks for a 6-digit code to show on its screen. */
  async createPairingCode(device: AuthDevice) {
    if (device.ownerUserId) {
      throw new ConflictException('Robot is already paired');
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAIRING_CODE_MINUTES * 60_000);

    // Avoid handing out a code another unpaired robot is currently showing.
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const clash = await this.prisma.devices.findFirst({
        where: {
          pairing_code_hash: sha256(code),
          pairing_expires_at: { gt: now },
          id: { not: device.id },
        },
        select: { id: true },
      });
      if (clash) continue;

      await this.prisma.devices.update({
        where: { id: device.id },
        data: { pairing_code_hash: sha256(code), pairing_expires_at: expiresAt },
      });
      return { code, expiresAt };
    }
    throw new ConflictException('Could not create a pairing code, try again');
  }

  /** Robot reports battery / status. Raises or clears alerts. */
  async heartbeat(device: AuthDevice, dto: HeartbeatDto) {
    const now = new Date();
    const status = device.ownerUserId ? (dto.status ?? 'online') : 'unpaired';

    await this.prisma.devices.update({
      where: { id: device.id },
      data: {
        status,
        battery_level: dto.batteryLevel,
        last_seen_at: now,
        ...(dto.firmwareVersion && { firmware_version: dto.firmwareVersion }),
      },
    });

    if (!device.ownerUserId) return { ok: true, paired: false };
    const owner = device.ownerUserId;

    // Back online -> close any open "offline" alert.
    await this.resolveOpenAlerts(device.id, 'device_offline', now);

    const charging = status === 'charging';
    if (dto.batteryLevel <= LOW_BATTERY_PERCENT && !charging) {
      const open = await this.prisma.alerts.findFirst({
        where: { device_id: device.id, type: 'low_battery', resolved_at: null },
        select: { id: true },
      });
      if (!open) {
        await this.prisma.alerts.create({
          data: {
            user_id: owner,
            device_id: device.id,
            type: 'low_battery',
            severity: 'warning',
          },
        });
      }
    } else if (charging || dto.batteryLevel > LOW_BATTERY_PERCENT) {
      await this.resolveOpenAlerts(device.id, 'low_battery', now);
    }

    return { ok: true, paired: true };
  }

  /** What the robot needs to show its home screen. */
  async robotProfile(device: AuthDevice) {
    const row = await this.prisma.devices.findUniqueOrThrow({
      where: { id: device.id },
      select: deviceSelect,
    });
    if (!device.ownerUserId) {
      return { device: this.toResponse(row), paired: false, owner: null, settings: null };
    }

    const [user, s] = await Promise.all([
      this.prisma.users.findUniqueOrThrow({
        where: { id: device.ownerUserId },
        select: { display_name: true, timezone: true, locale: true },
      }),
      this.prisma.robot_settings.upsert({
        where: { user_id: device.ownerUserId },
        create: { user_id: device.ownerUserId },
        update: {},
      }),
    ]);

    return {
      device: this.toResponse(row),
      paired: true,
      owner: {
        displayName: user.display_name,
        timezone: user.timezone,
        locale: user.locale,
      },
      settings: {
        robotName: s.robot_name,
        voiceId: s.voice_id,
        speechRate: Number(s.speech_rate),
        greeting: s.greeting_text.replaceAll('{name}', user.display_name),
        wakeWord: s.wake_word,
        faceTheme: s.face_theme,
        quietHoursStart: s.quiet_hours_start?.toISOString().slice(11, 16) ?? null,
        quietHoursEnd: s.quiet_hours_end?.toISOString().slice(11, 16) ?? null,
      },
    };
  }

  /** Robot ejected the pill for this dose. */
  async markDispensed(device: AuthDevice, doseId: string) {
    const owner = this.requireOwner(device);
    const dose = await this.prisma.dose_events.findFirst({
      where: { id: doseId, user_id: owner },
      select: { id: true, dispensed_at: true },
    });
    if (!dose) throw new NotFoundException('Dose not found');

    const updated = await this.prisma.dose_events.update({
      where: { id: dose.id },
      data: { dispensed_at: dose.dispensed_at ?? new Date() },
      select: { id: true, status: true, dispensed_at: true },
    });
    return {
      id: updated.id,
      status: updated.status,
      dispensedAt: updated.dispensed_at,
    };
  }

  requireOwner(device: AuthDevice): string {
    if (!device.ownerUserId) {
      throw new ForbiddenException('Robot is not paired to a user yet');
    }
    return device.ownerUserId;
  }

  // =====================================================================
  // App (user) side
  // =====================================================================

  async listMine(userId: string) {
    const rows = await this.prisma.devices.findMany({
      where: { owner_user_id: userId },
      select: deviceSelect,
      orderBy: { paired_at: 'asc' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  /** User types the 6-digit code shown on the robot. */
  async pair(userId: string, code: string, serialNumber?: string) {
    const now = new Date();
    const device = await this.prisma.devices.findFirst({
      where: {
        pairing_code_hash: sha256(code),
        pairing_expires_at: { gt: now },
        owner_user_id: null,
        // Over Bluetooth the app also knows which robot it talked to.
        ...(serialNumber && { serial_number: serialNumber }),
      },
      select: { id: true, last_seen_at: true },
    });
    if (!device) {
      throw new NotFoundException('Invalid or expired pairing code');
    }

    const recentlySeen =
      device.last_seen_at &&
      now.getTime() - device.last_seen_at.getTime() <
        OFFLINE_AFTER_MINUTES * 60_000;

    // owner_user_id: null in the WHERE makes this safe if two people race.
    const { count } = await this.prisma.devices.updateMany({
      where: { id: device.id, owner_user_id: null },
      data: {
        owner_user_id: userId,
        paired_at: now,
        pairing_code_hash: null,
        pairing_expires_at: null,
        status: recentlySeen ? 'online' : 'offline',
      },
    });
    if (count === 0) throw new ConflictException('Robot was just paired by someone else');

    // First robot: the setup screens are done.
    await this.prisma.users.updateMany({
      where: { id: userId, robot_setup_at: null },
      data: { robot_setup_at: now },
    });

    const row = await this.prisma.devices.findUniqueOrThrow({
      where: { id: device.id },
      select: deviceSelect,
    });
    return this.toResponse(row);
  }

  async unpair(userId: string, deviceId: string) {
    const now = new Date();
    const { count } = await this.prisma.devices.updateMany({
      where: { id: deviceId, owner_user_id: userId },
      data: {
        owner_user_id: null,
        paired_at: null,
        status: 'unpaired',
      },
    });
    if (count === 0) throw new NotFoundException('Robot not found');

    await this.prisma.alerts.updateMany({
      where: { device_id: deviceId, user_id: userId, resolved_at: null },
      data: { resolved_at: now },
    });
  }

  // =====================================================================
  // Background job
  // =====================================================================

  /** Paired robots that stopped sending heartbeats -> offline + alert. */
  async markOffline(): Promise<number> {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MINUTES * 60_000);
    const stale = await this.prisma.devices.findMany({
      where: {
        owner_user_id: { not: null },
        status: { in: ['online', 'charging', 'error'] },
        OR: [{ last_seen_at: null }, { last_seen_at: { lt: cutoff } }],
      },
      select: { id: true, owner_user_id: true },
    });

    for (const d of stale) {
      await this.prisma.$transaction([
        this.prisma.devices.update({
          where: { id: d.id },
          data: { status: 'offline' },
        }),
        this.prisma.alerts.create({
          data: {
            user_id: d.owner_user_id!,
            device_id: d.id,
            type: 'device_offline',
            severity: 'warning',
          },
        }),
      ]);
    }
    return stale.length;
  }

  // =====================================================================
  // Helpers
  // =====================================================================
  private async resolveOpenAlerts(
    deviceId: string,
    type: 'low_battery' | 'device_offline',
    at: Date,
  ) {
    await this.prisma.alerts.updateMany({
      where: { device_id: deviceId, type, resolved_at: null },
      data: { resolved_at: at },
    });
  }

  private toResponse(d: DeviceRow) {
    return {
      id: d.id,
      serialNumber: d.serial_number,
      status: d.status,
      batteryLevel: d.battery_level,
      firmwareVersion: d.firmware_version,
      pillSlots: d.pill_slots_total,
      lastSeenAt: d.last_seen_at,
      pairedAt: d.paired_at,
    };
  }
}
