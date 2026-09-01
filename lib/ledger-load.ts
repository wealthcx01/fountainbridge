import 'server-only';

/**
 * Gathering one ledger row (FB-136).
 *
 * Split from `lib/ledger.ts` for the reason every read model here is split: the pure half is
 * imported by a component, and a module that reaches for the network cannot be.
 *
 * ## What a row costs, and why the ledger streams
 *
 * Everything here goes through readers that are already shared per request — `loadRailData` (which
 * is React-`cache()`d), `ventureApprovals` and `ventureRuns` (FB-157), and `loadVentureTickets`
 * (cached per venture). So a row is not new reads so much as the same reads the venture's own rail
 * would make.
 *
 * They are still slow: `loadRunReports` is the most expensive read in the studio at ~4.3s (FB-157),
 * and the ledger asks for it once per venture. So the SCREEN streams and each ROW streams
 * separately — one venture whose records are slow must not hold up the four that are not.
 */

import type { VentureSummary } from './ventures';
import { loadRailData } from './rail';
import { ventureApprovals } from './venture-reads';
import { loadVentureTickets } from './tickets';
import { toRow, type LedgerRow } from './ledger';

export async function loadLedgerRow(venture: VentureSummary, nowMs: number): Promise<LedgerRow> {
  let degraded = false;
  const fell = <T,>(fallback: T) => (): T => {
    degraded = true;
    return fallback;
  };

  const [rail, approvals, tickets] = await Promise.all([
    loadRailData(venture, nowMs).catch(fell<Awaited<ReturnType<typeof loadRailData>> | null>(null)),
    ventureApprovals(venture).catch(fell<Awaited<ReturnType<typeof ventureApprovals>> | null>(null)),
    loadVentureTickets(venture).catch(fell<Awaited<ReturnType<typeof loadVentureTickets>> | null>(null)),
  ]);

  // A lane that failed to read is not a lane with no work in progress, so one unreadable lane
  // degrades the row rather than lowering its count.
  if (tickets?.lanes.some((l) => l.error)) degraded = true;

  return toRow({
    venture,
    openWork: rail ? rail.needsYou : null,
    awaitingApproval: approvals ? approvals.filter((a) => a.status === 'proposed').length : null,
    underway: tickets ? tickets.lanes.reduce((n, l) => n + l.groups['in-progress'].length, 0) : null,
    engine: rail ? { state: rail.engine.state, text: rail.engine.text } : null,
    budgets: rail?.budgets ?? [],
    // `loadRailData` degrades internally rather than throwing, so its own flag has to come out too.
    degraded: degraded || Boolean(rail?.degraded),
  });
}

/**
 * How long the things waiting on founders have been waiting, across every venture.
 *
 * Read off the attention queue's own ages rather than recomputed — the queue already knows, and a
 * second arithmetic for the same question is how two screens come to disagree.
 */
export async function loadWaitingAges(ventures: readonly VentureSummary[], nowMs: number): Promise<number[]> {
  const { loadVentureAttention } = await import('./attention');
  const perVenture = await Promise.all(
    ventures.map((v) =>
      loadVentureAttention(v)
        .then((a) => a.approvals.map((p) => p.ageMs ?? 0))
        .catch(() => [] as number[]),
    ),
  );
  void nowMs; // the ages are computed by the queue against its own fetch time, not against ours
  return perVenture.flat();
}
