import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import type { ConsentType } from './consent';

const CONSENTS_KEY = 'pebble:required-consents';

/** Features that process the user's own health data need both. */
export const HEALTH_CONSENTS: ConsentType[] = ['terms', 'health_data'];

/**
 * Override which consents a controller or route needs, e.g.
 *   @RequireConsents('terms')   // caretakers only need the terms
 */
export const RequireConsents = (...types: ConsentType[]) =>
  SetMetadata(CONSENTS_KEY, types);

async function missingConsents(
  prisma: PrismaService,
  userId: string,
  required: ConsentType[],
): Promise<ConsentType[]> {
  const rows = await prisma.consents.findMany({
    where: { user_id: userId, consent_type: { in: required } },
    orderBy: { granted_at: 'desc' },
    select: { consent_type: true, revoked_at: true },
  });
  // The newest row of each type decides. Required consents are OFF until granted.
  return required.filter((type) => {
    const latest = rows.find((r) => r.consent_type === type);
    return !latest || latest.revoked_at !== null;
  });
}

function requiredFor(reflector: Reflector, context: ExecutionContext) {
  return (
    reflector.getAllAndOverride<ConsentType[]>(CONSENTS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? HEALTH_CONSENTS
  );
}

function reject(missing: ConsentType[]): never {
  throw new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    code: 'CONSENT_REQUIRED',
    message: 'Please complete onboarding first',
    missingConsents: missing,
  });
}

/**
 * For app routes. Put it AFTER JwtAuthGuard:
 *   @UseGuards(JwtAuthGuard, ConsentGuard)
 */
@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId: string | undefined = context.switchToHttp().getRequest().user?.id;
    if (!userId) return true; // JwtAuthGuard handles unauthenticated requests
    const missing = await missingConsents(this.prisma, userId, requiredFor(this.reflector, context));
    if (missing.length) reject(missing);
    return true;
  }
}

/**
 * For robot routes: the robot acts for its owner, so the OWNER must have consented.
 * Put it AFTER DeviceAuthGuard. Unpaired robots pass here; the route itself
 * already refuses to do anything for an unpaired robot.
 */
@Injectable()
export class OwnerConsentGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ownerId: string | null | undefined =
      context.switchToHttp().getRequest().device?.ownerUserId;
    if (!ownerId) return true;
    const missing = await missingConsents(this.prisma, ownerId, requiredFor(this.reflector, context));
    if (missing.length) reject(missing);
    return true;
  }
}
