/**
 * A piece of work, as a founder needs to see it (FB-064).
 *
 * Until now the studio could tell a founder that work was waiting for them and then hand them a link
 * to github.com. Three of the seven steps in the loop happened in a developer tool they were never
 * meant to open. This is the read model behind the surface that ends that.
 *
 * ## The honesty rule this file exists to enforce
 *
 * A founder can genuinely judge prose — a ticket, a positioning document, a piece of copy. They
 * cannot judge a TypeScript diff, and showing them one dressed up as a review is asking them to
 * rubber-stamp something they cannot read. So changes are CLASSIFIED, and code is described rather
 * than displayed: what it touches, how much of it, and the evidence that actually bears on the
 * decision — did the checks pass, is there a preview to look at.
 *
 * That is not a limitation to apologise for. The lane has already reviewed and tested its own work
 * (FB-041's `/review` and `/qa` gates); the founder is accepting an outcome, not auditing an
 * implementation.
 */

import type { PrCiStatus } from './attention';

/** What kind of change this is, from the founder's point of view — not the file extension's. */
export type ChangeKind = 'description' | 'writing' | 'knowledge' | 'code' | 'settings';

export interface ChangedFile {
  path: string;
  kind: ChangeKind;
  added: number;
  removed: number;
  /** The added lines, for kinds a founder can read. Never populated for code. */
  preview: string | null;
}

/**
 * Work out what the automatic checks actually say, from both places GitHub keeps them.
 *
 * GitHub has two check systems and neither one sees the other:
 *
 *  - **Commit statuses** (`/commits/:sha/status`) — what deploy bots like Railway post.
 *  - **Check runs** (`/commits/:sha/check-runs`) — what GitHub Actions posts, i.e. our CI.
 *
 * Reading only the first produced a wrong answer in both directions, and the live test found both:
 *
 *  1. ARCA has no commit statuses at all, and the combined endpoint answers `"pending"` with
 *     `total_count: 0` for that — so every ARCA PR sat behind "the checks are still running"
 *     forever and no work could ever be accepted.
 *  2. This studio's own PRs have exactly one commit status (the Railway deploy) and eighteen check
 *     runs (the real CI). "All checks passed" was being claimed from the deploy alone — a CI failure
 *     with a healthy deploy would have read as green.
 *
 * `unknown` (no checks exist anywhere) is deliberately distinct from `unavailable` (the read
 * failed): the first is safe to accept over, the second must never be.
 */
export interface CheckSignals {
  /** The commit-status roll-up. `total` matters: 0 statuses is not the same as 0 verdicts. */
  combined?: { state: string; total: number } | null;
  checkRuns?: Array<{ status: string; conclusion: string | null }>;
  /**
   * Set when GitHub reported more check runs than were fetched. The list is paginated, so a failing
   * run can sit on a page we never asked for — and a green verdict read off a partial list is
   * exactly the false pass this whole function exists to prevent.
   */
  checkRunsTruncated?: boolean;
}

export function combineChecks(signals: CheckSignals): PrCiStatus {
  let failure = false, pending = false, success = false;

  if (signals.combined && signals.combined.total > 0) {
    const s = signals.combined.state;
    if (s === 'success') success = true;
    else if (s === 'failure' || s === 'error') failure = true;
    else pending = true;
  }

  for (const run of signals.checkRuns ?? []) {
    if (run.status !== 'completed') { pending = true; continue; }
    switch (run.conclusion) {
      case 'success': success = true; break;
      // Neutral, skipped and stale are explicitly not verdicts — a skipped job must not be able to
      // make a change look checked when nothing checked it.
      case 'neutral': case 'skipped': case 'stale': break;
      case null: pending = true; break;
      default: failure = true; // failure, cancelled, timed_out, action_required, startup_failure
    }
  }

  // A failure we can see is a failure regardless of what we could not. Anything softer than that,
  // read off an incomplete list, is a guess — and this gate does not guess.
  if (failure) return 'failure';
  if (signals.checkRunsTruncated) return 'unavailable';
  if (pending) return 'pending';
  if (success) return 'success';
  return 'unknown';
}

/** Why accepting is refused. Each maps to a sentence the founder can act on. */
export type BlockedReason =
  | 'checks-running'
  | 'checks-failed'
  | 'checks-unreadable'
  | 'conflicts'
  | 'already-merged'
  | 'closed'
  | 'moved'
  | 'not-configured';

