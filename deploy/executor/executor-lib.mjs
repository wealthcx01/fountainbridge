// Pure logic from the gated executor (FB-044/FB-051), extracted so it can be tested.
//
// executor.mjs has no exports and calls main() at import time, so vitest could not touch it — and a
// mutation pass proved the consequence: changing the FAILURE write from status:'failed' to
// status:'executed' passed the entire suite. A send that threw would have been recorded on the money
// surface as delivered, and nothing would have noticed.
//
// Everything here is I/O-free or takes its I/O injected.

/** The attestation a legit grant must carry. MUST match lib/approval-attestation.ts byte for byte. */
export function expectedAttestation(createHmac, secret, repo, id, proposalSha, approver) {
  return createHmac('sha256', secret)
    .update(`${repo}|${id}|${proposalSha}|${String(approver).trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * Decide what to write for one approval. Returns the sequence of records to persist, so the caller
 * does the I/O and the decision is testable on its own.
 *
 * `performAction` may throw: a throw records `failed`, never `executed`. Before FB-051 nothing wrote
 * `failed` at all, so a throw left the record at `executing` and the early-return skipped it on every
 * later pass — a half-completed real send displayed as permanently in-flight.
 */
export async function decideExecution({ id, proposal, verify, performAction, now }) {
  if (!verify.ok) {
    return [{ id, status: 'rejected', reason: verify.reason, executed_at: now }];
  }
  const started = { id, status: 'executing', approver: verify.approver, started_at: now };
  try {
    const result = await performAction(proposal);
    return [started, {
      id, status: 'executed', action_type: proposal.action_type, approver: verify.approver, result, executed_at: now,
    }];
  } catch (err) {
    return [started, {
      id, status: 'failed', approver: verify.approver,
      reason: `the action threw: ${err?.message ?? err}`, executed_at: now,
    }];
  }
}
