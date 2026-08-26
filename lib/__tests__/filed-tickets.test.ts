import { describe, it, expect } from 'vitest';
import {
  filedTicketPath,
  filingPrs,
  loadFiledTickets,
  withoutAlreadyOnBoard,
  ticketIdsOnBoard,
  loadFiledForLanes,
  type BranchFileReader,
} from '../filed-tickets';
import type { RawPr } from '../attention';
import type { TicketStatusGroup, TicketWithMeta } from '../tickets';
import { parseTicket } from '../../tools/ticket-parser/src/index';

/**
 * The board has to show a founder the work they just approved (FB-120).
 *
 * The run these are written from: five tickets filed and approved through the composer, and a board
 * that carried on showing 67. The pull requests were visible, matched nothing, and rendered as a
 * number and a title — so the scope and the acceptance criteria the founder had just read in plain
 * English and said yes to were reachable only by opening GitHub.
 */

const ticket = (id: string, title = 'Research auction sources') => `
# ${id} — ${title}

**Status:** Todo · **Area:** Research/Auctions · **Depends on:** —

## Why this matters (for the founder)
So we build against real access rather than assumptions.

## Scope
- Find out which auction houses expose a usable feed.

## Acceptance criteria
- [ ] Written findings with sources.
`;

const pr = (over: Partial<RawPr> = {}): RawPr => ({
  number: 58,
  title: 'Research: which auction houses we can pull from',
  url: 'https://github.com/wealthcx01/arca/pull/58',
  author: 'wealthcx01',
  createdAt: '2026-08-23T21:00:00Z',
  branch: 'foundry/auction-source-research',
  state: 'open',
  merged: false,
  files: ['docs/tickets/ARCA-068-auction-source-research.md'],
  ...over,
});

const reader = (content: string | null): BranchFileReader => async () => content;

/**
 * A board group, typed. Built through the real parser rather than cast from a literal: a fixture that
 * lies about the shape of a Ticket is a test that passes while the thing it guards breaks.
 */
const onBoard = (...ids: string[]): Record<TicketStatusGroup, TicketWithMeta[]> => {
  const groups: Record<TicketStatusGroup, TicketWithMeta[]> = {
    filed: [], todo: [], 'in-progress': [], 'pr-open': [], done: [],
  };
  for (const id of ids) {
    const parsed = parseTicket(ticket(id), { repo: 'arca', path: `docs/tickets/${id}-on-board.md` });
    groups.todo.push({ ticket: parsed.ticket, warnings: parsed.warnings });
  }
  return groups;
};


describe('telling a ticket filing from everything else on a branch', () => {
  it('takes the one ticket file a filing adds', () => {
    expect(filedTicketPath(['docs/tickets/ARCA-068-x.md'])).toBe('docs/tickets/ARCA-068-x.md');
  });

  it('refuses to guess when a pull request touches several tickets', () => {
    // A renumber or a bulk edit. Picking one of them would put a card on a founder's board that
    // nobody chose, which is worse than the card being absent.
    expect(filedTicketPath(['docs/tickets/A-1-x.md', 'docs/tickets/A-2-y.md'])).toBe(null);
  });

  it('is not fooled by the queue\'s own README', () => {
    expect(filedTicketPath(['docs/tickets/README.md', 'docs/tickets/ARCA-068-x.md']))
      .toBe('docs/tickets/ARCA-068-x.md');
  });

  it('refuses anything that also changes code', () => {
    // The rule that actually separates a filing from the lane's own work, both of which live under
    // `foundry/`. A filing writes one ticket and nothing else.
    expect(filedTicketPath(['docs/tickets/ARCA-051-x.md', 'client/src/pages/CardsPage.tsx'])).toBe(null);
  });

  it('ignores a lane branch that changes code as well as a ticket', () => {
    // The lane's work branches share the `foundry/` prefix. What separates a filing is that it
    // changes ONE file, which is why the prefix alone was never the test.
    expect(filingPrs([pr({ files: ['docs/tickets/ARCA-051-x.md', 'client/src/pages/CardsPage.tsx'] })]))
      .toEqual([]);
  });

  it('ignores branches that are not the filer\'s', () => {
    expect(filingPrs([pr({ branch: 'fb-117-something' })])).toEqual([]);
  });

  it('ignores anything already merged or closed', () => {
    expect(filingPrs([pr({ state: 'closed', merged: true })])).toEqual([]);
    expect(filingPrs([pr({ state: 'closed', merged: false })])).toEqual([]);
  });

  it('survives a pull request whose files were never loaded', () => {
    expect(filingPrs([pr({ files: undefined })])).toEqual([]);
  });
});

