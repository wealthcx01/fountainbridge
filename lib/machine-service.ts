/**
 * The studio's side of ticket machines: the five things it answers (FB-239).
 *
 *   - a lane asks for a machine for one of its tickets          → `requestMachine`
 *   - a lane asks how that machine is getting on                → `runStatus`
 *   - the machine collects its work, once                       → `startRun`
 *   - the machine says how the run ended                        → `finishRun`
 *   - a timer asks for every overdue machine to be removed      → `reapAll`
 *
 * Every one of them is reachable without a signed-in session, so every one is treated as a public
 * endpoint (the FB-127 lesson): it checks its own key before reading anything else, trusts nothing in
 * the request, and answers "not authorised" the same way whether the venture exists or not.
 *
 * Nothing here talks to the network or the database directly. The route handlers pass both in, so
 * the tests drive this file with a stand-in provider and real Postgres (PGlite).
 */
import { randomBytes } from 'node:crypto';
import type { VentureSummary } from './ventures';
import type { Machine, MachineProvider } from './machine-provider';
import {
  adjust, claimStart, getRun, insertRun, latestBudget, liveRuns, reserve, updateRun,
  type Querier, type RunRow,
} from './machine-store';
import {
  BOOT_COMMAND, LANE_SOURCE_DEFAULT, MACHINE, bearerOf, bootVariables, budgetUsedReason, costForMicroUsd,
  finishSummary, laneKeyFor, machineName, machineSecret, monthOf, parseFinish, parseMachineRequest,
  reapKeyFor, runTokenFor, sameSecret, ventureCredentials, verifyBudget, workerEnv, worstCaseMicroUsd,
  type RunSettings,
} from './ticket-machines';
import { scanForSecrets } from './secrets';

export interface MachineDeps {
  env: Record<string, string | undefined>;
  ventures: VentureSummary[];
  provider: MachineProvider | null;
  withVenture: <T>(ventureId: string, fn: (q: Querier) => Promise<T>) => Promise<T>;
  /** Does this file exist in this repository at this branch? Asked of GitHub with the studio's own token. */
  ticketExists: (repo: string, path: string, ref: string) => Promise<boolean>;
  now?: () => number;
  newRunId?: () => string;
  log?: (line: string) => void;
}

export interface Reply { status: number; body: Record<string, unknown> }

const NOT_AUTHORISED: Reply = { status: 401, body: { error: 'not authorised' } };
const refused = (status: number, reason: string): Reply => ({ status, body: { created: false, reason } });

