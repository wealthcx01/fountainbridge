import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { historyScope, readWasBounded } from '../history-scope';

/**
 * A screen may not claim a completeness it does not have (FB-242).
 *
 * The fault, in one line of rendered copy: *"Everything ARCA did since 30 September 2026"* — today's
 * date, on a venture with 9,889 run reports going back five weeks, with no caveat on the screen.
 */

const ROOT = join(import.meta.dirname, '..', '..');

const base = {
  ventureName: 'ARCA',
  shown: 1,
  bounded: true,
  total: 9_889,
  earliest: '2026-08-24T09:00:00Z',
  oldestShown: '2026-09-30T21:35:00Z',
};

describe('what a partly-read record may say about itself', () => {
  it('never calls the oldest row the start of the history when there is more behind it', () => {
    // The exact regression. ARCA's numbers, ARCA's dates.
    const said = historyScope(base)!;
    expect(said, 'the page still claims to show everything').not.toMatch(/^Everything/);
    expect(said, 'the page still presents the oldest row as the start of the record')
      .not.toMatch(/did since 30 September/);
  });

  it('leads with what exists, so a founder learns five weeks happened', () => {
    // The point of the ticket. Honest and useless would still be a failure: the founder has to be
    // able to tell the venture did not begin this morning.
    const said = historyScope(base)!;
    expect(said).toContain('9,889');
    expect(said).toContain('24 August 2026');
    expect(said).toContain('30 September 2026');
  });

  it('says "everything" only when the read actually reached the end', () => {
    const said = historyScope({ ...base, shown: 12, total: 12, bounded: false })!;
    expect(said).toBe('Everything ARCA did since 30 September 2026, newest first.');
  });

  it('treats one short of the total as bounded — the off-by-one that would reopen this', () => {
    expect(historyScope({ ...base, shown: 11, total: 12, bounded: true })!).not.toMatch(/^Everything/);
    expect(readWasBounded(11, 12)).toBe(true);
    expect(readWasBounded(12, 12)).toBe(false);
  });

  it('never invents a date it was not given', () => {
    const noDates = historyScope({ ...base, earliest: null, oldestShown: null })!;
    expect(noDates).toContain('9,889');
    expect(noDates, 'a month name appeared with no timestamp behind it')
      .not.toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
  });

  it('says nothing at all when nothing was recorded, rather than "everything since null"', () => {
    expect(historyScope({ ...base, shown: 0, total: 0 })).toBeNull();
    expect(historyScope({ ...base, shown: 0, total: 9_889 })).toBeNull();
  });

  it('writes a number of reports, not a number of "things"', () => {
    // `total` counts run reports; `shown` counts rows, which also include decisions and changes.
    // Calling both "things" implied they were the same kind of number.
    expect(historyScope(base)!).toContain('9,889 reports');
  });

  it('does not write "the 1 most recent", which is not a sentence a person writes', () => {
    expect(historyScope(base)!).toContain('shows the most recent,');
    expect(historyScope(base)!).not.toContain('the 1 most recent');
    expect(historyScope({ ...base, shown: 4 })!).toContain('the 4 most recent');
  });

  it('reads one report as singular', () => {
    expect(historyScope({ ...base, shown: 1, total: 2 })!).toContain('2 reports');
    expect(historyScope({ ...base, shown: 1, total: 1, bounded: false })!).toMatch(/^Everything/);
  });
});

describe('what the record is mostly about', () => {
  it('says so when one ticket dominates — the count alone hid ARCA\'s real story', () => {
    // ARCA's actual numbers, read off its state ref on 2026-09-30: 9,738 of 9,904 reports are the
    // lane re-parking on one ticket since July. "Your team has written 9,895 reports" is true and
    // reads like steady progress.
    const said = historyScope({ ...base, total: 9_904, busiest: { ticket: 'ARCA-061', count: 9_738 } })!;
    expect(said).toContain('9,738 of them are about one ticket, ARCA-061');
  });

  it('stays quiet when no ticket dominates, rather than naming whichever came first', () => {
    const said = historyScope({ ...base, busiest: null })!;
    expect(said).not.toContain('one ticket');
    expect(historyScope({ ...base })!).not.toContain('one ticket');
  });
});