export interface WorkItem {
  repo: string;
  number: number;
  title: string;
  /** The ticket this work belongs to, when it names one. */
  ticketId: string | null;
  /**
   * What the team that made this said about it. For lane-built work this carries the gate evidence —
   * which validation gates held, whether /review cleared it, what /qa saw — and that is precisely
   * what a founder should weigh when the change itself is code they cannot read.
   */
  description: string | null;
  author: string | null;
  createdAt: string;
  checks: PrCiStatus;
  previewUrl: string | null;
  merged: boolean;
  state: 'open' | 'closed';
  /** GitHub's own answer; null when it has not finished computing one. */
  mergeable: boolean | null;
  /** The head commit these words were rendered from — the accept click is bound to it. */
  headSha: string;
  files: ChangedFile[];
  /** Files beyond the render cap, so a truncated list never reads as the whole change. */
  moreFiles: number;
  /**
   * What the founder ASKED FOR — the originating ticket, read whole (FB-107).
   *
   * The work page used to show the ask last, and as a diff fragment: the changed-file preview of a
   * ticket is the lines the lane touched, so a status flip rendered as `**Status:** Done` and a
   * stray `- [x]`. A founder judging "is this what I asked for?" needs the ask itself, first, in
   * one piece. Null when this work does not carry its ticket.
   */
  ask: { id: string; title: string; bodyMd: string } | null;
  /**
   * Where this work lives on the code host. A REFERENCE, never a requirement: the studio's own
   * copy is the one a founder reads, and this is the door for the day they want to see the
   * original (FB-107 — the drawer over-linked to it, this page did not link at all).
   */
  url: string | null;
}

const CODE = /\.(tsx?|jsx?|mjs|cjs|py|rs|go|rb|java|kt|swift|sh|bash|sql|css|scss|html)$/i;
const SETTINGS = /\.(json|ya?ml|toml|ini|env|lock)$|^\.|(^|\/)(Dockerfile|Makefile)$/i;

/** Classify a changed file by what it means to a founder, not by its extension alone. */
export function classify(path: string): ChangeKind {
  if (/^docs\/tickets\//.test(path)) return 'description';
  // The founder's own deposited knowledge — the things they told the studio about their venture.
  if (/^(context|library)\//.test(path)) return 'knowledge';
  if (CODE.test(path)) return 'code';
  if (SETTINGS.test(path)) return 'settings';
  if (/\.(md|mdx|txt)$/i.test(path)) return 'writing';
  return 'code'; // unknown → treated as code, i.e. described rather than displayed
}

/** Can a founder read this change directly, or must it be described? */
export const isReadable = (kind: ChangeKind): boolean => kind !== 'code' && kind !== 'settings';

/**
 * Pull the added lines out of a unified patch, for the kinds a founder can read.
 *
 * Deliberately only additions: a founder reading new copy wants the copy, not the diff syntax around
 * it. Returns null when there is nothing readable, so the caller shows the honest description
 * instead of an empty box.
 */
export function readableAdditions(patch: string | undefined, limit = 60): string | null {
  if (!patch) return null;
  const lines = patch.split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1));
  const meaningful = lines.filter((l) => l.trim().length > 0);
  if (meaningful.length === 0) return null;
  const shown = lines.slice(0, limit).join('\n').trimEnd();
  return lines.length > limit ? `${shown}\n…` : shown;
}

/**
 * One sentence describing a change the founder cannot read, so the absence of a diff is never just a
 * gap. Says what it touches and how big it is — enough to know whether the size matches the ask.
 */
export function describeChange(f: ChangedFile): string {
  const size = f.added + f.removed;
  const scale = size > 200 ? 'a large change' : size > 40 ? 'a moderate change' : 'a small change';
  const name = f.path.split('/').pop() ?? f.path;
  if (f.kind === 'settings') return `${scale} to a settings file (${name}).`;
  return `${scale} to the app's code (${name}) — ${f.added} lines added, ${f.removed} removed.`;
}

/**
 * Can this be accepted, and if not, what does the founder do about it?
 *
 * `seenHeadSha` is the commit the page was rendered from. Without it, a founder could read one thing
 * and accept another that landed in between — the same binding FB-058 added to approvals, for the
 * same reason: noticing afterwards is not the same as it being impossible.
 */
