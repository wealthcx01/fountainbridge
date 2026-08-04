import { describe, it, expect } from 'vitest';
import { matchWorkToTicket, candidateSlugs, ticketSlug, workTitle, type MatchableTicket } from '../ticket-match';

/**
 * Pinned to the shapes `wealthcx01/arca`'s lane actually produces. The board said 0 while the badge
 * said 15 because none of shape 2 or 3 below carries a ticket id, so nothing matched.
 */
const tickets: MatchableTicket[] = [
  { id: 'ARCA-1', title: 'Terminal card renderer setup', path: 'docs/tickets/ARCA-1-terminal-setup.md', branch: 'arca-1-terminal-setup' },
  { id: 'ARCA-44', title: 'Seed script must fail loudly', path: 'docs/tickets/seed-script-silent-failure.md', branch: null },
  { id: 'ARCA-58', title: 'Bulk daily price feed', path: 'docs/tickets/bulk-daily-price-feed-plan.md', branch: 'foundry/bulk-daily-price-feed-plan' },
];

const match = (branch: string, title: string) => matchWorkToTicket({ branch, title }, tickets);

describe('the three shapes the lane produces', () => {
  it('matches work that states its ticket id', () => {
    expect(match('arca-1-terminal-setup', 'ARCA-1: terminal card renderer')?.id).toBe('ARCA-1');
  });

  it('matches the lane’s own branch shape, which carries no id at all', () => {
    // `foundry/bulk-daily-price-feed-plan` — fifteen of these were invisible to the board.
    expect(match('foundry/bulk-daily-price-feed-plan', 'build: something else entirely')?.id).toBe('ARCA-58');
  });

  it('matches the slug out of the lane’s title when the branch is unhelpful', () => {
    expect(match('tmp-work', 'build: bulk-daily-price-feed-plan (Foundry lane)')?.id).toBe('ARCA-58');
  });

  it('matches a ticket file whose name is a slug with no id in it', () => {
    expect(match('foundry/seed-script-silent-failure', 'build: seed fix (Foundry lane)')?.id).toBe('ARCA-44');
  });

  it('reads a prose title as a slug, punctuation and all', () => {
    expect(match('x', 'Bulk Daily Price Feed Plan (Foundry lane)')?.id).toBe('ARCA-58');
  });
});

describe('what it refuses to do', () => {
  it('does not guess when nothing matches', () => {
    // Fifteen unmatched pieces of work is a FACT about the venture. Inventing a match to make the
    // columns add up would be the same failure wearing the opposite costume.
    expect(match('foundry/something-nobody-filed', 'build: something-nobody-filed (Foundry lane)')).toBeNull();
  });

  it('does not slug-guess around a stated id it cannot find', () => {
    // "ARCA-99" means the author meant ARCA-99. Matching it to a similarly-named ticket would be
    // worse than matching nothing, because it would be silently wrong rather than visibly unmatched.
    expect(match('arca-99-price-feed', 'ARCA-99: bulk daily price feed plan')).toBeNull();
  });

  it('does not match on an empty branch and an empty title', () => {
    expect(match('', '')).toBeNull();
  });
});

describe('the pieces', () => {
  it('strips the lane’s prefixes and suffixes before reading a title', () => {
    expect(candidateSlugs({ branch: 'foundry/a-b', title: 'build: c d (Foundry lane)' })).toEqual(['a-b', 'c-d']);
  });

  it('takes the id off a ticket file’s own name', () => {
    expect(ticketSlug(tickets[0])).toBe('terminal-setup');
    expect(ticketSlug(tickets[1])).toBe('seed-script-silent-failure');
  });

  it('names work by its ticket when it has one, and by itself when it does not', () => {
    expect(workTitle({ title: 'build: x (Foundry lane)' }, tickets[2])).toBe('Bulk daily price feed');
    expect(workTitle({ title: 'build: x (Foundry lane)' }, null)).toBe('build: x (Foundry lane)');
  });
});
