import { describe, it, expect } from 'vitest';
import { draftSections, railState, type RailInput } from '../composer-rail';
import { parseReply } from '../composer';
import { PLAN_MARKER } from '../plan-draft';

/**
 * The composer's rail (FB-131).
 *
 * The property under test is the one a founder feels: **exactly one state, never two.** Two things
 * on the table is two answers to "what am I about to press", which is the one question this screen
 * exists to answer.
 */

const TICKET = [
  '# ARCA-NEW — Show how fresh each price is',
  '',
  '**Status:** Todo · **Area:** Pricing',
  '',
  '## Why this matters (for the founder)',
  'Prices look stale and a collector cannot tell whether to trust them.',
  '',
  '## Scope',
  '- A last-updated time next to every price',
  '- A quiet warning when a price is over a day old',
  '',
  '## Acceptance criteria',
  '- [ ] Every price on the market page shows when it was read',
].join('\n');

const replyWith = (fenced: string) => `Here is what I would file.\n\n\`\`\`\n${fenced}\n\`\`\`\n`;

const plan = JSON.stringify({
  [PLAN_MARKER]: 1,
  venture_id: 'arca',
  repo: 'arca',
  source_title: 'Auction PRD',
  created_at: '2026-08-29T09:00:00.000Z',
  tickets: [{ slug: 'a-thing', title: 'A thing', body: '# A thing\n\nbody', source: '§1', depends_on: [] }],
});

const input = (over: Partial<RailInput> = {}): RailInput => ({
  latestReply: null,
  aboutTicketId: null,
  filed: null,
  ...over,
});

describe('exactly one state, never two', () => {
  it('shows what was filed over everything else', () => {
    // A founder who has pressed needs to know what happened. Showing them the draft again invites a
    // second press on work that already exists.
    const s = railState(input({
      latestReply: replyWith(TICKET),
      aboutTicketId: 'ARCA-6',
      filed: { what: 'ARCA-16', href: '/venture/arca/tickets' },
    }));
    expect(s.kind).toBe('filed');
  });

  it('shows the ticket they arrived to discuss when nothing is on the table', () => {
    const s = railState(input({ aboutTicketId: 'ARCA-6' }));
    expect(s.kind).toBe('discussing');
    if (s.kind === 'discussing') expect(s.ticketId).toBe('ARCA-6');
  });

  it('shows the DRAFT when one arrives during a discussion, and says what it revises', () => {
    // The first version returned `discussing` for the life of the page, and that state renders no
    // press — so the whole revision flow (drawer → "Ask for changes to this" → converse → draft)
    // ended with no button anywhere and the founder had to type "yes, file it" by hand.
    const s = railState(input({ latestReply: replyWith(TICKET), aboutTicketId: 'ARCA-6' }));
    expect(s.kind).toBe('draft');
    if (s.kind === 'draft') expect(s.revises).toBe('ARCA-6');
  });

  it('shows a plan proposed during a discussion, which had the same hole', () => {
    const s = railState(input({ latestReply: replyWith(plan), aboutTicketId: 'ARCA-6' }));
    expect(s.kind).toBe('plan');
  });

  it('shows a plan over a single draft, because a set is the bigger decision', () => {
    const s = railState(input({ latestReply: replyWith(plan) }));
    expect(s.kind).toBe('plan');
  });

  it('shows a draft when the reply carries one', () => {
    const s = railState(input({ latestReply: replyWith(TICKET) }));
    expect(s.kind).toBe('draft');
  });

  it('shows nothing on most turns, which is not an error', () => {
    expect(railState(input()).kind).toBe('empty');
    expect(railState(input({ latestReply: 'Two quick questions before I draft anything.' })).kind).toBe('empty');
  });

  it('is never two states at once, whatever it is handed', () => {
    // The union makes this structurally true; the test is here because the property is the ticket.
    for (const over of [
      {},
      { latestReply: replyWith(TICKET) },
      { latestReply: replyWith(plan) },
      { aboutTicketId: 'ARCA-6' },
      { filed: { what: 'ARCA-16', href: null } },
      { latestReply: replyWith(plan), aboutTicketId: 'ARCA-6', filed: { what: 'x', href: null } },
    ] as Array<Partial<RailInput>>) {
      const s = railState(input(over));
      expect(typeof s.kind).toBe('string');
      expect(['filed', 'discussing', 'plan', 'draft', 'empty']).toContain(s.kind);
    }
  });
});

describe('the ticket taking shape', () => {
  const sections = () => draftSections(parseReply(replyWith(TICKET)));

  it('reads the title without the placeholder id the filer has not replaced yet', () => {
    // `ARCA-NEW` is a placeholder, and showing it would name the ticket something nobody can refer
    // to — the whole of FB-097.
    expect(sections()?.title).toBe('Show how fresh each price is');
  });

  it('reads Why in the founder’s own words rather than re-summarising them', () => {
    // The rail's promise is "every line came from the conversation". A rail that paraphrased would
    // be a third rendering of one ticket, free to disagree with the markdown and the filed file.
    expect(sections()?.why).toBe('Prices look stale and a collector cannot tell whether to trust them.');
  });

  it('reads Scope as the lines it was written as', () => {
    expect(sections()?.scope).toEqual([
      'A last-updated time next to every price',
      'A quiet warning when a price is over a day old',
    ]);
  });

  it('reads Done when out of the acceptance criteria, without its checkbox', () => {
    expect(sections()?.doneWhen).toBe('Every price on the market page shows when it was read');
  });

  it('is nothing at all when a fenced block has no heading', () => {
    // A code sample is not a ticket, and drawing a form over it would invite a press on nothing.
    expect(draftSections(parseReply('```\nnpm run dev\n```'))).toBeNull();
    expect(draftSections(parseReply('no fenced block here'))).toBeNull();
  });

  it('is still fileable when the draft is not in the house format', () => {
    // The composer's prompt lives on a venture box, not in this repository, so the studio cannot
    // assume `## Scope` and `## Acceptance criteria` hold. Requiring them silently removed the
    // founder's only way to file. A thin rail is visibly thin; a missing button is invisible.
    const s = draftSections(parseReply('```\n# Show set names on card pages\n\nJust prose, no headings.\n```'));
    expect(s?.title).toBe('Show set names on card pages');
  });

  it('survives a ticket that is missing sections', () => {
    const partial = '# A thing\n\n## Scope\n- one line';
    const s = draftSections(parseReply(replyWith(partial)));
    expect(s?.scope).toEqual(['one line']);
    expect(s?.why).toBeNull();
    expect(s?.doneWhen).toBeNull();
  });
});
