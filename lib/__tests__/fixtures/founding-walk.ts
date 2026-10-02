/**
 * A founding walk's hand-over, for a venture that does not exist yet (FB-236).
 *
 * Written the way the composer is told to write it — four quadrants as `##` headings, points as
 * bullets, and five tickets whose `source` names the part of the map each came from. Realistic on
 * purpose: several points per quadrant, a quadrant heading with a trailing explanation, bold inside
 * a point, and a dependency chain, so a check that only works on a tidy three-line map fails here.
 */

import { MAP_MARKER, type FoundingMap } from '../../founding-map';
import { PLAN_MARKER, type PlanDraft } from '../../plan-draft';

export const KILN = { id: 'kiln', repo: 'kiln' };

export const MAP_BODY = [
  '## Known knowns',
  '- Shared pottery studios rent shelf space and kiln firings to members, usually by the month.',
  '- Most run their bookings on a paper sheet by the kiln, or a group chat.',
  '- The founder has run one studio for six years and knows twelve other owners by name.',
  '',
  '## Known unknowns',
  '- Who exactly is this for? — **Owners of studios with 20 to 80 members**, not hobbyists. Settled by the founder.',
  '- What do they do today, and what does it cost? — A paper sheet, and about four hours a week chasing who fired what. Settled by the founder.',
  '- What would stop someone copying this? — Still open. A booking screen is not a barrier; every feature can be copied next month.',
  '- What would make this a bad idea? — If owners will not pay more than they pay for the group chat, which is nothing. Still open.',
  '',
  '## Unknown knowns — what the founder knew and had not said',
  '- Owners hate anything that makes members feel watched; firing logs must not read as surveillance.',
  '- The founder will not take on card payments in the first year.',
  '',
  '## Unknown unknowns — the landmines, and how far the search reached',
  '- Kiln firings have insurance conditions in some areas: who loaded it may need to be recorded. Searched UK insurer guidance only.',
  '- Members often share one login on a studio tablet, so "who booked" may not be a person.',
  '- Two earlier booking tools for studios closed within two years; neither said why. Not yet found out.',
].join('\n');

export const MAP: FoundingMap = {
  venture_id: KILN.id,
  idea: 'Studio owners lose hours a week chasing who fired what. I want the kiln to keep its own book.',
  body: MAP_BODY,
};

const ticket = (slug: string, title: string, source: string, depends_on: string[] = []) => ({
  slug,
  title,
  source,
  depends_on,
  body: [
    `# ${title}`,
    '',
    '**Status:** Todo · **Area:** Research · **Depends on:** —',
    '',
    '## Why this matters (for the founder)',
    `From the founding map: ${source}`,
    '',
    '## Acceptance criteria',
    '- [ ] The founder can read the answer in one page.',
  ].join('\n'),
});

export const PLAN: PlanDraft = {
  venture_id: KILN.id,
  repo: KILN.repo,
  source_title: 'The founding map',
  created_at: '2026-10-02T09:00:00.000Z',
  tickets: [
    ticket('why-studio-tools-closed', 'Find out why the last two studio booking tools closed', 'Unknown unknowns: two earlier tools closed and neither said why'),
    ticket('kiln-insurance-records', 'Check what insurers ask a studio to record about firings', 'Unknown unknowns: insurance conditions on who loaded the kiln'),
    ticket('ask-twelve-owners', 'Ask the twelve owners the founder knows what they would pay', 'Known unknowns: what would make this a bad idea', ['why-studio-tools-closed']),
    ticket('shared-tablet-booking', 'Booking that works on one shared studio tablet', 'Unknown unknowns: members share one login', ['kiln-insurance-records']),
    ticket('kiln-book-first-page', 'One page showing this week’s firings and who booked them', 'Known knowns: bookings run on a paper sheet by the kiln', ['shared-tablet-booking']),
  ],
};

/** The two blocks as the composer writes them at the last stage, map first. */
export const handOverReply = (map: FoundingMap = MAP, plan: PlanDraft = PLAN) => [
  '**Hand over the map.** Here is everything we found, and five first tickets that come out of it.',
  '',
  '```',
  JSON.stringify({ [MAP_MARKER]: 1, ...map }),
  '```',
  '',
  '```',
  JSON.stringify({ [PLAN_MARKER]: 1, ...plan }),
  '```',
  '',
  'Strike anything that is not yours. Nothing is filed until you press.',
].join('\n');
