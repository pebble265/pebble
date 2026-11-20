import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { getItem, setItem } from './storage';

WebBrowser.maybeCompleteAuthSession();

/**
 * Spotify for the music card on the "pebble" tab.
 *
 * Uses the Spotify Web API with Authorization Code + PKCE (no client secret in the app).
 * Needs EXPO_PUBLIC_SPOTIFY_CLIENT_ID in apps/mobile/.env and the redirect URI
 * "pebble://spotify" added to the app on developer.spotify.com (see README).
 *
 * Reading what is playing works with any Spotify account. Play / pause from the app
 * needs Spotify Premium (Spotify's rule); without it the card opens Spotify instead.
 */
export const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
export const spotifyConfigured = !!SPOTIFY_CLIENT_ID;

const KEY = 'pebble.spotify';
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state', 'user-read-recently-played'];
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'pebble', path: 'spotify' });

type Tokens = { accessToken: string; refreshToken?: string; expiresAt: number };

export type Track = {
  id: string;
  title: string;
  artist: string;
  art: string | null;
  durationMs: number;
  progressMs: number | null;
  isPlaying: boolean;
  /** true when nothing is playing and this is the last track played */
  recent: boolean;
  url: string;
};

async function load(): Promise<Tokens | null> {
  try {
    const raw = await getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

async function save(t: Tokens | null) {
  await setItem(KEY, t ? JSON.stringify(t) : null);
}

export async function isSpotifyConnected() {
  return !!(await load());
}

/** Opens Spotify's login page. Returns false if the user closed it. */
export async function connectSpotify(): Promise<boolean> {
  if (!spotifyConfigured) throw new Error('ยังไม่ได้ใส่ Spotify Client ID ในแอป (EXPO_PUBLIC_SPOTIFY_CLIENT_ID)');
  const request = new AuthSession.AuthRequest({
    clientId: SPOTIFY_CLIENT_ID,
    scopes: SCOPES,
    redirectUri,
    usePKCE: true,
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') return false;
  const token = await AuthSession.exchangeCodeAsync(
    { clientId: SPOTIFY_CLIENT_ID, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    discovery,
  );
  await save({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + (token.expiresIn ?? 3600) * 1000,
  });
  return true;
}

export async function disconnectSpotify() {
  await save(null);
}

async function accessToken(): Promise<string | null> {
  const t = await load();
  if (!t) return null;
  if (Date.now() < t.expiresAt - 60_000) return t.accessToken;
  if (!t.refreshToken) {
    await save(null);
    return null;
  }
  try {
    const r = await AuthSession.refreshAsync({ clientId: SPOTIFY_CLIENT_ID, refreshToken: t.refreshToken }, discovery);
    await save({
      accessToken: r.accessToken,
      refreshToken: r.refreshToken ?? t.refreshToken, // Spotify may rotate it
      expiresAt: Date.now() + (r.expiresIn ?? 3600) * 1000,
    });
    return r.accessToken;
  } catch {
    await save(null); // revoked: connect again
    return null;
  }
}

async function call(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  if (!token) throw new SpotifyNotConnected();
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

export class SpotifyNotConnected extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTrack(item: any, extra: { progressMs: number | null; isPlaying: boolean; recent: boolean }): Track | null {
  if (!item || item.type !== 'track') return null;
  return {
    id: item.id,
    title: item.name,
    artist: (item.artists ?? []).map((a: { name: string }) => a.name).join(', '),
    art: item.album?.images?.slice(-1)[0]?.url ?? item.album?.images?.[0]?.url ?? null,
    durationMs: item.duration_ms ?? 0,
    url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
    ...extra,
  };
}

/** What is playing now on the user's Spotify (any device), or the last track played. */
export async function nowPlaying(): Promise<Track | null> {
  const r = await call('/me/player/currently-playing');
  if (r.status === 200) {
    const j = await r.json();
    const t = toTrack(j.item, { progressMs: j.progress_ms ?? null, isPlaying: !!j.is_playing, recent: false });
    if (t) return t;
  } else if (r.status === 401) {
    await save(null);
    throw new SpotifyNotConnected();
  }
  const rr = await call('/me/player/recently-played?limit=1');
  if (rr.status !== 200) return null;
  const j = await rr.json();
  return toTrack(j.items?.[0]?.track, { progressMs: null, isPlaying: false, recent: true });
}

/**
 * Play / pause. Returns "ok", or "premium" when Spotify refuses (free account) /
 * "no-device" when no Spotify app is open anywhere — then open Spotify instead.
 */
export async function togglePlay(track: Track | null): Promise<'ok' | 'premium' | 'no-device'> {
  const r = track?.isPlaying
    ? await call('/me/player/pause', { method: 'PUT' })
    : await call('/me/player/play', {
        method: 'PUT',
        ...(track?.recent && { body: JSON.stringify({ uris: [`spotify:track:${track.id}`] }) }),
      });
  if (r.ok) return 'ok';
  if (r.status === 403) return 'premium';
  if (r.status === 404) return 'no-device';
  return 'ok';
}

export function openInSpotify(track: Track | null) {
  const url = track ? `spotify:track:${track.id}` : 'spotify:';
  Linking.openURL(url).catch(() => Linking.openURL(track?.url ?? 'https://open.spotify.com'));
}

export function mmss(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
