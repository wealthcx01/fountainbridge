# FB-065 — Bring the composer inside the studio

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-064 (close the loop first), FB-025/033 (the
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
3. **Build the conversation surface in the studio** and keep LibreChat as the engine behind an API —
   we already drive exactly that API programmatically (`/api/agents/chat`), so it is proven. Most
   work, and the only one that genuinely produces one product.

**Recommendation: (3), scoped tightly** — one conversation view, the same agent, the same tools, the
same instructions. Not a LibreChat clone; the founder-facing subset.

## Scope
- One conversation surface inside the studio: send a message, see the reply, see what it did.
- **Tool calls are visible as actions, not hidden.** When it searches the venture's knowledge, files a
  ticket or saves a fact, the founder sees that happen — it is the evidence the thing is real, and it
  is what makes "filed" trustworthy after FB-062.
- File upload, since depositing a document is half of why the composer exists.
- Conversation history, so a founder can return to a thread.
- The engine stays on the box. No venture content moves off it (D1).

## Out of scope
- Retiring LibreChat. It stays as the engine, and as the fallback while this is proven.
- The research agent (`Foundry Research`) — a second surface, once the first is right.

## Acceptance criteria
- [ ] A founder can describe, refine and file a piece of work without leaving the studio shell.
- [ ] Tool calls are visible; a filing shows the evidence it happened.
- [ ] A document can be uploaded and deposited to the venture's knowledge.
- [ ] Past conversations are reachable.
- [ ] Venture content never leaves the venture's box.

## Verification
`/review` + CI, then the full walk on ARCA: describe → refine → file → accept (FB-064) → lane picks it
up, with no address bar change anywhere in it.
