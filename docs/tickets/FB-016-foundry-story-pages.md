# FB-016 — Foundry story pages (original copy)

**Phase:** 1 · **Depends on:** FB-005, FB-015 · **Repo:** fountainbridge
**Branch:** `fb-016-foundry-story` · One ticket = one branch = one PR.

## Context
Founder-facing pages that present Foundry — what it is, who it's for, the co-creation model, the
pitch — the narrative a strong founder-facing site carries, but **private** (post-login) per FB-015.
Purpose now: let John see the **layout and feel** filled with realistic content, so he can judge the
UI/UX and then write final copy.

## Copy is ORIGINAL — non-negotiable
All copy is **Bruntsfield's own words**, written from scratch, clearly marked **"DRAFT — replace in
UI/UX review."** We do **not** reproduce, paste, or reword cofounder.co's (or anyone's) copy — that
is their IP and lifting it (even "as placeholder") is infringement. cofounder.co is used only as a
*competitive reference* for which topics a page should cover, never as source text. Originality is a
review gate.

## Scope
- Page structure with the sections a founder-facing site expects (hero, value props / "why Foundry,"
  a short "how it works" teaser linking to FB-017, proof/credibility framing, a clear call to the
  studio), filled with **original draft copy** marked as placeholder.
- Rendered from `content/` markdown (git = source of truth), behind login, grassmarket branding,
  mobile-usable.

## Out of scope
Reproducing/rewording any third-party copy (forbidden). Public exposure (private, FB-015).

## Acceptance criteria
- [ ] Pages render the intended structure with realistic original draft copy, marked "DRAFT — replace."
- [ ] Originality check: no lifted/reworded third-party passages (reviewer sign-off).
- [ ] Behind login; mobile-usable.

## Verification
/review (incl. originality) + /qa + UI-gate.
