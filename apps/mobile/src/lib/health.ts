// Web / unsupported platforms: no health data. Real readers: health.ios.ts, health.android.ts.
import { type HealthToday, startOfToday } from './health.shared';

export type { HealthToday };
export { startOfToday };

/** Name of the health app on this platform, for messages. */
export const HEALTH_APP: string | null = null;

/**
 * Reads today's steps and the latest heart rate. With `ask`, shows the
 * system permission sheet first if the user hasn't answered it yet.
 */
export async function readHealthToday(_ask: boolean): Promise<HealthToday> {
  return { steps: null, bpm: null, available: false };
}
