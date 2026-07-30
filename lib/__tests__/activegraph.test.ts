import { describe, it, expect } from 'vitest';
import {
  project,
  replayTo,
  nextEvent,
  ordered,
  isDefensible,
  isHuman,
  suppressionList,
  isSuppressed,
  type ApprovalEvent,
  type Actor,
  type ComplianceRecord,
} from '../activegraph';
import { eventsFromLegacy, isBridged } from '../activegraph-bridge';

const lane: Actor = { kind: 'lane', id: 'arca-lane' };
const founder: Actor = { kind: 'founder', id: 'ross@bruntsfield.capital' };
const executor: Actor = { kind: 'executor', id: 'foundry-executor' };

const compliance: ComplianceRecord = {
  recipient: 'jane@firm.com',
  pecrClass: 'corporate',
  lawfulBasis: { kind: 'legitimate-interests', ref: 'arca-LIA-2026-01' },
  suppressionCheck: { checked: true, suppressed: false, listRef: 'arca-suppression' },
  draftSha: 'abc123',
  channel: 'email',
  sendingIdentity: { address: 'ross@arca.com', scope: 'gmail.send' },
};

const proposed: ApprovalEvent = {
  seq: 1,
  type: 'approval.proposed',
  at: '2026-07-30T10:00:00Z',
  actor: lane,
  causedBy: null,
  summary: 'Send the launch email',
  department: 'sell',
  ticket: 'ARCA-004',
  amountMinor: 20_000,
  currency: 'GBP',
  compliance,
};
const granted: ApprovalEvent = {
  seq: 2,
  type: 'approval.granted',
  at: '2026-07-30T11:00:00Z',
  actor: founder,
  causedBy: 1,
};
const executed: ApprovalEvent = {
  seq: 3,
  type: 'approval.executed',
  at: '2026-07-30T11:00:05Z',
  actor: executor,
  causedBy: 2,
  data: { reason: 'sent to 1 recipient' },
};

describe('the happy path — proposed → granted → executed', () => {
  const p = project([proposed, granted, executed]);

  it('projects the terminal status', () => {
    expect(p.status).toBe('executed');
    expect(p.outcome).toBe('sent to 1 recipient');
    expect(p.faults).toEqual([]);
    expect(isDefensible(p)).toBe(true);
  });

  it('carries the actor lineage a regulator asks for', () => {
    expect(p.lineage.map((l) => [l.type, l.actor.kind])).toEqual([
      ['approval.proposed', 'lane'],
      ['approval.granted', 'founder'],
      ['approval.executed', 'executor'],
    ]);
    expect(p.proposedBy).toEqual(lane);
    expect(p.grantedBy).toEqual(founder);
    expect(p.grantedAt).toBe('2026-07-30T11:00:00Z');
  });

  it('freezes the §5 compliance record from the proposal', () => {
    expect(p.compliance).toEqual(compliance);
    expect(p.compliance?.lawfulBasis.ref).toBe('arca-LIA-2026-01');
    expect(p.compliance?.draftSha).toBe('abc123');
  });

  it('is deterministic, and independent of stored order', () => {
    expect(project([proposed, granted, executed])).toEqual(p);
    const shuffled = project([executed, proposed, granted]);
    expect(shuffled.status).toBe('executed');
    expect(shuffled.lineage).toEqual(p.lineage);
    // …but storing them out of order is itself worth reporting: something wrote history.
    expect(shuffled.faults.map((f) => f.code)).toContain('out-of-order');
  });
});

describe('replay — the state as it stood at any point', () => {
  const log = [proposed, granted, executed];

  it('replays to each point with the lineage true at that time', () => {
    expect(replayTo(log, 1).status).toBe('proposed');
    expect(replayTo(log, 1).grantedBy).toBeNull();
    expect(replayTo(log, 2).status).toBe('granted');
    expect(replayTo(log, 2).grantedBy).toEqual(founder);
    expect(replayTo(log, 3).status).toBe('executed');
  });

  it('is a pure fold — replaying the whole log equals projecting it', () => {
    expect(replayTo(log, 99)).toEqual(project(log));
  });
});

