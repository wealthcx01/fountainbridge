import { describe, it, expect } from 'vitest';
import { faultyReads, shouldFail, failIfFaulted, FAULTABLE } from '../read-faults';

/**
 * The fault switch (FB-137).
 *
 * A diagnostic that can be turned on by accident is worse than no diagnostic: it would make a real
 * venture render as broken. These tests are mostly about it staying OFF.
 */
describe('failing a read on purpose', () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  const rig = (over: Record<string, string> = {}) => env({ E2E_TEST_LOGIN: '1', ...over });

  it('fails the named reads', () => {
    expect([...faultyReads(rig({ E2E_FAIL_READS: 'runreports,approvals' }))].sort())
      .toEqual(['approvals', 'runreports']);
    expect(shouldFail('runreports', rig({ E2E_FAIL_READS: 'runreports' }))).toBe(true);
    expect(shouldFail('tickets', rig({ E2E_FAIL_READS: 'runreports' }))).toBe(false);
  });

  it('`all` means every one of them', () => {
    expect(faultyReads(rig({ E2E_FAIL_READS: 'all' })).size).toBe(FAULTABLE.length);
  });

  it('is inert without the test-rig flag, whatever the fault list says', () => {
    // Keying off the fault list alone would mean one stray environment variable could render a
    // founder's real venture as broken.
    expect(faultyReads(env({ E2E_FAIL_READS: 'all' })).size).toBe(0);
    expect(shouldFail('runreports', env({ E2E_FAIL_READS: 'all' }))).toBe(false);
  });

  it('is inert with the flag but no fault list — the ordinary test rig', () => {
    expect(faultyReads(rig()).size).toBe(0);
  });

  it('ignores a name it does not know rather than taking a screen down', () => {
    // A typo should leave the studio working, not produce something that looks like the very
    // failure being tested.
    expect([...faultyReads(rig({ E2E_FAIL_READS: 'runreprots, approvals' }))]).toEqual(['approvals']);
    expect(faultyReads(rig({ E2E_FAIL_READS: 'nonsense' })).size).toBe(0);
  });

  it('tolerates spacing and case', () => {
    expect([...faultyReads(rig({ E2E_FAIL_READS: ' RunReports , TICKETS ' }))].sort())
      .toEqual(['runreports', 'tickets']);
  });

  it('throws only when faulted, and never says anything a founder should read', () => {
    expect(() => failIfFaulted('trail', rig({ E2E_FAIL_READS: 'trail' }))).toThrow(/on purpose/);
    expect(() => failIfFaulted('trail', rig())).not.toThrow();
  });
});
