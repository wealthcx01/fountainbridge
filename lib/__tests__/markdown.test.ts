import { describe, it, expect } from 'vitest';
import { showAngleBrackets, splitTicketBody, withoutStatusClaim, withoutTitleHeading } from '../markdown';

/**
 * The audit's finding, pinned. A ticket that says `(<slug>, <path>)` reached the founder as `(, )` —
 * the studio silently deleting part of the sentence that says what was asked for, which is exactly
 * why GitHub felt like it had more detail.
 */
describe('keeping placeholders on the screen', () => {
  it('escapes a placeholder so markdown cannot mistake it for a tag', () => {
    expect(showAngleBrackets('read from the repo (<slug>, <path>)'))
      .toBe('read from the repo (&lt;slug>, &lt;path>)');
  });

  it('leaves a real autolink alone', () => {
    expect(showAngleBrackets('see <https://example.com/x> for more')).toBe('see <https://example.com/x> for more');
    expect(showAngleBrackets('mail <mailto:a@b.c>')).toBe('mail <mailto:a@b.c>');
  });

  it('does not touch a body with no angle brackets in it', () => {
    const body = '## Why\n\nBecause it matters.\n\n- [x] done';
    expect(showAngleBrackets(body)).toBe(body);
  });

  it('escapes a less-than that is doing arithmetic, which is also text', () => {
    expect(showAngleBrackets('keep it < 200ms')).toBe('keep it &lt; 200ms');
  });
});

describe('one answer about a ticket’s status', () => {
  it('drops the body’s own status claim, which the chip already computes', () => {
    // The drawer showed "Needs your OK" and, two lines below it, `Status: Todo`.
    const body = '**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"do the thing"*\n\n## Why';
    const out = withoutStatusClaim(body);
    expect(out.startsWith('**Phase:** 3')).toBe(true);
    expect(out).not.toContain('Status:');
    // Everything else on the line survives — it is not in any chip.
    expect(out).toContain('Asked for by');
    expect(out).toContain('do the thing');
  });

  it('handles a status line that stands alone', () => {
    expect(withoutStatusClaim('**Status:** Done\n\n## Why').trimStart()).toBe('## Why');
  });

  it('leaves a body with no status claim untouched', () => {
    const body = '## Why\n\nBecause.';
    expect(withoutStatusClaim(body)).toBe(body);
  });

  it('drops only the first claim, not the word wherever it appears', () => {
    const body = '**Status:** Todo\n\nThe **Status:** field is parsed from here.';
    expect(withoutStatusClaim(body)).toContain('The **Status:** field is parsed');
  });
});

describe('one name per ticket, per screen', () => {
  it('drops the body’s own title heading, which every surface already shows above it', () => {
    const body = '# ARCA-44 — Seed script must fail loudly\n\n**Status:** In progress\n\n## Why this matters\n\nBecause.';
    const out = withoutTitleHeading(body);
    expect(out.startsWith('**Status:**')).toBe(true);
    expect(out).toContain('## Why this matters');
  });

  it('leaves a body that never had one alone', () => {
    const body = '## Why this matters\n\nBecause.';
    expect(withoutTitleHeading(body)).toBe(body);
  });
});

describe('splitTicketBody (FB-185)', () => {
  it('keeps the ticket’s first section and folds the rest away', () => {
    // The shape every ticket file here is written in: a heading glued to its prose, no blank line.
    const md = '## Why this matters\nBecause the data is fake.\n\n## Scope\n- one\n- two\n';
    const { summary, rest } = splitTicketBody(md);
    expect(summary).toBe('## Why this matters\nBecause the data is fake.');
    expect(rest).toBe('## Scope\n- one\n- two');
  });

  it('folds the research bullets away rather than stacking them above the decision', () => {
    // ARCA-068's real shape: the opening, then a Context section of URL-bearing bullets that was
    // 1,730px of the screen a founder approves work on.
    const md = [
      '**Area:** Research · **Depends on:** —',
      '',
      '## Why this matters',
      'We need to know which sources give live data.',
      '',
      '## Context',
      'Auctions are spread across houses:',
      '- eBay has a public API (https://example.com/a).',
      '- Goldin does not (https://example.com/b).',
      '',
      '## Acceptance criteria',
      '- Written findings.',
    ].join('\n');
    const { summary, rest } = splitTicketBody(md);
    expect(summary).toContain('Why this matters');
    expect(summary).not.toContain('https://example.com/a');
    expect(rest).toContain('## Context');
    expect(rest).toContain('## Acceptance criteria');
  });

  it('a ticket written without headings falls back to its opening paragraphs', () => {
    const { summary, rest } = splitTicketBody('One.\n\nTwo.\n\nThree.\n\nFour.\n');
    expect(summary).toBe('One.\n\nTwo.');
    expect(rest).toBe('Three.\n\nFour.');
  });

  it('never cuts inside a fenced code block', () => {
    // A `#` inside a fence is a comment, not a heading. Cutting on it would render the rest as code.
    const md = '## One\nIntro.\n\n```\n# not a heading\n\nstill code\n```\n\n## Two\nAfter.\n';
    const { summary, rest } = splitTicketBody(md);
    expect(summary).toContain('# not a heading');
    expect((summary.match(/```/g) ?? []).length % 2).toBe(0);
    expect(rest).toBe('## Two\nAfter.');
  });

  it('returns everything as the summary when there is nothing to fold away', () => {
    const { summary, rest } = splitTicketBody('## Only\nJust the one section.\n');
    expect(summary).toBe('## Only\nJust the one section.');
    expect(rest).toBe('');
  });

  it('loses no words: summary and rest together still hold the whole ticket', () => {
    const md = '## A\nOne.\n\n## B\nTwo.\n\n- three\n\n## C\nFour.\n';
    const { summary, rest } = splitTicketBody(md);
    const words = (x: string) => x.split(/\s+/).filter(Boolean);
    expect(words(`${summary} ${rest}`).sort()).toEqual(words(md).sort());
  });
});
