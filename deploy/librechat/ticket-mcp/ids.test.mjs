import { describe, it, expect } from 'vitest';
import { nextTicketId, idNumber, existingTicketFile, mustRenumber, withTicketId, ticketPath, isUnnumbered } from './ids.mjs';

// ARCA's real backlog shapes, including the four the walkthrough met all called ARCA-NEW.
const backlog = [
  'ARCA-1-terminal-setup.md',
  'ARCA-2-card-search.md',
  'ARCA-43-price-feed-audit.md',
  'ARCA-NEW-show-set-name.md',
  'ARCA-NEW-last-updated-time.md',
  'README.md',
];

describe('allocating the next real id', () => {
  it('takes one past the highest already filed', () => {
    expect(nextTicketId('ARCA', backlog)).toBe('ARCA-44');
  });

  it('counts from the highest, not from how many there are', () => {
    // Tickets get deleted and renamed; a count hands out an id that already exists.
    expect(nextTicketId('ARCA', ['ARCA-7-x.md'])).toBe('ARCA-8');
  });

  it('ignores the -NEW files it exists to replace', () => {
    // Reading one as a number would be reading the bug as data.
    expect(nextTicketId('ARCA', ['ARCA-NEW-a.md', 'ARCA-NEW-b.md'])).toBe('ARCA-1');
  });

  it('starts at 1 for a venture with nothing filed', () => {
    expect(nextTicketId('SELL', [])).toBe('SELL-1');
    expect(nextTicketId('SELL', backlog)).toBe('SELL-1'); // another venture's ids are not ours
  });

  it('reads a number only from its own prefix', () => {
    expect(idNumber('ARCA-12-x.md', 'ARCA')).toBe(12);
    expect(idNumber('SELL-99-x.md', 'ARCA')).toBeNull();
    expect(idNumber('README.md', 'ARCA')).toBeNull();
  });
});

describe('re-filing a ticket instead of filing a second one', () => {
  it('finds the ticket this slug already produced', () => {
    // The composer tells founders to revise and re-file. Without this, every revision would take a
    // fresh number and leave a trail of half-written duplicates.
    expect(existingTicketFile(backlog, 'card-search')).toBe('ARCA-2-card-search.md');
  });

  it('finds an older unnumbered one too, so it can be replaced rather than doubled', () => {
    expect(existingTicketFile(['show-set-name.md'], 'show-set-name')).toBe('show-set-name.md');
  });

  it('does not mistake a different ticket for this one', () => {
    expect(existingTicketFile(backlog, 'card-search-filters')).toBeNull();
  });
});

describe('putting the id into the ticket itself', () => {
  it('replaces the placeholder the model was told to write', () => {
    expect(withTicketId('# ARCA-NEW — Show set name on card pages\n\n**Status:** Todo', 'ARCA-44'))
      .toContain('# ARCA-44 — Show set name on card pages');
  });

  it('numbers a heading that carries no id at all', () => {
    expect(withTicketId('# Show set name on card pages\n\nbody', 'ARCA-44'))
      .toContain('# ARCA-44 — Show set name on card pages');
  });

  it('leaves a ticket that already has a real number alone', () => {
    // Renumbering a ticket the founder has already been told the name of is worse than any tidiness
    // it would buy.
    const body = '# ARCA-12 — Price history\n\nbody';
    expect(withTicketId(body, 'ARCA-44')).toBe(body);
  });

  it('still produces a usable ticket from a body with no heading', () => {
    expect(withTicketId('just some prose', 'ARCA-44')).toBe('# ARCA-44 — Untitled\n\njust some prose');
  });

  it('files it where the venture repos already keep them', () => {
    expect(ticketPath('ARCA-44', 'show-set-name')).toBe('docs/tickets/ARCA-44-show-set-name.md');
  });
});

