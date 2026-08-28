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
    router.push(`/venture/${ventureId}/composer?ask=${encodeURIComponent(trimmed)}`);
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
          style={{
            flex: '1 1 16rem', minWidth: 0, padding: '0.65rem 0.75rem', fontSize: 'var(--fs-body)',
            fontFamily: 'inherit', border: '1px solid var(--color-rule)',
            background: 'var(--color-surface)', color: 'var(--color-ink)',
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

/** Three real asks. The first one is a thing the studio genuinely does now (FB-127). */
const CHIPS = [
  'Break this document into tickets',
  'Something on the site is wrong',
  'What did my team do this week?',
] as const;
