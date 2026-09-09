-- The studio may fill its own run-report cache (FB-170).
--
-- ## Why this relaxes 001's read-only rule, and how far
--
-- `001_read_model.sql` gave `foundry_studio` `select` and nothing else, with the reasoning that a
-- studio which cannot write cannot corrupt the thing every screen reads. That still holds for
-- anything the studio DERIVES. It does not hold for a cache of something it just fetched from the
-- source of truth.
--
-- A run report is written once by a lane and never changed: the name carries the instant
-- (`<slug>-YYYYMMDDTHHMMSSZ.json`), so a second report is a second file, never an edit. That makes
-- these rows **immutable**, and an immutable cache entry cannot be corrupted by the process filling
-- it — only inserted, and only with bytes GitHub just handed over.
--
-- So: `insert` is granted and `update` and `delete` are not. The studio can fill the cache and can
-- never change or remove an entry. If a row is somehow wrong, the fix is to drop the table and let
-- it refill from git, which is the same guarantee 001 was written around.
--
-- Same shape as `docstore.blobs` in 003 — select and insert, nothing else — for the same reason.
--
-- ## The heartbeat is deliberately NOT cached
--
-- `_heartbeat.json` is the one file a lane overwrites in place, so it is mutable and `do nothing`
-- would pin the first version the studio ever saw. It is excluded at the application layer and read
-- from git every time: FB-164 already established that is one read per repository, which is cheap,
-- and a stale liveness beacon would say a stopped machine was running.

grant insert on run_reports to foundry_studio;

-- The desk's query, made cheap: every report for one venture by name, in one round trip.
--
-- The primary key is (venture_id, repo, name) and already serves this, but the reads come in as a
-- LIST of names for one repository — `where repo = $1 and name = any($2)` — and that wants the repo
-- leading. Without it the planner has the venture and has to scan its whole history to find sixty
-- rows, which on ARCA is 1,773 and grows by ~288 a day (FB-162).
create index if not exists run_reports_by_name
  on run_reports (venture_id, repo, name);
