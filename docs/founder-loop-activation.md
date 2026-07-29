# Activating the founder loop — what John does, and why

The composer→lane→gate→execute loop is built. Three things turn it fully live. Each explained plainly,
with exactly what you do.

## 1. Model auth ladder (LibreChat on API → lanes on Claude Max → API fallback)

Decided (John): **the LibreChat composer runs on the Anthropic API key** (already set on the box, done).
**The box's agent lanes run on your Claude Max** (preferred — no per-use cost); if Max ever hits rate
limits or a ToS snag, we **fall back to the API key** (already present as the fallback).

**What you do — get me the Max token (one-time):**
1. On a machine where Claude Code is installed and you're **logged in with your Max subscription**, run:
   `claude setup-token`
2. It opens a browser to authorise, then prints a long-lived token (starts `sk-ant-oat...`). Copy it.
3. Give it to me. I set `CLAUDE_CODE_OAUTH_TOKEN=<token>` in `/opt/foundry/lane/lane.env` on the venture
   box, remove the API key from the lane's env, and restart the lane. Lanes now run on your Max.
4. If Max misbehaves later, I flip the lane back to `ANTHROPIC_API_KEY` in one line — nothing else changes.

(The composer stays on the API key regardless — LibreChat is a third-party app and can't use a Max login.)

## 2. In-studio approvals — two Railway variables (what they are)

These turn the **Approve button** in the studio from "not set up yet" into a live, unforgeable gate.

- **`FOUNDRY_APPROVAL_SECRET`** — a shared secret that makes an approval *unforgeable*. When you click
  Approve, the studio signs the grant with this secret (an HMAC); the venture's executor re-checks the
  signature with the **same** secret before it acts. **An agent lane never has this secret**, so a
  runaway agent can't approve its own external action. It must be **identical** on the studio and on
  each venture's executor.
  - **What you do:** I'll generate one (`openssl rand -hex 32`) and give it to you; you paste it into
    Railway (below); I set the identical value on the executor. (Or you generate it and share it — same
    result. Never put it on a lane box.)

- **`STUDIO_APPROVAL_GITHUB_TOKEN`** — a **write-scoped** GitHub token the studio uses to record your
  approval (write `grant.json`). The studio's normal GitHub access is **read-only** on purpose; this is
  the one narrow write path, used only when a human approves.
  - **What you do:** create a fine-grained PAT (or reuse the venture write PAT) with **Contents: write +
    Pull requests: write** on the venture repos, and set it in Railway.

**Where you set Railway vars:** Railway dashboard → the **foundry-studio** project → **Variables** → add
the two above (same place you set `GITHUB_APP_*` and `GOOGLE_CLIENT_*`). Then redeploy. That's it — the
Approve button goes live; the attestation compatibility is already proven by a pinned test.

## 3. bcap-contracts — what it is, and what it's blocking

**bcap-contracts** is the shared **type package** every Bruntsfield studio uses so they all describe the
same entities the same way: Pydantic v2 models → JSON Schema → generated TypeScript. grassmarket and
Holy Corner already consume it; fountainbridge validates its venture manifests against its `Venture`
schema today. It lives in **its own repo/lane** (the FB-002 lane), **not** in fountainbridge.

Right now the studio renders `Venture`/`Lane`/`Ticket` with partly hand-written types, and the new
entities the loop produces — **`RunReport`, `Department`, `Approval`** — don't exist in the package yet.
So **FB-042** (the RunReport contract + the founder brief + the studio activity strip) is **blocked**
until those types are added to bcap-contracts and published, then consumed here as generated TS.

**What's needed / the decision for you:** who works the bcap-contracts lane to add `RunReport` +
`Department` + `Approval` (Pydantic + schema + TS gen) and publish a version? If you point me at that
repo (and I have access), I can do it there as its own ticket/PR; otherwise it's a hand-off. Everything
else in the loop works without it — FB-042 just can't render typed run history until it lands.

---

**Nothing above blocks building more** (FB-041 etc. proceed). These three activate *going live* + the
Sell/Scale operational half. See `docs/founder-to-lane-execution.md` for the loop and the memory files
for the full FB-041…057 roadmap.
