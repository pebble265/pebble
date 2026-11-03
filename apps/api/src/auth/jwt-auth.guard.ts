import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: string;
}

/**
 * Protects a route with a USER access token.
 * Client sends:  Authorization: Bearer <accessToken>
 * Robot (device) tokens are rejected here; robots use DeviceAuthGuard.
 * Tokens of deleted accounts stop working immediately (not after 15 min).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const [type, token] = String(req.headers?.authorization ?? '').split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ === 'device') throw new UnauthorizedException();

    const user = await this.prisma.users.findFirst({
      where: { id: payload.sub, deleted_at: null },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException();

    req.user = { id: payload.sub } satisfies AuthUser;
    return true;
  }
}
