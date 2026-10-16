import { Attr, DYNAMIC_MODES, HEATING_STATES, LEVEL_MAX, attrName } from './constants';
import { celsiusToRaw, rawToCelsius } from './temperature';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ColorMode {
  color1: Rgb;
  color2: Rgb;
  animation: number;
  frequency: number;
}

export const THEME_SLOTS = ['startup', 'heating', 'regulating', 'standby'] as const;
export type ThemeSlot = (typeof THEME_SLOTS)[number];
export type ColorTheme = Record<ThemeSlot, ColorMode>;

/** One decoded field; `label` is what the UI shows, `value` is machine-usable. */
export interface Field {
  key: string;
  label: string;
  value: unknown;
  /** byte range inside the payload (after the type byte) */
  range: [number, number];
}

export interface Decoded {
  type: number;
  name: string;
  payload: Uint8Array;
  fields: Field[];
  /** short human summary */
  summary: string;
}

const u16 = (p: Uint8Array, o = 0) => p[o] | (p[o + 1] << 8);
const u64 = (p: Uint8Array, o = 0) => {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(p[o + i] ?? 0);
  return v;
};

export const bitsOf = (mask: bigint) => {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if ((mask >> BigInt(i)) & 1n) out.push(i);
  return out;
};

const temp = (key: string, payload: Uint8Array): Field[] => {
  const raw = u16(payload);
  return [
    { key, label: `${rawToCelsius(raw)} °C`, value: rawToCelsius(raw), range: [0, 2] },
    { key: 'raw', label: `raw ${raw}`, value: raw, range: [0, 2] },
  ];
};

const level = (key: string, payload: Uint8Array): Field[] => [
  { key, label: `${Math.round((payload[0] / LEVEL_MAX) * 100)}% (${payload[0]}/${LEVEL_MAX})`, value: payload[0], range: [0, 1] },
];

export const decodeColorTheme = (payload: Uint8Array): ColorTheme | null => {
  const count = payload[0];
  if (count < 4 || payload.length < 1 + count * 8) return null;
  const mode = (i: number): ColorMode => {
    const o = 1 + i * 8;
    return {
      color1: { r: payload[o], g: payload[o + 1], b: payload[o + 2] },
      color2: { r: payload[o + 3], g: payload[o + 4], b: payload[o + 5] },
      animation: payload[o + 6],
      frequency: payload[o + 7],
    };
  };
  return { startup: mode(0), heating: mode(1), regulating: mode(2), standby: mode(3) };
};

const fieldsFor = (type: number, payload: Uint8Array): Field[] => {
  switch (type) {
    case Attr.ActualTemp:
    case Attr.HeaterSetPoint:
    case Attr.CurrentTargetTemp:
      return payload.length >= 2 ? temp('celsius', payload) : [];
    case Attr.Battery:
      return [{ key: 'percent', label: `${payload[0]}%`, value: payload[0], range: [0, 1] }];
    case Attr.Locked:
      return [{ key: 'locked', label: payload[0] ? 'locked' : 'unlocked', value: payload[0] !== 0, range: [0, 1] }];
    case Attr.ChargeStatus:
      return [{ key: 'state', label: `state ${payload[0]}`, value: payload[0], range: [0, 1] }];
    case Attr.HeatingState:
      return [{ key: 'state', label: HEATING_STATES[payload[0]] ?? `state ${payload[0]}`, value: payload[0], range: [0, 1] }];
    case Attr.DynamicMode:
      return [{ key: 'mode', label: DYNAMIC_MODES[payload[0]] ?? `mode ${payload[0]}`, value: payload[0], range: [0, 1] }];
    case Attr.Brightness:
      return level('brightness', payload);
    case Attr.HapticMode:
      return level('amplitude', payload);
    case Attr.SupportedAttributes:
    case Attr.StatusUpdate: {
      const ids = bitsOf(u64(payload));
      return [{ key: 'attrs', label: ids.map(attrName).join(', ') || 'none', value: ids, range: [0, 8] }];
    }
    case Attr.ColorTheme: {
      const theme = decodeColorTheme(payload);
      return theme ? [{ key: 'theme', label: `${payload[0]} color modes`, value: theme, range: [0, 1 + payload[0] * 8] }] : [];
    }
    case Attr.DeviceName: {
      // Guess: printable run of bytes, optionally length-prefixed.
      const start = payload[0] > 0 && payload[0] < payload.length ? 1 : 0;
      const end = start ? 1 + payload[0] : payload.indexOf(0) === -1 ? payload.length : payload.indexOf(0);
      const name = new TextDecoder().decode(payload.subarray(start, end));
      return [{ key: 'name', label: JSON.stringify(name), value: name, range: [0, end] }];
    }
    default:
      return [];
  }
};

export const decode = (plain: Uint8Array): Decoded => {
  const type = plain[0];
  const payload = plain.subarray(1);
  const fields = fieldsFor(type, payload);
  return {
    type,
    name: attrName(type),
    payload,
    fields,
    summary: fields.filter((f) => f.key !== 'raw').map((f) => f.label).join(' · '),
  };
};

/** Short packets are zero-padded to one AES block, like the official app. */
export const packet = (type: number, payload: ArrayLike<number> = []) => {
  const out = new Uint8Array(Math.max(16, 1 + payload.length));
  out[0] = type;
  out.set(payload, 1);
  return out;
};

const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

export const encode = {
  statusRequest: (ids: number[]) => {
    let mask = 0n;
    for (const id of ids) if (id >= 0 && id < 64) mask |= 1n << BigInt(id);
    return packet(Attr.StatusUpdate, Array.from({ length: 8 }, (_, i) => Number((mask >> BigInt(i * 8)) & 0xffn)));
  },
  setTemperature: (celsius: number) => packet(Attr.HeaterSetPoint, le16(celsiusToRaw(celsius))),
  setBrightness: (value: number) => packet(Attr.Brightness, [clampLevel(value)]),
  setHaptic: (value: number) => packet(Attr.HapticMode, [clampLevel(value)]),
  setDynamicMode: (mode: number) => packet(Attr.DynamicMode, [mode]),
  setColorTheme: (theme: ColorTheme) =>
    packet(Attr.ColorTheme, [
      THEME_SLOTS.length,
      ...THEME_SLOTS.flatMap((slot) => {
        const m = theme[slot];
        return [m.color1.r, m.color1.g, m.color1.b, m.color2.r, m.color2.g, m.color2.b, m.animation, m.frequency];
      }),
    ]),
  // Formats below are unconfirmed guesses; the UI flags them as experimental.
  setLocked: (locked: boolean) => packet(Attr.Locked, [locked ? 1 : 0]),
  findMyPax: () => packet(Attr.FindMyPax, [1]),
  setDeviceName: (name: string) => {
    const bytes = new TextEncoder().encode(name).subarray(0, 14);
    return packet(Attr.DeviceName, [bytes.length, ...bytes]);
  },
};

const clampLevel = (v: number) => Math.max(0, Math.min(LEVEL_MAX, Math.round(v)));
