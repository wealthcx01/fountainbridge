import { describe, it, expect } from 'vitest';
import {
  isPaletteShortcut, matchPalette, paletteAnnouncement, paletteItems, ticketHref, PALETTE_LIMIT,
  type PaletteTicket,
} from '../palette';
import { resolveSelected, rowKey, type TicketRow } from '../tickets-view';
import { pushPayload } from '../push-send';

/**
 * "Go to anything" (FB-179), and the push's deep link that shares its addresses.
 *
 * Shapes are ARCA's: ids like ARCA-061 and SELL-001, several repositories in one venture, a ticket id
 * that two repositories share, and far more tickets than the list shows at once.
 */
const ARCA = { id: 'arca', name: 'ARCA' };
const RESET = { id: 'the-reset', name: 'The Reset' };

/** 80 tickets across three repositories, as ARCA has. */
const TICKETS: PaletteTicket[] = Array.from({ length: 80 }, (_, i) => ({
  repo: ['arca', 'arca-marketing', 'arca-ops'][i % 3],
  id: i % 3 === 0 ? `ARCA-${String(i + 1).padStart(3, '0')}` : i % 3 === 1 ? `SELL-${String(i).padStart(3, '0')}` : `SCALE-${String(i).padStart(3, '0')}`,
  title: `Ticket number ${i + 1}`,
}));
TICKETS.push({ repo: 'arca', id: 'ARCA-061', title: 'Saved card lists are not persisting' });
TICKETS.push({ repo: 'arca-marketing', id: 'ARCA-061', title: 'A ticket in another repository with the same id' });

const full = () => paletteItems({
  ventures: [ARCA, RESET],
  current: {
    venture: ARCA,
    work: [{ repo: 'arca', number: 93, title: 'Saved card lists are not persisting', ticketId: 'ARCA-061' },
      { repo: 'arca', number: 88, title: 'Add the two working rules', ticketId: null }],
    sends: [{ repo: 'arca-marketing', id: 'investor-email-oct', summary: 'October investor email to 41 people' }],
    tickets: TICKETS,
  },
});

describe('what the palette lists', () => {
  it('puts what is waiting first, then the screens, then tickets, then other ventures', () => {
    const groups = [...new Set(full().map((i) => i.group))];
    expect(groups).toEqual(['Waiting on you', 'Screens', 'Tickets', 'Ventures']);
  });

  it('reaches the composer, for this venture and for every other one this person can see', () => {
    const items = full();
    expect(items.find((i) => i.label === 'Composer')?.href).toBe('/venture/arca/composer');
    expect(items.find((i) => i.label === 'Composer — The Reset')?.href).toBe('/venture/the-reset/composer');
  });

  it('a waiting send goes to its own page — the one place a send is decided — never somewhere it could be approved twice', () => {
    expect(full().find((i) => i.key.startsWith('send:'))?.href)
      .toBe('/venture/arca/approvals/arca-marketing/investor-email-oct');
  });

  it('waiting work goes to its ticket when it has one, and to its own page when it does not', () => {
    const work = full().filter((i) => i.key.startsWith('work:'));
    expect(work.map((w) => w.href)).toEqual([
      '/venture/arca/tickets?filter=all&t=arca%2FARCA-061',
      '/venture/arca/work/arca/88',
    ]);
  });

  it('outside a venture, lists only the ventures — no tickets from anywhere', () => {
    const items = paletteItems({ ventures: [ARCA], current: null });
    expect(items.map((i) => i.group)).toEqual(['Ventures', 'Ventures']);
  });
});

