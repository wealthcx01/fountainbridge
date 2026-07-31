#!/usr/bin/env node
/**
 * Sign the e2e approval fixtures, so a "granted" fixture is granted the way a real one is.
 *
 * FB-051 made the studio verify the grant rather than trust the file: a grant.json with no valid
 * attestation stays `proposed`. That is right, and it means an unsigned fixture no longer represents
 * a granted action — it silently represents a proposal, which quietly changed every downstream
 * figure (FB-054's committed spend became queued spend). Fixtures now carry a real attestation over
 * the same message the executor verifies.
 *
 * The proposal sha is the one `fixtureApprovalSource` synthesises (`sha-<id>-proposal`), so the
 * signature is over exactly what the read path pins.
 *
 * Run: node scripts/sign-approval-fixtures.mjs   (or `make sign-approval-fixtures`)
 */
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Must match playwright.config.ts. Never a real secret — the e2e signs its own fixtures.
const SECRET = 'e2e-approval-secret-not-for-production';
const ROOT = 'e2e/fixtures/approvals';

/** Byte-identical to lib/approval-attestation.ts and the executor's expectedAttestation(). */
const attestationFor = (repo, id, proposalSha, approver) =>
  createHmac('sha256', SECRET)
    .update(`${repo}|${id}|${proposalSha}|${approver.trim().toLowerCase()}`)
    .digest('hex');

let signed = 0;
for (const repoDir of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  // The source keys the directory by repo with slashes doubled to underscores.
  const repo = repoDir.name.replace(/__/g, '/');
  for (const idDir of readdirSync(join(ROOT, repoDir.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const grantPath = join(ROOT, repoDir.name, idDir.name, 'grant.json');
    if (!existsSync(grantPath)) continue;
    const grant = JSON.parse(readFileSync(grantPath, 'utf8'));
    if (!grant.approver) throw new Error(`${grantPath}: a grant with no approver cannot be signed`);
    const proposalSha = `sha-${idDir.name}-proposal`;
    grant.proposal_sha = proposalSha;
    grant.attestation = attestationFor(repo, idDir.name, proposalSha, grant.approver);
    writeFileSync(grantPath, `${JSON.stringify(grant, null, 2)}\n`);
    signed += 1;
  }
}
console.log(`sign-approval-fixtures: signed ${signed} grant${signed === 1 ? '' : 's'}.`);
