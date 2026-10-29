/**
 * The Review screen's model (FB-274): one finished piece of work, as the person looking at it may
 * see it.
 *
 * A finished card comes from the factory with parts for everyone and parts for John only: what the
 * run cost, its "What to do next" line, and the link to the run itself. A founder must never receive
 * those, so the screen is never handed the card. It is handed `reviewFor(card, viewer)`, which
 * copies the founder's parts by name and adds John's only for John. Anything the card carries that
 * is not named here reaches nobody, which is the rule the factory marks its cards by (cowgate
 * CG-0063: "anything not marked is treated as John's").
 *
 * Pure: no reads, no clock. The loader (`lib/review-load.ts`) does the reading.
 */

import type { PreviewCheck } from './result-link';
import type { PressLine } from './press-record';

/** The four pictures: before and after the change, at a computer's size and a phone's. */
export const PICTURES = ['before-computer', 'after-computer', 'before-phone', 'after-phone'] as const;
export type PictureName = (typeof PICTURES)[number];

export const isPictureName = (s: string): s is PictureName => (PICTURES as readonly string[]).includes(s);

/** How a picture is named to a founder, in a note and on the screen. */
export function pictureWords(name: PictureName): string {
  const [when, size] = name.split('-');
  return `the "${when}" picture, ${size === 'phone' ? 'on a phone' : 'on a computer'}`;
}

/** One finished card as the factory sends it. Until FB-275 these come from the test rig's files. */
export interface ReviewCardFile {
  /** The ticket it was built for, e.g. ARCA-070. */
  ref: string;
  title: string;
  state: 'finished';
  finishedAt: string;
  /** The version of the work the pictures were taken from. An Accept is bound to it. */
  headSha: string;
  /** A made-up record for tests and demos. The screen says so. */
  demo?: boolean;
  /** The plan's "What this does", in plain English. */
  summary: string;
  changes: { label: string; text: string }[];
  /** Who sees the change once it is part of the product. */
  reaches: string;
  checks: { passed: number; total: number };
  previewUrl: string | null;
  picturesTakenAt: string | null;
  pictures: Partial<Record<PictureName, { width: number; height: number }>>;
  trail: { at: string; tone: Tone; text: string }[];
  /** John's parts. Never sent to a founder. */
  forJohn?: { cost?: string; nextStep?: string; runUrl?: string };
}

export type Tone = 'ok' | 'working' | 'attention' | 'blocked' | 'idle';

/** Where the card stands now, after any presses. */
export type CardState =
  | { kind: 'finished' }
  | { kind: 'signed-off'; by: string; at: string; note: string }
  | { kind: 'sent-back'; by: string; at: string; note: string; signedOffBy: string | null }
  | { kind: 'approved'; by: string; at: string; signedOffBy: string | null };

/**
 * A card's state: what the factory sent, then each press in the order it was made.
 *
 * `name` turns the address that pressed into what this viewer reads: "you", "John", the founder's
 * name. Done here, on the server, so no address reaches a screen that does not need it.
 */
export function stateAfter(presses: PressLine[], name: (email: string) => string = (e) => e): CardState {
  let state: CardState = { kind: 'finished' };
  for (const p of presses) {
    // The first final press wins. Anything after it was refused, so it should not be here at all.
    if (state.kind === 'sent-back' || state.kind === 'approved') break;
    const signedOffBy: string | null = state.kind === 'signed-off' ? state.by : null;
    const by = name(p.by);
    if (p.decision === 'signed-off') state = { kind: 'signed-off', by, at: p.at, note: p.note };
    else if (p.decision === 'sent-back') state = { kind: 'sent-back', by, at: p.at, note: p.note, signedOffBy };
    else state = { kind: 'approved', by, at: p.at, signedOffBy };
  }
  return state;
}

/** Sent back or approved: the card is no longer waiting for anyone, so nothing more can be pressed. */
export const isSettled = (state: CardState) => state.kind === 'sent-back' || state.kind === 'approved';

/** What a press on a settled card is told (harness journey 5). */
export const OUT_OF_DATE = "This card is out of date: the run isn't waiting at it any more. Nothing was done.";

/** One picture, as the screen loads it. */
export interface ReviewPicture {
  name: PictureName;
  width: number;
  height: number;
  src: string;
}

