import Link from 'next/link';
import { panelState } from '@/lib/read-failures';
import type { FeedItem } from '@/lib/activity-feed';
import { toneColor } from '@/lib/status';
import { onDate } from '@/lib/when';

/**
 * The record, as a founder reads it (FB-132).
 *
 * Dated, tone-dotted sentences, newest first. The dot is decorative and the word beside it is not: a
 * state carried only by colour is a state a screen-reader user does not get, which the design
 * contract forbids and which matters most on the entries nobody wants to miss.
 */
export function ActivityFeed({ items, couldNotRead = false }: { items: FeedItem[]; couldNotRead?: boolean }) {
  const state = panelState({ hasContent: items.length > 0, couldNotRead });
  // FB-137: "Nothing yet. Everything your venture does gets written down here" is an invitation. Said
  // over a read that failed it becomes a claim the studio has no evidence for — and the most
  // reassuring one it can make. The apology REPLACES the invitation; it does not sit under it.
  // Nothing at all, deliberately. The page above already carries a strip naming WHICH source could
  // not be read, and two apologies for one failure is the studio talking about itself twice. What
  // must not happen is the INVITATION below, which would tell a founder their venture has done
  // nothing.
  if (state === 'unreadable') return null;
  if (state === 'empty') {
    return (
      <p className="card muted" data-testid="activity-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
        Nothing yet. Everything your venture does gets written down here — including the things that
        did not work.
      </p>
    );
  }

  return (
    <ol data-testid="activity-feed" style={{ listStyle: 'none', margin: '1.25rem 0 0', padding: 0 }}>
      {items.map((item, i) => (
        <li
          key={`${item.at}-${i}`}
          data-testid="activity-item"
          data-tone={item.tone}
          data-source={item.source}
          style={{
            display: 'flex', gap: '0.75rem', alignItems: 'baseline',
            padding: '0.55rem 0', borderTop: '1px solid var(--color-border)',
          }}
        >
          <span className="mono muted" style={{ flexShrink: 0, fontSize: 'var(--fs-meta)' }}>
            {onDate(item.at) ?? ''}
          </span>
          <span style={{ minWidth: 0 }}>
            <span aria-hidden="true" style={{ color: toneColor(item.tone) }}>● </span>
            <span className="sr-only">{TONE_LABEL[item.tone]}: </span>
            {item.href ? (
              item.href.startsWith('/')
                ? <Link href={item.href}>{item.text} →</Link>
                : <a href={item.href} target="_blank" rel="noreferrer">{item.text} ↗</a>
            ) : (
              item.text
            )}
            <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-meta-lg)' }}>{item.meta}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What each dot means, for anyone who cannot see it. */
const TONE_LABEL: Record<FeedItem['tone'], string> = {
  ok: 'Done',
  working: 'In progress',
  attention: 'Needs you',
  blocked: 'Stopped',
  idle: 'Quiet',
};
