import { useMemo, useRef, useState } from 'react';

import { type Direction, type LogEntry, type SessionFile, pax, usePax } from '../pax/store';
import { loadAnnotations, saveAnnotations } from './research/annotations';
import { Badge, Button, Card, Hex, downloadJson, hexByte } from './ui';

const DIRS: Direction[] = ['tx', 'rx', 'notify', 'gatt', 'info', 'error'];
const DIR_STYLE: Record<Direction, string> = {
  tx: 'text-tx',
  rx: 'text-rx',
  notify: 'text-sky-300',
  gatt: 'text-fuchsia-300',
  info: 'text-muted',
  error: 'text-red-300',
};

const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour12: false }) + `.${String(t % 1000).padStart(3, '0')}`;

function Entry({ e, verbose }: { e: LogEntry; verbose: boolean }) {
  return (
    <li className="border-b border-edge/60 py-1.5 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-muted">{time(e.t)}</span>
        <span className={`w-12 font-mono font-semibold uppercase ${DIR_STYLE[e.dir]}`}>{e.dir}</span>
        {e.type != null && (
          <span className="font-mono">
            {hexByte(e.type)} {e.name}
          </span>
        )}
        {e.known === false && <Badge tone="accent">unknown</Badge>}
        {e.summary && <span className="text-muted">{e.summary}</span>}
        {e.note && <span className="text-muted">{e.note}</span>}
      </div>
      {e.plain && (
        <div className="mt-0.5 pl-2">
          <span className="text-muted">{e.cipher ? 'plain ' : 'value '}</span>
          <Hex value={e.plain} />
        </div>
      )}
      {verbose && e.cipher && (
        <div className="pl-2 text-muted">
          cipher <Hex value={e.cipher} /> · iv <Hex value={e.iv} />
        </div>
      )}
    </li>
  );
}

export function MiniLog({ onOpen }: { onOpen: () => void }) {
  const log = usePax((s) => s.log);
  const recent = log.filter((e) => e.dir === 'tx' || e.dir === 'rx' || e.dir === 'error').slice(-8).reverse();
  return (
    <Card title="Live traffic" actions={<Button onClick={onOpen}>Full log</Button>}>
      {recent.length === 0 && <p className="text-sm text-muted">Commands sent and received will appear here.</p>}
      <ul>{recent.map((e) => <Entry key={e.id} e={e} verbose={false} />)}</ul>
    </Card>
  );
}

export function ProtocolLog() {
  const log = usePax((s) => s.log);
  const [dirs, setDirs] = useState<Set<Direction>>(new Set(DIRS));
  const [query, setQuery] = useState('');
  const [verbose, setVerbose] = useState(false);
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [frozen, setFrozen] = useState<LogEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const source = frozen ?? log;
  const shown = useMemo(() => {
    const q = query.toLowerCase();
    return source
      .filter(
        (e) =>
          dirs.has(e.dir) &&
          (!onlyUnknown || e.known === false) &&
          (!q || [e.name, e.summary, e.note, e.plain, e.type != null ? hexByte(e.type) : ''].some((s) => s?.toLowerCase().includes(q))),
      )
      .slice(-500)
      .reverse();
  }, [source, dirs, query, onlyUnknown]);

  const toggle = (d: Direction) => {
    const next = new Set(dirs);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setDirs(next);
  };

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as SessionFile;
      pax.importSession(data);
      if (data.annotations) saveAnnotations({ ...loadAnnotations(), ...(data.annotations as object) });
    } catch (e) {
      pax.note(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <Card
      title={`Protocol log (${source.length})`}
      actions={
        <>
          <Button onClick={() => setFrozen(frozen ? null : log)}>{frozen ? 'Resume' : 'Pause'}</Button>
          <Button onClick={() => pax.clearLog()}>Clear</Button>
          <Button onClick={() => downloadJson(`pax3-session-${Date.now()}.json`, pax.exportSession(loadAnnotations()))}>Export</Button>
          <Button onClick={() => fileRef.current?.click()}>Import</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DIRS.map((d) => (
          <button
            key={d}
            onClick={() => toggle(d)}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs uppercase ${dirs.has(d) ? `border-edge ${DIR_STYLE[d]}` : 'border-transparent text-muted/50 line-through'}`}
          >
            {d}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={verbose} onChange={(e) => setVerbose(e.target.checked)} /> cipher + IV
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={onlyUnknown} onChange={(e) => setOnlyUnknown(e.target.checked)} /> unknown only
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter (name, hex, 0x14…)"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-transparent px-2 py-1 text-xs"
        />
      </div>
      <p className="mb-2 text-xs text-muted">
        <span className="text-tx">TX</span> = app → PAX (encrypted on write), <span className="text-rx">RX</span> = PAX → app (read after
        each <span className="text-sky-300">NOTIFY</span>). Showing newest {shown.length}.
      </p>
      <ul>{shown.map((e) => <Entry key={e.id} e={e} verbose={verbose} />)}</ul>
    </Card>
  );
}
