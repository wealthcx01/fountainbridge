-- Where a founder's documents actually are (FB-174).
--
-- ## Why this is NOT in the read model, and it is not a filing preference
--
-- `001_read_model.sql` opens with the argument that makes it safe to put a database behind a product
-- whose premise is that git is the record:
--
--   > Every row here is derived from a git ref and can be dropped and rebuilt. That property is what
--   > makes it safe... a corrupt or stale table is a performance problem, never a lost ticket.
--
-- Take that seriously and it decides this file. **A document's bytes are derived from nothing.** They
-- exist here and nowhere else — that is the entire point of FB-174, which exists because the studio
-- used to throw the original away. Putting them in the read model would quietly make its central
-- claim false, and the next person to read that header would believe a thing that had stopped being
-- true.
--
-- So: a separate schema, with the opposite guarantee, said out loud.
--
--   `public`   — a cache. Derived from git. Safe to drop and rebuild.
--   `docstore` — a store. Derived from nothing. **Never drop this.**
--
-- The record OF a document (who handed it over, when, what it was called) stays in the read model,
-- because that genuinely is derived: `app/actions/knowledge.ts` writes it into the venture's git as a
-- pointer beside the extracted text, so `public.documents` can be rebuilt from git and this cannot.
--
-- ## No foreign key to `ventures`, deliberately
--
-- `docstore` must not depend on a table that is designed to be dropped. A cascade from a rebuild of
-- the read model would take a founder's documents with it, which is exactly the failure this
-- separation exists to make impossible.

create schema if not exists docstore;

create table if not exists docstore.blobs (
  venture_id   text not null,

  -- The identity, and the address: `lib/document-store.ts` keys every object `<venture>/<checksum>`.
  checksum     text not null,
  content_type text not null,
  bytes        bytea not null,
  stored_at    timestamptz not null default now(),

  primary key (venture_id, checksum),

  constraint blobs_checksum_is_sha256 check (checksum ~ '^[0-9a-f]{64}$'),
  -- A zero-byte document is a failed upload wearing a filename.
  constraint blobs_not_empty check (octet_length(bytes) > 0)
);

alter table docstore.blobs enable row level security;
-- FORCE, for 001's reason: without it the table owner — which is who the studio connects as —
-- bypasses the policy, and the isolation would be decorative.
alter table docstore.blobs force row level security;

create policy blobs_scoped on docstore.blobs
  using (venture_id = current_setting('app.venture_id', true))
  with check (venture_id = current_setting('app.venture_id', true));

-- The studio may add a document and read one back. It may not change one and it may not delete one.
--
-- Both omissions are the point. A document is addressed by the hash of its own contents, so an
-- UPDATE could only ever make the address a lie. And deleting a founder's document is a deliberate
-- act by a person with a psql prompt — never something the application can do by having a bad day.
grant usage on schema docstore to foundry_studio;
grant select, insert on docstore.blobs to foundry_studio;
