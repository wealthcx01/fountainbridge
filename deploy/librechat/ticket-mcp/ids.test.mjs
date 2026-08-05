import { describe, it, expect } from 'vitest';
import { nextTicketId, idNumber, existingTicketFile, withTicketId, ticketPath, isUnnumbered } from './ids.mjs';

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

describe('what the studio should flag', () => {
  it('knows an unnumbered ticket when it sees one', () => {
    expect(isUnnumbered('ARCA-NEW')).toBe(true);
    expect(isUnnumbered('arca-new')).toBe(true);
    expect(isUnnumbered('ARCA-44')).toBe(false);
    expect(isUnnumbered(null)).toBe(false);
  });
});
