/**
 * Routines, box side (FB-047).
 *
 * ## Why this duplicates `lib/routines.ts` instead of importing it
 *
 * Same reason `lib/ticket-ids.ts` duplicates the filer's `isUnnumbered` (FB-097): this ships to the
 * venture's box and the studio ships to Railway. A shared import across that boundary would be a
 * build-time coupling between two things that deploy separately — and FB-112 is a fresh reminder of
 * what happens when a box-side file quietly needs something the box does not have.
 *
 * The duplication is deliberate and it is pinned: `__tests__/routines-lib.test.mjs` asserts the same
 * behaviours as `lib/__tests__/routines.test.ts`, so the two cannot drift silently.
 *
 * ## What a routine firing actually does
 *
 * It **files a ticket**, and nothing else. It does not do the work.
 *
 * Git is the source of truth for work items, so recurring work has to enter the queue as a ticket
 * like everything else — then it gets a branch, a PR, the circuit breaker, the budget and the
 * founder's accept, all of which already exist. A routine that did its own work would be a second,
 * ungoverned path to changing a venture, and every safeguard would have to be built twice.
 *
 * Filing is cheap — one API call, no model session — so a routine fires on its cadence whether or
 * not the backlog is busy. Working it costs, and that cost goes through the normal gates.
 */

/** The gap a routine must leave between runs. Mirrors COOLDOWN_MS in lib/routines.ts. */
export const COOLDOWN_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Read a stored routine, refusing an approval the file merely claims.
 *
 * The state ref is writable by this very lane, so `state: "active"` with no `approved_at` behind it
 * is a claim and not a grant. Mirrors `fromStored` in lib/routines.ts — and it matters more here,
 * because this is the code that would act on it.
 */
export function readRoutine(raw) {
  if (typeof raw !== 'object' || raw === null) return null;

  const id = text(raw.id);
  const title = text(raw.title);
  const standing_order = text(raw.standing_order);
  const criterion = text(raw.criterion);
  const cadence = text(raw.cadence);
  if (!id || !title || !standing_order || !criterion || !COOLDOWN_MS[cadence]) return null;

  const approved_at = text(raw.approved_at);
  const approved_by = text(raw.approved_by);
  const approved = Boolean(approved_at && approved_by);

  return {
    id,
    title,
    standing_order,
    criterion,
    cadence,
    // Unapproved is `proposed` whatever the file says. Only a real approval can reach active/paused.
    state: !approved ? 'proposed' : text(raw.state) === 'paused' ? 'paused' : 'active',
    approved_at: approved ? approved_at : null,
    approved_by: approved ? approved_by : null,
    last_run_at: text(raw.last_run_at) || null,
  };
}

/** Whether enough time has passed since this routine last ran. */
export function cooledDown(routine, now) {
  if (!routine.last_run_at) return true;
  const last = Date.parse(routine.last_run_at);
  // An unreadable timestamp lets it run rather than retiring, silently and for good, something the
  // founder approved.
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= COOLDOWN_MS[routine.cadence];
}

/**
 * The one routine to fire on this wake.
 *
 * One per wake (meridian's one-dispatch-per-sweep): everything due at once is how a quiet week turns
 * into a bill. Longest-waiting first so an hourly routine cannot starve a weekly one, ties broken on
 * id so the same input always picks the same routine.
 */
export function nextToDispatch(routines, now) {
  const due = routines.filter((r) => r.state === 'active' && cooledDown(r, now));
  if (due.length === 0) return null;
  const waitingSince = (r) => (r.last_run_at ? Date.parse(r.last_run_at) : 0);
  return [...due].sort((a, b) => waitingSince(a) - waitingSince(b) || a.id.localeCompare(b.id))[0];
}

/**
 * The ticket a routine files when it fires.
 *
 * The criterion goes in as the first instruction, not as prose: the point of a routine is that a
 * quiet week costs nothing, and that only holds if whoever works the ticket checks before building.
 */
export function ticketBody(routine, firedAt) {
  return [
    `# ${routine.title}`,
    '',
    '**Status:** Todo · **Area:** Recurring · **Depends on:** —',
    '',
    '## Why this exists',
    `A routine you approved${routine.approved_by ? ` (${routine.approved_by})` : ''} runs ${routine.cadence}.`,
    `This is its run for ${firedAt.slice(0, 10)}.`,
    '',
    '## Check first',
    routine.criterion,
    '',
    'If the answer is no, close this ticket and record that there was nothing to do. Doing nothing is',
    'the correct outcome for a quiet week, and it must cost nothing.',
    '',
    '## What to do',
    routine.standing_order,
    '',
    '## How this was filed',
    `Filed automatically by the routine \`${routine.id}\`. Pause it from the studio to stop this.`,
    '',
  ].join('\n');
}

/** Where a fired routine's ticket lands. Dated, so a weekly routine does not collide with itself. */
export function ticketSlug(routine, firedAt) {
  return `${routine.id}-${firedAt.slice(0, 10)}`;
}

/** The routine record after it fired — the ONE field a lane may write about a run. */
export function stampRun(routine, firedAt) {
  return { ...routine, last_run_at: firedAt };
}
