import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { founderSafe, noteFrom, reviewFor, stateAfter, type ReviewCardFile } from '../review';
import type { PressLine } from '../press-record';

/**
 * FB-274: what the Review screen is handed, for a founder and for John.
 *
 * The rule under test is the ticket's: no dollar figure, no "What to do next" line and no Archon
 * link ever reaches a founder's browser. The screen is handed only what `reviewFor` returns, so if
 * none of it is in what `reviewFor` returns, none of it is in the browser.
 */

const CARD: ReviewCardFile = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', 'e2e', 'fixtures', 'review', 'arca', '20.json'), 'utf8'),
);

const at = (isJohn: boolean) => ({
  ventureId: 'arca',
  ventureName: 'ARCA',
  repo: 'arca',
  number: 20,
  preview: null,
  state: { kind: 'finished' } as const,
  place: { index: 1, of: 2, next: null },
  viewer: { isJohn },
});

/** Everything John-only, as a founder must never receive it. */
const JOHN_ONLY = [/\$\s?\d/, /what to do next/i, /archon/i];

describe("a founder's Review screen", () => {
  const view = reviewFor(CARD, at(false));
  const sent = JSON.stringify(view);

  it.each(JOHN_ONLY)('holds nothing matching %s', (re) => {
    expect(sent).not.toMatch(re);
  });

  it("has none of John's parts", () => {
    expect(view.forJohn).toBeNull();
  });

  it('loses only the sentence that named a cost, not the line it was in', () => {
    // The fixture's second trail line ends "The checks ran for $0.40." on purpose.
    expect(view.trail.map((t) => t.text)).toContain('Your team finished it and checked it three ways.');
  });

  it('never passes on a part of the card it does not know', () => {
    const odd = { ...CARD, budgetLeft: '$21.60', archonRun: 'run-20' } as ReviewCardFile;
    expect(JSON.stringify(reviewFor(odd, at(false)))).not.toMatch(/21\.60|run-20/);
  });

  it('a note John wrote is read through the same lock', () => {
    const view2 = reviewFor(CARD, {
      ...at(false),
      state: { kind: 'sent-back', by: 'John', at: '2026-07-21T00:00:00Z', note: 'Too slow. What to do next: retry it. Cost $3.', signedOffBy: null },
    });
    expect(JSON.stringify(view2)).not.toMatch(/what to do next|\$3/i);
    expect(view2.state.kind === 'sent-back' && view2.state.note).toBe('Too slow.');
  });
});

describe("John's Review screen", () => {
  const view = reviewFor(CARD, at(true));

  it('has his cost, his next step and the run', () => {
    expect(view.forJohn).toEqual({
      cost: '$3.40 so far, of a $25 budget',
      nextStep: 'What to do next: approve it. Nothing else waiting depends on it.',
      runUrl: 'https://archon.example.invalid/runs/arca-20',
    });
  });

  it('reads the card as the factory wrote it', () => {
    expect(view.trail[1].text).toContain('$0.40');
  });

  it('gets each picture at its own size, from the studio', () => {
    expect(view.pictures).toEqual([
      { name: 'before-computer', width: 1440, height: 1000, src: '/venture/arca/review/arca/20/picture/before-computer' },
      { name: 'after-computer', width: 1440, height: 1000, src: '/venture/arca/review/arca/20/picture/after-computer' },
      { name: 'before-phone', width: 393, height: 851, src: '/venture/arca/review/arca/20/picture/before-phone' },
      { name: 'after-phone', width: 393, height: 851, src: '/venture/arca/review/arca/20/picture/after-phone' },
    ]);
  });
});

describe('founderSafe', () => {
  it('keeps a sentence with a pound figure: only dollars are costs', () => {
    expect(founderSafe('It shows £1,240. It cost $2.')).toBe('It shows £1,240.');
  });
});

describe('the note a Send back carries', () => {
  it('names the picture and the spot of every pin, then the note about the whole thing', () => {
    const note = noteFrom(
      [
        { picture: 'after-phone', x: 81.6, y: 40.9, text: 'The button is cut off here' },
        { picture: 'after-computer', x: 10, y: 10, text: '   ' },
        { picture: 'before-computer', x: 50, y: 50, text: 'This was fine before.' },
      ],
      'Otherwise good.',
    );
    expect(note).toBe(
      '1. On the "after" picture, on a phone, 82% across and 41% down: The button is cut off here\n' +
        '2. On the "before" picture, on a computer, 50% across and 50% down: This was fine before.\n' +
        'About the whole thing: Otherwise good.',
    );
  });

  it('is only the whole-thing note when nothing was pinned', () => {
    expect(noteFrom([], ' Shorter, please. ')).toBe('Shorter, please.');
  });

  it('is empty when nothing was written, so Send back stays off', () => {
    expect(noteFrom([{ picture: 'after-phone', x: 1, y: 1, text: '' }], '')).toBe('');
  });
});

describe("a card's state", () => {
  const line = (decision: PressLine['decision'], by: string): PressLine =>
    ({ at: '2026-07-21T10:00:00Z', venture: 'arca', repo: 'arca', number: 20, by, decision, note: '', seen: null });

  it('is finished until someone presses', () => {
    expect(stateAfter([])).toEqual({ kind: 'finished' });
  });

  it("a founder's sign-off then John's approval is approved, and remembers the sign-off", () => {
    const s = stateAfter([line('signed-off', 'f@x'), line('approved', 'j@x')]);
    expect(s).toMatchObject({ kind: 'approved', by: 'j@x', signedOffBy: 'f@x' });
  });

  it('the first press that settles it wins', () => {
    expect(stateAfter([line('sent-back', 'f@x'), line('approved', 'j@x')])).toMatchObject({ kind: 'sent-back', by: 'f@x' });
  });

  it('says who pressed in the words the viewer reads', () => {
    expect(stateAfter([line('signed-off', 'f@x')], (e) => (e === 'f@x' ? 'you' : e))).toMatchObject({ by: 'you' });
  });
});
