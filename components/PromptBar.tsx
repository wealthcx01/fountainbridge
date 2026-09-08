'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The prompt bar (FB-128) — the desk's own way in to the composer.
 *
 * The desk is the screen a founder leaves open, so the most important thing they do should start
 * here rather than behind a link to another screen. It carries the words across and **files
 * nothing**: pressing Send opens the composer with the sentence already typed, and the composer's
 * own gate (FB-119) is still the only thing that turns words into work.
 *
 * The chips are examples, not shortcuts. A founder staring at an empty box does not know what this
 * accepts; three concrete asks answer that faster than any placeholder. They seed the same box the
 * founder would have typed into, so a chip is a head start and never a decision.
 */
export function PromptBar({ ventureId, ventureName }: { ventureId: string; ventureName: string }) {
  const router = useRouter();
  const [text, setText] = useState('');

  const open = (ask: string) => {
    const trimmed = ask.trim();
    if (!trimmed) return;
    // Capped here as well as on the input, so a paste cannot exceed it. The composer route caps at
    // the same number; without this the founder's tail would be cut off between the two screens
    // with nothing said about it, and they would send a half sentence.
    router.push(`/venture/${ventureId}/composer?ask=${encodeURIComponent(trimmed.slice(0, MAX_ASK))}`);
  };

  return (
    <section data-testid="prompt-bar">
      {/* FB-203, item 6. It was an input, a gap, and a separate button — three shapes for one
          control, which reads as a search field beside an unrelated button rather than as a place
          to talk to your team. Now it is one box with the Send inside it, and the focus ring is on
          the box, because the box is what a founder sees as the thing they are typing into.

          The placeholder says what this accepts. "Tell the studio what you want…" is a prompt to a
          founder who already knows; the three nouns are for the one who does not. */}
      <form className="promptbar" onSubmit={(e) => { e.preventDefault(); open(text); }}>
        <input
          className="promptbar-input"
          data-testid="prompt-bar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell the studio what you want. A ticket, research, a question…"
          aria-label={`Tell the studio what you want for ${ventureName}`}
          maxLength={MAX_ASK}
        />
        <button type="submit" className="btn btn-primary" data-testid="prompt-bar-send" disabled={!text.trim()}>
          Send
        </button>
      </form>

      {/* Pills, not underlined words. An underline is the studio's own promise that something
          navigates, and these do not navigate — they fill the box above and wait. */}
      <div className="chips">
        <span>Try</span>
        {CHIPS.map((chip, i) => (
          <button key={chip} type="button" className="chip" data-testid={`prompt-chip-${i}`} onClick={() => setText(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * The most a sentence carried across a URL may be. The same number the composer route enforces —
 * two caps that disagree is a silent truncation, which is the one thing this must not do to words a
 * founder is about to send.
 */
export const MAX_ASK = 500;

/** Three real asks. The first one is a thing the studio genuinely does now (FB-127). */
const CHIPS = [
  'Break this document into tickets',
  'Something on the site is wrong',
  'What did my team do this week?',
] as const;
