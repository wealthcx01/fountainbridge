/**
 * Temporary ticket machines: the rules, with no network and no database in them (FB-239).
 *
 * ## What John ruled, 2026-10-02
 *
 * 1. **Railway.** Each ticket's temporary machine runs on Railway (D11). Hetzner stays as a second
 *    provider behind the same interface, off unless chosen.
 * 2. **Only the studio makes machines.** The studio holds the one provider token. A venture's lane may
 *    only *ask* for a machine for one of its own tickets. The studio checks, on the server, that the
 *    request comes from that venture and names that venture's ticket, and the machine is given that
 *    venture's credentials and nobody else's (D1 as amended by D11, CLAUDE.md #6).
 * 3. **A monthly budget per venture, approved once by John.** No budget on record, signed so a lane
 *    cannot forge it, means no machine. At the budget, no machine, and the founder is told why.
 *    John approves it on the studio's budget page, signed in with Google, and only the address in
 *    `BUDGET_APPROVER_EMAIL` can (`lib/machine-budget.ts`).
 *
 * ## Who holds what
 *
 * - The **studio** holds the provider token, `TICKET_MACHINE_SECRET` (from which every lane key and
 *   every run token is derived), each venture's machine credentials, and the approval secret.
 *   Whoever can read the studio's settings and write its database could still forge a budget, as
 *   they could forge any approval the studio signs; that is the honest limit of a signature.
 * - A **venture's lane** holds only its own lane key. That key opens one door: asking for a machine
 *   for that venture, and asking how that venture's machine is getting on.
 * - The **provider** (Railway) holds only what a machine needs to find the studio: the studio's
 *   address, the run's id, and a token for that one run. No venture credential is ever stored there.
 * - The **machine** uses its run token once, at start, to collect this venture's credentials from the
 *   studio, and again at the end to say how the run went. The token names one venture and one run,
 *   so it is no use for any other.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { machineBudgetAttestationFor } from './approval-attestation';
import type { VentureSummary } from './ventures';
import { approvalRepos, fullRepoName } from './venture-repos';

// --- the machine and what it costs ---------------------------------------------------------------

/**
 * One machine per ticket, the same size every time.
 *
 * Four processors and 8 GB: a Next.js build alone needs about 3 GB on this repository, before Claude
 * Code and the browser QA uses. The lifetime is the lane's own phase timeouts (about 100 minutes at
 * two validation rounds) plus room to start; the grace is how long the clean-up waits past it before
 * acting, so it never races a run's own ending.
 */
export const MACHINE = Object.freeze({
  vcpus: 4,
  memoryGb: 8,
  lifetimeMinutes: 150,
  graceMinutes: 10,
  maxPerVenture: 2,
});
export type MachineShape = typeof MACHINE;

/**
 * Railway's container prices, read from docs.railway.com/reference/pricing/plans on 2026-10-02:
 * $0.000463 per vCPU per minute and $0.000231 per GB of memory per minute. Kept in millionths of a
 * dollar so the sums are whole numbers.
 *
 * Railway bills what a container uses, up to the limits the studio sets on it. Counting the limits is
 * therefore an upper bound: the real bill can only be lower.
 */
export const MICRO_USD_PER_VCPU_MINUTE = 463;
export const MICRO_USD_PER_GB_MINUTE = 231;

export function microUsdPerMinute(shape: MachineShape = MACHINE): number {
  return shape.vcpus * MICRO_USD_PER_VCPU_MINUTE + shape.memoryGb * MICRO_USD_PER_GB_MINUTE;
}

/** The most one machine can cost if it is only removed by the clean-up job at its deadline. */
export function worstCaseMicroUsd(shape: MachineShape = MACHINE): number {
  return microUsdPerMinute(shape) * (shape.lifetimeMinutes + shape.graceMinutes);
}

