const paxUuid = (short: string) => `8e32${short}-64d2-11e6-bdf4-0800200c9a66`;

export const PAX_SERVICE = paxUuid('0200');
export const PAX_READ_CHAR = paxUuid('0201');
export const PAX_WRITE_CHAR = paxUuid('0202');
export const PAX_NOTIFY_CHAR = paxUuid('0203');

export const DEVICE_INFO_SERVICE = 0x180a;
export const DEVICE_INFO_CHARS = {
  manufacturer: 0x2a29,
  model: 0x2a24,
  serial: 0x2a25,
  hardware: 0x2a27,
  firmware: 0x2a26,
  software: 0x2a28,
} as const;

// Shared AES key baked into every official PAX app; the per-device key is
// AES-ECB(serial + serial) under this key.
export const PAX_SHARED_KEY_HEX = 'f7c866c38f78753086293bd57dd32540';

// Services requested up front so the GATT explorer can see them. Web Bluetooth
// hides any service not listed here, so this list doubles as the probe set for
// undocumented PAX services in the same 8e32xxxx family.
export const PROBE_SERVICES: BluetoothServiceUUID[] = [
  PAX_SERVICE,
  DEVICE_INFO_SERVICE,
  'battery_service',
  'generic_access',
  'generic_attribute',
  0xfe59, // Nordic secure DFU
  '00001530-1212-efde-1523-785feabcd123', // Nordic legacy DFU
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  ...Array.from({ length: 16 }, (_, i) => paxUuid(`0${i.toString(16)}00`)).filter(
    (u) => u !== PAX_SERVICE,
  ),
];

export const KNOWN_SERVICE_NAMES: Record<string, string> = {
  [PAX_SERVICE]: 'PAX control',
  '0000180a-0000-1000-8000-00805f9b34fb': 'Device Information',
  '0000180f-0000-1000-8000-00805f9b34fb': 'Battery',
  '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access',
  '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute',
  '0000fe59-0000-1000-8000-00805f9b34fb': 'Nordic Secure DFU',
  '00001530-1212-efde-1523-785feabcd123': 'Nordic Legacy DFU',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART',
};

export enum Attr {
  ActualTemp = 1,
  HeaterSetPoint = 2,
  Battery = 3,
  Usage = 4,
  UsageLimit = 5,
  Locked = 6,
  ChargeStatus = 7,
  PodInserted = 8,
  Time = 9,
  DeviceName = 10,
  Replay = 13,
  GameMode = 15,
  HeaterRanges = 17,
  LogSyncRequest = 18,
  DynamicMode = 19,
  ColorTheme = 20,
  Brightness = 21,
  HapticMode = 23,
  SupportedAttributes = 24,
  HeatingParameters = 25,
  UiMode = 27,
  ShellColor = 28,
  LowSocMode = 30,
  CurrentTargetTemp = 31,
  HeatingState = 32,
  SessionControl = 36,
  Haptics = 40,
  LogRequest = 41,
  PodData = 42,
  EncryptionExchange = 49,
  EncryptionPacket = 50,
  BleDisData = 52,
  FindMyPax = 54,
  StatusUpdate = 254,
}

export type AttrStatus = 'decoded' | 'partial' | 'unknown';

export interface AttrInfo {
  name: string;
  status: AttrStatus;
  note: string;
}

