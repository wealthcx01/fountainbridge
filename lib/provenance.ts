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
 * `repo|id|proposal_sha|approver`, with `FOUNDRY_APPROVAL_SECRET` held by the studio and the executor
 * and NEVER on a lane box. A lane can write any file it likes on that ref; it cannot produce a valid
 * attestation, and it cannot alter the proposal a valid one pins. (The repo is in the message because
 * one secret serves every venture and a blob sha is content-addressed — see approval-attestation.ts.)
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
 * The studio does not adjudicate beyond that. The executor is the component that refuses to act on an
 * unattested grant.
 *
 * The two are NOT guaranteed to agree, and the copy says so where it matters. The executor
 * additionally enforces an `APPROVER_IDENTITIES` allowlist held on its own box, so a grant this module
 * calls attested can still be refused there (a founder added to the manifest but not to that env var).
 * And when the studio has no secret it can verify nothing while the executor may hold a working one —
 * the only case where "nothing will be sent" would be a lie, which `describeProvenance` handles
 * explicitly rather than promising.
 */

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { attestationFor, refusalAttestationFor } from './approval-attestation';

export type GrantProvenance = 'attested' | 'unattested' | 'none';

/**
 * Why a grant could not be verified. Discriminated, because the RESPONSES differ completely: a
 * changed proposal is a routine re-approve; a bad signature means something with write access to the
 * venture repo forged a human approval, which is an incident; and a missing studio secret is OUR
 * misconfiguration, where the executor may still act.
 */
export type UnattestedReason =
  | 'no-studio-secret'
  | 'no-approver'
  | 'no-signature'
  | 'proposal-unreadable'
  | 'proposal-changed'
  | 'bad-signature';

export interface GrantRecord {
  approver?: unknown;
  proposal_sha?: unknown;
  attestation?: unknown;
  granted_at?: unknown;
}

export interface VerifiedGrant {
  provenance: GrantProvenance;
  /**
   * The approver, ONLY when the attestation verifies, and in the CANONICAL form the signature
   * actually covered. Returning the raw field would let anyone holding a copy of a valid grant
   * rewrite it to a case or Unicode variant that folds identically — still verifying, while
   * displaying a name the signature never covered.
   */
  approver: string | null;
  /** When the studio recorded the grant, only when attested. */
  grantedAt: string | null;
  reasonKind: UnattestedReason | null;
}

const NONE: VerifiedGrant = { provenance: 'none', approver: null, grantedAt: null, reasonKind: null };

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
  repo: string,
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

  const no = (reasonKind: UnattestedReason): VerifiedGrant =>
    ({ provenance: 'unattested', approver: null, grantedAt: null, reasonKind });

  if (!secret) return no('no-studio-secret');
  if (!approver) return no('no-approver');
  if (!attestation) return no('no-signature');
  if (!proposalSha) return no('proposal-unreadable');
  // No `pinned &&` short-circuit: the executor rejects a grant with no proposal_sha outright
  // (executor.mjs attestationValid), and a verifier that is laxer than the enforcer is a divergence
  // waiting to rot.
  if (pinned !== proposalSha) return no('proposal-changed');

  // ONE implementation of the formula, shared with the signer. Re-deriving it here is how the
  // verifier and the signer drift apart while CI stays green.
  const canonical = approver.toLowerCase();
  if (!equal(attestation, attestationFor(repo, id, proposalSha, canonical, secret))) return no('bad-signature');
  return { provenance: 'attested', approver: canonical, grantedAt, reasonKind: null };
}

/**
 * The founder-facing line, with a NEXT STEP.
 *
 * Every lane read-failure on the board gets an explicit "Next step:" (VentureBoard's
 * `laneErrorNextStep`); the highest-stakes surface in the product had none. The responses genuinely
 * differ — a changed proposal is a re-read and re-approve, a bad signature is an incident to escalate,
 * and a missing studio secret is our own misconfiguration where the send may still go out.
 *
 * No implementation words: not "attestation", not "executor". FB-024 established that the founder
 * sees plain English, and this is the one screen where being understood matters most.
 */
