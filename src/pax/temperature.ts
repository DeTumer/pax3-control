// PAX 3 does not send °C × 10. The official app converts between °C and the
// device's raw units with these piecewise-linear integer formulas.
const div = (a: number, b: number) => Math.trunc(a / b);

export const rawToCelsius = (raw: number): number =>
  raw < 1980 ? div((raw + 4) * 10, 109) + 3 : div(raw, 12) + 20;

export const celsiusToRaw = (celsius: number): number =>
  celsius < 185 ? div((celsius - 3) * 109, 10) + 6 : (celsius - 20) * 12 + 10;

export const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
export const fToC = (f: number) => Math.round(((f - 32) * 5) / 9);
