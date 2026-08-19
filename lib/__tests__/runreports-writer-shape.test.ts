import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fromLaneRecord } from '../runreports';

/**
 * FB-060: the writer half, checked against the reader that has to understand it.
 *
 * The studio's reader accepts two shapes — the lane's own and the contract's — and has since FB-042.
 * That was deliberate: reader first, so the box could change without a flag day. This is the test
 * that the box's new output actually IS the contract shape, and that it is still read correctly.
 *
 * It imports the very module `write_runreport` calls, so the thing under test is the thing that
 * ships — not a copy of it, which would only prove the copy works.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const RECORD_MJS = resolve(HERE, '../../deploy/lane/runreport-record.mjs');

/**
 * Build a record exactly as `write_runreport` does — by importing the module the shell calls.
 *
 * An earlier version of this test lifted the program back out of `foundry-lib.sh` by string
 * matching. That worked and was brittle for no gain; moving the program into its own file (which
 * shellcheck also wanted) means the thing under test is the thing that ships.
 */
const { buildRecord } = await import(RECORD_MJS);

function write(args: {
  slug: string;
  status: string;
  summary: string;
  pr?: string;
  started?: string;
  repo?: string;
  lane?: string;
  trigger?: string;
}): Record<string, unknown> {
  return buildRecord({
    slug: args.slug,
    status: args.status,
    summary: args.summary,
    prUrl: args.pr ?? '',
    started: args.started ?? '2026-08-19T12:00:00Z',
    repo: args.repo ?? 'wealthcx01/arca',
    lane: args.lane ?? 'arca',
    trigger: args.trigger ?? 'scheduled',
    now: '2026-08-19T12:30:00Z',
  });
}

describe('the RunReport the lane writes', () => {
  it('carries the contract fields', () => {
    const r = write({ slug: 'ARCA-50', status: 'opened_pr', summary: 'Added set names.', pr: 'https://x/1' });
    expect(r.lane_id).toBe('arca');
    expect(r.started_at).toBe('2026-08-19T12:00:00Z');
    expect(r.trigger).toBe('scheduled');
    expect(r.outcome).toBe('opened-pr');
    expect(r.summary_md).toBe('Added set names.');
    expect(r.tickets_touched).toEqual(['ARCA-50']);
    expect(r.pr_url).toBe('https://x/1');
  });

  it('translates every status the lane can emit into the contract vocabulary', () => {
    const cases: [string, string][] = [
      ['idle', 'no-useful-work'],
      ['opened_pr', 'opened-pr'],
      ['blocked', 'blocked'],
      ['awaiting_founder', 'awaiting-approval'],
      ['failed', 'error'],
      ['progress', 'progress'],
    ];
    for (const [status, outcome] of cases) {
      expect(write({ slug: 't', status, summary: 's' }).outcome).toBe(outcome);
    }
  });

  it('states neither ended_at nor outcome while a run is in flight', () => {
    // The contract's invariant: they travel together. Half of that fact renders as something untrue.
    const r = write({ slug: 't', status: 'working', summary: 'Started.' });
    expect(r.outcome).toBeNull();
    expect(r.ended_at).toBeNull();
  });

  it('gives a reason for the outcomes that owe one', () => {
    expect(write({ slug: 't', status: 'blocked', summary: 'Needed a decision.' }).error_detail).toBe(
      'Needed a decision.',
    );
    expect(write({ slug: 't', status: 'failed', summary: 'Crashed.' }).error_detail).toBe('Crashed.');
    expect(write({ slug: 't', status: 'progress', summary: 'Fine.' }).error_detail).toBeNull();
  });

  it('does not list a ticket for the heartbeat', () => {
    expect(write({ slug: 'heartbeat', status: 'idle', summary: 'Awake.' }).tickets_touched).toEqual([]);
  });

  it('surfaces an unrecognised status as blocked rather than dropping it', () => {
    // Same rule the reader applies: a lane that grows a new state must show up as "something
    // happened I cannot explain", never as nothing at all.
    expect(write({ slug: 't', status: 'invented', summary: 's' }).outcome).toBe('blocked');
  });
});

describe('the studio reads what the lane now writes', () => {
  it('normalises a new-shape record', () => {
    const record = write({ slug: 'ARCA-50', status: 'opened_pr', summary: 'Added set names.', pr: 'https://x/1' });
    const parsed = fromLaneRecord(record, 'arca');
    expect(parsed?.laneId).toBe('arca');
    expect(parsed?.outcome).toBe('opened-pr');
    expect(parsed?.prUrl).toBe('https://x/1');
    expect(parsed?.ticketsTouched).toEqual(['ARCA-50']);
  });

  it('still normalises a record written before this ticket', () => {
    // The acceptance criterion that matters most: everything already on the ref stays readable.
    const legacy = {
      ticket: 'ARCA-44',
      lane: 'arca',
      status: 'opened_pr',
      summary: 'Made the seed script fail loudly.',
      pr_url: 'https://x/2',
      started: '2026-08-18T20:00:00Z',
      finished: '2026-08-18T20:12:00Z',
      repo: 'wealthcx01/arca',
    };
    const parsed = fromLaneRecord(legacy, 'arca');
    expect(parsed?.laneId).toBe('arca');
    expect(parsed?.outcome).toBe('opened-pr');
    expect(parsed?.summaryMd).toBe('Made the seed script fail loudly.');
  });

  it('reads an in-flight record as in flight, in both shapes', () => {
    expect(fromLaneRecord(write({ slug: 't', status: 'working', summary: 'Started.' }), 'arca')?.outcome).toBeNull();
    const legacyWorking = { ticket: 't', lane: 'arca', status: 'working', summary: 'Started.', started: '2026-08-19T12:00:00Z' };
    expect(fromLaneRecord(legacyWorking, 'arca')?.outcome).toBeNull();
  });
});
