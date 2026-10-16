import { describe, expect, it } from 'vitest';

import { Attr } from './constants';
import { type SessionFile, pax } from './store';

describe('session import', () => {
  it('replays rx packets into attribute state', () => {
    const file: SessionFile = {
      format: 'pax3-session',
      version: 1,
      exportedAt: '2026-10-16T00:00:00Z',
      info: { serial: 'KRZQ2NW9' },
      log: [
        { id: 1, t: 1, dir: 'rx', plain: '02' + '2e09' + '00'.repeat(13) },
        { id: 2, t: 2, dir: 'rx', plain: '7a0102' },
      ],
    };
    pax.importSession(file);
    const s = pax.getState();
    expect(s.attrs[Attr.HeaterSetPoint].decoded.fields[0].value).toBe(215);
    expect(s.attrs[0x7a].decoded.name).toBe('Unknown 0x7a');

    // export → import keeps the rx packets
    const exported = pax.exportSession();
    expect(exported.log.filter((e) => e.dir === 'rx')).toHaveLength(2);
  });
});
