import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_COLOR, BACKGROUND_COLOR } from '../brand';

/**
 * The OS-facing colours are copies, so the copy is what gets tested (FB-141).
 *
 * `theme-color` and the web app manifest are read by iOS and Android rather than by CSS, so they
 * cannot be `var(--color-accent)` — they need a literal. The literal is a duplicate of a token, and
 * an installed app whose status bar is a shade off the rail behind it is exactly the sort of thing
 * nobody notices for months.
 */
describe('the installed app matches the studio', () => {
  const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const token = (name: string) => {
    const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
    expect(m, `--${name} is not defined in globals.css`).not.toBeNull();
    return m![1].toLowerCase();
  };

  it('the status bar is the accent, exactly', () => {
    expect(THEME_COLOR.toLowerCase()).toBe(token('color-accent'));
  });

  it('the splash is the paper, exactly', () => {
    expect(BACKGROUND_COLOR.toLowerCase()).toBe(token('color-paper'));
  });
});
