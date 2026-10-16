import { useState } from 'react';

import { encode, packet } from '../../pax/codec';
import { ATTR_INFO, Attr, attrName } from '../../pax/constants';
import { fromHex, toHex } from '../../pax/hex';
import { rawToCelsius } from '../../pax/temperature';
import { type AttrState, pax, usePax } from '../../pax/store';
import { Badge, Button, Card, Hex, confirmExperimental, hexByte } from '../ui';
import { type Annotation, type Annotations, type FieldKind, KIND_SIZE, loadAnnotations, saveAnnotations } from './annotations';
import { ByteDiff } from './ChangeWatcher';

// Writes whose format is confirmed; everything else asks first.
const SAFE_TYPES = new Set<number>([Attr.StatusUpdate, Attr.HeaterSetPoint, Attr.ColorTheme, Attr.Brightness, Attr.HapticMode]);

const readField = (p: Uint8Array, a: Annotation): string => {
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const need = a.kind === 'ascii' ? (a.length ?? 1) : KIND_SIZE[a.kind];
  if (a.offset + need > p.length) return 'out of range';
  switch (a.kind) {
    case 'u8':
      return String(dv.getUint8(a.offset));
    case 'i8':
      return String(dv.getInt8(a.offset));
    case 'u16le':
      return String(dv.getUint16(a.offset, true));
    case 'i16le':
      return String(dv.getInt16(a.offset, true));
    case 'u32le':
      return String(dv.getUint32(a.offset, true));
    case 'temp':
      return `${rawToCelsius(dv.getUint16(a.offset, true))} °C`;
    case 'bits':
      return dv.getUint8(a.offset).toString(2).padStart(8, '0');
    case 'ascii':
      return JSON.stringify(new TextDecoder().decode(p.subarray(a.offset, a.offset + need)));
  }
};

