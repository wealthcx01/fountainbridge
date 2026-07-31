import { describe, it, expect } from 'vitest';
import { classify, combineChecks, isReadable, readableAdditions, describeChange, acceptability, summariseChanges, previewUrlFrom, type ChangedFile } from '../work';

describe('what a founder can actually judge', () => {
  it('treats a ticket as the description of the work', () => {
    expect(classify('docs/tickets/seed-script-silent-failure.md')).toBe('description');
  });

  it('treats what the founder deposited as their venture\'s knowledge', () => {
    expect(classify('context/sell/positioning.md')).toBe('knowledge');
    expect(classify('library/campaigns/invite.md')).toBe('knowledge');
  });

  it('treats code as code, whatever language it is', () => {
    for (const p of ['client/src/App.tsx', 'server.ts', 'db/push.py', 'scripts/run.sh', 'styles/main.css']) {
      expect(classify(p), p).toBe('code');
    }
  });

  it('treats an unknown file as code — described, never displayed', () => {
    // Failing open here would show a founder something unreadable and call it a review.
    expect(classify('some/binary.bin')).toBe('code');
    expect(isReadable(classify('some/binary.bin'))).toBe(false);
  });

  it('knows which kinds a founder can read directly', () => {
    expect(isReadable('writing')).toBe(true);
    expect(isReadable('description')).toBe(true);
    expect(isReadable('knowledge')).toBe(true);
    expect(isReadable('code')).toBe(false);
    expect(isReadable('settings')).toBe(false);
  });
});

describe('showing readable changes', () => {
  it('pulls out the added lines without the diff syntax', () => {
    const patch = '@@ -1,2 +1,4 @@\n context\n+Who this is for: competitive graded-card investors.\n+\n-old line\n';
    expect(readableAdditions(patch)).toBe('Who this is for: competitive graded-card investors.');
  });

  it('never mistakes the +++ header for content', () => {
    expect(readableAdditions('+++ b/file.md\n+real content\n')).toBe('real content');
  });

  it('returns nothing when there is nothing to read, so the caller can say so', () => {
    // An empty box would read as "no change"; the honest description belongs there instead.
    expect(readableAdditions('@@ -1 +1 @@\n-removed only\n')).toBeNull();
    expect(readableAdditions(undefined)).toBeNull();
  });

  it('caps a long change and marks that it was capped', () => {
    const patch = Array.from({ length: 90 }, (_, i) => `+line ${i}`).join('\n');
    const out = readableAdditions(patch, 10);
    expect(out?.split('\n')).toHaveLength(11);
    expect(out?.endsWith('…')).toBe(true);
  });
});

describe('describing what cannot be shown', () => {
  const file = (over: Partial<ChangedFile>): ChangedFile =>
    ({ path: 'client/src/App.tsx', kind: 'code', added: 10, removed: 2, preview: null, ...over });

  it('says what it touches and how big it is', () => {
    const d = describeChange(file({ added: 12, removed: 3 }));
    expect(d).toContain('App.tsx');
    expect(d).toContain('12 lines added');
  });

  it('scales the description so size is judgeable without reading it', () => {
    expect(describeChange(file({ added: 5, removed: 0 }))).toContain('small');
    expect(describeChange(file({ added: 100, removed: 50 }))).toContain('moderate');
    expect(describeChange(file({ added: 400, removed: 0 }))).toContain('large');
  });

  it('names a settings file as settings rather than as app code', () => {
    expect(describeChange(file({ path: 'package.json', kind: 'settings' }))).toContain('settings file');
  });
});