describe('THE gate — only a human can grant', () => {
  it('refuses a lane-granted approval and reports it', () => {
    const forged: ApprovalEvent = { ...granted, actor: lane };
    const p = project([proposed, forged]);
    // Not merely flagged — it does not project to granted. A forged grant cannot masquerade as one.
    expect(p.status).toBe('proposed');
    expect(p.grantedBy).toBeNull();
    expect(p.faults[0].code).toBe('non-human-grant');
    expect(p.faults[0].message).toContain('only a human can grant');
    expect(isDefensible(p)).toBe(false);
  });

  it('refuses the executor granting to itself', () => {
    expect(project([proposed, { ...granted, actor: executor }]).status).toBe('proposed');
  });

  it('accepts a Bruntsfield approver as well as the founder (D7 routing)', () => {
    const p = project([proposed, { ...granted, actor: { kind: 'bruntsfield', id: 'john@bruntsfield.capital' } }]);
    expect(p.status).toBe('granted');
    expect(p.faults).toEqual([]);
  });

  it('classifies actors', () => {
    expect(isHuman(founder)).toBe(true);
    expect(isHuman(lane)).toBe(false);
    expect(isHuman(undefined)).toBe(false);
  });
});

describe('a log that cannot be trusted says so', () => {
  it('reports a log with no proposal', () => {
    expect(project([]).faults[0].code).toBe('no-proposal');
    expect(project([{ ...granted, seq: 1, causedBy: null }]).faults.map((f) => f.code)).toContain('no-proposal');
  });

  it('refuses execution that never passed a grant', () => {
    const p = project([proposed, { ...executed, seq: 2, causedBy: 1 }]);
    expect(p.status).toBe('proposed');
    expect(p.faults.map((f) => f.code)).toContain('illegal-transition');
  });

  it('reports an event after a terminal state', () => {
    const p = project([proposed, granted, executed, { ...granted, seq: 4, causedBy: 3 }]);
    expect(p.status).toBe('executed');
    expect(p.faults.map((f) => f.code)).toContain('post-terminal');
  });

  it('reports a duplicate sequence — the true order is unrecoverable', () => {
    const p = project([proposed, granted, { ...executed, seq: 2, causedBy: 1 }]);
    expect(p.faults.map((f) => f.code)).toContain('duplicate-seq');
  });

  it('reports broken lineage: a cause that does not precede its effect', () => {
    const p = project([proposed, { ...granted, causedBy: 7 }]);
    expect(p.faults.map((f) => f.code)).toContain('broken-lineage');
  });

  it('reports a second proposal — an approval is proposed exactly once', () => {
    const p = project([proposed, { ...proposed, seq: 2, causedBy: 1 }]);
    expect(p.faults.map((f) => f.code)).toContain('illegal-transition');
  });

  it('never throws, whatever it is handed', () => {
    expect(() => project([{ ...proposed, amountMinor: -5, compliance: undefined }])).not.toThrow();
    expect(project([{ ...proposed, amountMinor: 4.5 }]).amountMinor).toBe(0);
  });
});

describe('nextEvent keeps the chain intact at every write site', () => {
  it('numbers from 1 and points at the head', () => {
    const first = nextEvent([], { type: 'approval.proposed', at: 'now', actor: lane });
    expect(first).toMatchObject({ seq: 1, causedBy: null });
    const second = nextEvent([first], { type: 'approval.granted', at: 'later', actor: founder });
    expect(second).toMatchObject({ seq: 2, causedBy: 1 });
    expect(project([first, second]).status).toBe('granted');
  });

  it('finds the head even when the log is handed over unsorted', () => {
    expect(nextEvent([granted, proposed], { type: 'approval.executed', at: 'x', actor: executor })).toMatchObject({
      seq: 3,
      causedBy: 2,
    });
  });

  it('ordered() does not mutate the caller’s array', () => {
    const input = [executed, proposed];
    ordered(input);
    expect(input[0]).toBe(executed);
  });
});

