import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { canonicalEvent, type ActiveGraphEvent } from '../activegraph';
// The executor is plain ESM on a box, with no types — importing it here is the point: this file is
// the seam between the two runtimes, so it has to load the real module, not a typed stand-in.
// @ts-expect-error — untyped .mjs, deliberately loaded as-is
import { canonicalEvent as executorCanonical, signEvent as executorSign, eventsForExecution } from '../../deploy/executor/executor-lib.mjs';

vi.mock('server-only', () => ({}));

/**
 * The studio and the executor sign ActiveGraph events with the same formula in two runtimes
 * (TypeScript in the studio, plain ESM on the executor box). This file is the seam between them.
 *
 * A drift here does not fail loudly — it makes every event the executor writes read as *forged* to
 * the studio, so a founder would see "something was recorded here that the studio would not accept"
 * on every real send, and the true story would be missing. The same class of hazard as the grant
 * attestation, which is pinned the same way in approval-attestation.test.ts.
 */

const EVENT: ActiveGraphEvent = {
  v: 1, seq: 3, venture: 'arca', repo: 'wealthcx01/arca-marketing', id: 'send-001',
  type: 'action.executed', at: '2026-07-31T12:00:00Z',
  actor: { kind: 'executor', id: 'foundry-executor' },
  data: { reason: 'none', result: 'ok' },
};

describe('one formula, two runtimes', () => {
  it('produces the same canonical string on both sides', () => {
    expect(executorCanonical(EVENT)).toBe(canonicalEvent(EVENT));
  });

  it('is pinned to a known vector, so a change to either side has to be deliberate', () => {
    // Change the format and you change lib/activegraph.ts, deploy/executor/executor-lib.mjs and this
    // line, in one commit.
    expect(canonicalEvent(EVENT)).toBe(
      '1|3|arca|wealthcx01/arca-marketing|send-001|action.executed|2026-07-31T12:00:00Z|executor|foundry-executor|reason=none&result=ok',
    );
  });

  it('signs identically, so the studio verifies what the executor wrote', async () => {
    const { signEvent } = await import('../activegraph-log');
    expect(executorSign(createHmac, 'shared-secret', EVENT)).toBe(signEvent(EVENT, 'shared-secret'));
  });

  it('sorts data keys the same way on both sides', () => {
    const scrambled = { ...EVENT, data: { result: 'ok', reason: 'none' } };
    expect(executorCanonical(scrambled)).toBe(canonicalEvent(EVENT));
  });
});

describe('what the executor records', () => {
  const args = { venture: 'arca', repo: 'wealthcx01/arca-marketing', id: 'send-001', startSeq: 3, now: '2026-07-31T12:00:00Z' };

  it('turns a successful run into a start and a finish, numbered in order', () => {
    const events = eventsForExecution({
      ...args,
      records: [{ id: 'send-001', status: 'executing' }, { id: 'send-001', status: 'executed' }],
    });
    expect(events.map((e: ActiveGraphEvent) => [e.seq, e.type])).toEqual([[3, 'action.executing'], [4, 'action.executed']]);
    expect(events.every((e: ActiveGraphEvent) => e.actor.kind === 'executor')).toBe(true);
  });

  it('records a failure as a failure, carrying the reason', () => {
    // Before FB-051 nothing wrote `failed` at all, and a mutation that turned the failure write into
    // `executed` passed the whole suite — a send that threw displayed as delivered.
    const events = eventsForExecution({
      ...args,
      records: [{ id: 'x', status: 'executing' }, { id: 'x', status: 'failed', reason: 'the mail provider refused it' }],
    });
    expect(events[1].type).toBe('action.failed');
    expect(events[1].data?.reason).toContain('mail provider');
  });

  it('writes nothing for an approval whose grant did not verify', () => {
    // There is no approved action to narrate, and inventing one would put a story on the record for
    // something that never happened.
    expect(eventsForExecution({ ...args, records: [{ id: 'x', status: 'rejected', reason: 'bad attestation' }] })).toEqual([]);
  });

  it('never emits a grant, whatever it is handed', () => {
    // The executor holds the signing secret, so this is the one place a valid-looking forged grant
    // could come from. It cannot: there is no path from an execution record to `approval.granted`,
    // and the projection would refuse it anyway.
    const events = eventsForExecution({
      ...args,
      records: [{ id: 'x', status: 'granted' }, { id: 'x', status: 'executing' }],
    });
    expect(events.map((e: ActiveGraphEvent) => e.type)).toEqual(['action.executing']);
  });
});
