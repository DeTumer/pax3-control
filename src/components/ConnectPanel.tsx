import { useState } from 'react';

import { bluetoothSupport } from '../pax/device';
import { pax, usePax } from '../pax/store';
import { Button, Card } from './ui';

const SERIAL_KEY = 'pax3.serial';

export function ConnectPanel() {
  const status = usePax((s) => s.status);
  const error = usePax((s) => s.error);
  const [acceptAll, setAcceptAll] = useState(false);
  const [serial, setSerial] = useState(() => {
    try {
      return localStorage.getItem(SERIAL_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const connect = () => {
    try {
      localStorage.setItem(SERIAL_KEY, serial);
    } catch {
      // storage unavailable
    }
    pax.connect({ acceptAll, serial: serial || undefined });
  };
  const support = bluetoothSupport();

  if (!support.ok) {
    return (
      <Card title="Bluetooth unavailable">
        {support.reason === 'ios' && (
          <p className="text-sm leading-relaxed">
            iPhone and iPad browsers (Safari, Chrome, Firefox — all WebKit) do not support Web Bluetooth. Install the free <b>Bluefy – Web BLE Browser</b> app from the App
            Store and open this page in it.
          </p>
        )}
        {support.reason === 'insecure' && (
          <p className="text-sm">Web Bluetooth needs HTTPS or <code>localhost</code>. Open this page over a secure connection.</p>
        )}
        {support.reason === 'missing' && (
          <p className="text-sm leading-relaxed">
            This browser has no Web Bluetooth. Use Chrome, Edge or Opera on desktop or Android. On Linux, enable{' '}
            <code className="text-xs">chrome://flags/#enable-experimental-web-platform-features</code> and restart Chrome.
          </p>
        )}
        <p className="mt-3 text-xs text-muted">You can still import a saved session in the Log tab to explore captured packets.</p>
      </Card>
    );
  }

  return (
    <Card title="Connect">
      <p className="mb-3 text-sm text-muted">
        Turn the PAX 3 on. If it has never been paired, hold the button until the petals flash blue, then connect.
      </p>
      <label className="mb-3 block text-sm">
        <span className="text-muted">Serial number</span>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))}
          placeholder="8 characters, e.g. KRZQ2NW9"
          className="mt-1 block w-full max-w-xs rounded-lg border border-edge bg-transparent px-3 py-1.5 font-mono tracking-widest"
        />
        <span className="mt-1 block text-xs text-muted">
          The encryption key is derived from it. Chrome blocks reading it over Bluetooth, so type the serial printed on your
          PAX or its box. Left empty, the app tries to read it from the device.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={status === 'connecting' || (serial.length > 0 && serial.length !== 8)} onClick={connect}>
          {status === 'connecting' ? 'Connecting…' : 'Connect to PAX'}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={acceptAll} onChange={(e) => setAcceptAll(e.target.checked)} />
          Show all BLE devices
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </Card>
  );
}
