import { describe, expect, it } from 'vitest';

import { aesOfb, createCipher, deriveKeyBytes, importAesKey } from './crypto';
import { fromHex, toHex } from './hex';

// Vectors from evertonstz/pax-romana (captured from a real PAX 3).
const SERIAL = 'KRZQ2NW9';

describe('crypto', () => {
  it('derives the device key from the serial', async () => {
    expect(toHex(await deriveKeyBytes(SERIAL))).toBe('8423398c3781fa6b008cba8c6c5366d4');
  });

  it('decrypts a captured packet', async () => {
    const cipher = await createCipher(SERIAL);
    const { plain } = await cipher.decrypt(
      fromHex('63d33e940e5246f4a4f891b834e3654ff20d5cb4e3d880d13a236ecb30626bec'),
    );
    expect(toHex(plain)).toBe('3568637cfde13dd55052dd77648c8ad0');
  });

  it('round-trips multi-block packets', async () => {
    const cipher = await createCipher(SERIAL);
    const plain = Uint8Array.from({ length: 35 }, (_, i) => i * 7);
    const { packet } = await cipher.encrypt(plain);
    expect(packet.length).toBe(35 + 16);
    expect(toHex((await cipher.decrypt(packet)).plain)).toBe(toHex(plain));
  });

  it('matches the NIST SP 800-38A OFB vector', async () => {
    const key = await importAesKey(fromHex('2b7e151628aed2a6abf7158809cf4f3c'));
    const out = await aesOfb(key, fromHex('000102030405060708090a0b0c0d0e0f'), fromHex('6bc1bee22e409f96e93d7e117393172a'));
    expect(toHex(out)).toBe('3b3fd92eb72dad20333449f8e83cfb4a');
  });
});
