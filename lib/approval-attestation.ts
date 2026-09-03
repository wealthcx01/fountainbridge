/**
 * Approval attestation (FB-046) — the studio side of the FB-044 gate.
 *
 * When a human approves an external action in the studio, the server signs the grant with an HMAC
 * over {repo, approval id, proposal blob sha, approver}. The gated executor
 * (deploy/executor/executor.mjs) recomputes the same HMAC with the SHARED secret and refuses anything
 * that doesn't match — so a lane (which never holds the secret) cannot forge a grant.
 *
 * **The repo is in the signed message deliberately.** One secret serves every venture, and a git blob
 * sha is content-addressed — the same proposal bytes hash identically in any repository, and the
 * approval id is just a directory name a lane chooses. Without the repo, a lane on venture B that
 * could read venture A's approvals ref could copy A's proposal.json and grant.json into its own tree
 * and have the pair verify: a real signature, for an approval no human ever issued for that venture,
 * executed with venture B's credentials. No guard can catch that — only the signed message can.
 *
 * ⚠ There are THREE implementations of this formula and they must stay byte-identical:
 * `attestationFor()` here, `verifyGrant()` in lib/provenance.ts (which calls this one — keep it that
 * way), and `expectedAttestation()` in deploy/executor/executor.mjs. The compat test in
 * lib/__tests__/approval-attestation.test.ts pins a known vector; change the format and you change
 * the executor and the vector in the same commit.
 *
 * Server-only — the secret (FOUNDRY_APPROVAL_SECRET) must never reach the client or the lane box.
 */

import 'server-only';
import { createHmac } from 'node:crypto';
import type { VentureSummary } from './ventures';

export function attestationFor(
  repo: string,
  id: string,
  proposalSha: string,
  approver: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${repo}|${id}|${proposalSha}|${approver.trim().toLowerCase()}`)
    .digest('hex');
}

/** A department's gate — mirrors the manifest `departments[].gate`. */
export type DepartmentGate = 'pr' | 'activegraph' | 'tbd-fb012';

/**
 * Who may approve this department's external action, per the D7 approval matrix on the manifest.
 * External sends are a high-blast-radius change class (D3/D7) — routed to the matrix's
 * `high-blast-radius` approver (founder | bruntsfield | dual). Falls back to `founder` if the matrix
 * doesn't name it (a product-visible default), never to "anyone".
 */
export function approverRoleForDepartment(venture: VentureSummary, departmentId: string): 'founder' | 'bruntsfield' | 'dual' {
  const row = venture.approvalMatrix?.find((r) => r.changeClass === 'high-blast-radius');
  return row?.approver ?? 'founder';
}

/**
 * Is `email` authorised to grant for `role` on this venture? `founder` → the venture's founder email;
 * `bruntsfield` / `dual` → a studio admin (John / Bruntsfield). `dual` additionally needs the founder,
 * but v0 treats an admin as sufficient to *issue* the grant and records who; full dual-sign is a
 * follow-up. Deny by default.
 */
export function canApprove(
  email: string,
  role: 'founder' | 'bruntsfield' | 'dual',
  venture: VentureSummary,
  adminEmails: string[],
): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const isFounder = Boolean(venture.founderEmail && venture.founderEmail.toLowerCase() === e);
  const isAdmin = adminEmails.map((a) => a.toLowerCase()).includes(e);
  switch (role) {
    case 'founder':
      return isFounder || isAdmin; // an admin can always act; the founder owns product-visible changes
    case 'bruntsfield':
      return isAdmin;
    case 'dual':
      return isAdmin || isFounder; // v0: either party may issue; the grant records the approver
    default:
      return false;
  }
}

/**
 * The signature over a REFUSAL (FB-183).
 *
 * A separate formula from `attestationFor`, and separated by a literal `refused` in the signed
 * string rather than by convention. If the two shared a formula, a signed refusal and a signed
 * grant over the same proposal would be byte-identical — so a refusal file could be renamed to
 * `grant.json` and would verify as an approval to send. The word in the string is what stops one
 * decision being replayed as the other.
 */
export function refusalAttestationFor(
  repo: string,
  id: string,
  proposalSha: string,
  approver: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${repo}|${id}|${proposalSha}|refused|${approver.trim().toLowerCase()}`)
    .digest('hex');
}