describe('reading the automatic checks out of both places GitHub keeps them', () => {
  const run = (conclusion: string | null, status = 'completed') => ({ status, conclusion });

  it('does not call "no statuses at all" a run in progress', () => {
    // The bug the live test found. GitHub answers the combined-status endpoint with
    // `state: "pending", total_count: 0` for a commit that has no statuses — so every ARCA PR sat
    // behind "the checks are still running" forever and no work could ever be accepted.
    expect(combineChecks({ combined: { state: 'pending', total: 0 }, checkRuns: [] })).toBe('unknown');
  });

  it('sees GitHub Actions, which never appear in the combined status', () => {
    // The other direction: this studio's PRs have one commit status (the Railway deploy) and
    // eighteen check runs (the real CI). Reading the status alone called a change green off its
    // deploy while its CI was invisible.
    expect(combineChecks({
      combined: { state: 'success', total: 1 },
      checkRuns: [run('success'), run('failure')],
    })).toBe('failure');
  });

  it('reports failure ahead of anything still running', () => {
    expect(combineChecks({ checkRuns: [run(null, 'in_progress'), run('failure')] })).toBe('failure');
  });

  it('waits when any check is still going', () => {
    expect(combineChecks({ checkRuns: [run('success'), run(null, 'queued')] })).toBe('pending');
  });

  it('counts every kind of not-passing conclusion as a failure', () => {
    for (const c of ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure']) {
      expect(combineChecks({ checkRuns: [run(c)] }), c).toBe('failure');
    }
  });

  it('never lets a skipped check stand in for a passing one', () => {
    // A skipped job checked nothing. Treating it as a pass would make an unchecked change look
    // checked — the exact thing the accept button must not be able to say.
    expect(combineChecks({ checkRuns: [run('skipped'), run('neutral'), run('stale')] })).toBe('unknown');
    expect(combineChecks({ checkRuns: [run('skipped'), run('success')] })).toBe('success');
  });

  it('passes only when something actually passed and nothing else objected', () => {
    expect(combineChecks({ combined: { state: 'success', total: 1 }, checkRuns: [run('success')] })).toBe('success');
  });

  it('ignores the combined state when there are no statuses behind it', () => {
    expect(combineChecks({ combined: { state: 'pending', total: 0 }, checkRuns: [run('success')] })).toBe('success');
  });
});

describe('whether it can be accepted', () => {
  const work = (over = {}) => ({
    checks: 'success' as const, mergeable: true, merged: false, state: 'open' as const,
    headSha: 'abc123', ...over,
  });
  const ok = { configured: true };

  it('accepts work that passed its checks and has no clash', () => {
    expect(acceptability(work(), ok).ok).toBe(true);
  });

  it('refuses while the checks are still running, and says to wait', () => {
    const r = acceptability(work({ checks: 'pending' }), ok);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('checks-running'); expect(r.nextStep).toContain('few minutes'); }
  });

  it('refuses when the checks failed, and does not ask the founder to fix it', () => {
    const r = acceptability(work({ checks: 'failure' }), ok);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('checks-failed'); expect(r.nextStep).toContain('the team that made it'); }
  });

  it('refuses when GitHub has not decided whether it clashes', () => {
    // `null` means "still computing". Treating that as yes would accept an unmergeable change.
    const r = acceptability(work({ mergeable: null }), ok);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('conflicts');
  });

  it('refuses when the work changed after the page was rendered', () => {
    const r = acceptability(work(), { ...ok, seenHeadSha: 'what-the-founder-read' });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('moved'); expect(r.text).toContain('changed after the page loaded'); }
  });

  it('accepts when the rendered commit is still the current one', () => {
    expect(acceptability(work(), { ...ok, seenHeadSha: 'abc123' }).ok).toBe(true);
  });

  it('accepts work in a repo that has no automatic checks', () => {
    // ARCA has no CI. "No checks" is a settled fact with nothing to wait for, so it must not block
    // the founder forever — the lane's own /review and /qa gates are what stood behind this work.
    expect(acceptability(work({ checks: 'unknown' }), ok).ok).toBe(true);
  });

  it('refuses when the studio could not read the checks at all', () => {
    // Distinct from "no checks": here the gate could not see its own evidence, so it must block
    // rather than guess, and must not blame the founder's work for it.
    const r = acceptability(work({ checks: 'unavailable' }), ok);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('checks-unreadable');
      expect(r.nextStep).toContain('something is wrong with the studio');
    }
  });

  it('says so plainly when the studio is not set up to accept', () => {
    const r = acceptability(work(), { configured: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-configured');
  });

  it('does not offer to accept something already accepted or closed', () => {
    expect(acceptability(work({ merged: true }), ok).ok).toBe(false);
    expect(acceptability(work({ state: 'closed' }), ok).ok).toBe(false);
  });

  it('reports being unconfigured before anything else, so the real blocker is named first', () => {
    const r = acceptability(work({ checks: 'failure' }), { configured: false });
    if (!r.ok) expect(r.reason).toBe('not-configured');
  });
});

