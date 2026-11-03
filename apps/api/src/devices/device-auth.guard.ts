import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthDevice {
  id: string;
  /** null while the robot is not paired to anyone */
  ownerUserId: string | null;
}

/**
 * Protects robot-only routes. The robot gets its token from POST /robot/auth.
 * User tokens are rejected here.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const [type, token] = String(req.headers?.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'device') throw new UnauthorizedException();

    // Read the owner fresh every request, so unpairing takes effect immediately.
    const device = await this.prisma.devices.findUnique({
      where: { id: payload.sub },
      select: { id: true, owner_user_id: true },
    });
    if (!device) throw new UnauthorizedException();

    req.device = {
      id: device.id,
      ownerUserId: device.owner_user_id,
    } satisfies AuthDevice;
    return true;
  }
}

/** Use in a route protected by DeviceAuthGuard:  me(@CurrentDevice() d: AuthDevice) */
export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthDevice =>
    ctx.switchToHttp().getRequest().device,
);
