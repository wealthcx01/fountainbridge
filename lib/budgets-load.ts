/**
 * Loading department budget limits from the studio repo (FB-054).
 *
 * SEPARATE from lib/budgets.ts because that module is imported by client components (the board and
 * the approval card render `describe()`), and this one reaches for `node:fs` and `js-yaml`. Keeping
 * them together pulled the filesystem into the client bundle — the same split lib/tickets already
 * observes.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { normalizeCurrency, parsePeriod, type Envelope } from './budgets';

/**
 * The result of reading a venture's limits.
 *
 * `error` keeps "this venture has set no budgets" apart from "the file is there but unreadable".
 * Collapsing them turned the disclosure off with nothing on screen to say so.
 */
export interface EnvelopeSet {
  envelopes: Envelope[];
  error: string | null;
}

/**
 * Parse a venture's budgets document.
 *
 *   currency: GBP
 *   period: monthly          # monthly | quarterly | yearly | all-time
 *   departments:
 *     sell: 480000           # integer MINOR units
 */
export function parseEnvelopes(raw: unknown): EnvelopeSet {
  if (raw === null || raw === undefined) return { envelopes: [], error: null };
  if (Array.isArray(raw)) return { envelopes: [], error: 'the budgets file is a list; it should be a mapping' };
  if (typeof raw !== 'object') return { envelopes: [], error: 'the budgets file is not a mapping' };

  const doc = raw as { currency?: unknown; period?: unknown; departments?: unknown };
  const currency = normalizeCurrency(doc.currency);
  if (doc.currency !== undefined && currency === null) {
    return { envelopes: [], error: `"${String(doc.currency)}" is not a currency code` };
  }
  const period = parsePeriod(doc.period);
  if (period === null) {
    return { envelopes: [], error: `"${String(doc.period)}" is not a period (monthly|quarterly|yearly|all-time)` };
  }

  const depts = doc.departments;
  if (depts === undefined) return { envelopes: [], error: 'the budgets file sets no departments' };
  if (!depts || typeof depts !== 'object') return { envelopes: [], error: 'departments is not a mapping' };

  const out: Envelope[] = [];
  const rejected: string[] = [];
  for (const [department, value] of Object.entries(depts as Record<string, unknown>)) {
    // A limit is a non-negative integer of MINOR units. A float means pounds were written where
    // pence were expected, which would misstate the limit by 100x.
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      rejected.push(department);
      continue;
    }
    out.push({ department, limitMinor: value, currency: currency ?? 'GBP', period });
  }

  return {
    envelopes: out.sort((a, b) => a.department.localeCompare(b.department)),
    error: rejected.length
      ? `the limit for ${rejected.join(', ')} is not a whole number of minor units (pence, not pounds)`
      : null,
  };
}

// A SUBDIRECTORY, not `ventures/<id>.budgets.yaml`: the manifest validator globs `ventures/*.yaml`
// and `loadVentures` reads the same directory, so a budgets file sitting beside the manifests was
// parsed as a malformed Venture by both.
const BUDGETS_DIR = join(process.cwd(), 'ventures', 'budgets');

/**
 * Load a venture's limits from THE STUDIO REPO. Venture lanes have no write access here, which is
 * the point: the limits that police an agent's spending must not be writable by that agent.
 */
export function loadEnvelopes(ventureId: string, dir = BUDGETS_DIR): EnvelopeSet {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(ventureId)) {
    return { envelopes: [], error: `"${ventureId}" is not a usable venture id for a budgets file` };
  }
  let text: string;
  try {
    text = readFileSync(join(dir, `${ventureId}.yaml`), 'utf8');
  } catch (err) {
    // ONLY a missing file means "no budgets set". A permissions fault or an EISDIR used to be
    // swallowed into the same silent path, turning the disclosure off with nothing on screen.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { envelopes: [], error: null };
    return { envelopes: [], error: `the budgets file could not be read (${(err as Error).message})` };
  }
  try {
    return parseEnvelopes(yaml.load(text));
  } catch (err) {
    return { envelopes: [], error: `the budgets file could not be read (${(err as Error).message})` };
  }
}
