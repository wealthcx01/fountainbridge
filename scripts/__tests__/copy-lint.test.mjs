import { describe, it, expect } from 'vitest';
import { lintText, BANNED, blankComments, visibleLiterals, jsxText } from '../copy-lint.mjs';

// A linter that cries wolf gets disabled, and a linter that misses the drift is decoration. These
// tests pin both edges — what it must catch, and what it must stay quiet about — because copy-lint
// reads source with regexes rather than a parser, and every one of the "stays quiet" cases below is
// something that actually tripped it while it was being written.

const rules = (text) => lintText(text).map((v) => v.rule);

describe('copy-lint catches the vocabulary it exists for', () => {
  it('flags a banned word in JSX text', () => {
    expect(rules(`<p>The lane is awake.</p>`)).toContain('lane');
  });

  it('flags a banned word in a visible string literal', () => {
    expect(rules(`const t = 'Opened a pull request for you to review.';`)).toContain('pull-request');
  });

  it('reads a paragraph wrapped across lines as one sentence', () => {
    // The first version of this linter read line by line and saw only fragments, so "branch
    // protection and whether automatic checks are set up" — split after "whether" — went unnoticed.
    const wrapped = `<p>\n  Bruntsfield only — branch\n  protection and whether checks are set up.\n</p>`;
    expect(rules(wrapped)).toContain('branch');
  });

  it('reports the line the word is on, not the line the sentence started on', () => {
    const wrapped = `<p>\n  Everything here is fine\n  until the lane stops.\n</p>`;
    expect(lintText(wrapped)[0]).toMatchObject({ line: 3, rule: 'lane' });
  });

  it('flags a title a founder can hover, and an aria-label they can hear', () => {
    expect(rules(`<span title="Nothing has merged in two weeks." />`)).toContain('merge');
    expect(rules(`<section aria-label="What the agent lanes did" />`)).toContain('agent');
  });

  it('names what to say instead, so the fix travels with the failure', () => {
    const [found] = lintText(`<p>The lane is awake.</p>`);
    expect(found.say).toBe('"your team"');
    for (const term of BANNED) expect(term.say.length).toBeGreaterThan(4);
  });
});

describe('copy-lint stays quiet about code', () => {
  it('ignores comments — engineering prose belongs there', () => {
    expect(rules(`// the lane writes a RunReport after every wake\nconst x = 1;`)).toEqual([]);
    expect(rules(`/**\n * The agent lane is the thing that merges the pull request.\n */`)).toEqual([]);
    expect(rules(`{/* FB-042: the lane's own view of a merge */}`)).toEqual([]);
  });

  it('ignores identifiers, routes, test ids and imports', () => {
    expect(rules(`import { lanes } from '@/lib/lanes';`)).toEqual([]);
    expect(rules(`<div data-testid="lane-error" className="lane card" />`)).toEqual([]);
    expect(rules(`<Link href="/lanes/merge" />`)).toEqual([]);
  });

  it('ignores a developer log line, however English it reads', () => {
    expect(rules(`console.error('[composer] engine fault streamed as reply', fault);`)).toEqual([]);
    expect(rules(`throw new Error('the lane could not be read');`)).toEqual([]);
  });

  it('does not read a TypeScript generic as a sentence', () => {
    // `useState<Thing | null>(null); const r = useRef<` wears the same angle brackets as JSX, so a
    // naive reading finds "text" between the two — and every `null` in the file becomes copy.
    expect(rules(`const [x, setX] = useState<Thing | null>(null);\nconst r = useRef<HTMLElement>(null);`)).toEqual([]);
  });

  it('leaves ordinary founder copy alone', () => {
    expect(rules(`<p>Your team checked in just now. Nothing goes live until you approve it.</p>`)).toEqual([]);
  });
});

describe('the opt-out has to be earned', () => {
  it('honours a reason given on the same line', () => {
    expect(rules(`const t = 'branch protection'; // copy-lint-ok: admin-only wiring view`)).toEqual([]);
  });

  it('honours a reason given in the comment above', () => {
    expect(rules(`// copy-lint-ok: admin-only wiring view\nconst t = 'branch protection';`)).toEqual([]);
  });

  it('honours a reason that wraps across several comment lines', () => {
    // A reason worth reading rarely fits in one line, and the copy it excuses is usually the first
    // real line after it — not mechanically the next one.
    const text = `{/* copy-lint-ok: admin-only — Bruntsfield reads this and a founder\n    never reaches it */}\n<h2>Repository health</h2>`;
    expect(rules(text)).toEqual([]);
  });

  it('excuses only what the reason introduces, not the rest of the file', () => {
    const text = `// copy-lint-ok: admin-only\nconst a = 'branch protection';\nconst b = 'the lane is awake';`;
    expect(rules(text)).toEqual(['lane']);
  });

  it('fails an opt-out with no reason — that is the whole point of it', () => {
    expect(rules(`const t = 'branch protection'; // copy-lint-ok`)).toContain('unreasoned-opt-out');
    expect(rules(`// copy-lint-ok:\nconst t = 'the lane';`)).toContain('unreasoned-opt-out');
  });
});

describe('the pieces it is built from', () => {
  it('blanks comments without moving anything else', () => {
    const text = `const a = 1; // the lane\nconst b = 2;`;
    const blanked = blankComments(text);
    expect(blanked.split('\n')[0]).toMatch(/^const a = 1; +$/);
    expect(blanked.split('\n').length).toBe(2);
    expect(blanked).toContain('const b = 2;');
  });

  it('does not mistake a URL for a comment', () => {
    expect(blankComments(`const u = 'https://example.com/x';`)).toContain('example.com');
  });

  it('picks visible literals and skips invisible attributes', () => {
    expect(visibleLiterals(`<p title="Two words here" className="a b c">`).map((l) => l.value))
      .toEqual(['Two words here']);
  });

  it('picks JSX text runs and skips code between tags', () => {
    expect(jsxText(`<p>Hello there</p>`).map((r) => r.value)).toEqual(['Hello there']);
    expect(jsxText(`const x = a<b && c>d;`)).toEqual([]);
  });
});
