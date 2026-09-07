# FB-174 — founder documents have nowhere to live but git

**Status:** Open · **Phase:** 3 · **Depends on:** FB-170 · **Raised by:** John, 2026-09-02

## What happens today

A founder hands over a document. `app/actions/knowledge.ts` reads it into the studio's memory,
base64-encodes it, and **commits it into the venture repository** as a file. That is the entire
storage layer.

- The cap is `MAX_DOCUMENT_BYTES = 12MB`, and the comment says why: *"the bytes pass through the
  studio's memory."*
- Only text survives. `lib/documents.ts` extracts text and refuses anything it cannot read as prose.
  A deck, a spreadsheet, a scan, a recording — the things founders actually have — either land as
  extracted text with the original thrown away, or are refused.
- Every version is a commit, forever, in a repository that is also the venture's source code.

D8 already says what should happen: *"heavy binaries in object storage with pointers."* The pointer
half exists in the design. The object storage does not exist at all.

## Why it matters now

Three things arriving at once need somewhere to put bytes, and each would otherwise invent its own:

- **FB-173** — voice notes produce audio, and a transcript that is at least as sensitive as the
  audio. Grassmarket keeps its meeting transcripts encrypted at rest (`FernetTranscriptCipher`); a
  founder's voice note deserves the same, so this ticket owes an answer for encrypted text at rest
  and there is an in-house pattern to copy rather than invent.
- **FB-172** — the graph will want thumbnails and rendered artefacts.
- The corpus itself, once a founder hands over anything that is not markdown.

Building three private answers to "where do the bytes go" is how a codebase gets four storage layers.

## Scope

- Supabase Storage (it comes with FB-170's Postgres) or S3-compatible object storage. One place.
- The **document record** — who deposited it, when, its type, size, checksum, and where the bytes are
  — lives in the read model. The bytes live in object storage. Git keeps the pointer and the
  extracted text, so the corpus stays readable by the venture brain and by git alone.
- **Venture isolation applies to bytes too** (non-negotiable 6). A signed URL scoped to one venture,
  server-side, never a public bucket. This is the part most likely to be got wrong quietly.
- Raise the cap and stream rather than buffering through the studio's memory.
- Keep the original alongside the extracted text. Throwing away what the founder actually handed over
  is a lossy step nobody asked for.
- `deploy/librechat/deposit-mcp` writes documents too; both paths use the same store or they will
  drift, exactly as the studio's Add control and the composer's deposit had to be unified before.

## Acceptance criteria

- [ ] A founder can hand over a 100MB deck and it is retrievable, unchanged, byte for byte.
- [ ] The bytes are not in the venture's git history.
- [ ] A session scoped to one venture cannot fetch another venture's file, proven by a test.
- [ ] The extracted text still reaches `context/` so the brain and `Last used` keep working.
- [ ] The composer's deposit path and the studio's Add control write to the same store.

## Why this is first, and not third

Confirmed by John on 2026-09-07, along with voice notes and the two new tickets that follow them.
The order is not a preference — it is a dependency, and the wrong order is expensive.

Audio is bytes. Transcripts are bytes. Rendered artefacts are bytes. **The studio's entire storage
layer today is `Buffer.from(body).toString('base64')` followed by a commit into the venture's
repository** (`app/actions/knowledge.ts`). Building voice notes on that means committing MP3s into
ARCA's git history, where they cannot be removed, cannot be scoped, and bloat every clone the lane
makes for ever.

So: FB-170, then this, then FB-173. FB-200 does not wait on any of it, and FB-201 waits on all of it.

**FB-170 is the thing actually holding this up.** PR #213 — the read model's schema, proven against
real Postgres — has been open and unmerged since 2026-09-02. Nothing below it can start until that is
finished or deliberately closed.
