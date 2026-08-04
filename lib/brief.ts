/**
 * The founder brief (FB-042, recomposed by FB-104) — where the venture stands, in one breath.
 *
 * Every input here is already rendered somewhere on the board. The brief exists because a board
 * shows you everything at once and tells you nothing about what to do first, and because the thing
 * a founder most needs at 22:00 is not a dashboard but a sentence.
 *
 * ## Why it was rewritten
 *
 * The first version was honest and unreadable. On John's walk it opened with a partial-picture
 * disclaimer and then FIVE "Stopped:" bullets, three of them about the same ticket, each quoting the
 * machine's own validation prose verbatim. Every fact was true and the altitude was wrong: a summary
 * that prints one line per event is a log with a headline on it.
 *
 * ## The rule now
 *
 * It is an executive summary. It answers four questions — what needs you, what is stuck, what is
 * your team doing, what got done — **aggregated across everything**, in four sentences or fewer,
 * each linking to the surface that expands it. Repeated attempts at one ticket are one fact. The
 * machine's reasoning lives one click away, beside the attempt it describes, where the decision is
 * actually made.
 *
 * Two rules carried over unchanged, both load-bearing.
 *
 * **It never invents a positive.** Silence is reported as silence. If the studio cannot read a
 * venture's state, the brief says so rather than composing a calm summary out of an empty list — an
 * empty queue and an unreachable machine look identical from here, and only one of them is fine.
 *
 * **It is ordered by what needs the founder**, which is why "what is stuck" is second here and
 * fourth in FB-104's list of questions: the ticket fixes the brief's *altitude*, and the ordering
 * doctrine it inherits is the one CLAUDE.md #10 is about. Burying two stuck tickets under "3 tickets
 * finished this week" would be a new way to fail quietly.
 */

import { describeGap, type RunReport, type EngineState } from './runreports';

/** One thing in the "needs you" queue: finished work waiting to be read. */
export interface WaitingWork {
  ticketId: string | null;
  ageMs: number;
}

export interface BriefInput {
  ventureName: string;
  /** Finished work waiting to be read — the same list the attention queue renders. */
  openWork: WaitingWork[];
  /** External actions proposed and waiting on a human. Nothing has been sent. */
  awaitingApproval: number;
  /** Every run the studio could read. The brief aggregates; it does not print one line per report. */
  runs: RunReport[];
  engine: { state: EngineState; text: string; ageMinutes: number | null };
  /** Ticket id → its human title, so a stuck ticket reads by name rather than by number. */
  ticketTitles?: Record<string, string>;
  /** Departments over their spend limit, by name. */
  overBudget: string[];
  /** True when a read failed — the difference between "nothing to report" and "cannot tell". */
  degraded: boolean;
  /** Now, for "this week". Injected so the sentence is testable. */
  now?: number;
}

export interface BriefLine {
  /** Drives the tone in the UI. Uses the studio's status vocabulary (lib/status.ts). */
  tone: 'attention' | 'blocked' | 'working' | 'ok' | 'idle';
  text: string;
  /** Where this sentence is expanded. The brief is a way in, not a report. */
  href?: string;
}

export interface Brief {
  /** The one sentence, if a founder reads nothing else. It is the first sentence, not a fifth. */
  headline: string;
  /** Where the headline is expanded — the same link its sentence carries. */
  headlineHref?: string;
  lines: BriefLine[];
  /** True when the brief is composed over an incomplete picture. */
  degraded: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The activity strip further down the board — where each run's own account of itself is printed. */
const ACTIVITY_ANCHOR = '#what-your-team-is-doing';

/** "a, b and c", capped — a list of six ticket names is not a summary. */
function names(list: string[], cap = 3): string {
  const shown = list.slice(0, cap);
  const rest = list.length - shown.length;
  const joined =
    shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] ?? '';
  return rest > 0 ? `${joined}, and ${rest} more` : joined;
}

/**
 * What one ticket is called, for a founder. Falling back to the id is not a failure: a ticket the
 * board is not currently showing still has a name the founder will recognise from the queue.
 */
