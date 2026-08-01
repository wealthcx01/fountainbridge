// Foundry gated executor (FB-044) — the external-action safety keystone.
//
// External actions (email/sends/deploys/payments) NEVER run on the venture lane box (which holds no
// such creds). They run HERE, in a separate credential-holding component, and ONLY after a human
// approval. The executor reads git-backed approval events and, for each granted-but-unexecuted one,
// verifies the grant on an UNFORGEABLE signal before doing anything — so a runaway/hallucinating lane
// can propose an action but can never get it performed (design §8, F3/F4).
//
// THE TRUST MODEL (rebuilt after adversarial review):
//   - Fail CLOSED: no executor token, no shared attestation secret, or no approver allowlist → refuse.
//   - The lane can write ANY file to the repo (repo-write token) and set any git author/committer, so
//     authority CANNOT rest on file contents or git-commit identity. (Confirmed: GitHub does NOT sign
//     contents-API commits — they are `verified:false` — and `committer.login` is email-derived and
//     forgeable. So git-commit authorship is not a sound anchor.)
//   - The unforgeable signal is a **server-issued attestation**: the STUDIO (server-authoritative,
//     where a human approves via Google OAuth + the D7 matrix) signs the grant with an HMAC secret
//     (`FOUNDRY_APPROVAL_SECRET`) held ONLY by the studio (issuer) and this executor (verifier) —
//     NEVER on the lane box (which holds no secrets, §8). A lane can write a grant.json but cannot
//     produce a valid attestation → rejected. The attestation covers {repo, id, proposal_sha,
//     approver}, so it PINS the exact proposal approved (a post-grant swap is rejected — TOCTOU) and
//     the venture (a grant cannot be replayed from another repo — the sha alone is content-addressed).
//   - The studio endpoint that issues the attestation on human Approve is FB-046. performAction() is
//     a stub until real sends (Phase 4b); the executor's creds (not the lane's) run it then.
//
// Git-backed on a dedicated `foundry-approvals` ref:
//   approvals/<id>/proposal.json  ← the lane writes what it wants to do
//   approvals/<id>/grant.json     ← the STUDIO writes {repo, approver, proposal_sha, attestation}
//   approvals/<id>/execution.json ← this executor writes the outcome: executing | executed | failed
//                                   | rejected
//
// FB-071 restored the event log, on ground the lane cannot author. FB-051 had removed it because it
// lived on the VENTURE ref — a ref the proposing lane holds a write token for, so a lane could write
// `approval.granted` and the projection believed it. It now lives on a `foundry-activegraph` ref in
// the STUDIO's own repository, and every event is signed with the same secret this executor already
// verifies grants against. A lane can append bytes there; it cannot make them count.
//
// This executor writes ONLY what it did — action.executing / executed / failed. It never writes a
// grant. A grant is a human agreeing, and the studio's projection refuses `approval.granted` from
// any non-human actor precisely so that a compromised executor cannot manufacture consent.
//
// Usage:  node executor.mjs        # one pass over pending grants
// Env: REPO, APPROVALS_REF (default foundry-approvals), EXECUTOR_GITHUB_TOKEN (REQUIRED, its own),
//      FOUNDRY_APPROVAL_SECRET (REQUIRED, shared studio↔executor, never on the lane box),
//      APPROVER_IDENTITIES (REQUIRED, comma-sep approver ids allowed to grant),
//      ACTIVEGRAPH_REPO + VENTURE_ID (FB-071; the studio's repo + this venture's id). Without them
//      the executor still runs and still gates — it just cannot record the history, and says so.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { expectedAttestation as sharedAttestation, decideExecution, eventsForExecution, signEvent } from './executor-lib.mjs';

