import { describe, it, expect } from 'vitest';
import { classify, isReadable, readableAdditions, describeChange, acceptability, summariseChanges, type ChangedFile } from '../work';

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
