# FB-248 — Scale: what can put ads, copy and video out to social networks, verified

**Status:** Shipped in part — Meta reporting built, not connected · **Phase:** 4 · **Raised by:** John, 2026-10-01 ·
**Extends:** `docs/research-gtm.md` (ratified) · One ticket = one branch = one PR.

**Shipped in part:** the read-only Meta reporting page is built and tested against Meta's own data shape, but it is not connected to anything — ARCA has no Meta ad account yet. Still to do: connect a real account and check its data against the shape built here, and the gated path for starting a campaign (after FB-171).

## The question

> *"I want work done to see what other MCP or other integrations there are for Meta Studio, Tik Tok or
> Google for putting ads, copy and videos out to social networks for pushing the product and trying to
> grow it."*

The ratified GTM research (`docs/research-gtm.md`, 2026-07-20) covered **email and LinkedIn**. It did not
cover **paid ads or video platforms**. This is that half.

## How this was checked

This area changes monthly and most search results are vendor blogs selling a connector. So every row
below says **how it was verified**, and nothing is stated more firmly than its evidence allows:

- **Primary** — the platform's own docs, repository or live endpoint, checked on 2026-10-01.
- **Secondary** — consistent across several independent sources, but not seen at the source.
- **Unverified** — sources disagree, so nothing is claimed.

## What exists

| platform | official MCP? | can it write? | how verified |
| --- | --- | --- | --- |
| **Meta** — Facebook & Instagram ads | **Yes.** `mcp.facebook.com/ads`, in beta | **Yes** — creates campaigns | **Primary:** the endpoint answers an MCP handshake with `401 Authentication Required`. Launch date (29 Apr 2026) and tool count (29) are secondary. |
| **Google Ads** | **Yes.** `googleads/google-ads-mcp`, Apache-2.0 | **No — read-only** | **Primary:** its own README lists `search`, `get_resource_metadata`, `list_accessible_customers`. Nothing mutates. |
| **TikTok ads** | **No** | third-party servers only | **Primary:** no repository in TikTok's GitHub organisations. Community servers exist. |
| **TikTok posting** (organic) | No MCP; an **official Content Posting API** | **Yes — but private-only until audited** | **Primary:** TikTok's docs, quoted below. |
| **YouTube** | **No** | official Data API v3; community MCPs | Secondary: several sources agree Google ships 50+ managed MCP servers and YouTube is not one. |
| **LinkedIn** | — | posting as a member only | **Primary, already ratified:** `research-gtm.md` §4 checked LinkedIn's own docs. |
| **Ayrshare** (13+ networks at once) | community MCP over a paid API | yes | Secondary. **Not official.** |

### The TikTok restriction, in TikTok's own words

From TikTok's Direct Post reference:

> All content posted by unaudited clients will be restricted to private viewing mode.

> Once you have successfully tested your integration, to lift the restriction on content visibility,
> your API client must undergo an audit to verify compliance with our Terms of Service.

Plus a per-user daily post cap, a cap on active publishing users per app, and 6 requests a minute per
token. **The audit is the long pole.** A Foundry that wants to post to TikTok publicly needs a TikTok
developer app, submitted and passed — and until then everything it posts is visible only to the
account that posted it, with no error to say so.

## The one thing that matters more than any row in that table

**Meta's official MCP can create campaigns. A campaign spends money.**

That makes it the highest-blast-radius external action this studio has ever been offered. An agent
holding write access to an ad account can commit a founder's budget in one tool call, and the MCP is
explicitly OAuth-gated "read and write access from day one".

Non-negotiable 4 already decides this, and D7 sharpens it: spend is a payment, and payments are
**dual-approve**. So:

- **Read tools can be wired directly.** Reporting on what is running, what it cost and what it returned
  is information, not action — the same as every other read in the studio.
- **Write tools must never be in an agent's hands.** The agent drafts a campaign as a **proposal** —
  audience, creative, daily cap, total cap, end date, stated in money — and the gated executor (FB-051)
  makes the call only after the recorded approval exists. The agent never holds the token that spends.

Google's being read-only is, for once, the helpful limitation: it cannot be the thing that spends.

## How it fits the ratified research

