/**
 * Fire the one routine that is due, if any (FB-047).
 *
 * Called once per wake by `run-once.sh`, BEFORE the ticket scan. Firing is one API call and no model
 * session, so a routine keeps its cadence whether or not the backlog is busy — which is the point of
 * having approved it. The work it files then goes through the ordinary queue: a branch, a PR, the
 * circuit breaker, the budget, and the founder's accept. Nothing here does the work itself.
 *
 * Exits 0 with no output when nothing is due. Any failure is loud on stderr and still exits 0: a
 * routine that cannot fire must not take the whole wake down with it, because the backlog work is
 * more important than the recurring work and it is the next thing this script's caller does.
 *
 *   node routines-fire.mjs        (env: REPO, TICKET_GITHUB_TOKEN, STATE_REF)
 */

import { nextToDispatch, readRoutine, stampRun, ticketBody, ticketSlug } from './routines-lib.mjs';

const API = 'https://api.github.com';
const REPO = (process.env.REPO || '').trim();
const TOKEN = (process.env.TICKET_GITHUB_TOKEN || '').trim();
const STATE_REF = (process.env.STATE_REF || 'foundry-state').trim();
const ROUTINES_DIR = 'routines';

const log = (...a) => console.error('[routines]', ...a);

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`${init.method || 'GET'} ${path} → ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? {} : res.json();
}

/** Directory listing that reads "not there" as empty and lets anything else be heard. */
async function listRoutineFiles() {
  try {
    const dir = await gh(`/repos/${REPO}/contents/${ROUTINES_DIR}?ref=${encodeURIComponent(STATE_REF)}`);
    return Array.isArray(dir) ? dir.filter((e) => e.type === 'file' && e.name.endsWith('.json')) : [];
  } catch (err) {
    // No routines directory, or no state ref at all — a venture that has never had a routine. That
    // is not a fault. A 403 or a rate limit IS, and must not read as "no routines".
    if (err.status === 404) return [];
    throw err;
  }
}

async function readJson(entry) {
  const file = await gh(`/repos/${REPO}/contents/${entry.path}?ref=${encodeURIComponent(STATE_REF)}`);
  return { raw: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), sha: file.sha };
}

async function main() {
  if (!REPO || !TOKEN) {
    log('REPO or TICKET_GITHUB_TOKEN not set — skipping routines this wake');
    return;
  }

  const entries = await listRoutineFiles();
  if (entries.length === 0) return;

  const stored = [];
  for (const entry of entries) {
    try {
      const { raw, sha } = await readJson(entry);
      const routine = readRoutine(raw);
      // A file that is not a routine is skipped, not fatal — one bad record must not stop the rest.
      if (routine) stored.push({ routine, sha, path: entry.path });
    } catch (err) {
      log(`could not read ${entry.path}: ${err.message}`);
    }
  }

  const now = new Date();
  const due = nextToDispatch(stored.map((s) => s.routine), now);
  if (!due) return;

  const record = stored.find((s) => s.routine.id === due.id);
  const firedAt = now.toISOString();
  const slug = ticketSlug(due, firedAt);
  const path = `docs/tickets/${slug}.md`;

  // Idempotent: a wake that fired and then failed before stamping would otherwise file the same
  // ticket again on the next wake. Checking the file first is cheaper than reasoning about it.
  try {
    await gh(`/repos/${REPO}/contents/${path}`);
    log(`${due.id} already filed ${slug} — stamping only`);
  } catch (err) {
    if (err.status !== 404) throw err;
    await gh(`/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `routine ${due.id}: ${due.title}`,
        content: Buffer.from(ticketBody(due, firedAt), 'utf8').toString('base64'),
      }),
    });
    log(`filed ${slug} for routine ${due.id}`);
  }

  // Stamp last, and only the run field. If this fails the ticket still exists and the guard above
  // stops a duplicate — the reverse order would risk a routine that records a run it never did.
  await gh(`/repos/${REPO}/contents/${record.path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `routine ${due.id}: ran ${firedAt}`,
      content: Buffer.from(`${JSON.stringify(stampRun(due, firedAt), null, 2)}\n`, 'utf8').toString('base64'),
      sha: record.sha,
      branch: STATE_REF,
    }),
  });
}

main().catch((err) => {
  // Loud, and non-fatal. The wake's real job is the backlog; a routine that cannot fire is a thing
  // to see in the log, not a reason to skip the work that was already waiting.
  log('failed:', err.message);
});
