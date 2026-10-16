import { useEffect, useState } from 'react';

import { type ColorMode, type ColorTheme, type Rgb, THEME_SLOTS, type ThemeSlot, encode } from '../pax/codec';
import { Attr } from '../pax/constants';
import { toHex } from '../pax/hex';
import { attrValue, pax, usePax } from '../pax/store';
import { Badge, Button, Card, Hex } from './ui';

// Theme captured from a real PAX 3 (stock colors).
const STOCK: ColorTheme = {
  startup: { color1: { r: 255, g: 115, b: 40 }, color2: { r: 153, g: 0, b: 104 }, animation: 1, frequency: 5 },
  heating: { color1: { r: 255, g: 115, b: 40 }, color2: { r: 153, g: 0, b: 104 }, animation: 0, frequency: 15 },
  regulating: { color1: { r: 253, g: 149, b: 40 }, color2: { r: 153, g: 0, b: 136 }, animation: 2, frequency: 11 },
  standby: { color1: { r: 255, g: 114, b: 125 }, color2: { r: 0, g: 64, b: 154 }, animation: 1, frequency: 6 },
};

const SLOT_HELP: Record<ThemeSlot, string> = {
  startup: 'shown when the device powers on',
  heating: 'while heating up to temperature',
  regulating: 'at temperature (ready)',
  standby: 'idle / standby',
};

const PRESETS_KEY = 'pax3.colorPresets';

const loadPresets = (): Record<string, ColorTheme> => {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '{}');
  } catch {
    return {};
  }
};

const rgbToHex = ({ r, g, b }: Rgb) => `#${toHex(Uint8Array.of(r, g, b))}`;
const hexToRgb = (h: string): Rgb => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });

/** Rough preview of the five petals; the real animation curves are firmware-defined. */
function Petals({ mode }: { mode: ColorMode }) {
  const c1 = rgbToHex(mode.color1);
  const c2 = rgbToHex(mode.color2);
  const style = {
    '--c1': c1,
    '--c2': c2,
    background: c1,
    animation: mode.animation ? `pax-pulse ${Math.max(0.3, (mode.frequency || 1) * 0.15)}s ease-in-out infinite` : undefined,
  } as React.CSSProperties;
  const dot = 'absolute h-3.5 w-3.5 rounded-full shadow-[0_0_12px_currentColor]';
  return (
    <div className="relative h-14 w-14 shrink-0 rounded-full bg-black/60">
      {[
        [50, 22],
        [26, 50],
        [50, 50],
        [74, 50],
        [50, 78],
      ].map(([x, y]) => (
        <span key={`${x}${y}`} className={dot} style={{ ...style, left: `calc(${x}% - 7px)`, top: `calc(${y}% - 7px)`, color: c1 }} />
      ))}
    </div>
  );
}

export function ColorThemeEditor() {
  const deviceTheme = usePax((s) => attrValue<ColorTheme>(s, Attr.ColorTheme, 'theme'));
  const connected = usePax((s) => s.status === 'connected');
  const [theme, setTheme] = useState<ColorTheme>(deviceTheme ?? STOCK);
  const [presets, setPresets] = useState(loadPresets);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (deviceTheme) setTheme(deviceTheme);
  }, [deviceTheme]);

  const update = (slot: ThemeSlot, patch: Partial<ColorMode>) => setTheme({ ...theme, [slot]: { ...theme[slot], ...patch } });

  const savePresets = (next: Record<string, ColorTheme>) => {
    setPresets(next);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
  };

  const bytes = encode.setColorTheme(theme);

  return (
    <div className="grid gap-4">
      <Card
        title="LED color theme"
        actions={
          <>
            <Button disabled={!connected} onClick={() => pax.refresh([Attr.ColorTheme])}>
              Read from device
            </Button>
            <Button onClick={() => setTheme(STOCK)}>Stock</Button>
            <Button variant="primary" disabled={!connected} onClick={() => pax.send(bytes).then(() => pax.refresh([Attr.ColorTheme]))}>
              Send to device
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_SLOTS.map((slot) => {
            const m = theme[slot];
            return (
              <div key={slot} className="rounded-xl border border-edge p-3">
                <div className="mb-3 flex items-center gap-3">
                  <Petals mode={m} />
                  <div>
                    <div className="font-medium capitalize">{slot}</div>
                    <div className="text-xs text-muted">{SLOT_HELP[slot]}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {(['color1', 'color2'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={rgbToHex(m[k])}
                        onChange={(e) => update(slot, { [k]: hexToRgb(e.target.value) })}
                        className="h-8 w-10 cursor-pointer rounded border border-edge bg-transparent"
                      />
                      <span className="text-muted">{k === 'color1' ? 'Primary' : 'Secondary'}</span>
                    </label>
                  ))}
                  <label className="flex flex-col gap-1">
                    <span className="text-muted">Animation id</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={m.animation}
                      onChange={(e) => update(slot, { animation: Math.max(0, Math.min(255, +e.target.value)) })}
                      className="rounded-lg border border-edge bg-transparent px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-muted">Frequency</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={m.frequency}
                      onChange={(e) => update(slot, { frequency: Math.max(0, Math.min(255, +e.target.value)) })}
                      className="rounded-lg border border-edge bg-transparent px-2 py-1"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Preview is approximate. Animation ids seen on stock firmware: 0, 1, 2 — try others and watch the device. <Badge tone="warn">research</Badge>
        </p>
        <div className="mt-2 text-xs text-muted">
          Packet (attr 0x14, {bytes.length} bytes): <Hex value={toHex(bytes)} />
        </div>
      </Card>

      <Card title="Saved themes">
        <div className="mb-3 flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Theme name"
            className="min-w-0 flex-1 rounded-lg border border-edge bg-transparent px-3 py-1.5 text-sm"
          />
          <Button disabled={!presetName} onClick={() => (savePresets({ ...presets, [presetName]: theme }), setPresetName(''))}>
            Save current
          </Button>
        </div>
        {Object.keys(presets).length === 0 && <p className="text-sm text-muted">No saved themes yet.</p>}
        <ul className="grid gap-2">
          {Object.entries(presets).map(([name, t]) => (
            <li key={name} className="flex items-center gap-3">
              <div className="flex gap-1">
                {THEME_SLOTS.map((s) => (
                  <span key={s} className="h-4 w-4 rounded-full" style={{ background: rgbToHex(t[s].color1) }} />
                ))}
              </div>
              <span className="flex-1 text-sm">{name}</span>
              <Button onClick={() => setTheme(t)}>Load</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const { [name]: _, ...rest } = presets;
                  savePresets(rest);
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
