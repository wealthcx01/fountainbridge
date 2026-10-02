import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { expectedAttestation, decideExecution, graphGateMode, combineGates, parseGraphVerdict } from '../executor-lib.mjs';

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

describe('the ActiveGraph gate (FB-171)', () => {
  const fileYes = { ok: true, approver: 'ross@b.capital' };
  const fileNo = { ok: false, reason: 'grant attestation is missing or invalid' };
  const graphYes = { ok: true, approver: 'Ross@B.capital', reason: '', retry: false };
  const graphWaiting = { ok: false, approver: null, reason: 'nobody has approved it yet', retry: true };
  const graphRefused = { ok: false, approver: null, reason: 'it was refused by ross@b.capital', retry: false };

  it('is off unless someone turns it on, and a typo turns it fully on rather than off', () => {
    expect(graphGateMode(undefined)).toBe('off');
    expect(graphGateMode('')).toBe('off');
    expect(graphGateMode('shadow')).toBe('shadow');
    expect(graphGateMode('enforce')).toBe('enforce');
    expect(graphGateMode('enforced')).toBe('enforce');
    expect(graphGateMode('of')).toBe('enforce');
  });

  it('off: changes nothing about today', () => {
    expect(combineGates({ mode: 'off', file: fileYes, graph: graphRefused })).toEqual({ verify: fileYes, skip: false, note: null });
  });

  it('shadow: only the grant file decides, and a disagreement is said out loud', () => {
    const r = combineGates({ mode: 'shadow', file: fileYes, graph: graphRefused });
    expect(r.verify).toBe(fileYes);
    expect(r.skip).toBe(false);
    expect(r.note).toMatch(/SHADOW DISAGREEMENT/);
    expect(combineGates({ mode: 'shadow', file: fileYes, graph: graphYes }).note).toBeNull();
  });

  it('enforce: sends only when both say yes, for the same person', () => {
    expect(combineGates({ mode: 'enforce', file: fileYes, graph: graphYes })).toEqual({ verify: fileYes, skip: false, note: null });
    const other = combineGates({ mode: 'enforce', file: fileYes, graph: { ...graphYes, approver: 'someone@else.com' } });
    expect(other.verify.ok).toBe(false);
    expect(other.skip).toBe(false);
  });

  it('enforce: a refusal in ActiveGraph stops a send the grant file would allow (FB-183)', () => {
    const r = combineGates({ mode: 'enforce', file: fileYes, graph: graphRefused });
    expect(r.verify.ok).toBe(false);
    expect(r.verify.reason).toMatch(/refused/);
    expect(r.skip).toBe(false);
  });

  it('enforce: waits, rather than sends or closes, when ActiveGraph is behind or unreachable', () => {
    expect(combineGates({ mode: 'enforce', file: fileYes, graph: graphWaiting }).skip).toBe(true);
    expect(combineGates({ mode: 'enforce', file: fileYes, graph: null }).skip).toBe(true);
  });

  it('enforce: can never turn an unsigned grant into a yes', () => {
    const r = combineGates({ mode: 'enforce', file: fileNo, graph: graphYes });
    expect(r.verify).toBe(fileNo);
    expect(r.skip).toBe(false);
  });

  it('reads an unreadable answer as "wait", never as "yes"', () => {
    expect(parseGraphVerdict('Traceback (most recent call last):')).toMatchObject({ ok: false, retry: true });
    expect(parseGraphVerdict('')).toMatchObject({ ok: false, retry: true });
    expect(parseGraphVerdict('{"ok":"true","approver":"x"}')).toMatchObject({ ok: false, retry: true });
    expect(parseGraphVerdict('{"ok":true,"approver":"x@y.com","reason":"a person approved exactly this","retry":false}'))
      .toEqual({ ok: true, approver: 'x@y.com', reason: 'a person approved exactly this', retry: false });
  });
});
