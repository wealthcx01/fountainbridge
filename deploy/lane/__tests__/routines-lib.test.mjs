import { describe, expect, it } from 'vitest';
import {
  cooledDown,
  nextToDispatch,
  readRoutine,
  stampRun,
  ticketBody,
  ticketSlug,
} from '../routines-lib.mjs';

/**
 * The box half of FB-047.
 *
 * These deliberately mirror `lib/__tests__/routines.test.ts`. The logic is duplicated across the
 * Railway/box boundary on purpose (FB-097's precedent), and duplicated logic drifts unless both
 * copies are held to the same behaviours — so the same failure modes are pinned on both sides.
 */

const APPROVED = {
  id: 'weekly-signups',
  title: 'Each week, work the new sign-ups',
  standing_order: 'Read the new sign-ups and draft a follow-up for each.',
  cadence: 'weekly',
  criterion: 'Are there sign-ups since the last run?',
  state: 'active',
  approved_at: '2026-08-19T10:00:00Z',
  approved_by: 'founder@bruntsfield.capital',
};

describe('readRoutine', () => {
  it('reads an approved routine', () => {
    const r = readRoutine(APPROVED);
    expect(r.state).toBe('active');
    expect(r.approved_by).toBe('founder@bruntsfield.capital');
  });

  it('refuses an approval the file only claims', () => {
    // The state ref is writable by this very lane. `state: "active"` with nothing behind it is a
    // claim, and this is the code that would otherwise act on it.
    const r = readRoutine({ ...APPROVED, approved_at: '', approved_by: '' });
    expect(r.state).toBe('proposed');
    expect(r.approved_at).toBeNull();
  });

  it('needs both halves of the approval', () => {
    expect(readRoutine({ ...APPROVED, approved_by: '' }).state).toBe('proposed');
    expect(readRoutine({ ...APPROVED, approved_at: '' }).state).toBe('proposed');
  });

  it('keeps a paused routine paused', () => {
    expect(readRoutine({ ...APPROVED, state: 'paused' }).state).toBe('paused');
  });

  it('refuses a record that is not a routine', () => {
    expect(readRoutine(null)).toBeNull();
    expect(readRoutine('nope')).toBeNull();
    expect(readRoutine({ ...APPROVED, cadence: 'fortnightly' })).toBeNull();
    expect(readRoutine({ ...APPROVED, standing_order: '  ' })).toBeNull();
  });
});

describe('cooledDown', () => {
  const now = new Date('2026-08-19T12:00:00Z');

  it('lets a routine that never ran go straight away', () => {
    expect(cooledDown(readRoutine(APPROVED), now)).toBe(true);
  });

  it('holds one that ran inside its cadence', () => {
    const r = readRoutine({ ...APPROVED, cadence: 'daily', last_run_at: '2026-08-19T11:00:00Z' });
    expect(cooledDown(r, now)).toBe(false);
  });

  it('releases it once the cadence passed', () => {
    const r = readRoutine({ ...APPROVED, cadence: 'daily', last_run_at: '2026-08-18T11:00:00Z' });
    expect(cooledDown(r, now)).toBe(true);
  });

  it('does not wedge on an unreadable timestamp', () => {
    const r = readRoutine({ ...APPROVED, last_run_at: 'whenever' });
    expect(cooledDown(r, now)).toBe(true);
  });
});

describe('nextToDispatch', () => {
  const now = new Date('2026-08-19T12:00:00Z');
  const at = (over) => readRoutine({ ...APPROVED, ...over });

  it('never fires a routine nobody approved', () => {
    const unapproved = at({ id: 'x', approved_at: '', approved_by: '' });
    expect(nextToDispatch([unapproved], now)).toBeNull();
  });

  it('never fires a paused routine', () => {
    expect(nextToDispatch([at({ id: 'p', state: 'paused' })], now)).toBeNull();
  });

  it('fires exactly one, however many are due', () => {
    const due = [
      at({ id: 'a', cadence: 'hourly', last_run_at: '2026-08-19T09:00:00Z' }),
      at({ id: 'b', cadence: 'hourly', last_run_at: '2026-08-19T08:00:00Z' }),
      at({ id: 'c', cadence: 'hourly', last_run_at: '2026-08-19T10:00:00Z' }),
    ];
    expect(nextToDispatch(due, now).id).toBe('b');
  });

  it('does not let an hourly routine starve a weekly one', () => {
    const weekly = at({ id: 'weekly', cadence: 'weekly', last_run_at: '2026-08-01T00:00:00Z' });
    const hourly = at({ id: 'hourly', cadence: 'hourly', last_run_at: '2026-08-19T10:00:00Z' });
    expect(nextToDispatch([hourly, weekly], now).id).toBe('weekly');
  });

  it('breaks ties on id, so the same input picks the same routine', () => {
    const a = at({ id: 'aaa', last_run_at: null });
    const b = at({ id: 'bbb', last_run_at: null });
    expect(nextToDispatch([a, b], now).id).toBe('aaa');
    expect(nextToDispatch([b, a], now).id).toBe('aaa');
  });

  it('returns nothing when nothing is due', () => {
    expect(nextToDispatch([at({ cadence: 'daily', last_run_at: '2026-08-19T11:30:00Z' })], now)).toBeNull();
  });
});

describe('the ticket a routine files', () => {
  const fired = '2026-08-19T12:00:00Z';
  const r = readRoutine(APPROVED);

  it('leads with the check, so a quiet week costs nothing', () => {
    const body = ticketBody(r, fired);
    // The criterion must appear as an instruction ABOVE the work, not as background below it.
    expect(body.indexOf('## Check first')).toBeLessThan(body.indexOf('## What to do'));
    expect(body).toContain('Are there sign-ups since the last run?');
    expect(body).toContain('Doing nothing is');
  });

  it('says where it came from and how to stop it', () => {
    const body = ticketBody(r, fired);
    expect(body).toContain('weekly-signups');
    expect(body).toContain('Pause it from the studio');
  });

  it('opens with a title line the queue scanner will accept', () => {
    // run-once.sh skips any file with no `# Title` line, so a routine ticket without one would be
    // filed and then silently never worked.
    expect(ticketBody(r, fired).split('\n')[0]).toMatch(/^#\s+\S/);
  });

  it('dates the slug so a repeat does not collide with itself', () => {
    expect(ticketSlug(r, fired)).toBe('weekly-signups-2026-08-19');
    expect(ticketSlug(r, '2026-08-26T12:00:00Z')).toBe('weekly-signups-2026-08-26');
  });
});

describe('stampRun', () => {
  it('records the run and changes nothing else', () => {
    const before = readRoutine(APPROVED);
    const after = stampRun(before, '2026-08-19T12:00:00Z');
    expect(after.last_run_at).toBe('2026-08-19T12:00:00Z');
    expect({ ...after, last_run_at: null }).toEqual({ ...before, last_run_at: null });
  });
});
