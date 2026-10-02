/**
 * One temporary machine per ticket (FB-239): the lifecycle, with no provider and no network in it.
 *
 * John ruled "one machine and one character per ticket". Today every ticket a venture's lane works is
 * worked on the venture's own persistent machine, so ticket B starts on whatever ticket A left on
 * disk, a build can starve everything else on the box of memory, and ARCA's disk fills a little more
 * every wake. This file is the part that makes a ticket's work happen somewhere else instead:
 *
 *   1. check the money cap and the machine cap, and refuse plainly if either is reached;
 *   2. create a machine that exists only for this ticket, labelled with when it must be gone;
 *   3. give it only what this one ticket needs — the lane's scripts, this venture's credentials,
 *      a key that opens only this machine — and nothing for any other venture;
 *   4. run the lane on it for that one ticket;
 *   5. bring back what it did (whether it finished, which guides it followed, its session list);
 *   6. destroy it — whatever happened in steps 2 to 5.
 *
 * ## Why a machine cannot be left running or forgotten
 *
 * Three independent things end a machine, so any one of them failing is not enough to leak one:
 *
 * - **The run destroys it in a `finally`.** A crash anywhere in steps 2–5 still ends in step 6. If the
 *   create call failed after the provider had in fact made the machine (the reply was lost), the
 *   `finally` finds it by the run's own label and destroys that.
 * - **The machine powers itself off** when its lifetime is up (its start-up script schedules it), so
 *   work stops even if nothing else reaches it. Powering off does not stop the bill on Hetzner, which
 *   is why this is not the only layer.
 * - **The reaper** asks the provider — never a local file — for every machine carrying our label and
 *   destroys each one past its deadline. A run killed outright (power cut, `kill -9`, the persistent
 *   machine restarted) never reaches its `finally`; the reaper is what catches that. Because it asks
 *   the provider, it still works when every file on the persistent machine is gone.
 *
 * ## What it never touches
 *
 * Only machines labelled `foundry-role=ticket-worker`. A venture's own persistent machine has no such
 * label and the reaper refuses anything without it, even if a provider returns it by mistake.
 *
 * The provider and the transport are passed in. Real ones live in `machine-hetzner.mjs` and
 * `machine-ssh.mjs`; the tests pass fakes, which is how the whole lifecycle is proved without
 * creating a machine (creating one costs money and is an external action — non-negotiable 4).
 */

/** The label every ticket machine carries. The reaper acts on this and on nothing else. */
export const ROLE_LABEL = 'foundry-role';
export const ROLE_VALUE = 'ticket-worker';

/** Where the worker keeps its run files. One place, so the delivery and the collection agree. */
export const RUN_DIR = '/opt/foundry/run';
export const LANE_ON_WORKER = '/opt/foundry/lane';
export const RESULT_PATH = `${RUN_DIR}/result.json`;
export const SESSIONS_PATH = `${RUN_DIR}/state/sessions.jsonl`;

/**
 * The settings, with defaults that are safe to leave alone.
 *
 * - `lifetimeMinutes`: the hard deadline. The lane's own phase timeouts add up to about 100 minutes
 *   at two validation rounds, so 150 leaves room for start-up and nothing more.
 * - `graceMinutes`: how long past the deadline the reaper waits before acting, so it never races a
 *   run's own clean-up.
 * - `hourlyEur`: what one machine costs per hour. Deliberately an upper bound, not a quote — the
 *   budget sums worst cases, so overestimating is the safe direction.
 * - `dailyCapEur`: the most these machines may cost in one day, counted before each one is made.
 * - `maxMachines`: how many may exist at once.
 */
export const DEFAULTS = Object.freeze({
  lifetimeMinutes: 150,
  graceMinutes: 10,
  readyTimeoutMs: 10 * 60 * 1000,
  hourlyEur: 0.02,
  dailyCapEur: 1.0,
  maxMachines: 2,
});

export function settingsFrom(env = {}) {
  const num = (key, fallback) => {
    const raw = env[key];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    ...DEFAULTS,
    lifetimeMinutes: num('TICKET_MACHINE_LIFETIME_MINUTES', DEFAULTS.lifetimeMinutes),
    hourlyEur: num('TICKET_MACHINE_HOURLY_EUR', DEFAULTS.hourlyEur),
    dailyCapEur: num('TICKET_MACHINE_DAILY_CAP_EUR', DEFAULTS.dailyCapEur),
    maxMachines: Math.floor(num('TICKET_MACHINE_MAX', DEFAULTS.maxMachines)),
  };
}

/**
 * The most one run can cost. Providers bill by the hour started, so a run that is cut off at its
 * deadline, plus the reaper's grace, is the worst case — every started hour of it.
 */
