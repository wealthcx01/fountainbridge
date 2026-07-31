import { describe, it, expect } from 'vitest';
import { lintText, RULES } from '../design-lint.mjs';

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
