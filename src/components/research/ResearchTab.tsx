import { AdvancedPanel } from './AdvancedPanel';
import { AttributeScanner } from './AttributeScanner';
import { ChangeWatcher } from './ChangeWatcher';
import { GattExplorer } from './GattExplorer';

export function ResearchTab() {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        Tools for mapping the protocol. Reads and status requests are harmless; anything that writes an unknown attribute asks
        first. Non-PAX characteristics (e.g. firmware update) are never written.
      </p>
      <AttributeScanner />
      <ChangeWatcher />
      <AdvancedPanel />
      <GattExplorer />
    </div>
  );
}
