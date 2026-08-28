import { describe, it, expect } from 'vitest';
import {
  nextTicketId,
  idNumber,
  idWidth,
  formatTicketId,
  DEFAULT_ID_WIDTH,
  existingTicketFile,
  mustRenumber,
  withTicketId,
  ticketPath,
  isUnnumbered,
} from './ids.mjs';

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
    // Reading one as a number would be reading the bug as data. Nothing numbered is left, so the
    // default width applies.
    expect(nextTicketId('ARCA', ['ARCA-NEW-a.md', 'ARCA-NEW-b.md'])).toBe('ARCA-001');
  });

  it('starts at 1 for a venture with nothing filed', () => {
    expect(nextTicketId('SELL', [])).toBe('SELL-001');
    expect(nextTicketId('SELL', backlog)).toBe('SELL-001'); // another venture's ids are not ours
  });

  it('reads a number only from its own prefix', () => {
    expect(idNumber('ARCA-12-x.md', 'ARCA')).toBe(12);
    expect(idNumber('SELL-99-x.md', 'ARCA')).toBeNull();
    expect(idNumber('README.md', 'ARCA')).toBeNull();
  });
});

describe('writing an id at the width the backlog already uses (FB-118)', () => {
  // ARCA-001 through ARCA-067 were filed by hand; ARCA-68 and ARCA-73 by the composer. So the backlog
  // read in two formats, and which one a ticket had depended on nothing a founder could see.
  const arca = ['ARCA-001-terminal-setup.md', 'ARCA-066-e2e-smoke-in-ci.md', 'ARCA-067-api-key-in-source.md'];

  it('joins a padded backlog padded', () => {
    expect(nextTicketId('ARCA', arca)).toBe('ARCA-068');
  });

  it('joins an unpadded backlog unpadded', () => {
    // Not our convention to impose. A venture that writes ARCA-7 keeps writing ARCA-7.
    expect(nextTicketId('ARCA', ['ARCA-7-x.md', 'ARCA-8-y.md'])).toBe('ARCA-9');
  });

  it('picks a mixed backlog deterministically rather than by whichever file sorts first', () => {
    // The real ARCA shape after the dogfood run: mostly three digits, a couple of two.
    const mixed = [...arca, 'ARCA-68-auction-source-research.md', 'ARCA-73-auction-feed.md'];
    expect(idWidth('ARCA', mixed)).toBe(3);
    expect(nextTicketId('ARCA', mixed)).toBe('ARCA-074');
  });

  it('breaks a tie towards the wider, because padding is the direction that keeps sorting intact', () => {
    expect(idWidth('ARCA', ['ARCA-7-a.md', 'ARCA-008-b.md'])).toBe(3);
  });

  it('gives a venture with nothing filed the house default', () => {
    expect(idWidth('SELL', [])).toBe(DEFAULT_ID_WIDTH);
    expect(DEFAULT_ID_WIDTH).toBe(3);
  });

  it('rolls past the width rather than truncating to it', () => {
    // ARCA-099 + 1 is ARCA-100, not ARCA-0100 and not ARCA-00.
    expect(nextTicketId('ARCA', ['ARCA-098-x.md', 'ARCA-099-y.md'])).toBe('ARCA-100');
    expect(formatTicketId('ARCA', 1234, 3)).toBe('ARCA-1234');
  });

  it('reads width only from its own prefix', () => {
    expect(idWidth('SELL', arca)).toBe(DEFAULT_ID_WIDTH);
  });

  it('is not confused by a prefix carrying regex punctuation', () => {
    // Venture prefixes come from a repo name; nothing stops one containing a dot.
    expect(idNumber('A.B-012-x.md', 'A.B')).toBe(12);
    expect(idNumber('AXB-012-x.md', 'A.B')).toBeNull();
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

  it('sees the same number written at two widths as one collision (FB-118)', () => {
    // A box still running the pre-FB-118 filer allocates ARCA-74 while the studio allocates
    // ARCA-074 off the same backlog. Compared as strings these are two different tickets and both
    // sides keep the number — the FB-117 duplicate, silently, in a new coat.
    // Exactly one side still moves, and the sort happens to move the right one: a leading zero
    // sorts before a digit, so the ticket written at the backlog's own width is the one that keeps
    // the number.
    const mixed = ['ARCA-74-theirs.md', 'ARCA-074-ours.md'];
    expect(mustRenumber('ARCA-074', 'ours', mixed)).toBe(null);
    expect(mustRenumber('ARCA-74', 'theirs', mixed)).toBe('arca-074-ours.md');
  });

  it('still tells ARCA-680 apart from ARCA-68 when both are padded', () => {
    expect(mustRenumber('ARCA-068', 'mine', ['ARCA-680-something-else.md'])).toBe(null);
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
