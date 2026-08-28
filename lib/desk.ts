/**
 * The desk's own sentences (FB-128).
 *
 * ## Why these are here rather than in the component
 *
 * Three surfaces state the same fact about how much waits on a founder: the summary sentence at the
 * top of the desk, the amber blocker banner under it, and the rail's "Needs you" badge on every
 * screen. Three renderings of one number is how a badge comes to say 15 while every column says 0 —
 * which is not hypothetical, it is FB-099.
 *
 * So the count is computed once, here, and the sentences are built from it. The desk imports these
 * and so does `lib/rail.ts`.
 *
 * ## What they will not say
 *
 * Anything the studio cannot see. The design's summary opens with a clause about what the venture is
 * for; no manifest carries one, so the sentence starts at the facts instead of inventing a purpose.
 * The same rule the surface outcomes follow (`docs/decision-surface-outcomes.md`): render what
 * exists, invent nothing.
 */

import { formatMoney, periodLabel, type Period } from './budgets';

/** Finished work waiting to be read, plus external actions proposed and waiting on a human. */
export interface WaitingInput {
  /** Pull requests carrying finished work — the attention queue. */
  openWork: number;
  /** ActiveGraph proposals: an email, a send, a spend. Nothing has happened yet. */
  awaitingApproval: number;
}

/**
 * How much waits on this founder — the one number.
 *
 * Both halves, because both are a decision only they can make. A badge that counted finished work
 * and quietly left out a proposed send would be telling a founder they were clear while something
 * external sat waiting for their word (CLAUDE.md #4).
 */
export const waitingOnFounder = (w: WaitingInput): number => w.openWork + w.awaitingApproval;

