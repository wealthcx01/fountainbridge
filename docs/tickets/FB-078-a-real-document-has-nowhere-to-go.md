# FB-078 — A real document has nowhere to go

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-034 (the knowledge base), FB-043 (deposit),
FB-050 (the venture brain), FB-065 (the composer inside the studio) · **Repo:** fountainbridge (+
venture box) · **Branch:** `fb-078-a-real-document-has-nowhere-to-go` ·
One ticket = one branch = one PR.

## Why this matters (for the founder)
The things a founder actually has are a deck, a market report, a spreadsheet of competitor pricing, a
signed term sheet, a PDF of someone else's research. Those are the raw material of a venture.

Try to give one to the studio and it says no. Only plain text gets in. So the corpus the whole system
is meant to reason from can only be built out of things a founder types.

## What was found
There are three stores, and they do not join up.

| Store | What goes in | How it gets there | Who can read it |
| --- | --- | --- | --- |
| `context/` + `library/` in the venture repo | markdown | the composer's `deposit` tool | the lanes, gbrain, a human |
| gbrain (the venture brain) | whatever is in git | indexing | the lanes, the composer |
| LibreChat's own RAG (`rag_api` + local embeddings) | uploaded files, including binaries | LibreChat's own upload screen | **only LibreChat's chat** |

The third one is the only place a real document can land, and it is the one place the rest of the
system cannot see. Meanwhile FB-065 moved the founder *out* of LibreChat's own screen and into the
studio — so the only route a binary had is now the route a founder is deliberately not being sent
down.

FB-065 shipped this honestly: a PDF is refused with a reason and somewhere else to put it. That was
the right call for one ticket. It is not a resting place.

The cause is a real constraint, not an oversight. LibreChat's Agents API — the documented interface
the studio talks to — has **no upload**. Uploads are a JWT-only route on LibreChat's own surface, and
the studio deliberately holds no JWT secret for the box, because holding one would mean the studio
could impersonate any founder on that machine. That constraint should stay.

## The shape of the answer
The document has to become text at some point, because that is what git stores, what gbrain indexes
and what a lane can read. The question is only *where* the conversion happens and *what is kept*.

- **On the studio**, in the proxy route. Simplest, but it puts venture documents through Railway,
  and it makes the studio responsible for parsing formats.
- **On the box**, behind a small endpoint beside the brain bridge. Keeps every byte on the venture's
  own machine (D1), which is the architecture's whole premise. Needs a new endpoint and a credential.
- **Through the deposit tool**, extended to accept a file rather than a string. It already writes to
  git and already opens a pull request a human merges, so the review path exists.

The third is closest to what already works, and the box is where the file should be turned into text.
The ticket should weigh these rather than assume.

## Scope
- **Accept the formats founders actually hold**: PDF, common office documents, CSV, images with text.
  Refuse anything else by name, with a reason.
- **Extract text on the venture's own box**, so the original never transits the studio's host.
- **Keep the original.** Text extraction loses tables, charts and layout. The original belongs in the
  venture's own storage with a pointer from the deposited markdown (D8 says heavy binaries live in
  object storage with pointers — this is that case).
- **One deposit, all three stores.** Text into `context/` or `library/` as a pull request; indexed by
  gbrain; and available to the composer's own search — so a founder who deposits a market report can
  ask about it in the next sentence.
- **Say what was understood.** After a deposit the composer should say what it read, how long it was,
  and what it will now know — not just "saved". A silent success on a 60-page PDF is indistinguishable
  from a failed extraction.
- **Refuse loudly and specifically.** A scanned PDF with no text layer must not deposit an empty file
  and call it done.

## Out of scope
- Retrieval quality, ranking, or chunking strategy — a separate concern once documents can get in.
- Moving off LibreChat's RAG for files already uploaded there.

## Acceptance criteria
- [ ] A founder can attach a PDF in the studio composer and have it become venture knowledge.
- [ ] The original is retrievable, not just the extracted text.
- [ ] A deposited document is answerable by the composer in the same conversation.
- [ ] A lane planning work can find it through the venture brain.
- [ ] A document that cannot be read is refused by name, with the reason, and nothing is written.
- [ ] No document byte is stored on the studio's host.

## Verification
`/review` + CI, then the real thing on ARCA: deposit a genuine multi-page PDF through the studio
composer, ask a question in the next message that can only be answered from inside it, and confirm the
answer is right. Then confirm a lane can find the same document through the venture brain, and that
the pull request into `context/` names the original.

Then the negative case: a scanned image-only PDF, which must be refused with an explanation rather
than deposited empty.
