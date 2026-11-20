import { createPublicKey, createVerify, type JsonWebKeyInput } from 'crypto';

type Jwk = { kid?: string; kty?: string; n?: string; e?: string };

/**
 * Verifies the ID tokens that "Sign in with Apple" and "Sign in with Google"
 * hand to the app. Both are RS256 JWTs signed with keys the provider publishes
 * as a JWKS; we check the signature, issuer, audience and expiry ourselves,
 * so no extra npm package is needed.
 */
export type Provider = 'apple' | 'google';

export interface SocialClaims {
  provider: Provider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export class InvalidSocialTokenError extends Error {}

const PROVIDERS: Record<Provider, { jwks: string; issuers: string[] }> = {
  apple: {
    jwks: process.env.APPLE_JWKS_URL ?? 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
  },
  google: {
    jwks: process.env.GOOGLE_JWKS_URL ?? 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  },
};

const KEYS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;
const keyCache = new Map<Provider, { at: number; keys: Jwk[] }>();

async function keysFor(provider: Provider, refresh = false) {
  const hit = keyCache.get(provider);
  if (hit && !refresh && Date.now() - hit.at < KEYS_TTL_MS) return hit.keys;
  const res = await fetch(PROVIDERS[provider].jwks);
  if (!res.ok) throw new Error(`Could not fetch ${provider} signing keys (${res.status})`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  keyCache.set(provider, { at: Date.now(), keys });
  return keys;
}

function decodePart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

export async function verifyIdToken(
  provider: Provider,
  token: string,
  audiences: string[],
): Promise<SocialClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new InvalidSocialTokenError('Malformed token');
  const [h, p, sig] = parts;

  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = decodePart(h);
    claims = decodePart(p);
  } catch {
    throw new InvalidSocialTokenError('Malformed token');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new InvalidSocialTokenError('Unsupported token');

  // Providers rotate keys: if the kid is unknown, refetch once.
  let jwk = (await keysFor(provider)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await keysFor(provider, true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new InvalidSocialTokenError('Unknown signing key');

  const ok = createVerify('RSA-SHA256')
    .update(`${h}.${p}`)
    .verify(createPublicKey({ key: jwk, format: 'jwk' } as JsonWebKeyInput), Buffer.from(sig, 'base64url'));
  if (!ok) throw new InvalidSocialTokenError('Bad signature');

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!PROVIDERS[provider].issuers.includes(String(claims.iss))) throw new InvalidSocialTokenError('Wrong issuer');
  if (!aud.some((a) => audiences.includes(String(a)))) throw new InvalidSocialTokenError('Wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) throw new InvalidSocialTokenError('Token expired');
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now) throw new InvalidSocialTokenError('Token from the future');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new InvalidSocialTokenError('No subject');

  // Apple sends email_verified as the string "true"; Google as a boolean.
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  return {
    provider,
    subject: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
    emailVerified: verified,
    name: typeof claims.name === 'string' ? claims.name : null,
  };
}

/** Comma-separated env var -> list ("a, b" -> ["a","b"]). */
export function envList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
