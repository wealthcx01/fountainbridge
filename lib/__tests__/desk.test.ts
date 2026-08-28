import { describe, it, expect } from 'vitest';
import {
  blockerLine, degradedGroups, deskSummary, surfaceOutcome, waitingOnFounder, type DeskFacts,
} from '../desk';

/**
 * The desk's sentences (FB-128).
 *
 * The load-bearing property is that one number reaches three surfaces — the summary, the banner and
 * the rail's badge. FB-099 is what happens when it does not: a badge saying 15 over columns saying 0.
 */

const facts = (over: Partial<DeskFacts> = {}): DeskFacts => ({
  openWork: 2,
  awaitingApproval: 1,
  movingTickets: 2,
  spentMinor: 22000,
  limitMinor: 70000,
  currency: 'GBP',
  degraded: false,
  ...over,
});

describe('the one number three surfaces read', () => {
  it('counts finished work AND external actions waiting', () => {
    // A badge that counted finished work and quietly left out a proposed send would tell a founder
    // they were clear while an email sat waiting for their word.
    expect(waitingOnFounder({ openWork: 2, awaitingApproval: 1 })).toBe(3);
  });

  it('is zero when nothing is waiting', () => {
    expect(waitingOnFounder({ openWork: 0, awaitingApproval: 0 })).toBe(0);
  });

  it('is the number the summary and the banner both use', () => {
    const f = facts();
    expect(deskSummary(f)).toContain('3 decisions wait on you');
    expect(blockerLine({ ...f, oldestMs: 3 * 86_400_000 })).toContain('3 items');
  });
});

describe('the summary sentence', () => {
  it('reads as the design writes it', () => {
    // `formatMoney` already drops a bare .00, which is how the design writes it too.
    expect(deskSummary(facts())).toBe(
      '3 decisions wait on you; your team is on 2 moving tickets, and £220 of £700 is spent this month.',
    );
  });

  it('says nothing waits rather than “0 decisions”', () => {
    const s = deskSummary(facts({ openWork: 0, awaitingApproval: 0 }));
    expect(s).toMatch(/^Nothing waits on you/);
    expect(s).not.toContain('0 decision');
  });

  it('drops the clauses that are not true rather than reporting zeroes', () => {
    // A founder on day one should read one short sentence, not three clauses of zeroes dressed as
    // a report.
    const s = deskSummary(facts({ openWork: 0, awaitingApproval: 0, movingTickets: 0, limitMinor: null, spentMinor: null, currency: null }));
    expect(s).toBe('Nothing waits on you.');
  });

  it('is singular when there is one of a thing', () => {
    const s = deskSummary(facts({ openWork: 1, awaitingApproval: 0, movingTickets: 1 }));
    expect(s).toContain('1 decision waits on you');
    expect(s).toContain('1 moving ticket');
  });

  it('says so when it was composed over a picture it could not fully read', () => {
    // The difference between "nothing to report" and "cannot tell". Never a calm summary over a
    // partial read.
    expect(deskSummary(facts({ degraded: true }))).toContain('could not be read');
  });

  it('says nothing about money when no limit is set', () => {
    expect(deskSummary(facts({ limitMinor: 0 }))).not.toContain('spent this month');
    expect(deskSummary(facts({ currency: null }))).not.toContain('spent this month');
  });
});

