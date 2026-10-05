/**
 * Where the cofounder's settings and the studio-wide stop are kept (FB-201, `db/008_cofounder.sql`).
 *
 * Every function takes a connection already scoped to one venture (`withVenture`). The settings
 * table's policy then makes sure it can only see and change that venture's rows; the stop is one
 * switch for the whole studio and is the same whichever venture the connection is scoped to.
 *
 * Reads go through `normaliseSettings`, so whatever is stored, what comes out is a settings object
 * with only the fields the code knows — never one that could ask for something past the floor.
 */
import { DEFAULT_SETTINGS, normaliseSettings, type CofounderSettings } from './cofounder';
import type { Querier } from './machine-store';

export interface StoredSettings {
  settings: CofounderSettings;
  /** Who last changed them and when; null when nobody ever has and these are the defaults. */
  setBy: string | null;
  setAt: Date | null;
}

export async function readSettings(q: Querier): Promise<StoredSettings> {
  const { rows } = await q.query<{ settings: unknown; set_by: string; set_at: Date | string }>(
    'select settings, set_by, set_at from cofounder.settings order by set_at desc limit 1',
  );
  const row = rows[0];
  if (!row) return { settings: normaliseSettings(DEFAULT_SETTINGS), setBy: null, setAt: null };
  return { settings: normaliseSettings(row.settings), setBy: row.set_by, setAt: new Date(row.set_at) };
}

export async function saveSettings(q: Querier, ventureId: string, settings: unknown, by: string, at: Date): Promise<CofounderSettings> {
  const clean = normaliseSettings(settings);
  await q.query(
    'insert into cofounder.settings (venture_id, set_at, set_by, settings) values ($1, $2, $3, $4)',
    [ventureId, at.toISOString(), by, JSON.stringify(clean)],
  );
  return clean;
}

export interface StopState {
  stopped: boolean;
  setBy: string | null;
  setAt: Date | null;
}

export async function readStop(q: Querier): Promise<StopState> {
  const { rows } = await q.query<{ stopped: boolean; set_by: string; set_at: Date | string }>(
    'select stopped, set_by, set_at from cofounder.stops order by set_at desc limit 1',
  );
  const row = rows[0];
  return row ? { stopped: row.stopped, setBy: row.set_by, setAt: new Date(row.set_at) } : { stopped: false, setBy: null, setAt: null };
}

export async function setStop(q: Querier, stopped: boolean, by: string, at: Date): Promise<void> {
  await q.query('insert into cofounder.stops (set_at, set_by, stopped) values ($1, $2, $3)', [at.toISOString(), by, stopped]);
}