function adminEmails(env: Record<string, string | undefined>): string[] {
  return (env.STUDIO_ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Find the venture a key claims to be, and check the key is that venture's. Null for any mismatch. */
function laneVenture(deps: MachineDeps, header: string | null, ventureId: unknown): VentureSummary | null {
  const secret = machineSecret(deps.env);
  if (!secret || typeof ventureId !== 'string') return null;
  const venture = deps.ventures.find((v) => v.id === ventureId);
  if (!venture) return null;
  return sameSecret(bearerOf(header), laneKeyFor(secret, venture.id)) ? venture : null;
}

function runAuthorised(deps: MachineDeps, header: string | null, ventureId: string, runId: string): boolean {
  const secret = machineSecret(deps.env);
  if (!secret || !deps.ventures.some((v) => v.id === ventureId) || !/^[a-f0-9]{16}$/.test(runId)) return false;
  return sameSecret(bearerOf(header), runTokenFor(secret, ventureId, runId));
}

// --- a lane asks for a machine -------------------------------------------------------------------

export async function requestMachine(deps: MachineDeps, header: string | null, body: unknown): Promise<Reply> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});
  const ventureId = (body as { venture?: unknown } | null)?.venture;
  const venture = laneVenture(deps, header, ventureId);
  if (!venture) return NOT_AUTHORISED;

  if (deps.env.TICKET_MACHINES?.trim() !== 'on') {
    return refused(503, 'Temporary machines are switched off in the studio, so no machine was made.');
  }
  const parsed = parseMachineRequest(body, venture, deps.env.GITHUB_ORG);
  if (!parsed.ok) return refused(400, parsed.reason);
  const req = parsed.req;

  if (!deps.provider) return refused(503, 'The studio is not connected to a machine provider yet, so no machine was made.');
  const creds = ventureCredentials(venture.id, deps.env);
  if (!creds.ok) return refused(503, creds.reason);
  const studioUrl = (deps.env.STUDIO_PUBLIC_URL ?? deps.env.AUTH_URL ?? '').trim();
  if (!/^https:\/\//.test(studioUrl)) return refused(503, 'The studio does not know its own public address (STUDIO_PUBLIC_URL), so a machine could not reach it.');

  let exists = false;
  try { exists = await deps.ticketExists(req.repo, req.ticketPath, req.baseBranch); } catch { exists = false; }
  if (!exists) return refused(404, `${req.ticketPath} is not a ticket in ${req.repo} on ${req.baseBranch}, so no machine was made.`);

  // Clear this venture's finished and overdue machines first, so the count below is only real work.
  await reapVenture(deps, venture.id).catch((e) => log(`clean-up before a request failed for ${venture.id}: ${(e as Error).message}`));

  const runId = (deps.newRunId ?? (() => randomBytes(8).toString('hex')))();
  const createdAt = new Date(now());
  const expiresAt = new Date(createdAt.getTime() + MACHINE.lifetimeMinutes * 60_000);
  const reserved = worstCaseMicroUsd(MACHINE);
  const month = monthOf(createdAt.getTime());
  const settings: RunSettings = {
    repo: req.repo, baseBranch: req.baseBranch, ticketPath: req.ticketPath, slug: req.slug, department: req.department,
    gate: req.gate, requireProposal: req.requireProposal, stateRef: req.stateRef, tunables: req.tunables,
  };

  // The budget, the count and the reservation, in one transaction: two requests at once cannot both
  // squeeze under the cap.
  const gate = await deps.withVenture(venture.id, async (q) => {
    const budget = verifyBudget(await latestBudget(q), venture.id, deps.env.FOUNDRY_APPROVAL_SECRET?.trim(), adminEmails(deps.env));
    if (!budget.ok) return refused(402, budget.reason);
    const live = (await liveRuns(q)).length;
    if (live >= MACHINE.maxPerVenture) {
      return refused(429, `Your team already has ${live} temporary machine${live === 1 ? '' : 's'} working, which is the most allowed at once. This ticket waits for one to finish.`);
    }
    if (!(await reserve(q, venture.id, month, reserved, budget.monthlyCents * 10_000))) {
      return refused(402, budgetUsedReason(budget.monthlyCents));
    }
    await insertRun(q, { ventureId: venture.id, runId, settings, provider: deps.provider!.name, reservedMicro: reserved, createdAt, expiresAt });
    return null;
  });
  if (gate) return gate;

  const secret = machineSecret(deps.env)!;
  const name = machineName(venture.id, req.slug, runId);
  try {
    const machine = await deps.provider.create({
      name,
      ventureId: venture.id,
      runId,
      expiresAtMs: expiresAt.getTime(),
      variables: bootVariables({
        studioUrl, ventureId: venture.id, runId, runToken: runTokenFor(secret, venture.id, runId),
        laneRef: deps.env.TICKET_MACHINE_LANE_REF?.trim() || deps.env.RAILWAY_GIT_COMMIT_SHA?.trim() || 'main',
        laneSource: deps.env.TICKET_MACHINE_LANE_SOURCE?.trim() || LANE_SOURCE_DEFAULT,
        expiresAtMs: expiresAt.getTime(),
      }),
      bootCommand: BOOT_COMMAND,
      shape: MACHINE,
    });
    await deps.withVenture(venture.id, (q) => updateRun(q, runId, {
      machine: { id: machine.id, name: machine.name, ref: machine.ref }, state: 'made',
    }));
    log(`made ${name} for ${venture.id}/${req.slug}; it must be gone by ${expiresAt.toISOString()}`);
    return { status: 201, body: { created: true, runId, machine: name, expiresAt: expiresAt.toISOString() } };
  } catch (e) {
    log(`could not make ${name}: ${(e as Error).message}`);
    // The reply may have been lost after the provider made it anyway. Find THIS run's machine by its
    // exact name — never anything else's — and remove it.
    let found: Machine[] = [];
    try { found = (await deps.provider.list()).filter((m) => m.name === name); } catch { /* the clean-up job will find it */ }
    let allGone = true;
    for (const m of found) {
      if (!(await destroyWithRetry(deps.provider, m, log))) allGone = false;
    }
    const cost = found.length ? costForMicroUsd(createdAt.getTime(), now()) : 0;
    await deps.withVenture(venture.id, async (q) => {
      await updateRun(q, runId, {
        state: 'failed',
        summary: 'The studio could not get a temporary machine for this ticket, so the work did not start.',
        ...(allGone ? { destroyed_at: new Date(now()) } : { machine: found[0] ? { id: found[0].id, name, ref: found[0].ref } : null }),
      });
      if (allGone) await adjust(q, month, cost - reserved);
    });
    return refused(502, 'The studio could not get a temporary machine for this ticket, so the work did not start. The next wake will try again.');
  }
}