describe('a ticket’s address opens that ticket', () => {
  // The address is only worth anything if the Tickets screen resolves it to the same ticket. Checked
  // with the screen's own resolver, including the case it exists for: one id in two repositories.
  const row = (repo: string, id: string): TicketRow => ({ id, repo, title: id, group: 'todo', item: null, progress: null, waiting: null, surface: null } as unknown as TicketRow);
  const rows = [row('arca', 'ARCA-001'), row('arca', 'ARCA-061'), row('arca-marketing', 'ARCA-061')];

  it('resolves to the right repository’s ticket when two share an id', () => {
    for (const target of [rows[1], rows[2]]) {
      const t = new URL(ticketHref('arca', target), 'https://studio').searchParams.get('t');
      const picked = resolveSelected(rows, rows.slice(0, 1), t);
      expect(rowKey(picked!)).toBe(rowKey(target));
    }
  });
});

describe('typing narrows it', () => {
  it('finds a ticket by venture and number, in any order and any case', () => {
    const hits = matchPalette(full(), 'arca 61');
    expect(hits.some((h) => h.label === 'Saved card lists are not persisting' && h.group === 'Tickets')).toBe(true);
    expect(matchPalette(full(), '61 ARCA').map((h) => h.key)).toEqual(hits.map((h) => h.key));
  });

  it('finds a screen by a word that is not its name', () => {
    expect(matchPalette(full(), 'home')[0].label).toBe('The desk');
  });

  it('ranks a label that starts with what was typed above one that only contains it', () => {
    const hits = matchPalette(full(), 'saved');
    expect(hits[0].label.startsWith('Saved')).toBe(true);
    const items = [
      { key: 'a', label: 'Unsaved drafts', hint: '', href: '/a', group: 'Tickets' as const },
      { key: 'b', label: 'Saved drafts', hint: '', href: '/b', group: 'Tickets' as const },
    ];
    expect(matchPalette(items, 'saved').map((i) => i.key)).toEqual(['b', 'a']);
  });

  it('never shows more than the limit, so 80 tickets do not become an 80-row list', () => {
    expect(full().length).toBeGreaterThan(PALETTE_LIMIT);
    expect(matchPalette(full(), '')).toHaveLength(PALETTE_LIMIT);
    expect(matchPalette(full(), 'ticket').length).toBe(PALETTE_LIMIT);
  });

  it('says so in words when nothing matches', () => {
    expect(matchPalette(full(), 'zebra')).toEqual([]);
    expect(paletteAnnouncement(0, 100, 'zebra ')).toBe('Nothing matches “zebra”.');
    expect(paletteAnnouncement(1, 100, 'x')).toBe('One match. Enter to go.');
  });
});

describe('the shortcut', () => {
  const k = (o: Partial<{ key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }>) =>
    ({ key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o });

  it('is ⌘K or Ctrl-K, and not a K typed into a text box', () => {
    expect(isPaletteShortcut(k({ metaKey: true }))).toBe(true);
    expect(isPaletteShortcut(k({ ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(k({ key: 'K', ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(k({}))).toBe(false);
    expect(isPaletteShortcut(k({ metaKey: true, shiftKey: true }))).toBe(false);
  });
});

describe('a notification opens the exact item (FB-179)', () => {
  const work = { kind: 'work' as const, repo: 'arca', number: 93, title: 'x', ticketId: 'ARCA-061' };

  it('when one thing is waiting, the push opens it', () => {
    expect(pushPayload(ARCA, 1, work).url).toBe('/venture/arca/tickets?filter=all&t=arca%2FARCA-061');
    expect(pushPayload(ARCA, 1, { kind: 'send', repo: 'arca-marketing', id: 'investor-email-oct' }).url)
      .toBe('/venture/arca/approvals/arca-marketing/investor-email-oct');
  });

  it('when several are, it opens the list — never an arbitrary one of them', () => {
    expect(pushPayload(ARCA, 3, work).url).toBe('/venture/arca/tickets?filter=needs');
  });

  it('still says nothing on the lock screen about what the item is', () => {
    const p = pushPayload(ARCA, 1, { ...work, title: 'Saved card lists are not persisting' });
    expect(`${p.title} ${p.body}`).not.toMatch(/Saved card|ARCA-061/);
  });
});
