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
 * The canonical form of an ActiveGraph event (FB-071).
 *
 * ⚠ MUST match `canonicalEvent` in lib/activegraph.ts byte for byte. This is the SECOND cross-runtime
 * formula in this system — the first is `expectedAttestation` above — and both are pinned by a shared
 * vector in a test. If you change one, change the other and the vector in the same commit; a drift
 * here makes every event the executor writes read as forged to the studio, which would show a
 * founder "something was recorded here that the studio would not accept" for every real send.
 *
 * Data keys are sorted, so the signature never depends on the order an object was built in.
 */
export function canonicalEvent(e) {
  const data = e.data ?? {};
  const orderedData = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  return [e.v, e.seq, e.venture, e.repo, e.id, e.type, e.at, e.actor.kind, e.actor.id, orderedData].join('|');
}

/** Sign an event with the studio↔executor secret. A lane holds no such secret and cannot do this. */
export function signEvent(createHmac, secret, event) {
  return createHmac('sha256', secret).update(canonicalEvent(event)).digest('hex');
}

/**
 * The events an execution produces, in order, from the records it decided to write.
 *
 * The executor records what IT did — never a grant. A grant is a human agreeing, and the projection
 * refuses `approval.granted` from any non-human actor precisely so that a compromised executor
 * cannot manufacture consent (lib/activegraph.ts).
 */
export function eventsForExecution({ records, venture, repo, id, startSeq, now }) {
  const events = [];
  let seq = startSeq;
  for (const r of records) {
    const type = r.status === 'executing' ? 'action.executing'
      : r.status === 'executed' ? 'action.executed'
      : r.status === 'failed' ? 'action.failed'
      : null;
    // A `rejected` record means the grant did not verify — there is no approved action to narrate,
    // and writing one would put a story on the record for something that never happened.
    if (!type) continue;
    events.push({
      v: 1, seq: seq++, venture, repo, id, type, at: now,
      actor: { kind: 'executor', id: 'foundry-executor' },
      ...(r.reason ? { data: { reason: r.reason } } : {}),
    });
  }
  return events;
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