export function worstCaseEur(settings = DEFAULTS) {
  const hours = Math.ceil((settings.lifetimeMinutes + settings.graceMinutes) / 60);
  return Math.round(hours * settings.hourlyEur * 10000) / 10000;
}

/**
 * May another machine be made right now? Checked before every create, never after.
 *
 * `running` is what the provider says exists (not what we remember making), and `spentTodayEur` is
 * the sum of the worst cases of every machine made today. The reason is a sentence a founder reads.
 */
export function budgetCheck({ running, spentTodayEur, settings = DEFAULTS }) {
  if (running >= settings.maxMachines) {
    return {
      ok: false,
      reason: `Your team already has ${running} temporary machine${running === 1 ? '' : 's'} working, which is the most allowed at once. This ticket waits for one to finish.`,
    };
  }
  const next = worstCaseEur(settings);
  if (spentTodayEur + next > settings.dailyCapEur + 1e-9) {
    return {
      ok: false,
      reason: `Today's spending cap for temporary machines (€${settings.dailyCapEur.toFixed(2)}) would be passed by one more, so this ticket waits until tomorrow.`,
    };
  }
  return { ok: true, costEur: next };
}

/** A provider-safe label value: letters, digits, dot, dash, underscore; at most 63; ends alphanumeric. */
export function labelValue(raw) {
  const cleaned = String(raw ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 63);
  return cleaned.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '');
}

/** A hostname-safe machine name, unique per run. */
export function machineName({ venture, ticket, runId }) {
  const part = (s, n) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);
  const name = ['fw', part(venture, 12), part(ticket, 30), part(runId, 10)].filter(Boolean).join('-');
  return name.replace(/-+$/g, '').slice(0, 63);
}

export function labelsFor({ venture, ticket, runId, expiresAtMs }) {
  return {
    [ROLE_LABEL]: ROLE_VALUE,
    'foundry-venture': labelValue(venture),
    'foundry-ticket': labelValue(ticket),
    'foundry-run': labelValue(runId),
    // Seconds since 1970, as text. The deadline lives ON the machine, at the provider, so the reaper
    // needs nothing from this box to know when a machine must be gone.
    'foundry-expires': String(Math.floor(expiresAtMs / 1000)),
  };
}

export const isOurs = (machine) => machine?.labels?.[ROLE_LABEL] === ROLE_VALUE;

/**
 * When a machine must be gone, in milliseconds.
 *
 * Read from its label. A machine whose label is missing or unreadable is still ours (the role label
 * says so), so it falls back to when it was made plus the lifetime; and one where neither can be read
 * is treated as already overdue. "Cannot tell" ends in destruction, because a forgotten machine costs
 * money every hour and a destroyed worker only costs a retry.
 */
export function deadlineOf(machine, settings = DEFAULTS) {
  const label = machine?.labels?.['foundry-expires'];
  if (label && /^\d{9,11}$/.test(label)) return Number(label) * 1000;
  const created = Date.parse(machine?.createdAt ?? '');
  if (Number.isFinite(created)) return created + settings.lifetimeMinutes * 60_000;
  return 0;
}

export function overdue(machines, nowMs, settings = DEFAULTS) {
  return machines.filter(
    (m) => isOurs(m) && nowMs > deadlineOf(m, settings) + settings.graceMinutes * 60_000,
  );
}

/** Destroy, retrying a few times. Returns true when the provider says it is gone. */
async function destroyWithRetry(provider, id, log, attempts = 3) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await provider.destroy(id);
      return true;
    } catch (err) {
      log(`could not remove temporary machine ${id} (try ${i} of ${attempts}): ${err?.message ?? err}`);
    }
  }
  return false;
}

/**
 * The reaper. Destroys every ticket machine past its deadline and leaves everything else alone.
 *
 * Asks the provider what exists rather than reading a list this box kept, so a lost or wiped box
 * cannot hide a machine from it.
 */
export async function reap({ provider, now = Date.now, settings = DEFAULTS, log = () => {} }) {
  const all = await provider.list();
  const mine = all.filter(isOurs);
  const late = overdue(mine, now(), settings);
  const destroyed = [];
  const failed = [];
  for (const m of late) {
    if (await destroyWithRetry(provider, m.id, log)) {
      destroyed.push(m.name ?? String(m.id));
      log(`removed ${m.name ?? m.id}: it was past its deadline`);
    } else {
      failed.push(m.name ?? String(m.id));
    }
  }
  const kept = mine.filter((m) => !late.includes(m)).map((m) => m.name ?? String(m.id));
  return { destroyed, failed, kept };
}

// --- what the machine is given -------------------------------------------------------------------

/**
 * The only environment variables a worker receives. Everything else on the persistent machine —
 * the approval record's keys, the brain's settings, the office, any other venture's anything — is
 * not on this list and so cannot reach it. Adding a name here is the one way to widen what a worker
 * holds, which is why it is a list and not a filter on "secret-looking" names.
 */
