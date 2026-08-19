/**
 * The paragraph "What happened" opens with (FB-108).
 *
 * The page was a well-ordered list with no reader's digest. A founder back after three days away
 * wants what a chief of staff would open with — *what moved, and where it is heading* — and instead
 * started cold on item one of forty.
 *
 * ## Composed, not modelled
 *
 * Every sentence here is deterministic aggregation over the events the page is already rendering.
 * That is the point: the summary is testable, costs nothing, and cannot be wrong in a way the rows
 * below contradict. FB-108 leaves room for a model-written line later, behind a cache — but the
 * deterministic line has to stand on its own first, because a page that waits on a model to say
 * what happened is a page that sometimes says nothing.
 *
 * ## One computation, two surfaces
 *
 * It takes the events **after** the page has deduplicated and filtered them, so the numbers in the
 * paragraph are arithmetic on the rows underneath. There is no second pass that could drift. The
 * board's brief (FB-104) reads the same classification, so "9 pieces of work" means the same thing
 * in both places.
 *
 * ## Vocabulary
 *
 * Everything here lands on a founder's screen, so it obeys the vocabulary contract (FB-103,
 * `scripts/copy-lint.mjs`): work is *finished*, never "merged"; it is *your team*, never a lane.
 */

import { classifyActivity, type ActivityMeaning, type ClassifiableEvent } from './activity-kind';

/** An event as the activity page holds it: what it was called, when, and what it touched. */
export interface SummaryEvent extends ClassifiableEvent {
  /** ISO timestamp. Used only for ordering — the window itself is the caller's decision. */
  at: string;
}

export interface ActivitySummaryInput {
  /** Events already deduplicated and filtered to what this reader may see. */
  events: readonly SummaryEvent[];
  /** The window the page is showing, in days. */
  windowDays: number;
  /**
   * What the still-open work is aimed at, most common first — e.g. ['pricing', 'brand'].
   * Omitted or empty means the third sentence is not written at all, rather than guessed.
   */
  openAreas?: readonly string[];
}

export interface ActivitySummary {
  /** Nought to three sentences. Empty when there is nothing true to say. */
  sentences: readonly string[];
  counts: {
    total: number;
    shipped: number;
    asked: number;
    learned: number;
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Join a list the way a person would: "a", "a and b", "a, b and c".
 *
 * Oxford comma deliberately absent — the studio's copy is British, and the founder-facing pages
 * already read that way.
 */
export function sentenceList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * A lane names its work for itself, not for a founder: `build: ARCA-050-show-set-name-card-pages
 * (Foundry lane)`. Read that back as the founder's own request — the words they would recognise.
 */
export function readableTitle(title: string): string {
  let t = title.trim();
  t = t.replace(/\s*\((?:the\s+)?foundry lane\)\s*$/i, ''); //   trailing actor tag
  t = t.replace(/^(?:build|fix|feat|chore|docs|tickets?|ticket)\s*:\s*/i, ''); // conventional prefix

  // Order matters. `ARCA-050-show-set-name-card-pages` is an id-prefixed *filename*, and it has to
  // be recognised as one BEFORE the "leading id" rule below — otherwise that rule eats `ARCA-050-`
  // and leaves `show-set-name-card-pages`, a slug pretending to be a sentence.
  const slug = t.match(/^[A-Z]{2,}-\d+[a-z]?-([^\s]+)$/);
  if (slug) {
    t = slug[1].replace(/-/g, ' ');
  } else {
    // `ARCA-51 — Cards page crashes`: a real separator, so a bare hyphen does not count. Requiring
    // the spaces is what keeps this rule off the filename case above.
    t = t.replace(/^[A-Z]{2,}-\d+[a-z]?(?:\s*[—–:]\s*|\s+-\s+)/, '');
  }

  t = t.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** How many of each kind, over the events the reader can actually see. */
function tally(events: readonly SummaryEvent[]) {
  const counts: Record<ActivityMeaning, number> = {
    'ticket-filed': 0,
    'work-shipped': 0,
    'knowledge-added': 0,
    plumbing: 0,
    unknown: 0,
  };
  for (const e of events) counts[classifyActivity(e)] += 1;
  return counts;
}

/**
 * Sentence 1 — how much, and of what kind.
 *
 * Leads with finished work because that is the question being asked. Asked-for and learned are
 * named only when they happened, so the sentence never carries a "0" a founder has to decode.
 */
function aggregateSentence(c: ReturnType<typeof tally>, windowDays: number): string | null {
  const shipped = c['work-shipped'];
  const asked = c['ticket-filed'];
  const learned = c['knowledge-added'];
  const other = c.unknown;
  const total = shipped + asked + learned + other;
  if (total === 0) return null;

  const window = `In the last ${windowDays} days`;

  const parts: string[] = [];
  if (asked > 0) parts.push(`${asked} new ${plural(asked, 'request', 'requests')} from you`);
  if (learned > 0) {
    parts.push(`${learned} ${plural(learned, 'addition', 'additions')} to what your venture knows`);
  }

  if (shipped === 0) {
    // Nothing finished. Say that plainly rather than dressing up the other numbers as progress.
    if (parts.length === 0) return `${window} there were ${total} ${plural(total, 'change', 'changes')}, and nothing finished yet.`;
    return `${window} nothing was finished yet — ${sentenceList(parts)}.`;
  }

  const head = `${window} your team finished ${shipped} ${plural(shipped, 'piece', 'pieces')} of work`;
  return parts.length === 0 ? `${head}.` : `${head}, alongside ${sentenceList(parts)}.`;
}

/** Sentence 2 — the two or three most recent, by the name the founder would recognise. */
function recentSentence(events: readonly SummaryEvent[]): string | null {
  const named = [...events]
    .filter((e) => classifyActivity(e) === 'work-shipped')
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3)
    .map((e) => readableTitle(e.title))
    .filter((t) => t.length > 0);
  if (named.length === 0) return null;
  return `Most recently: ${sentenceList(named)}.`;
}

/** Sentence 3 — where the still-open work points. Written only when the caller knows. */
function directionSentence(openAreas: readonly string[] | undefined): string | null {
  const areas = (openAreas ?? []).filter((a) => a.trim().length > 0).slice(0, 3);
  if (areas.length === 0) return null;
  return `Most of the work still open is aimed at ${sentenceList(areas)}.`;
}

/**
 * The opening paragraph: how much, what recently, aimed where.
 *
 * Any sentence with nothing true to say is left out rather than padded, so a quiet fortnight reads
 * as one honest line instead of three hedged ones.
 */
export function composeActivitySummary(input: ActivitySummaryInput): ActivitySummary {
  const counts = tally(input.events);
  const sentences = [
    aggregateSentence(counts, input.windowDays),
    recentSentence(input.events),
    directionSentence(input.openAreas),
  ].filter((s): s is string => s !== null);

  return {
    sentences,
    counts: {
      total: input.events.length,
      shipped: counts['work-shipped'],
      asked: counts['ticket-filed'],
      learned: counts['knowledge-added'],
    },
  };
}