// What is known about each attribute ID (names come from the official app).
export const ATTR_INFO: Record<number, AttrInfo> = {
  [Attr.ActualTemp]: { name: 'Actual temp', status: 'decoded', note: 'uint16 LE raw → °C (piecewise)' },
  [Attr.HeaterSetPoint]: { name: 'Heater set point', status: 'decoded', note: 'uint16 LE raw ↔ °C; writable' },
  [Attr.Battery]: { name: 'Battery', status: 'decoded', note: 'uint8 percent' },
  [Attr.Usage]: { name: 'Usage', status: 'unknown', note: '' },
  [Attr.UsageLimit]: { name: 'Usage limit', status: 'unknown', note: '' },
  [Attr.Locked]: { name: 'Locked', status: 'partial', note: 'uint8, 0 = unlocked' },
  [Attr.ChargeStatus]: { name: 'Charge status', status: 'partial', note: 'uint8 state' },
  [Attr.PodInserted]: { name: 'Pod inserted', status: 'partial', note: 'Era only' },
  [Attr.Time]: { name: 'Time', status: 'unknown', note: '' },
  [Attr.DeviceName]: { name: 'Device name', status: 'partial', note: 'string, format unconfirmed' },
  [Attr.Replay]: { name: 'Replay', status: 'unknown', note: '' },
  [Attr.GameMode]: { name: 'Game mode', status: 'unknown', note: 'hidden game on PAX 3' },
  [Attr.HeaterRanges]: { name: 'Heater ranges', status: 'unknown', note: 'probably min/max temp' },
  [Attr.LogSyncRequest]: { name: 'Log sync request', status: 'unknown', note: '' },
  [Attr.DynamicMode]: { name: 'Dynamic mode', status: 'partial', note: 'uint8 mode id' },
  [Attr.ColorTheme]: { name: 'Color theme', status: 'decoded', note: '4 modes × [rgb1 rgb2 anim freq]' },
  [Attr.Brightness]: { name: 'Brightness', status: 'decoded', note: 'uint8 0–128' },
  [Attr.HapticMode]: { name: 'Haptic mode', status: 'decoded', note: 'uint8 0–128 amplitude' },
  [Attr.SupportedAttributes]: { name: 'Supported attributes', status: 'decoded', note: 'uint64 LE bitmask' },
  [Attr.HeatingParameters]: { name: 'Heating parameters', status: 'unknown', note: '' },
  [Attr.UiMode]: { name: 'UI mode', status: 'unknown', note: '' },
  [Attr.ShellColor]: { name: 'Shell color', status: 'unknown', note: '' },
  [Attr.LowSocMode]: { name: 'Low SoC mode', status: 'unknown', note: '' },
  [Attr.CurrentTargetTemp]: { name: 'Current target temp', status: 'decoded', note: 'uint16 LE raw → °C' },
  [Attr.HeatingState]: { name: 'Heating state', status: 'decoded', note: 'uint8 enum' },
  [Attr.SessionControl]: { name: 'Session control', status: 'unknown', note: '' },
  [Attr.Haptics]: { name: 'Haptics', status: 'unknown', note: '' },
  [Attr.LogRequest]: { name: 'Log request', status: 'unknown', note: '' },
  [Attr.PodData]: { name: 'Pod data', status: 'unknown', note: 'Era only' },
  [Attr.EncryptionExchange]: { name: 'Encryption exchange', status: 'unknown', note: 'newer key exchange?' },
  [Attr.EncryptionPacket]: { name: 'Encryption packet', status: 'unknown', note: '' },
  [Attr.BleDisData]: { name: 'BLE DIS data', status: 'unknown', note: '' },
  [Attr.FindMyPax]: { name: 'Find my PAX', status: 'unknown', note: 'probably vibrate/flash' },
  [Attr.StatusUpdate]: { name: 'Status update request', status: 'decoded', note: 'uint64 LE bitmask of attrs' },
};

export const attrName = (id: number) =>
  ATTR_INFO[id]?.name ?? `Unknown 0x${id.toString(16).padStart(2, '0')}`;

// Attributes the app asks for on connect and on refresh.
export const STATUS_ATTRS = [
  Attr.ActualTemp,
  Attr.HeaterSetPoint,
  Attr.Battery,
  Attr.Locked,
  Attr.ChargeStatus,
  Attr.DeviceName,
  Attr.HeaterRanges,
  Attr.DynamicMode,
  Attr.ColorTheme,
  Attr.Brightness,
  Attr.HapticMode,
  Attr.SupportedAttributes,
  Attr.UiMode,
  Attr.ShellColor,
  Attr.CurrentTargetTemp,
  Attr.HeatingState,
];

export const HEATING_STATES: Record<number, string> = {
  0: 'Heating',
  1: 'Ready',
  2: 'Boosting',
  3: 'Cooling',
  4: 'Standby',
  5: 'Oven off',
  6: 'Temp select',
};

export const DYNAMIC_MODES: Record<number, string> = {
  0: 'Standard',
  1: 'Boost',
  2: 'Efficiency',
  3: 'Stealth',
  4: 'Flavor',
};

export const PAX3_MIN_C = 182;
export const PAX3_MAX_C = 215;
export const PAX3_PRESETS_C = [182, 193, 204, 215];

export const LEVEL_MAX = 128; // brightness / haptic amplitude scale
