/** Reminder sounds offered on the "Set dosage times" screen. */
export const ALARM_SOUNDS = ['radial', 'chimes', 'beacon', 'bulletin', 'gentle'] as const;
export type AlarmSound = (typeof ALARM_SOUNDS)[number];
