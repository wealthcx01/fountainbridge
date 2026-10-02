import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadRunReports, stretchesOf, writtenAtFromName, type RunReportSource } from '../runreports';
import { buildFeed } from '../activity-feed';
import { historyScope } from '../history-scope';

/**
 * "What happened" told one line per stretch of work (FB-180).
 *
 * The fixture is ARCA's real run-report listing, 2026-10-01, reduced to its shape: 40 stretches of
 * one ticket each, with their real counts and their real first and last times. 10,198 reports in
 * all, 9,737 of them one ticket re-parked in an unbroken row since 27 August. The listing is rebuilt
 * from it name by name, so the loader sees what it sees in production.
 *
 * Why this shape and no smaller one: the fault only exists at this size. Reading the newest sixty
 * reports of ARCA finds sixty copies of the same park, collapses them to one row, and the page shows
 * one line about five weeks of work. Any fixture where the newest sixty are varied cannot see that.
 */

type Shape = { ticket: string; count: number; newest: string; oldest: string };
const SHAPE: Shape[] = JSON.parse(
  readFileSync(new URL('./fixtures/arca-run-stretches.json', import.meta.url), 'utf8'),
);

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ms = (s: string) => Date.parse(writtenAtFromName(`x-${s}.json`)!);

/** Every report name in the listing, the way the lane writes them. */
function listing(): string[] {
  const names: string[] = [];
  for (const s of SHAPE) {
    const hi = ms(s.newest);
    const lo = ms(s.oldest);
    for (let i = 0; i < s.count; i += 1) {
      const at = s.count === 1 ? hi : hi - Math.round(((hi - lo) * i) / (s.count - 1));
      names.push(`${s.ticket}-${stamp(at)}.json`);
    }
  }
  return names;
}

const venture = { id: 'arca', repos: ['arca'], departments: [{ id: 'build', repo: 'arca' }] } as never;

/** A source over that listing that counts what it opens. Every report says what ARCA's say. */
function source() {
  const names = listing();
  const opened: string[] = [];
  const src: RunReportSource = {
    async list(repo) { return repo === 'arca' ? names : []; },
    async read(_repo, name) {
      opened.push(name);
      const at = writtenAtFromName(name)!;
      const ticket = name.replace(/-\d{8}T\d{6}Z\.json$/, '');
      return ticket.startsWith('ARCA-061')
        ? { ticket, lane: 'arca', status: 'blocked', summary: 'Your team’s daily budget is used up — parked until tomorrow.', started: at, finished: at }
        : { ticket, lane: 'arca', status: 'opened_pr', summary: `Opened the work on ${ticket}.`, started: at, finished: at };
    },
  };
  return { src, opened, total: names.length };
}

describe('a stretch is an unbroken run of reports about one ticket', () => {
  it('ARCA’s ten thousand reports are forty stretches', () => {
    const names = listing();
    expect(names.length).toBe(10_198);
    const dated = names
      .map((name) => ({ name, at: writtenAtFromName(name) ?? '' }))
      .sort((a, b) => b.at.localeCompare(a.at));
    const stretches = stretchesOf(dated);
    expect(stretches.length).toBe(40);
    expect(stretches.map((s) => s.count).slice(0, 3)).toEqual([284, 67, 9_737]);
    // The long park started on 27 August, and only the listing knows that — nothing opened says so.
    expect(stretches[2].since).toBe('2026-08-27T22:20:58Z');
  });
});

describe('What happened, read one report per stretch', () => {
  it('opens one report per stretch, inside the same budget as before', async () => {
    const { src, opened } = source();
    const runs = await loadRunReports(venture, src, 20, 'stretches');
    expect(runs.stretches).toBe(40);
    expect(runs.reports.length).toBe(40);
    expect(opened.length, 'more files opened than the read budget allows').toBeLessThanOrEqual(60);
    expect(runs.reports.every((r) => r.stretch && r.stretch.count >= 1)).toBe(true);
  });

  it('still opens no more than its budget when there are more stretches than it can read', async () => {
    // ARCA has forty stretches, under the sixty-file budget, so the test above cannot see the cap.
    // A busy venture that moves between tickets has many more: here, 200 runs that each wrote a
    // start and a finish report, on alternating tickets — 400 reports, 200 stretches.
    const names: string[] = [];
    const start = Date.parse('2026-09-01T08:00:00Z');
    for (let i = 0; i < 200; i += 1) {
      const ticket = `ARCA-${String(100 + (i % 2)).padStart(3, '0')}-busy-work`;
      names.push(`${ticket}-${stamp(start + i * 600_000)}.json`, `${ticket}-${stamp(start + i * 600_000 + 60_000)}.json`);
    }
    const opened: string[] = [];
    const src: RunReportSource = {
      async list() { return names; },
      async read(_repo, name) {
        opened.push(name);
        const at = writtenAtFromName(name)!;
        return { ticket: name.replace(/-\d{8}T\d{6}Z\.json$/, ''), lane: 'arca', status: 'progress', summary: 'Worked on it.', started: at, finished: at };
      },
    };
    const runs = await loadRunReports(venture, src, 20, 'stretches');
    expect(runs.stretches).toBe(200);
    expect(opened.length, 'more files opened than the read budget allows').toBe(60);
    // Fewer stretches read than exist — the page must call itself a part of the record.
    expect(runs.reports.length).toBeLessThan(runs.stretches!);
  });

  it('tells five weeks of work, where reading the newest reports told one line', async () => {
    const before = await loadRunReports(venture, source().src, 20);
    const after = await loadRunReports(venture, source().src, 20, 'stretches');
    const rows = (reports: typeof before.reports) => buildFeed({ activity: [], runs: reports, approvals: [], limit: 20 }).items;

    // The fault, pinned: the newest sixty are all the one park, and they collapse to one row.
    expect(rows(before.reports).length).toBe(1);

    const story = rows(after.reports);
    expect(story.length).toBe(20);
    // No two neighbouring rows say the same thing.
    for (let i = 1; i < story.length; i += 1) expect(story[i].text).not.toBe(story[i - 1].text);
    // And the twentieth row is weeks back, not minutes.
    expect(story[story.length - 1].at < '2026-08-27').toBe(true);
    // The park says how big it is, instead of being twenty rows or one silent one.
    const park = story.find((r) => r.stretch?.count === 9_737);
    expect(park, 'the long park is not on the page').toBeDefined();
  });

  it('says that each line is a stretch, so "the 20 most recent" is not read as twenty reports', () => {
    const said = historyScope({
      ventureName: 'ARCA', shown: 20, total: 10_198, earliest: '2026-07-31T15:53:31Z',
      oldestShown: '2026-08-19T14:20:25Z', bounded: true, byStretch: true,
    });
    expect(said).toContain('works on one ticket many times in a row, that is one line');
    // And only then: the desk's own sentence, over rows that are reports, must not claim it.
    expect(historyScope({
      ventureName: 'ARCA', shown: 20, total: 10_198, earliest: '2026-07-31T15:53:31Z',
      oldestShown: '2026-08-19T14:20:25Z', bounded: true,
    })).not.toContain('in a row');
  });
});