/** Everything the Review screen is given. Built only by `reviewFor`. */
export interface ReviewView {
  ventureId: string;
  ventureName: string;
  repo: string;
  number: number;
  ref: string;
  title: string;
  finishedAt: string;
  headSha: string;
  demo: boolean;
  summary: string;
  changes: { label: string; text: string }[];
  reaches: string;
  checks: { passed: number; total: number };
  preview: PreviewCheck | null;
  picturesTakenAt: string | null;
  pictures: ReviewPicture[];
  trail: { at: string; tone: Tone; text: string; link?: { href: string; label: string } }[];
  state: CardState;
  /** Which of the venture's finished pieces of work this is, and how many there are. */
  place: { index: number; of: number; next: string | null };
  /** Whose screen this is. John is whoever `STUDIO_ADMIN_EMAILS` names. */
  viewer: { isJohn: boolean };
  /** John's parts. Present only when the viewer is John. */
  forJohn: { cost: string | null; nextStep: string | null; runUrl: string | null } | null;
}

/**
 * Sentences a founder must never be shown, wherever they turn up: a dollar figure, a "What to do
 * next" line, or anything naming Archon. The factory keeps these in John's parts; this is the second
 * lock, for the day one slips into a summary or a note.
 */
const JOHN_ONLY = [/\$\s?\d/, /what to do next/i, /archon/i];

export function founderSafe(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !JOHN_ONLY.some((re) => re.test(sentence)))
    .join(' ')
    .trim();
}

/** The parts of a card a viewer may see. The one place a card is turned into what a screen gets. */
export function reviewFor(
  card: ReviewCardFile,
  at: {
    ventureId: string;
    ventureName: string;
    repo: string;
    number: number;
    preview: PreviewCheck | null;
    state: CardState;
    place: ReviewView['place'];
    viewer: ReviewView['viewer'];
  },
): ReviewView {
  const john = at.viewer.isJohn;
  // John reads the card as the factory wrote it. A founder reads it through `founderSafe`.
  const say = (text: string) => (john ? text : founderSafe(text));
  const base = `/venture/${at.ventureId}/review/${at.repo}/${at.number}`;
  const state = john ? at.state : founderSafeState(at.state);

  return {
    ventureId: at.ventureId,
    ventureName: at.ventureName,
    repo: at.repo,
    number: at.number,
    ref: card.ref,
    title: say(card.title) || 'Finished work',
    finishedAt: card.finishedAt,
    headSha: card.headSha,
    demo: Boolean(card.demo),
    summary: say(card.summary),
    changes: card.changes
      .map((c) => ({ label: say(c.label), text: say(c.text) }))
      .filter((c) => c.text),
    reaches: say(card.reaches),
    checks: { passed: card.checks.passed, total: card.checks.total },
    preview: at.preview,
    picturesTakenAt: card.picturesTakenAt,
    pictures: PICTURES.flatMap((name) => {
      const p = card.pictures[name];
      return p ? [{ name, width: p.width, height: p.height, src: `${base}/picture/${name}` }] : [];
    }),
    trail: card.trail
      .map((t) => ({ at: t.at, tone: t.tone, text: say(t.text) }))
      .filter((t) => t.text),
    state,
    place: at.place,
    viewer: at.viewer,
    forJohn: john
      ? { cost: card.forJohn?.cost ?? null, nextStep: card.forJohn?.nextStep ?? null, runUrl: card.forJohn?.runUrl ?? null }
      : null,
  };
}

/** A note written by John and shown to a founder goes through the same lock as everything else. */
function founderSafeState(state: CardState): CardState {
  return 'note' in state ? { ...state, note: founderSafe(state.note) } : state;
}

/** A note pinned on one spot of one picture. `x` and `y` are percentages across and down. */
export interface Pin {
  picture: PictureName;
  x: number;
  y: number;
  text: string;
}

/**
 * The one note a Send back (or a sign-off with notes) carries, in words a person reads.
 *
 * Each pin names its picture and its spot, so the team can find it without the screen: "1. On the
 * "after" picture, on a phone, 82% across and 41% down: The button is cut off here."
 */
export function noteFrom(pins: Pin[], whole: string): string {
  const lines = pins
    .filter((p) => p.text.trim())
    .map((p, i) => `${i + 1}. On ${pictureWords(p.picture)}, ${Math.round(p.x)}% across and ${Math.round(p.y)}% down: ${p.text.trim()}`);
  const all = whole.trim();
  if (all) lines.push(lines.length ? `About the whole thing: ${all}` : all);
  return lines.join('\n');
}
