/**
 * A ticket with no number is nobody's ticket (FB-097).
 *
 * The composer filed everything as `<PREFIX>-NEW`. It was meant to be a placeholder for a moment and
 * became the permanent name of everything a founder creates — the walkthrough counted four distinct
 * pieces of work all called **ARCA-NEW**, across the board, the queue, the feed and git history.
 *
 * The filer allocates real ids now (`deploy/librechat/ticket-mcp/ids.mjs`). This is the studio's half
 * of the same ticket: anything that still arrives unnumbered is shown as unnumbered rather than
 * rendered as though `ARCA-NEW` were a name — so the four that already exist get renamed rather than
 * quietly accumulate more.
 *
 * Deliberately duplicated from the filer's own `isUnnumbered` rather than imported: the filer ships
 * to the venture's box and this ships to Railway, and a shared import across that boundary would be a
 * build-time coupling between two things that deploy separately. Four characters of logic, pinned by
 * tests on both sides.
 */
export const isUnnumbered = (id: string | null | undefined): boolean => /-NEW$/i.test(id ?? '');
