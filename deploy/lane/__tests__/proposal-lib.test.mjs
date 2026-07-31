import { describe, it, expect } from 'vitest';
import { validateProposal, normalize, buildChecks, proposalId, ACTION_TYPES } from '../proposal-lib.mjs';

/**
 * The proposal is written by the party being gated. These tests are mostly about what a lane must NOT
 * be able to say — the FB-051/FB-054 lesson that a gate is only as trustworthy as its least-protected
 * input, applied at the point the input is created.
 */

const good = (over = {}) => ({
  action_type: 'send',
  summary: 'Send the early-access invitation to the 312 people on the waiting list',
  draft: 'Hello,\n\nARCA is open.\n\nIf you would rather not hear from us, unsubscribe here.',
  compliance: {
    recipients: '312 people who asked to be told when ARCA opened',
    lawful_basis: 'consent, given at sign-up',
    suppression_checked: true,
    sender: 'hello@arca.bruntsfield.capital',
  },
  ...over,
});

describe('a lane cannot narrate its own authority', () => {
  for (const field of ['attestation', 'approver', 'granted_at', 'status', 'execution', 'actor', 'signature']) {
    it(`refuses a proposal carrying "${field}"`, () => {
      const r = validateProposal(good({ [field]: 'anything' }));
      expect(r.ok).toBe(false);
      expect(r.problems.join(' ')).toContain(field);
    });
  }

  it('refuses rather than sanitises — a stripped field would leave a lane believing it worked', () => {
    // If these were silently dropped, a lane could keep writing them and never learn otherwise;
    // the point is that the attempt is visible in the run log.
    expect(validateProposal(good({ approver: 'john@bruntsfield.capital' })).proposal).toBeNull();
  });

  it('never carries an unknown field through to what gets written', () => {
    const r = validateProposal(good({ recipients_count: 312, note: 'trust me' }));
    expect(r.ok).toBe(true);
    expect(Object.keys(r.proposal)).not.toContain('recipients_count');
    expect(Object.keys(r.proposal)).not.toContain('note');
  });
});

describe('the draft is what the founder decides on', () => {
  it('refuses a file path in place of the content', () => {
    const r = validateProposal(good({ draft: 'library/campaigns/early-access.md' }));
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('looks like a file path');
  });

  it('refuses an empty draft', () => {
    expect(validateProposal(good({ draft: '   ' })).ok).toBe(false);
  });

  it('accepts real prose that happens to contain a path', () => {
    const r = validateProposal(good({ draft: 'Hi there,\nSee library/campaigns/x.md for detail.\nUnsubscribe: here' }));
    expect(r.ok).toBe(true);
  });
});

describe('the compliance record', () => {
  for (const field of ['recipients', 'lawful_basis', 'suppression_checked', 'sender']) {
    it(`requires compliance.${field}`, () => {
      const c = { ...good().compliance };
      delete c[field];
      const r = validateProposal(good({ compliance: c }));
      expect(r.ok).toBe(false);
      expect(r.problems.join(' ')).toContain(field);
    });
  }

  it('refuses a send against a list that was not suppression-checked', () => {
    const r = validateProposal(good({ compliance: { ...good().compliance, suppression_checked: false } }));
    expect(r.ok).toBe(false);
  });

  it('refuses a phrase where a boolean belongs — "checked" is not a check', () => {
    const r = validateProposal(good({ compliance: { ...good().compliance, suppression_checked: 'yes, done' } }));
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('true or false');
  });

  it('is missing entirely → refused', () => {
    const p = good(); delete p.compliance;
    expect(validateProposal(p).ok).toBe(false);
  });
});

describe('money', () => {
  it('refuses a float — pounds written where pence were expected misprices the gate 100x', () => {
    expect(validateProposal(good({ amount_minor: 52.5, currency: 'GBP' })).ok).toBe(false);
  });

  it('refuses a negative amount', () => {
    expect(validateProposal(good({ amount_minor: -1, currency: 'GBP' })).ok).toBe(false);
  });

  it('requires a currency alongside an amount', () => {
    expect(validateProposal(good({ amount_minor: 520000 })).ok).toBe(false);
  });

  it('normalises the currency so "gbp" cannot dodge comparison', () => {
    const r = validateProposal(good({ amount_minor: 520000, currency: 'gbp' }));
    expect(r.proposal.currency).toBe('GBP');
    expect(r.proposal.amount_minor).toBe(520000);
  });

  it('a free action states no amount at all rather than zero-with-no-currency', () => {
    const r = validateProposal(good());
    expect('amount_minor' in r.proposal).toBe(false);
  });
});

describe('action types and department', () => {
  it('refuses an action nothing can perform', () => {
    const r = validateProposal(good({ action_type: 'wire-transfer' }));
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain(ACTION_TYPES.join(', '));
  });

  it('refuses a proposal that files itself under a different department than it was claimed from', () => {
    // Otherwise a ticket claimed from Sell could file its spend against Scale's budget.
    const r = validateProposal(good({ department: 'scale' }), { department: 'sell' });
    expect(r.ok).toBe(false);
  });

  it('stamps the claimed department and ticket, rather than trusting the proposal for them', () => {
    const r = validateProposal(good({ department: 'sell', ticket: 'something-else' }), { department: 'sell', ticket: 'SELL-002' });
    expect(r.proposal.department).toBe('sell');
    expect(r.proposal.ticket).toBe('SELL-002');
  });

  it('reports every problem at once, so one repair round can fix them all', () => {
    const r = validateProposal({ action_type: 'nope', draft: 'x.md' });
    expect(r.problems.length).toBeGreaterThan(3);
  });
});

describe('the checks the founder sees', () => {
  it('reads the opt-out off the DRAFT, not off a claim', () => {
    const withOut = buildChecks(good());
    expect(withOut.find((c) => c.name === 'Opt-out in the copy').passed).toBe(true);
    // A lane that forgot the unsubscribe line cannot assert its way past this.
    const without = buildChecks(good({ draft: 'Hello. ARCA is open. Come and look.' }));
    expect(without.find((c) => c.name === 'Opt-out in the copy').passed).toBe(false);
  });

  it('marks every check as the proposer\'s statement, with the detail attached', () => {
    const checks = buildChecks(good());
    expect(checks.every((c) => typeof c.detail === 'string' && c.detail.length > 0)).toBe(true);
    expect(checks.find((c) => c.name === 'Sending identity').detail).toContain('arca.bruntsfield.capital');
  });

  it('is stamped proposed_by: lane, so the card never reads as a studio verdict', () => {
    expect(normalize(good(), {}).proposed_by).toBe('lane');
  });
});

describe('the approval id', () => {
  it('is stable for a ticket, so a re-run repairs its proposal instead of filing a second one', () => {
    expect(proposalId('SELL-002-early-access-invite-send')).toBe(proposalId('SELL-002-early-access-invite-send'));
  });

  it('is safe to use as a directory name', () => {
    expect(proposalId('SELL/../../etc/passwd')).toBe('sell-etc-passwd');
    expect(proposalId('Ticket With Spaces!')).toBe('ticket-with-spaces');
  });

  it('refuses to build one from a slug with nothing usable in it', () => {
    expect(() => proposalId('///')).toThrow();
  });

  it('is bounded, so a long slug cannot make an unreadable path', () => {
    expect(proposalId('a'.repeat(500)).length).toBe(80);
  });
});
