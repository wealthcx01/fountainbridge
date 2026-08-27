import { describe, it, expect } from 'vitest';
import {
  findDrift, idFromFilename, isShippingCommit, partShippedReason, statusFromMarkdown, ticketsShippedBy,
} from '../ticket-drift';

const evidence = (ids: string[], commit = 'abc1234 FB-065: something (#68)') => ({
  shipped: new Set(ids),
  commitFor: new Map(ids.map((id) => [id, commit])),
});

describe('what counts as evidence that a ticket shipped', () => {
  it('counts a code commit whose subject names the ticket', () => {
    expect(ticketsShippedBy({
      subject: 'FB-065: bring the composer inside the studio (#68)',
      paths: ['lib/composer.ts', 'docs/tickets/FB-065-x.md'],
    })).toEqual(['FB-065']);
  });

  it('ignores a commit that only filed paperwork', () => {
    // A ticket-filing commit naming five tickets is evidence about none of them.
    expect(ticketsShippedBy({
      subject: 'docs: FB-060 — what the lane tells you, and in what shape (#61)',
      paths: ['docs/tickets/FB-060-x.md'],
    })).toEqual([]);
  });

  it('does not treat a ticket FILED by a code commit as one that shipped', () => {
    // The rule that looked stronger and was worse. One pull request shipped FB-064 and *filed* five
    // more tickets; keying on "this ticket's file changed in a code commit" reported all five as
    // already shipped. Filing a ticket is not shipping it.
    expect(ticketsShippedBy({
      subject: 'docs: the founder’s journey, and the five tickets that deliver it (#67)',
      paths: ['lib/work.ts', 'docs/tickets/FB-067-x.md', 'docs/tickets/FB-068-x.md'],
    })).toEqual([]);
  });

  it('ignores a passing reference in the body, because only the subject is deliberate', () => {
    // "FB-050: the venture brain" mentioned FB-034 in passing, and the first version reported FB-034
    // shipped on that basis. A check that cites the wrong reason is one a developer learns to skim.
    expect(ticketsShippedBy({
      subject: 'FB-050: the venture brain (#50)',
      paths: ['deploy/lane/brain-query.mjs'],
    })).toEqual(['FB-050']);
  });

  it('knows a commit that changed code from one that did not', () => {
    expect(isShippingCommit(['docs/tickets/FB-001-x.md'])).toBe(false);
    expect(isShippingCommit(['docs/tickets/FB-001-x.md', 'lib/x.ts'])).toBe(true);
    expect(isShippingCommit([])).toBe(false);
    expect(isShippingCommit(['   '])).toBe(false);
  });
});

describe('reporting the disagreement', () => {
  const ticket = (over = {}) => ({ id: 'FB-064', status: 'In review', file: 'docs/tickets/FB-064-x.md', ...over });

  it('flags a ticket whose work has shipped', () => {
    const d = findDrift([ticket()], evidence(['FB-064']));
    expect(d).toHaveLength(1);
    expect(d[0].message).toContain('has shipped');
    expect(d[0].message).toContain('abc1234');
  });

  it('says nothing about a ticket that already admits it is done', () => {
    for (const status of ['Done', 'done', 'Shipped', 'Merged']) {
      expect(findDrift([ticket({ status })], evidence(['FB-064']))).toHaveLength(0);
    }
  });

  it('accepts a concluded status that carries a qualifier', () => {
    // FB-074 was withdrawn with the status "Closed — not a defect", which is more honest than
    // flattening it to one word. Demanding an exact match would make the check punish precision.
    for (const status of ['Closed — not a defect', 'Withdrawn — superseded by FB-072', 'Done (partly reverted)']) {
      expect(findDrift([ticket({ status })], evidence(['FB-064'])), status).toHaveLength(0);
    }
  });

  it('still flags a status that merely starts with a word like "in"', () => {
    for (const status of ['In review', 'In progress (design)', 'Not done yet']) {
      expect(findDrift([ticket({ status })], evidence(['FB-064'])), status).toHaveLength(1);
    }
  });

  it('says nothing about a ticket with no shipping evidence', () => {
    expect(findDrift([ticket()], evidence([]))).toHaveLength(0);
  });

  it('never flags a ticket marked done with no commit behind it', () => {
    // Deliberately one-directional. Plenty of legitimate work leaves no commit naming it — a
    // decision, a withdrawn ticket, work folded into another — and flagging those is the noise that
    // teaches people to ignore the check.
    expect(findDrift([ticket({ status: 'Done' })], evidence([]))).toHaveLength(0);
  });

  it('reads worse for a ticket nobody has even started', () => {
    expect(findDrift([ticket({ status: 'Todo' })], evidence(['FB-064']))[0].message)
      .toContain('has already shipped');
  });

  it('accepts a ticket that says in writing what has not shipped', () => {
    // Without an escape hatch a part-finished ticket could only pass by being marked Done — which is
    // the same lie, reached by a different route.
    const d = findDrift([ticket({ partShipped: 'the executor is built but not deployed' })], evidence(['FB-064']));
    expect(d).toHaveLength(0);
  });

  it('tells you about the escape hatch instead of only demanding Done', () => {
    expect(findDrift([ticket()], evidence(['FB-064']))[0].message).toContain('Shipped in part');
  });

  it('reports in ticket order, so the same repository always reads the same way', () => {
    const d = findDrift(
      [ticket({ id: 'FB-100' }), ticket({ id: 'FB-9' }), ticket({ id: 'FB-64' })],
      evidence(['FB-100', 'FB-9', 'FB-64']),
    );
    expect(d.map((x) => x.id)).toEqual(['FB-9', 'FB-64', 'FB-100']);
  });
});