/** What a machine cost for the time it existed, counted in whole started minutes, at least one. */
export function costForMicroUsd(createdMs: number, endedMs: number, shape: MachineShape = MACHINE): number {
  const minutes = Math.max(1, Math.ceil((endedMs - createdMs) / 60_000));
  return microUsdPerMinute(shape) * minutes;
}

/** Dollars, the way a founder reads them: "$12.40". */
export function dollars(microUsd: number): string {
  return `$${(Math.round(microUsd / 10_000) / 100).toFixed(2)}`;
}

/** The first day of the UTC month, as Postgres's `date` wants it. */
export function monthOf(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 7)}-01`;
}

// --- keys and tokens -----------------------------------------------------------------------------

/**
 * A venture's lane key. Derived, so John sets one secret on the studio and hands each venture's box
 * its own key (`node scripts/ticket-machines.mjs lane-key <venture>`). The venture id is inside the
 * signed text, so one venture's key never opens another venture's door.
 */
export function laneKeyFor(secret: string, ventureId: string): string {
  return createHmac('sha256', secret).update(`machine-lane|${ventureId}`).digest('hex');
}

/** The token one machine uses to collect its work and report back. One venture, one run. */
export function runTokenFor(secret: string, ventureId: string, runId: string): string {
  return createHmac('sha256', secret).update(`machine-run|${JSON.stringify([ventureId, runId])}`).digest('hex');
}

/** The key the clean-up timer presents. */
export function reapKeyFor(secret: string): string {
  return createHmac('sha256', secret).update('machine-reap').digest('hex');
}

export function bearerOf(header: string | null | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const v = header.slice(7).trim();
  return v.length ? v : null;
}

/** Constant-time comparison. A missing or empty value never matches. */
export function sameSecret(given: string | null | undefined, want: string | null | undefined): boolean {
  if (!given || !want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The studio's machine secret, or null when it is missing or too short to be one. */
export function machineSecret(env: Record<string, string | undefined>): string | null {
  const s = env.TICKET_MACHINE_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

// --- the monthly budget --------------------------------------------------------------------------

export interface BudgetRow {
  venture_id: string;
  proposal_id: string;
  monthly_cents: number;
  approver: string;
  approved_at: Date | string;
  attestation: string;
}

export type BudgetCheck = { ok: true; monthlyCents: number; approver: string } | { ok: false; reason: string };

/** The one address that may approve a monthly machine budget (John's), lower-cased, or null. */
export function budgetApprover(env: Record<string, string | undefined>): string | null {
  const a = env.BUDGET_APPROVER_EMAIL?.trim().toLowerCase();
  return a && /^[^@\s]+@[^@\s]+$/.test(a) ? a : null;
}

/**
 * Is there a monthly budget for this venture that John approved? Checks the newest budget on record
 * (which `latestBudget` only returns when it names a proposal approved for the same amount): the
 * signature must verify against the approval secret, the approver must be the budget approver
 * today, and the amount must be above zero. Anything else is "no budget", said plainly.
 */
export function verifyBudget(
  row: BudgetRow | null,
  ventureId: string,
  secret: string | undefined,
  approver: string | null,
): BudgetCheck {
  const none = {
    ok: false as const,
    reason:
      'No monthly budget for temporary machines has been approved for this venture, so no machine was made. '
      + 'Bruntsfield approves one amount a month, once; until then the work waits.',
  };
  if (!row || !secret || !approver) return none;
  const approvedAt = new Date(row.approved_at).toISOString();
  const want = machineBudgetAttestationFor(ventureId, row.proposal_id, row.monthly_cents, row.approver, approvedAt, secret);
  if (row.venture_id !== ventureId || !sameSecret(row.attestation, want)) return none;
  if (row.approver.trim().toLowerCase() !== approver) return none;
  if (!(row.monthly_cents > 0)) {
    return { ok: false, reason: 'The monthly budget for temporary machines for this venture has been withdrawn, so no machine was made.' };
  }
  return { ok: true, monthlyCents: row.monthly_cents, approver: row.approver };
}

/** The sentence a founder reads when this month's budget is used. */
export function budgetUsedReason(monthlyCents: number): string {
  return `This month's budget for temporary machines (${dollars(monthlyCents * 10_000)}) is used, so no machine was made. `
    + 'Work starts again on the first of next month, or sooner if Bruntsfield approves a larger budget.';
}

