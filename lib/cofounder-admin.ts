/**
 * What the admin view may do to the studio's cofounder, and who may do it (FB-201).
 *
 * Four things, and only four: change one venture's settings, press or lift the studio-wide stop,
 * release a venture the cofounder is holding back on, and ask it to look now. None of them can make
 * it send, spend, merge, deploy or approve — `saveSettings` stores only what `normaliseSettings`
 * knows, and the floor in `lib/cofounder.ts` is checked before any setting is read.
 *
 * Who may do what:
 * - Settings, the stop, and "look now": Bruntsfield only (`STUDIO_ADMIN_EMAILS`). John asked for the
 *   limits to be "settings that I manage in the admin view".
 * - Releasing a venture: Bruntsfield, or that venture's own founder. The latch exists so a person
 *   decides; the founder is the person the question was for.
 *
 * The signed-in address is passed in by the server action, which reads it from the session. Nothing
 * the page sends is believed about who is asking.
 */
import { authorizeVentures, canAccessVenture, parseAdminEmails } from './authz';
import { normaliseSettings, releaseLatch, renderMemory, type CofounderMemory, type CofounderSettings } from './cofounder';
import { loadMemory, wakeVenture, type CofounderDeps } from './cofounder-service';
import { readSettings, readStop, saveSettings, setStop } from './cofounder-store';

export type AdminResult = { ok: boolean; message: string };

const NOT_ADMIN: AdminResult = { ok: false, message: 'Only the Bruntsfield team can change the studio’s cofounder. Nothing changed.' };

function access(deps: CofounderDeps, email: string | null) {
  return authorizeVentures(
    email,
    deps.ventures.map((v) => ({ id: v.id, founderEmail: v.founderEmail ?? null })),
    parseAdminEmails(deps.env.STUDIO_ADMIN_EMAILS),
  );
}

const ventureOf = (deps: CofounderDeps, id: string) => deps.ventures.find((v) => v.id === id) ?? null;

export async function changeSettings(deps: CofounderDeps, email: string | null, ventureId: string, raw: unknown): Promise<AdminResult> {
  if (!access(deps, email).isAdmin || !email) return NOT_ADMIN;
  const venture = ventureOf(deps, ventureId);
  if (!venture) return { ok: false, message: 'That venture is not in this studio.' };
  const now = new Date((deps.now ?? Date.now)());
  const saved = await deps.withVenture(venture.id, (q) => saveSettings(q, venture.id, raw, email, now));
  return { ok: true, message: saved.on ? `Saved. It is on for ${venture.name}.` : `Saved. It is off for ${venture.name}.` };
}

export async function changeStop(deps: CofounderDeps, email: string | null, stopped: boolean): Promise<AdminResult> {
  if (!access(deps, email).isAdmin || !email) return NOT_ADMIN;
  const first = deps.ventures[0];
  if (!first) return { ok: false, message: 'This studio has no ventures.' };
  const now = new Date((deps.now ?? Date.now)());
  // The stop is one row for the whole studio; the connection just has to be scoped to something.
  await deps.withVenture(first.id, (q) => setStop(q, stopped, email, now));
  return {
    ok: true,
    message: stopped
      ? 'Stopped. The cofounder will not wake for any venture until somebody lifts this.'
      : 'Lifted. Each venture now follows its own settings again.',
  };
}

export async function releaseVenture(deps: CofounderDeps, email: string | null, ventureId: string): Promise<AdminResult> {
  const venture = ventureOf(deps, ventureId);
  if (!venture || !canAccessVenture(access(deps, email), ventureId)) {
    return { ok: false, message: 'You cannot release this venture. Nothing changed.' };
  }
  const mem = await loadMemory(deps, venture);
  if (mem.unreadable) return { ok: false, message: 'Its memory file could not be read, so nothing was changed.' };
  if (!mem.memory.latch) return { ok: true, message: `It was not holding back on ${venture.name}.` };
  const next: CofounderMemory = { ...releaseLatch(mem.memory), lastOutcome: `Released by ${email}. ${mem.memory.lastOutcome ?? ''}`.trim() };
  await deps.writeMemory(venture, renderMemory(next), mem.sha, `cofounder: ${venture.id} released by a person`);
  return { ok: true, message: `Released. It will look at ${venture.name} again at its next wake.` };
}

export async function lookNow(deps: CofounderDeps, email: string | null, ventureId: string): Promise<AdminResult> {
  if (!access(deps, email).isAdmin) return NOT_ADMIN;
  const venture = ventureOf(deps, ventureId);
  if (!venture) return { ok: false, message: 'That venture is not in this studio.' };
  // `force` skips only "not due yet". Off, the stop, the latch and quiet hours still win.
  const r = await wakeVenture(deps, venture, { force: true });
  return { ok: true, message: r.sentence };
}

export interface VentureCofounderView {
  ventureId: string;
  name: string;
  settings: CofounderSettings;
  setBy: string | null;
  setAt: Date | null;
  /** Null when the memory could not be read; the page says so rather than showing a blank. */
  memory: CofounderMemory | null;
  memoryError: string | null;
}

export interface CofounderOverview {
  stop: { stopped: boolean; setBy: string | null; setAt: Date | null };
  ventures: VentureCofounderView[];
}

/** Everything the admin view shows. A venture whose memory cannot be read says so; it does not vanish. */
export async function cofounderOverview(deps: CofounderDeps): Promise<CofounderOverview> {
  const first = deps.ventures[0];
  const stop = first ? await deps.withVenture(first.id, (q) => readStop(q)) : { stopped: false, setBy: null, setAt: null };
  const ventures: VentureCofounderView[] = [];
  for (const v of deps.ventures) {
    const s = await deps.withVenture(v.id, (q) => readSettings(q));
    let memory: CofounderMemory | null = null;
    let memoryError: string | null = null;
    try {
      const m = await loadMemory(deps, v);
      if (m.unreadable) memoryError = 'Its memory file is in git but could not be read.';
      else memory = m.memory;
    } catch (e) {
      memoryError = `Its memory could not be read just now (${(e as Error)?.message ?? 'unknown error'}).`;
    }
    ventures.push({ ventureId: v.id, name: v.name, settings: normaliseSettings(s.settings), setBy: s.setBy, setAt: s.setAt, memory, memoryError });
  }
  return { stop, ventures };
}