const REPO = process.env.REPO || 'wealthcx01/arca';
const REF = process.env.APPROVALS_REF || 'foundry-approvals';
const TOKEN = process.env.EXECUTOR_GITHUB_TOKEN || '';   // NO fallback to the lane token.
const SECRET = process.env.FOUNDRY_APPROVAL_SECRET || '';
const API = 'https://api.github.com';
const toSet = (v) => new Set((v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const AG_REPO = process.env.ACTIVEGRAPH_REPO || '';
const AG_REF = process.env.ACTIVEGRAPH_REF || 'foundry-activegraph';
const VENTURE_ID = process.env.VENTURE_ID || '';
const APPROVER_IDS = toSet(process.env.APPROVER_IDENTITIES);
const ID_RE = /^[A-Za-z0-9._-]+$/;

// The attestation a legit grant must carry:
//   HMAC-SHA256(secret, "<repo>|<id>|<proposal_sha>|<approver>")
// The studio issues this on human Approve; the lane cannot (no secret). The REPO is in the message
// because one secret serves every venture and a git blob sha is content-addressed — without it, a
// lane could copy another venture's proposal+grant pair into its own tree and have it verify.
// MUST stay byte-identical to attestationFor() in lib/approval-attestation.ts.
function expectedAttestation(id, proposalSha, approver) {
  return sharedAttestation(createHmac, SECRET, REPO, id, proposalSha, approver);
}
function attestationValid(grant, id, proposalSha) {
  const approver = String(grant.approver || '').toLowerCase();
  if (!approver || !APPROVER_IDS.has(approver)) return { ok: false, reason: `grant approver '${approver || '(none)'}' is not an allowed approver` };
  if (!grant.proposal_sha || grant.proposal_sha !== proposalSha) return { ok: false, reason: 'grant does not pin the current proposal (it was changed after approval, or never matched)' };
  const got = String(grant.attestation || '');
  const want = expectedAttestation(id, proposalSha, approver);
  const a = Buffer.from(got, 'utf8'); const b = Buffer.from(want, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'grant attestation is missing or invalid (not signed by the studio — a lane cannot forge it)' };
  return { ok: true, approver };
}

const log = (...a) => console.error('[executor]', ...a);

// gh(): returns parsed JSON; null ONLY on a definitive 404; THROWS on any other non-ok (so a
// transient error is never mistaken for "absent" — P1-3/4).
async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? {} : res.json();
}
async function readFile(path) {
  const r = await gh(`/repos/${REPO}/contents/${encodeURI(path)}?ref=${encodeURIComponent(REF)}`);
  if (!r || !r.content) return null;
  let json = null;
  try { json = JSON.parse(Buffer.from(r.content, 'base64').toString('utf8')); } catch { /* not json */ }
  return { json, sha: r.sha };
}
async function writeJson(path, obj, message) {
  const enc = `/repos/${REPO}/contents/${encodeURI(path)}`;
  const content = Buffer.from(JSON.stringify(obj, null, 2)).toString('base64');
  const existing = await gh(`${enc}?ref=${encodeURIComponent(REF)}`);
  let sha = existing && existing.sha;
  for (let attempt = 0; attempt < 4; attempt++) {
    const body = { message, branch: REF, content };
    if (sha) body.sha = sha;
    try {
      await gh(enc, { method: 'PUT', body: JSON.stringify(body) });
      return;
    } catch (e) {
      // Eventual consistency: the file exists but our sha lookup missed it (or was stale). Re-fetch
      // the current sha and retry rather than fail the write.
      if (!/\b(409|422)\b/.test(String(e.message))) throw e;
      const now = await gh(`${enc}?ref=${encodeURIComponent(REF)}`);
      sha = now && now.sha;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw new Error(`writeJson ${path}: gave up after conflict retries`);
}

// The actual external action. STUB until Phase 4b wires Postmark/Workspace HERE (executor-held creds,
// never the lane's). Must be idempotent per approval id when it becomes real.
async function performAction(proposal) {
  switch (proposal.action_type) {
    case 'send':
      return { performed: false, note: 'send stub — Phase 4b wires Postmark/Workspace here', recipient_class: proposal.compliance?.recipient_class };
    default:
      return { performed: false, note: `no executor wired for action_type '${proposal.action_type}' yet` };
  }
}

async function handleApproval(id) {
  if (!ID_RE.test(id)) { log(`skip malformed approval id ${JSON.stringify(id)}`); return 0; }
  const grant = await readFile(`approvals/${id}/grant.json`);
  if (!grant || !grant.json) return 0;                                   // not granted yet
  if (await readFile(`approvals/${id}/execution.json`)) return 0;        // already terminal
  const proposal = await readFile(`approvals/${id}/proposal.json`);
  if (!proposal || !proposal.json) { log(`approval ${id}: grant with no proposal — skipping`); return 0; }

  // Verify the studio-issued attestation (allowlisted approver + pins this exact proposal + valid
  // HMAC signature). A lane-written grant.json has no valid attestation → rejected.
  const v = attestationValid(grant.json, id, proposal.sha);
  if (v.ok) log(`approval ${id}: attestation valid (approver ${v.approver}) — executing ${proposal.json.action_type}`);
  else log(`approval ${id}: REJECTED — ${v.reason}`);

  // The decision is made by the shared, tested module — decideExecution returns the records to
  // persist, so a throw records `failed` and never `executed`.
  const records = await decideExecution({
    id,
    proposal: proposal.json,
    verify: v,
    performAction,
    now: new Date().toISOString(),
  });
  for (const record of records) {
    await writeJson(`approvals/${id}/execution.json`, record, `executor: ${record.status} ${id}`);
  }
  await recordHistory(id, records);
  return 1;
}

/**
 * Append what this executor just did to the ActiveGraph record (FB-071).
 *
 * Written to the STUDIO's repository, not this venture's — the point of the whole exercise. Never
 * fatal: the action already happened and the execution record is already written, so failing here
 * must not stop the pass or, worse, cause a retry that re-sends. It is logged loudly instead, which
 * is the honest reading of "the history is incomplete" versus "the send did not happen".
 */
async function recordHistory(id, records) {
  if (!AG_REPO || !VENTURE_ID) {
    log('activegraph: not configured (ACTIVEGRAPH_REPO / VENTURE_ID) — execution NOT recorded in the history for', id);
    return;
  }
  // Positions continue after the studio's proposed (1) and granted (2). Read what is there rather
  // than assuming: a re-run over the same approval must not collide with its own earlier events.
  let startSeq = 3;
  const dirPath = `activegraph/${VENTURE_ID}/${REPO.split('/').pop()}/${id}`;
  const listed = await ghRepo(AG_REPO, `/repos/${AG_REPO}/contents/${encodeURI(dirPath)}?ref=${encodeURIComponent(AG_REF)}`);
  if (Array.isArray(listed)) {
    const highest = listed.reduce((max, f) => {
      const m = String(f.name || '').match(/^(\d{4})-/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    startSeq = highest + 1;
  }

  const events = eventsForExecution({
    records, venture: VENTURE_ID, repo: REPO, id, startSeq, now: new Date().toISOString(),
  });
  for (const event of events) {
    const signed = { ...event, attestation: signEvent(createHmac, SECRET, event) };
    const path = `${dirPath}/${String(event.seq).padStart(4, '0')}-${event.type}.json`;
    try {
      await ghRepo(AG_REPO, `/repos/${AG_REPO}/contents/${encodeURI(path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `${event.type} ${VENTURE_ID}/${id} (executor)`,
          branch: AG_REF,
          content: Buffer.from(JSON.stringify(signed, null, 2)).toString('base64'),
        }),
      });
    } catch (err) {
      log('activegraph: could not record', event.type, 'for', id, '-', err?.message ?? err);
    }
  }
}

/** Same request shape as `gh`, against an explicitly-named repo (the studio's, for the history). */
async function ghRepo(repo, path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${repo}${path}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? {} : res.json();
}

async function main() {
  if (!TOKEN) { log('FAIL-CLOSED: EXECUTOR_GITHUB_TOKEN is not set (its own token, never the lane\'s)'); process.exit(2); }
  if (!SECRET) { log('FAIL-CLOSED: FOUNDRY_APPROVAL_SECRET is not set (shared studio↔executor; the lane must never hold it)'); process.exit(2); }
  if (APPROVER_IDS.size === 0) { log('FAIL-CLOSED: APPROVER_IDENTITIES is empty — no one is authorised to grant'); process.exit(2); }
  const dir = await gh(`/repos/${REPO}/contents/approvals?ref=${encodeURIComponent(REF)}`);
  if (!Array.isArray(dir)) { log('no approvals/ on', REF, '— nothing to do'); return; }
  let acted = 0;
  for (const entry of dir) {
    if (entry.type !== 'dir') continue;
    try { acted += await handleApproval(entry.name); }
    catch (e) { log(`approval ${entry.name}: error (${e.message}) — leaving for retry`); }
  }
  log(`done — ${acted} approval(s) processed`);
}
main().catch((e) => { log('fatal:', String(e)); process.exit(1); });
