import { PrismaService } from '../prisma/prisma.service';

export const CONSENT_TYPES = [
  'terms',
  'health_data',
  'conversation_memory',
  'caretaker_sharing',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/**
 * Optional features are ON until the user turns them off.
 * The latest consent row of a type decides: revoked -> off.
 */
export async function isConsentActive(
  prisma: PrismaService,
  userId: string,
  type: ConsentType,
): Promise<boolean> {
  const latest = await prisma.consents.findFirst({
    where: { user_id: userId, consent_type: type },
    orderBy: { granted_at: 'desc' },
    select: { revoked_at: true },
  });
  return !latest || latest.revoked_at === null;
}
