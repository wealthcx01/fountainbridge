# FB-106 — What has the venture been given?

**Status:** Done · **Phase:** 3 (D8 surface) · **Asked for by:** John, 2026-08-04 — *"nothing that
allows the founder to see what docs have been uploaded either to the composer or the studio? and
can we accept all file types? and how do we know the memory limit? can we upload all to the VM that
supports the Claude Max on that VM doing the work when new tickets are available?"* ·
**Repo:** fountainbridge · **Branch:** `fb-106-what-has-the-venture-been-given` ·
One ticket = one branch = one PR.

## Four questions, currently unanswerable in the studio

1. **What have I already given it?** Documents go in through the composer (FB-078/FB-084 deposit
   them into the venture's `context/` and `library/` on git) and then vanish from the founder's
   view. The corpus is real and growing — the walkthrough's brand-positioning note landed there —
   but the only way to see it is GitHub.
2. **What can I give it?** File-type support exists in code (FB-084: "any file into the corpus")
   and is documented nowhere a founder looks.
3. **How much can it hold?** There are real limits (per-document character caps in the composer,
   the box's disk — the vector store grows with every deposit, FB-085's sizing warning) and no
   surface states them.
4. **Does the team actually use it?** Yes — the lane and composer search the venture brain (the
   walkthrough watched the composer cite ARCA-19/20 from it) — but nothing SHOWS a founder that
   their uploads inform the work, which makes uploading feel like posting into a void.

## What ships

- **A "Knowledge" view per venture**: everything in `context/` and `library/`, read through the
  same GitHub read-path as tickets — name, department tag, when it arrived, who/what deposited it
  (composer, lane, or founder), one-click read in-studio. Server-side scoped like everything else.
- **Upload from the studio**, not only mid-conversation: the same deposit path the composer uses
  (the existing gated write path — no new writer), so a founder can hand over a pitch deck or a
  price list directly.
- **The rules, stated where the button is**: accepted file types and size limits in one sentence
  at the upload point, sourced from the same constants the code enforces — never a second copy
  that can drift.
- **Evidence of use**: where a composer reply or a run report drew on a deposited document, say
  so ("drew on: Brand positioning") — the data is already in the tool-call/report stream.

## Explicitly NOT here

- Deleting/editing corpus entries from the studio (a governance question — deposits are records).
- Growing the box's disk (FB-085 sized it; a real corpus push means the CPX32 conversation).

## Acceptance criteria

- [x] A founder sees every deposited document, reads any of them in-studio, and uploads a new one.
- [x] Accepted types and limits are stated at the point of upload, from enforced constants —
      `ACCEPTED_DESCRIPTION` is built from `MAX_DOCUMENT_BYTES` itself, so the sentence cannot promise
      a limit the code does not enforce.
- [ ] **At least one surface shows the team USING a deposit, by name.** *Not done — the data is not
      there. See below.*
- [x] Venture isolation holds server-side on the new view.

## What shipped

`/venture/<id>/knowledge`: everything in `context/` and `library/`, grouped by area with what each
area is *for*, read in-studio rather than by sending the founder to a code host — which was the whole
complaint. One GraphQL query per area (FB-083's read-path), so a corpus of forty documents costs two
requests rather than forty-two.

Upload goes through the studio's **existing** write credential and lands as a proposal a human
merges. No second, ungated way into a venture repo — that is what CLAUDE.md #4 exists to prevent.

A document too large for the studio to render is **listed with its real size**, not dropped: a
founder who uploaded a 2MB deck needs to see that it landed.

## One reader, because the ticket asked for it

"never a second copy that can drift" was in scope for the limits, and it turned out to apply to the
reader too: the extraction lived inline in the composer's upload route, and a second copy would mean
a founder told **yes on one screen and no on the other**. `readDocumentText` is now the one reader,
used by both.

## The criterion I could not meet honestly

**"At least one surface shows the team USING a deposit, by name."** The ticket says the data "is
already in the tool-call/report stream". It is not. The composer streams tool *calls* — name and
arguments — and the studio never receives tool *results*, so when the venture brain is searched the
studio can see **that** it was searched and never **what came back**. `search_venture_brain` takes a
question and a department; neither names a document.

So the honest options were: show "your team searched what your venture knows" (true, and not what was
asked for), or invent a citation. Neither is shipping. **What would actually close it** is the
composer stream carrying tool results, or the brain tool naming its sources in the reply — either is
a box-side change and a ticket of its own, and it should be one rather than a guess dressed as
evidence.
