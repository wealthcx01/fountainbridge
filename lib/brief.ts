/**
 * The founder brief (FB-042) — the venture in a paragraph, composed from what is actually true.
 *
 * Every input here is already rendered somewhere on the board. The brief exists because a board
 * shows you everything at once and tells you nothing about what to do first, and because the thing
 * a founder most needs at 22:00 is not a dashboard but a sentence.
 *
 * Two rules this file is built around.
 *
 * **It never invents a positive.** Silence is reported as silence. If the studio cannot read a
 * venture's lane state, the brief says so rather than composing a calm summary out of an empty list
 * — an empty queue and an unreachable box look identical from here, and only one of them is fine.
 *
 * **It is ordered by what needs the founder, not by what is most recent.** Things waiting on a human
 * come first, then things that stopped and cannot continue, then progress, then quiet. A brief that
 * leads with good news while a send sits unapproved is a worse brief than none.
 */

import type { RunReport, EngineState } from './runreports';
import { describeRun } from './runreports';

export interface BriefInput {
  ventureName: string;
  /** Approvals awaiting a human decision. */
  awaitingApproval: number;
  /** Open pull requests in the attention queue. */
  openPrs: number;
  /** Runs that stopped and need a person. */
  blocked: RunReport[];
  /** Runs that failed outright. */
  failed: RunReport[];
  /** Runs that finished and produced something. */
  progressed: RunReport[];
  engine: { state: EngineState; text: string };
  /** Departments over their spend limit, by name. */
  overBudget: string[];
  /** True when a read failed — the difference between "nothing to report" and "cannot tell". */
  degraded: boolean;
}

export interface BriefLine {
  /** Drives the tone in the UI. Uses the studio's status vocabulary (lib/status.ts). */
  tone: 'attention' | 'blocked' | 'working' | 'ok' | 'idle';
  text: string;
}

export interface Brief {
  /** The one sentence, if a founder reads nothing else. */
  headline: string;
  lines: BriefLine[];
  /** True when the brief is composed over an incomplete picture. */
  degraded: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function composeBrief(input: BriefInput): Brief {
  const lines: BriefLine[] = [];

  // 1. Waiting on you. Nothing outranks a person being the bottleneck.
  if (input.awaitingApproval > 0) {
    lines.push({
      tone: 'attention',
      text: `${plural(input.awaitingApproval, 'action')} outside the company ${input.awaitingApproval === 1 ? 'is' : 'are'} waiting for your approval. Nothing has been sent.`,
    });
  }
  if (input.openPrs > 0) {
    lines.push({
      tone: 'attention',
      text: `${plural(input.openPrs, 'piece of finished work', 'pieces of finished work')} ${input.openPrs === 1 ? 'is' : 'are'} waiting for your OK.`,
    });
  }

  // 2. Stopped. Each named, because "3 things are blocked" is not actionable and the reason is the
  //    entire point — this is the line non-negotiable 10 is about.
  for (const r of input.failed) lines.push({ tone: 'blocked', text: describeRun(r) });
  for (const r of input.blocked) lines.push({ tone: 'blocked', text: describeRun(r) });

  // 3. Money. After the blockers — a budget is a fact to know, not usually a thing to do tonight.
  if (input.overBudget.length > 0) {
    lines.push({
      tone: 'attention',
      text: `${input.overBudget.join(' and ')} ${input.overBudget.length === 1 ? 'is' : 'are'} over the spend limit you set.`,
    });
  }

  // 4. Progress.
  if (input.progressed.length > 0) {
    lines.push({
      tone: 'ok',
      text: `${plural(input.progressed.length, 'ticket')} moved: ${input.progressed.slice(0, 3).map((r) => r.ticketsTouched[0] ?? 'unnamed').join(', ')}${input.progressed.length > 3 ? ', and more' : ''}.`,
    });
  }

  // 5. The engine — when it is worth saying. "Nothing happened" and "nothing could happen" are the
  //    two states a founder most needs told apart, so a stalled or absent lane always appears here,
  //    and so does a healthy one when there is nothing else to report.
  //
  //    But NOT when it is healthy and something else is already on the list: the activity strip
  //    directly below prints the same sentence, and a brief that repeats the line beneath it
  //    verbatim is padding rather than a summary (FB-063).
  const engineIsNews = input.engine.state === 'stalled' || input.engine.state === 'unknown';
  if (engineIsNews || lines.length === 0) {
    lines.push({
      tone: input.engine.state === 'stalled' ? 'blocked' : input.engine.state === 'unknown' ? 'idle' : 'working',
      text: input.engine.text,
    });
  }

  if (input.degraded) {
    lines.push({
      tone: 'attention',
      text: 'Some of this venture’s state could not be read, so this summary is incomplete. It is not a sign that nothing is happening.',
    });
  }

  return { headline: headlineFor(input), lines, degraded: input.degraded };
}

/**
 * The single sentence. Same priority order as the lines, deliberately — the headline is the first
 * line's subject, not a separate editorial judgement that could disagree with the list beneath it.
 */
function headlineFor(input: BriefInput): string {
  const { ventureName } = input;
  if (input.degraded) return `${ventureName}: the studio could not read everything — this is a partial picture.`;
  if (input.awaitingApproval > 0) {
    return `${ventureName} needs you: ${plural(input.awaitingApproval, 'action')} waiting for your approval.`;
  }
  const stopped = input.failed.length + input.blocked.length;
  if (stopped > 0) return `${ventureName}: ${plural(stopped, 'thing')} stopped and ${stopped === 1 ? 'needs' : 'need'} a person.`;
  if (input.engine.state === 'stalled') return `${ventureName}: your team has stopped checking in.`;
  if (input.openPrs > 0) {
    return `${ventureName}: ${plural(input.openPrs, 'piece of finished work', 'pieces of finished work')} to read, nothing blocked.`;
  }
  if (input.progressed.length > 0) return `${ventureName}: ${plural(input.progressed.length, 'ticket')} moved, nothing needs you.`;
  if (input.engine.state === 'unknown') return `${ventureName} has no team working on it yet.`;
  return `${ventureName} is quiet — your team is awake and there is nothing waiting on you.`;
}

/** Split a run history into the buckets the brief reads. One place, so the counts cannot disagree. */
export function bucketRuns(reports: RunReport[]): Pick<BriefInput, 'blocked' | 'failed' | 'progressed'> {
  return {
    blocked: reports.filter((r) => r.outcome === 'blocked'),
    failed: reports.filter((r) => r.outcome === 'error'),
    progressed: reports.filter((r) => r.outcome === 'opened-pr' || r.outcome === 'progress'),
  };
}
