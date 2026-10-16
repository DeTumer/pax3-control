import {
  DEVICE_INFO_CHARS,
  DEVICE_INFO_SERVICE,
  PAX_NOTIFY_CHAR,
  PAX_READ_CHAR,
  PAX_SERVICE,
  PAX_WRITE_CHAR,
  PROBE_SERVICES,
} from './constants';
import { type PaxCipher, createCipher } from './crypto';
import { toBytes } from './hex';

export type DeviceInfo = Partial<Record<keyof typeof DEVICE_INFO_CHARS, string>> & { name?: string; id?: string };

export interface PaxDeviceEvents {
  /** Notify characteristic fired (value is the raw, unencrypted notify payload). */
  notify: (value: Uint8Array) => void;
  /** Decrypted packet read from the device. */
  rx: (p: { plain: Uint8Array; cipher: Uint8Array; iv: Uint8Array; packet: Uint8Array }) => void;
  /** Packet written to the device. */
  tx: (p: { plain: Uint8Array; cipher: Uint8Array; iv: Uint8Array; packet: Uint8Array }) => void;
  /** Value from a non-PAX characteristic the user subscribed to. */
  gatt: (p: { service: string; characteristic: string; value: Uint8Array }) => void;
  info: (message: string) => void;
  error: (message: string) => void;
  disconnect: () => void;
}

type Listeners = { [K in keyof PaxDeviceEvents]: Set<PaxDeviceEvents[K]> };

export interface GattCharacteristicDump {
  uuid: string;
  properties: string[];
  value?: Uint8Array;
  readError?: string;
  descriptors: { uuid: string; value?: Uint8Array }[];
}

export interface GattServiceDump {
  uuid: string;
  characteristics: GattCharacteristicDump[];
}

const PROPS: (keyof BluetoothCharacteristicProperties)[] = [
  'broadcast',
  'read',
  'writeWithoutResponse',
  'write',
  'notify',
  'indicate',
  'authenticatedSignedWrites',
  'reliableWrite',
  'writableAuxiliaries',
];

export const bluetoothSupport = (): { ok: true } | { ok: false; reason: 'insecure' | 'ios' | 'missing' } => {
  if (!window.isSecureContext) return { ok: false, reason: 'insecure' };
  if (typeof (navigator as Partial<Navigator>).bluetooth?.requestDevice === 'function') return { ok: true };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { ok: false, reason: ios ? 'ios' : 'missing' };
};

export class PaxDevice {
  info: DeviceInfo = {};
  cipher?: PaxCipher;

  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private readChar?: BluetoothRemoteGATTCharacteristic;
  private writeChar?: BluetoothRemoteGATTCharacteristic;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners: Listeners = {
    notify: new Set(),
    rx: new Set(),
    tx: new Set(),
    gatt: new Set(),
    info: new Set(),
    error: new Set(),
    disconnect: new Set(),
  };

