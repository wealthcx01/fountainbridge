import type { Tone } from '@/lib/status';

/**
 * The studio's one state mark (FB-210).
 *
 * A square, in the tone's colour, wherever a state is shown. It replaces `⚠` and `●`, which survived
 * on nine screens after FB-203 turned the desk's marks into squares — so the studio was marking state
 * two different ways depending on which screen you were on.
 *
 * ## Why not the emoji
 *
 * It is a different typeface at a size nobody chose. It renders differently on every platform, it
 * does not take the tone colour — a `⚠` beside amber text is whatever amber the vendor picked — and
 * beside a serif sentence it reads as something pasted in. The square is drawn by the same stylesheet
 * as everything around it.
 *
 * ## What has not changed
 *
 * It is `aria-hidden`, and the word is beside it. **A state told only in colour is a state some
 * readers never get**, and every call site that had a `sr-only` label keeps it. This ticket changes
 * the glyph, never the sentence.
 *
 * `tone` is optional: without it the square takes `currentColor`, which is right where the text is
 * already in the state's colour and wrong where it is not.
 */
export function Mark({ tone }: { tone?: Tone }) {
  return <span aria-hidden="true" className={tone ? `mark mark-${tone}` : 'mark'} />;
}
