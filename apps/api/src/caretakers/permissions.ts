import { PermissionsDto } from './dto/caretakers.dto';

/** DB row <-> API shape for caretaker_permissions. */
export interface PermissionRow {
  alert_on_crisis: boolean;
  alert_on_missed_dose: boolean;
  alert_on_device_offline: boolean;
  view_adherence: boolean;
  view_mood_trend: boolean;
  view_conversation_summaries: boolean;
}

export function permissionsToResponse(p: PermissionRow | null) {
  // A missing row means the schema defaults: crisis alerts only.
  return {
    alertOnCrisis: p?.alert_on_crisis ?? true,
    alertOnMissedDose: p?.alert_on_missed_dose ?? false,
    alertOnDeviceIssue: p?.alert_on_device_offline ?? false,
    viewAdherence: p?.view_adherence ?? false,
    viewMoodTrend: p?.view_mood_trend ?? false,
    viewConversationSummaries: p?.view_conversation_summaries ?? false,
  };
}

export function permissionsToData(dto: PermissionsDto = {}) {
  return {
    ...(dto.alertOnCrisis !== undefined && { alert_on_crisis: dto.alertOnCrisis }),
    ...(dto.alertOnMissedDose !== undefined && {
      alert_on_missed_dose: dto.alertOnMissedDose,
    }),
    ...(dto.alertOnDeviceIssue !== undefined && {
      alert_on_device_offline: dto.alertOnDeviceIssue,
    }),
    ...(dto.viewAdherence !== undefined && { view_adherence: dto.viewAdherence }),
    ...(dto.viewMoodTrend !== undefined && { view_mood_trend: dto.viewMoodTrend }),
    ...(dto.viewConversationSummaries !== undefined && {
      view_conversation_summaries: dto.viewConversationSummaries,
    }),
  };
}

/** Which permission flag lets a caretaker receive each alert type. */
export const ALERT_PERMISSION: Record<string, keyof PermissionRow> = {
  crisis: 'alert_on_crisis',
  missed_dose: 'alert_on_missed_dose',
  device_offline: 'alert_on_device_offline',
  low_battery: 'alert_on_device_offline',
  dispenser_jam: 'alert_on_device_offline',
};