// --- what a lane may ask for ---------------------------------------------------------------------

export interface MachineRequest {
  venture: string;
  repo: string;
  baseBranch: string;
  ticketPath: string;
  slug: string;
  department: string;
  gate: 'pr' | 'activegraph' | 'tbd-fb012';
  requireProposal: boolean;
  stateRef: string | null;
  tunables: Record<string, string>;
}

const TICKET_PATH = /^docs\/tickets\/([A-Za-z0-9._-]+)\.md$/;
const BRANCH = /^[A-Za-z0-9._/-]{1,100}$/;
const TUNABLES = ['MAX_VALIDATION_ROUNDS', 'PLAN_TIMEOUT', 'IMPL_TIMEOUT', 'REVIEW_TIMEOUT', 'QA_TIMEOUT'] as const;

/**
 * Read a lane's request, trusting none of it. The repository must be one of this venture's own, as
 * the venture's manifest says — never a repository the request merely names. The ticket must be a
 * file under `docs/tickets/` with nothing that could climb out of it. Whether that file really
 * exists in that repository is checked against GitHub by the caller.
 *
 * The department and its gate come from the manifest too: the department is the one whose
 * repository this is, and its gate is the manifest's, whatever the request says. One thing is taken
 * from the lane: whether this ticket ends in an external action and so must stop at a proposal. The
 * lane decides that by reading the ticket's text (`is_external_action` in foundry-lib.sh), which the
 * studio does not read. It can only matter in a department whose gate is not `pr`; in a `pr`
 * department the studio sets it to "no", as the lane does. Saying "no" wrongly cannot send anything:
 * the machine holds no credential that reaches anyone outside the company.
 */
export function parseMachineRequest(
  body: unknown,
  venture: VentureSummary,
  org?: string,
): { ok: true; req: MachineRequest } | { ok: false; reason: string } {
  const bad = (reason: string) => ({ ok: false as const, reason });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('The request was not understood.');
  const b = body as Record<string, unknown>;
  if (b.venture !== venture.id) return bad('The request does not name this venture.');

  const own = approvalRepos(venture).map((r) => fullRepoName(r, org));
  const repo = typeof b.repo === 'string' ? fullRepoName(b.repo.trim(), org) : '';
  if (!repo || !own.includes(repo)) return bad('That repository is not one of this venture\'s.');

  const ticketPath = typeof b.ticketPath === 'string' ? b.ticketPath : '';
  const m = TICKET_PATH.exec(ticketPath);
  if (!m || ticketPath.includes('..')) return bad('That is not a ticket in this venture\'s ticket folder.');
  if (b.slug !== m[1]) return bad('The ticket name does not match its file.');

  const baseBranch = typeof b.baseBranch === 'string' ? b.baseBranch : 'main';
  if (!BRANCH.test(baseBranch) || baseBranch.includes('..')) return bad('That branch name is not allowed.');

  const asked = typeof b.department === 'string' && b.department ? b.department : null;
  const homes = (venture.departments ?? []).filter((d) => d.repo && fullRepoName(d.repo, org) === repo);
  let department = 'build';
  let gateRaw = 'pr';
  if (homes.length) {
    const home = homes.find((d) => d.id === asked) ?? (homes.length === 1 && !asked ? homes[0] : null);
    if (!home) return bad('That department is not the one this repository belongs to.');
    department = home.id;
    gateRaw = home.gate;
  } else if (asked && asked !== 'build') {
    return bad('That department is not the one this repository belongs to.');
  }
  if (gateRaw !== 'pr' && gateRaw !== 'activegraph' && gateRaw !== 'tbd-fb012') return bad('That department\'s gate is not one this studio knows.');

  let stateRef: string | null = null;
  if (b.stateRef !== undefined && b.stateRef !== null && b.stateRef !== '') {
    if (typeof b.stateRef !== 'string' || !BRANCH.test(b.stateRef) || b.stateRef.includes('..')) return bad('That state branch is not allowed.');
    stateRef = b.stateRef;
  }

  const tunables: Record<string, string> = {};
  const t = (b.tunables ?? {}) as Record<string, unknown>;
  if (typeof t !== 'object' || Array.isArray(t)) return bad('The settings were not understood.');
  for (const key of TUNABLES) {
    const v = t[key];
    if (v === undefined || v === null || v === '') continue;
    const s = String(v);
    if (!/^\d{1,5}$/.test(s)) return bad(`${key} must be a whole number.`);
    tunables[key] = s;
  }

  return {
    ok: true,
    req: {
      venture: venture.id, repo, baseBranch, ticketPath, slug: m[1], department, gate: gateRaw,
      requireProposal: gateRaw !== 'pr' && b.requireProposal === true, stateRef, tunables,
    },
  };
}

