import { PAX_SHARED_KEY_HEX } from './constants';
import { fromHex } from './hex';

// WebCrypto has no ECB or OFB. One AES-CBC block with a zero IV equals one ECB
// block, and OFB is just a chain of ECB-encrypted IVs XORed with the data.

const ZERO_IV = new Uint8Array(16);

// WebCrypto typings want ArrayBuffer-backed views; ours always are.
const buf = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;

export const importAesKey = (raw: Uint8Array) =>
  crypto.subtle.importKey('raw', buf(raw), { name: 'AES-CBC' }, false, ['encrypt']);

export const aesEcbBlock = async (key: CryptoKey, block: Uint8Array): Promise<Uint8Array> => {
  if (block.length !== 16) throw new Error(`ECB block must be 16 bytes, got ${block.length}`);
  const out = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO_IV }, key, buf(block));
  return new Uint8Array(out, 0, 16);
};

export const aesOfb = async (key: CryptoKey, iv: Uint8Array, data: Uint8Array) => {
  const out = new Uint8Array(data.length);
  let stream = iv;
  for (let off = 0; off < data.length; off += 16) {
    stream = await aesEcbBlock(key, stream);
    for (let i = 0; i < 16 && off + i < data.length; i++) out[off + i] = data[off + i] ^ stream[i];
  }
  return out;
};

/** Per-device key: AES-ECB(serial + serial) under the shared key. */
export const deriveKeyBytes = async (serial: string): Promise<Uint8Array> => {
  const msg = new Uint8Array(16);
  msg.set(new TextEncoder().encode(serial + serial).subarray(0, 16));
  const shared = await importAesKey(fromHex(PAX_SHARED_KEY_HEX));
  return aesEcbBlock(shared, msg);
};

export interface PaxCipher {
  keyBytes: Uint8Array;
  encrypt(plain: Uint8Array, iv?: Uint8Array): Promise<{ packet: Uint8Array; iv: Uint8Array; cipher: Uint8Array }>;
  decrypt(packet: Uint8Array): Promise<{ plain: Uint8Array; iv: Uint8Array; cipher: Uint8Array }>;
}

/** Wire format: ciphertext || IV(16). */
export const createCipher = async (serial: string): Promise<PaxCipher> => {
  const keyBytes = await deriveKeyBytes(serial);
  const key = await importAesKey(keyBytes);
  return {
    keyBytes,
    async encrypt(plain, iv = crypto.getRandomValues(new Uint8Array(16))) {
      const cipher = await aesOfb(key, iv, plain);
      const packet = new Uint8Array(cipher.length + 16);
      packet.set(cipher);
      packet.set(iv, cipher.length);
      return { packet, iv, cipher };
    },
    async decrypt(packet) {
      if (packet.length <= 16) throw new Error(`Packet too short (${packet.length} bytes)`);
      const cipher = packet.slice(0, -16);
      const iv = packet.slice(-16);
      return { plain: await aesOfb(key, iv, cipher), iv, cipher };
    },
  };
};
