import { describe, it, expect, beforeAll } from 'vitest';
import { loadVentures, type VentureSummary } from '../ventures';
import { loadRailData } from '../rail';
import { loadVentureAttention, type PrApproval } from '../attention';
import { ventureApprovals } from '../venture-reads';
import { countTickets, needsFounder, decisionOrder, type TicketRow } from '../tickets-view';
import { headerNeedsYou, needsYouCount, sendRows, sendSurface, sendsWaitingOnFounder } from '../needs-you';
import type { ActiveGraphApproval } from '../approvals';

/**
 * One count of what waits on a founder (FB-149).
 *
 * The rail's "Needs you" badge leads to Tickets filtered to "Needs you". Before this ticket the badge
 * counted pull requests, the desk counted pull requests and some sends, and Tickets listed no sends
 * at all — so a founder read two or three numbers for one question.
 *
 * These tests read the SAME fixtures the UI gate runs on: eight real-shaped approval records
 * (proposed, granted, executed, a forged grant, an executed forgery) and the fixture pull requests.
 * They run the rail's own loader rather than a copy of its arithmetic, so a change to what the badge
 * counts is caught here even if nobody changes this file.
 */

const RIG = {
  E2E_TEST_LOGIN: '1',
  PRS_FIXTURE_DIR: 'e2e/fixtures/prs',
  APPROVALS_FIXTURE_DIR: 'e2e/fixtures/approvals',
  RUNREPORTS_FIXTURE_DIR: 'e2e/fixtures/runreports',
  // The UI gate's own fixture secret (playwright.config.ts). With any other, every grant fails to
  // verify and every send reads as an incident — a world the gate never sees.
  FOUNDRY_APPROVAL_SECRET: 'e2e-approval-secret-not-for-production',
};

let venture: VentureSummary;
let attention: PrApproval[];
let approvals: ActiveGraphApproval[];

beforeAll(async () => {
  Object.assign(process.env, RIG);
  const found = loadVentures().find((v) => v.id === 'arca');
  if (!found) throw new Error('the arca manifest is missing — this test reads its fixtures');
  venture = found;
  attention = (await loadVentureAttention(venture, { refresh: true })).approvals;
  approvals = await ventureApprovals(venture);
});

/**
 * The destination's rows, built the way the Tickets page builds them: one row per ticket, with any
 * further pull requests on that ticket counted in `also`; one row per pull request tied to no
 * ticket; then the sends.
 */
function destinationRows(): TicketRow[] {
  const byTicket = new Map<string, TicketRow>();
  const rows: TicketRow[] = [];
  for (const pr of attention) {
    const waiting = { repo: pr.repo, number: pr.number, ageMs: pr.ageMs, also: 0 };
    if (pr.linkedTicketId) {
      const key = `${pr.repo} ${pr.linkedTicketId}`;
      const held = byTicket.get(key);
      if (held?.waiting) { held.waiting.also = (held.waiting.also ?? 0) + 1; continue; }
      const row: TicketRow = { id: pr.linkedTicketId, title: pr.title, repo: pr.repo, group: 'pr-open', item: null, progress: null, waiting, surface: null };
      byTicket.set(key, row);
      rows.push(row);
    } else {
      rows.push({ id: `${pr.repo}#${pr.number}`, title: pr.title, repo: pr.repo, group: 'pr-open', item: null, progress: null, waiting, surface: null });
    }
  }
  return [...sendRows(approvals, venture.id, () => 'Build'), ...rows];
}

describe('the fixtures can actually exercise this', () => {
  // A guard on the guard. If the fixtures held no sends, or only `proposed` ones, every test below
  // would pass while proving nothing about the cases that went wrong.
  it('has open pull requests, waiting sends, and a send that is not merely proposed', () => {
    expect(attention.length).toBeGreaterThan(0);
    const waiting = sendsWaitingOnFounder(approvals);
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting.some((a) => a.status !== 'proposed')).toBe(true);
    // And some sends that are NOT waiting, so a predicate that took everything would be caught.
    expect(approvals.length).toBeGreaterThan(waiting.length);
  });
});