export const WORKER_ENV = Object.freeze([
  'REPO', 'BASE_BRANCH', 'LANE_ID', 'LANE_DEPARTMENT', 'LANE_GATE', 'LANE_REQUIRE_PROPOSAL',
  'STATE_REF', 'TICKET_GITHUB_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY',
  'MAX_VALIDATION_ROUNDS', 'PLAN_TIMEOUT', 'IMPL_TIMEOUT', 'REVIEW_TIMEOUT', 'QA_TIMEOUT',
]);

/** Single-quote for a shell env file. A value with a newline is refused, not escaped. */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * The run's environment file. Only `WORKER_ENV` names, and the ticket the worker is for.
 * Throws on a value with a line break, because one would let a value write a second variable.
 */
export function workerEnvFile({ env, slug, ticketPath }) {
  const lines = [];
  for (const key of WORKER_ENV) {
    const value = env[key];
    if (value === undefined || value === '') continue;
    if (/[\r\n]/.test(String(value))) throw new Error(`${key} has a line break in it and was not sent`);
    lines.push(`${key}=${shellQuote(value)}`);
  }
  lines.push(`TICKET_SLUG=${shellQuote(slug)}`);
  lines.push(`TICKET_PATH=${shellQuote(ticketPath)}`);
  return `${lines.join('\n')}\n`;
}

/** A ticket path inside the repo, and nothing that could climb out of it. */
export function safeTicketPath(path) {
  const p = String(path ?? '');
  if (!/^docs\/tickets\/[A-Za-z0-9._-]+\.md$/.test(p)) {
    throw new Error(`not a ticket path inside the repository: ${p}`);
  }
  return p;
}

/**
 * The machine's start-up script (cloud-init). It holds **no secret**: a provider keeps this text and
 * shows it to anyone with the account, and the machine itself can read it back. Credentials go over
 * the run's own key after the machine is up.
 *
 * It does three things: lets in only this run's key, installs what the lane needs, and schedules the
 * machine to power itself off at its deadline.
 */
export function workerUserData({ hostname, publicKey, lifetimeMinutes }) {
  if (!/^ssh-(ed25519|rsa) [A-Za-z0-9+/=]+( [^\n]*)?$/.test(String(publicKey ?? '').trim())) {
    throw new Error('the run key is not a single public SSH key');
  }
  return [
    '#cloud-config',
    '# A Foundry ticket machine (FB-239). Exists for one ticket, then is destroyed.',
    `hostname: ${hostname}`,
    'users:',
    '  - name: root',
    '    ssh_authorized_keys:',
    `      - ${publicKey.trim()}`,
    'package_update: true',
    'packages: [git, curl, unzip, jq, uuid-runtime, nodejs, npm, ufw]',
    'write_files:',
    '  - path: /etc/ssh/sshd_config.d/10-hardening.conf',
    '    content: |',
    '      PasswordAuthentication no',
    '      PermitRootLogin prohibit-password',
    'runcmd:',
    // The machine's own deadline. Work stops here even if the persistent machine never comes back.
    `  - shutdown -P +${Math.max(1, Math.floor(lifetimeMinutes))} "Foundry ticket machine: lifetime reached"`,
    '  - ufw default deny incoming',
    '  - ufw allow OpenSSH',
    '  - ufw --force enable',
    '  - systemctl restart ssh || systemctl restart sshd || true',
    `  - mkdir -p ${RUN_DIR}/state ${LANE_ON_WORKER}`,
    '',
  ].join('\n');
}

/**
 * Everything sent to the worker over the run's key: the lane's files, the run's environment, and
 * the script that runs it. Lane files are passed in by name and content so the selection is the
 * caller's (and the test's) to see.
 */
export function bundleFor({ env, slug, ticketPath, laneFiles, workerScript }) {
  const files = laneFiles.map(({ name, content }) => ({
    path: `${LANE_ON_WORKER}/${name}`,
    content,
    mode: name.endsWith('.sh') ? 0o755 : 0o644,
  }));
  files.push({ path: `${RUN_DIR}/worker-run.sh`, content: workerScript, mode: 0o755 });
  files.push({ path: `${RUN_DIR}/run.env`, content: workerEnvFile({ env, slug, ticketPath: safeTicketPath(ticketPath) }), mode: 0o600 });
  return { files, command: `bash ${RUN_DIR}/worker-run.sh` };
}

