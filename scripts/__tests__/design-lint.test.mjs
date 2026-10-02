import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { definedProperties, lintText, RULES } from '../design-lint.mjs';

// A linter that cries wolf gets disabled, and a linter that misses the drift is decoration. These
// tests pin both edges: what it must catch, and what it must stay quiet about.

const rules = (text, path = 'components/X.tsx') => lintText(text, path).map((v) => v.rule);

describe('design-lint catches the drift it exists for', () => {
  it('flags a raw hex colour', () => {
    expect(rules(`<p style={{ color: '#ff0000' }} />`)).toContain('raw-colour');
  });

  it('flags a raw px value', () => {
    expect(rules(`<p style={{ fontSize: '13px' }} />`)).toContain('raw-px');
  });

  it('flags a status colour named directly instead of through a tone', () => {
    expect(rules(`<p style={{ color: 'var(--color-warn)' }} />`)).toContain('raw-status-colour');
    expect(rules(`<p style={{ color: 'var(--color-error)' }} />`)).toContain('raw-status-colour');
    expect(rules(`<p style={{ color: 'var(--color-ok)' }} />`)).toContain('raw-status-colour');
  });

  it('flags a button that dispatches nothing', () => {
    expect(rules(`<button className="card">Do a thing</button>`)).toContain('dead-control');
  });

  it('judges a multi-line button as a whole tag, not line by line', () => {
    const live = `<button\n  className="card"\n  data-testid="t"\n  onClick={() => go()}\n>go</button>`;
    expect(rules(live)).not.toContain('dead-control');
    const dead = `<button\n  className="card"\n  data-testid="t"\n>go</button>`;
    expect(rules(dead)).toContain('dead-control');
  });

  it('reports the line number, so the message is actionable', () => {
    const found = lintText(`const a = 1;\n<p style={{ fontSize: '13px' }} />`, 'components/X.tsx');
    expect(found[0]).toMatchObject({ line: 2, rule: 'raw-px' });
  });

  it('names every rule it can emit', () => {
    const emitted = new Set(
      lintText(`<p style={{ color: '#abc', fontSize: '2px' }} />\n<button/>`, 'components/X.tsx').map((v) => v.rule),
    );
    for (const rule of emitted) expect(RULES[rule]).toBeTruthy();
  });
});

describe('design-lint stays quiet where it should', () => {
  it('allows tokens', () => {
    expect(rules(`<p style={{ fontSize: 'var(--fs-meta-lg)', color: 'var(--tone-attention)' }} />`)).toEqual([]);
  });

  it('allows the 1px hairline — the design system’s own atom', () => {
    expect(rules(`<div style={{ borderLeft: '1px solid var(--color-border)' }} />`)).toEqual([]);
  });

  it('allows ordinary non-status chrome colours', () => {
    expect(rules(`<p style={{ color: 'var(--color-ink-muted)', background: 'var(--color-paper)' }} />`)).toEqual([]);
  });

  it('exempts the token source, which is where raw values are defined', () => {
    const css = `:root { --color-ok: #1a3b26; --fs-meta: 12px; }`;
    expect(lintText(css, 'app/globals.css')).toEqual([]);
    // …but the same content anywhere else is a violation.
    expect(rules(css, 'app/other.css').length).toBeGreaterThan(0);
  });

  it('exempts the stylesheet from the tone rule — it is where tones are wired to colours', () => {
    expect(lintText(`--tone-ok: var(--color-ok);`, 'app/globals.css')).toEqual([]);
  });

  it('ignores comments, including block comments spanning lines', () => {
    expect(rules(`// was '#ff0000' at 13px\nconst a = 1;`)).toEqual([]);
    expect(rules(`/*\n * once #ff0000 and 13px\n */\nconst a = 1;`)).toEqual([]);
  });

  it('ignores a #anchor inside a URL', () => {
    expect(rules(`<a href="https://example.com/docs#tokens">tokens</a>`)).toEqual([]);
  });

  it('accepts a submit button, a disabled button, and a spread-props button as live', () => {
    expect(rules(`<button type="submit">Sign in</button>`)).toEqual([]);
    expect(rules(`<button disabled>Approving…</button>`)).toEqual([]);
    expect(rules(`<button {...props}>Go</button>`)).toEqual([]);
  });
});

