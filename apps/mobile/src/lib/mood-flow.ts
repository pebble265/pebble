import type { MoodEntry } from './types';

/**
 * The check-in being saved right now. Home starts the POST and opens the "Feel"
 * screen at the same moment; Feel waits on this to attach a note to it.
 */
export const moodFlow: { pending: Promise<MoodEntry | null> | null } = { pending: null };
