export interface HealthToday {
  /** steps since midnight, null when unknown */
  steps: number | null;
  /** latest heart rate reading (beats per minute), null when none */
  bpm: number | null;
  /** false when the platform has no health store (web, iPad, old Android) */
  available: boolean;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