describe('the blocker banner', () => {
  it('names the founder as the blocker, and how long the oldest has waited', () => {
    expect(blockerLine({ openWork: 3, awaitingApproval: 0, oldestMs: 3 * 86_400_000 }))
      .toBe('You are the blocker on 3 items; the oldest has waited 3 days.');
  });

  it('says what KIND of thing is waiting when there is more than one', () => {
    // A read and an external action want different things from a founder, and the difference is
    // what tells them which to open first. This sentence used to live in the brief's headline —
    // one amber line carrying it beats a second block restating the same number.
    expect(blockerLine({ openWork: 4, awaitingApproval: 4, oldestMs: 44 * 86_400_000 })).toBe(
      'You are the blocker on 8 items — 4 pieces of finished work to read and 4 actions that would '
      + 'go outside the company; the oldest has waited 44 days.',
    );
  });

  it('does not spell out a breakdown of one kind', () => {
    expect(blockerLine({ openWork: 3, awaitingApproval: 0, oldestMs: null })).not.toContain('—');
  });

  it('does not appear when nothing is waiting', () => {
    expect(blockerLine({ openWork: 0, awaitingApproval: 0, oldestMs: null })).toBeNull();
  });

  it('reads in hours before it reads in days', () => {
    expect(blockerLine({ openWork: 1, awaitingApproval: 0, oldestMs: 5 * 3_600_000 }))
      .toContain('the oldest has waited 5 hours');
  });

  it('does not say “0 days” for something that just arrived', () => {
    expect(blockerLine({ openWork: 1, awaitingApproval: 0, oldestMs: 60_000 }))
      .toContain('arrived just now');
  });

  it('still names the count when it cannot tell the age', () => {
    expect(blockerLine({ openWork: 2, awaitingApproval: 0, oldestMs: null }))
      .toBe('You are the blocker on 2 items.');
  });
});

describe('the degraded strip', () => {
  it('says one thing once, however many repositories hit it', () => {
    const groups = degradedGroups([
      { where: 'arca', message: 'GitHub is rate limiting reads.' },
      { where: 'arca-site', message: 'rate-limited' },
      { where: 'arca-ops', message: 'GitHub is rate limiting reads.' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].where).toEqual(['arca', 'arca-site', 'arca-ops']);
  });

  it('keeps genuinely different causes apart', () => {
    const groups = degradedGroups([
      { where: 'arca', message: 'GitHub is rate limiting reads.' },
      { where: 'arca-ops', message: 'The studio is not allowed to read this.' },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('passes through a message it has no better words for', () => {
    // Never swallowed and never re-worded into something vaguer than what actually happened.
    const groups = degradedGroups([{ where: null, message: 'The state ref could not be read.' }]);
    expect(groups[0].cause).toBe('The state ref could not be read.');
    expect(groups[0].where).toEqual([]);
  });

  it('is empty when nothing failed', () => {
    expect(degradedGroups([])).toEqual([]);
    expect(degradedGroups([{ where: 'arca', message: '   ' }])).toEqual([]);
  });
});

describe('the company, by surface', () => {
  it('says what Build actually has, because Build’s line is true today', () => {
    expect(surfaceOutcome({ departmentId: 'build', ticketCount: 14, hasPreview: true }))
      .toBe('14 tickets · preview of the app running from the venture machine.');
  });

  it('does not promise a preview a venture has not declared', () => {
    expect(surfaceOutcome({ departmentId: 'build', ticketCount: 14, hasPreview: false }))
      .not.toContain('preview of the app running');
  });

  it('says Sell has reported nothing rather than “0 delivered”', () => {
    // Nothing having reported and nothing having happened are different facts, and only one of them
    // is true. There is no analytics source in the studio at all (decision-surface-outcomes.md).
    const line = surfaceOutcome({ departmentId: 'sell', ticketCount: 2, hasPreview: false });
    expect(line).toContain('Nothing reported yet');
    expect(line).not.toMatch(/\b0 (delivered|opened|replied)/);
  });

  it('says Scale is not connected, and counts what waits on it', () => {
    expect(surfaceOutcome({ departmentId: 'scale', ticketCount: 1, hasPreview: false }))
      .toBe('Not connected · platform tbd. 1 ticket waiting on it.');
  });

  it('never renders a zero as though it were a measurement', () => {
    for (const departmentId of ['build', 'sell', 'scale']) {
      expect(surfaceOutcome({ departmentId, ticketCount: 0, hasPreview: false })).toContain('No tickets yet');
    }
  });
});
