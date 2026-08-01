import { describe, it, expect } from 'vitest';
import { ago, howLong, onDate, studioNow } from '../when';

const NOW = Date.parse('2026-08-01T12:00:00Z');

describe('one way to say when (FB-068)', () => {
  it('reads as a sentence at every scale', () => {
    expect(howLong('2026-07-29T12:00:00Z', NOW)).toBe('3 days');
    expect(howLong('2026-07-31T12:00:00Z', NOW)).toBe('1 day');
    expect(howLong('2026-08-01T09:00:00Z', NOW)).toBe('3 hours');
    expect(howLong('2026-08-01T11:00:00Z', NOW)).toBe('1 hour');
    expect(howLong('2026-08-01T11:58:00Z', NOW)).toBe('2 minutes');
    expect(howLong('2026-08-01T11:59:59Z', NOW)).toBe('a few seconds');
  });

  it('turns a duration into when it happened', () => {
    expect(ago('2026-07-29T12:00:00Z', NOW)).toBe('3 days ago');
    // "a few seconds ago" is worse English than the thing a person would actually say.
    expect(ago('2026-08-01T11:59:59Z', NOW)).toBe('just now');
  });

  it('is never negative when two clocks disagree', () => {
    // The studio writes some of these timestamps and GitHub writes others. "in -3 days" is the sort
    // of thing that makes a founder distrust everything else on the page.
    expect(howLong('2026-08-02T12:00:00Z', NOW)).toBe('a few seconds');
    expect(ago('2026-08-02T12:00:00Z', NOW)).toBe('just now');
  });

  it('says nothing rather than something wrong about an unreadable date', () => {
    expect(howLong('not a date', NOW)).toBeNull();
    expect(ago('not a date', NOW)).toBeNull();
    expect(onDate('not a date')).toBeNull();
  });

  it('writes a calendar date the same way for every reader', () => {
    // 6/20/2026 for one reader and 20/06/2026 for another is ambiguous for both.
    expect(onDate('2026-06-20T00:00:00Z')).toBe('20 June 2026');
  });
});

describe('the clock seam', () => {
  it('honours the pin the UI gate depends on', () => {
    // Without E2E_NOW a green suite turns red on its own once the calendar moves past the fixtures.
    const before = process.env.E2E_NOW;
    process.env.E2E_NOW = '2026-07-22T00:00:00Z';
    expect(studioNow()).toBe(Date.parse('2026-07-22T00:00:00Z'));
    if (before === undefined) delete process.env.E2E_NOW; else process.env.E2E_NOW = before;
  });

  it('falls back to the real clock when the pin is nonsense', () => {
    const before = process.env.E2E_NOW;
    process.env.E2E_NOW = 'not a date';
    expect(studioNow()).toBeGreaterThan(Date.parse('2020-01-01T00:00:00Z'));
    if (before === undefined) delete process.env.E2E_NOW; else process.env.E2E_NOW = before;
  });
});