describe('summarising a change without listing files', () => {
  const f = (kind: ChangedFile['kind'], path = 'x'): ChangedFile =>
    ({ path, kind, added: 1, removed: 0, preview: null });

  it('counts by what things mean, not by extension', () => {
    const s = summariseChanges([f('writing'), f('writing'), f('code')]);
    expect(s).toContain('3 files');
    expect(s).toContain('2 pieces of writing');
    expect(s).toContain('a change to the app');
  });

  it('reads as a sentence for a single file', () => {
    expect(summariseChanges([f('description')])).toBe('1 file: the description of the work.');
  });

  it('includes files beyond the render cap, so a capped list never reads as the whole change', () => {
    expect(summariseChanges([f('code')], 12)).toContain('13 files');
  });

  it('says plainly when there is nothing', () => {
    expect(summariseChanges([])).toBe('No changes recorded.');
  });
});

describe('finding where the work can be seen running', () => {
  it('reads Railway\'s hostname out of the status description', () => {
    // Railway puts its own dashboard in target_url and the app host in the description.
    expect(previewUrlFrom([{
      state: 'success',
      description: 'Success - foundry-studio-fountainbridge-pr-67.up.railway.app',
      target_url: 'https://railway.com/project/abc?environmentId=def',
    }])).toBe('https://foundry-studio-fountainbridge-pr-67.up.railway.app');
  });

  it('reads Vercel-style deployments out of target_url', () => {
    expect(previewUrlFrom([{ state: 'success', description: 'Deployment ready', target_url: 'https://arca-git-pr-9.vercel.app' }]))
      .toBe('https://arca-git-pr-9.vercel.app');
  });

  it('never returns a link to a deployment console', () => {
    // "See it running" that opens Railway's dashboard is a broken promise on the one control meant
    // to let a founder judge what they cannot read.
    expect(previewUrlFrom([{ state: 'success', description: 'Deploying', target_url: 'https://railway.com/project/abc' }])).toBeNull();
    expect(previewUrlFrom([{ state: 'success', description: 'built', target_url: 'https://github.com/x/y/actions/runs/1' }])).toBeNull();
  });

  it('ignores a deployment that has not succeeded', () => {
    expect(previewUrlFrom([{ state: 'pending', description: 'Railway is deploying the service - x.up.railway.app' }])).toBeNull();
  });

  it('takes the first successful one when a commit has several', () => {
    expect(previewUrlFrom([
      { state: 'failure', description: 'x - old.up.railway.app' },
      { state: 'success', description: 'Success - new.up.railway.app' },
    ])).toBe('https://new.up.railway.app');
  });

  it('returns nothing when there is no deployment at all — the normal case for a venture repo', () => {
    expect(previewUrlFrom([])).toBeNull();
    expect(previewUrlFrom([{ state: 'success', description: 'All checks have passed' }])).toBeNull();
  });
});

describe('resolving the repo before it reaches GitHub', () => {
  it('qualifies a short manifest name with the owner', async () => {
    // A venture declares `arca` because that is what a founder recognises; the API needs
    // `wealthcx01/arca`. Missing this made every LIVE lookup 404 while fixtures passed — a fixture
    // keys on whatever string it is handed, so tests and the UI gate both stayed green.
    const seen: string[] = [];
    const client = {
      async getPullRequest(repo: string) { seen.push(repo); return null; },
      async listPullFiles() { return []; },
      async request() { return {}; },
    } as never;
    const { githubWorkSource } = await import('../work-load');
    await githubWorkSource(client, 'wealthcx01').get('arca', 23);
    expect(seen).toEqual(['wealthcx01/arca']);
  });

  it('leaves an already-qualified name alone', async () => {
    const seen: string[] = [];
    const client = {
      async getPullRequest(repo: string) { seen.push(repo); return null; },
      async listPullFiles() { return []; },
      async request() { return {}; },
    } as never;
    const { githubWorkSource } = await import('../work-load');
    await githubWorkSource(client, 'wealthcx01').get('someone/else', 1);
    expect(seen).toEqual(['someone/else']);
  });
});
