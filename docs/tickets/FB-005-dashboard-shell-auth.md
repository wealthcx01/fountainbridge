# FB-005 — Studio shell: Next.js app + Google OAuth (venture-scoped)

**Phase:** 1 · **Depends on:** FB-001, FB-003 · **Repo:** fountainbridge
**Branch:** `fb-005-studio-shell` · One ticket = one branch = one PR.

## Context
The Foundry Studio frame. Stack per D6: Next.js (Vercel/Supabase-aligned, mirroring Cofounder's managed stack). Auth per D4/D3: **Google OAuth** — the Holy Corner pattern is separate vertical login sites behind Google, and founders operate on their own Gmail identity, so venture scoping keys off the Gmail in the venture manifest from day one.

## Scope
- Next.js app scaffold; CI extended to build the app; Playwright UI-gate wired per the in-flight CI pattern (screenshot gallery on PR).
- Google OAuth sign-in; authorization from manifests: John's account → all ventures; a founder's Gmail (per `ventures/*.yaml`) → their venture only; anyone else → clean "not authorized" page.
- App shell: nav (Venture / Lanes / Attention / Activity placeholders), responsive skeleton, **branding aligned to grassmarket / the main Bruntsfield site** (pull the existing design tokens/theme rather than inventing one — reference grassmarket's brand assets in the PR).
- Server-side GitHub API client (org-scoped token via env; PAT vs GitHub App decision documented in the PR) with rate-limit-aware fetch wrapper — shared by FB-006/007/008.

## Out of scope
Real data views (FB-006…008); deploy (FB-009); ticket composer (Phase 3).

## Acceptance criteria
- [ ] John's Google account sees the all-ventures shell; a test founder account scoped to ARCA sees only ARCA; unlisted account refused — all three covered by Playwright tests.
- [ ] Branding visibly consistent with grassmarket (side-by-side screenshot in PR).
- [ ] UI-gate screenshots render in PR; CI green.

## Verification
/review + /qa + UI-gate gallery.
