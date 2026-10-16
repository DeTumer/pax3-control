import { useEffect, useState } from 'react';

import { encode } from '../pax/codec';
import { Attr, PAX3_MAX_C, PAX3_MIN_C, PAX3_PRESETS_C } from '../pax/constants';
import { celsiusToRaw, cToF } from '../pax/temperature';
import { attrValue, pax, usePax } from '../pax/store';
import { toHex } from '../pax/hex';
import { Button, Card, Hex } from './ui';

export function TemperatureControl() {
  const setPoint = usePax((s) => attrValue<number>(s, Attr.HeaterSetPoint, 'celsius'));
  const connected = usePax((s) => s.status === 'connected');
  const [value, setValue] = useState(setPoint ?? 200);
  const [unitF, setUnitF] = useState(false);

  useEffect(() => {
    if (setPoint != null) setValue(setPoint);
  }, [setPoint]);

  const send = (c: number) => {
    setValue(c);
    pax.send(encode.setTemperature(c)).then(() => pax.refresh([Attr.HeaterSetPoint, Attr.CurrentTargetTemp]));
  };
  const show = (c: number) => (unitF ? `${cToF(c)}°F` : `${c}°C`);

  return (
    <Card
      title="Temperature"
      actions={
        <Button onClick={() => setUnitF(!unitF)} className="px-2 py-0.5 text-xs">
          °{unitF ? 'F' : 'C'}
        </Button>
      }
    >
      <div className="mb-2 text-4xl font-semibold tabular-nums">{show(value)}</div>
      <input
        type="range"
        min={PAX3_MIN_C}
        max={PAX3_MAX_C}
        value={value}
        disabled={!connected}
        onChange={(e) => setValue(+e.target.value)}
        onPointerUp={(e) => send(+(e.target as HTMLInputElement).value)}
        onKeyUp={(e) => send(+(e.target as HTMLInputElement).value)}
        className="w-full"
      />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {PAX3_PRESETS_C.map((c) => (
          <Button key={c} disabled={!connected} onClick={() => send(c)} className={value === c ? 'border-accent text-accent' : ''}>
            {show(c)}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Sends attr 0x02 with raw {celsiusToRaw(value)} (uint16 LE): <Hex value={toHex(encode.setTemperature(value).subarray(0, 3))} />
      </p>
    </Card>
  );
}
