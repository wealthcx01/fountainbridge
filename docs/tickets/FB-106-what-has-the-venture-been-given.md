# FB-106 — What has the venture been given?

**Status:** Todo · **Phase:** 3 (D8 surface) · **Asked for by:** John, 2026-08-04 — *"nothing that
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

- [ ] A founder sees every deposited document, reads any of them in-studio, and uploads a new one.
- [ ] Accepted types and limits are stated at the point of upload, from enforced constants.
- [ ] At least one surface shows the team USING a deposit, by name.
- [ ] Venture isolation holds server-side on the new view.