function Annotator({ attr, annotations, onChange }: { attr: AttrState; annotations: Annotation[]; onChange: (a: Annotation[]) => void }) {
  const [draft, setDraft] = useState<Annotation>({ label: '', offset: 0, kind: 'u8' });
  const payload = fromHex(attr.payload);
  return (
    <div className="mt-2 rounded-lg bg-black/20 p-2">
      <div className="mb-2 font-mono text-[11px] text-muted">
        {Array.from(payload, (_, i) => (
          <span key={i} className="inline-block w-[2.6ch] text-center">
            {i}
          </span>
        ))}
        <br />
        {Array.from(payload, (b, i) => (
          <span key={i} className="inline-block w-[2.6ch] text-center text-white">
            {b.toString(16).padStart(2, '0')}
          </span>
        ))}
      </div>
      {annotations.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="font-mono text-muted">
            @{a.offset} {a.kind}
          </span>
          <span>{a.label}</span>
          <span className="text-accent">= {readField(payload, a)}</span>
          <button className="ml-auto text-red-300" onClick={() => onChange(annotations.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        <input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="label"
          className="w-24 rounded border border-edge bg-transparent px-1.5 py-0.5"
        />
        <input
          type="number"
          min={0}
          value={draft.offset}
          onChange={(e) => setDraft({ ...draft, offset: +e.target.value })}
          className="w-14 rounded border border-edge bg-transparent px-1.5 py-0.5"
        />
        <select
          value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as FieldKind })}
          className="rounded border border-edge bg-panel px-1.5 py-0.5"
        >
          {Object.keys(KIND_SIZE).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        {draft.kind === 'ascii' && (
          <input
            type="number"
            min={1}
            value={draft.length ?? 1}
            onChange={(e) => setDraft({ ...draft, length: +e.target.value })}
            className="w-14 rounded border border-edge bg-transparent px-1.5 py-0.5"
          />
        )}
        <Button className="px-2 py-0.5 text-xs" disabled={!draft.label} onClick={() => onChange([...annotations, draft])}>
          Add field
        </Button>
      </div>
    </div>
  );
}

function RawSender() {
  const connected = usePax((s) => s.status === 'connected');
  const [type, setType] = useState('fe');
  const [payload, setPayload] = useState('');
  const [pad, setPad] = useState(true);

  let bytes: Uint8Array | null = null;
  let error = '';
  try {
    const t = parseInt(type, 16);
    if (!(t >= 0 && t <= 255)) throw new Error('type must be one hex byte');
    const p = fromHex(payload);
    bytes = pad ? packet(t, p) : Uint8Array.of(t, ...p);
  } catch (e) {
    error = (e as Error).message;
  }

  const send = () => {
    if (!bytes) return;
    const t = bytes[0];
    if (!SAFE_TYPES.has(t) && !confirmExperimental(`Write ${hexByte(t)} ${attrName(t)} with payload ${payload || '(empty)'}`)) return;
    pax.send(bytes).then(() => {
      if (t < 64) pax.refresh([t]);
    });
  };

  return (
    <div className="rounded-xl border border-edge p-3">
      <div className="mb-2 text-sm font-medium">Raw packet sender</div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">type 0x</span>
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-12 rounded border border-edge bg-transparent px-2 py-1 font-mono"
        />
        <span className="text-muted">payload</span>
        <input
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="hex, e.g. 0a 00 00 00 01 00 00 00"
          className="min-w-0 flex-1 rounded border border-edge bg-transparent px-2 py-1 font-mono"
        />
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={pad} onChange={(e) => setPad(e.target.checked)} /> pad to 16
        </label>
        <Button variant="primary" disabled={!connected || !bytes} onClick={send}>
          Send
        </Button>
      </div>
      <div className="mt-2 text-xs text-muted">
        {error ? <span className="text-red-300">{error}</span> : <>plaintext <Hex value={bytes ? toHex(bytes) : ''} /></>}
        {bytes && !SAFE_TYPES.has(bytes[0]) && (
          <span className="ml-2">
            <Badge tone="warn">will ask before sending</Badge>
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="text-xs text-muted">quick:</span>
        <Button className="px-2 py-0.5 text-xs" onClick={() => (setType('fe'), setPayload(toHex(encode.statusRequest([Attr.SupportedAttributes]).subarray(1, 9))))}>
          request 0x18
        </Button>
        <Button className="px-2 py-0.5 text-xs" onClick={() => (setType('fe'), setPayload('ffffffffffffffff'))}>
          request all
        </Button>
      </div>
    </div>
  );
}

export function AdvancedPanel() {
  const attrs = usePax((s) => s.attrs);
  const connected = usePax((s) => s.status === 'connected');
  const [open, setOpen] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<Annotations>(loadAnnotations);

  const ids = [...new Set([...Object.keys(ATTR_INFO).map(Number), ...Object.keys(attrs).map(Number)])]
    .filter((id) => id !== Attr.StatusUpdate)
    .sort((a, b) => a - b);

  const updateAnnotations = (id: number, list: Annotation[]) => {
    const next = { ...annotations, [id]: list };
    setAnnotations(next);
    saveAnnotations(next);
  };

  return (
    <Card title="Attributes">
      <RawSender />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-2">id</th>
              <th className="pr-2">name</th>
              <th className="pr-2">last payload</th>
              <th className="pr-2">#</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const a = attrs[id];
              const info = ATTR_INFO[id];
              const prev = a && a.history.length > 1 ? a.history[a.history.length - 2].payload : undefined;
              return (
                <tr key={id} className="border-t border-edge/60 align-top">
                  <td className="py-1 pr-2 font-mono">{hexByte(id)}</td>
                  <td className="pr-2">
                    <div>
                      {attrName(id)}{' '}
                      <Badge tone={!info ? 'accent' : info.status === 'decoded' ? 'ok' : info.status === 'partial' ? 'warn' : 'muted'}>
                        {info?.status ?? 'new'}
                      </Badge>
                    </div>
                    {info?.note && <div className="text-muted">{info.note}</div>}
                    {a?.decoded.summary && <div className="text-accent">{a.decoded.summary}</div>}
                  </td>
                  <td className="pr-2">
                    {a ? <ByteDiff before={prev ?? a.payload} after={a.payload} /> : <span className="text-muted">—</span>}
                    {open === id && a && (
                      <>
                        <Annotator attr={a} annotations={annotations[id] ?? []} onChange={(l) => updateAnnotations(id, l)} />
                        <div className="mt-2 text-muted">history</div>
                        {a.history
                          .slice()
                          .reverse()
                          .map((h, i) => (
                            <div key={i}>
                              <span className="font-mono text-muted">{new Date(h.t).toLocaleTimeString()}</span> <Hex value={h.payload} />
                            </div>
                          ))}
                      </>
                    )}
                  </td>
                  <td className="pr-2 text-muted">{a?.count ?? 0}</td>
                  <td className="whitespace-nowrap">
                    {id < 64 && (
                      <Button className="px-2 py-0.5 text-xs" disabled={!connected} onClick={() => pax.refresh([id])}>
                        Read
                      </Button>
                    )}
                    {a && (
                      <Button className="ml-1 px-2 py-0.5 text-xs" onClick={() => setOpen(open === id ? null : id)}>
                        {open === id ? 'Close' : 'Inspect'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
