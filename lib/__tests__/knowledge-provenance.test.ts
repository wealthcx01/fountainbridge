import { describe, it, expect } from 'vitest';
import { githubProvenanceSource, fixtureProvenanceSource, MAX_PROVENANCE_PATHS } from '../knowledge-load';
import type { GitHubClient } from '../github';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The provenance query (FB-133).
 *
 * The Memory screen's two provenance columns are only as honest as this, so the tests are about the
 * two ways it could lie: a path interpolated into the query text (FB-127's lesson, one layer down),
 * and a cost that grows with the corpus (FB-083's rule).
 */

/** A client that records what it was asked and replies with whatever the test staged. */
function stubClient(reply: unknown) {
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = [];
  const client = {
    graphql: async (query: string, variables: Record<string, unknown>) => {
      calls.push({ query, variables });
      return reply;
    },
  } as unknown as GitHubClient;
  return { client, calls };
}

const history = (over: Record<string, unknown> = {}) => ({
  history: {
    totalCount: 1,
    nodes: [{
      committedDate: '2026-06-20T09:00:00Z',
      messageHeadline: 'knowledge: price-list.pdf',
      author: { name: 'foundry-studio' },
      ...over,
    }],
  },
});

describe('reading where each document came from', () => {
  it('asks once for the whole corpus, not once per document', async () => {
    const { client, calls } = stubClient({ repository: { h0: history(), h1: history() } });
    const source = githubProvenanceSource(client, 'wealthcx01');

    await source('arca', ['context/sell/a.md', 'library/build/b.md']);

    expect(calls).toHaveLength(1);
  });

  it('passes every path as a declared variable, never inside the query text', async () => {
    // A document path is founder-supplied. FB-127 was a path taken from the wire into a repo path;
    // interpolating one into a query string is the same class of defect a layer down.
    const nasty = 'context/general/") { x } #.md';
    const { client, calls } = stubClient({ repository: { h0: history() } });

    await githubProvenanceSource(client, 'wealthcx01')('arca', [nasty]);

    expect(calls[0].query).not.toContain(nasty);
    expect(calls[0].query).toContain('$p0: String!');
    expect(calls[0].variables.p0).toBe(nasty);
  });

  it('reads the arrival off the record that wrote it', async () => {
    const { client } = stubClient({ repository: { h0: history() } });
    const got = await githubProvenanceSource(client, 'wealthcx01')('arca', ['context/sell/a.md']);

    expect(got.get('context/sell/a.md')).toEqual({
      committedDate: '2026-06-20T09:00:00Z',
      messageHeadline: 'knowledge: price-list.pdf',
      authorName: 'foundry-studio',
      totalCount: 1,
    });
  });

  it('omits a document git said nothing about rather than inventing a date', async () => {
    const { client } = stubClient({ repository: { h0: { history: { totalCount: 0, nodes: [] } } } });
    const got = await githubProvenanceSource(client, 'wealthcx01')('arca', ['context/sell/a.md']);

    expect(got.has('context/sell/a.md')).toBe(false);
  });

  it('caps the ask so the cost does not grow with the corpus', async () => {
    const paths = Array.from({ length: MAX_PROVENANCE_PATHS + 15 }, (_, i) => `context/sell/d${i}.md`);
    const { client, calls } = stubClient({ repository: {} });

    await githubProvenanceSource(client, 'wealthcx01')('arca', paths);

    const asked = Object.keys(calls[0].variables).filter((k) => /^p\d+$/.test(k));
    expect(asked).toHaveLength(MAX_PROVENANCE_PATHS);
  });

  it('asks nothing at all for an empty corpus', async () => {
    const { client, calls } = stubClient({ repository: {} });
    const got = await githubProvenanceSource(client, 'wealthcx01')('arca', []);

    expect(calls).toHaveLength(0);
    expect(got.size).toBe(0);
  });

  it('returns nothing known when the venture cannot be seen', async () => {
    const { client } = stubClient({ repository: null });
    const got = await githubProvenanceSource(client, 'wealthcx01')('arca', ['context/sell/a.md']);

    expect(got.size).toBe(0);
  });
});

describe('the offline provenance source', () => {
  it('reads what is recorded and skips what is not', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prov-'));
    mkdirSync(join(dir, 'arca'), { recursive: true });
    writeFileSync(join(dir, 'arca', 'provenance.json'), JSON.stringify({
      'context/sell/a.md': { committedDate: '2026-06-20T09:00:00Z', messageHeadline: 'context: A', totalCount: 3 },
      'context/sell/b.md': { messageHeadline: 'no date here' },
    }));

    const got = await fixtureProvenanceSource(dir)('arca', ['context/sell/a.md', 'context/sell/b.md']);

    expect(got.get('context/sell/a.md')?.totalCount).toBe(3);
    expect(got.has('context/sell/b.md')).toBe(false);
  });

  it('is empty, not broken, when nothing was recorded', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prov-'));
    const got = await fixtureProvenanceSource(dir)('arca', ['context/sell/a.md']);
    expect(got.size).toBe(0);
  });
});
