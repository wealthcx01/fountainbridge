import { describe, it, expect } from 'vitest';
import { classifyActivity, dedupeActivity, isFounderVisible } from '../activity-kind';

/**
 * Path shapes taken from `wealthcx01/arca`'s real history — the walkthrough's own feed.
 */
describe('telling a request from the thing it asked for', () => {
  it('reads a ticket-only change as a filing, never as shipped work', () => {
    // THE bug. "MERGED — Replace Bloomberg/Pokemon tagline" three days ago, and the sign-in page
    // still says the old thing, because what merged was the REQUEST.
    expect(classifyActivity({
      title: 'Replace Bloomberg/Pokemon tagline on sign-in page',
      paths: ['docs/tickets/ARCA-58-replace-tagline.md'],
    })).toBe('ticket-filed');
  });

  it('reads a change to the product as shipped', () => {
    expect(classifyActivity({
      title: 'Replace Bloomberg/Pokemon tagline on sign-in page',
      paths: ['client/src/pages/SignIn.tsx', 'docs/tickets/ARCA-58-replace-tagline.md'],
    })).toBe('work-shipped');
  });

  it('reads the founder’s own deposits as the venture learning something', () => {
    expect(classifyActivity({ title: 'Add the pricing decision', paths: ['context/decisions/pricing.md'] }))
      .toBe('knowledge-added');
  });

  it('does not let a title decide what happened', () => {
    // The same sentence, twice, meaning two different things. Only the paths tell them apart.
    const title = 'Card animation polish';
    expect(classifyActivity({ title, paths: ['docs/tickets/ARCA-4-odd-status.md'] })).toBe('ticket-filed');
    expect(classifyActivity({ title, paths: ['client/src/Card.tsx'] })).toBe('work-shipped');
  });

  it('claims nothing when it knows nothing', () => {
    // An event the studio cannot classify is shown as the plain fact it is. Guessing "shipped" here
    // is precisely the lie this module exists to stop.
    expect(classifyActivity({ title: 'Something happened' })).toBe('unknown');
    expect(classifyActivity({ title: 'Something happened', paths: [] })).toBe('unknown');
  });
});

describe('keeping the machinery off a founder’s page', () => {
  it.each([
    'cleanup: FB-043 test artifact',
    'test: sensitive Todo ticket',
    'seed: arca-ops — the queue, the context and the library',
    'chore: bump deps',
    'Merge branch main into foundry/x',
  ])('treats %j as housekeeping whatever it touched', (title) => {
    expect(classifyActivity({ title, paths: ['client/src/App.tsx'] })).toBe('plumbing');
  });

  it('treats a change to the studio’s own plumbing as housekeeping', () => {
    expect(classifyActivity({ title: 'Speed up the workflow', paths: ['.github/workflows/ci.yml'] })).toBe('plumbing');
    expect(classifyActivity({ title: 'Fix the installer', paths: ['deploy/lane/install.sh', 'scripts/x.mjs'] })).toBe('plumbing');
  });

  it('hides housekeeping from a founder and nothing else', () => {
    expect(isFounderVisible('plumbing')).toBe(false);
    for (const m of ['ticket-filed', 'work-shipped', 'knowledge-added', 'unknown'] as const) {
      expect(isFounderVisible(m)).toBe(true);
    }
  });

  it('does not call real work housekeeping just because a README came with it', () => {
    expect(classifyActivity({ title: 'Add the screener', paths: ['README.md', 'client/src/Screener.tsx'] }))
      .toBe('work-shipped');
  });
});

describe('one human event, one row', () => {
  const ev = (kind: string, title: string, at: string) => ({ kind, title, at, repo: 'arca' });

  it('collapses the merge and the commit it produced', () => {
    // Every MERGED row was shadowed by a COMMIT row saying the same words, because the two are
    // reported by endpoints that do not name each other.
    const out = dedupeActivity([
      ev('pr-merged', 'Replace the tagline', '2026-08-01T10:00:00Z'),
      ev('commit', 'Replace the tagline (#58)', '2026-08-01T10:00:30Z'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('pr-merged');
  });

  it('keeps the merge even when the commit was seen first', () => {
    const out = dedupeActivity([
      ev('commit', 'Merge pull request #58 from foundry/tagline Replace the tagline', '2026-08-01T10:00:30Z'),
      ev('pr-merged', 'Replace the tagline', '2026-08-01T10:00:00Z'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('pr-merged');
  });

  it('does not collapse two real events that happen to share a title', () => {
    // A month apart is two things happening, not one thing reported twice.
    const out = dedupeActivity([
      ev('pr-merged', 'Weekly price refresh', '2026-08-01T10:00:00Z'),
      ev('pr-merged', 'Weekly price refresh', '2026-07-01T10:00:00Z'),
    ]);
    expect(out).toHaveLength(2);
  });

  it('leaves unrelated events alone', () => {
    const out = dedupeActivity([
      ev('pr-merged', 'A', '2026-08-01T10:00:00Z'),
      ev('commit', 'B', '2026-08-01T10:00:10Z'),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('finding the ticket a filing filed', () => {
  it('reads the id off the ticket path', async () => {
    const { filedTicketId } = await import('../activity-kind');
    expect(filedTicketId({ title: 'x', paths: ['docs/tickets/ARCA-58-replace-tagline.md'] })).toBe('ARCA-58');
    expect(filedTicketId({ title: 'x', paths: ['client/src/a.tsx', 'docs/tickets/arca-4-odd.md'] })).toBe('ARCA-4');
  });

  it('says nothing rather than guessing', async () => {
    // A wrong id here puts "parked" on the wrong row, which is worse than putting it on none.
    const { filedTicketId } = await import('../activity-kind');
    expect(filedTicketId({ title: 'x', paths: ['docs/tickets/README.md'] })).toBeNull();
    expect(filedTicketId({ title: 'x' })).toBeNull();
  });
});
