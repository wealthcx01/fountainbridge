import { describe, it, expect } from 'vitest';
import { buildOffice, deskDoing, officeSummary, type OfficeInput } from '../office';
import type { RunReport } from '../runreports';
import type { PrApproval } from '../attention';

/**
 * The office (FB-139).
 *
 * The design's constraint is the ticket: *"The office is the feeling; this ledger is the record.
 * Same events, so they cannot disagree."* These test the one array both are drawn from — and, above
 * all, the states it must never confuse.
 */

const dept = (id: string, repo: string | null = id) =>
  ({ id, name: id.toUpperCase(), repo, provisioned: repo !== null });

const run = (over: Partial<RunReport> = {}): RunReport => ({
  laneId: 'build',
  startedAt: '2026-07-22T09:00:00Z',
  endedAt: '2026-07-22T09:05:00Z',
  trigger: 'scheduled',
  outcome: 'progress',
  summaryMd: '# Worked the deck link\n\nMore words.',
  ticketsTouched: ['ARCA-5'],
  errorDetail: null,
  prUrl: null,
  repo: 'build',
  isHeartbeat: false,
  ...over,
});

const waiting = (repo: string): PrApproval => ({ repo } as PrApproval);

const input = (over: Partial<OfficeInput> = {}): OfficeInput => ({
  departments: [dept('build'), dept('sell'), dept('scale', null)],
  runs: [],
  waiting: [],
  engine: { state: 'running', text: 'Your team checked in 2 minutes ago.' },
  ...over,
});

describe('what each desk is doing', () => {
  it('is working while a report has not ended', () => {
    // An in-flight run report IS "this agent is working right now" — the feed the box already
    // publishes, rather than a second one invented for the picture.
    const o = buildOffice(input({ runs: [run({ repo: 'build', endedAt: null })] }));
    const build = o.desks.find((d) => d.departmentId === 'build')!;
    expect(build.state).toBe('working');
    expect(build.doing).toBe('Worked the deck link');
    expect(build.ticketId).toBe('ARCA-5');
    expect(build.since).toBe('2026-07-22T09:00:00Z');
  });

  it('raises a hand for work waiting on the founder, and that is not idle', () => {
    // "Finished and blocked on a person" and "nothing to do" look identical in a still room, and
    // they are the two things a founder most needs to tell apart.
    const o = buildOffice(input({ waiting: [waiting('sell'), waiting('sell')] }));
    const sell = o.desks.find((d) => d.departmentId === 'sell')!;
    expect(sell.state).toBe('waiting-on-you');
    expect(sell.waitingOnYou).toBe(2);
    expect(deskDoing(sell)).toBe('Finished — 2 things waiting on you.');
  });

  it('does not answer "doing, right now" in the past tense', () => {
    // A finished report's summary describes what the agent DID. The ledger's column asks what it is
    // doing, and the honest answer for a settled desk is that nothing is on.
    const o = buildOffice(input({ runs: [run({ repo: 'build' })] }));
    const build = o.desks.find((d) => d.departmentId === 'build')!;
    expect(build.state).toBe('idle');
    expect(build.doing).toBeNull();
    expect(deskDoing(build)).toBe('Nothing on right now.');
  });

  it('empties every chair when the machine stops, rather than freezing the scene', () => {
    // A still room reads as a team sitting idle. The truth is that nobody is reporting, and that is
    // the most convincing lie this surface could tell.
    const o = buildOffice(input({
      runs: [run({ repo: 'build', endedAt: null })],
      waiting: [waiting('sell')],
      engine: { state: 'stalled', text: 'Your team has not checked in for 41 days.' },
    }));
    expect(o.live).toBe(false);
    expect(o.desks.map((d) => d.state)).toEqual(['not-live', 'not-live', 'not-live']);
    // Including the one that WAS mid-wake — a report in flight from before the machine stopped is
    // not evidence that anything is happening now.
    expect(o.desks[0].doing).toBeNull();
    expect(officeSummary(o)).toBe('Your team has not checked in for 41 days.');
  });

  it('says nothing about a surface with no machine behind it yet', () => {
    const o = buildOffice(input());
    expect(o.desks.find((d) => d.departmentId === 'scale')!.state).toBe('idle');
  });

  it('takes the NEWEST report for a surface, whatever order they arrived in', () => {
    // Reports are read per repository in whatever order the directory listed them, and "what is this
    // agent doing right now" must not depend on that.
    const o = buildOffice(input({
      runs: [
        run({ repo: 'build', startedAt: '2026-07-22T11:00:00Z', endedAt: null, summaryMd: 'Newest' }),
        run({ repo: 'build', startedAt: '2026-07-22T09:00:00Z', endedAt: null, summaryMd: 'Oldest' }),
      ],
    }));
    expect(o.desks[0].doing).toBe('Newest');
  });

  it('ignores heartbeats — they are the machine, not an agent', () => {
    const o = buildOffice(input({ runs: [run({ repo: 'build', endedAt: null, isHeartbeat: true })] }));
    expect(o.desks[0].state).toBe('idle');
  });
});

describe('the plate and the ledger cannot disagree', () => {
  it('is one array, and every desk has both a state and a sentence', () => {
    // The design's constraint, made mechanical: there is no second list to get wrong. What this can
    // still assert is that the one list is complete — every desk the plate draws has a row, and
    // every row says something rather than rendering blank.
    const o = buildOffice(input({
      runs: [run({ repo: 'build', endedAt: null })],
      waiting: [waiting('sell')],
    }));
    expect(o.desks).toHaveLength(3);
    for (const desk of o.desks) {
      expect(desk.name, 'a character with no name in the ledger').toBeTruthy();
      expect(deskDoing(desk), `${desk.departmentId} renders a blank row`).not.toBe('');
    }
    // And the states the plate draws are exactly the states the ledger carries.
    expect(o.desks.map((d) => d.state)).toEqual(['working', 'waiting-on-you', 'idle']);
  });

  it('counts the hands the same way the blocker banner counts them', () => {
    // A raised hand must mean the same thing as the amber banner, or the plate is a second opinion.
    const o = buildOffice(input({ waiting: [waiting('build'), waiting('sell'), waiting('sell')] }));
    expect(o.desks.reduce((n, d) => n + d.waitingOnYou, 0)).toBe(3);
  });
});

describe('the line under the plate', () => {
  it('counts THINGS waiting, the same total the blocker banner states', () => {
    // It counted desks, and read "3 waiting on you" over a ledger whose rows added to six. Two
    // numbers on one screen that appear to disagree — and the smaller one was the reassuring one,
    // on the count a founder acts on.
    const o = buildOffice(input({
      waiting: [waiting('build'), waiting('build'), waiting('build'), waiting('sell'), waiting('sell')],
    }));
    expect(o.desks.filter((d) => d.state === 'waiting-on-you')).toHaveLength(2);
    expect(officeSummary(o)).toBe('5 things waiting on you.');
  });

  it('counts who is working and who has a hand up', () => {
    const o = buildOffice(input({
      runs: [run({ repo: 'build', endedAt: null })],
      waiting: [waiting('sell')],
    }));
    expect(officeSummary(o)).toBe('1 working, 1 thing waiting on you.');
  });

  it('says a quiet office is quiet, without pretending it is broken', () => {
    expect(officeSummary(buildOffice(input()))).toBe('Nobody is working and nobody is waiting on you.');
  });
});
