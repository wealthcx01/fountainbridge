# FB-027 — Motion & polish with Rive (hero + state transitions)

**Phase:** 1 (design polish) · **Depends on:** FB-021, FB-022, FB-023 (land the substance first) ·
**Repo:** fountainbridge
**Branch:** `fb-027-rive-motion-polish` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Small touches of motion make the studio feel alive and premium — a subtle "the machine running"
animation on the Foundry story page, and smooth transitions instead of hard jumps. It's the
polish that signals "this is a serious, well-made product." Deliberately last: substance before
shine.

## Context
Design polish, explicitly **gated behind the higher-priority tickets** (FB-021 boards must work,
FB-022 draft banners gone, FB-023 handbook surface up). We add motion with **Rive**, embedding
`.riv` assets via the **Rive web runtime** `@rive-app/react-canvas`. **Important:** the Rust CLI
at `github.com/George-RD/rive-rs-cli` is an **authoring/asset tool**, not a web-runtime
dependency — it must **never** be invoked at runtime or added as an app dependency. `.riv` files
are produced at authoring time and shipped as static assets.

## Scope
- Add `@rive-app/react-canvas` as the runtime dependency and a small wrapper component for
  embedding a `.riv` asset (respecting `prefers-reduced-motion`, lazy-loading, and a static
  fallback if the runtime/asset fails — non-negotiable 10: fail loud/graceful, never a blank box).
- **Hero visualisation:** a tasteful "the machine running" animation on the Foundry story page
  (`app/foundry/page.tsx`).
- **State transitions:** tasteful transitions on a small number of high-value interactions (e.g.
  board column / attention states) — restrained, not decorative noise.
- Ship the `.riv` asset(s) as static files under the app's asset path; keep bundle impact modest
  and note the size in the PR.
- Grassmarket branding / existing design tokens — do not invent a theme.

## Out of scope
- Any runtime use of the Rust CLI (`rive-rs-cli`) — authoring-only, not a dependency.
- A full motion-design system across every page (targeted hero + a few transitions).
- Blocking substance work — this ticket does not land before FB-021/022/023.

## Acceptance criteria
- [ ] `@rive-app/react-canvas` embeds a `.riv` hero on the Foundry story page.
- [ ] Motion respects `prefers-reduced-motion` and degrades to a static fallback on failure.
- [ ] No runtime dependency on `rive-rs-cli`; `.riv` assets are static.
- [ ] A small number of tasteful state transitions added; bundle-size impact noted and modest.
- [ ] Branding uses existing grassmarket tokens.

## Verification
/design-review + /review + /qa + UI-gate.
