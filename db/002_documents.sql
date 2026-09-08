-- What a founder handed over (FB-174).
--
-- ## What this is a record OF, and what it is not
--
-- The bytes are not here. They live in a document store (`lib/document-store.ts`); this is the
-- record of what was handed over, by whom, and where it went. The same rule as 001 holds: nothing is
-- written here that is not also written to git first — the extracted text and a pointer go into the
-- venture's `context/`, so the corpus stays readable by the venture brain and by git alone, and this
-- table is an index over facts that exist without it.
--
-- ## Content-addressed, and that is not a detail
--
-- A document's identity is the SHA-256 of its bytes. Three things follow, and each of them is a
-- problem that would otherwise have to be solved somewhere less reliable:
--
--   - **Re-handing over the same file is idempotent.** It writes the same row and the same object.
--     The studio's Add control already behaves this way for the git half; now both halves agree.
--   - **The storage key cannot contain a filename**, so it cannot contain `..`, a slash, a control
--     character, or anything else a founder can put in a filename and an object store can misread.
--     A hex digest has none of those.
--   - **A key cannot cross ventures**, and the database refuses one that tries. See the check
--     constraint below — that is deliberately not left to the application.
--
-- The founder's own filename is kept, of course. It is a fact about the document, not its address.

create table if not exists documents (
  venture_id   text not null references ventures(id) on delete cascade,

  -- SHA-256, lower-case hex. The identity, and the only thing the address is built from.
  checksum     text not null,

  -- What the founder called it. Displayed, never used to address anything.
  filename     text not null,
  content_type text not null,
  bytes        bigint not null,

  -- WHICH store holds it, recorded rather than assumed. A studio that changes stores later has to be
  -- able to tell which objects moved and which did not, and an implicit "wherever the current one
  -- is" makes that unanswerable.
  store        text not null,
  storage_key  text not null,

  -- Who handed it over. `app/actions/knowledge.ts` already writes this sentence into the git copy;
  -- a corpus entry whose provenance is guessable from its content is one nobody trusts later.
  deposited_by text not null,
  deposited_at timestamptz not null default now(),

  -- Where the extracted text landed in the venture's repository, so the pointer works both ways.
  -- Null while a document is stored but not yet written to git.
  context_path text,

  primary key (venture_id, checksum),

  -- The address is DERIVED, and the database says so.
  --
  -- Venture isolation for bytes cannot rest on the application remembering to prefix a key
  -- (non-negotiable 6). With this constraint, a row whose object lives under another venture's
  -- prefix cannot be written at all — not by a bug, not by a mistaken migration, not by anyone with
  -- a psql prompt and good intentions.
  constraint documents_key_is_scoped
    check (storage_key = venture_id || '/' || checksum),

  -- And a checksum that is not a checksum cannot be an address either.
  constraint documents_checksum_is_sha256
    check (checksum ~ '^[0-9a-f]{64}$'),

  constraint documents_bytes_positive check (bytes > 0)
);

-- The Memory screen's query: what this venture has been handed, newest first.
create index if not exists documents_newest
  on documents (venture_id, deposited_at desc);

alter table documents enable row level security;
-- FORCE, for the reason 001 gives: without it the table owner — which is who the studio connects
-- as — bypasses the policy below, and the isolation would be decorative.
alter table documents force row level security;

create policy documents_scoped on documents
  using (venture_id = current_setting('app.venture_id', true));
