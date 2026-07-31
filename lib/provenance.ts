/**
 * Approval provenance (FB-051, narrowed) — what the studio can actually prove about a grant.
 *
 * ## What this replaces, and why
 *
 * The first design was an event-sourced runtime: an append-only log on the venture's
 * `foundry-approvals` ref, with the approval's status projected from it and a rule that only a
 * `founder`/`bruntsfield` actor could move it to `granted`. A ten-specialist review found that the
 * rule enforced nothing, because the gate read `actor.kind` — a field inside a JSON file that the
 * proposing lane holds repo-write on. A lane writing
 * `{type:'approval.granted', actor:{kind:'founder', id:'john@…'}}` projected to `granted` by a named
 * human with no fault raised. The design doc claimed "a forged grant cannot even project to granted";
 * that was false, and the only forgery the tests covered was an adversary that honestly labelled
 * itself `lane`.
 *
 * It was also unused: nothing writes an `approval.proposed` event, so every real log opened with
 * `granted` and the loader discarded it. The events were write-only, and `reconcile()` — added in a
 * review round to fix a bug — was unreachable code that introduced two more.
 *
 * ## What is actually verifiable
 *
 * Exactly one thing: **FB-044's HMAC attestation**. The studio issues it on human Approve, over
 * `id|proposal_sha|approver`, with `FOUNDRY_APPROVAL_SECRET` held by the studio and the executor and
 * NEVER on a lane box. A lane can write any file it likes on that ref; it cannot produce a valid
 * attestation, and it cannot alter the proposal a valid one pins.
 *
 * So this module does one job: recompute the attestation and say what it found. Three states, and
 * the studio never guesses between them:
 *
 *   `attested`   — the HMAC verifies. This grant provably came from the studio, for this exact
 *                  proposal, naming this approver. It is the only state that may be shown as an
 *                  approval by a person.
 *   `unattested` — a grant record exists but does not verify (or carries no attestation). It may be
 *                  a lane's forgery, a stale grant against a since-changed proposal, or a secret
 *                  rotation. The studio shows it AS unverified and never as a human's approval.
 *   `none`       — no grant record. Awaiting the gate.
 *
 * The studio does not adjudicate beyond that. The executor is the component that refuses to act on
 * an unattested grant, and it holds the same secret; this is the founder-facing read of the same
 * fact, not a second gate that could disagree with the first.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type GrantProvenance = 'attested' | 'unattested' | 'none';

export interface GrantRecord {
  approver?: unknown;
  proposal_sha?: unknown;
  attestation?: unknown;
  granted_at?: unknown;
}

export interface VerifiedGrant {
  provenance: GrantProvenance;
  /** The approver, ONLY when the attestation verifies. Null otherwise — an unverified name is noise. */
  approver: string | null;
  /** When the studio recorded the grant, only when attested. */
  grantedAt: string | null;
  /** Why an existing grant did not verify, for the founder-facing line. */
  reason: string | null;
}

const NONE: VerifiedGrant = { provenance: 'none', approver: null, grantedAt: null, reason: null };

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verify a grant against the studio's own signing secret.
 *
 * `proposalSha` is the CURRENT sha of `proposal.json`. The attestation pins the sha that was
 * approved, so a proposal edited after the grant fails here — the same TOCTOU protection the
 * executor relies on, surfaced to the founder rather than discovered at execution time.
 *
 * Without a secret configured the studio cannot verify anything, and says so. It does NOT fall back
 * to trusting the file: an unverifiable grant is exactly what this exists to catch.
 */
export function verifyGrant(
  id: string,
  proposalSha: string | null,
  grant: GrantRecord | null | undefined,
  secret: string | undefined,
): VerifiedGrant {
  if (!grant || typeof grant !== 'object') return NONE;

  const approver = typeof grant.approver === 'string' ? grant.approver.trim() : '';
  const attestation = typeof grant.attestation === 'string' ? grant.attestation : '';
  const pinned = typeof grant.proposal_sha === 'string' ? grant.proposal_sha : '';
  const grantedAt = typeof grant.granted_at === 'string' && grant.granted_at.trim() ? grant.granted_at.trim() : null;

  const unattested = (reason: string): VerifiedGrant =>
    ({ provenance: 'unattested', approver: null, grantedAt: null, reason });

  if (!secret) return unattested('the studio has no signing secret configured, so it cannot verify this');
  if (!approver) return unattested('the grant record names no approver');
  if (!attestation) return unattested('the grant record carries no attestation');
  if (!proposalSha) return unattested('the proposal it was granted against could not be read');
  if (pinned && pinned !== proposalSha) {
    return unattested('the proposal changed after it was approved, so the approval no longer covers it');
  }

  const expected = createHmac('sha256', secret)
    .update(`${id}|${proposalSha}|${approver.toLowerCase()}`)
    .digest('hex');
  if (!equal(attestation, expected)) {
    return unattested('the attestation does not verify — this was not issued by the studio');
  }
  return { provenance: 'attested', approver, grantedAt, reason: null };
}

/** The founder-facing line. Plain about what is proven and what is merely recorded. */
export function describeProvenance(grant: VerifiedGrant): string | null {
  switch (grant.provenance) {
    case 'none':
      return null;
    case 'attested':
      return `Approved by ${grant.approver}${grant.grantedAt ? ` on ${grant.grantedAt.slice(0, 10)}` : ''}, verified by the studio.`;
    case 'unattested':
      return `⚠ This is recorded as approved, but the studio cannot verify it: ${grant.reason}. Treat it as unapproved — the executor will refuse to act on it.`;
  }
}
