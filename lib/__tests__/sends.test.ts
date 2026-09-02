import { describe, it, expect } from 'vitest';
import { sends, lastSend, sellOutcome, outboxUrl } from '../sends';
import type { ActiveGraphApproval } from '../approvals';

/**
 * What happened to what went out (FB-142).
 *
 * The design asks for *"41 delivered · 29 opened · 3 replied"*. Two of those three cannot be
 * obtained from the ratified architecture, and the point of these tests is that the studio says so
 * rather than printing a zero for them.
 */
const approval = (over: Partial<ActiveGraphApproval> = {}): ActiveGraphApproval => ({
  id: 'a1', kind: 'activegraph', ventureId: 'arca', repo: 'arca-marketing',
  status: 'executed', proposalSha: null, ticket: null, department: 'sell',
  actionType: 'send', summary: 'September update to 41 signups',
  checks: [], amountMinor: null, priceUnreadable: false, currency: null,
  committedAt: '2026-09-01T09:00:00Z', budget: null, outcome: null,
  grantProvenance: 'attested', provenance: null, approver: null, grantedAt: null,
  ...over,
});

describe('which approvals are sends', () => {
  it('counts sends and not posts', () => {
    const list = [approval(), approval({ id: 'a2', actionType: 'post' })];
    expect(sends(list).map((s) => s.id)).toEqual(['a1']);
  });

  it('ignores a send still waiting for a decision', () => {
    // "Last send" is about what went out. Something at the gate has not gone anywhere.
    expect(sends([approval({ status: 'proposed' })])).toEqual([]);
    expect(sends([approval({ status: 'granted' })])).toEqual([]);
  });

  it('keeps a send that FAILED, and one that cannot be verified', () => {
    // The single most important thing on this surface. A "last send" line that quietly skipped to
    // the last SUCCESSFUL one would hide exactly the event a founder must see (CLAUDE.md #10).
    expect(sends([approval({ status: 'failed' })])[0].outcome).toBe('failed');
    expect(sends([approval({ status: 'unverified-action' })])[0].outcome).toBe('unverified');
  });

  it('is newest first, whatever order they were read in', () => {
    const list = [
      approval({ id: 'old', committedAt: '2026-08-01T09:00:00Z' }),
      approval({ id: 'new', committedAt: '2026-09-01T09:00:00Z' }),
    ];
    expect(lastSend(list)?.id).toBe('new');
    expect(lastSend([...list].reverse())?.id).toBe('new');
  });

  it('is null when nothing has ever been sent', () => {
    expect(lastSend([])).toBeNull();
    expect(lastSend([approval({ actionType: 'post' })])).toBeNull();
  });
});

describe('what the Sell surface says', () => {
  const now = '2026-09-01T09:00:00Z';

  it('says what went and when, and says the rest is NOT reported', () => {
    // Sourced or silent. Two thirds of the design's line cannot be obtained from the Gmail API
    // without a read scope or a tracking pixel, and inventing them is the one thing forbidden here.
    const line = sellOutcome({ id: 'a1', repo: 'r', summary: 'September update to 41 signups', at: now, outcome: 'sent' }, 3);
    expect(line).toContain('September update to 41 signups');
    expect(line).toContain('not reported');
  });

  it('never prints a number the studio does not have', () => {
    const line = sellOutcome({ id: 'a1', repo: 'r', summary: 'September update', at: now, outcome: 'sent' }, 3);
    expect(line, 'a delivered/opened/replied count appeared from nowhere').not.toMatch(/\b\d+ (delivered|opened|replied)/);
    expect(line).not.toMatch(/\b0 /);
  });

  it('leads with a failure rather than burying it', () => {
    const line = sellOutcome({ id: 'a1', repo: 'r', summary: 'September update', at: now, outcome: 'failed' }, 3);
    expect(line).toMatch(/^Last send did not go out/);
    expect(line).toContain('Nothing left the building');
  });

  it('says when a send went out on an approval it cannot verify', () => {
    const line = sellOutcome({ id: 'a1', repo: 'r', summary: 'September update', at: now, outcome: 'unverified' }, 3);
    expect(line).toContain('cannot verify');
  });

  it('invites a first send rather than reporting nothing', () => {
    expect(sellOutcome(null, 0)).toContain('Nothing has been sent yet');
    expect(sellOutcome(null, 3)).toContain('3 tickets');
  });

  it('does not guess a time it does not have', () => {
    const line = sellOutcome({ id: 'a1', repo: 'r', summary: 'x', at: null, outcome: 'sent' }, 1);
    expect(line).toContain('unrecorded time');
  });
});

describe('the outbox link', () => {
  it('opens the venture’s own sent view', () => {
    expect(outboxUrl('ross@thereset.co')).toBe('https://mail.google.com/mail/u/ross%40thereset.co/#sent');
  });

  it('is absent rather than pointing at somebody’s personal inbox', () => {
    expect(outboxUrl(null)).toBeNull();
    expect(outboxUrl('  ')).toBeNull();
    expect(outboxUrl('not-an-address')).toBeNull();
  });
});