/** What the worker wrote when it finished. `null` means it did not finish. */
export function parseResult(text) {
  if (!text) return null;
  try {
    const r = JSON.parse(text);
    if (typeof r !== 'object' || r === null || !Number.isInteger(r.exit)) return null;
    return {
      exit: r.exit,
      stage: typeof r.stage === 'string' ? r.stage : '',
      skills: typeof r.skills === 'string' ? r.skills.split(/\s+/).filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

// --- the run --------------------------------------------------------------------------------------

/**
 * Work one ticket on a machine that exists only for it. Always returns; never throws.
 *
 * `ok` means the lane ran to its own end on the worker — which includes the lane deciding the ticket
 * is blocked, because the lane writes its own run report about that. `ok: false` means the machine
 * never got that far, and `summary` is the sentence the founder's run report should carry.
 */
export async function runTicketOnMachine({
  provider, transport, venture, ticket, slug, ticketPath, env, laneFiles, workerScript,
  runId, publicKey, settings = DEFAULTS, now = Date.now, log = () => {},
}) {
  const startedMs = now();
  const expiresAtMs = startedMs + settings.lifetimeMinutes * 60_000;
  const name = machineName({ venture, ticket: ticket || slug, runId });
  const labels = labelsFor({ venture, ticket: ticket || slug, runId, expiresAtMs });
  let machine = null;
  let reached = 'start';
  const out = { ok: false, summary: '', machine: name, destroyed: false, skills: [], sessions: '' };

  try {
    // Built before anything is created, so a bad ticket path or a bad value costs nothing.
    const bundle = bundleFor({ env, slug, ticketPath, laneFiles, workerScript });
    const userData = workerUserData({ hostname: name, publicKey, lifetimeMinutes: settings.lifetimeMinutes });

    reached = 'create';
    machine = await provider.create({ name, labels, userData, publicKey });
    log(`made temporary machine ${name} for ${slug}; it must be gone by ${new Date(expiresAtMs).toISOString()}`);

    reached = 'ready';
    machine = await provider.waitReady(machine, { timeoutMs: settings.readyTimeoutMs });
    if (transport.waitReachable) await transport.waitReachable(machine, { timeoutMs: settings.readyTimeoutMs });

    reached = 'deliver';
    await transport.send(machine, bundle.files);

    reached = 'work';
    // The run may use what is left of the lifetime, less a minute to bring the results back.
    const remainingMs = Math.max(60_000, expiresAtMs - now() - 60_000);
    await transport.run(machine, bundle.command, { timeoutMs: remainingMs });

    reached = 'collect';
    const result = parseResult(await transport.fetch(machine, RESULT_PATH));
    out.sessions = (await transport.fetch(machine, SESSIONS_PATH).catch(() => null)) ?? '';
    if (!result) {
      out.summary = 'Your team started this ticket on its own temporary machine, but the work stopped before it finished and left no record. The next wake will try again.';
    } else {
      out.ok = true;
      out.skills = result.skills;
      out.exit = result.exit;
      out.summary = result.exit === 0
        ? 'Your team worked this ticket on its own temporary machine.'
        : 'Your team worked this ticket on its own temporary machine and reported what happened.';
    }
  } catch (err) {
    log(`ticket machine for ${slug} failed at "${reached}": ${err?.message ?? err}`);
    out.summary = {
      start: 'Your team could not prepare this ticket to run on its own machine, so nothing was started.',
      create: 'Your team could not get a temporary machine for this ticket, so the work did not start. The next wake will try again.',
      ready: 'Your team got a temporary machine for this ticket, but it did not finish starting up. The next wake will try again.',
      deliver: 'Your team could not set up its temporary machine for this ticket. The next wake will try again.',
      work: 'Your team was working this ticket on its own temporary machine when the run broke off. The next wake will try again.',
      collect: 'Your team finished on its temporary machine but could not read back what happened.',
    }[reached];
    out.failedAt = reached;
  } finally {
    // Step 6, whatever happened above. If we never learned the machine's id — the create call failed
    // after the provider had made it — find it by this run's label instead.
    const ids = [];
    if (machine?.id !== undefined) ids.push(machine.id);
    else if (reached !== 'start') {
      try {
        const found = (await provider.list()).filter(
          (m) => isOurs(m) && m.labels?.['foundry-run'] === labels['foundry-run'],
        );
        ids.push(...found.map((m) => m.id));
      } catch (err) {
        log(`could not look for a half-made machine for run ${runId}: ${err?.message ?? err}`);
      }
    }
    let allGone = true;
    for (const id of ids) {
      if (!(await destroyWithRetry(provider, id, log))) allGone = false;
    }
    out.destroyed = allGone;
    if (!allGone) {
      const by = new Date(expiresAtMs + settings.graceMinutes * 60_000).toISOString().slice(11, 16);
      out.summary += ` Its machine could not be removed straight away; the clean-up job will remove it by ${by} UTC.`;
    } else if (ids.length) {
      out.summary += ' Its machine has been removed.';
    }
  }
  return out;
}
