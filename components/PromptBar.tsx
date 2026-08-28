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
    <section data-testid="prompt-bar" style={{ marginBottom: '1.5rem' }}>
      <form
        onSubmit={(e) => { e.preventDefault(); open(text); }}
        style={{ display: 'flex', gap: '0.6rem', alignItems: 'stretch', flexWrap: 'wrap', maxWidth: 'var(--content-narrow)' }}
      >
        <input
          data-testid="prompt-bar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell the studio what you want…"
          aria-label={`Tell the studio what you want for ${ventureName}`}
          maxLength={MAX_ASK}
          // `--color-rule` and `--color-surface` do not exist. An undefined custom property makes
          // the whole declaration invalid at computed-value time, so `border: 1px solid var(--color-rule)`
          // resolves to no border at all and the background falls through to the page — which is how
          // the desk's headline control came to be an unbordered strip on the ground colour. Four
          // other components carry the same two names (FB-150); these are the real tokens.
          style={{
            flex: '1 1 16rem', minWidth: 0, padding: '0.65rem 0.75rem', fontSize: 'var(--fs-body)',
            fontFamily: 'inherit', border: '1px solid var(--color-border)',
            background: 'var(--color-paper-raised)', color: 'var(--color-ink)',
          }}
        />
        <button type="submit" className="btn btn-primary" data-testid="prompt-bar-send" disabled={!text.trim()}>
          Send
        </button>
      </form>

      <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.5rem 0 0' }}>
        Try:{' '}
        {CHIPS.map((chip, i) => (
          <span key={chip}>
            {i > 0 ? ' · ' : ''}
            <button
              type="button"
              data-testid={`prompt-chip-${i}`}
              onClick={() => setText(chip)}
              style={{
                background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit',
                textDecoration: 'underline', cursor: 'pointer',
              }}
            >
              “{chip}”
            </button>
          </span>
        ))}
      </p>
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