The ratified research de-scoped cold outreach entirely: *"agents email only flagged interest (ad
responses, waitlist, signups, enquiries)"*. **Ads are where that interest comes from.** Somebody who
clicks an ad and leaves an email has given the consent that makes the rest of the funnel lawful under
PECR.

So paid ads are not a separate growth channel bolted on. They are **the top of the only outreach funnel
the Foundry is allowed to run**, and the integrations above are how a venture fills it.

## Recommended order

1. **Read everything, first.** Google Ads (read-only by design) and Meta's read tools: a venture's ad
   reporting on its Scale surface. No risk, immediate value, and it builds the habit of looking.
2. **Meta write, behind the gate.** The only official write-capable ads MCP. Proposals drafted by the
   lane, spend stated in pounds, dual-approved, executed by the gate.
3. **Start the TikTok audit now**, before it is needed. The lead time is the platform's, not ours.
4. **YouTube**: a thin gated tool over the official Data API rather than a community server. A
   community MCP with write access to a channel is someone else's code holding the founder's channel.
5. **Ayrshare last, if at all.** One token that posts to thirteen networks is one credential whose
   compromise posts everywhere — the opposite of the per-venture, per-scope tokens this studio uses.

## And the same rule as the promo video

John, on FB-233: *"a promo video would go after a product is built."* **Ads are the same.** Spending
money to promote a product that does not exist yet buys clicks to nothing.

So the **integrations** can be built now — the reporting, the proposal shape, the gate, the audit. The
**spend** waits for a product. That is not a separate rule; it is the same one.

## What needs John

- **Accounts.** A Meta Business account and ad account per venture; a Google Ads account (and a
  developer token, which Google issues on application); a TikTok for Business developer app. None of
  these exist for ARCA yet, and only the account holder can create them.
- **Whether to start the TikTok audit now.** It has lead time and costs nothing to begin.
- **A spending rule.** The gate needs a number: the largest daily cap a founder may approve alone before
  it becomes a dual approval. D7 says payments are dual-approve; it does not say whether *every* ad
  spend is.

## Nothing has been installed, connected or signed in to

This is research. No account was created, no token issued, no endpoint authenticated against. The one
live request made was an unauthenticated handshake to Meta's endpoint, to confirm it exists — it
returned `401`, as it should.

## Acceptance criteria

- [x] Meta, TikTok and Google each answered: official MCP or not, read or write, and how verified.
- [x] Every claim marked primary, secondary or unverified, and nothing stated past its evidence.
- [x] The spend risk named, and placed under non-negotiable 4 and D7 rather than left implicit.
- [x] Fitted to the ratified GTM research rather than contradicting it.
- [x] John's decision on which platform first: **Meta.** Accounts and the spending rule are still his.

## Sources