// --- the venture's credentials, and only that venture's ------------------------------------------

/** Where the studio keeps one venture's machine credentials. The name comes from the venture id. */
export function credentialEnvNames(ventureId: string): { github: string; claude: string } {
  const key = ventureId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return { github: `TICKET_MACHINE_GITHUB_TOKEN_${key}`, claude: `TICKET_MACHINE_CLAUDE_TOKEN_${key}` };
}

export function ventureCredentials(
  ventureId: string,
  env: Record<string, string | undefined>,
): { ok: true; github: string; claude: string } | { ok: false; reason: string } {
  const names = credentialEnvNames(ventureId);
  const github = env[names.github]?.trim();
  const claude = env[names.claude]?.trim();
  if (!github || !claude) {
    return {
      ok: false,
      reason: 'The studio does not hold this venture\'s credentials for temporary machines yet, so no machine was made.',
    };
  }
  return { ok: true, github, claude };
}

// --- what the provider and the machine are given -------------------------------------------------

/** The lane's own source, fetched by the machine at start. The repository is public. */
export const LANE_SOURCE_DEFAULT = 'https://github.com/wealthcx01/fountainbridge.git';

/**
 * What the provider stores and the machine starts with. No venture credential: only how to reach the
 * studio and the token for this one run. The provider keeps these where anyone on the provider
 * account can read them, which is why nothing worth stealing is among them — the run token is spent
 * the moment the machine collects its work.
 */
export function bootVariables(o: {
  studioUrl: string; ventureId: string; runId: string; runToken: string; laneRef: string; laneSource: string; expiresAtMs: number;
}): Record<string, string> {
  return {
    FOUNDRY_STUDIO_URL: o.studioUrl.replace(/\/+$/, ''),
    FOUNDRY_VENTURE: o.ventureId,
    FOUNDRY_RUN_ID: o.runId,
    FOUNDRY_RUN_TOKEN: o.runToken,
    FOUNDRY_LANE_REF: o.laneRef,
    FOUNDRY_LANE_SOURCE: o.laneSource,
    FOUNDRY_EXPIRES_AT: String(Math.floor(o.expiresAtMs / 1000)),
  };
}

/**
 * How a fresh machine starts: fetch the lane at the studio's own version, then run `worker-run.sh`.
 * The same on every provider. No single quote anywhere in it, so a provider may wrap it in one.
 */
export const BOOT_COMMAND = [
  'set -eu',
  'command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git ca-certificates curl >/dev/null; }',
  'rm -rf /opt/foundry/lane-src && mkdir -p /opt/foundry/lane-src && cd /opt/foundry/lane-src',
  'git init -q . && git fetch -q --depth 1 "$FOUNDRY_LANE_SOURCE" "$FOUNDRY_LANE_REF" && git checkout -q FETCH_HEAD',
  'exec bash deploy/lane/worker-run.sh',
].join('; ');

