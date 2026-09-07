import Link from 'next/link';
import { panelState } from '@/lib/read-failures';
import type { FeedItem } from '@/lib/activity-feed';
import { toneColor } from '@/lib/status';
import { onDate, relativeDay } from '@/lib/when';

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
          className="activity-row"
        >
          {/* FB-180: the day, not the date. This screen's whole axis is recency and every row said
              `2 September 2026`, including the ones from this morning — so a founder had to do
              arithmetic to answer the only question the column exists to answer. The absolute date
              is still here, in `title`, for anyone who needs to quote it. */}
          <span className="mono muted activity-when" title={onDate(item.at) ?? undefined}>
            {relativeDay(item.at) ?? ''}
          </span>
          <span className="activity-said">
            <span aria-hidden="true" style={{ color: toneColor(item.tone) }}>● </span>
            <span className="sr-only">{TONE_LABEL[item.tone]}: </span>
            {item.href ? (
              item.href.startsWith('/')
                ? <Link href={item.href}>{item.text} →</Link>
                : <a href={item.href} target="_blank" rel="noreferrer">{item.text} ↗</a>
            ) : (
              item.text
            )}
            {/* One fact, said once, with how many times it was recorded. Never a second row. */}
            {item.repeats && item.repeats > 1 ? (
              <span className="muted" data-testid="activity-repeats"> · {item.repeats} times</span>
            ) : null}
          </span>
          {/* The surface and its department, right of the sentence as in the design. */}
          <span className="muted activity-meta">{item.meta}</span>
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
