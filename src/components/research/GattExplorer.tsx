import { useState } from 'react';

import { KNOWN_SERVICE_NAMES, PAX_SERVICE } from '../../pax/constants';
import type { GattServiceDump } from '../../pax/device';
import { toAscii, toHex } from '../../pax/hex';
import { pax, usePax } from '../../pax/store';
import { Badge, Button, Card, Hex } from '../ui';

const short = (uuid: string) => {
  const m = uuid.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  return m ? `0x${m[1]}` : uuid;
};

export function GattExplorer() {
  const connected = usePax((s) => s.status === 'connected');
  const [dump, setDump] = useState<GattServiceDump[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());

  const run = async () => {
    setBusy(true);
    try {
      setDump(await pax.device.dumpGatt());
    } catch (e) {
      pax.note(`GATT dump failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async (service: string, char: string) => {
    try {
      await pax.device.subscribeRaw(service, char);
      setSubscribed(new Set(subscribed).add(char));
    } catch (e) {
      pax.note(`Subscribe failed: ${(e as Error).message}`);
    }
  };

  return (
    <Card
      title="GATT explorer"
      actions={
        <Button disabled={!connected || busy} onClick={run}>
          {busy ? 'Reading…' : dump ? 'Re-read' : 'Enumerate'}
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Lists every service the browser exposes (only services named in the connect request are visible — the app probes PAX
        siblings 8e3200xx–8e320fxx, DFU, UART and standard services) and reads every readable value.
      </p>
      {dump?.map((s) => (
        <div key={s.uuid} className="mb-3 rounded-xl border border-edge p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <code className="text-xs">{short(s.uuid)}</code>
            {KNOWN_SERVICE_NAMES[s.uuid] ? <Badge>{KNOWN_SERVICE_NAMES[s.uuid]}</Badge> : <Badge tone="accent">unknown service</Badge>}
          </div>
          <ul className="grid gap-2">
            {s.characteristics.map((c) => (
              <li key={c.uuid} className="text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <code>{short(c.uuid)}</code>
                  {c.properties.map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                  {s.uuid !== PAX_SERVICE &&
                    (c.properties.includes('notify') || c.properties.includes('indicate')) &&
                    (subscribed.has(c.uuid) ? (
                      <Badge tone="ok">subscribed → log</Badge>
                    ) : (
                      <Button className="px-2 py-0.5 text-xs" onClick={() => subscribe(s.uuid, c.uuid)}>
                        Subscribe
                      </Button>
                    ))}
                </div>
                {c.value && (
                  <div className="mt-1 pl-2">
                    <Hex value={toHex(c.value)} /> <span className="text-muted">“{toAscii(c.value)}”</span>
                  </div>
                )}
                {c.readError && <div className="mt-1 pl-2 text-red-300">{c.readError}</div>}
                {c.descriptors.map((d) => (
                  <div key={d.uuid} className="pl-4 text-muted">
                    desc {short(d.uuid)}: {d.value ? <Hex value={toHex(d.value)} /> : '—'}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
