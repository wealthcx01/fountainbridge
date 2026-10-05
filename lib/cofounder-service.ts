/**
 * The cofounder's wake, for every venture, with the real world passed in (FB-201).
 *
 * `lib/cofounder.ts` decides; this file fetches what it needs to decide, and carries out what it is
 * allowed to. It does three things with the outside world and only three: it reads (the venture's
 * tickets and run reports, its settings, the studio-wide stop, its own memory), it writes its memory
 * back to git, and it leaves a note on a ticket through the same function a founder's own note uses.
 * There is no fourth thing it could be told to do.
 *
 * Nothing here reads the session, the network or the clock directly. The route passes them in, so
 * the tests drive the whole pass with real Postgres and stand-ins for git.
 */
import { carryOut, emptyMemory, parseMemory, releaseLatch, renderMemory, wake, type CofounderMemory, type RunSeen, type TicketSeen, type WakeOutcome } from './cofounder';
import { readSettings, readStop } from './cofounder-store';
import type { Querier } from './machine-store';
import { bearerOf, sameSecret } from './ticket-machines';
import type { VentureSummary } from './ventures';

export interface MemoryFile {
  text: string | null;
  /** The file's version in git, needed to replace it. Absent when it does not exist yet. */
  sha?: string;
}

export interface CofounderDeps {
  env: Record<string, string | undefined>;
  ventures: VentureSummary[];
  withVenture: <T>(ventureId: string, fn: (q: Querier) => Promise<T>) => Promise<T>;
  readMemory: (venture: VentureSummary) => Promise<MemoryFile>;
  writeMemory: (venture: VentureSummary, text: string, sha: string | undefined, message: string) => Promise<void>;
  readTickets: (venture: VentureSummary) => Promise<TicketSeen[] | null>;
  readRuns: (venture: VentureSummary) => Promise<RunSeen[] | null>;
  noteOnTicket: (venture: VentureSummary, repo: string, ticketId: string, text: string) => Promise<{ ok: boolean; message: string }>;
  now?: () => number;
  log?: (line: string) => void;
}

/** Where a venture's memory lives: its first repository, on the state ref threads already use. */
export const MEMORY_PATH = 'cofounder/memory.md';

export interface VentureWake {
  ventureId: string;
  ran: boolean;
  /** One sentence for the admin view and the log. */
  sentence: string;
  /** What it tried to carry out, and whether each went through. */
  carried: Array<{ kind: string; ticketId?: string; done: boolean; reason: string }>;
}

export async function loadMemory(deps: CofounderDeps, venture: VentureSummary): Promise<{ memory: CofounderMemory; sha?: string; unreadable: boolean }> {
  const file = await deps.readMemory(venture);
  if (!file.text) return { memory: emptyMemory(venture.id), sha: file.sha, unreadable: false };
  const parsed = parseMemory(file.text, venture.id);
  return parsed ? { memory: parsed, sha: file.sha, unreadable: false } : { memory: emptyMemory(venture.id), sha: file.sha, unreadable: true };
}

/**
 * One venture's wake, end to end.
 *
 * A memory file that exists but cannot be read stops the wake rather than starting over: starting
 * over would forget what it had already raised and raise it all again, and would drop a latch a
 * person had not released. It says so instead (CLAUDE.md #10).
 */
export async function wakeVenture(deps: CofounderDeps, venture: VentureSummary, opts: { force?: boolean } = {}): Promise<VentureWake> {
  const now = (deps.now ?? Date.now)();
  const { settings, stop } = await deps.withVenture(venture.id, async (q) => ({ settings: (await readSettings(q)).settings, stop: await readStop(q) }));
  const base = { ventureId: venture.id, carried: [] as VentureWake['carried'] };

  // The cheap refusals first, so a venture that is off costs no reads from git at all.
  if (stop.stopped) return { ...base, ran: false, sentence: 'The studio-wide stop is on, so it did not wake for any venture.' };
  if (!settings.on) return { ...base, ran: false, sentence: `It is switched off for ${venture.name}.` };

  const mem = await loadMemory(deps, venture);
  if (mem.unreadable) {
    return { ...base, ran: false, sentence: `Its memory file for ${venture.name} is in git but could not be read, so it did not wake rather than start again from nothing. Fix or remove ${MEMORY_PATH} on the foundry-state branch.` };
  }

  const [tickets, runs] = await Promise.all([
    settings.reads.tickets ? deps.readTickets(venture) : Promise.resolve(null),
    settings.reads.runReports ? deps.readRuns(venture) : Promise.resolve(null),
  ]);

  const outcome: WakeOutcome = wake({
    ventureId: venture.id, ventureName: venture.name, settings, killSwitch: stop.stopped,
    memory: mem.memory, now, clock: deps.now ?? Date.now, force: opts.force, tickets, runs,
  });
  if (!outcome.ran) return { ...base, ran: false, sentence: outcome.sentence };

  const results = await carryOut(outcome.proposals, settings, {
    noteOnTicket: (repo, ticketId, text) => deps.noteOnTicket(venture, repo, ticketId, text),
  });
  const carried = results.map((r) => ({ kind: r.proposal.kind, ticketId: r.proposal.ticketId, done: r.done, reason: r.reason }));

  // A raise whose note did not land must not latch: the founder would be waiting on a question they
  // were never asked. Undo the latch and the "raised" mark so the next wake tries again.
  let memory = outcome.memory;
  const failed = results.filter((r) => !r.done);
  let sentence = outcome.sentence;
  if (failed.length > 0) {
    const tickets = { ...memory.tickets };
    for (const f of failed) {
      const key = `${f.proposal.repo}/${f.proposal.ticketId}`;
      if (tickets[key]) tickets[key] = { ...tickets[key], raisedAt: null };
    }
    memory = { ...releaseLatch(memory), tickets };
    sentence = `${sentence} But ${failed.length} note${failed.length === 1 ? '' : 's'} could not be written (${failed[0].reason}), so it will try again next time.`;
    memory = { ...memory, lastOutcome: sentence };
  }

  await deps.writeMemory(venture, renderMemory(memory), mem.sha, `cofounder: ${venture.id} woke`);
  return { ...base, ran: true, sentence, carried };
}

/** The key the timer presents. A random string John sets on the studio; at least 32 characters. */
export function wakeKey(env: Record<string, string | undefined>): string | null {
  const k = env.COFOUNDER_WAKE_KEY?.trim();
  return k && k.length >= 32 ? k : null;
}

export type WakeReply = { status: number; body: Record<string, unknown> };

/**
 * The timer's call: every venture, one at a time, each failure kept to its own venture.
 *
 * One at a time on purpose. The machine this runs on is small, and a cofounder that wakes every
 * venture at once is a burst against GitHub's limits for no gain — nobody is waiting on it.
 */
export async function wakeAll(deps: CofounderDeps, header: string | null): Promise<WakeReply> {
  const key = wakeKey(deps.env);
  if (!key || !sameSecret(bearerOf(header), key)) return { status: 401, body: { woke: [], reason: 'Not authorised.' } };
  const log = deps.log ?? (() => {});
  const woke: VentureWake[] = [];
  for (const v of deps.ventures) {
    try {
      const r = await wakeVenture(deps, v);
      log(`${v.id}: ${r.sentence}`);
      woke.push(r);
    } catch (e) {
      const sentence = `It could not wake for ${v.name}: ${(e as Error)?.message ?? 'unknown error'}. Nothing was changed; the next wake will try again.`;
      log(`${v.id}: ${sentence}`);
      woke.push({ ventureId: v.id, ran: false, sentence, carried: [] });
    }
  }
  return { status: 200, body: { woke } };
}
