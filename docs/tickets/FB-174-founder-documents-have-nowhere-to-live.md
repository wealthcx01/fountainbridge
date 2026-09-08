# FB-174 — founder documents have nowhere to live but git

**Status:** Done · **Phase:** 3 · **Depends on:** FB-170 · **Raised by:** John, 2026-09-02

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

## What shipped, 2026-09-07

**The store.** `lib/document-store.ts` — a port with two implementations and one place that chooses
between them. A document's address is `<venture>/<sha256 of its bytes>`, so the founder's filename is
a fact about the document and never its address. That closes a class of problem rather than guarding
against it one case at a time: a hex digest cannot contain `..`, a slash, or a right-to-left
override, and re-handing over the same file is idempotent for free.

**The schema.** `db/002_documents.sql`, in FB-170's idiom, and with the isolation put where the
application cannot forget it:

```sql
constraint documents_key_is_scoped
  check (storage_key = venture_id || '/' || checksum)
```

A row whose object sits under another venture's prefix cannot be written at all — not by a bug, not
by a mistaken migration, not by someone with a psql prompt and good intentions. Proven against real
Postgres, along with the four RLS cases FB-170 established and one it did not: **a count is a leak
that looks harmless**, and "how many documents does the-reset hold" is a fact about another venture.

**A test double is refused in production.** `filesystem` is genuinely useful locally and would, in
production, write a founder's only copy to a container disk that does not survive the next deploy —
silently. This is Grassmarket's scar (FB-173), inherited deliberately.

**And the thing that lands whether or not anyone sets a credential:** the studio stops discarding
originals in silence. The deposit now says which of the two things happened — *"Saved, with the
original file"* or *"Saved — its text only, not the file itself"* — and the git copy carries the same
sentence. Before this, "Saved" meant both, and a founder had no way to learn that the file they
handed over no longer existed anywhere.

### The order the writes happen in, which is the whole of the safety argument

**After** the secret scan and the emptiness check: a refused deposit must leave nothing behind, and
storing first would put the bytes of the rejected document — the one containing a credential — into
the store before anyone decided to keep it.

**Before** the git write, and the asymmetry is deliberate. If the git write fails afterwards, an
object is left with no pointer, and **an object can be deleted**. The other way round would leave a
pointer naming bytes that were never kept, in history that cannot be rewritten.

That asymmetry is also the second reason this ticket exists, and the one that is easy to miss. The
first reason is that originals were being lost. The second is that git is permanent — which is why
`depositDocument` scans for secrets before writing at all (FB-140). Keeping originals somewhere that
is not git is not only about keeping them. It is about being able to stop.

## What did not ship, and why

**The 100MB deck.** The cap stays at 12MB. Streaming the store write alone would not raise it,
because `readDocumentText` buffers the whole file to extract from it — so the real ceiling is
extraction, not storage. Raising it honestly means deciding what happens to a file too large to read:
kept but not extracted, and said so. Real work, not a line change.

**The `documents` row is not written yet.** The studio has no database *connection* — FB-170 shipped
the schema and its proof, not a client. So the pointer goes where this ticket always said it should:
into git, beside the extracted text, as a line naming the checksum, the size and which store holds
it. The corpus stays complete from git alone, and when the studio does have a connection the table
becomes an index over facts that already exist rather than the only copy of them.

**The composer's deposit path still writes only to git**, and unifying it is not the small job the
scope line implies. `deploy/librechat/deposit-mcp/stdio.mjs` runs **on the venture's box**. Giving it
the same store means giving a venture machine the studio's storage credential, which is precisely
what non-negotiables 6 and 8 forbid. It has to deposit *through* the studio instead — which is an
endpoint that does not exist yet, and is arguably FB-200's `add to the corpus` tool rather than this
ticket's.

## The bytes have a home, 2026-09-07

John: *"you should have access to supabase and can set that up yourself."* Nearly. The machine holds
two Postgres connections to the project and **no service key**, so Supabase Storage is out of reach;
the database is not. So the bytes went in the database — behind the port that already existed, which
is what the port was for.

### And that decision turned up a contradiction worth catching

`001_read_model.sql` opens with the argument that makes a database safe to add at all:

> Every row here is derived from a git ref and can be dropped and rebuilt. That property is what
> makes it safe to add a database to a product whose entire premise is that git is the record.

**A document's bytes are derived from nothing.** They exist there and nowhere else — that is the
whole of this ticket. Putting them in the read model would have quietly made its central claim
false, and the next person to read that header would have believed something that had stopped being
true.

So `db/003_document_bytes.sql` is a separate schema with the opposite guarantee, said out loud:

| | |
|---|---|
| `public` | a cache. Derived from git. Safe to drop and rebuild. |
| `docstore` | a store. Derived from nothing. **Never drop this.** |

No foreign key to `ventures`, deliberately: `docstore` must not depend on a table designed to be
dropped, or a rebuild of the read model would cascade a founder's documents away.

### Proven against the real database, as the role the studio actually uses

Not pglite, and not as `postgres` — which has `rolbypassrls` and reads straight through every policy
there is. As `foundry_studio`, through the pooler, against the hosted project:

| | |
|---|---|
| A 300,000-byte document, stored and read back | **byte for byte identical** |
| Another venture asking for it **by its checksum** | 0 rows — refused |
| Another venture naming `arca` explicitly | 0 rows — refused |
| A connection naming no venture at all | 0 rows — refused |
| The studio trying to **delete** a document | `permission denied for table blobs` |

That last one is a grant, not a policy, and it is deliberate: `docstore.blobs` gives the studio
`insert` and `select` and nothing else. A document is addressed by the hash of its own contents, so
an update could only ever make the address a lie — and losing a founder's document is not among the
things a bad deploy should be able to do.

### And it is checkable from outside now

`/api/readiness` reports whether documents have somewhere to live, and it **reaches** the store
rather than merely building one. That distinction is FB-193's lesson: a check that proves the wrong
half answers "ready" on a day when the thing is unusable. It does not count towards `ok`, because a
studio with no store is a setup and not a fault.

Without it, the only way to know the store really worked in production would have been to hand over
a document and see — which writes to a venture's repository. A poor way to test a thing.

## Still to do

- [ ] Retrieval on a screen — a founder can fetch back what they handed over
- [ ] The larger cap, and an honest answer for a file too big to read
- [ ] The `public.documents` row, once something writes it; the pointer in git is the record today
- [ ] The composer's deposit path, through the studio rather than beside it
- [ ] **Object storage, when size says so.** A 12MB row is fine and a 100MB one is not, and a
      database is a more expensive place to keep bytes than a bucket. `DOCUMENT_STORE=supabase` is
      already written and waiting for a service key; moving is one variable and no caller changes.

## Switched on

`DATABASE_URL` and `DOCUMENT_STORE=postgres` are set. Nothing is left for John to do for documents.

For the eventual move to object storage, when size calls for it: `DOCUMENT_STORE=supabase`,
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and a **private** bucket.
