import { describe, expect, it } from 'vitest';

import { decode, decodeColorTheme, encode } from './codec';
import { Attr } from './constants';
import { fromHex, toHex } from './hex';
import { celsiusToRaw, rawToCelsius } from './temperature';

describe('temperature', () => {
  it('matches the official app conversion', () => {
    expect(rawToCelsius(2350)).toBe(215);
  });

  it('round-trips the PAX 3 range', () => {
    for (let c = 175; c <= 215; c++) expect(rawToCelsius(celsiusToRaw(c))).toBe(c);
  });
});

describe('codec', () => {
  it('encodes a status request bitmask', () => {
    expect(toHex(encode.statusRequest([Attr.ActualTemp, Attr.Battery, Attr.HeatingState]))).toBe(
      'fe0a0000000100000000000000000000',
    );
  });

  it('encodes and decodes the heater set point', () => {
    const d = decode(encode.setTemperature(215));
    expect(d.type).toBe(Attr.HeaterSetPoint);
    expect(d.fields[0].value).toBe(215);
  });

  // Captured theme from pax-romana tests: trailing bytes after the 4 modes are noise.
  const capturedTheme =
    '1404ff73289900680105ff7328990068000ffd9528990088020bff727d00409a01063af54f71f8899a493279d0a9e0fa';

  it('decodes a captured color theme and re-encodes it identically', () => {
    const plain = fromHex(capturedTheme);
    const theme = decodeColorTheme(plain.subarray(1))!;
    expect(theme.heating).toEqual({
      color1: { r: 255, g: 115, b: 40 },
      color2: { r: 153, g: 0, b: 104 },
      animation: 0,
      frequency: 15,
    });
    expect(capturedTheme.startsWith(toHex(encode.setColorTheme(theme)))).toBe(true);
  });

  it('decodes supported attributes bitmask', () => {
    const d = decode(fromHex('18' + '0e00000000000000'));
    expect(d.fields[0].value).toEqual([1, 2, 3]);
  });
});
