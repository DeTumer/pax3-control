import { useEffect, useState } from 'react';

import { encode } from '../pax/codec';
import { Attr, DYNAMIC_MODES, LEVEL_MAX } from '../pax/constants';
import { attrValue, pax, usePax } from '../pax/store';
import { Badge, Button, Card, confirmExperimental } from './ui';

function LevelSlider({ label, attr, field, build }: { label: string; attr: Attr; field: string; build: (v: number) => Uint8Array }) {
  const current = usePax((s) => attrValue<number>(s, attr, field));
  const connected = usePax((s) => s.status === 'connected');
  const [value, setValue] = useState(current ?? 64);
  useEffect(() => {
    if (current != null) setValue(current);
  }, [current]);
  const send = (v: number) => pax.send(build(v)).then(() => pax.refresh([attr]));

  return (
    <label className="block py-2">
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted tabular-nums">
          {Math.round((value / LEVEL_MAX) * 100)}% <span className="text-xs">({value})</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={LEVEL_MAX}
        value={value}
        disabled={!connected}
        onChange={(e) => setValue(+e.target.value)}
        onPointerUp={(e) => send(+(e.target as HTMLInputElement).value)}
        onKeyUp={(e) => send(+(e.target as HTMLInputElement).value)}
        className="w-full"
      />
    </label>
  );
}

export function DeviceSettings() {
  const connected = usePax((s) => s.status === 'connected');
  const mode = usePax((s) => attrValue<number>(s, Attr.DynamicMode, 'mode'));
  const locked = usePax((s) => attrValue<boolean>(s, Attr.Locked, 'locked'));
  const deviceName = usePax((s) => attrValue<string>(s, Attr.DeviceName, 'name'));
  const [name, setName] = useState('');

  const experimental = (what: string, p: Uint8Array, refresh: Attr[]) => {
    if (confirmExperimental(what)) pax.send(p).then(() => pax.refresh(refresh));
  };

  return (
    <Card title="Device settings">
      <LevelSlider label="LED brightness" attr={Attr.Brightness} field="brightness" build={encode.setBrightness} />
      <LevelSlider label="Haptic strength" attr={Attr.HapticMode} field="amplitude" build={encode.setHaptic} />

      <div className="py-2">
        <div className="mb-1 flex items-center gap-2 text-sm">
          Dynamic mode <Badge tone="warn">ids unconfirmed</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DYNAMIC_MODES).map(([id, label]) => (
            <Button
              key={id}
              disabled={!connected}
              onClick={() => pax.send(encode.setDynamicMode(+id)).then(() => pax.refresh([Attr.DynamicMode]))}
              className={mode === +id ? 'border-accent text-accent' : ''}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-2 border-t border-edge pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm">
          Experimental <Badge tone="warn">format guessed</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!connected}
            onClick={() => experimental(`${locked ? 'Unlock' : 'Lock'} device (attr 0x06)`, encode.setLocked(!locked), [Attr.Locked])}
          >
            {locked ? 'Unlock' : 'Lock'}
          </Button>
          <Button disabled={!connected} onClick={() => experimental('Find my PAX (attr 0x36)', encode.findMyPax(), [])}>
            Find my PAX
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            maxLength={14}
            placeholder={deviceName || 'Device name'}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-edge bg-transparent px-3 py-1.5 text-sm"
          />
          <Button
            disabled={!connected || !name}
            onClick={() => experimental(`Rename to "${name}" (attr 0x0a)`, encode.setDeviceName(name), [Attr.DeviceName])}
          >
            Rename
          </Button>
        </div>
      </div>
    </Card>
  );
}
