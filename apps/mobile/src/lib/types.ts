export interface User {
  id: string;
  email: string;
  displayName: string;
  locale: string;
  timezone: string;
  usesMedication: boolean;
  onboardedAt: string | null;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export interface Dose {
  id: string;
  scheduledAt: string;
  status: DoseStatus;
  confirmedAt: string | null;
  confirmedVia: string | null;
  note: string | null;
  medication: {
    id: string;
    name: string;
    dosage: string | null;
    instructions: string | null;
    dispenserSlot: number | null;
  };
}

export interface TodayDoses {
  date: string;
  timezone: string;
  doses: Dose[];
}

export interface DoseHistory {
  from: string;
  to: string;
  summary: {
    taken: number;
    missed: number;
    skipped: number;
    pending: number;
    adherenceRate: number | null;
  };
}

export interface Schedule {
  id: string;
  time: string;
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
  graceMinutes: number;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  dispenserSlot: number | null;
  pillsRemaining: number | null;
  isActive: boolean;
  schedules: Schedule[];
  createdAt: string;
}

export interface ChatReply {
  conversationId: string;
  reply: string;
  crisis: null | {
    detected: true;
    contacts: { label: string; phone: string }[];
  };
}

export interface RobotSettings {
  robotName: string;
  voiceId: string;
  speechRate: number;
  greetingText: string;
  wakeWord: string;
  faceTheme: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface MoodEntry {
  id: string;
  score: number;
  label: string;
  source: string;
  createdAt: string;
  date?: string;
}

export interface MoodList {
  timezone: string;
  today: MoodEntry | null;
  entries: MoodEntry[];
}

export interface Device {
  id: string;
  serialNumber: string;
  status: 'unpaired' | 'online' | 'offline' | 'charging' | 'error';
  batteryLevel: number | null;
  firmwareVersion: string | null;
  pillSlots: number;
  lastSeenAt: string | null;
  pairedAt: string | null;
}
