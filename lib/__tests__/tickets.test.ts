import { describe, it, expect, vi } from 'vitest';
import {
  groupRepoTickets,
  loadVentureTickets,
  clearTicketCache,
  type RepoTicketFetcher,
} from '../tickets';
import type { VentureSummary } from '../ventures';

const ticketMd = (id: string, status?: string) =>
  `# ${id} — Test ${id}\n${status ? `**Status:** ${status}\n` : ''}`;

const venture: VentureSummary = {
  id: 'arca',
  name: 'ARCA',
  status: 'active',
  founderName: null,
  founderEmail: null,
  repos: ['arca'],
};

describe('groupRepoTickets', () => {
  it('groups tickets by status and counts them', () => {
    const lane = groupRepoTickets('arca', {
      files: [
        { path: 'docs/tickets/AR-1.md', content: ticketMd('AR-1', 'In progress') },
        { path: 'docs/tickets/AR-2.md', content: ticketMd('AR-2', 'Done') },
        { path: 'docs/tickets/AR-3.md', content: ticketMd('AR-3') },
      ],
      error: null,
    });
    expect(lane.total).toBe(3);
    expect(lane.groups['in-progress'].map((t) => t.ticket.id)).toEqual(['AR-1']);
    expect(lane.groups.done.map((t) => t.ticket.id)).toEqual(['AR-2']);
    expect(lane.groups.todo.map((t) => t.ticket.id)).toEqual(['AR-3']);
  });

  it('passes a repo error through, unhidden', () => {
    const lane = groupRepoTickets('x', { files: [], error: 'Repository not found' });
    expect(lane.error).toBe('Repository not found');
    expect(lane.total).toBe(0);
  });

  it('skips non-ticket markdown (a README) instead of rendering a bogus card', () => {
    const lane = groupRepoTickets('r', {
      files: [{ path: 'docs/tickets/readme.md', content: '# Just a readme' }],
      error: null,
    });
    expect(lane.total).toBe(0);
    expect(lane.skipped).toBe(1);
    expect(Object.values(lane.groups).flat()).toHaveLength(0);
  });

  it('surfaces a warning on a real-but-imperfect ticket (unrecognized status)', () => {
    const lane = groupRepoTickets('r', {
      files: [{ path: 'docs/tickets/RR-1.md', content: '# RR-1 — t\n**Status:** Frobnicated\n' }],
      error: null,
    });
    expect(lane.total).toBe(1);
    expect(lane.skipped).toBe(0);
    const item = Object.values(lane.groups).flat()[0];
    expect(item.warnings.some((w) => w.code === 'unrecognized-status')).toBe(true);
  });
});

describe('loadVentureTickets — caching + refresh', () => {
  it('fetches once, then serves from cache within the TTL', async () => {
    clearTicketCache();
    const fetcher: RepoTicketFetcher = vi.fn(async () => ({
      files: [{ path: 'docs/tickets/AR-1.md', content: ticketMd('AR-1') }],
      error: null,
    }));
    let t = 1000;
    const now = () => t;
    const a = await loadVentureTickets(venture, { fetcher, now });
    expect(a.lanes[0].total).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    t = 1000 + 60_000; // still within 2-min TTL
    const b = await loadVentureTickets(venture, { fetcher, now });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('refresh bypasses the cache and TTL expiry refetches', async () => {
    clearTicketCache();
    const fetcher: RepoTicketFetcher = vi.fn(async () => ({ files: [], error: null }));
    let t = 0;
    const now = () => t;
    await loadVentureTickets(venture, { fetcher, now });
    await loadVentureTickets(venture, { fetcher, now, refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(2);

    t = 3 * 60_000; // past the TTL
    await loadVentureTickets(venture, { fetcher, now });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