describe('reading the ticket off the branch it was filed on', () => {
  it('returns the ticket the founder approved, not the pull request title', async () => {
    const filed = await loadFiledTickets('arca', [pr()], reader(ticket('ARCA-068')));
    expect(filed).toHaveLength(1);
    expect(filed[0].ticket.id).toBe('ARCA-068');
    expect(filed[0].ticket.title).toBe('Research auction sources');
    expect(filed[0].prNumber).toBe(58);
    expect(filed[0].branch).toBe('foundry/auction-source-research');
  });

  it('leaves out a file it cannot read rather than showing an empty card', async () => {
    expect(await loadFiledTickets('arca', [pr()], reader(null))).toEqual([]);
  });

  it('still yields a ticket when the file is thin, because the name carries the id', async () => {
    // Not a gap — the parser derives id and title from the filename on purpose, so a sparse ticket is
    // a ticket with warnings rather than nothing. Asserted so the behaviour is chosen, not assumed:
    // the card appears, and the warning count on it is what tells the founder it is thin.
    const filed = await loadFiledTickets('arca', [pr()], reader('just some prose'));
    expect(filed).toHaveLength(1);
    expect(filed[0].ticket.id).toBe('ARCA-068');
    expect(filed[0].warnings.length).toBeGreaterThan(0);
  });

  it('leaves out a file whose name yields no id at all', async () => {
    const odd = pr({ files: ['docs/tickets/scratch.md'] });
    expect(await loadFiledTickets('arca', [odd], reader('# notes\n\nnothing'))).toEqual([]);
  });

  it('does not let one unreadable filing lose the others', async () => {
    const read: BranchFileReader = async (_r, _p, ref) => {
      if (ref.endsWith('boom')) throw new Error('gone');
      return ticket('ARCA-069');
    };
    const filed = await loadFiledTickets('arca', [
      pr({ number: 60, branch: 'foundry/boom', files: ['docs/tickets/ARCA-069-a.md'] }),
      pr({ number: 61, branch: 'foundry/fine', files: ['docs/tickets/ARCA-069-b.md'] }),
    ], read);
    expect(filed.map((f) => f.prNumber)).toEqual([61]);
  });

  it('orders them the way the board orders everything else', async () => {
    const read: BranchFileReader = async (_r, path) =>
      ticket(path.includes('070') ? 'ARCA-070' : 'ARCA-069');
    const filed = await loadFiledTickets('arca', [
      pr({ number: 61, branch: 'foundry/b', files: ['docs/tickets/ARCA-070-b.md'] }),
      pr({ number: 60, branch: 'foundry/a', files: ['docs/tickets/ARCA-069-a.md'] }),
    ], read);
    expect(filed.map((f) => f.ticket.id)).toEqual(['ARCA-069', 'ARCA-070']);
  });
});

describe('the transitions, which is where a board like this usually goes wrong', () => {
  it('shows the ticket once, not twice, in the window after its pull request merges', async () => {
    // The pull-request listing is cached. For a moment the ticket is on the default branch AND still
    // looks open, and a founder would see the same piece of work in two columns.
    const filed = await loadFiledTickets('arca', [pr()], reader(ticket('ARCA-068')));
    expect(withoutAlreadyOnBoard(filed, new Set(['ARCA-068']))).toEqual([]);
  });

  it('keeps it while the board genuinely does not have it', async () => {
    const filed = await loadFiledTickets('arca', [pr()], reader(ticket('ARCA-068')));
    expect(withoutAlreadyOnBoard(filed, new Set(['ARCA-067']))).toHaveLength(1);
  });

  it('drops it entirely once the pull request is closed without merging', () => {
    // Not "leaves it in a closed column" — the founder decided against it, and it never became work.
    expect(filingPrs([pr({ state: 'closed', merged: false })])).toEqual([]);
  });

  it('reads the ids the board already shows out of every column', () => {
    const groups = onBoard('ARCA-001', 'ARCA-002', 'ARCA-003');
    expect([...ticketIdsOnBoard(groups)].sort()).toEqual(['ARCA-001', 'ARCA-002', 'ARCA-003']);
  });
});

describe('what it costs to render (FB-083)', () => {
  it('reads once per filed ticket and never once per ticket in the backlog', async () => {
    // The rule FB-083 settled: bounded per page load, never repeating on a timer. A backlog of any
    // size must not change this number — only the count of things the founder is waiting on does.
    let reads = 0;
    const counting: BranchFileReader = async () => { reads += 1; return ticket('ARCA-090'); };
    const bigBacklog = onBoard(...Array.from({ length: 200 }, (_, i) => `ARCA-${i + 100}`));

    await loadFiledForLanes(
      [{ repo: 'arca', groups: bigBacklog }],
      [{ repo: 'arca', result: { prs: [pr({ number: 60 }), pr({ number: 61, branch: 'foundry/x', files: ['docs/tickets/ARCA-091-x.md'] })] } }],
      counting,
    );

    expect(reads).toBe(2);
  });

  it('reads nothing at all when the founder has filed nothing', async () => {
    let reads = 0;
    const counting: BranchFileReader = async () => { reads += 1; return ticket('X-1'); };
    const out = await loadFiledForLanes(
      [{ repo: 'arca', groups: onBoard() }],
      [{ repo: 'arca', result: { prs: [pr({ branch: 'fb-1-not-a-filing' })] } }],
      counting,
    );
    expect(reads).toBe(0);
    expect(out.size).toBe(0);
  });

  it('does not read another lane\'s pull requests for this lane', async () => {
    const seen: string[] = [];
    const read: BranchFileReader = async (repo) => { seen.push(repo); return ticket('ARCA-068'); };
    await loadFiledForLanes(
      [{ repo: 'arca', groups: onBoard() }],
      [
        { repo: 'arca', result: { prs: [pr()] } },
        { repo: 'arca-sell', result: { prs: [pr({ number: 99 })] } },
      ],
      read,
    );
    expect(seen).toEqual(['arca']);
  });
});
