import { useEffect, useState } from 'react';

import { Attr, STATUS_ATTRS, attrName } from '../../pax/constants';
import { attrValue, pax, usePax } from '../../pax/store';
import { Badge, Button, Card, hexByte } from '../ui';

/** Renders new bytes, highlighting the ones that differ from `before`. */
export function ByteDiff({ before, after }: { before?: string; after: string }) {
  const bytes = after.match(/../g) ?? [];
  const old = before?.match(/../g) ?? [];
  return (
    <code className="font-mono text-xs break-all">
      {bytes.map((b, i) => (
        <span key={i} className={old[i] !== b ? 'rounded bg-amber-400/25 text-amber-200' : 'text-muted'}>
          {b}{' '}
        </span>
      ))}
    </code>
  );
}

export function ChangeWatcher() {
  const connected = usePax((s) => s.status === 'connected');
  const attrs = usePax((s) => s.attrs);
  const supported = usePax((s) => attrValue<number[]>(s, Attr.SupportedAttributes, 'attrs'));
  const [baseline, setBaseline] = useState<Record<number, string> | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [poll, setPoll] = useState(true);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!baseline || !poll || !connected) return;
    const ids = supported?.length ? supported : STATUS_ATTRS;
    const timer = setInterval(() => pax.refresh(ids).catch(() => undefined), 2000);
    return () => clearInterval(timer);
  }, [baseline, poll, connected, supported]);

  const start = () => {
    setBaseline(Object.fromEntries(Object.values(attrs).map((a) => [a.type, a.payload])));
    setStartedAt(Date.now());
    pax.note('Change watch started');
  };

  const changed = baseline
    ? Object.values(attrs)
        .filter((a) => a.at >= startedAt && a.payload !== baseline[a.type])
        .sort((a, b) => b.at - a.at)
    : [];

  return (
    <Card
      title="Change watcher"
      actions={
        baseline ? (
          <>
            <Button onClick={start}>Reset baseline</Button>
            <Button variant="danger" onClick={() => setBaseline(null)}>
              Stop
            </Button>
          </>
        ) : (
          <Button variant="primary" disabled={!connected} onClick={start}>
            Start watching
          </Button>
        )
      }
    >
      <p className="mb-3 text-xs text-muted">
        Snapshot every attribute, then do something on the device — press or double-click the button, shake it, lift the
        mouthpiece, put it on the charger, change temp by long-press — and see which bytes change. Changed bytes are highlighted.
      </p>
      {baseline && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1 text-muted">
            <input type="checkbox" checked={poll} onChange={(e) => setPoll(e.target.checked)} /> poll every 2 s
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="what did you just do?"
            className="min-w-0 flex-1 rounded-lg border border-edge bg-transparent px-2 py-1"
          />
          <Button
            disabled={!label}
            onClick={() => {
              pax.note(`MARK: ${label}`);
              setLabel('');
            }}
          >
            Mark in log
          </Button>
        </div>
      )}
      {baseline && changed.length === 0 && <p className="text-sm text-muted">No changes yet.</p>}
      <ul className="grid gap-2">
        {changed.map((a) => (
          <li key={a.type} className="rounded-lg border border-edge p-2 text-xs">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono">{hexByte(a.type)}</span> {attrName(a.type)}
              <Badge>{a.history.length} versions</Badge>
              {a.decoded.summary && <span className="text-muted">{a.decoded.summary}</span>}
            </div>
            <div>
              <span className="text-muted">before </span>
              <code className="font-mono text-muted">{baseline![a.type]?.replace(/(..)/g, '$1 ') ?? '(not seen)'}</code>
            </div>
            <div>
              <span className="text-muted">now&nbsp;&nbsp;&nbsp; </span>
              <ByteDiff before={baseline![a.type]} after={a.payload} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
