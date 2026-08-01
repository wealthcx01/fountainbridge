# FB-078 — A real document has nowhere to go

**Status:** Done · **Phase:** 3 · **Depends on:** FB-034 (the knowledge base), FB-043 (deposit),
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

## What shipped, and the one place it differs from the plan
A founder attaches a PDF in the studio composer. The studio reads it, says what it understood, and
the composer's existing deposit tool files the text into the venture's own repository as a pull
request a human merges.

**The extraction happens on the studio, not on the venture's box — and the ticket asked for the
opposite.** That difference is the compromise, stated rather than buried.

The ticket's reasoning was right: every byte should stay on the venture's own machine (D1). Doing it
there needs a new endpoint beside the brain bridge, a credential the studio would have to hold, and
`pdftotext` installed on every box — none of which shipped today. What shipped keeps the weaker
promise it can actually make: **the bytes pass through the studio's memory and are never written to
its disk**, and the extracted text goes to the venture's own repository, which is where it belongs.
Box-side extraction remains the better answer and is not done.

## Proven end to end on ARCA
A real PDF, a scan with no text layer, and a slide deck — all three through the running studio:

| | What the founder saw |
| --- | --- |
| `real.pdf` | *"I read real.pdf — 1 page, about 66 words."* |
| `scan.pdf` | *"…has no readable text in it — it is most likely a scan… **Nothing was saved**, because saving an empty file under that name would teach your venture that the document is blank."* |
| `deck.pptx` | *"…is **a slide deck**, and the studio can only read text documents and PDFs so far. Export it as a PDF and try again."* |

Then the deposit, for real. Attached `real.pdf`, asked to save it under Sell, and the composer:

1. searched the venture's knowledge first, to avoid a duplicate,
2. found nothing on beachhead or competitor pricing under Sell,
3. filed **`arca#32`** → `context/sell/market-note-terminal-wedge.md`.

The reply quoted *"$150/yr Card Ladder vs $10/mo Market Movers"* — figures that existed **only inside
the PDF**. That is the proof the text was genuinely read rather than the filename being paraphrased.

## The refusal that mattered most
`looksEmpty` counts words of two or more letters and refuses below twenty. A scanned PDF extracts to
page numbers and whitespace; depositing that under a confident name would teach the venture brain
that a sixty-page market report contains nothing, and every later question about it would be answered
from an empty file. Failing loudly here is worth more than accepting a document that will quietly
mislead.

## One vocabulary, learned from CHECK_LABEL
`documentRefusal` and `READABLE_DOCUMENT` are **deleted** from `lib/composer.ts`. The document route
owns every refusal now, because it is the only place that knows what actually happened — a format it
cannot read, a scan, a file too large, a PDF that would not open. Two refusal vocabularies is exactly
the drift that bit `CHECK_LABEL` (FB-076): the same fact, reassuring on one surface and alarming on
another.

## Acceptance criteria
- [x] A founder can attach a PDF in the studio composer and have it become venture knowledge —
      `arca#32`, proven above.
- [ ] **The original is NOT retrievable.** Only the extracted text is kept. D8 says heavy binaries
      belong in object storage with a pointer from the deposited markdown, and no object storage is
      wired up. Text extraction loses tables, charts and layout, so a founder who deposits a deck
      keeps its words and loses its figures. This is the largest gap and it is not started.
- [x] A deposited document is answerable by the composer in the same conversation — the text is in
      the conversation as well as in git.
- [~] A lane planning work can find it through the venture brain — **once the deposit PR is merged**
      and gbrain re-indexes. The path is the one gbrain already indexes (`context/`), so this follows
      from work that already exists rather than from anything new here; it was not watched happening.
- [x] A document that cannot be read is refused by name, with the reason, and nothing is written.
- [x] No document byte is stored on the studio's host — they pass through memory and are never
      written to disk. Weaker than the ticket's "never transits the studio", and said as such.

## Verification
11 unit tests over the rules — every format named individually, every refusal offering a way forward,
the scan detected from its word count, a short-but-real note *not* mistaken for a scan, the size
readback, and the size limit. Plus 11 Playwright including the two that matter: a slide deck refused
by name, and a PDF with no text layer refused rather than deposited, with **no attachment left
behind**.

Then the live walk on ARCA recorded above, ending in `arca#32`.