Primary: [Meta Ads MCP endpoint](https://mcp.facebook.com/ads) (live handshake) ·
[googleads/google-ads-mcp](https://github.com/googleads/google-ads-mcp) ·
[TikTok Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) ·
[TikTok Content Posting API](https://developers.tiktok.com/products/content-posting-api/) ·
`docs/research-gtm.md` §4 (LinkedIn, ratified).

Secondary, held to lower confidence: [Adspirer — Meta Ads MCP](https://www.adspirer.com/blog/meta-ads-mcp) ·
[usecarly — Meta Ads MCP](https://www.usecarly.com/blog/meta-ads-mcp/) ·
[Search Engine Land — Google ads MCP](https://searchengineland.com/google-open-sources-ads-api-mcp-server-463219) ·
[usecarly — YouTube MCP](https://www.usecarly.com/blog/youtube-mcp/) ·
[AdsMCP TikTok server](https://github.com/AdsMCP/tiktok-ads-mcp-server) ·
[Ayrshare](https://www.ayrshare.com/).


## RULED by John, 2026-10-01: Meta first

> *"Let's start with just Meta as they have both official AI connector and post/spend. We can build to
> the other platforms later."*

So the order above collapses to Meta alone, for now:

1. **Read first.** Meta's reporting tools on the Scale surface — what is running, what it cost, what
   it returned. Information, not action.
2. **Write behind the gate.** Campaign proposals drafted by the lane with the spend stated in pounds,
   approved, then executed by the gate. The agent never holds the token that spends.

Google, TikTok and YouTube wait. The TikTok audit is **not** started.

**Still needs John before any of this can run:** a Meta Business account and an ad account for ARCA,
and the largest daily budget a founder may approve alone. And the rule from the promo video holds —
the plumbing can be built now; **spend waits for a product.**

**Worth checking first:** FB-171 found that the approval gate is named after ActiveGraph while
ActiveGraph is not what is running. Meta is the first integration that can spend money, so the gate it
sits behind should be verified as real before it is trusted with a budget.


## What was built (FB-248, read-only slice, 2026-10-02)

**What happened.** The first half of the ruling — read first — is built. ARCA's Scale surface now
says "Meta ads · not connected yet" on the desk, with a link to a new page, **Your ads on Meta**
(`/venture/arca/ads`). The page says what is running, what it cost and what it brought back.

**What it means.** There is no Meta ad account for ARCA, so the page cannot show ARCA's ads. It says
so first, in the attention colour: *"Not connected. ARCA has no Meta ad account yet, so nothing on this
page is ARCA's."* Below that is an example inside a dashed frame headed *"Example · made-up figures,
not ARCA's"*, so a founder can see what connecting it would give them. Nothing on the page can start,
change or pay for an ad.

**How it is built.**

- `ventures/arca.yaml` — Scale now declares `connectors: [meta-ads]`. That records John's ruling as
  ARCA's setup. It connects nothing.
- `lib/meta-ads.ts` — reads Meta's reporting into what a founder reads. The input is Meta's Marketing
  API shape, which its connector reports from: spend as a decimal string, budgets in pence as strings,
  results inside an `actions` list, every list paged. The rules it keeps:
  money is read as text into whole pence, never through a floating-point number; a lead is counted
  once (Meta reports `lead` and also its parts, and adding them would double it); results of
  different kinds are never added together; a spend it cannot read, or a row with no spend at all, is
  named and left out of the total, never counted as nothing; when Meta sends one row per day for a
  campaign, every row is added up (people reached cannot be added across days, so it is left out and
  the page says why); and if Meta had more to report than was read, the page says the totals are
  only part of the account.
- `lib/meta-ads-example.json` — the example: six campaigns plus one deleted after it spent, covering
  running, paused, ended, waiting for Meta's review, and flagged by Meta. It is shown to every venture
  that chooses Meta, so its campaigns are named for what any product does (a waitlist, a guide, a
  demo), not for what one venture sells.
- **On a phone the page is two presses away.** The phone desk keeps the surfaces block behind "See
  the whole desk"; the Scale column there carries "your ads on Meta →". Checked on a phone-sized
  screen, 2026-10-02.
- **There is no "connected" state in the code yet.** Adding one before a real account has ever been
  read would be a state nobody has seen.

**Not built, on purpose.** Any write or spend path. That waits for FB-171 to confirm the approval gate
is real.

### Acceptance criteria for this slice

- [x] A reporting read model over Meta's own reporting shape: what is running, what it cost, what it returned.
- [x] A Scale-surface view of it, reached from the desk's Scale column.
- [x] The screen says plainly, first, that it is not connected and that nothing on it is the venture's.
- [x] No write or spend path anywhere.
- [ ] Connected to a real Meta ad account and checked against what the connector actually returns. **Needs John** (see below).
- [ ] Campaign proposals behind the gate. Waits for FB-171.

### What John needs to do to connect it

1. Create a **Meta Business portfolio** (business.facebook.com) for ARCA, owned by a Bruntsfield
   account, not a personal one.
2. In it, create an **ad account** for ARCA, set to **GBP** and **Europe/London**, and add a payment
   method. (Nothing spends without a campaign; the payment method is needed for the account to exist.)
3. Create or connect a **Facebook Page** for ARCA. Meta will not run ads without one; an Instagram
   account is optional.
4. Decide **who signs in to Meta's connector.** It uses Meta Business sign-in (OAuth), and the studio
   should hold only a **read** grant (the `ads_read` permission) on ARCA's ad account. The permission
   to change ads (`ads_management`) must never be given to the studio or to the team; it belongs to
   the gated executor, later.
5. Tell us the **ad account id** (it looks like `act_` followed by numbers). It is not a secret, and
   it goes in ARCA's setup. The sign-in grant itself is a secret and lives on the studio's deployment,
   never in this repository.
6. Still open from the ruling: **the largest daily budget a founder may approve alone.**
