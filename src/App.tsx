import { useEffect, useState } from 'react';

import { ColorThemeEditor } from './components/ColorThemeEditor';
import { ConnectPanel } from './components/ConnectPanel';
import { DeviceSettings } from './components/DeviceSettings';
import { MiniLog, ProtocolLog } from './components/ProtocolLog';
import { StatusPanel } from './components/StatusPanel';
import { TemperatureControl } from './components/TemperatureControl';
import { ResearchTab } from './components/research/ResearchTab';
import { Badge, Button } from './components/ui';
import { pax, usePax } from './pax/store';

const TABS = ['Control', 'Colors', 'Research', 'Log'] as const;
type Tab = (typeof TABS)[number];

const loadTab = (): Tab => {
  try {
    const t = localStorage.getItem('pax3.tab');
    return TABS.includes(t as Tab) ? (t as Tab) : 'Control';
  } catch {
    return 'Control';
  }
};

export default function App() {
  const status = usePax((s) => s.status);
  const name = usePax((s) => s.info.name);
  const logCount = usePax((s) => s.log.length);
  const [tab, setTab] = useState<Tab>(loadTab);

  useEffect(() => {
    try {
      localStorage.setItem('pax3.tab', tab);
    } catch {
      // storage unavailable
    }
  }, [tab]);

  const connected = status === 'connected';

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="./favicon.svg" alt="" className="h-7 w-7" />
          <h1 className="text-lg font-semibold">PAX 3 Control</h1>
          {connected ? <Badge tone="ok">{name ?? 'connected'}</Badge> : <Badge>{status}</Badge>}
        </div>
        {connected && (
          <div className="flex gap-2">
            <Button onClick={() => pax.refresh()}>Refresh</Button>
            <Button variant="danger" onClick={() => pax.disconnect()}>
              Disconnect
            </Button>
          </div>
        )}
      </header>

      {!connected && <ConnectPanel />}

      <nav className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-edge bg-bg/90 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white'}`}
          >
            {t}
            {t === 'Log' && logCount > 0 && <span className="ml-1.5 text-xs opacity-60">{logCount}</span>}
          </button>
        ))}
      </nav>

      {tab === 'Control' && (
        <div className="grid gap-4 md:grid-cols-2">
          <StatusPanel />
          <TemperatureControl />
          <DeviceSettings />
          <MiniLog onOpen={() => setTab('Log')} />
        </div>
      )}
      {tab === 'Colors' && <ColorThemeEditor />}
      {tab === 'Research' && <ResearchTab />}
      {tab === 'Log' && <ProtocolLog />}
    </div>
  );
}
