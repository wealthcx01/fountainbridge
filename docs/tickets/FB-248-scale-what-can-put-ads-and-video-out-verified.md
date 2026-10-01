# FB-248 — Scale: what can put ads, copy and video out to social networks, verified

**Status:** Research done — decisions needed from John · **Phase:** 4 · **Raised by:** John, 2026-10-01 ·
**Extends:** `docs/research-gtm.md` (ratified) · One ticket = one branch = one PR.

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
- [ ] John's decisions on accounts, the TikTok audit and the spending rule.

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