// --- a lane asks how its machine is getting on ---------------------------------------------------

export async function runStatus(deps: MachineDeps, header: string | null, ventureId: string, runId: string): Promise<Reply> {
  const venture = laneVenture(deps, header, ventureId);
  if (!venture || !/^[a-f0-9]{16}$/.test(runId)) return NOT_AUTHORISED;
  const now = deps.now ?? Date.now;

  let run = await deps.withVenture(venture.id, (q) => getRun(q, runId));
  if (!run) return { status: 404, body: { error: 'no such run for this venture' } };

  if (run.state !== 'finished' && run.state !== 'failed') {
    let why: string | null = null;
    if (now() > run.expires_at.getTime() + MACHINE.graceMinutes * 60_000) {
      why = 'Your team\'s temporary machine ran out of time before it said how the run ended. The machine has been removed and the next wake will try again.';
    } else if (deps.provider && run.machine && run.state !== 'creating') {
      const state = await deps.provider.state(run.machine).catch(() => null);
      if (state === 'failed' || state === 'stopped' || state === 'gone') {
        why = run.state === 'made'
          ? 'Your team\'s temporary machine stopped before it could start the work. The machine has been removed and the next wake will try again.'
          : 'Your team\'s temporary machine stopped part way through without saying how the run ended. The machine has been removed and the next wake will try again.';
      }
    }
    if (why) {
      await deps.withVenture(venture.id, (q) => updateRun(q, runId, { state: 'failed', summary: why, finished_at: new Date(now()) }));
      run = { ...run, state: 'failed', summary: why };
    }
  }
  if ((run.state === 'finished' || run.state === 'failed') && !run.destroyed_at) {
    await destroyRun(deps, venture.id, run);
    run = (await deps.withVenture(venture.id, (q) => getRun(q, runId))) ?? run;
  }
  const done = run.state === 'finished' || run.state === 'failed';
  return {
    status: 200,
    body: {
      runId, state: run.state, done, ok: run.state === 'finished',
      removed: Boolean(run.destroyed_at), summary: run.summary ?? '', exit: run.exit_code,
      skills: run.skills ? run.skills.split(' ') : [], sessions: run.sessions ?? '',
      expiresAt: run.expires_at.toISOString(),
    },
  };
}

// --- the machine collects its work ---------------------------------------------------------------

export async function startRun(deps: MachineDeps, header: string | null, ventureId: string, runId: string): Promise<Reply> {
  if (!runAuthorised(deps, header, ventureId, runId)) return NOT_AUTHORISED;
  const now = deps.now ?? Date.now;
  const run = await deps.withVenture(ventureId, (q) => getRun(q, runId));
  if (!run || now() > run.expires_at.getTime()) return { status: 410, body: { error: 'this run is over' } };
  // Credentials are looked up now, for the venture the run belongs to — never stored with the run,
  // and never chosen by anything the machine sends.
  const creds = ventureCredentials(ventureId, deps.env);
  if (!creds.ok) return { status: 503, body: { error: creds.reason } };
  const claimed = await deps.withVenture(ventureId, (q) => claimStart(q, runId, new Date(now())));
  if (!claimed) return { status: 409, body: { error: 'this run has already collected its work' } };
  return { status: 200, body: { env: workerEnv(ventureId, run.settings, creds) } };
}

// --- the machine says how the run ended ----------------------------------------------------------

export async function finishRun(deps: MachineDeps, header: string | null, ventureId: string, runId: string, body: unknown): Promise<Reply> {
  if (!runAuthorised(deps, header, ventureId, runId)) return NOT_AUTHORISED;
  const now = deps.now ?? Date.now;
  const report = parseFinish(body);
  if (!report) return { status: 400, body: { error: 'not a run result' } };
  // A log line can carry a credential (a failed clone prints its address). Withheld, never stored.
  if (scanForSecrets(report.log)) report.log = '(withheld: it looked like it contained a credential)';
  if (scanForSecrets(report.sessions)) report.sessions = '';
  const { ok, summary } = finishSummary(report);

  const updated = await deps.withVenture(ventureId, async (q) => {
    const run = await getRun(q, runId);
    if (!run || (run.state !== 'made' && run.state !== 'started')) return null;
    await updateRun(q, runId, {
      state: ok ? 'finished' : 'failed', finished_at: new Date(now()), exit_code: report.exit, stage: report.stage,
      skills: report.skills.join(' '), sessions: report.sessions, summary,
    });
    return run;
  });
  if (!updated) return { status: 409, body: { error: 'this run has already ended' } };
  return { status: 200, body: { recorded: true } };
}