describe('the bound is on the record, not on the last step', () => {
  it('is bounded when twenty reports collapse to one row', () => {
    // The precise shape of the bug: nothing was dropped by the final step, and 9,869 things are
    // still missing. A check that asked "did I drop a row?" answered no.
    expect(readWasBounded(1, 9_889)).toBe(true);
  });

  it('the activity screen decides its caveat from the record, not from buildFeed', () => {
    // Structural, because the fault was a page asking the wrong question and getting a true answer.
    // If someone wires the footer back to `truncated`, this fails.
    const src = readFileSync(join(ROOT, 'app', 'venture', '[id]', 'activity', 'page.tsx'), 'utf8');
    expect(src, 'the caveat is back on buildFeed’s truncated flag').not.toMatch(/\{truncated \?/);
    expect(src, 'the screen no longer states its bound from the record').toMatch(/\{bounded \?/);
    expect(src, 'the screen no longer asks the record how large it is').toMatch(/runs\.total/);
  });
});

describe('characterising the record costs no extra read', () => {
  it('finds the dominant ticket from filenames alone', async () => {
    const { dominantTicket, ticketFromName } = await import('../runreports');
    expect(ticketFromName('ARCA-061-saved-card-lists-20260930T214500Z.json'))
      .toBe('ARCA-061-saved-card-lists');
    expect(ticketFromName('_heartbeat.json'), 'a name with no stamp has no ticket').toBeNull();

    // ARCA's shape: one ticket, overwhelmingly.
    const names = [
      ...Array.from({ length: 97 }, (_, i) => `ARCA-061-stuck-2026093${i % 10}T000000Z.json`),
      ...Array.from({ length: 3 }, (_, i) => `ARCA-055-news-2026093${i}T000000Z.json`),
    ];
    expect(dominantTicket(names, 100)).toEqual({ ticket: 'ARCA-061-stuck', count: 97 });
  });

  it('names nobody when the work is spread across tickets', () => {
    // A healthy venture has no such number, and a screen must not go looking for a villain.
    const names = Array.from({ length: 20 }, (_, i) => `ARCA-${i}-work-20260930T00000${i % 10}Z.json`);
    return import('../runreports').then(({ dominantTicket }) => {
      expect(dominantTicket(names, 20)).toBeNull();
    });
  });

  it('needs MORE than half, so an exact tie names nobody', () => {
    return import('../runreports').then(({ dominantTicket }) => {
      const half = [
        ...Array.from({ length: 5 }, (_, i) => `A-a-2026093${i}T000000Z.json`),
        ...Array.from({ length: 5 }, (_, i) => `B-b-2026093${i}T000000Z.json`),
      ];
      expect(dominantTicket(half, 10)).toBeNull();
      expect(dominantTicket([...half, 'A-a-20260939T000000Z.json'], 11))
        .toEqual({ ticket: 'A-a', count: 6 });
    });
  });
});

describe('a ticket is named the way a person would say it', () => {
  it('splits the id from the words', async () => {
    const { ticketInWords } = await import('../history-scope');
    expect(ticketInWords('ARCA-061-saved-card-lists-not-persisting'))
      .toBe('ARCA-061 — saved card lists not persisting');
  });

  it('leaves a name it cannot parse alone rather than mangling it', async () => {
    const { ticketInWords } = await import('../history-scope');
    // Better shown than swallowed.
    expect(ticketInWords('seed-script-silent-failure')).toBe('seed-script-silent-failure');
  });

  it('reaches the rendered sentence', () => {
    const said = historyScope({
      ...base, total: 9_904, busiest: { ticket: 'ARCA-061-saved-card-lists-not-persisting', count: 9_738 },
    })!;
    expect(said).toContain('ARCA-061 — saved card lists not persisting');
    expect(said, 'the raw filename slug reached the screen').not.toContain('061-saved-card');
  });
});
