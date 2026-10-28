# FB-272 — The studio is ready for the factory

**Status:** Todo · **Kind:** medium · **Budget:** $25 · **Rough date:** 30 October 2026 · **Pilot step:** 1 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

The factory can only build and check the studio once it can start a fresh test copy of it, sign
in to it, and look at it. Today it can't: there is no test copy with its own database, and the
studio's notes still describe a project that hasn't started.

## What to do

- `/build-id` answers with the running commit, like the website's.
- **A test copy for each run:** the studio starts on a given port, reads the fixtures, has the test
  sign-in door on, and uses a **throwaway database on the planning box, made for that run and
  deleted after it.** Never Supabase, never staging's database.
- `harness/runtime.inputs.json`: how the factory starts, signs in to and checks the test copy.
- `CLAUDE.md` brought up to date. It still says "Phase 0", that the app "does not exist yet", and
  that Chromium can't run on the box. The README's Vercel becomes Railway.
- **Only John's Approve merges.** Rule 2 in `CLAUDE.md` is rewritten, and `acceptWork` in
  `app/actions/work.ts` merges for John only. A founder's Accept becomes their sign-off (FB-277
  shows it).
- **Staging gets its own database:** a Railway Postgres in foundry-studio's `staging` environment,
  with `DATABASE_URL` pointing at it. Test data only. ARCA's demo cards and screenshots count as
  test data (John, 26 October). No other real founder data, ever.
- **Staging deploys `main`, and ARCA's founder can sign in** with the password door
  (`STUDIO_PASSWORD_LOGINS`, FB-092). John makes the entry with
  `node scripts/mint-password-login.mjs arca.founder@bruntsfield.capital`; only the hash goes into
  staging's variables. John adds staging's address as a redirect in the Google client, for his own
  sign-in.
- Find out whether Railway really makes pull request environments for this project (Railway says
  yes; FB-230 says none ever appeared). Write down which is true.

## Done when

- [ ] Journeys 1 and 2 in `harness/END-TO-END.md` pass against a test copy, started the way the
  factory will start it.
- [ ] A founder's Accept merges nothing; a test proves it. John's Approve still merges.
- [ ] Staging runs `main`, has its own database, and ARCA's founder can sign in there.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Needs John

About 10 minutes: mint the password entry and put its hash in staging; add the Google redirect.
`CLAUDE.md` and `harness/` are protected, so John merges this on GitHub.

## Out of scope

Any screen change.
