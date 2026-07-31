# FB-065 — Bring the composer inside the studio

**Status:** Done · **Phase:** 3 · **Depends on:** FB-064 (close the loop first), FB-025/033 (the
composer as it exists) · **Repo:** fountainbridge (+ venture box) ·
**Branch:** `fb-065-composer-inside-the-studio` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Right now the most important thing you do — telling the studio what you want — happens in a different
application, on a different address, that looks like a different product. Because it is one.

## Context
Clicking the composer takes a founder from `foundry-studio…railway.app` to
`chat.arca.bruntsfield.capital`. They share no type, no colour, no header, no navigation. A founder
cannot tell they are still inside the thing they signed into, and the moment they want to check
something on their board they have to navigate back by hand.

The *behaviour* is right and hard-won: it asks one or two short questions, reads the work back in
plain English, waits for an explicit yes, and — since FB-062 — only says "filed" once the filing
actually returned. None of that changes here. What changes is where it lives.

This is deliberately ordered **after** FB-064. Closing the GitHub break is worth more than removing
the second product, and it is a great deal cheaper.

## The honest options
LibreChat is a whole application: auth, conversation storage, file uploads, RAG, MCP tool wiring. It
is not a component. Three ways to do this, and the ticket should pick one deliberately rather than
drift into the easiest:

1. **Embed it.** Frame LibreChat inside the studio shell with our header. Cheap, and it removes the
   navigation break — but the inner product still looks like itself, so it half-solves the problem.
2. **Re-skin it.** LibreChat supports custom branding and CSS. Better fidelity, still a second
   application underneath, and every upgrade risks the skin.
3. **Build the conversation surface in the studio** and keep LibreChat as the engine behind its API.
   Most work, and the only one that genuinely produces one product.

**Recommendation: (3) — and the research says it is better supported than we assumed.**

LibreChat ships an official **Agents API** for exactly this.

- `POST /api/agents/v1/chat/completions` — OpenAI-compatible, so a standard SDK works by changing
  `base_url`.
- `POST /api/agents/v1/responses` — their own format, with tool use and structured outputs built in.
- `GET /api/agents/v1/models` — lists the agents.

Auth is an API key generated in the UI once `remoteAgents` is enabled, or an OIDC bearer token for
machine-to-machine. Streaming is supported.

That matters. When I drove the composer during the ARCA dogfood I reverse-engineered the *internal*
route (`/api/agents/chat`, needing a browser User-Agent to get past a bot check and a hand-minted
JWT). Building a product on that would have been building on someone's private internals. The Agents
API is documented, versioned and intended for this — so option (3) stops being "the ambitious one"
and becomes the supported one.

**Confirmed on the box before building, not assumed:**

- **The Agents API is there.** LibreChat 0.8.7 ships `/api/agents/v1/chat/completions`,
  `/v1/responses` and `/v1/models`, gated behind `interface.remoteAgents.use` (off by default) plus
  an API key. Option (3) is the supported one.
- **File upload is NOT there.** Uploads are `requireJwtAuth`-only on LibreChat's own `/api/files`
  route — the Agents API does not expose them, and the studio deliberately holds no JWT secret for
  the box. So a document becomes text in the conversation and the composer's existing deposit tool
  files it. That covers what founders actually deposit (notes, research, positioning) and honestly
  does not cover a PDF or a deck; the surface says so rather than dropping the file.
- **There is no conversation id to thread by.** The API rejects a `conversation_id` it did not issue
  and never returns the one it generates, so the studio carries the transcript and sends it each
  turn — which is how an OpenAI-compatible API is meant to be used anyway.

## Scope
- One conversation surface inside the studio: send a message, see the reply, see what it did.
- **Tool calls are visible as actions, not hidden.** When it searches the venture's knowledge, files a
  ticket or saves a fact, the founder sees that happen — it is the evidence the thing is real, and it
  is what makes "filed" trustworthy after FB-062.
- File upload, since depositing a document is half of why the composer exists — **confirm first**
  whether the Agents API exposes it; if not, say so plainly in the ticket rather than discovering it
  mid-build.
- Conversation history, so a founder can return to a thread.
- The engine stays on the box. No venture content moves off it (D1).

## Out of scope
- Retiring LibreChat. It stays as the engine, and as the fallback while this is proven.
- The research agent (`Foundry Research`) — a second surface, once the first is right.

## Acceptance criteria
- [x] A founder can describe, refine and file a piece of work without leaving the studio shell.
- [x] Tool calls are visible; a filing shows the evidence it happened.
- [x] A document can be uploaded and deposited to the venture's knowledge — for text documents. A
      PDF or a deck is refused with a reason and somewhere else to put it, because the engine's
      upload route is one the studio has no credential for.
- [~] Past conversations are reachable — **in the browser they were written in.** The engine gives
      out no conversation id, so there is nothing to look a past thread up by. A returning founder
      finds their thread; a founder on a different laptop starts a new one, and their full history
      is still in LibreChat's own UI on the box.
- [x] Venture content never leaves the venture's box. The studio proxies and stores nothing; the
      transcript lives on the box and in the founder's browser.

## What driving the real thing changed
Three things were wrong that reading the format would never have caught.

**A tool call arrives with disagreeing indices.** The chunk carrying a call's `id` and `name` came
back as `index: 1`; every chunk carrying that same call's arguments came back as `index: 0`. Keying
by index — the obvious reading of the OpenAI format — splits one call into two, so the founder sees
an action that never happened. The reducer matches by index when it recognises one and falls back to
the newest call otherwise, and the UI gate replays a recorded stream with the real indices in it.

**The most important label was wrong.** The tool table guessed `file_ticket`; the box reports
`file_venture_ticket`. So the moment a founder's words became a real piece of work rendered as
"Working…" — the one action they most need to see, unnamed. Caught by filing a real ticket, not by a
test. The table now matches the five names the box actually reports.

**The reply is markdown.** A founder was reading `**held**` and `` `card_prices` `` literally — a
product showing its own plumbing. Rendered as spans now, deliberately as React nodes rather than
HTML, so nothing the model writes can become markup in a founder's browser.

## Verification
26 unit tests over the read model — where the engine lives, which key belongs to which venture, the
tool-call reducer against the real disagreeing indices, the SSE split-mid-JSON case, the document
rules — plus 7 Playwright over the surface, including the assertion that matters most: **no link on
the composer points at the box's own chat host.** That is the regression that would undo this ticket.

Then the full walk on ARCA, live, against the real box:

1. Board → **Tell the studio what you want** → the composer, at `/venture/arca/composer`.
2. "The price feed only refreshes cards someone already holds, so market-wide views are wrong."
3. It searched the venture's knowledge — visibly — found ARCA-24 already in progress, and refused to
   duplicate it, scoping a narrower fix instead.
4. "File it." → **it filed `wealthcx01/arca#24`**, *Refresh prices for the whole tradable market, not
   just held cards*, on branch `foundry/refresh-market-wide-prices`.

The address bar read `/venture/arca/composer` from the first click to the last. That is the ticket.