describe('which sends wait on the founder', () => {
  // The fixtures hold no send that was tried and failed, so this takes a real fixture record and
  // sets each state on it in turn. Every state is named, so a new one added to the type later
  // fails here until somebody decides where it belongs.
  const expected: Record<ActiveGraphApproval['status'], boolean> = {
    proposed: true,
    failed: true,
    'unverified-action': true,
    granted: false,
    executing: false,
    executed: false,
    rejected: false,
  };
  for (const [status, waits] of Object.entries(expected)) {
    it(`a send that is ${status} ${waits ? 'waits' : 'does not wait'} on the founder`, () => {
      const one = { ...approvals[0], status } as ActiveGraphApproval;
      expect(sendsWaitingOnFounder([one]).length).toBe(waits ? 1 : 0);
    });
  }
});

describe('the badge and its destination cannot differ', () => {
  it('the rail badge states the number the "Needs you" filter lists', async () => {
    const rail = await loadRailData(venture);
    const listed = countTickets(destinationRows()).needs;
    expect(rail.needsYou).toBe(listed);
  });

  it('the badge counts sends, not only pull requests', async () => {
    const rail = await loadRailData(venture);
    expect(rail.needsYou).toBe(attention.length + sendsWaitingOnFounder(approvals).length);
    expect(rail.openWork).toBe(attention.length);
  });

  it('the desk sentence and banner count is the same number', async () => {
    // `deskSummary` and `blockerLine` both read `waitingOnFounder`, fed by `sendsWaitingOnFounder`.
    const rail = await loadRailData(venture);
    expect(needsYouCount(attention.length, approvals)).toBe(rail.needsYou);
  });
});

describe('a send on the Tickets screen', () => {
  it('is listed under "Needs you" and points at its own page, the only place it is decided', () => {
    const rows = sendRows(approvals, venture.id, () => null);
    expect(rows.length).toBe(sendsWaitingOnFounder(approvals).length);
    for (const r of rows) {
      expect(needsFounder(r)).toBe(true);
      expect(r.send?.href).toBe(`/venture/arca/approvals/${r.repo}/${r.send?.approvalId}`);
      // No `waiting`: that is what draws the pull-request decision panel, and a send must not get one.
      expect(r.waiting).toBeNull();
    }
  });

  it('carries the alarm when its grant cannot be verified', () => {
    const forged = approvals.find((a) => a.id === 'forged-grant');
    expect(forged, 'the forged-grant fixture is missing').toBeDefined();
    const [row] = sendRows([forged!], venture.id, () => null);
    expect(row.send?.unverified).toBe(true);
  });

  it('comes first in the decision order, as it does on the desk', () => {
    const order = decisionOrder(destinationRows());
    const firstPr = order.findIndex((r) => !r.send);
    const lastSend = order.map((r) => Boolean(r.send)).lastIndexOf(true);
    expect(lastSend).toBeLessThan(firstPr);
  });
});

describe('the part of the company a send belongs to', () => {
  // Real shape: ARCA's own manifest and its fixture proposals, which name `department: sell` and are
  // proposed from the `arca` repository — the Build repository. Going by repository alone called the
  // investor email "Build — Product".
  it('is the department the proposal names, not the repository it came from', () => {
    const sell = sendsWaitingOnFounder(approvals).find((a) => a.department === 'sell');
    expect(sell, 'no waiting fixture send names the sell department').toBeDefined();
    expect(venture.departments.find((d) => d.repo === sell!.repo)?.id).not.toBe('sell');
    expect(sendSurface(venture.departments, sell!)).toBe('Sell — Go-to-market');
  });

  it('falls back to the repository when the proposal names no department', () => {
    const one = { ...approvals[0], department: null };
    expect(sendSurface(venture.departments, one)).toBe('Build — Product');
  });
});

describe('the header’s "Needs you", which is the only one on a phone', () => {
  it('leads a founder to their own venture’s list, where the badge’s number is counted', () => {
    expect(headerNeedsYou({ isAdmin: false, ventureIds: ['arca'] })).toEqual({
      href: '/venture/arca/tickets?filter=needs',
      venture: 'arca',
    });
  });

  it('keeps the cross-venture page for anyone who can see several ventures', () => {
    expect(headerNeedsYou({ isAdmin: true, ventureIds: ['arca'] })).toEqual({ href: '/attention', venture: null });
    expect(headerNeedsYou({ isAdmin: false, ventureIds: ['arca', 'the-reset'] }).venture).toBeNull();
  });
});