describe('a stylesheet must not key on a test id (FB-158)', () => {
  it('flags a rule selecting on data-testid', () => {
    // The phone media query hid the rail with `[data-testid='rail']`. Renaming the waiting shell's
    // id took it out of that rule and put a 250px rail back on a 393px screen — FB-124's defect,
    // returning through a test id.
    const found = lintText("@media (max-width: 60rem) {\n  [data-testid='rail'] { display: none; }\n}\n", 'app/globals.css');
    expect(found.map((v) => v.rule)).toContain('testid-selector');
  });

  it('accepts the same rule keyed on the class', () => {
    const found = lintText('@media (max-width: 60rem) {\n  .rail { display: none; }\n}\n', 'app/globals.css');
    expect(found.map((v) => v.rule)).not.toContain('testid-selector');
  });

  it('leaves test ids alone in components, where they belong', () => {
    const found = lintText('<nav data-testid="rail" />\n', 'components/Rail.tsx');
    expect(found.map((v) => v.rule)).not.toContain('testid-selector');
  });

  it('catches the other selector forms too', () => {
    for (const sel of ['[data-testid^="rail"]', '[data-testid*=rail]', '[data-testid|="rail"]']) {
      const found = lintText(`${sel} { display: none; }\n`, 'app/globals.css');
      expect(found.map((v) => v.rule), sel).toContain('testid-selector');
    }
  });
});

describe('a token must exist before it is used (FB-150)', () => {
  // `--color-rule` and `--color-surface` were used in three components and defined nowhere. A
  // browser drops a line that names a missing token, so the composer's text box had no border and
  // no background, and every check was green because each one saw a token and stopped there.
  const defined = definedProperties(':root {\n  --color-border: #dddbd6;\n  --color-paper-raised: #fdfcfa;\n}\n');
  const found = (text) => lintText(text, 'components/X.tsx', defined).filter((v) => v.rule === 'undefined-token');

  it('flags a token nothing defines, and names it', () => {
    const out = found(`<textarea style={{ border: '1px solid var(--color-rule)' }} />`);
    expect(out).toHaveLength(1);
    expect(out[0].snippet).toContain('--color-rule');
  });

  it('flags each missing token on a line, not just the first', () => {
    const out = found(`<pre style={{ background: 'var(--color-surface)', border: '1px solid var(--color-rule)' }} />`);
    expect(out.map((v) => v.snippet.split(' ')[0])).toEqual(['--color-surface', '--color-rule']);
  });

  it('accepts the tokens that are defined', () => {
    expect(found(`<textarea style={{ border: '1px solid var(--color-border)', background: 'var(--color-paper-raised)' }} />`)).toEqual([]);
  });

  it('matches the whole name, so a defined token does not vouch for a longer or shorter one', () => {
    expect(found(`<p style={{ color: 'var(--color-border-strong)' }} />`)).toHaveLength(1);
    expect(found(`<p style={{ color: 'var(--color-bord)' }} />`)).toHaveLength(1);
  });

  it('leaves a name built while the page runs alone, since the text cannot say what it will be', () => {
    expect(found('return `var(--tone-${tone})`;')).toEqual([]);
  });

  it('counts an inline definition and a next/font typeface as defined', () => {
    const more = definedProperties(`<div style={{ '--bar-width': '40%' }} />\nconst f = Inter({ variable: '--font-inter' });`);
    expect([...more].sort()).toEqual(['--bar-width', '--font-inter']);
  });

  it('does not count a token named only inside a comment as defined', () => {
    // Found in review: a comment such as this one would have defined --color-rule for every file.
    const text = [
      '// the old --color-rule: was never defined',
      '/* --color-surface: was the other one',
      '   --color-ghost: too */',
      '{/* --color-jsx: in a JSX comment */}',
      ':root { --color-real: #fff; }',
      "const u = 'https://example.com'; --after-url: 1px;",
    ].join('\n');
    expect([...definedProperties(text)].sort()).toEqual(['--after-url', '--color-real']);
  });

  it('does not run when it is not told what is defined, so the other rules can be tested alone', () => {
    expect(lintText(`<p style={{ color: 'var(--color-rule)' }} />`, 'components/X.tsx')).toEqual([]);
  });

  it('reads the real token file: the tokens the fix uses are there, and the two missing ones are not', () => {
    const real = definedProperties(readFileSync('app/globals.css', 'utf8'));
    expect(real.has('--color-border')).toBe(true);
    expect(real.has('--color-paper-raised')).toBe(true);
    expect(real.has('--color-rule')).toBe(false);
    expect(real.has('--color-surface')).toBe(false);
  });
});
