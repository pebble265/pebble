// Web / unsupported platforms: no Bluetooth, the setup screens fall back to the demo robot.
import type { BleState, FoundRobot } from './robot-protocol';

export async function bluetoothState(): Promise<BleState> {
  return 'unsupported';
}

export function scanForPebble(_onFound: (robot: FoundRobot) => void): () => void {
  return () => {};
}

export async function readPairCode(_deviceId: string): Promise<string> {
  throw new Error('Bluetooth is not available here');
}