describe('reading a ticket file', () => {
  it('takes the status without swallowing the rest of the header', () => {
    expect(statusFromMarkdown('# T\n\n**Status:** Done · **Phase:** 3 · **Repo:** x\n')).toBe('Done');
  });

  it('keeps a status that has words in it', () => {
    expect(statusFromMarkdown('**Status:** In progress (design) · **Phase:** 2')).toBe('In progress (design)');
  });

  it('returns nothing for a file with no status line', () => {
    expect(statusFromMarkdown('# A ticket with no header\n')).toBeNull();
  });

  it('reads the part-shipped explanation, and requires one', () => {
    expect(partShippedReason('**Shipped in part:** the executor is not deployed yet.'))
      .toBe('the executor is not deployed yet.');
    // An empty marker is not an explanation, so it does not exempt anything.
    expect(partShippedReason('**Shipped in part:**')).toBeNull();
  });

  it('gets the id from the filename', () => {
    expect(idFromFilename('FB-064-read-and-accept-work.md')).toBe('FB-064');
    expect(idFromFilename('GRS-0147b-something.md')).toBe('GRS-0147b');
    expect(idFromFilename('README.md')).toBeNull();
  });
});

/**
 * A ticket-id range is not evidence (FB-145).
 *
 * `main` went red the moment the desk-redesign planning PR merged: its subject said
 * "…and FB-124…FB-142", the matcher read both endpoints, and ticket-drift demanded FB-142 be set to
 * Done for work that had not started.
 *
 * The rule's own comment already stated the intent — "a ticket-filing commit naming five tickets is
 * evidence about none of them" — so this is the implementation catching up with it.
 */
describe('a range names a set the string does not enumerate (FB-145)', () => {
  const paths = ['lib/anything.ts'];   // a shipping commit by the existing rule

  it('yields nothing for the exact subject that broke main', () => {
    expect(
      ticketsShippedBy({
        subject: 'The desk redesign: design bundle, two decision memos, and FB-124…FB-142 (#150)',
        paths,
      }),
    ).toEqual([]);
  });

  it('handles every way someone writes a range', () => {
    for (const subject of [
      'Planning FB-124...FB-142',
      'Planning FB-124..FB-142',
      'Planning FB-124 – FB-142',
      'Planning FB-124 — FB-142',
      'Planning FB-124 to FB-142',
    ]) {
      expect(ticketsShippedBy({ subject, paths }), subject).toEqual([]);
    }
  });

  it('still counts a single id, which is the case this check exists for', () => {
    expect(
      ticketsShippedBy({ subject: 'FB-123: stop opening every run report ever written (#148)', paths }),
    ).toEqual(['FB-123']);
  });

  it('still counts two ids named individually', () => {
    // The fix must not quietly disable the check by swallowing anything with two ids in it.
    expect(ticketsShippedBy({ subject: 'FB-121 and FB-122: two real ships', paths })).toEqual([
      'FB-121',
      'FB-122',
    ]);
  });

  it('still ignores a commit that shipped no code, whatever its subject says', () => {
    expect(ticketsShippedBy({ subject: 'FB-123: ticket only', paths: ['docs/tickets/FB-123-x.md'] })).toEqual([]);
  });
});
