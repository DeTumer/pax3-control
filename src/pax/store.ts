import { useSyncExternalStore } from 'react';

import { type Decoded, decode, encode } from './codec';
import { ATTR_INFO, Attr, STATUS_ATTRS, attrName } from './constants';
import { type DeviceInfo, PaxDevice } from './device';
import { fromHex, toHex } from './hex';

export type Direction = 'tx' | 'rx' | 'notify' | 'gatt' | 'info' | 'error';

export interface LogEntry {
  id: number;
  t: number;
  dir: Direction;
  type?: number;
  name?: string;
  summary?: string;
  plain?: string;
  cipher?: string;
  iv?: string;
  note?: string;
  /** false when the attribute id has no known meaning */
  known?: boolean;
}

export interface AttrState {
  type: number;
  payload: string;
  decoded: Decoded;
  at: number;
  count: number;
  history: { t: number; payload: string }[];
}

export interface PaxState {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  error?: string;
  info: DeviceInfo;
  keyHex?: string;
  log: LogEntry[];
  attrs: Record<number, AttrState>;
}

export interface SessionFile {
  format: 'pax3-session';
  version: 1;
  exportedAt: string;
  info: DeviceInfo;
  log: LogEntry[];
  annotations?: unknown;
}

const LOG_CAP = 5000;
const HISTORY_CAP = 50;

type RxWaiter = { match: (type: number) => boolean; resolve: (d: Decoded | null) => void };

class PaxStore {
  readonly device = new PaxDevice();
  private state: PaxState = { status: 'idle', info: {}, log: [], attrs: {} };
  private subs = new Set<() => void>();
  private nextId = 1;
  private waiters = new Set<RxWaiter>();

  constructor() {
    const d = this.device;
    d.on('info', (note) => this.log({ dir: 'info', note }));
    d.on('error', (note) => this.log({ dir: 'error', note }));
    d.on('notify', (v) => this.log({ dir: 'notify', plain: toHex(v), note: 'data ready' }));
    d.on('gatt', ({ characteristic, value }) => this.log({ dir: 'gatt', plain: toHex(value), note: characteristic }));
    d.on('tx', ({ plain, cipher, iv }) => {
      const dec = decode(plain);
      this.log({ dir: 'tx', ...this.describe(dec), plain: toHex(plain), cipher: toHex(cipher), iv: toHex(iv) });
    });
    d.on('rx', ({ plain, cipher, iv }) => this.ingest(plain, { cipher: toHex(cipher), iv: toHex(iv) }));
    d.on('disconnect', () => {
      this.log({ dir: 'info', note: 'Disconnected' });
      this.set({ status: 'idle' });
    });
  }

  // --- external store plumbing ---
  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<PaxState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.subs) fn();
  }

  private describe(dec: Decoded) {
    return { type: dec.type, name: dec.name, summary: dec.summary, known: dec.type in ATTR_INFO };
  }

  private log(entry: Omit<LogEntry, 'id' | 't'> & { t?: number }) {
    const log = this.state.log.length >= LOG_CAP ? this.state.log.slice(-LOG_CAP + 1) : this.state.log.slice();
    log.push({ id: this.nextId++, t: entry.t ?? Date.now(), ...entry });
    this.set({ log });
  }

  /** Record a decrypted packet from the device (live or replayed from a session file). */
  private ingest(plain: Uint8Array, extra: Partial<LogEntry> = {}, t = Date.now(), logIt = true) {
    const dec = decode(plain);
    const payload = toHex(dec.payload);
    if (logIt) this.log({ dir: 'rx', t, ...this.describe(dec), plain: toHex(plain), ...extra });
    const prev = this.state.attrs[dec.type];
    const history = prev ? prev.history.slice(-HISTORY_CAP + 1) : [];
    if (!prev || prev.payload !== payload) history.push({ t, payload });
    this.set({
      attrs: {
        ...this.state.attrs,
        [dec.type]: { type: dec.type, payload, decoded: dec, at: t, count: (prev?.count ?? 0) + 1, history },
      },
    });
    for (const w of this.waiters) {
      if (w.match(dec.type)) {
        this.waiters.delete(w);
        w.resolve(dec);
      }
    }
  }

  // --- actions ---
  async connect(opts?: { acceptAll?: boolean; serial?: string }) {
    this.set({ status: 'connecting', error: undefined, attrs: {} });
    try {
      await this.device.connect(opts);
      this.set({ status: 'connected', info: this.device.info, keyHex: toHex(this.device.cipher!.keyBytes) });
      const first = this.waitForRx(() => true, 2000);
      await this.refresh();
      const reply = await first;
      // A wrong serial gives a wrong key, which decrypts to random type bytes.
      if (reply && !(reply.type in ATTR_INFO)) {
        this.log({ dir: 'error', note: 'First reply decoded to an unknown type — the serial (and so the key) is probably wrong' });
      }
    } catch (e) {
      const msg = (e as Error).message;
      this.log({ dir: 'error', note: msg });
      this.set({ status: this.device.connected ? 'connected' : 'error', error: msg });
    }
  }

  disconnect() {
    this.device.disconnect();
  }

  async send(plain: Uint8Array) {
    try {
      await this.device.send(plain);
    } catch (e) {
      this.log({ dir: 'error', note: `Send failed: ${(e as Error).message}` });
      throw e;
    }
  }

  refresh(ids: number[] = STATUS_ATTRS) {
    return this.send(encode.statusRequest(ids));
  }

  /** Resolve with the next rx packet matching `type`, or null after `timeout` ms. */
  waitForRx(match: (type: number) => boolean, timeout = 1000): Promise<Decoded | null> {
    return new Promise((resolve) => {
      const w: RxWaiter = { match, resolve };
      this.waiters.add(w);
      setTimeout(() => {
        if (this.waiters.delete(w)) resolve(null);
      }, timeout);
    });
  }

  note(note: string) {
    this.log({ dir: 'info', note });
  }

  clearLog() {
    this.set({ log: [] });
  }

  exportSession(annotations?: unknown): SessionFile {
    return {
      format: 'pax3-session',
      version: 1,
      exportedAt: new Date().toISOString(),
      info: this.state.info,
      log: this.state.log,
      annotations,
    };
  }

  /** Load a session file: log is appended, rx packets are replayed into attribute state. */
  importSession(file: SessionFile) {
    if (file.format !== 'pax3-session') throw new Error('Not a pax3-session file');
    this.log({ dir: 'info', note: `Imported session from ${file.exportedAt} (${file.log.length} entries)` });
    for (const e of file.log) {
      this.log({ ...e, note: e.note ? `[import] ${e.note}` : '[import]' });
      if (e.dir === 'rx' && e.plain) this.ingest(fromHex(e.plain), {}, e.t, false);
    }
    if (!this.state.info.serial) this.set({ info: file.info });
  }
}

export const pax = new PaxStore();

export const usePax = <T,>(select: (s: PaxState) => T): T =>
  useSyncExternalStore(pax.subscribe, () => select(pax.getState()));

export const attrValue = <T,>(s: PaxState, type: Attr | number, key: string): T | undefined =>
  s.attrs[type]?.decoded.fields.find((f) => f.key === key)?.value as T | undefined;

export { attrName };
