/**
 * External-action proposals (FB-045) — what a lane is allowed to ask for, and what it may never claim.
 *
 * A department whose gate is not `pr` can produce work in a PR like any other, but the moment the
 * work would reach someone outside the company — a send, a publish, an outreach sequence — the lane
 * stops being the actor. It writes a proposal to the venture's approvals record and the studio shows
 * it to the founder. Only a studio-issued grant lets the separate executor act (FB-044).
 *
 * Two properties this file exists to enforce:
 *
 * 1. **The draft is frozen INTO the proposal, not referenced from it.** A proposal that says "send
 *    what is at library/campaigns/x.md" approves a moving target: the HMAC covers proposal.json, so
 *    the referenced file could change between approval and execution and the signature would still
 *    verify. What the founder reads has to be the bytes the executor would send.
 *
 * 2. **A lane cannot narrate its own authority.** Anything resembling approval, attestation, actor
 *    identity or execution status is stripped, not merely ignored: `normalize()` builds a fresh
 *    object from known fields rather than spreading the model's. A field nobody reads today is a
 *    field somebody trusts tomorrow, and this file is written by the party being gated.
 */

/** Actions a lane may propose. Anything else must be added deliberately, with an executor that can do it. */
export const ACTION_TYPES = ['send', 'publish', 'outreach'];

/** Fields a lane must never set. Present in the input → the proposal is refused, not sanitised. */
const FORBIDDEN = [
  'attestation', 'approver', 'approved', 'approved_by', 'granted_at', 'grant',
  'status', 'executed', 'execution', 'actor', 'signature',
];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate a lane-written proposal. Returns `{ ok, problems, proposal }`.
 *
 * Fail-closed and loud: every problem is reported at once so a repair round has the whole list,
 * rather than the lane fixing one field per attempt.
 */
export function validateProposal(input, { department, ticket } = {}) {
  const problems = [];
  const p = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!p) return { ok: false, problems: ['the proposal is not a JSON object'], proposal: null };

  for (const f of FORBIDDEN) {
    if (f in p) problems.push(`"${f}" is not the lane's to write — only the studio and the executor set that`);
  }

  if (!isStr(p.action_type)) problems.push('action_type is required');
  else if (!ACTION_TYPES.includes(p.action_type)) {
    problems.push(`action_type "${p.action_type}" is not one of: ${ACTION_TYPES.join(', ')}`);
  }

  if (!isStr(p.summary)) problems.push('summary is required — it is the sentence the founder decides on');
  else if (p.summary.length > 300) problems.push('summary is over 300 characters — it must fit on the approval card');

  if (!isStr(p.draft)) {
    problems.push('draft is required, and must be the FULL text that would go out — not a path to it');
  } else if (/^[\w./-]+$/.test(p.draft.trim()) && !p.draft.includes('\n')) {
    // A bare path is the failure this check exists for: it looks like a draft and approves nothing.
    problems.push(`draft looks like a file path ("${p.draft.trim()}") — inline the content itself`);
  }

  // The compliance record (research-gtm §5 / FB-044 E2). Absent facts are the whole risk of a send.
  const c = p.compliance && typeof p.compliance === 'object' ? p.compliance : null;
  if (!c) problems.push('compliance is required for an external action');
  else {
    for (const f of ['recipients', 'lawful_basis', 'suppression_checked', 'sender']) {
      if (!(f in c)) problems.push(`compliance.${f} is required`);
    }
    if ('suppression_checked' in c && typeof c.suppression_checked !== 'boolean') {
      problems.push('compliance.suppression_checked must be true or false — an unchecked list is a fact, not a phrase');
    }
    if (c.suppression_checked === false) {
      problems.push('compliance.suppression_checked is false — a send cannot be proposed against an unsuppressed list');
    }
  }

  if ('amount_minor' in p && p.amount_minor !== null && p.amount_minor !== undefined) {
    if (!Number.isInteger(p.amount_minor) || p.amount_minor < 0) {
      // FB-054: a float here is pounds written where pence were expected — a 100x mispriced gate.
      problems.push('amount_minor must be a non-negative integer in MINOR units (pence), or absent');
    }
    if (!isStr(p.currency)) problems.push('currency is required when amount_minor is set');
  }

  if (department && isStr(p.department) && p.department !== department) {
    problems.push(`department "${p.department}" does not match the department this ticket was claimed from ("${department}")`);
  }

  if (problems.length) return { ok: false, problems, proposal: null };
  return { ok: true, problems: [], proposal: normalize(p, { department, ticket }) };
}

/**
 * Build the proposal the lane actually writes — field by field, from a known list.
 *
 * Deliberately not `{...input}`: the input is authored by the party being gated, and a spread carries
 * whatever it invented into a file the studio renders and the executor reads.
 */
export function normalize(p, { department, ticket } = {}) {
  const out = {
    action_type: p.action_type,
    summary: p.summary.trim(),
    draft: p.draft,
    department: department ?? (isStr(p.department) ? p.department : undefined),
    ticket: ticket ?? (isStr(p.ticket) ? p.ticket : undefined),
    compliance: {
      recipients: p.compliance.recipients,
      lawful_basis: p.compliance.lawful_basis,
      suppression_checked: p.compliance.suppression_checked,
      sender: p.compliance.sender,
      ...(isStr(p.compliance.note) ? { note: p.compliance.note } : {}),
    },
    checks: buildChecks(p),
    proposed_by: 'lane',
  };
  if (Number.isInteger(p.amount_minor)) {
    out.amount_minor = p.amount_minor;
    out.currency = String(p.currency).trim().toUpperCase();
  }
  if (isStr(p.pr_url)) out.pr_url = p.pr_url;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/**
 * The checks the founder sees on the approval card.
 *
 * These are the PROPOSER's statements about its own work, and the card says so. They are not the
 * studio's verdict on anything — the studio computes its own (the budget position, the provenance of
 * the grant) and never merges the two, because a lane-authored "✓ passed" beside a studio-computed
 * one reads as though both were checked by the studio.
 */
export function buildChecks(p) {
  const c = p.compliance ?? {};
  const checks = [
    { name: 'Recipients identified', passed: isStr(c.recipients), detail: isStr(c.recipients) ? c.recipients : 'not stated' },
    { name: 'Lawful basis stated', passed: isStr(c.lawful_basis), detail: isStr(c.lawful_basis) ? c.lawful_basis : 'not stated' },
    { name: 'Suppression list checked', passed: c.suppression_checked === true, detail: c.suppression_checked === true ? 'checked' : 'not checked' },
    { name: 'Sending identity', passed: isStr(c.sender), detail: isStr(c.sender) ? c.sender : 'not stated' },
  ];
  // An unsubscribe path is a property of the DRAFT, so it is read off the draft rather than believed
  // from a flag: a lane that forgot it cannot assert its way past this one.
  const hasOptOut = /unsubscribe|opt.?out|stop hearing|no longer wish/i.test(String(p.draft ?? ''));
  checks.push({ name: 'Opt-out in the copy', passed: hasOptOut, detail: hasOptOut ? 'present in the draft' : 'not found in the draft' });
  return checks;
}

/**
 * The approval id: stable per ticket, so a re-run repairs its own proposal instead of filing a second
 * one the founder has to reconcile. Slug-safe — this becomes a directory name on the approvals ref.
 */
export function proposalId(slug) {
  const safe = String(slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe) throw new Error('cannot build a proposal id from an empty ticket slug');
  return safe.slice(0, 80);
}
