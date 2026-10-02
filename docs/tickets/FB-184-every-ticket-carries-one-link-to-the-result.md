# FB-184 — every ticket carries one link to where you can see the result

**Status:** Shipped in part · **Phase:** 3 · **Touches:** bcap-contracts · **Raised by:** Claude Design, 2026-09-02 ·
**Restated with exact copy, 2026-09-08 (R-04)**


> **Prior art, from FB-220 (block/buzz, declined 2026-09-25, revised 2026-09-29).** Buzz answers this
> ticket and FB-209 with one idea: **the branch owns the conversation.** A code branch automatically
> becomes a room, so the patches, the test result, the review and the merge decision all sit in one
> place, and that room becomes the record of why the code exists. Worth reading before designing the
> link this ticket adds — the answer may be that the link points at a branch-shaped thing rather than a
> pull request. We are not taking Buzz; we are taking the shape of its answer.

**Shipped in part:** the line is on every ticket, and every screen that offers a preview or a product link now opens it first. Still left: the `trace_url` field in bcap-contracts (another repository's change), and the commit count in the Build line.

## Every other "see it" link is checked too, 2026-10-02 (second pass)

**What was left.** Three places still drew a stored address as a link without opening it first: the
work page's "See this change running" and "Open the terminal" buttons, the cross-venture queue's
"see it running" tag, and each surface's door on the desk ("Open the terminal ↗" under Build).

**What changed.** All three now use the same check as the ticket's "Follow it to…" line, and draw a
link only when the address was opened and worked. When it did not open, the same place says why, in
the same words: *"Open the terminal: it did not open when the studio checked, because it is not
answering."* On the desk, Build's line also stops saying "preview of the app running" when its door
did not open. The queue checks each preview in the background, so the list never waits for one.

**A door can be on the venture's own domain.** A preview address comes from a commit status, which
anyone who can push to a venture repository can write, so the studio only ever opens addresses on
the four preview hosts. A surface's door comes from the venture's manifest in this repository, which
is reviewed, so it may be on any named https host — but never an IP address, `localhost`, or an
internal name. Those rules now live in `lib/preview-address.ts`.

**The UI gate can now see both halves.** The rig still never opens an address. It answers from
`e2e/fixtures/preview-checks.json`: one preview that opens, one that does not, and Build's door,
which opens. So the gate checks that a working link is drawn and a broken one is withheld, rather
than only ever seeing "not checked".

**Seen on ARCA's real data** (local build, as an admin): the two open pieces of work that have a
preview (ARCA-070 and ARCA-071) were opened by the studio, both work, and both show "see it running ↗".
Build's door opens.

## What shipped, 2026-10-02

**The line.** Every ticket now has one line, directly above "Your decision", in the design's weight
and colour, saying where to see the result:

- Build, preview opens: *"Follow it to the preview: running · see it ↗"*
- Build, preview reported but it did not open: *"Follow it to the preview: it did not open when the
  studio checked, because it is not answering"* (or "it opens a different site", "it keeps
  redirecting", "it could not be reached"). No link.
- Build, work but no preview: *"Follow it to the preview: none has been built for this work yet"*
- Sell (any ticket with a send): *"Follow it to your outbox: sent · open it →"*, or "draft, not sent",
  "tried, and it did not go", and so on. The link is the send's own page in the studio.
- Scale: *"Follow it to the ad account: not connected yet"*. No link.
- Nothing started: *"Nothing to follow yet"*

**Every preview is opened before it is linked.** The studio follows the address, and links to it
only if it lands on the same site with a working page. A sign-in page on the preview counts; a
redirect to the live site does not, nor does a 404. This is the same judgement as
`scripts/check-preview-link.mjs` (FB-243), from the same file, so the script and the studio cannot
disagree. Each address is checked at most once every five minutes, and only for the ticket that is
open. The UI gate never checks (it makes no live calls), so there every preview says "not checked
yet" and has no link.

**The trail reads the same check.** Its "A preview built and is running · see it running ↗" step now
appears only when that same check says the preview opens.

**Words changed from R-04.** The design says "Follow it to the VM: N commits · preview running".
"VM" is jargon a founder should not need (CLAUDE.md #12), so it says "the preview". The commit count
is left out, because the studio does not read it for open work yet.

**Checked on real previews.** Through the studio's own code: ARCA's pull request 92 preview
(`arca-arca-pr-92.up.railway.app`, merged and torn down) gives no link, "it is not answering". This
studio's own pull request 335 preview opens (it redirects to its own sign-in page) and gets a link.
ARCA's three open pull requests were all opened before FB-230 fixed preview builds, so none has a
preview; their tickets correctly say "none has been built for this work yet".

## What was asked for

> "That's the trail's terminal hop, made a first-class field. Every ticket carries one resolvable
> inspection URL by surface: Build → the running preview, deep-linked to the changed part where
> possible; Sell → the outbox/campaign view for that send; Scale → the ad suite once connected,
> honestly absent until then. Concretely: add `trace_url` to the ticket schema (or have the trail
> endpoint resolve it) so the 'Follow it to…' line and the ticket detail's ↗ always point somewhere
> real — **and never render the link when it can't resolve (no dead UI).**"

## The line, exactly (R-04, 2026-09-08)

The second review named the placement and the words, and marked rule 5 **Partly** held because of
them — *"the trail hops carry links and 'Read exactly what was built →' reaches the work page. The one
line the design puts above the decision is not rendered."*

> One line, 13px sans 600 accent, **directly above "Your decision"**:
>
> - Build → *"Follow it to the VM: N commits · preview running ↗"*
> - Sell → *"Follow it to your outbox: draft, not sent ↗"*
> - Scale → *"Follow it to the ad account: not connected"*
> - unstarted → *"Nothing to follow yet"*
>
> **Render nothing when the link cannot be formed.**
>
> Where: `components/TicketsView.tsx` (Detail) · `lib/trail.ts`

## Why it matters

A founder's question at the end of a piece of work is not "was it merged", it is **"can I see it?"**.
The studio currently answers that inconsistently: FB-132's trail has a terminal hop for some tickets,
the surface cards have a launch link when the surface has one, and the ticket detail has a link to
the code host — which is the one place a founder should not have to go.

One field, resolved once, used everywhere those three currently disagree.

## The constraint that shapes it

**Never render the link when it cannot resolve.** A "see it running ↗" that 404s is worse than no
link: it teaches a founder that the studio's promises are decorative. The field is therefore nullable
by design, and the absence has its own words — *"not connected yet"* — which is the same degraded
rule the surface cards already follow.

## Scope

- Add `trace_url` (nullable) to the Ticket entity **in bcap-contracts** — non-negotiable 7: schema
  changes happen there and are consumed here as generated types. This is the part that needs
  sequencing with that repo's lane, and is why this is its own ticket rather than a line in another.
- Resolve it per surface: Build from the venture's running preview (deep-linked to the changed route
  where the trail knows one), Sell from the send's outbox reference (FB-142 already builds one),
  Scale absent until an ad account is connected.
- Use it in three places that currently answer differently: the trail's terminal hop, the ticket
  detail's ↗, and the surface card's door.
- Prove resolvability before rendering. A stored URL is a claim; the studio should not repeat a claim
  it has not checked.

## Acceptance criteria

- [x] A Build ticket whose work is deployed links to the running preview.
      *(Only after the preview is opened and found working. Proven on a live Railway preview through
      the studio's own check; no ARCA ticket has a live preview today to show it on screen.)*
- [x] A Sell ticket whose send went out links to that send.
      *(Unit-tested on ARCA's real shape: sends proposed from the Build repository, naming Sell.)*
- [x] A Scale ticket says "not connected yet" and renders no link.
- [x] No `trace_url` is rendered as a link without being resolvable.
      *(Read as "no result link": the field itself is not in bcap-contracts yet. Every place that
      offers a preview or a product link — the ticket line, the trail, the work page, the queue and
      the desk's doors — opens it first. A test reads every screen and fails if one links a stored
      preview or door address directly.)*
- [ ] The trail, the ticket detail and the surface card all read the same field.
      *(They read the same check and say the same words, but there is no single field yet: that
      waits on `trace_url` in bcap-contracts.)*
