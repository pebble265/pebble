import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Who may read the audit log: the admin site already signs in to ThingsBoard, so we check
 * that ThingsBoard token with ThingsBoard itself and then require the account's email to be
 * listed in ADMIN_EMAILS. Nothing new to remember, and a stolen app token can't read the log.
 *
 *   .env  ADMIN_EMAILS=me@example.com,friend@example.com
 */
@Injectable()
export class TbAdminGuard implements CanActivate {
  private readonly logger = new Logger('TbAdminGuard');
  private readonly cache = new Map<string, { email: string; until: number }>();

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: string }>();
    const auth = req.header('x-authorization') ?? '';
    if (!auth.startsWith('Bearer ')) throw new UnauthorizedException('เข้าสู่ระบบ ThingsBoard ก่อน');

    const allowed = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.length) {
      throw new ForbiddenException('ยังไม่ได้ตั้งผู้ดูแลระบบ: ใส่ ADMIN_EMAILS=อีเมล ThingsBoard ของคุณ ใน apps/api/.env แล้วรีสตาร์ต backend');
    }

    const hit = this.cache.get(auth);
    let email = hit && hit.until > Date.now() ? hit.email : null;
    if (!email) {
      const base = process.env.TB_URL || 'https://demo.thingsboard.io';
      let res: Response;
      try {
        res = await fetch(`${base}/api/auth/user`, {
          headers: { 'X-Authorization': auth, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
      } catch (e) {
        this.logger.warn(`ThingsBoard check failed: ${(e as Error).message}`);
        throw new UnauthorizedException('ตรวจบัญชี ThingsBoard ไม่ได้ ลองใหม่อีกครั้ง');
      }
      if (!res.ok) throw new UnauthorizedException('บัญชี ThingsBoard หมดเวลา เข้าใหม่อีกครั้ง');
      const user = (await res.json()) as { email?: string };
      email = String(user.email ?? '').toLowerCase();
      this.cache.set(auth, { email, until: Date.now() + 5 * 60_000 });
    }
    if (!allowed.includes(email)) throw new ForbiddenException(`${email} ไม่มีสิทธิ์ดู log (ไม่ได้อยู่ใน ADMIN_EMAILS)`);
    req.admin = email;
    return true;
  }
}

/** GET /admin/audit — newest first. Filters: action, q (email / name), from, to, before (cursor), limit. */
@Controller('admin')
@UseGuards(TbAdminGuard)
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit')
  async audit(
    @Query('limit') limitQ?: string,
    @Query('before') before?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('failed') failed?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitQ) || 100, 1), 500);
    const where: Record<string, unknown> = {};
    if (before && /^\d+$/.test(before)) where.id = { lt: BigInt(before) };
    if (action) where.action = action.includes('*') ? { startsWith: action.replace('*', '') } : action;
    if (failed === '1') where.success = false;
    const at: Record<string, Date> = {};
    if (from && !isNaN(Date.parse(from))) at.gte = new Date(from);
    if (to && !isNaN(Date.parse(to))) at.lte = new Date(to);
    if (Object.keys(at).length) where.created_at = at;
    if (q?.trim()) {
      const s = q.trim();
      where.OR = [
        { users: { email: { contains: s, mode: 'insensitive' } } },
        { users: { display_name: { contains: s, mode: 'insensitive' } } },
        { detail: { contains: s, mode: 'insensitive' } },
        { ip_address: s },
      ].filter((c) => !('ip_address' in c) || /^[0-9a-f.:]+$/i.test(s));
    }

    const rows = await this.prisma.audit_logs.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit,
      include: {
        users: { select: { id: true, email: true, display_name: true } },
        devices: { select: { id: true, serial_number: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        at: r.created_at,
        action: r.action,
        ok: r.success,
        status: r.status_code,
        detail: r.detail,
        targetType: r.target_type,
        targetId: r.target_id,
        ip: r.ip_address,
        client: r.client,
        route: r.route,
        ms: r.duration_ms,
        user: r.users ? { id: r.users.id, email: r.users.email, name: r.users.display_name } : null,
        robot: r.devices ? r.devices.serial_number : null,
      })),
      next: rows.length === limit ? rows[rows.length - 1].id.toString() : null,
    };
  }
}
