/**
 * The founding map: where a new venture's first tickets come from (FB-236).
 *
 * ## The moment this is for
 *
 * A venture starts. There is no code and no backlog — only a founder with an idea. The hardest
 * question then is not "what shall we build first". It is "what do I not know that I do not know?"
 *
 * The composer answers it with the `explore-unknowns` walk, one stage at a time:
 *
 *  1. **Known knowns** — what is already settled.
 *  2. **Known unknowns** — the questions, each with a suggested answer.
 *  3. **Unknown knowns** — what the founder knows and has not said.
 *  4. **Unknown unknowns** — the landmines neither of them knew to ask about.
 *  5. **Hand over the map** — and the map becomes the first tickets.
 *
 * The walk itself is a conversation, and its instructions live with the composer on the venture's
 * box (`deploy/librechat/seed-agent.js`). This module is the part the studio can check: the map the
 * walk hands over, and the rules a founding set must meet before it is offered for filing.
 *
 * ## Three rules this module holds
 *
 * **The walk reached stage four.** A map with no unknown unknowns is a tidy list of what the founder
 * already believed. That stage is the whole reason for walking rather than crawling the web, so a map
 * without it is refused, not filed.
 *
 * **Every ticket says which part of the map it came from.** A first ticket that serves nothing on the
 * map is a question worth asking out loud, and a founder cannot ask it if the ticket will not say.
 *
 * **The map is saved with the tickets, in the same pull request.** It goes to
 * `context/general/founding-map.md` (D8), where the venture brain indexes it and every department may
 * read it. Filed by `filePlan` beside the tickets — not by a second writer.
 *
 * Everything here is pure. Nothing writes.
 */

import type { ReplyBlock } from './composer';
import type { PlanDraft } from './plan-draft';
import { keptTickets } from './plan-draft';

/** The key that says a fenced block is a founding map. Inside the JSON, like `foundry_plan`. */
export const MAP_MARKER = 'foundry_map';

/**
 * Where the map is saved in the venture's repository.
 *
 * Under `context/general/`, not at the top of `context/`: the venture brain reads the folder after
 * `context/` as a department, and `general` is the one every department shares. A founding map is
 * background for the whole venture, not for one surface of it.
 */
export const FOUNDING_MAP_PATH = 'context/general/founding-map.md';

/** A map longer than this is not a map. Also bounds what a browser can make the studio write. */
export const MAX_MAP_CHARS = 30_000;

/** The four quadrants, in the order the walk visits them. These are the map's headings. */
export const QUADRANTS = ['Known knowns', 'Known unknowns', 'Unknown knowns', 'Unknown unknowns'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

/**
 * The five stages, as the composer names them to the founder.
 *
 * Kept here so the instructions on the box and the checks in the studio name the same things. A
 * test reads the composer's instructions and asserts every one of these appears in them.
 */
export const FOUNDING_STAGES: readonly { name: string; asks: string }[] = [
  { name: 'Known knowns', asks: 'What is already settled — decided, built or true.' },
  { name: 'Known unknowns', asks: 'The questions, one at a time, each with a suggested answer to accept or change.' },
  { name: 'Unknown knowns', asks: 'What the founder knows and has not said: taste, limits, who else has to live with it.' },
  { name: 'Unknown unknowns', asks: 'The landmines nobody knew to ask about, and how far the search for them reached.' },
  { name: 'Hand over the map', asks: 'The map, and the first tickets that come out of it, for the founder to strike or keep.' },
];

/**
 * The sentence day one's button types into the composer for the founder.
 *
 * Starting the walk is the founder's choice, not the studio's: this lands in the box, unsent, and
 * they can edit it or delete it. The same sentence is the composer's first suggested opener on the
 * box, and a test holds the two together.
 */
export const foundingOpener = (ventureName: string): string =>
  `I am starting ${ventureName}. Walk me through what we know and don't know, and help me find the first things to build.`;

export interface FoundingMap {
  venture_id: string;
  /** The idea, in the founder's own words. One or two sentences. */
  idea: string;
  /** The map itself: markdown with one `## ` heading per quadrant. */
  body: string;
}

export interface MapSection {
  quadrant: Quadrant;
  /** The points under it, as written. */
  points: string[];
}

const BULLET = /^\s{0,3}[-*+]\s+(?:\[[ xX]?\]\s*)?(.*\S)\s*$/;
const HEADING = /^\s{0,3}#{2,3}\s+(.*\S)\s*$/;

/**
 * Read a map out of what the composer wrote.
 *
 * Like `parsePlanDraft`, tolerant in one direction only: a block that is not a map reads as no map.
 * A block that claims to be one and is malformed also reads as no map, so the panel never offers
 * to save something the studio could not read.
 */
export function parseFoundingMap(raw: string | null | undefined): FoundingMap | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (!m[MAP_MARKER]) return null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const venture_id = str(m.venture_id);
  const idea = str(m.idea);
  const body = str(m.body);
  if (!venture_id || !idea || !body) return null;
  if (body.length > MAX_MAP_CHARS || idea.length > 2_000) return null;
  return { venture_id, idea, body };
}

/** The map in a composer reply, if there is one. */
export function extractFoundingMap(blocks: ReplyBlock[]): FoundingMap | null {
  for (const block of blocks) {
    if (block.kind !== 'draft') continue;
    const map = parseFoundingMap(block.text);
    if (map) return map;
  }
  return null;
}

/**
 * The plan's `source_title` when its tickets came out of a founding walk.
 *
 * The composer is told to write exactly this. It is how the studio knows a set of tickets is a
 * founding set even when the map that should travel with it is missing — and a founding set without
 * its map must not file as an ordinary plan, because then the unknown-unknowns check never runs.
 */
export const FOUNDING_SOURCE_TITLE = 'The founding map';

