import { onDate } from './when';

/**
 * What a screen may honestly claim about a record it has only partly read (FB-242).
 *
 * ## The fault this replaces
 *
 * "What happened" told ARCA's founder:
 *
 *     Everything ARCA did since 30 September 2026, newest first.
 *
 * That date was **today**, over a venture with 9,889 run reports going back five weeks. One row on
 * the screen, no caveat anywhere, and 800 of the page's 1,000 pixels empty.
 *
 * Three defensible things had compounded. The read stops at twenty. Those twenty collapsed to one
 * row, because they were all the same park. So the feed concluded it had not truncated anything —
 * it had built one item and kept one item — and the "showing the most recent" footer never
 * rendered. The date was then read off the end of that truncated window and printed as the start of
 * the venture's history.
 *
 * ## The rule
 *
 * **A page may only call a date the start of a history if its read reached the start.** Otherwise
 * that date is "the oldest thing on this screen", which is a different sentence and has to be
 * written as one.
 *
 * ## Why it can say this at no cost
 *
 * Every report's time is in its own filename, so `loadRunReports` knows the whole shape of the
 * history — how many there are and when the first was written — from the listing alone, without
 * opening anything beyond its budget. The bound is on files OPENED, never on what is KNOWN. So the
 * honest sentence is also the useful one: a founder is told five weeks happened even though the
 * screen is showing twenty reports.
 *
 * This is the pattern the studio already uses one screen away, where a ticket's trail says *"It is
 * not that nothing else happened — it is that the studio could not see it."* Nothing here is new
 * thinking; it is that sentence, applied where it was missing.
 */
export interface HistoryScope {
  ventureName: string;
  /** Rows actually on the screen. Not the same kind of number as `total` — see `bounded`. */
  shown: number;
  /**
   * Whether the underlying read stopped short of the whole record.
   *
   * Passed in rather than inferred from `shown` vs `total`, because those count different things:
   * `shown` is rows on screen (reports, decisions and changes together) and `total` is reports
   * alone. Comparing them looked right and was a coin-flip on any venture with a few decisions —
   * exactly the kind of almost-correct comparison this ticket exists to stop.
   */
  bounded: boolean;
  /**
   * How many reports exist, counted from the listing rather than from what was opened.
   *
   * The noun in the sentence is **reports**, because that is what this number counts. `shown` counts
   * the rows on screen, which also include decisions and changes — so the two are not the same kind
   * of thing, and the copy must not imply they are by calling both of them "things".
   */
  total: number;
  /** When the OLDEST record was written. Null when nothing carries a readable time. */
  earliest: string | null;
  /** The time of the oldest row on the screen. Null when the screen is empty. */
  oldestShown: string | null;
  /**
   * The one ticket the record is mostly about, when one dominates it (FB-242).
   *
   * On ARCA this is the whole story and the count alone hid it: 9,738 of 9,904 reports are the lane
   * re-parking on ARCA-061 since July. "Your team has written 9,895 reports" is true and reads like
   * steady progress. Null when no ticket dominates, and then nothing is said about it.
   */
  busiest?: { ticket: string; count: number } | null;
  /**
   * True when each row is one stretch of work on one ticket rather than one report (FB-180). Then
   * "the 20 most recent" means twenty pieces of the story, not twenty reports, and the sentence says so.
   */
  byStretch?: boolean;
}

const STRETCH_LINE = 'Each line is one stretch of work on one ticket, however many reports it took.';

const plural = (n: number, one: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : `${one}s`}`;

/**
 * A ticket's filename slug, as a founder would say it.
 *
 * `ARCA-061-saved-card-lists-not-persisting` is how the lane names a file. It is not how a person
 * refers to a piece of work, and CLAUDE.md #12 binds every word rendered here. Splits the id from
 * the words and puts the hyphens back as spaces.
 *
 * Returns the slug unchanged when it does not have that shape — a name this cannot parse is still
 * better shown than swallowed.
 */
export function ticketInWords(slug: string): string {
  const m = slug.match(/^([A-Za-z]+-\d+)-(.+)$/);
  if (!m) return slug;
  return `${m[1]} — ${m[2].replace(/-/g, ' ')}`;
}

/**
 * The sentence, or null when there is nothing to say because nothing was recorded.
 *
 * Never mentions a number it did not get. A screen that could not read the total says less rather
 * than guessing — "we could not read this" is the caller's sentence to add, not this one's to fake.
 */
export function historyScope(input: HistoryScope): string | null {
  const { ventureName, shown, total, earliest, oldestShown, bounded } = input;
  if (shown <= 0 || total <= 0) return null;

  const from = earliest ? onDate(earliest) : null;
  const reaches = oldestShown ? onDate(oldestShown) : null;

  // The read got everything. Only here may a date be called the start of the history.
  const stretchLine = input.byStretch ? ` ${STRETCH_LINE}` : '';
  if (!bounded) {
    return (reaches
      ? `Everything ${ventureName} did since ${reaches}, newest first.`
      : `Everything ${ventureName} did, newest first.`) + stretchLine;
  }

  // Bounded. Lead with what EXISTS, because that is the fact the old sentence destroyed, and a
  // founder opening this screen is asking "what has been going on?" rather than "what is on this
  // page?".
  const recorded = from
    ? `Your team has written ${plural(total, 'report')} since ${from}.`
    : `Your team has written ${plural(total, 'report')}.`;
  // Said second, because the count is the fact and this is what the count means.
  const { busiest } = input;
  const mostly = busiest
    ? ` ${busiest.count.toLocaleString('en-GB')} of them are about one ticket, ${ticketInWords(busiest.ticket)}.`
    : '';
  // "the 1 most recent" is not a sentence a person writes. One row is "the most recent".
  const howMany = shown === 1 ? 'the most recent' : `the ${shown.toLocaleString('en-GB')} most recent`;
  const showing = reaches
    ? `This page shows ${howMany}, back to ${reaches}.`
    : `This page shows ${howMany}.`;
  return `${recorded}${mostly}${stretchLine} ${showing}`;
}

/**
 * Whether a screen is showing less than the whole record — which is the thing it must not stay quiet
 * about.
 *
 * Deliberately NOT "did the last step drop anything". That is what the old code asked, and it is a
 * question about the final list rather than about the record: twenty reports collapsing into one row
 * truncates nothing at the last step and hides 9,869 things.
 */
export const readWasBounded = (shown: number, total: number): boolean => total > shown;