describe('bridging FB-044’s files', () => {
  const legacy = {
    proposal: {
      id: 'a1',
      summary: 'Send the launch email',
      department: 'sell',
      amount_minor: 20_000,
      compliance: {
        recipient: 'jane@firm.com',
        pecr_class: 'corporate',
        lawful_basis: { kind: 'legitimate-interests', ref: 'arca-LIA-2026-01' },
        suppression_check: { checked: true, suppressed: false },
        draft_sha: 'abc123',
        channel: 'email',
        sending_identity: { address: 'ross@arca.com', scope: 'gmail.send' },
      },
    },
    grant: { approver: 'ross@bruntsfield.capital', granted_at: '2026-07-30T11:00:00Z', attestation: 'hmac' },
    execution: { status: 'executed', reason: 'sent to 1 recipient' },
  };

  it('derives a chain that projects to the same story', () => {
    const p = project(eventsFromLegacy(legacy));
    expect(p.status).toBe('executed');
    expect(p.grantedBy).toEqual({ kind: 'founder', id: 'ross@bruntsfield.capital' });
    expect(p.compliance?.lawfulBasis.ref).toBe('arca-LIA-2026-01');
    expect(p.faults).toEqual([]);
  });

  it('attributes the proposal to a LANE, never a human', () => {
    // Attributing a v0 proposal to a human is the one lie that matters: it would make an ungranted
    // action look approved.
    expect(eventsFromLegacy({ ...legacy, grant: null, execution: null })[0].actor.kind).toBe('lane');
  });

  it('marks bridged records, because reconstructed order is not recorded order', () => {
    expect(isBridged(eventsFromLegacy(legacy))).toBe(true);
    expect(isBridged([proposed])).toBe(false);
  });

  it('handles the partial states v0 actually has on disk', () => {
    expect(project(eventsFromLegacy({ ...legacy, grant: null, execution: null })).status).toBe('proposed');
    expect(project(eventsFromLegacy({ ...legacy, execution: null })).status).toBe('granted');
    expect(project(eventsFromLegacy({ ...legacy, execution: { status: 'failed', reason: 'smtp refused' } })).outcome)
      .toBe('smtp refused');
  });

  it('is not fooled by a grant with no proposal', () => {
    expect(eventsFromLegacy({ proposal: null, grant: legacy.grant, execution: null })).toEqual([]);
  });

  it('accepts camelCase as well as snake_case compliance keys', () => {
    const camel = { proposal: { compliance: { pecrClass: 'sole-trader', draftSha: 'x' } }, grant: null, execution: null };
    expect(project(eventsFromLegacy(camel)).compliance?.pecrClass).toBe('sole-trader');
  });
});

describe('suppression — the right to object is absolute', () => {
  const add = (seq: number, address: string) => ({
    seq,
    type: 'suppression.added' as const,
    at: 'now',
    actor: founder,
    address,
  });

  it('projects the current list from its own log', () => {
    const list = suppressionList([add(1, 'a@x.com'), add(2, 'B@X.com')]);
    expect(isSuppressed(list, 'a@x.com')).toBe(true);
    // Case and whitespace must not be a way past a suppression.
    expect(isSuppressed(list, ' b@x.com ')).toBe(true);
    expect(isSuppressed(list, 'c@x.com')).toBe(false);
  });

  it('lets a re-consent supersede an objection without deleting the record of it', () => {
    const events = [add(1, 'a@x.com'), { ...add(2, 'a@x.com'), type: 'suppression.removed' as const }];
    expect(isSuppressed(suppressionList(events), 'a@x.com')).toBe(false);
    // The objection is still IN the log — superseded, not erased. That is the audit property.
    expect(events).toHaveLength(2);
  });

  it('ignores a blank address rather than suppressing everyone', () => {
    expect(suppressionList([add(1, '   ')]).size).toBe(0);
  });
});
