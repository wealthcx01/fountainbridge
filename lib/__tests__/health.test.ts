import { describe, it, expect, vi } from 'vitest';
import {
  buildRepoHealth,
  loadVentureHealth,
  clearHealthCache,
  DEFAULT_STALE_DAYS,
  type RepoHealthRaw,
  type RepoHealthFetcher,
} from '../health';
import type { VentureSummary } from '../ventures';

const NOW = Date.parse('2026-07-21T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function raw(over: Partial<RepoHealthRaw> = {}): RepoHealthRaw {
  return { defaultBranch: 'main', protected: true, latestRun: null, activity: [], error: null, ...over };
}

describe('buildRepoHealth — staleness', () => {
  it('recent activity → not stale', () => {
    const h = buildRepoHealth(
      'arca',
      raw({ activity: [{ kind: 'commit', repo: 'arca', title: 'x', url: 'u', at: daysAgo(1) }] }),
      NOW,
    );
    expect(h.stale).toBe(false);
    expect(h.lastActivityMs).toBe(Date.parse(daysAgo(1)));
  });

  it('old activity beyond the threshold → stale', () => {
    const h = buildRepoHealth(
      'arca',
      raw({ activity: [{ kind: 'commit', repo: 'arca', title: 'x', url: 'u', at: daysAgo(DEFAULT_STALE_DAYS + 3) }] }),
      NOW,
    );
    expect(h.stale).toBe(true);
  });

  it('no activity at all → stale (silent lane death)', () => {
    expect(buildRepoHealth('arca', raw(), NOW).stale).toBe(true);
  });

  it('an unreadable repo is NOT flagged stale (error is surfaced instead)', () => {
    const h = buildRepoHealth('ghost', raw({ error: 'Repository not found.' }), NOW);
    expect(h.stale).toBe(false);
    expect(h.error).toBe('Repository not found.');
  });

  it('lastActivity uses the most recent of latest-run and activity events', () => {
    const h = buildRepoHealth(
      'arca',
      raw({
        latestRun: { conclusion: 'success', url: 'u', createdAt: daysAgo(2) },
        activity: [{ kind: 'commit', repo: 'arca', title: 'x', url: 'u', at: daysAgo(5) }],
      }),
      NOW,
    );
    expect(h.lastActivityMs).toBe(Date.parse(daysAgo(2))); // the run is newer
  });

  it('tolerates a partial raw object (missing activity) without crashing', () => {
    const partial = { defaultBranch: 'main', protected: false, latestRun: null, error: null } as unknown as RepoHealthRaw;
    const h = buildRepoHealth('web', partial, NOW);
    expect(h.activity).toEqual([]);
    expect(h.stale).toBe(true); // no activity at all → stale
  });

  it('respects a custom staleDays threshold', () => {
    const r = raw({ activity: [{ kind: 'commit', repo: 'arca', title: 'x', url: 'u', at: daysAgo(3) }] });
    expect(buildRepoHealth('arca', r, NOW, 2).stale).toBe(true);
    expect(buildRepoHealth('arca', r, NOW, 10).stale).toBe(false);
  });
});

describe('loadVentureHealth', () => {
  const venture: VentureSummary = {
    id: 'arca',
    name: 'ARCA',
    status: 'active',
    founderName: null,
    founderEmail: null,
    repos: ['arca'],
  };

  it('merges activity newest-first and caches within TTL', async () => {
    clearHealthCache();
    const fetcher: RepoHealthFetcher = vi.fn(async () =>
      raw({
        activity: [
          { kind: 'commit', repo: 'arca', title: 'older', url: 'u', at: daysAgo(4) },
          { kind: 'pr-merged', repo: 'arca', title: 'newer', url: 'u', at: daysAgo(1) },
        ],
      }),
    );
    const now = () => NOW;
    const a = await loadVentureHealth(venture, { fetcher, now });
    expect(a.activity.map((e) => e.title)).toEqual(['newer', 'older']);
    await loadVentureHealth(venture, { fetcher, now });
    expect(fetcher).toHaveBeenCalledTimes(1); // cached
    await loadVentureHealth(venture, { fetcher, now, refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
