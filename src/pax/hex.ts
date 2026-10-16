export const toHex = (bytes: Uint8Array, sep = '') =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(sep);

export const fromHex = (hex: string): Uint8Array => {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2) throw new Error('Hex string has odd length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export const toAscii = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');

export const toBytes = (view: DataView | ArrayBuffer) =>
  view instanceof DataView
    ? new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength))
    : new Uint8Array(view.slice(0));