/** Does this plan say it came out of a founding walk? */
export const isFoundingPlan = (plan: Pick<PlanDraft, 'source_title'>): boolean =>
  /^\s*the founding map\b/i.test(plan.source_title);

const CLAIMS_MAP = new RegExp(`"${MAP_MARKER}"\\s*:`);

/**
 * Did the composer try to hand over a map in this reply, whether or not it could be read?
 *
 * One stray line break inside the JSON makes the map unreadable. Without this, an unreadable map
 * looks exactly like no map at all, and the tickets would file without it and without a word.
 */
export function claimsFoundingMap(blocks: ReplyBlock[]): boolean {
  return blocks.some((b) => b.kind === 'draft' && CLAIMS_MAP.test(b.text));
}

/** Said when a founding set arrives with no map at all. Used by the panel and by the server. */
export const MAP_NOT_SENT = 'These tickets come from a founding map, but the map itself did not come with them. '
  + 'Nothing can be filed without it. Ask the composer to hand over the map again.';

/**
 * Why a set cannot be filed because its founding map is missing or unreadable — or null.
 *
 * Only about the map arriving at all. Whether a map that did arrive is complete is `mapProblem`'s job.
 */
export function missingMapProblem(blocks: ReplyBlock[], plan: PlanDraft, map: FoundingMap | null): string | null {
  if (map) return null;
  if (claimsFoundingMap(blocks)) {
    return 'The composer sent a founding map with these tickets, but the studio could not read it, so it '
      + 'cannot be saved with them. Nothing can be filed yet. Ask the composer to hand over the map again.';
  }
  return isFoundingPlan(plan) ? MAP_NOT_SENT : null;
}

/**
 * What to tell the founder when a map arrived but the tickets that go with it did not.
 *
 * The map is the whole result of the walk. It is shown, not hidden, and the founder is told plainly
 * what is missing — never a quiet empty panel (CLAUDE.md #10).
 */
export function mapWithoutPlanProblem(map: FoundingMap | null): string {
  return map
    ? 'The composer handed over your founding map, but the first tickets that go with it could not be read. '
      + 'Nothing has been filed, and the map is not lost: it is below. Ask the composer to hand over the tickets again.'
    : 'The composer tried to hand over a founding map, but the studio could not read it or the tickets with it. '
      + 'Nothing has been filed. Ask the composer to hand over the map again.';
}

/** Which quadrant a heading names, matched loosely so "## Unknown unknowns — the landmines" counts. */
function quadrantOf(heading: string): Quadrant | null {
  const h = heading.toLowerCase().replace(/^\d+[.)]\s*/, '');
  // Longest names first is not needed: every quadrant name is two words and none is a prefix of
  // another once the second word is included.
  return QUADRANTS.find((q) => h.startsWith(q.toLowerCase())) ?? null;
}

/** The map, split into its quadrants. A quadrant the map never reached is simply absent. */
export function mapSections(map: Pick<FoundingMap, 'body'>): MapSection[] {
  const sections: MapSection[] = [];
  let current: MapSection | null = null;
  for (const line of map.body.split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      const quadrant = quadrantOf(heading[1]);
      current = quadrant ? { quadrant, points: [] } : null;
      if (current) sections.push(current);
      continue;
    }
    const point = line.match(BULLET);
    if (current && point) current.points.push(point[1]);
  }
  return sections;
}

/**
 * The one reason this map cannot be saved, in a founder's words — or null.
 *
 * The rule that matters is the last quadrant. A walk that stopped at the knowns produced a summary
 * of what the founder already believed, and filing tickets off it is the failure this ticket names:
 * tickets nobody wanted, filed quickly.
 */
export function mapProblem(map: FoundingMap): string | null {
  const sections = mapSections(map);
  const reached = (q: Quadrant) => sections.find((s) => s.quadrant === q && s.points.length > 0);
  if (!reached('Unknown unknowns')) {
    return 'The map stops before the unknown unknowns — the risks nobody has thought of yet. '
      + 'Ask the composer to finish that part before filing anything.';
  }
  const missing = QUADRANTS.filter((q) => !reached(q));
  if (missing.length) {
    return `The map has nothing under ${missing.map((q) => q.toLowerCase()).join(' or ')}. `
      + 'Ask the composer to fill that in before filing anything.';
  }
  return null;
}

/**
 * The one ticket that does not say which part of the map it came from — or null.
 *
 * A founding ticket's `source` names a quadrant ("Unknown unknowns: nobody has asked a shop…"), so a
 * founder can check it against the map before pressing. A ticket that cannot point at the map is a
 * ticket the walk did not produce.
 */
export function traceProblem(plan: PlanDraft): string | null {
  const untraced = keptTickets(plan).find((t) => !QUADRANTS.some((q) => t.source.toLowerCase().includes(q.toLowerCase())));
  return untraced
    ? `“${untraced.title}” does not say which part of the map it came from. Nothing was filed.`
    : null;
}

/** The map, as the file the venture keeps — with the tickets it produced, so both directions trace. */
export function renderFoundingMapFile(
  map: FoundingMap,
  filed: readonly { id: string; title: string; source: string }[],
): string {
  return [
    '# The founding map',
    '',
    `**The idea, in the founder’s words:** ${map.idea}`,
    '',
    map.body.trim(),
    '',
    '## The first tickets this map produced',
    '',
    ...filed.map((t) => `- **${t.id}** — ${t.title} (from: ${t.source})`),
    '',
    '---',
    '',
    'Written in the founding conversation (FB-236), walked one stage at a time, and agreed by the',
    'founder before it was filed. It is a starting position, not a promise: edit it as the venture',
    'learns. Every part of the team reads it for background.',
    '',
  ].join('\n');
}
