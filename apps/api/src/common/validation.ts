/** True if the string is an IANA timezone the runtime knows, e.g. "Asia/Bangkok". */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
