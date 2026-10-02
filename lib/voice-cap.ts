/**
 * The daily cap on voice notes (FB-173).
 *
 * John, 2026-10-02: transcription is paid per minute, so each venture gets a daily allowance. The
 * count is the seconds the transcription service says it billed, kept per venture per UTC day in
 * `voicestore.usage` (db/006_voice_usage.sql). Only a number is kept — never audio, never words.
 *
 * Two notes sent in the same second can both pass the check and overrun the allowance by one note.
 * That is accepted: the cap is a spending guard, not an exact meter, and one note is a few minutes.
 */

export interface Querier {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** The allowance when VOICE_DAILY_MINUTES is not set. */
export const DEFAULT_DAILY_MINUTES = 30;

/** The day's allowance in seconds. A setting that is not a positive number falls back to the default. */
export function dailyLimitSeconds(env: Record<string, string | undefined> = process.env): number {
  const minutes = Number(env.VOICE_DAILY_MINUTES);
  return Math.round((Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_DAILY_MINUTES) * 60);
}

/** Today in UTC, as the date the count is kept under. The allowance resets at midnight UTC. */
export const utcDay = (now: number = Date.now()): string => new Date(now).toISOString().slice(0, 10);

/** Exported so the tests run these exact statements against real Postgres. */
export const SQL = {
  used: `select seconds from voicestore.usage
         where venture_id = current_setting('app.venture_id', true) and day = $1`,
  add: `insert into voicestore.usage (venture_id, day, seconds)
        values (current_setting('app.venture_id', true), $1, $2)
        on conflict (venture_id, day) do update set seconds = voicestore.usage.seconds + excluded.seconds`,
};

export async function secondsUsed(q: Querier, day: string): Promise<number> {
  const { rows } = await q.query(SQL.used, [day]);
  const n = Number(rows[0]?.seconds ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function addSeconds(q: Querier, day: string, seconds: number): Promise<void> {
  await q.query(SQL.add, [day, Math.max(0, Math.ceil(seconds))]);
}

/** What the founder is told when today's allowance is used up, or null while there is some left. */
export function capRefusal(usedSeconds: number, limitSeconds: number): string | null {
  if (usedSeconds < limitSeconds) return null;
  const minutes = Math.round(limitSeconds / 60);
  return `Today's voice notes for this venture are used up (${minutes} minutes a day). They start again at midnight UTC. You can still type.`;
}