export function describeProvenance(grant: VerifiedGrant): { text: string; nextStep: string } | null {
  if (grant.provenance === 'none') return null;
  if (grant.provenance === 'attested') {
    const when = grant.grantedAt ? new Date(grant.grantedAt) : null;
    const on = when && !Number.isNaN(when.getTime()) ? ` on ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
    return { text: `Approved by ${grant.approver}${on}. The studio checked this approval and it holds.`, nextStep: '' };
  }
  switch (grant.reasonKind) {
    case 'proposal-changed':
      return {
        text: 'This was approved earlier, but what it would do has changed since. The earlier approval no longer covers it.',
        nextStep: 'Read the summary above — it is the current version — then approve again if it is still right.',
      };
    case 'bad-signature':
    case 'no-signature':
      return {
        text: 'This is recorded as approved, but the studio did not issue that approval. Nothing has been sent.',
        nextStep: 'Do not approve. Tell Bruntsfield — something with write access to this venture wrote a false approval.',
      };
    case 'no-approver':
      return {
        text: 'This is recorded as approved, but the record names nobody. Nothing has been sent.',
        nextStep: 'Do not approve. Tell Bruntsfield — this approval record is not trustworthy.',
      };
    case 'proposal-unreadable':
      return {
        text: 'The studio could not read what this action would do, so it cannot confirm the approval covers it.',
        nextStep: 'Do not approve. Tell Bruntsfield — this venture\u2019s approval records need a look.',
      };
    case 'no-studio-secret':
      // The one case where the promise "nothing will be sent" would be FALSE: the studio cannot
      // verify while the executor may hold a working secret, so a real approval can still execute.
      return {
        text: 'This studio is not set up to check approvals yet, so it cannot tell you whether this one is genuine — and an action approved here may still go out.',
        nextStep: 'An admin needs to finish setting up approvals before you rely on this screen.',
      };
    default:
      return { text: 'The studio cannot confirm this approval.', nextStep: 'Do not approve until Bruntsfield has looked at it.' };
  }
}

/**
 * A refusal the studio can prove a human made (FB-183).
 *
 * Verified exactly as a grant is, and for the same reason: `refusal.json` lives on a ref the
 * proposing lane can write, so an unsigned one must never be able to close a decision the founder
 * never made. An unattested refusal is not a refusal — the approval stays waiting, which is the
 * safe direction to fail in: the worst case is a founder asked twice, not a send stopped by
 * something that was never a person.
 */
export interface ApprovalRefusal {
  /** The person who refused it, lower-cased. Never null: an unverified refusal is not returned. */
  refusedBy: string;
  at: string | null;
  /** Why. A refusal with no reason is a lane guessing, so the studio requires one. */
  note: string;
}

export function verifyRefusal(
  repo: string,
  id: string,
  proposalSha: string | null,
  refusal: unknown,
  secret: string | undefined,
): ApprovalRefusal | null {
  if (!refusal || typeof refusal !== 'object') return null;
  const r = refusal as { refused_by?: unknown; attestation?: unknown; proposal_sha?: unknown; refused_at?: unknown; note?: unknown };

  const by = typeof r.refused_by === 'string' ? r.refused_by.trim() : '';
  const attestation = typeof r.attestation === 'string' ? r.attestation : '';
  const pinned = typeof r.proposal_sha === 'string' ? r.proposal_sha : '';
  const note = typeof r.note === 'string' ? r.note.trim() : '';

  if (!secret || !by || !attestation || !proposalSha) return null;
  // Pinned to the proposal the founder was reading, same as a grant. A refusal of one document must
  // not close a different one that replaced it.
  if (pinned !== proposalSha) return null;
  const canonical = by.toLowerCase();
  if (!equal(attestation, refusalAttestationFor(repo, id, proposalSha, canonical, secret))) return null;

  return {
    refusedBy: canonical,
    at: typeof r.refused_at === 'string' && r.refused_at.trim() ? r.refused_at.trim() : null,
    note,
  };
}
