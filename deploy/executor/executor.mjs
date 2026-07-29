// Foundry gated executor (FB-044) — the safety keystone.
//
// External actions (email/sends/deploys/payments) NEVER run on the venture lane box (which holds no
// such creds). They run HERE, in a separate component that holds those creds, and ONLY after a human
// approval. The executor reads git-backed approval events, and for each granted-but-unexecuted one it
// VERIFIES the grant was authored by a HUMAN APPROVER (not the agent lane) before doing anything —
// the structural guarantee that a runaway/hallucinating lane can't approve its own external action
// (design §8, F3). Event-sourced on a dedicated `foundry-approvals` ref (git = the audit log).
//
// Approval lifecycle (one dir per approval, on the approvals ref):
//   approvals/<id>/proposal.json   — written by a lane/composer proposing an external action (+ a
//                                     compliance record for sends: recipient class, lawful basis,
//                                     suppression check, frozen draft — E2 / research-gtm §5)
//   approvals/<id>/grant.json      — written by a HUMAN approver via the studio (the D7 matrix)
//   approvals/<id>/execution.json  — written HERE after the action runs (or a rejection)
//
// The grant's git COMMITTER identity is the trust anchor: a grant committed by the lane identity is
// REJECTED. (Full strength needs the lane to have its own machine identity distinct from the human
// approver — see the note in deploy/executor/README.md; today it is enforced by the lane's committed
// author email being on the deny list.)
//
// Usage:  node executor.mjs            # one pass over pending grants
// Env: REPO, APPROVALS_REF (default foundry-approvals), EXECUTOR_GITHUB_TOKEN (its own token),
//      LANE_IDENTITIES (comma-sep emails/logins to REJECT as grantors, default lane@bruntsfield.capital),
//      APPROVER_IDENTITIES (comma-sep human approver emails/logins to ACCEPT; empty = any non-lane human).

const REPO = process.env.REPO || 'wealthcx01/arca';
const REF = process.env.APPROVALS_REF || 'foundry-approvals';
const TOKEN = process.env.EXECUTOR_GITHUB_TOKEN || process.env.TICKET_GITHUB_TOKEN || '';
const API = 'https://api.github.com';
const LANE_IDS = new Set((process.env.LANE_IDENTITIES || 'lane@bruntsfield.capital').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const APPROVER_IDS = new Set((process.env.APPROVER_IDENTITIES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));

const log = (...a) => console.error('[executor]', ...a);

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return {};
  return res.json();
}
const readJson = async (path) => {
  const r = await gh(`/repos/${REPO}/contents/${path}?ref=${REF}`);
  if (!r || !r.content) return null;
  try { return JSON.parse(Buffer.from(r.content, 'base64').toString('utf8')); } catch { return null; }
};
async function writeJson(path, obj, message) {
  const existing = await gh(`/repos/${REPO}/contents/${path}?ref=${REF}`);
  const body = { message, content: Buffer.from(JSON.stringify(obj, null, 2)).toString('base64'), branch: REF };
  if (existing && existing.sha) body.sha = existing.sha;
  await gh(`/repos/${REPO}/contents/${encodeURI(path)}`, { method: 'PUT', body: JSON.stringify(body) });
}
// The committer identity of the latest commit that touched `path` on the ref.
async function grantAuthor(path) {
  const commits = await gh(`/repos/${REPO}/commits?path=${encodeURIComponent(path)}&sha=${REF}&per_page=1`);
  const c = Array.isArray(commits) ? commits[0] : null;
  if (!c) return null;
  return {
    email: (c.commit?.author?.email || '').toLowerCase(),
    name: c.commit?.author?.name || '',
    login: (c.author?.login || '').toLowerCase(),
  };
}
const isLane = (a) => a && (LANE_IDS.has(a.email) || LANE_IDS.has(a.login));
const isApprover = (a) => a && !isLane(a) && (APPROVER_IDS.size === 0 ? Boolean(a.email || a.login) : (APPROVER_IDS.has(a.email) || APPROVER_IDS.has(a.login)));

// The actual external action. STUB for now — no real sends exist until Phase 4b. When a `send`
// action is real, THIS is where the executor's Postmark/Workspace creds are used (never the lane's).
async function performAction(proposal) {
  switch (proposal.action_type) {
    case 'send':
      return { performed: false, note: 'send stub — Phase 4b wires Postmark/Workspace here (executor-held creds)', would_send_to: proposal.compliance?.recipient_class };
    default:
      return { performed: false, note: `no executor wired for action_type '${proposal.action_type}' yet` };
  }
}

async function main() {
  if (!TOKEN) { log('no EXECUTOR_GITHUB_TOKEN — refusing to run'); process.exit(2); }
  const dir = await gh(`/repos/${REPO}/contents/approvals?ref=${REF}`);
  if (!Array.isArray(dir)) { log('no approvals/ on', REF, '— nothing to do'); return; }
  let acted = 0;
  for (const entry of dir) {
    if (entry.type !== 'dir') continue;
    const id = entry.name;
    const grant = await readJson(`approvals/${id}/grant.json`);
    if (!grant) continue;                                   // not granted yet
    if (await readJson(`approvals/${id}/execution.json`)) continue;   // already handled
    const proposal = await readJson(`approvals/${id}/proposal.json`);
    if (!proposal) { log(`approval ${id}: grant with no proposal — skipping`); continue; }

    const author = await grantAuthor(`approvals/${id}/grant.json`);
    // STRUCTURAL GATE: a grant authored by the lane is a forgery — reject, never execute.
    if (!isApprover(author)) {
      const reason = isLane(author) ? 'grant was authored by the agent lane, not a human approver' : 'grant author is not a recognised human approver';
      log(`approval ${id}: REJECTED — ${reason} (author=${author?.email || author?.login || 'unknown'})`);
      await writeJson(`approvals/${id}/execution.json`, { id, status: 'rejected', reason, grant_author: author, executed_at: new Date().toISOString() }, `executor: reject ${id} (${reason})`);
      acted++;
      continue;
    }

    log(`approval ${id}: grant verified (human approver ${author.email || author.login}) — executing ${proposal.action_type}`);
    const result = await performAction(proposal);
    await writeJson(`approvals/${id}/execution.json`, { id, status: 'executed', action_type: proposal.action_type, grant_author: author, result, executed_at: new Date().toISOString() }, `executor: execute ${id}`);
    acted++;
  }
  log(`done — ${acted} approval(s) processed`);
}
main().catch((e) => { log('fatal:', String(e)); process.exit(1); });
