import { describe, expect, it } from 'vitest';
import {
  approve,
  cooledDown,
  dueRoutines,
  fromProposal,
  nextToDispatch,
  pause,
  readCadence,
  resume,
  whyNotRunning,
  type Routine,
} from '../routines';

const PROPOSAL = {
  id: 'weekly-signups',
  title: 'Each week, work the new sign-ups',
  standing_order: 'Read the new sign-ups and draft a follow-up for each.',
  cadence: 'weekly',
  criterion: 'Are there sign-ups since the last run?',
  proposed_by: 'arca',
  proposed_at: '2026-08-19T09:00:00Z',
};

const routine = (over: Partial<Routine> = {}): Routine => ({
  ...(fromProposal(PROPOSAL, 'arca') as Routine),
  ...over,
});

describe('fromProposal', () => {
  it('reads a well-formed proposal', () => {
    const r = fromProposal(PROPOSAL, 'arca');
    expect(r?.id).toBe('weekly-signups');
    expect(r?.venture_id).toBe('arca');
    expect(r?.cadence).toBe('weekly');
    expect(r?.state).toBe('proposed');
  });

  it('strips anything the lane says about its own authority', () => {
    // The whole reason this function builds field by field instead of spreading. A lane that could
    // write these would be granting itself a standing permission nobody re-reads after day one.
    const grabby = {
      ...PROPOSAL,
      state: 'active',
      approved_at: '2026-08-19T09:00:01Z',
      approved_by: 'john@bruntsfield.capital',
      last_outcome: 'progress',
      last_run_at: '2026-08-19T09:00:02Z',
    };
    const r = fromProposal(grabby, 'arca');
    expect(r?.state).toBe('proposed');
    expect(r?.approved_at).toBeNull();
    expect(r?.approved_by).toBeNull();
    expect(r?.last_outcome).toBeNull();
    expect(r?.last_run_at).toBeNull();
  });

  it('takes the venture from the caller, not from the lane', () => {
    // A lane on ARCA's box must not be able to file a routine against another venture.
    expect(fromProposal({ ...PROPOSAL, venture_id: 'the-reset' }, 'arca')?.venture_id).toBe('arca');
  });

  it.each(['id', 'title', 'standing_order', 'criterion', 'proposed_by', 'proposed_at', 'cadence'])(
    'refuses a proposal with no %s rather than defaulting it',
    (field) => {
      const missing: Record<string, unknown> = { ...PROPOSAL };
      delete missing[field];
      expect(fromProposal(missing, 'arca')).toBeNull();
    },
  );

  it('refuses a cadence it does not understand', () => {
    expect(fromProposal({ ...PROPOSAL, cadence: '*/5 * * * *' }, 'arca')).toBeNull();
    expect(fromProposal({ ...PROPOSAL, cadence: 'fortnightly' }, 'arca')).toBeNull();
  });

  it('refuses whitespace as a value', () => {
    expect(fromProposal({ ...PROPOSAL, standing_order: '   ' }, 'arca')).toBeNull();
  });

  it('refuses anything that is not an object', () => {
    for (const junk of [null, undefined, 'a string', 42, []]) {
      expect(fromProposal(junk, 'arca')).toBeNull();
    }
  });
});

describe('readCadence', () => {
  it('accepts only the three it knows', () => {
    expect(readCadence('hourly')).toBe('hourly');
    expect(readCadence('daily')).toBe('daily');
    expect(readCadence('weekly')).toBe('weekly');
    expect(readCadence('Weekly')).toBeNull();
    expect(readCadence(3600)).toBeNull();
  });
});

describe('the state machine', () => {
  it('needs a named human to become active', () => {
    const r = approve(routine(), 'john@bruntsfield.capital', '2026-08-19T10:00:00Z');
    expect(r.state).toBe('active');
    expect(r.approved_by).toBe('john@bruntsfield.capital');
  });

  it('keeps the approval through a pause, so resuming is not a fresh grant', () => {
    const active = approve(routine(), 'john@bruntsfield.capital', '2026-08-19T10:00:00Z');
    const paused = pause(active);
    expect(paused.state).toBe('paused');
    expect(paused.approved_at).toBe('2026-08-19T10:00:00Z');
    expect(resume(paused).state).toBe('active');
  });

  it('will not let pause-then-resume smuggle an unapproved routine into active', () => {
    // Without this, `proposed → pause → resume` would be a path to `active` with no founder in it.
    const neverApproved = pause(routine());
    expect(resume(neverApproved).state).toBe('paused');
  });
});

