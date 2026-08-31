import { describe, it, expect, beforeEach } from 'vitest';
import { timed, record, recentSteps, clearSteps, summarise, RING_SIZE } from '../timing';

/**
 * The measuring instrument (FB-151).
 *
 * Two rounds of optimisation went wrong by reasoning about which code looked expensive, so the
 * thing that replaces the reasoning has to be right. These are the ways it could quietly lie: drop
 * the reading for a failed step, report a mean dressed as a median, or grow without bound on a
 * server that never restarts.
 */
describe('timing a step', () => {
  beforeEach(clearSteps);

  it('records what a step cost and returns what it produced', async () => {
    const got = await timed('read', async () => 'value', 'arca');
    expect(got).toBe('value');
    const [step] = recentSteps();
    expect(step.name).toBe('read');
    expect(step.detail).toBe('arca');
    expect(step.ms).toBeGreaterThanOrEqual(0);
  });

  it('records a step that FAILED, and lets the failure through', async () => {
    // A five-second failure and a five-second success look identical from outside and mean
    // completely different things. Dropping the failed reading loses the interesting half.
    await expect(timed('read', async () => { throw new Error('rate limited'); })).rejects.toThrow('rate limited');
    expect(recentSteps()).toHaveLength(1);
    expect(recentSteps()[0].name).toBe('read');
  });

  it('hands back the newest reading first', async () => {
    await timed('first', async () => null);
    await timed('second', async () => null);
    expect(recentSteps().map((s) => s.name)).toEqual(['second', 'first']);
  });

  it('never grows past the ring, however long the server runs', () => {
    for (let i = 0; i < RING_SIZE + 50; i++) record({ name: `s${i}`, ms: i, at: i });
    const steps = recentSteps();
    expect(steps).toHaveLength(RING_SIZE);
    // And it is the OLDEST that went, not the newest.
    expect(steps[0].name).toBe(`s${RING_SIZE + 49}`);
  });
});

describe('summarising the readings', () => {
  beforeEach(clearSteps);

  it('reports the median and keeps the slowest beside it', () => {
    // The mean of these five is 6,240ms, which describes none of them. The median is 200.
    for (const ms of [180, 190, 200, 210, 30_620]) record({ name: 'read', ms, at: ms });
    const [row] = summarise(recentSteps());
    expect(row.medianMs).toBe(200);
    expect(row.slowestMs).toBe(30_620);
    expect(row.count).toBe(5);
  });

  it('puts the slowest step first — the one you came to find', () => {
    record({ name: 'cheap', ms: 10, at: 1 });
    record({ name: 'expensive', ms: 5_000, at: 2 });
    record({ name: 'middling', ms: 300, at: 3 });
    expect(summarise(recentSteps()).map((r) => r.name)).toEqual(['expensive', 'middling', 'cheap']);
  });

  it('reports the most recent reading of each step, not the first', () => {
    record({ name: 'read', ms: 100, at: 1_000 });
    record({ name: 'read', ms: 100, at: 9_000 });
    expect(summarise(recentSteps())[0].newestAt).toBe(9_000);
  });

  it('is empty for no readings rather than inventing a row', () => {
    expect(summarise([])).toEqual([]);
  });
});
