import { Attr, HEATING_STATES } from '../pax/constants';
import { cToF } from '../pax/temperature';
import { attrValue, usePax } from '../pax/store';
import { Badge, Card, Hex, Row } from './ui';

const stateTone = (s?: number) => (s === 1 ? 'ok' : s === 0 || s === 2 ? 'warn' : 'muted');

export function StatusPanel() {
  const actual = usePax((s) => attrValue<number>(s, Attr.ActualTemp, 'celsius'));
  const target = usePax((s) => attrValue<number>(s, Attr.CurrentTargetTemp, 'celsius'));
  const setPoint = usePax((s) => attrValue<number>(s, Attr.HeaterSetPoint, 'celsius'));
  const heating = usePax((s) => attrValue<number>(s, Attr.HeatingState, 'state'));
  const battery = usePax((s) => attrValue<number>(s, Attr.Battery, 'percent'));
  const locked = usePax((s) => attrValue<boolean>(s, Attr.Locked, 'locked'));
  const charge = usePax((s) => attrValue<number>(s, Attr.ChargeStatus, 'state'));
  const info = usePax((s) => s.info);
  const keyHex = usePax((s) => s.keyHex);

  return (
    <Card title="Status">
      <div className="mb-4 flex items-end gap-4">
        <div>
          <div className="text-5xl font-semibold tabular-nums">{actual ?? '—'}°</div>
          <div className="text-xs text-muted">oven{actual != null && ` · ${cToF(actual)}°F`}</div>
        </div>
        <div className="pb-1">
          <div className="text-xl tabular-nums text-muted">→ {target ?? setPoint ?? '—'}°</div>
          <Badge tone={stateTone(heating)}>{heating != null ? (HEATING_STATES[heating] ?? `state ${heating}`) : 'unknown'}</Badge>
        </div>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${battery ?? 0}%` }} />
      </div>
      <Row label="Battery">{battery != null ? `${battery}%` : '—'}</Row>
      <Row label="Charge state">{charge ?? '—'}</Row>
      <Row label="Locked">{locked == null ? '—' : locked ? 'yes' : 'no'}</Row>
      <Row label="Set point">{setPoint != null ? `${setPoint} °C` : '—'}</Row>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Device info</summary>
        <Row label="Model">{info.model ?? '—'}</Row>
        <Row label="Firmware">{info.firmware ?? '—'}</Row>
        <Row label="Hardware">{info.hardware ?? '—'}</Row>
        <Row label="Serial">{info.serial ?? '—'}</Row>
        <Row label="Manufacturer">{info.manufacturer ?? '—'}</Row>
        <Row label="Session key">
          <Hex value={keyHex} />
        </Row>
      </details>
    </Card>
  );
}
