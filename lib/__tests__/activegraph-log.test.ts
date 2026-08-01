import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActiveGraphEvent } from '../activegraph';

// `server-only` throws when imported outside a server component; the module under test is
// server-side by construction, and the test runner is not Next.
vi.mock('server-only', () => ({}));

const SECRET = 'test-secret-not-for-production';
const LANE_SECRET = 'what-a-lane-would-have-to-guess';

const ev = (over: Partial<ActiveGraphEvent> = {}): ActiveGraphEvent => ({
  v: 1, seq: 1, venture: 'arca', repo: 'wealthcx01/arca-marketing', id: 'send-001',
  type: 'approval.proposed', at: '2026-07-31T12:00:00Z',
  actor: { kind: 'agent', id: 'foundry-lane' },
  ...over,
});

describe('an event a lane cannot author', () => {
  it('accepts an event signed with the real secret', async () => {
    const { signEvent, verifyEvent } = await import('../activegraph-log');
    const e = ev();
    expect(verifyEvent({ ...e, attestation: signEvent(e, SECRET) }, SECRET)).toBe(true);
  });

  it('refuses an event signed with any other secret', async () => {
    // The lane does not hold FOUNDRY_APPROVAL_SECRET — verified on the ARCA box, where it appears in
    // no file under /opt or /etc. This is the whole gate.
    const { signEvent, verifyEvent } = await import('../activegraph-log');
    const e = ev({ type: 'approval.granted', actor: { kind: 'human', id: 'john@bruntsfield.capital' } });
    expect(verifyEvent({ ...e, attestation: signEvent(e, LANE_SECRET) }, SECRET)).toBe(false);
  });

  it('refuses an event with no signature at all', async () => {
    const { verifyEvent } = await import('../activegraph-log');
    expect(verifyEvent(ev(), SECRET)).toBe(false);
    expect(verifyEvent({ ...ev(), attestation: '' }, SECRET)).toBe(false);
  });

  it('refuses everything when the studio itself has no secret', async () => {
    // Fail closed. A studio with no secret configured must not accept every event as valid.
    const { signEvent, verifyEvent } = await import('../activegraph-log');
    const e = ev();
    expect(verifyEvent({ ...e, attestation: signEvent(e, SECRET) }, '')).toBe(false);
  });

  it('refuses a real signature moved onto a changed event', async () => {
    // Lift a genuine proposal's signature onto a grant — the copy-and-relabel attack.
    const { signEvent, verifyEvent } = await import('../activegraph-log');
    const proposal = ev();
    const stolen = signEvent(proposal, SECRET);
    const forged: ActiveGraphEvent = {
      ...proposal, type: 'approval.granted',
      actor: { kind: 'human', id: 'john@bruntsfield.capital' }, attestation: stolen,
    };
    expect(verifyEvent(forged, SECRET)).toBe(false);
  });

  it('refuses a real event replayed into another venture', async () => {
    const { signEvent, verifyEvent } = await import('../activegraph-log');
    const real = ev({ type: 'approval.granted', actor: { kind: 'human', id: 'john@bruntsfield.capital' } });
    const signed = { ...real, attestation: signEvent(real, SECRET) };
    expect(verifyEvent({ ...signed, venture: 'the-reset' }, SECRET)).toBe(false);
    expect(verifyEvent({ ...signed, repo: 'wealthcx01/thereset-marketing' }, SECRET)).toBe(false);
  });
});

