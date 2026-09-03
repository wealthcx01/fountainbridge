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
  return Number.isFinite(at) ? howLongMs(now - at) : null;
}

/**
 * The same vocabulary, from a duration rather than a timestamp (FB-129).
 *
 * `howLong` takes an instant and compares it against `studioNow()`, which honours the pinned test
 * clock. A caller holding an *age* — the attention queue reports `ageMs`, already computed — had to
 * fake a timestamp with `Date.now() - ageMs`, which mixes the real clock into a comparison against
 * the pinned one and reads "a few seconds" for a pull request that has waited forty-four days.
 *
 * It is also the half that can run in a browser. `E2E_NOW` is not a `NEXT_PUBLIC_` variable, so the
 * server and the client disagree about "now" and the row hydrates with different words than were
 * rendered. A duration has no such argument with itself.
 */
export function howLongMs(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  const d = Math.max(0, ms);
  if (d >= DAY) { const n = Math.floor(d / DAY); return `${n} day${n === 1 ? '' : 's'}`; }
  if (d >= HOUR) { const n = Math.floor(d / HOUR); return `${n} hour${n === 1 ? '' : 's'}`; }
  if (d >= MINUTE) { const n = Math.floor(d / MINUTE); return `${n} minute${n === 1 ? '' : 's'}`; }
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

/**
 * The day, as the design's record says it: `Today 08:00`, `Yesterday`, `Monday`, `27 August` (FB-180).
 *
 * "What happened" is the screen whose whole axis is recency, and it was printing `2 September 2026`
 * on every row — including the ones from this morning. A founder reading it has to do arithmetic to
 * answer "is this today?", which is the only question the column exists to answer.
 *
 * Today keeps its clock time, because on today's rows the hour is the information. Anything inside
 * the last week gets its weekday. Older than that, the calendar date without the year, which the
 * year beside it would only repeat — the absolute date is still on the row, in `title`, for anyone
 * who needs to quote it.
 */
export function relativeDay(iso: string, now = studioNow()): string | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;

  const startOf = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOf(now) - startOf(at)) / 86_400_000);

  // A record with a date in the future is a clock disagreeing, not a fact about tomorrow. Shown as
  // its date rather than as "in 2 days", which would read as a promise.
  if (days < 0) return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(at));
  if (days === 0) {
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date(at));
    return `Today ${time}`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(at));
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(at));
}
