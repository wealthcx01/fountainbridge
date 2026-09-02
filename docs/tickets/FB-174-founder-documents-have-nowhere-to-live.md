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

- **FB-173** — voice notes produce audio.
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
