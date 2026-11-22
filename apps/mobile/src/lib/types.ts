export type Sex = 'male' | 'female' | 'other';

export interface User {
  id: string;
  email: string;
  displayName: string;
  locale: string;
  timezone: string;
  usesMedication: boolean;
  onboardedAt: string | null;
  pronunciation?: string | null;
  sex?: Sex | null;
  birthYear?: number | null;
  /** null until the "connect your pebble(a)" screens are done */
  robotSetupAt?: string | null;
  createdAt: string;
  /** false for accounts made with Apple / Google */
  hasPassword?: boolean;
  phone?: string | null;
  /** profile photo (data URL), null = default picture */
  avatar?: string | null;
  /** how the account signs in: "password", "google", "apple" */
  loginMethods?: string[];
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
  /** the doses themselves (past ones, plus ones already taken/skipped early) */
  doses?: Dose[];
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
  /** reminder sound picked on the "Set dosage times" screen */
  sound?: string;
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
  /** short note the user wrote with this check-in */
  note?: string | null;
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

// ---- Caretakers -------------------------------------------------------------
export type CarePermissions = {
  alertOnCrisis: boolean;
  alertOnMissedDose: boolean;
  alertOnDeviceIssue: boolean;
  viewAdherence: boolean;
  viewMoodTrend: boolean;
  viewConversationSummaries: boolean;
};

/** GET /caretakers: people who look after me */
export type MyCaretaker = {
  id: string;
  status: 'pending' | 'accepted' | 'expired';
  relationshipLabel: string | null;
  inviteEmail: string | null;
  caretaker: { displayName: string | null; email: string | null } | null;
  permissions: CarePermissions;
  createdAt: string;
  acceptedAt: string | null;
};

/** GET /caretaking: people I look after */
export type CaringFor = {
  linkId: string;
  displayName: string;
  relationshipLabel: string | null;
  permissions: CarePermissions;
  unacknowledgedAlerts: number;
  since: string | null;
};

/** GET /caretaking/:linkId: only what that person allowed */
export type CareOverview = {
  linkId: string;
  displayName: string;
  relationshipLabel: string | null;
  permissions: CarePermissions;
  adherence?: { days: number; taken: number; missed: number; skipped: number; rate: number | null };
  robots?: { status: string; batteryLevel: number | null; lastSeenAt: string | null }[];
  moodTrend?: { at: string; score: number }[];
};

/** GET /caretaking-alerts */
export type CareAlert = {
  deliveryId: string;
  linkId: string;
  person: string;
  relationshipLabel: string | null;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
};

// ---- Medical info (Profile → ข้อมูลทางการแพทย์) ------------------------------
export type MedicalData = {
  allergies: string[];
  conditions: string[];
  doctor: { name: string; place: string; phone: string };
  /** the 1323 / 1669 hotlines come first and can't be removed */
  contacts: { id: string; label: string; phone: string; hotline: boolean }[];
};

/** GET /chat/conversations */
export interface ChatConversation {
  id: string;
  startedAt: string;
  endedAt: string | null;
  messages: number;
  fromRobot: boolean;
  /** first thing the user said */
  preview: string | null;
  summary: string | null;
  mood: number | null;
}

/** GET /chat/conversations/:id/messages */
export interface ChatLog {
  id: string;
  startedAt: string;
  endedAt: string | null;
  fromRobot: boolean;
  open: boolean;
  messages: { id: string; role: 'user' | 'assistant'; text: string; at: string }[];
}
