# FB-282 — Staging and previews load the schema before each deploy

**Status:** Done · **Kind:** small · **Phase:** 3 · **Raised by:** John, 28 October 2026 (part of FB-272: staging's own database) · One ticket = one branch = one PR.

## Why

Staging now has its own Postgres (FB-272), but it is empty, and it has no public address. John
chose not to open one, and not to register an SSH key for a tunnel. So the schema has to be loaded
from inside Railway's own network. Previews, which copy staging, each get their own empty database
too, and need the same.

## What was built

- `scripts/apply-schema.mjs`, Railway's pre-deploy command. Before each deploy it loads any new
  `db/*.sql` files, records them in `schema_files`, and gives `foundry_studio` its sign-in from
  `STUDIO_DB_PASSWORD`. The password is only ever in Railway's variables.
- It does nothing unless `SCHEMA_ADMIN_URL` is set (staging and previews only), and refuses any
  database not on Railway's private network, so production's Supabase is never touched.
- `railway.json` and `.railway/railway.ts` carry the pre-deploy command; the latter also names the
  two new variables, so a future `railway config apply` keeps them.
- `docs/deploy.md` has staging's three variables, as Railway references, with no values.

## Done when

- [x] The step loads every file once, records each, and loads nothing the second time; tested
  against a throwaway database on the planning box (`scripts/__tests__/apply-schema.test.mjs`).
- [x] It refuses production's Supabase address, a public Railway address, and this machine.
- [x] It gives the studio's role its sign-in, and never prints the password.
- [x] Every command in `CLAUDE.md` `## Checks` passes.

Staging running on its own database is checked after merge, once staging's three variables are set
(FB-272's remaining item).
