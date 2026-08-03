# FB-093 — Launch what you are building

**Status:** In review · **Phase:** 3 (founder experience) · **Asked for by:** John, 2026-08-03 —
*"Can we add a button, so the founder can launch the product they are building? … for marketing and
ops perhaps different services would be launched (email or whatever - we can define later)."* ·
**Repo:** fountainbridge · **Branch:** `fb-093-launch-what-you-are-building` ·
One ticket = one branch = one PR.

## The gap

The studio shows a founder everything *about* their product — tickets, lanes, approvals, budgets,
run reports — and no way to open the product itself. The thing all of that work exists to produce
is the one thing the board has no door to. A founder who wants to see what shipped has to remember
a URL, which is exactly the kind of seam Cofounder does not have.

## The shape: a target per surface, from the manifest

The request itself says the target differs by department — Build opens the app, Sell might open
the marketing site or the email tool, Scale an ops dashboard — *"we can define later."* That is
venture-as-config (CLAUDE.md #5) speaking in product terms, and the mechanism ships now while every
target stays definable later, per venture, per surface:

- Each manifest department gains an optional **`launch:`** block — `url` (http(s) only) and an
  optional `label`. The `Department` contract in the vendored `schema/Venture.schema.json` gains
  the field.
- Each **provisioned** surface card on the venture board renders its launch button when a target
  is defined — new tab, `rel="noopener noreferrer"`, for the FB-065/FB-086 reason: it is a
  different application, and replacing the board is the "no way back" problem.
- A provisioned surface with **no** target says so honestly (FB-066): *"Nowhere to open yet — when
  this surface has something running (the app, the site, a service), its door appears here."*
  An unprovisioned surface just says "coming", as before — one absence, one explanation.

Nothing venture-specific enters the studio core: the studio renders whatever the manifest declares.

## The href rule, twice

`launch.url` becomes an `<a href>`. Both the schema (`pattern: ^https?://`) and the loader
(`toLaunch`) refuse anything that is not http(s) — a manifest that somehow skipped validation must
still never put a `javascript:` scheme into the DOM. The broken-manifest fixture now carries
exactly that defect, and the validator self-test asserts it is named in the failure.

## Why ARCA ships with the empty state, not a button

ARCA's terminal runs on its box, but **no public hostname for it resolves** — checked, not assumed:
`arca.`, `app.arca.` and `www.arca.bruntsfield.capital` all fail DNS; only `chat.` exists. The repo
declares no homepage either. So the honest configuration for ARCA today is *no* launch target, and
the board saying "nowhere to open yet" is the truth. The manifest carries a comment marking exactly
where the URL goes the day the app gets its hostname — a one-line, validation-checked change.

The tests are written to keep this honest in both directions: a unit test builds a temp manifest to
prove parsing, labelling, and the scheme refusal; a second asserts every *real* manifest currently
reads `launch: null` — with instructions to flip it, and the e2e assertion, the day a real target
lands. The e2e proves the pending state renders on ARCA's board and that no launch button does.

## Explicitly NOT in this pull request

- **Defining the real targets.** John's words: *"we can define later."* Build/Sell/Scale URLs are
  per-venture manifest edits when each surface has something running.
- **A per-ticket launch affordance.** The ask mentioned "per ticket"; the ticket drawer and work
  pages could carry the owning surface's launch button so a founder reads a change and opens the
  app in one motion. Do it once a real target exists to click — dead affordances first is how
  FB-066's empty-state work gets undone.
- **Upstreaming the contract change.** The vendored schema is pinned to bcap-contracts 0.1.0; the
  `launch` field must land in the bcap-contracts `Department` model (that repo's lane) and be
  re-vendored here on the next pin bump (non-negotiable 7 — flagged, not silently skipped).
- **A public hostname for ARCA's app.** Box/DNS work, its own ticket.

## Acceptance criteria

- [x] A manifest department may declare `launch: {url, label?}`; all manifests still validate.
- [x] A `javascript:` (or any non-http(s)) URL is rejected by the schema AND ignored by the loader.
- [x] A provisioned surface with a target renders the button (new tab, noopener); with no target,
      the plain-language empty state; unprovisioned surfaces are unchanged.
- [x] Nothing venture-specific is hard-coded in the studio.
- [x] The bcap-contracts follow-up is named.

## Verification

Manifest validator self-test green (5 signals, `launch` included). Unit suite green — parsing,
label default, scheme refusal, and the all-real-manifests-null guard. E2e: ARCA's board shows the
pending state and no button. Lint, typecheck, design-lint clean.
