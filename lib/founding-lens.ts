/**
 * The strategic lens the founding conversation applies (FB-069).
 *
 * ## The gap this closes
 *
 * The studio ships twelve playbook chapters and nine handbook chapters covering Disciplined
 * Entrepreneurship's 24 steps and Hamilton Helmer's 7 Powers. **The composer's instructions mention
 * none of it.** The studio teaches a method in one room and hands founders an assistant that has
 * never read it — so "build me a landing page" becomes a well-formed piece of work without anyone
 * asking whether a landing page is the right first move, or what stops a competitor doing the same
 * thing next month.
 *
 * ## It reads the playbook rather than restating it
 *
 * Every power below is parsed out of `content/playbook/09-seven-powers.md`, including *when* each one
 * becomes buildable. Restating them here as a constant would have been quicker and would have
 * created a second source of truth that drifts from the chapter a founder can actually read — and
 * the acceptance criterion is precisely that the composer can **quote the studio's own playbook
 * rather than paraphrasing from memory**.
 *
 * ## The judgement this file exists to encode
 *
 * A founder who wanted to file one small ticket must not be dragged through a strategy interview.
 * Coaching belongs at the founding conversation and at genuinely strategic moments, and nowhere
 * else. Getting that boundary wrong makes the product exhausting, which is worse than making it
 * shallow — so `wantsStrategicLens` is deliberately narrow and errs towards staying quiet.
 */

import { loadPlaybook, type PlaybookSection } from './playbook';

/**
 * When a power can actually be built, in Helmer's terms.
 *
 * `origination` is the only one available to a venture with no customers yet — which is the whole
 * point of asking. A founder claiming scale economies on day one is claiming something that cannot
 * be true, and the conversation should say so rather than write it down approvingly.
 */
export type PowerPhase = 'origination' | 'takeoff' | 'stability';

export interface Power {
  name: string;
  phase: PowerPhase;
  /** The chapter's own sentence about when it becomes buildable — quoted, never paraphrased. */
  whenBuildable: string;
}

// The loader strips the numeric filename prefix: `09-seven-powers.md` → `seven-powers`.
const POWERS_SLUG = 'seven-powers';

const PHASES: Record<string, PowerPhase> = {
  origination: 'origination',
  takeoff: 'takeoff',
  stability: 'stability',
};

/**
 * Pull the powers out of the playbook chapter.
 *
 * Returns [] rather than throwing if the chapter is missing or its shape changes: the founding
 * conversation degrading to "no power guidance" is survivable, and a studio that will not render
 * because a markdown heading moved is not.
 */
export function parsePowers(markdown: string): Power[] {
  const powers: Power[] = [];
  // `## 3. Counter-Positioning` … `**When buildable.** *Origination* — …`
  const sections = markdown.split(/^## \d+\.\s+/m).slice(1);
  for (const section of sections) {
    const name = section.split('\n')[0]?.trim();
    const when = section.match(/\*\*When buildable\.\*\*\s*\*([A-Za-z]+)\*\s*(—[^\n]*)/);
    if (!name || !when) continue;
    const phase = PHASES[when[1].toLowerCase()];
    if (!phase) continue;
    powers.push({ name, phase, whenBuildable: `${when[1]} ${when[2]}`.trim() });
  }
  return powers;
}

/** The powers, read from the shipped playbook. */
export function loadPowers(sections: PlaybookSection[] = loadPlaybook()): Power[] {
  const chapter = sections.find((s) => s.slug === POWERS_SLUG);
  return chapter ? parsePowers(chapter.body) : [];
}

/** The ones a venture with no customers can actually start building today. */
export const availableAtFounding = (powers: Power[]): Power[] => powers.filter((p) => p.phase === 'origination');

/** The ones a founder cannot honestly claim yet, and why not. */
export const notYetAvailable = (powers: Power[]): Power[] => powers.filter((p) => p.phase !== 'origination');

/**
 * The questions the frameworks ask, in the order they ask them.
 *
 * Not a quiz — the shape of a conversation. The fourth is the one founders skip and the one that
 * decides whether the company is worth building, so it is asked plainly and its follow-up refuses
 * the answer founders reach for first.
 */
export const FOUNDING_QUESTIONS: readonly { ask: string; refuse?: string }[] = [
  {
    ask: 'Who exactly is this for?',
    refuse: 'A category is not a segment. "Card collectors" describes a market, not the person whose week changes.',
  },
  { ask: 'What do they do about it today, and what does that cost them?' },
  { ask: 'What has to be true for them to switch?' },
  {
    ask: 'What would stop someone copying this once it works?',
    refuse: 'A list of features is not a barrier. Every one of them can be built by someone else next month.',
  },
  { ask: 'What would have to be false for this to be a bad idea?' },
];

/**
 * Is this a moment for the lens at all?
 *
 * Deliberately narrow. The cost of a false positive — interrogating someone who asked for a button
 * to move — is much higher than the cost of a false negative, because the second is merely a missed
 * opportunity and the first teaches a founder that talking to the studio is expensive.
 */
export function wantsStrategicLens(input: {
  /** Has this venture produced anything yet? A venture with history is past its founding conversation. */
  hasHistory: boolean;
  /** Did the founder ask for the founding conversation explicitly? */
  explicitlyAsked?: boolean;
  /** What they typed, for the strategic-shape test below. */
  message?: string;
}): boolean {
  if (input.explicitlyAsked) return true;
  if (!input.hasHistory) return true; // day one: this IS the founding conversation
  return isStrategicAsk(input.message ?? '');
}

/**
 * Does this ask reach past "make this change" into "what should we be doing"?
 *
 * Matches the question being asked, not the size of the work. "Should we build X or Y" is strategic
 * at any size; "rewrite the whole billing page" is large and not strategic at all.
 */
export function isStrategicAsk(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.trim()) return false;
  return [
    /\bshould we\b/,
    /\bwhat should\b/,
    /\bwhich (?:one|of these|should)\b/,
    /\bis (?:it|this) worth\b/,
    /\bpivot\b/,
    /\bstrateg/,
    /\bpositioning\b/,
    /\bbusiness model\b/,
    /\bmoat\b/,
    /\bcompetitor/,
    // Words may sit in between: "who is this ACTUALLY for" is the same question.
    /\bwho (?:is|are)\b[^?.]{0,30}\bfor\b/,
    /\bworth building\b/,
  ].some((re) => re.test(m));
}
