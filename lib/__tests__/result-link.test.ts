import { describe, it, expect, vi } from 'vitest';
import { followLine, sendForTicket, type FollowInput } from '../result-link';
import { checkPreview, checkedPreview, type Fetcher } from '../preview-check';

/**
 * "Follow it to…" (FB-184): one line per ticket saying where to see the result, and a link only
 * when the link opens.
 *
 * The preview shapes below are real ones. `arca-arca-pr-92.up.railway.app` is the address Railway
 * reported for ARCA's pull request 92; it was checked on 2026-10-02 after the pull request merged
 * and answered 404 (torn down). The redirect to the live site is FB-243's shape: every preview
 * inherited production's AUTH_URL and sent its visitor to production.
 */

const PREVIEW = 'https://arca-arca-pr-92.up.railway.app';

/** A fetcher that answers from a script of hops, keyed by address. */
function scripted(answers: Record<string, { status: number; location?: string }>): Fetcher {
  return async (url) => {
    const a = answers[url];
    if (!a) throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).host}`);
    return { status: a.status, headers: { get: (n: string) => (n.toLowerCase() === 'location' ? a.location ?? null : null) } };
  };
}

const build = (over: Partial<FollowInput> = {}): FollowInput => ({
  department: 'build', hasWork: true, preview: null, send: null, ...over,
});

describe('a Build ticket links to its preview only when the preview opens', () => {
  it('opens: the line links to it, and says it leaves the studio', async () => {
    const preview = await checkPreview(PREVIEW, scripted({ [`${PREVIEW}`]: { status: 200 } }));
    expect(preview.state).toBe('opens');
    const line = followLine(build({ preview }));
    expect(line.link).toEqual({ href: PREVIEW, label: 'see it', external: true });
    expect(line.text).toBe('Follow it to the preview: running');
  });

  it('a sign-in page on the preview itself is still the preview', async () => {
    // ARCA asks people to sign in. Landing on its own sign-in page is landing on the work.
    const preview = await checkPreview(PREVIEW, scripted({
      [PREVIEW]: { status: 307, location: '/login' },
      [`${PREVIEW}/login`]: { status: 200 },
    }));
    expect(preview.state).toBe('opens');
  });

  it('torn down: no link, and the reason in plain words', async () => {
    const preview = await checkPreview(PREVIEW, scripted({ [PREVIEW]: { status: 404 } }));
    expect(preview).toEqual({ url: PREVIEW, state: 'does-not-open', reason: 'it is not answering' });
    const line = followLine(build({ preview }));
    expect(line.link).toBeNull();
    expect(line.text).toContain('it is not answering');
  });

  it('redirects to the live site: no link, because it would show the wrong thing', async () => {
    const preview = await checkPreview(PREVIEW, scripted({
      [PREVIEW]: { status: 302, location: 'https://arca.bruntsfield.capital/login' },
      'https://arca.bruntsfield.capital/login': { status: 200 },
    }));
    expect(preview.state).toBe('does-not-open');
    expect(followLine(build({ preview })).link).toBeNull();
    expect(followLine(build({ preview })).text).toContain('it opens a different site');
  });

  it('cannot be reached: no link, and no exception', async () => {
    const preview = await checkPreview(PREVIEW, scripted({}));
    expect(preview).toEqual({ url: PREVIEW, state: 'does-not-open', reason: 'it could not be reached' });
  });

  it('an address that is not a web address is never fetched and never linked', async () => {
    let fetched = false;
    const preview = await checkPreview('javascript:alert(1)', async () => { fetched = true; throw new Error('no'); });
    expect(fetched).toBe(false);
    expect(followLine(build({ preview })).link).toBeNull();
  });

  it('not checked: says so, and links nowhere', () => {
    const line = followLine(build({ preview: { url: PREVIEW, state: 'not-checked' } }));
    expect(line.link).toBeNull();
    expect(line.text).toContain('not checked');
  });

  it('work with no preview built, and a ticket nobody has started', () => {
    expect(followLine(build({ preview: null })).text).toBe('Follow it to the preview: none has been built for this work yet');
    expect(followLine(build({ hasWork: false })).text).toBe('Nothing to follow yet');
    expect(followLine(build({ hasWork: false })).link).toBeNull();
  });
});

describe('the test rig never opens a preview', () => {
  it('answers not-checked without a network call', async () => {
    const rig = { E2E_TEST_LOGIN: '1', PRS_FIXTURE_DIR: 'e2e/fixtures/prs' };
    expect(await checkedPreview('https://arca-pr-10.preview.example.com', rig)).toEqual({
      url: 'https://arca-pr-10.preview.example.com', state: 'not-checked',
    });
  });
});

describe('a Sell ticket follows its send', () => {
  const approvals = [
    { id: 'send-1', repo: 'arca', ticket: 'SELL-002', department: 'sell', status: 'rejected', committedAt: '2026-09-01T10:00:00Z' },
    { id: 'send-2', repo: 'arca', ticket: 'SELL-002', department: 'sell', status: 'executed', committedAt: '2026-09-03T10:00:00Z' },
    { id: 'send-3', repo: 'arca', ticket: 'ARCA-12', department: 'build', status: 'proposed', committedAt: '2026-09-04T10:00:00Z' },
  ];
  const href = (repo: string, id: string) => `/venture/arca/approvals/${repo}/${id}`;

  it('finds the newest send for the ticket, proposed from another department’s repository', () => {
    // ARCA proposes its sends from `arca` (Build) and names `sell`. The ticket lives in the Sell repo.
    const send = sendForTicket(approvals, { id: 'SELL-002', repo: 'arca-marketing', department: 'sell' }, href);
    expect(send).toEqual({ href: '/venture/arca/approvals/arca/send-2', status: 'executed' });
    const line = followLine({ department: 'sell', hasWork: false, preview: null, send });
    expect(line.text).toBe('Follow it to your outbox: sent');
    expect(line.link).toEqual({ href: '/venture/arca/approvals/arca/send-2', label: 'open it', external: false });
  });

  it('a draft says it has not gone', () => {
    const send = sendForTicket(approvals, { id: 'ARCA-12', repo: 'arca', department: 'build' }, href);
    expect(followLine({ department: 'build', hasWork: true, preview: null, send }).text).toBe('Follow it to your outbox: draft, not sent');
  });

  it('the same ticket id in an unrelated repository and department is not this ticket', () => {
    expect(sendForTicket(approvals, { id: 'SELL-002', repo: 'other', department: 'build' }, href)).toBeNull();
  });
});

describe('the trail’s "see it running" hop reads the same check as the line', () => {
  it('has no preview hop when the preview does not open, and has one when it does', async () => {
    vi.resetModules();
    const answer: { state: 'opens' | 'does-not-open' } = { state: 'does-not-open' };
    vi.doMock('../preview-check', () => ({
      checkedPreview: async (url: string) => (answer.state === 'opens'
        ? { url, state: 'opens' }
        : { url, state: 'does-not-open', reason: 'it is not answering' }),
    }));
    const { trailSources } = await import('../trail-sources');
    const work = [{
      id: 'arca#92', kind: 'pr', ventureId: 'arca', repo: 'arca', number: 92, title: 'ARCA-12: price history',
      url: 'https://github.com/wealthcx01/arca/pull/92', author: null, createdAt: '2026-10-01T23:41:38Z', ageMs: 0,
      linkedTicketId: 'ARCA-12', ticketTitle: null, ciStatus: 'success', previewUrl: PREVIEW, headSha: null, branch: null,
    }] as never;
    const sources = trailSources({ id: 'arca' } as never, { approvals: [], runs: [], work });

    expect(await sources.preview('arca', 'ARCA-12')).toBeNull();
    answer.state = 'opens';
    expect(await sources.preview('arca', 'ARCA-12')).toEqual({ url: PREVIEW, at: '2026-10-01T23:41:38Z' });
    vi.doUnmock('../preview-check');
  });
});

describe('a Scale ticket says the ad account is not connected, and links nowhere', () => {
  it('even when it has work with a preview', () => {
    const line = followLine({ department: 'scale', hasWork: true, preview: { url: PREVIEW, state: 'opens' }, send: null });
    expect(line).toEqual({ text: 'Follow it to the ad account: not connected yet', link: null });
  });
});