/** Remove the finished machine. Separate so the route can do it after it has answered. */
export async function removeAfterFinish(deps: MachineDeps, ventureId: string, runId: string): Promise<void> {
  const run = await deps.withVenture(ventureId, (q) => getRun(q, runId));
  if (run && !run.destroyed_at && (run.state === 'finished' || run.state === 'failed')) await destroyRun(deps, ventureId, run);
}

// --- removing machines ---------------------------------------------------------------------------

async function destroyWithRetry(provider: MachineProvider, m: Pick<Machine, 'id' | 'ref'>, log: (l: string) => void, attempts = 3): Promise<boolean> {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await provider.destroy(m);
      return true;
    } catch (e) {
      log(`could not remove machine ${m.id} (try ${i} of ${attempts}): ${(e as Error).message}`);
    }
  }
  return false;
}

/** Remove one run's machine and bring the month's count down to what it really ran for. */
async function destroyRun(deps: MachineDeps, ventureId: string, run: RunRow): Promise<boolean> {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});
  if (!deps.provider) return false;
  if (run.machine && !(await destroyWithRetry(deps.provider, run.machine, log))) return false;
  const endedMs = now();
  const cost = run.machine ? costForMicroUsd(run.created_at.getTime(), endedMs) : 0;
  await deps.withVenture(ventureId, async (q) => {
    await updateRun(q, run.run_id, { destroyed_at: new Date(endedMs) });
    await adjust(q, monthOf(run.created_at.getTime()), cost - run.reserved_micro);
  });
  return true;
}

function overdue(run: RunRow, nowMs: number): boolean {
  return nowMs > run.expires_at.getTime() + MACHINE.graceMinutes * 60_000;
}

/** Remove this venture's machines that have ended or are past their deadline. */
async function reapVenture(deps: MachineDeps, ventureId: string): Promise<{ removed: number; failed: number; kept: RunRow[] }> {
  const now = deps.now ?? Date.now;
  const runs = await deps.withVenture(ventureId, (q) => liveRuns(q));
  let removed = 0;
  let failed = 0;
  const kept: RunRow[] = [];
  for (const run of runs) {
    const ended = run.state === 'finished' || run.state === 'failed';
    if (!ended && !overdue(run, now())) { kept.push(run); continue; }
    if (!ended) {
      await deps.withVenture(ventureId, (q) => updateRun(q, run.run_id, {
        state: 'failed', finished_at: new Date(now()),
        summary: 'Your team\'s temporary machine ran out of time before it said how the run ended. The machine has been removed and the next wake will try again.',
      }));
    }
    if (await destroyRun(deps, ventureId, run)) removed += 1; else { failed += 1; kept.push(run); }
  }
  return { removed, failed, kept };
}

/**
 * The clean-up. Every venture's ended and overdue machines, then anything the provider holds that no
 * venture's record accounts for and that is older than a machine may live. It asks the provider, not
 * only the database, so a machine whose record was lost is still found.
 */
export async function reapAll(deps: MachineDeps, header: string | null): Promise<Reply> {
  const secret = machineSecret(deps.env);
  if (!secret || !sameSecret(bearerOf(header), reapKeyFor(secret))) return NOT_AUTHORISED;
  if (!deps.provider) return { status: 200, body: { removed: 0, note: 'no machine provider is set up' } };
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});
  let removed = 0;
  let failed = 0;
  const accounted = new Set<string>();
  for (const v of deps.ventures) {
    try {
      const r = await reapVenture(deps, v.id);
      removed += r.removed;
      failed += r.failed;
      for (const k of r.kept) if (k.machine) accounted.add(k.machine.id);
    } catch (e) {
      // A venture that cannot be read means its working machines cannot be told apart from forgotten
      // ones, so the provider-wide sweep below must not run on this pass.
      log(`clean-up could not read ${v.id}: ${(e as Error).message}`);
      return { status: 500, body: { error: 'could not read every venture, so unaccounted machines were left for the next pass', removed } };
    }
  }
  const limit = (MACHINE.lifetimeMinutes + MACHINE.graceMinutes) * 60_000;
  for (const m of await deps.provider.list()) {
    if (accounted.has(m.id)) continue;
    const born = Date.parse(m.createdAt ?? '');
    // "Cannot tell how old" ends in removal: a forgotten machine costs money every hour.
    if (Number.isFinite(born) && now() - born <= limit) continue;
    if (await destroyWithRetry(deps.provider, m, log)) { removed += 1; log(`removed ${m.name}: no record accounts for it and it is past any deadline`); } else failed += 1;
  }
  return { status: failed ? 500 : 200, body: { removed, failed } };
}
