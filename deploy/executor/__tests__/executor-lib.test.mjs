import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { expectedAttestation, decideExecution } from '../executor-lib.mjs';

const NOW = '2026-07-31T12:00:00Z';
const ok = { ok: true, approver: 'ross@b.capital' };

describe('the executor records what actually happened', () => {
  it('records a THROWING action as failed, never as executed', async () => {
    // Mutating this write to status:'executed' previously passed the whole suite: a send that threw
    // would have been recorded on the money surface as delivered.
    const out = await decideExecution({
      id: 'a1', proposal: { action_type: 'send' }, verify: ok, now: NOW,
      performAction: async () => { throw new Error('smtp refused'); },
    });
    expect(out.map((r) => r.status)).toEqual(['executing', 'failed']);
    expect(out.at(-1).reason).toMatch(/smtp refused/);
    expect(out.some((r) => r.status === 'executed')).toBe(false);
  });

  it('records intent BEFORE acting, so a crash cannot cause a silent re-run', async () => {
    const out = await decideExecution({
      id: 'a1', proposal: { action_type: 'send' }, verify: ok, now: NOW,
      performAction: async () => ({ performed: true }),
    });
    expect(out[0].status).toBe('executing');
    expect(out[1]).toMatchObject({ status: 'executed', approver: 'ross@b.capital' });
  });

  it('refuses an unverified grant without ever calling the action', async () => {
    let called = false;
    const out = await decideExecution({
      id: 'a1', proposal: {}, verify: { ok: false, reason: 'attestation invalid' }, now: NOW,
      performAction: async () => { called = true; return {}; },
    });
    expect(called).toBe(false);
    expect(out).toEqual([{ id: 'a1', status: 'rejected', reason: 'attestation invalid', executed_at: NOW }]);
  });
});

describe('the attestation formula matches the studio', () => {
  it('reproduces the pinned vector', () => {
    expect(expectedAttestation(createHmac, 'test-secret', 'wealthcx01/arca', 'appr-1', 'sha-abc', 'john@bruntsfield.capital'))
      .toBe('b02a016dc51aa1061e4d7406009724cb190d7f139f92d9fbdc028b3efe4113ac');
  });

  it('binds the venture, so a grant cannot be replayed from another repo', () => {
    expect(expectedAttestation(createHmac, 's', 'wealthcx01/arca', 'a', 'sha', 'x@y.com'))
      .not.toBe(expectedAttestation(createHmac, 's', 'wealthcx01/the-reset', 'a', 'sha', 'x@y.com'));
  });

  it('normalises the approver the same way the studio does', () => {
    expect(expectedAttestation(createHmac, 's', 'r', 'a', 'sha', '  X@Y.com '))
      .toBe(expectedAttestation(createHmac, 's', 'r', 'a', 'sha', 'x@y.com'));
  });
});
