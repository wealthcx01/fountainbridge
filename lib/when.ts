/**
 * One way to say when something happened (FB-068).
 *
 * ## The problem
 *
 * Three formats were reachable on one page: `3:05:32 PM` in the header, `20 June 2026` on a decided
 * approval, and `2026-07-21T18:30:00Z` in the activity strip. Four separate helpers had grown up in
 * four files — `relTime` on the activity page, `formatAge` on the queue, `waitingFor` in the work
 * evidence, and a bare `toLocaleTimeString` on the board — which is exactly why they drifted.
 *
 * The ISO one was a deliberate choice, and the reasoning was right: a relative time computed on the
 * server is wrong the moment a page is cached. But a raw `T` and `Z` is a developer's format on a
 * founder's screen, and the honest answer is a relative time computed where the reader is.
 *
 * ## The clock seam
 *
 * `E2E_NOW` pins "now" so the fixture-driven UI gate stays deterministic (FB-032) — without it a
 * green suite turns red on its own once the calendar moves past the fixtures. Honoured here so the
 * one helper does not become the reason that stops working.
 */

/** "Now", honouring the test-only pin. Never set `E2E_NOW` in production. */
export function studioNow(): number {
  const pinned = process.env.E2E_NOW;
  if (pinned) {
    const at = Date.parse(pinned);
    if (Number.isFinite(at)) return at;
  }
  return Date.now();
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * How long something has lasted, in words — `3 days`, `2 hours`, `a few minutes`.
 *
 * Returns the duration alone so the caller supplies the sentence: *"Waiting 3 days for you"*,
 * *"3 days ago"*. One vocabulary, several sentences, rather than several vocabularies.
 *
 * Never negative. Two machines with disagreeing clocks are ordinary — the studio writes some of
 * these timestamps and GitHub writes others — and "in -3 days" is the sort of thing that makes a
 * founder distrust everything else on the page.
 */
export function howLong(iso: string, now = studioNow()): string | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const ms = Math.max(0, now - at);
  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (ms >= MINUTE) {
    const mins = Math.floor(ms / MINUTE);
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }
  return 'a few seconds';
}

/** When something happened — `3 days ago`. Null when the timestamp cannot be read. */
export function ago(iso: string, now = studioNow()): string | null {
  const span = howLong(iso, now);
  return span === null ? null : span === 'a few seconds' ? 'just now' : `${span} ago`;
}

/**
 * A calendar date, for the one place a founder wants the day itself rather than the distance —
 * a decision that was recorded, which they may need to refer to later.
 *
 * `en-GB` explicitly: the studio's founders are in Edinburgh, and a date that renders as `6/20/2026`
 * for one reader and `20/06/2026` for another is ambiguous for both.
 */
export function onDate(iso: string): string | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(at));
}