export interface RunSettings {
  repo: string;
  baseBranch: string;
  ticketPath: string;
  slug: string;
  department: string;
  gate: string;
  requireProposal: boolean;
  stateRef: string | null;
  tunables: Record<string, string>;
}

/**
 * What a machine is handed when it collects its work: this venture's repository, this ticket, and
 * this venture's two credentials. Built from the run's own record and the venture the run belongs
 * to; nothing in it comes from the machine's request.
 */
export function workerEnv(ventureId: string, s: RunSettings, creds: { github: string; claude: string }): Record<string, string> {
  return {
    REPO: s.repo,
    BASE_BRANCH: s.baseBranch,
    LANE_ID: ventureId,
    LANE_DEPARTMENT: s.department,
    LANE_GATE: s.gate,
    LANE_REQUIRE_PROPOSAL: s.requireProposal ? '1' : '0',
    ...(s.stateRef ? { STATE_REF: s.stateRef } : {}),
    ...s.tunables,
    TICKET_SLUG: s.slug,
    TICKET_PATH: s.ticketPath,
    TICKET_GITHUB_TOKEN: creds.github,
    CLAUDE_CODE_OAUTH_TOKEN: creds.claude,
  };
}

// --- how a run ended -----------------------------------------------------------------------------

export interface FinishReport {
  exit: number;
  stage: string;
  skills: string[];
  sessions: string;
  log: string;
}

const STAGES = new Set(['setup', 'work', 'report', 'done']);

/** Read what a machine says at the end, keeping only what is well-formed and short. */
export function parseFinish(body: unknown): FinishReport | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (!Number.isInteger(b.exit)) return null;
  const stage = typeof b.stage === 'string' && STAGES.has(b.stage) ? b.stage : 'setup';
  const skills = typeof b.skills === 'string'
    ? b.skills.split(/\s+/).filter((s) => /^[A-Za-z0-9._-]{1,60}$/.test(s)).slice(0, 40)
    : [];
  const sessions = typeof b.sessions === 'string' ? b.sessions.slice(0, 64 * 1024) : '';
  const log = typeof b.log === 'string' ? b.log.slice(-2000) : '';
  return { exit: b.exit as number, stage, skills, sessions, log };
}

/**
 * Did the lane run to its own end, and what does the founder read?
 *
 * Only `done` is a run that reached its end. The lane writes its own run report when it gets that far,
 * whatever it decided about the ticket. Anything else — the machine failing while it set itself up,
 * the work being cut off — is a failure, and the founder's run report says where it stopped.
 */
export function finishSummary(r: FinishReport): { ok: boolean; summary: string } {
  if (r.stage === 'done') {
    return {
      ok: true,
      summary: r.exit === 0
        ? 'Your team worked this ticket on its own temporary machine. Its machine has been removed.'
        : 'Your team worked this ticket on its own temporary machine and wrote down what happened. Its machine has been removed.',
    };
  }
  const where = {
    setup: 'while its temporary machine was setting itself up, before any work began',
    work: 'part way through the work',
    report: 'after the work, while it was writing down which guides it used',
  }[r.stage as 'setup' | 'work' | 'report'] ?? 'before it began';
  const tail = r.log.trim() ? ` The last thing it said: "${oneLine(r.log)}"` : '';
  return {
    ok: false,
    summary: `Your team could not finish this ticket: the run stopped ${where} (exit code ${r.exit}). The machine has been removed and the next wake will try again.${tail}`,
  };
}

function oneLine(text: string): string {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.at(-1) ?? '').slice(0, 240);
}

/** A machine's name: says what it is for, and is unique per run. Lowercase, letters, digits, dashes. */
export function machineName(ventureId: string, slug: string, runId: string): string {
  const part = (s: string, n: number) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);
  return ['fw', part(ventureId, 12), part(slug, 24), part(runId, 16)].filter(Boolean).join('-').replace(/-+$/g, '');
}

export const MACHINE_NAME_PREFIX = 'fw-';