export interface DeskFacts extends WaitingInput {
  /** Tickets the engine has actually moved on — work in flight, not work filed. */
  movingTickets: number;
  /**
   * This period's committed spend and limit — summed ONLY across departments that agree on both
   * currency and period. Null when they do not, because there is no honest single figure then.
   */
  spentMinor: number | null;
  limitMinor: number | null;
  currency: string | null;
  /** The window those figures cover, so the sentence can name it instead of assuming a month. */
  period: Period | null;
  /** True when a read failed. The sentence says so rather than sounding calm over a partial picture. */
  degraded: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The one sentence at the top of the desk.
 *
 * Clauses only for the things that are true. A founder with nothing waiting, no work moving and no
 * budget set should read one short sentence, not three clauses of zeroes dressed as a report.
 */
export function deskSummary(f: DeskFacts): string {
  const clauses: string[] = [];

  const waiting = waitingOnFounder(f);
  clauses.push(waiting > 0 ? `${plural(waiting, 'decision')} ${waiting === 1 ? 'waits' : 'wait'} on you` : 'nothing waits on you');

  if (f.movingTickets > 0) {
    clauses.push(`your team is on ${plural(f.movingTickets, 'moving ticket')}`);
  }

  // Named by its actual window. `Period` is monthly, quarterly, yearly or all-time, and asserting
  // "this month" over a quarterly envelope is a false statement about a founder's own burn on the
  // lead sentence of the screen. `lib/budgets.ts` already refuses to add up mismatched currencies
  // per department; the caller applies the same rule before it gets here.
  if (f.spentMinor !== null && f.limitMinor !== null && f.currency && f.period && f.limitMinor > 0) {
    // `periodLabel` already reads "this month" / "this quarter"; only all-time needs its own words.
    const window = f.period === 'all-time' ? 'in total' : periodLabel(f.period);
    clauses.push(`${formatMoney(f.spentMinor, f.currency)} of ${formatMoney(f.limitMinor, f.currency)} is spent ${window}`);
  }

  // Joined with a semicolon and a final "and", the way the design writes it — one sentence a founder
  // reads, not a list they scan.
  const body =
    clauses.length > 2
      ? `${clauses.slice(0, -1).join('; ')}, and ${clauses[clauses.length - 1]}`
      : clauses.join('; ');

  const sentence = `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
  return f.degraded ? `${sentence} Some of this venture could not be read, so it may be incomplete.` : sentence;
}

/**
 * The amber banner, or nothing.
 *
 * It names the founder as the blocker in those words, deliberately. "3 items awaiting review" is a
 * status; "you are the blocker on 3 items" is the same fact addressed to the person who can end it,
 * and the age is what turns it from a number into a reason to act now.
 */
export function blockerLine(input: WaitingInput & {
  /**
   * How long the oldest piece of finished WORK has waited. There is no such figure for a proposed
   * external action: `committedAt` is the grant timestamp and a proposal has not been granted, so
   * the studio genuinely does not know when it was raised. Rather than quietly attribute a pull
   * request's age to a set that includes approvals, the sentence names what the age is of.
   */
  oldestMs: number | null;
}): string | null {
  const waiting = waitingOnFounder(input);
  if (waiting === 0) return null;

  // The breakdown, when there is one worth drawing. "8 items" tells a founder how much; "4 pieces of
  // finished work and 4 actions that would go outside the company" tells them what KIND, and the two
  // kinds want different things from them — one is a read, the other is a decision with a
  // consequence. This is the sentence the brief's headline used to carry; it belongs in the one
  // amber line rather than in a second block saying the same number a different way.
  const parts: string[] = [];
  if (input.openWork > 0) parts.push(`${plural(input.openWork, 'piece')} of finished work to read`);
  if (input.awaitingApproval > 0) {
    parts.push(`${plural(input.awaitingApproval, 'action')} that would go outside the company`);
  }
  const kinds = parts.length > 1 ? ` — ${parts.join(' and ')}` : '';

  const head = `You are the blocker on ${plural(waiting, 'item')}${kinds}`;
  // "the oldest" only when the age covers everything counted; otherwise it says which oldest.
  const subject = input.awaitingApproval > 0 && input.openWork > 0 ? 'the oldest piece of work' : 'the oldest';
  const days = input.oldestMs === null ? null : Math.floor(input.oldestMs / 86_400_000);
  if (days === null) return `${head}.`;
  if (days < 1) {
    const hours = Math.floor((input.oldestMs ?? 0) / 3_600_000);
    return hours < 1
      ? `${head}; ${subject} arrived just now.`
      : `${head}; ${subject} has waited ${plural(hours, 'hour')}.`;
  }
  return `${head}; ${subject} has waited ${plural(days, 'day')}.`;
}

export interface ReadFailure {
  /** The part of the venture that could not be read, when it is known. */
  where: string | null;
  /** What the studio was told, already phrased for a founder by whichever loader failed. */
  message: string;
}

export interface DegradedGroup {
  /** What went wrong, as a founder would name it. */
  cause: string;
  /** Which parts of the venture it affected. Empty when nothing named one. */
  where: string[];
}

/**
 * Read failures, grouped by cause rather than listed one per repository.
 *
 * Five lines all saying "GitHub is rate-limiting reads" is five times the alarm for one fact, and it
 * buries the one line that is different. Grouping is what makes the strip readable enough to be
 * placed where it belongs — **below** everything the founder must act on, because a thing that fixes
 * itself must not sit above a thing that does not.
 *
 * Takes the repository as a field rather than reading it out of the message. The first version
 * pattern-matched a repo name from the end of the sentence, which is a guess about prose written
 * somewhere else — and it would have gone quietly wrong the first time a message ended in any other
 * hyphenated word.
 */
export function degradedGroups(failures: ReadFailure[]): DegradedGroup[] {
  const groups = new Map<string, string[]>();
  for (const f of failures) {
    const message = f.message?.trim();
    if (!message) continue;
    const cause = causeOf(message);
    const where = groups.get(cause) ?? [];
    if (f.where && !where.includes(f.where)) where.push(f.where);
    groups.set(cause, where);
  }
  return [...groups.entries()].map(([cause, where]) => ({ cause, where }));
}

/** The few causes worth telling apart. Anything else is reported in the studio's own words. */
function causeOf(text: string): string {
  if (/rate.?limit/i.test(text)) return 'GitHub is rate-limiting reads; this desk fills in as reads succeed.';
  if (/not found|404|does not exist/i.test(text)) return 'Something this venture points at is not there yet.';
  if (/permission|forbidden|403|not allowed/i.test(text)) return 'The studio is not allowed to read part of this venture.';
  return text;
}


/**
 * What a surface has actually produced (FB-128), per `docs/decision-surface-outcomes.md`.
 *
 * The desk's last section is the only place a founder learns whether any of this worked, so it has to
 * be there — and it has to be honest, because a number nobody can source is worse than a blank. The
 * rule the memo settles, applied here:
 *
 * - **Build's line is true today.** Ticket counts come from the backlog and the preview from the box.
 * - **Sell has no source yet.** The email provider's reporting arrives with FB-142; until then the
 *   line says there is nothing reported, not "0 delivered".
 * - **Scale is not connected**, and its platform is an open decision (G3). It says that, and counts
 *   the tickets waiting on it — which is a real number the studio can see.
 *
 * No zeroes standing in for unknowns. A surface with no source says so in words.
 */
export interface SurfaceOutcomeInput {
  /** The department's own id, from the manifest. Consulted last and for one named reason. */
  departmentId: string;
  /** Tickets on this surface's own repository. Real, from the backlog. */
  ticketCount: number;
  /** The manifest declares somewhere this surface's work can be opened and seen running. */
  hasLaunch: boolean;
  /** The surface is set up at all. */
  provisioned: boolean;
}

/**
 * Read from what the manifest declares, not from what the id is called.
 *
 * The first version switched on the literal ids `build` / `sell` / `scale` and hard-coded a claim
 * about each. The concrete cost, which is the one that matters: a venture that later connects a
 * Scale surface would still be told, in the studio's own voice, that it is not connected — because
 * the sentence was never sourced from anything the venture said.
 *
 * So `hasLaunch` and `provisioned` decide it. The one id that survives is `scale`, and it names a
 * **platform** decision rather than a venture: no ad platform has been chosen (G3,
 * `docs/decision-scale-platform.md`), and that is true of the Foundry, not of any one venture. It is
 * reached only when the venture has declared nothing to the contrary — the moment a Scale surface
 * declares somewhere to open, it gets the real line like any other.
 */
export function surfaceOutcome(input: SurfaceOutcomeInput): string {
  const tickets = input.ticketCount === 0 ? 'No tickets yet' : plural(input.ticketCount, 'ticket');

  if (input.hasLaunch) return `${tickets} · preview of the app running from the venture machine.`;
  if (!input.provisioned) return `Not set up yet. ${tickets} waiting on it.`;
  if (input.departmentId === 'scale') return `Not connected · platform tbd. ${tickets} waiting on it.`;

  // Nothing has reported, which is a different fact from nothing having happened — and only one of
  // them is true. There is no analytics source anywhere in the studio yet.
  return `${tickets}. Nothing reported yet — outcomes appear here once this surface reports.`;
}