const titleOf = (id: string, titles: Record<string, string>) => titles[id] ?? id;

/**
 * The tickets that are stuck, deduplicated, in the order they were last seen.
 *
 * Three failed attempts at one ticket is ONE fact about ONE ticket. The previous brief printed a
 * line per report, so a lane retrying overnight produced a brief that grew while the situation
 * stayed the same — the founder read escalation where there was only repetition.
 */
export function stuckTickets(runs: RunReport[]): string[] {
  const out: string[] = [];
  for (const r of runs) {
    if (r.outcome !== 'blocked' && r.outcome !== 'error') continue;
    // A run with no ticket is still one stuck thing; keyed by where it ran so it dedupes too.
    const key = r.ticketsTouched[0] ?? `${r.repo}/${r.laneId}`;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/** 1. What needs you, and how many? One number, one link into the queue. */
function needsYou(input: BriefInput): BriefLine | null {
  const work = input.openWork.length;
  const sends = input.awaitingApproval;
  if (work + sends === 0) return null;

  const oldestMs = input.openWork.reduce((max, w) => Math.max(max, w.ageMs), 0);
  const oldest =
    work > 0 && oldestMs >= 60_000 ? ` — the oldest has waited ${describeGap(Math.floor(oldestMs / 60_000))}` : '';

  // An external send is not the same kind of thing as finished work to read, and flattening the two
  // into one number would lose the distinction the studio treats as absolute (CLAUDE.md #4). So the
  // count aggregates — that is what was asked for — and the sentence still names both halves.
  let text: string;
  if (work > 0 && sends > 0) {
    text =
      `${work + sends} things are waiting for your OK: ` +
      `${plural(work, 'piece of finished work', 'pieces of finished work')} to read, and ` +
      `${plural(sends, 'action')} that would go outside the company${oldest}.`;
  } else if (work > 0) {
    text = `${plural(work, 'piece of finished work', 'pieces of finished work')} ${
      work === 1 ? 'is' : 'are'
    } waiting for your OK${oldest}.`;
  } else {
    text = `${plural(sends, 'action')} ${sends === 1 ? 'is' : 'are'} waiting for your OK before ${
      sends === 1 ? 'it goes' : 'they go'
    } outside the company — nothing has been sent.`;
  }
  return { tone: 'attention', text, href: '/attention' };
}

/** 2. What is stuck? One line, deduplicated by ticket, named — never the machine's own prose. */
function stuck(input: BriefInput): BriefLine | null {
  const ids = stuckTickets(input.runs);
  if (ids.length === 0) return null;
  const n = ids.length;
  return {
    tone: 'blocked',
    // Deliberately no reason here. The reason is the machine's account of one attempt, and it belongs
    // beside that attempt — quoting it up into the summary is what turned the brief into a log.
    text: `${plural(n, 'ticket')} ${n === 1 ? 'is' : 'are'} stuck and ${
      n === 1 ? 'needs' : 'need'
    } a human: ${names(ids.map((id) => titleOf(id, input.ticketTitles ?? {})))}.`,
    href: ACTIVITY_ANCHOR,
  };
}

/**
 * 3 + 4. What is your team doing, and what got done lately?
 *
 * One sentence for two questions. They share a subject — the team — and keeping them apart spent a
 * line of a four-line budget on a clause, which mattered as soon as the spend limit needed a line.
 */
function team(input: BriefInput): BriefLine | null {
  const now = input.now ?? Date.now();

  // Counted by TICKET, not by report: a ticket touched by three progress runs finished once.
  const finishedIds = new Set(
    input.runs
      .filter((r) => (r.outcome === 'opened-pr' || r.outcome === 'progress') && r.endedAt)
      .filter((r) => now - Date.parse(r.endedAt as string) <= WEEK_MS)
      .map((r) => r.ticketsTouched[0])
      .filter((t): t is string => !!t),
  );
  const finished = finishedIds.size > 0 ? ` and has finished ${plural(finishedIds.size, 'ticket')} this week` : '';

  // Not running: the engine's own sentence already says the whole truth loudly, and this is the one
  // state where adding to it is worse than letting it stand.
  if (input.engine.state !== 'running') {
    return {
      tone: input.engine.state === 'stalled' ? 'blocked' : 'idle',
      text: input.engine.text,
      href: ACTIVITY_ANCHOR,
    };
  }

  const inFlight = input.runs.find((r) => r.outcome === null && r.ticketsTouched[0]);
  const checked =
    input.engine.ageMinutes !== null && input.engine.ageMinutes > 1
      ? `; it checked in ${describeGap(input.engine.ageMinutes)} ago`
      : '; it checked in just now';
  const doing = inFlight
    ? `Your team is working on ${titleOf(inFlight.ticketsTouched[0], input.ticketTitles ?? {})}`
    : 'Your team has nothing in hand right now';

  return { tone: inFlight ? 'working' : 'ok', text: `${doing}${finished}${checked}.`, href: ACTIVITY_ANCHOR };
}

/** The money. Not one of FB-104's four questions, but it is a decision sitting with the founder. */
function money(input: BriefInput): BriefLine | null {
  if (input.overBudget.length === 0) return null;
  return {
    tone: 'attention',
    text: `${names(input.overBudget)} ${input.overBudget.length === 1 ? 'is' : 'are'} over the spend limit you set.`,
    href: '/attention',
  };
}

export function composeBrief(input: BriefInput): Brief {
  // Ordered by what needs the founder. See the header note on why "stuck" comes second.
  const waiting = needsYou(input);
  const stopped = stuck(input);

  // "Nothing is waiting on you" is the answer to question one, and the one a founder opening the
  // board at 22:00 most wants — but only when it is both true and worth leading with:
  //
  //   - not over an incomplete read, where it would be a positive the brief invented; and
  //   - not while the team itself is silent, because "nothing needs you" above "your team has not
  //     checked in for 3 hours" is reassurance in front of the bad news, which is the shape of
  //     failure CLAUDE.md #10 exists to prevent.
  const clear: BriefLine | null =
    !waiting && !stopped && !input.degraded && input.engine.state === 'running'
      ? { tone: 'ok', text: 'Nothing is waiting on you.', href: '/attention' }
      : null;

  const sentences = [waiting ?? clear, stopped, team(input), money(input)].filter(
    (l): l is BriefLine => l !== null,
  );

  // Everything the brief could not compute, once, at the end — never a competing bullet per failure,
  // and never the headline: "we could not read everything" is not the most important thing about a
  // venture with two stuck tickets.
  if (input.degraded) {
    sentences.push({
      tone: 'attention',
      text: 'Part of the picture could not be read, so these numbers may be low. It is not a sign that nothing is happening.',
    });
  }

  // Only reachable if the studio knows nothing at all about this venture — no queue, no runs, and no
  // read failure to explain the silence. Saying so plainly beats an empty card.
  if (sentences.length === 0) {
    return { headline: `${input.ventureName} is quiet — there is nothing to report.`, lines: [], degraded: false };
  }

  // The headline IS the first sentence, not a fifth one written separately. Two authors of "what
  // matters most" is how a headline ends up disagreeing with the list beneath it.
  const [first, ...rest] = sentences;
  return {
    headline: `${input.ventureName}: ${first.text.charAt(0).toLowerCase()}${first.text.slice(1)}`,
    headlineHref: first.href,
    lines: rest,
    degraded: input.degraded,
  };
}

/** Split a run history into the buckets the board reads. One place, so the counts cannot disagree. */
export function bucketRuns(reports: RunReport[]): {
  blocked: RunReport[];
  failed: RunReport[];
  progressed: RunReport[];
} {
  return {
    blocked: reports.filter((r) => r.outcome === 'blocked'),
    failed: reports.filter((r) => r.outcome === 'error'),
    progressed: reports.filter((r) => r.outcome === 'opened-pr' || r.outcome === 'progress'),
  };
}
