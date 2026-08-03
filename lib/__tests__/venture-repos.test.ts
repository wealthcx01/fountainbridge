import { describe, expect, it, vi } from 'vitest';
import { fullRepoName } from '../venture-repos';
import { githubRunReportSource } from '../runreports-load';
import { githubApprovalSource } from '../approvals';
import type { GitHubClient } from '../github';

// FB-094. Manifests declare repos as bare slugs; GitHub is addressed by `owner/slug`. For weeks the
// bare slug went straight to the API: /repos/arca/... 404ed, was swallowed, and the board reported
// "no sign of an agent lane" on a venture whose lane had heartbeated minutes earlier — while the
// e2e fixtures, keyed by the bare slug, kept the whole suite green. These tests pin the boundary
// rule so the two namings can never silently disagree again.

describe('fullRepoName', () => {
  it('prefixes a bare slug with the org', () => {
    expect(fullRepoName('arca', 'wealthcx01')).toBe('wealthcx01/arca');
  });

  it('passes an already-qualified name through untouched — never double-prefixes', () => {
    expect(fullRepoName('wealthcx01/arca', 'wealthcx01')).toBe('wealthcx01/arca');
    expect(fullRepoName('otherorg/repo', 'wealthcx01')).toBe('otherorg/repo');
  });

  it('defaults the org from GITHUB_ORG', () => {
    expect(fullRepoName('arca')).toBe(`${process.env.GITHUB_ORG ?? 'wealthcx01'}/arca`);
  });
});

describe('githubRunReportSource addresses GitHub by the full name', () => {
  it('lists and reads with owner/slug, given the manifest slug', async () => {
    const listDir = vi.fn().mockResolvedValue([{ name: 'a.json', type: 'file' }]);
    const getFileContent = vi.fn().mockResolvedValue('{"lane":"arca","started":"2026-01-01T00:00:00Z"}');
    const source = githubRunReportSource({ listDir, getFileContent } as unknown as GitHubClient, 'wealthcx01');

    expect(await source.list('arca')).toEqual(['a.json']);
    expect(listDir).toHaveBeenCalledWith('wealthcx01/arca', 'runreports', 'foundry-state');

    await source.read('arca', 'a.json');
    expect(getFileContent).toHaveBeenCalledWith('wealthcx01/arca', 'runreports/a.json', 'foundry-state');
  });

  it('lets a non-404 failure propagate instead of reading as "no lane"', async () => {
    // listDir turns a 404 into [] itself, so anything that reaches this catch-less path is a real
    // fault — and the page must render "could not be read", never a calm empty lane.
    const listDir = vi.fn().mockRejectedValue(new Error('403 rate limited'));
    const source = githubRunReportSource({ listDir } as unknown as GitHubClient, 'wealthcx01');
    await expect(source.list('arca')).rejects.toThrow('rate limited');
  });
});

describe('githubApprovalSource addresses GitHub by the full name', () => {
  it('lists ids and reads files with owner/slug, given the manifest slug', async () => {
    const listDir = vi.fn().mockResolvedValue([{ name: 'send-1', type: 'dir' }]);
    const getFileWithSha = vi.fn().mockResolvedValue({ text: '{}', sha: 'abc' });
    const source = githubApprovalSource({ listDir, getFileWithSha } as unknown as GitHubClient, 'wealthcx01');

    expect(await source.listIds('arca-marketing')).toEqual(['send-1']);
    expect(listDir).toHaveBeenCalledWith('wealthcx01/arca-marketing', 'approvals', 'foundry-approvals');

    await source.read('arca-marketing', 'send-1', 'proposal');
    expect(getFileWithSha).toHaveBeenCalledWith(
      'wealthcx01/arca-marketing',
      'approvals/send-1/proposal.json',
      'foundry-approvals',
    );
  });
});
