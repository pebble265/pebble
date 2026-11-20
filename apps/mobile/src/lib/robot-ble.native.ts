import { BleManager, State } from 'react-native-ble-plx';
import { type BleState, type FoundRobot, parseInfo, PEBBLE_INFO, PEBBLE_PAIR, PEBBLE_SERVICE } from './robot-protocol';

let manager: BleManager | null = null;
function ble() {
  manager ??= new BleManager();
  return manager;
}

const decode = (b64: string | null | undefined) => {
  if (!b64) return '';
  const bin = atob(b64);
  // UTF-8 -> string without TextDecoder (not in every Hermes build)
  let out = '';
  for (let i = 0; i < bin.length; ) {
    const b = bin.charCodeAt(i++);
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bin.charCodeAt(i++) & 0x3f));
    else if (b < 0xf0) out += String.fromCharCode(((b & 0x0f) << 12) | ((bin.charCodeAt(i++) & 0x3f) << 6) | (bin.charCodeAt(i++) & 0x3f));
    else {
      const cp = ((b & 0x07) << 18) | ((bin.charCodeAt(i++) & 0x3f) << 12) | ((bin.charCodeAt(i++) & 0x3f) << 6) | (bin.charCodeAt(i++) & 0x3f);
      out += String.fromCodePoint(cp);
    }
  }
  return out;
};

/** Waits for iOS to report the radio state (it starts as "Unknown"). */
export function bluetoothState(): Promise<BleState> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (s: BleState) => {
      if (done) return;
      done = true;
      sub.remove();
      clearTimeout(timer);
      resolve(s);
    };
    const sub = ble().onStateChange((s) => {
      if (s === State.PoweredOn) finish('on');
      else if (s === State.PoweredOff || s === State.Resetting) finish('off');
      else if (s === State.Unauthorized) finish('unauthorized');
      else if (s === State.Unsupported) finish('unsupported');
    }, true);
    const timer = setTimeout(() => finish('unsupported'), 4000);
  });
}

async function readInfo(deviceId: string) {
  const device = await ble().connectToDevice(deviceId, { timeout: 8000 });
  try {
    await device.discoverAllServicesAndCharacteristics();
    const c = await device.readCharacteristicForService(PEBBLE_SERVICE, PEBBLE_INFO);
    return parseInfo(decode(c.value));
  } finally {
    await ble().cancelDeviceConnection(deviceId).catch(() => {});
  }
}

/**
 * Scans for robots advertising the pebble(a) service. Calls onFound once per
 * robot (after reading its INFO). Returns a function that stops scanning.
 */
export function scanForPebble(onFound: (robot: FoundRobot) => void): () => void {
  const seen = new Set<string>();
  let stopped = false;
  ble().startDeviceScan([PEBBLE_SERVICE], { allowDuplicates: false }, (error, device) => {
    if (stopped || error || !device || seen.has(device.id)) return;
    seen.add(device.id);
    readInfo(device.id)
      .then((info) => {
        if (!stopped && info) onFound({ deviceId: device.id, info, demo: false });
      })
      .catch(() => seen.delete(device.id)); // try again on the next advertisement
  });
  return () => {
    stopped = true;
    ble().stopDeviceScan().catch(() => {});
  };
}

/** Reads the 6-digit pairing code the robot got from the backend. */
export async function readPairCode(deviceId: string): Promise<string> {
  const device = await ble().connectToDevice(deviceId, { timeout: 8000 });
  try {
    await device.discoverAllServicesAndCharacteristics();
    for (let attempt = 0; attempt < 5; attempt++) {
      const c = await device.readCharacteristicForService(PEBBLE_SERVICE, PEBBLE_PAIR);
      const code = decode(c.value).trim();
      if (/^\d{6}$/.test(code)) return code;
      await new Promise((r) => setTimeout(r, 1500)); // robot still asking the server
    }
    throw new Error('The robot has no pairing code yet');
  } finally {
    await ble().cancelDeviceConnection(deviceId).catch(() => {});
  }
}