describe('cooldown', () => {
  const now = new Date('2026-08-19T12:00:00Z');

  it('lets a routine that has never run go immediately', () => {
    expect(cooledDown(routine({ last_run_at: null }), now)).toBe(true);
  });

  it('holds a routine that ran inside its cadence', () => {
    const ranAnHourAgo = routine({ cadence: 'daily', last_run_at: '2026-08-19T11:00:00Z' });
    expect(cooledDown(ranAnHourAgo, now)).toBe(false);
  });

  it('releases it once the cadence has passed', () => {
    const ranYesterday = routine({ cadence: 'daily', last_run_at: '2026-08-18T11:59:00Z' });
    expect(cooledDown(ranYesterday, now)).toBe(true);
  });

  it('does not wedge forever on an unreadable timestamp', () => {
    // A corrupt record must not silently retire a routine the founder approved.
    expect(cooledDown(routine({ last_run_at: 'not a date' }), now)).toBe(true);
  });
});

describe('whyNotRunning', () => {
  const now = new Date('2026-08-19T12:00:00Z');

  it('says what a founder can act on', () => {
    expect(whyNotRunning(routine(), now)).toBe('Waiting for your OK.');
    expect(whyNotRunning(pause(routine()), now)).toBe('Paused by you.');
    const justRan = approve(routine({ cadence: 'daily', last_run_at: '2026-08-19T11:00:00Z' }), 'j', 'x');
    expect(whyNotRunning(justRan, now)).toBe('Ran recently — waiting for the next time it is due.');
  });

  it('says nothing when the routine is simply going to run', () => {
    expect(whyNotRunning(approve(routine(), 'j', 'x'), now)).toBeNull();
  });
});

describe('dispatch', () => {
  const now = new Date('2026-08-19T12:00:00Z');
  const active = (over: Partial<Routine>) =>
    approve(routine(over), 'john@bruntsfield.capital', '2026-08-01T00:00:00Z');

  it('never dispatches a routine nobody approved', () => {
    const proposed = routine({ id: 'unapproved' });
    expect(dueRoutines([proposed], now)).toEqual([]);
    expect(nextToDispatch([proposed], now)).toBeNull();
  });

  it('never dispatches a paused routine', () => {
    expect(nextToDispatch([pause(active({ id: 'p' }))], now)).toBeNull();
  });

  it('dispatches exactly one, however many are due', () => {
    const due = [
      active({ id: 'a', cadence: 'hourly', last_run_at: '2026-08-19T09:00:00Z' }),
      active({ id: 'b', cadence: 'hourly', last_run_at: '2026-08-19T08:00:00Z' }),
      active({ id: 'c', cadence: 'hourly', last_run_at: '2026-08-19T10:00:00Z' }),
    ];
    expect(dueRoutines(due, now)).toHaveLength(3);
    // One per sweep: three due, one dispatched. Everything due at once is how a quiet week bills.
    expect(nextToDispatch(due, now)?.id).toBe('b'); // longest waiting
  });

  it('does not let an hourly routine starve a weekly one', () => {
    const weekly = active({ id: 'weekly', cadence: 'weekly', last_run_at: '2026-08-01T00:00:00Z' });
    const hourly = active({ id: 'hourly', cadence: 'hourly', last_run_at: '2026-08-19T10:00:00Z' });
    expect(nextToDispatch([hourly, weekly], now)?.id).toBe('weekly');
  });

  it('puts a never-run routine first', () => {
    const fresh = active({ id: 'fresh', last_run_at: null });
    const old = active({ id: 'old', cadence: 'hourly', last_run_at: '2026-08-19T09:00:00Z' });
    expect(nextToDispatch([old, fresh], now)?.id).toBe('fresh');
  });

  it('breaks ties on id, so the same input always picks the same routine', () => {
    const one = active({ id: 'bbb', last_run_at: null });
    const two = active({ id: 'aaa', last_run_at: null });
    expect(nextToDispatch([one, two], now)?.id).toBe('aaa');
    expect(nextToDispatch([two, one], now)?.id).toBe('aaa');
  });

  it('returns nothing when nothing is due', () => {
    const cooling = active({ id: 'x', cadence: 'daily', last_run_at: '2026-08-19T11:30:00Z' });
    expect(nextToDispatch([cooling], now)).toBeNull();
  });
});