describe('reading a history back', () => {
  const dir = 'activegraph/arca/arca-marketing/send-001';

  function clientWith(files: Record<string, unknown>) {
    return {
      async request() {
        return Object.keys(files).map((path) => ({ path, type: 'file' }));
      },
      async getFileContent(_repo: string, path: string) {
        const f = files[path];
        return f === undefined ? null : JSON.stringify(f);
      },
    } as never;
  }

  let signEvent: (e: ActiveGraphEvent, s: string) => string;
  beforeEach(async () => { ({ signEvent } = await import('../activegraph-log')); });

  const signed = (e: ActiveGraphEvent) => ({ ...e, attestation: signEvent(e, SECRET) });

  it('projects a genuine history', async () => {
    const { historyFor } = await import('../activegraph-log');
    const client = clientWith({
      [`${dir}/0001-approval.proposed.json`]: signed(ev({ seq: 1 })),
      [`${dir}/0002-approval.granted.json`]: signed(ev({ seq: 2, type: 'approval.granted', actor: { kind: 'human', id: 'john@bruntsfield.capital' } })),
    });
    const h = await historyFor(client, 'arca', 'wealthcx01/arca-marketing', 'send-001', SECRET);
    expect(h.status).toBe('granted');
    expect(h.approver).toBe('john@bruntsfield.capital');
    expect(h.refused).toBe(0);
  });

  it('drops a lane-written grant before the projection ever sees it, and counts it', async () => {
    // The end-to-end version of the FB-051 failure: a lane appends a perfectly-shaped
    // `approval.granted` naming a real human. It never reaches the projection.
    const { historyFor } = await import('../activegraph-log');
    const laneForged = ev({ seq: 2, type: 'approval.granted', actor: { kind: 'human', id: 'john@bruntsfield.capital' } });
    const client = clientWith({
      [`${dir}/0001-approval.proposed.json`]: signed(ev({ seq: 1 })),
      [`${dir}/0002-approval.granted.json`]: { ...laneForged, attestation: signEvent(laneForged, LANE_SECRET) },
    });
    const h = await historyFor(client, 'arca', 'wealthcx01/arca-marketing', 'send-001', SECRET);
    expect(h.status).toBe('proposed');
    expect(h.approver).toBeNull();
    expect(h.refused).toBe(1);
  });

  it('refuses a valid event filed under the wrong position', async () => {
    // Otherwise a real event could be re-filed to change where it sits in the story.
    const { historyFor } = await import('../activegraph-log');
    const client = clientWith({
      [`${dir}/0001-approval.proposed.json`]: signed(ev({ seq: 1 })),
      [`${dir}/0005-approval.granted.json`]: signed(ev({ seq: 2, type: 'approval.granted', actor: { kind: 'human', id: 'j@x.com' } })),
    });
    const h = await historyFor(client, 'arca', 'wealthcx01/arca-marketing', 'send-001', SECRET);
    expect(h.status).toBe('proposed');
    expect(h.refused).toBe(1);
  });

  it('refuses a valid event from another approval filed into this one', async () => {
    const { historyFor } = await import('../activegraph-log');
    const client = clientWith({
      [`${dir}/0001-approval.proposed.json`]: signed(ev({ seq: 1, id: 'send-999' })),
    });
    const h = await historyFor(client, 'arca', 'wealthcx01/arca-marketing', 'send-001', SECRET);
    expect(h.refused).toBe(1);
    expect(h.status).toBe('unknown');
  });

  it('treats unparseable bytes as refused, never as an event', async () => {
    const { historyFor } = await import('../activegraph-log');
    const client = {
      async request() { return [{ path: `${dir}/0001-approval.proposed.json`, type: 'file' }]; },
      async getFileContent() { return 'not json at all'; },
    } as never;
    const h = await historyFor(client, 'arca', 'wealthcx01/arca-marketing', 'send-001', SECRET);
    expect(h.refused).toBe(1);
    expect(h.applied).toHaveLength(0);
  });

  it('reads an approval with no history as empty, not as an error', async () => {
    const { historyFor } = await import('../activegraph-log');
    const client = { async request() { throw new Error('404'); } } as never;
    const h = await historyFor(client, 'arca', 'wealthcx01/arca-marketing', 'nothing-here', SECRET);
    expect(h.status).toBe('unknown');
    expect(h.refused).toBe(0);
  });
});

describe('appending', () => {
  it('refuses to write over a position that already exists', async () => {
    // "Append-only" that can be overwritten is just a file.
    const { appendEvent } = await import('../activegraph-log');
    const put = vi.fn();
    vi.doMock('../github', () => ({
      GitHubClient: class {
        async request() { return { ref: 'refs/heads/foundry-activegraph' }; }
        async getFileContent() { return '{"already":"here"}'; }
        putFile = put;
      },
    }));
    vi.resetModules();
    const { appendEvent: fresh } = await import('../activegraph-log');
    const res = await fresh('token', ev(), SECRET);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('already recorded');
    expect(put).not.toHaveBeenCalled();
    vi.doUnmock('../github');
    vi.resetModules();
    expect(typeof appendEvent).toBe('function');
  });

  it('says why, rather than reporting success, when it cannot sign or write', async () => {
    // FB-051 told a founder "Approved" while its audit write had silently failed.
    const { appendEvent } = await import('../activegraph-log');
    expect(await appendEvent('token', ev(), '')).toEqual({ ok: false, reason: 'no signing secret is configured' });
    expect(await appendEvent('', ev(), SECRET)).toEqual({ ok: false, reason: 'no write credential is configured' });
  });
});
