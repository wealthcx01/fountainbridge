/**
 * The studio's ONE status vocabulary (FB-057).
 *
 * Before this, every surface picked its own colour with an inline ternary: a failed CI run was red
 * on /activity, a stale lane was amber on the board, an unapproved external action was amber in a
 * card — each decided locally, none of them agreeing on what a colour *meant*. Meridian's
 * ARCHITECTURE rubric calls that out, and it is what makes a studio read as a patchwork.
 *
 * So: five tones, defined once here, and every domain status maps onto one of them. A founder
 * learns the colour once and it holds on every screen. Components ask for a tone and never name a
 * colour — `design-lint` fails the build if one does.
 *
 * Type-only imports throughout: lib/tickets and lib/health reach for node:fs and the GitHub client,
 * which must never enter the client bundle. `import type` is erased at build, so this module stays
 * safe to import from a 'use client' component.
 */
import type { LaneErrorKind, TicketStatusGroup } from './tickets';
import type { RunConclusion } from './health';
import type { PrCiStatus } from './attention';
import type { ApprovalStatus } from './approvals';

/**
 * The whole vocabulary. Adding a sixth tone is a design decision, not an implementation detail —
 * it means the founder has a new colour to learn, so it belongs in a PR to the design contract
 * (`docs/studio-design-contract.md`), not in a component.
 */
export const TONES = ['ok', 'working', 'attention', 'blocked', 'idle'] as const;
export type Tone = (typeof TONES)[number];

/** What each tone means. Also the source for the contract doc's table — kept next to the code. */
export const TONE_MEANING: Record<Tone, string> = {
  ok: 'it worked / healthy / done',
  working: 'under way right now',
  attention: 'needs a human, or a next step the founder must take',
  blocked: 'it failed, or cannot proceed',
  idle: 'nothing is happening, or we do not know',
};

/**
 * The CSS custom property for a tone. Components use this instead of naming a colour, which is how
 * one vocabulary stays one vocabulary — re-tone the studio by editing globals.css, not 13 files.
 */
export function toneColor(tone: Tone): string {
  return `var(--tone-${tone})`;
}

/** CI conclusion (lib/health) → tone. `cancelled` is idle, not blocked: nobody needs to act on it. */
export function ciRunTone(conclusion: RunConclusion | undefined): Tone {
  switch (conclusion) {
    case 'success':
      return 'ok';
    case 'failure':
      return 'blocked';
    case 'in_progress':
      return 'working';
    case 'cancelled':
    case 'unknown':
    case undefined:
      return 'idle';
    default: {
      const _exhaustive: never = conclusion; // a new RunConclusion must be toned above.
      return _exhaustive;
    }
  }
}

/** A PR's combined check status (lib/attention) → tone. */
export function prCiTone(status: PrCiStatus): Tone {
  switch (status) {
    case 'success':
      return 'ok';
    case 'failure':
      return 'blocked';
    case 'pending':
      return 'working';
    case 'unknown':
      return 'idle';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * A ticket's column → tone. `pr-open` is `attention`: it is sitting on the human gate, which is the
 * one place the founder is the blocker rather than the machine.
 */
export function ticketTone(group: TicketStatusGroup): Tone {
  switch (group) {
    case 'done':
      return 'ok';
    case 'in-progress':
      return 'working';
    case 'pr-open':
      return 'attention';
    case 'todo':
      return 'idle';
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

/**
 * An ActiveGraph approval → tone. `proposed` is `attention` because nothing external moves until a
 * human grants it (non-negotiable 4) — the founder IS the next step.
 */
export function approvalTone(status: ApprovalStatus): Tone {
  switch (status) {
    case 'executed':
      return 'ok';
    case 'executing':
    case 'granted':
      return 'working';
    case 'proposed':
      return 'attention';
    case 'rejected':
      return 'blocked';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * A lane read-failure → tone (FB-021's amber/red split, now expressed in the shared vocabulary).
 *
 * Only the two known setup states are `attention` — they are a next step, not a crash. `error`,
 * `rate-limit` and any unclassified/null failure read `blocked`: fail loud on severity rather than
 * dressing an unknown fault as a benign notice (non-negotiable 10).
 */
export function laneErrorTone(kind: LaneErrorKind | null): Tone {
  return kind === 'no-credentials' || kind === 'unreadable' ? 'attention' : 'blocked';
}