export function acceptability(
  work: Pick<WorkItem, 'checks' | 'mergeable' | 'merged' | 'state' | 'headSha'>,
  opts: { seenHeadSha?: string; configured: boolean },
): { ok: true } | { ok: false; reason: BlockedReason; text: string; nextStep: string } {
  if (!opts.configured) {
    return {
      ok: false, reason: 'not-configured',
      text: 'This studio is not set up to accept work yet.',
      nextStep: 'An admin needs to finish setting up the studio before you can accept from here.',
    };
  }
  if (work.merged) {
    return { ok: false, reason: 'already-merged', text: 'This has already been accepted.', nextStep: '' };
  }
  if (work.state === 'closed') {
    return {
      ok: false, reason: 'closed',
      text: 'This work was closed without being accepted.',
      nextStep: 'Ask for it again in the chat if you still want it.',
    };
  }
  if (opts.seenHeadSha && opts.seenHeadSha !== work.headSha) {
    return {
      ok: false, reason: 'moved',
      text: 'This work changed after the page loaded, so it was not accepted.',
      nextStep: 'Refresh and read it again before accepting.',
    };
  }
  if (work.checks === 'failure') {
    return {
      ok: false, reason: 'checks-failed',
      text: 'The automatic checks on this work did not pass.',
      nextStep: 'Leave it — the team that made it will see the failure and fix it.',
    };
  }
  if (work.checks === 'pending') {
    return {
      ok: false, reason: 'checks-running',
      text: 'The automatic checks are still running.',
      nextStep: 'Give it a few minutes and refresh.',
    };
  }
  // Not the same as having no checks: here the studio asked and did not get an answer. Accepting on
  // a gate that could not read its own evidence is the one failure this whole surface exists to
  // prevent, so it blocks — and says so rather than pretending the work is clean.
  if (work.checks === 'unavailable') {
    return {
      ok: false, reason: 'checks-unreadable',
      text: 'The studio could not find out whether the automatic checks passed.',
      nextStep: 'Try again in a few minutes. If it keeps happening, tell us — something is wrong with the studio, not your work.',
    };
  }
  // `mergeable: null` means GitHub has not finished working it out — treat as not-yet, never as yes.
  if (work.mergeable === false || work.mergeable === null) {
    return {
      ok: false, reason: 'conflicts',
      text: 'This work clashes with something else that changed since it was written.',
      nextStep: 'The team needs to bring it up to date before it can be accepted.',
    };
  }
  return { ok: true };
}

/** The founder-facing summary of what this change contains, without listing files. */
export function summariseChanges(files: ChangedFile[], moreFiles = 0): string {
  if (files.length === 0) return 'No changes recorded.';
  const counts = new Map<ChangeKind, number>();
  for (const f of files) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const say: string[] = [];
  const label: Record<ChangeKind, [string, string]> = {
    description: ['the description of the work', 'descriptions of the work'],
    writing: ['a piece of writing', 'pieces of writing'],
    knowledge: ['something your venture knows', 'things your venture knows'],
    code: ['a change to the app', 'changes to the app'],
    settings: ['a settings change', 'settings changes'],
  };
  for (const [kind, n] of counts) say.push(n === 1 ? label[kind][0] : `${n} ${label[kind][1]}`);
  const total = files.length + moreFiles;
  const list = say.length === 1 ? say[0] : `${say.slice(0, -1).join(', ')} and ${say[say.length - 1]}`;
  return `${total} file${total === 1 ? '' : 's'}: ${list}.`;
}


/**
 * The URL where this work can actually be seen running (FB-064 follow-up).
 *
 * Deployment providers advertise a preview two different ways, and neither is the GitHub
 * `deployments` API — that one's `environment_url` points at the provider's own dashboard, which is
 * a console a founder has no business in.
 *
 *  - Vercel and Netlify put the app URL in a commit status's `target_url`.
 *  - Railway puts the Railway dashboard in `target_url` and the app's hostname in the DESCRIPTION
 *    ("Success - foundry-studio-fountainbridge-pr-67.up.railway.app").
 *
 * So both are read, and anything that looks like a provider console is rejected. A wrong link here
 * is worse than none: "see it running" that opens a deployment dashboard is a broken promise on the
 * one control meant to let a founder judge what they cannot read.
 */
const CONSOLE_HOSTS = /\b(railway\.com|railway\.app\/project|vercel\.com|app\.netlify\.com|github\.com)\b/i;
const APP_HOST = /\b([a-z0-9][a-z0-9-]*\.(?:up\.railway\.app|vercel\.app|netlify\.app|pages\.dev))\b/i;

export function previewUrlFrom(
  statuses: Array<{ state?: string; description?: string | null; target_url?: string | null }>,
): string | null {
  for (const s of statuses) {
    if (s.state && s.state !== 'success') continue;
    // The hostname in the description (Railway's shape).
    const fromText = s.description?.match(APP_HOST)?.[1];
    if (fromText) return `https://${fromText}`;
    // A target_url that is the app rather than the provider's console (Vercel/Netlify's shape).
    const t = s.target_url;
    if (t && !CONSOLE_HOSTS.test(t) && APP_HOST.test(t)) return t;
  }
  return null;
}
