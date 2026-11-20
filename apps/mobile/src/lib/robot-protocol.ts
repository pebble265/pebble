/**
 * How the app talks to a pebble(a) robot over Bluetooth LE.
 * The robot side is described in docs/robot-bluetooth.md (same UUIDs).
 *
 *   Service  PEBBLE_SERVICE  advertised while the robot is waiting for an owner
 *   INFO     read   UTF-8 JSON {"serial":"PBL-…","name":"pebble(a)","model":"A3120B","color":"Space Black","fw":"1.0.0"}
 *   PAIR     read   UTF-8 6-digit pairing code from the backend (POST /robot/pairing-code), "" until ready
 */
export const PEBBLE_SERVICE = 'b7a1e000-5e6b-4c3a-9f0e-7065626c6561';
export const PEBBLE_INFO = 'b7a1e001-5e6b-4c3a-9f0e-7065626c6561';
export const PEBBLE_PAIR = 'b7a1e002-5e6b-4c3a-9f0e-7065626c6561';

export interface RobotInfo {
  serial: string;
  name: string;
  model: string;
  color: string;
  fw?: string;
}

export interface FoundRobot {
  /** Bluetooth id; empty for the demo robot */
  deviceId: string;
  info: RobotInfo;
  demo: boolean;
}

/** Shown when no real robot answers (no hardware yet, simulator, web). */
export const DEMO_ROBOT: FoundRobot = {
  deviceId: '',
  demo: true,
  info: { serial: 'DEMO', name: 'pebble(a)', model: 'A3120B', color: 'Space Black' },
};

export type BleState = 'on' | 'off' | 'unauthorized' | 'unsupported';

export function parseInfo(text: string): RobotInfo | null {
  try {
    const j = JSON.parse(text);
    if (typeof j?.serial !== 'string' || !j.serial) return null;
    return {
      serial: j.serial.slice(0, 50),
      name: typeof j.name === 'string' && j.name ? j.name.slice(0, 40) : 'pebble(a)',
      model: typeof j.model === 'string' ? j.model.slice(0, 20) : '',
      color: typeof j.color === 'string' ? j.color.slice(0, 30) : '',
      fw: typeof j.fw === 'string' ? j.fw.slice(0, 20) : undefined,
    };
  } catch {
    return null;
  }
}

/** Shared between the Finding and Found screens. */
export const robotFlow = { found: null as FoundRobot | null };
