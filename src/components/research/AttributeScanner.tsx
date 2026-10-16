import { useRef, useState } from 'react';

import { encode } from '../../pax/codec';
import { ATTR_INFO, Attr, attrName } from '../../pax/constants';
import { toHex } from '../../pax/hex';
import { attrValue, pax, usePax } from '../../pax/store';
import { Badge, Button, Card, Hex, downloadJson, hexByte } from '../ui';

interface ScanResult {
  id: number;
  claimed: boolean;
  responded: boolean;
  ms?: number;
  payload?: string;
  summary?: string;
}

export function AttributeScanner() {
  const connected = usePax((s) => s.status === 'connected');
  const supported = usePax((s) => attrValue<number[]>(s, Attr.SupportedAttributes, 'attrs'));
  const [results, setResults] = useState<ScanResult[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [timeout, setTimeoutMs] = useState(800);
  const cancel = useRef(false);

  const scan = async () => {
    cancel.current = false;
    pax.note('Attribute scan started');
    // Ask for the bitmask first so we can compare claim vs. reality.
    const sup = pax.waitForRx((t) => t === Attr.SupportedAttributes, 1500);
    await pax.send(encode.statusRequest([Attr.SupportedAttributes]));
    const claimedIds = ((await sup)?.fields[0]?.value as number[] | undefined) ?? supported ?? [];

    const out: ScanResult[] = [];
    // 0xFE carries a 64-bit mask, so ids 0–63 are all that can be requested this way.
    for (let id = 0; id < 64 && !cancel.current; id++) {
      setProgress(id);
      const started = performance.now();
      const reply = pax.waitForRx((t) => t === id, timeout);
      await pax.send(encode.statusRequest([id]));
      const d = await reply;
      out.push({
        id,
        claimed: claimedIds.includes(id),
        responded: !!d,
        ms: d ? Math.round(performance.now() - started) : undefined,
        payload: d ? toHex(d.payload) : undefined,
        summary: d?.summary,
      });
      setResults([...out]);
    }
    setProgress(null);
    const found = out.filter((r) => r.responded).map((r) => hexByte(r.id));
    pax.note(`Attribute scan finished: ${found.length} responded (${found.join(' ')})`);
  };

  const interesting = results.filter((r) => r.responded || r.claimed);

  return (
    <Card
      title="Attribute scanner"
      actions={
        <>
          {results.length > 0 && <Button onClick={() => downloadJson(`pax3-scan-${Date.now()}.json`, results)}>Export</Button>}
          {progress != null ? (
            <Button variant="danger" onClick={() => (cancel.current = true)}>
              Stop ({progress}/63)
            </Button>
          ) : (
            <Button variant="primary" disabled={!connected} onClick={scan}>
              Scan 0–63
            </Button>
          )}
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Reads the Supported-Attributes bitmask (0x18), then sends a read-only status request (0xFE) for every id 0–63 one at a
        time and records which ones answer. Unknown ids that answer are candidate hidden features.
      </p>
      <label className="mb-3 flex items-center gap-2 text-xs text-muted">
        Wait per id
        <input
          type="number"
          min={200}
          max={5000}
          step={100}
          value={timeout}
          onChange={(e) => setTimeoutMs(+e.target.value)}
          className="w-20 rounded border border-edge bg-transparent px-2 py-0.5"
        />
        ms
      </label>
      {supported && (
        <p className="mb-3 text-xs">
          <span className="text-muted">Device claims support for:</span>{' '}
          {supported.map((id) => (
            <span key={id} className="mr-1 inline-block">
              <Badge tone={id in ATTR_INFO ? 'muted' : 'accent'}>{hexByte(id)}</Badge>
            </span>
          ))}
        </p>
      )}
      {interesting.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-2">id</th>
                <th className="pr-2">name</th>
                <th className="pr-2">claimed</th>
                <th className="pr-2">reply</th>
                <th>payload</th>
              </tr>
            </thead>
            <tbody>
              {interesting.map((r) => (
                <tr key={r.id} className="border-t border-edge/60 align-top">
                  <td className="py-1 pr-2 font-mono">{hexByte(r.id)}</td>
                  <td className="pr-2">
                    {attrName(r.id)} {!(r.id in ATTR_INFO) && <Badge tone="accent">new</Badge>}
                  </td>
                  <td className="pr-2">{r.claimed ? 'yes' : '—'}</td>
                  <td className="pr-2">{r.responded ? `${r.ms} ms` : <span className="text-muted">none</span>}</td>
                  <td>
                    <Hex value={r.payload} />
                    {r.summary && <div className="text-muted">{r.summary}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