  on<K extends keyof PaxDeviceEvents>(event: K, fn: PaxDeviceEvents[K]) {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  private emit<K extends keyof PaxDeviceEvents>(event: K, ...args: Parameters<PaxDeviceEvents[K]>) {
    for (const fn of this.listeners[event]) (fn as (...a: unknown[]) => void)(...args);
  }

  get connected() {
    return !!this.server?.connected;
  }

  /** Web Bluetooth allows one GATT operation at a time, so everything goes through this queue. */
  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const next = this.queue.then(op, op);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Must be called from a user gesture (click). */
  async connect({ acceptAll = false, serial }: { acceptAll?: boolean; serial?: string } = {}) {
    this.device = await navigator.bluetooth.requestDevice({
      ...(acceptAll ? { acceptAllDevices: true } : { filters: [{ namePrefix: 'PAX' }] }),
      optionalServices: PROBE_SERVICES,
    });
    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
    this.emit('info', `Selected ${this.device.name ?? 'unnamed device'}`);

    this.server = await this.device.gatt!.connect();
    this.emit('info', 'GATT connected');

    this.info = { name: this.device.name, id: this.device.id, ...(await this.readDeviceInfo()) };
    // Chrome's Web Bluetooth blocklist hides the Serial Number String (0x2a25),
    // so the serial usually has to come from the user.
    if (!this.info.serial) {
      if (!serial) {
        this.server.disconnect();
        throw new Error('Serial number not readable over Web Bluetooth — enter the 8-character serial and connect again');
      }
      this.info.serial = serial.trim().toUpperCase();
      this.emit('info', 'Serial not readable over BLE; using the serial you entered');
    }

    this.cipher = await createCipher(this.info.serial);
    this.emit('info', `Derived session key from serial ${this.info.serial}`);

    const service = await this.server.getPrimaryService(PAX_SERVICE);
    this.readChar = await service.getCharacteristic(PAX_READ_CHAR);
    this.writeChar = await service.getCharacteristic(PAX_WRITE_CHAR);
    const notifyChar = await service.getCharacteristic(PAX_NOTIFY_CHAR);
    notifyChar.addEventListener('characteristicvaluechanged', this.handleNotify);
    await notifyChar.startNotifications();
    this.emit('info', 'Subscribed to PAX notifications');
  }

  disconnect() {
    this.server?.disconnect();
  }

  private handleDisconnect = () => {
    this.readChar = this.writeChar = undefined;
    this.emit('disconnect');
  };

  private async readDeviceInfo() {
    const out: DeviceInfo = {};
    try {
      const service = await this.server!.getPrimaryService(DEVICE_INFO_SERVICE);
      for (const [key, uuid] of Object.entries(DEVICE_INFO_CHARS)) {
        try {
          const value = await (await service.getCharacteristic(uuid)).readValue();
          out[key as keyof typeof DEVICE_INFO_CHARS] = new TextDecoder().decode(value).replace(/\0+$/, '');
        } catch (e) {
          this.emit('info', `DIS ${key}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.emit('error', `Device Information service unavailable: ${(e as Error).message}`);
    }
    return out;
  }

  // The notify value only signals "data ready"; the real packet is on the read characteristic.
  private handleNotify = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) this.emit('notify', toBytes(value));
    this.readPacket().catch((e) => this.emit('error', `Read failed: ${(e as Error).message}`));
  };

  async readPacket() {
    const char = this.readChar;
    const cipher = this.cipher;
    if (!char || !cipher) throw new Error('Not connected');
    const packet = toBytes(await this.enqueue(() => char.readValue()));
    const { plain, iv, cipher: ct } = await cipher.decrypt(packet);
    this.emit('rx', { plain, cipher: ct, iv, packet });
    return plain;
  }

  async send(plain: Uint8Array) {
    const char = this.writeChar;
    const cipher = this.cipher;
    if (!char || !cipher) throw new Error('Not connected');
    const enc = await cipher.encrypt(plain);
    // Some platforms (macOS, Linux) reject write-without-response on this characteristic.
    await this.enqueue(() => char.writeValueWithResponse(enc.packet as Uint8Array<ArrayBuffer>));
    this.emit('tx', { plain, ...enc });
  }

  /** Walk every service Web Bluetooth lets us see and read everything readable. */
  async dumpGatt(): Promise<GattServiceDump[]> {
    const server = this.server;
    if (!server?.connected) throw new Error('Not connected');
    const services = await this.enqueue(() => server.getPrimaryServices());
    const out: GattServiceDump[] = [];
    for (const service of services) {
      const chars = await this.enqueue(() => service.getCharacteristics()).catch(() => []);
      const dumps: GattCharacteristicDump[] = [];
      for (const c of chars) {
        const dump: GattCharacteristicDump = {
          uuid: c.uuid,
          properties: PROPS.filter((p) => c.properties[p]),
          descriptors: [],
        };
        if (c.properties.read) {
          try {
            dump.value = toBytes(await this.enqueue(() => c.readValue()));
          } catch (e) {
            dump.readError = (e as Error).message;
          }
        }
        const descriptors = await this.enqueue(() => c.getDescriptors()).catch(() => []);
        for (const d of descriptors) {
          const value = await this.enqueue(() => d.readValue())
            .then(toBytes)
            .catch(() => undefined);
          dump.descriptors.push({ uuid: d.uuid, value });
        }
        dumps.push(dump);
      }
      out.push({ uuid: service.uuid, characteristics: dumps });
    }
    return out;
  }

  /** Subscribe to notifications/indications of any characteristic (read-only research). */
  async subscribeRaw(serviceUuid: string, charUuid: string) {
    const server = this.server;
    if (!server?.connected) throw new Error('Not connected');
    const c = await this.enqueue(async () => (await server.getPrimaryService(serviceUuid)).getCharacteristic(charUuid));
    c.addEventListener('characteristicvaluechanged', () => {
      if (c.value) this.emit('gatt', { service: serviceUuid, characteristic: charUuid, value: toBytes(c.value) });
    });
    await this.enqueue(() => c.startNotifications());
    this.emit('info', `Subscribed to ${charUuid}`);
  }
}
