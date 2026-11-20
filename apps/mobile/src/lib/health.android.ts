import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { type HealthToday, startOfToday } from './health.shared';

export type { HealthToday };
export { startOfToday };
export const HEALTH_APP = 'Health Connect';

const WANTED = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
] as const;

export async function readHealthToday(ask: boolean): Promise<HealthToday> {
  try {
    if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return { steps: null, bpm: null, available: false };
    if (!(await initialize())) return { steps: null, bpm: null, available: false };

    let granted: readonly { recordType?: string; accessType?: string }[] = await getGrantedPermissions();
    const has = (type: string) => granted.some((p) => p.recordType === type && p.accessType === 'read');
    if (ask && !(has('Steps') && has('HeartRate'))) {
      granted = await requestPermission([...WANTED]);
    }

    const today = { operator: 'between', startTime: startOfToday().toISOString(), endTime: new Date().toISOString() } as const;
    const [steps, bpm] = await Promise.all([
      has('Steps')
        ? aggregateRecord({ recordType: 'Steps', timeRangeFilter: today }).then((r) => r.COUNT_TOTAL ?? 0).catch(() => null)
        : Promise.resolve(null),
      has('HeartRate')
        ? readRecords('HeartRate', {
            timeRangeFilter: { operator: 'after', startTime: new Date(Date.now() - 7 * 86_400_000).toISOString() },
            ascendingOrder: false,
            pageSize: 1,
          })
            .then((r) => {
              const samples = r.records[0]?.samples ?? [];
              const last = samples[samples.length - 1];
              return last ? Math.round(last.beatsPerMinute) : null;
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    return { steps, bpm, available: true };
  } catch {
    return { steps: null, bpm: null, available: false };
  }
}