describe('a whole set filed in one sitting (FB-117)', () => {
  // The dogfood run of 2026-08-23: a founder asked for a research ticket, three build tickets and a
  // QA ticket. All five came back called ARCA-68, because allocation read only the default branch and
  // no ticket had merged. This is that run, as an allocation sequence.
  const set = [
    'auction-source-research',
    'auction-feed-ingestion',
    'auction-view-price-history',
    'auction-in-app-notifications',
    'auction-aggregator-qa',
  ];

  it('gives five tickets five numbers when nothing has merged in between', () => {
    const merged = ['ARCA-66-e2e-smoke-in-ci.md', 'ARCA-67-api-key-in-source.md'];
    const inFlight = [];
    const allocated = set.map((slug) => {
      const id = nextTicketId('ARCA', [...merged, ...inFlight]);
      inFlight.push(`${id}-${slug}.md`); // what the branch now carries, before any merge
      return id;
    });

    expect(allocated).toEqual(['ARCA-68', 'ARCA-69', 'ARCA-70', 'ARCA-71', 'ARCA-72']);
    expect(new Set(allocated).size).toBe(5);
  });

  it('reads the merged backlog alone and reproduces the bug — which is why it must not', () => {
    // Kept as the counter-example: this is exactly what shipped, and it passes. The fix is the union
    // above, not a cleverer reading of the same list.
    const merged = ['ARCA-66-e2e-smoke-in-ci.md', 'ARCA-67-api-key-in-source.md'];
    expect(set.map(() => nextTicketId('ARCA', merged))).toEqual(Array(5).fill('ARCA-68'));
  });
});

describe('deciding who gives up a shared number', () => {
  const clash = ['ARCA-67-api-key-in-source.md', 'ARCA-68-auction-feed-ingestion.md', 'ARCA-68-auction-source-research.md'];

  it('makes the higher filename move', () => {
    expect(mustRenumber('ARCA-68', 'auction-source-research', clash)).toBe('arca-68-auction-feed-ingestion.md');
  });

  it('lets the lowest filename keep the number', () => {
    // The half that matters: if BOTH sides moved, they would step to the same next number together
    // and collide again one along. Exactly one side stays put.
    expect(mustRenumber('ARCA-68', 'auction-feed-ingestion', clash)).toBe(null);
  });

  it('never asks both sides of a pair to move', () => {
    const pair = ['ARCA-68-a.md', 'ARCA-68-b.md'];
    const movers = ['a', 'b'].filter((slug) => mustRenumber('ARCA-68', slug, pair));
    expect(movers).toEqual(['b']);
  });

  it('leaves exactly one holder in a three-way pile-up', () => {
    const three = ['ARCA-68-a.md', 'ARCA-68-b.md', 'ARCA-68-c.md'];
    const stayers = ['a', 'b', 'c'].filter((slug) => !mustRenumber('ARCA-68', slug, three));
    expect(stayers).toEqual(['a']);
  });

  it('is not fooled by a longer number that starts the same way', () => {
    // ARCA-680 is not ARCA-68. Matching on the prefix alone would renumber a ticket for nothing.
    expect(mustRenumber('ARCA-68', 'mine', ['ARCA-680-something-else.md'])).toBe(null);
  });

  it('holds the number when nobody else has it', () => {
    expect(mustRenumber('ARCA-69', 'mine', ['ARCA-68-other.md'])).toBe(null);
  });

  it('assumes our own file is there when the listing came back short', () => {
    // A partial read must not be mistaken for "no clash" — that is how a duplicate survives.
    expect(mustRenumber('ARCA-68', 'zzz-ours', ['ARCA-68-aaa-theirs.md'])).toBe('arca-68-aaa-theirs.md');
  });
});

describe('what the studio should flag', () => {
  it('knows an unnumbered ticket when it sees one', () => {
    expect(isUnnumbered('ARCA-NEW')).toBe(true);
    expect(isUnnumbered('arca-new')).toBe(true);
    expect(isUnnumbered('ARCA-44')).toBe(false);
    expect(isUnnumbered(null)).toBe(false);
  });
});
