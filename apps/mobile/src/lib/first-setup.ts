/**
 * First run, right after the robot is connected (or skipped):
 *   connect-code -> setup-meds (add medicines) -> all-set -> Home.
 * Kept in memory only: if the app is closed half-way it simply opens on Home next time.
 */
let pending = false;

export const firstSetup = {
  /** call just before reloadUser() makes the account "ready" */
  start() {
    pending = true;
  },
  get pending() {
    return pending;
  },
  done() {
    pending = false;
  },
};
