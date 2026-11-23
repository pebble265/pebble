import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIONS, SKIP } from './audit.actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGIN_ROUTES = new Set(['POST /auth/login', 'POST /auth/register', 'POST /auth/google', 'POST /auth/apple']);

/**
 * Writes one audit_logs row for every change a user (or robot) makes:
 * POST / PUT / PATCH / DELETE, successful or not. Reads (GET) are not logged.
 *
 * What is stored: who, which action, which record (id), which fields were changed
 * (names only, never values), result, IP and app. No passwords, no medicine names,
 * no chat text: the admin log must not become a copy of people's health data.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string }; device?: { id: string; ownerUserId?: string | null } }>();
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const route = `${method} ${(req.baseUrl || '') + (req.route?.path ?? req.path)}`;
    if (SKIP.has(route)) return next.handle();
    // hardware test screen repeats commands several times a second: not worth a row each
    if (route === 'POST /devices/:id/command' && (req.body as { action?: string } | undefined)?.action === 'test') return next.handle();

    const started = Date.now();
    const write = (ok: boolean, status: number, body?: unknown, err?: unknown) => {
      this.write(req, route, ok, status, body, err, Date.now() - started).catch((e) =>
        this.logger.warn(`audit write failed: ${(e as Error).message}`),
      );
    };
    return next.handle().pipe(
      tap({
        next: (body) => write(true, ctx.switchToHttp().getResponse().statusCode ?? 200, body),
        error: (e) => write(false, (e as { status?: number })?.status ?? 500, undefined, e),
      }),
    );
  }

  private async write(
    req: Request & { user?: { id: string }; device?: { id: string; ownerUserId?: string | null } },
    route: string,
    ok: boolean,
    status: number,
    body: unknown,
    err: unknown,
    ms: number,
  ) {
    const known = ACTIONS[route];
    const action = known?.action ?? route.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);

    let actorUser = req.user?.id ?? null;
    const actorDevice = req.device?.id ?? null;
    let detail: string[] = [];

    if (LOGIN_ROUTES.has(route)) {
      // not signed in yet: take the user from the token we just issued, or the email typed in
      const token = (body as { accessToken?: string } | undefined)?.accessToken;
      if (token) actorUser = subOf(token);
      const email = (req.body as { email?: string } | undefined)?.email;
      if (email) {
        detail.push(`email: ${String(email).slice(0, 120)}`);
        // failed sign-in: still file it under the account it was aimed at
        if (!actorUser) {
          const u = await this.prisma.users.findFirst({ where: { email: String(email).trim() }, select: { id: true } }).catch(() => null);
          if (u) actorUser = u.id;
        }
      }
    } else if (method(route) === 'PATCH' || method(route) === 'PUT') {
      const keys = Object.keys((req.body as object) ?? {}).filter((k) => !/password|token|secret/i.test(k));
      if (keys.length) detail.push(`แก้: ${keys.join(', ')}`.slice(0, 200));
    }
    if (!ok) {
      const resp = (err as { getResponse?: () => unknown })?.getResponse?.() as { message?: unknown } | string | undefined;
      const raw = typeof resp === 'object' && resp?.message != null ? resp.message : (err as { message?: string })?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw;
      detail.push(`ไม่สำเร็จ (${status})${msg ? `: ${String(msg).slice(0, 120)}` : ''}`);
    }

    const created = (body as { id?: unknown } | undefined)?.id;
    const id = (Object.values(req.params ?? {}).map(String).find((v) => UUID.test(v)) ??
      (typeof created === 'string' && UUID.test(created) ? created : null)) as string | null;
    const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    const ip = cleanIp(xff || req.ip || req.socket?.remoteAddress || '');

    await this.prisma.audit_logs.create({
      data: {
        actor_user_id: actorUser && UUID.test(actorUser) ? actorUser : null,
        actor_device_id: actorDevice,
        action,
        target_user_id: actorUser ?? req.device?.ownerUserId ?? null,
        target_type: known?.target ?? null,
        target_id: id,
        ip_address: ip,
        detail: detail.join(' · ') || null,
        success: ok,
        status_code: status,
        route: route.slice(0, 120),
        client: actorDevice ? 'robot' : clientOf(String(req.headers['user-agent'] ?? '')),
        duration_ms: ms,
      },
    });
  }
}

const method = (route: string) => route.split(' ')[0];

function subOf(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function cleanIp(ip: string): string | null {
  const v = ip.replace(/^::ffff:/, '');
  return /^[0-9.]+$/.test(v) || /^[0-9a-f:]+$/i.test(v) ? v : null;
}

function clientOf(ua: string): string {
  if (/pebble-pi/i.test(ua)) return 'robot';
  if (/expo|okhttp|CFNetwork|Darwin|Pebble/i.test(ua)) return 'app';
  if (/Mozilla/i.test(ua)) return 'web';
  return 'other';
}
