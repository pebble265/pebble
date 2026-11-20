import {
  getMostRecentQuantitySample,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { type HealthToday, startOfToday } from './health.shared';

export type { HealthToday };
export { startOfToday };
export const HEALTH_APP = 'Apple Health';

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const HEART = 'HKQuantityTypeIdentifierHeartRate' as const;

export async function readHealthToday(ask: boolean): Promise<HealthToday> {
  if (!isHealthDataAvailable()) return { steps: null, bpm: null, available: false };

  // iOS only shows the sheet the first time; after that this returns at once.
  // (HealthKit never says whether reading was allowed: denied just reads as no data.)
  if (ask) await requestAuthorization({ toRead: [STEPS, HEART] }).catch(() => false);

  const [steps, bpm] = await Promise.all([
    queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
      filter: { date: { startDate: startOfToday(), endDate: new Date() } },
      unit: 'count',
    })
      .then((r) => (r.sumQuantity ? Math.round(r.sumQuantity.quantity) : 0))
      .catch(() => null),
    getMostRecentQuantitySample(HEART, 'count/min')
      .then((s) => (s ? Math.round(s.quantity) : null))
      .catch(() => null),
  ]);
  return { steps, bpm, available: true };
}
