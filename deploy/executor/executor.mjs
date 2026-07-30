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
//     produce a valid attestation → rejected. The attestation covers {id, proposal_sha, approver}, so
//     it also PINS the exact proposal approved (a post-grant proposal swap is rejected — TOCTOU).
//   - The studio endpoint that issues the attestation on human Approve is FB-046. performAction() is
//     a stub until real sends (Phase 4b); the executor's creds (not the lane's) run it then.
//
// Event-sourced on a dedicated `foundry-approvals` ref (git = the audit log):
//   approvals/<id>/proposal.json | grant.json {approver, proposal_sha, attestation} | execution.json
//
// Usage:  node executor.mjs        # one pass over pending grants
// Env: REPO, APPROVALS_REF (default foundry-approvals), EXECUTOR_GITHUB_TOKEN (REQUIRED, its own),
//      FOUNDRY_APPROVAL_SECRET (REQUIRED, shared studio↔executor, never on the lane box),
//      APPROVER_IDENTITIES (REQUIRED, comma-sep approver ids allowed to grant).

import { createHmac, timingSafeEqual } from 'node:crypto';

const REPO = process.env.REPO || 'wealthcx01/arca';
const REF = process.env.APPROVALS_REF || 'foundry-approvals';
const TOKEN = process.env.EXECUTOR_GITHUB_TOKEN || '';   // NO fallback to the lane token.
const SECRET = process.env.FOUNDRY_APPROVAL_SECRET || '';
const API = 'https://api.github.com';
const toSet = (v) => new Set((v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const APPROVER_IDS = toSet(process.env.APPROVER_IDENTITIES);
const ID_RE = /^[A-Za-z0-9._-]+$/;

// The attestation a legit grant must carry: HMAC-SHA256(secret, "<id>|<proposal_sha>|<approver>").
// The studio issues this on human Approve; the lane cannot (no secret).
function expectedAttestation(id, proposalSha, approver) {
  return createHmac('sha256', SECRET).update(`${id}|${proposalSha}|${approver}`).digest('hex');
}
function attestationValid(grant, id, proposalSha) {
  const approver = String(grant.approver || '').toLowerCase();
  if (!approver || !APPROVER_IDS.has(approver)) return { ok: false, reason: `grant approver '${approver || '(none)'}' is not an allowed approver` };
  if (grant.proposal_sha !== proposalSha) return { ok: false, reason: 'grant does not pin the current proposal (it was changed after approval, or never matched)' };
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

// --- FB-051: the append-only event log -----------------------------------------------------------
// The executor's outcome is the half of the audit record only it can write. Without these events the
// log has a hole exactly where the external action happened — "granted" with nothing after it.
//
// Best-effort by design: a failure to append must never stop, or double-run, a real send. The
// execution.json write remains the authority for control flow (it is what makes the run idempotent);
// events are the record. If an append fails the studio's bridge still derives the event from the
// file, so the log degrades in fidelity, never in truth.
async function readEventSeq(id) {
  const dir = await gh(`/repos/${REPO}/contents/approvals/${id}/events?ref=${encodeURIComponent(REF)}`).catch(() => null);
  if (!Array.isArray(dir)) return 0;
  return dir.reduce((max, e) => {
    const n = Number.parseInt(String(e.name ?? ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

async function appendEvent(id, type, actorId, data) {
  try {
    const seq = (await readEventSeq(id)) + 1;
    const event = {
      seq,
      type,
      at: new Date().toISOString(),
      actor: { kind: 'executor', id: actorId },
      causedBy: seq > 1 ? seq - 1 : null,
      data,
    };
    await writeJson(
      `approvals/${id}/events/${String(seq).padStart(4, '0')}-${type.replace('approval.', '')}.json`,
      event,
      `executor: event ${id}#${seq} ${type}`,
    );
  } catch (err) {
    log(`approval ${id}: could not append ${type} to the event log — ${err?.message ?? err}`);
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
  if (!v.ok) {
    log(`approval ${id}: REJECTED — ${v.reason}`);
    await writeJson(`approvals/${id}/execution.json`, { id, status: 'rejected', reason: v.reason, executed_at: new Date().toISOString() }, `executor: reject ${id}`);
    await appendEvent(id, 'approval.rejected', 'foundry-executor', { reason: v.reason });
    return 1;
  }

  // Intent-before-action (P1-5): record "executing" first so a crash can't cause a silent re-run.
  await writeJson(`approvals/${id}/execution.json`, { id, status: 'executing', approver: v.approver, started_at: new Date().toISOString() }, `executor: begin ${id}`);
  await appendEvent(id, 'approval.executing', 'foundry-executor', { approver: v.approver });
  log(`approval ${id}: attestation valid (approver ${v.approver}) — executing ${proposal.json.action_type}`);
  const result = await performAction(proposal.json);
  await writeJson(`approvals/${id}/execution.json`, { id, status: 'executed', action_type: proposal.json.action_type, approver: v.approver, result, executed_at: new Date().toISOString() }, `executor: execute ${id}`);
  await appendEvent(id, 'approval.executed', 'foundry-executor', { action_type: proposal.json.action_type, approver: v.approver, reason: result?.note, result });
  return 1;
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
