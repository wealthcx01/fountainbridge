# FB-272 — The studio is ready for the factory

**Status:** In review · **Kind:** medium · **Budget:** $25 · **Rough date:** 30 October 2026 · **Pilot step:** 1 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

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
- Pull request environments: answered on 28 October. Railway makes one for every pull request on
  this project (#382, #383, #384), each built and health-checked. Find out which environment
  a preview copies its settings from, write it down in `docs/deploy.md`, and make sure a preview can
  never reach production's data.

## Done when

- [x] Journeys 1 and 2 in `harness/END-TO-END.md` pass against a test copy, started the way the
  factory will start it. The factory's own runtime host (`factory/runtime_host.py`) started the
  copy with `node scripts/test-copy.mjs start --port {port}`; `e2e/journeys.spec.ts` passed against
  it, and `/build-id` answered the host's name for the copy.
- [x] A founder's Accept merges nothing; a test proves it. John's Approve still merges.
  `app/actions/__tests__/work.test.ts` failed on the old code (the founder's Accept merged) and
  passes now.
- [ ] Staging runs `main`, has its own database, and ARCA's founder can sign in there. Claude does
  this on Railway (staging's database and deploying `main`). Needs John: the password entry's hash
  in staging, and staging's address as a Google redirect.
- [x] Every command in `CLAUDE.md` `## Checks` passes.

## What was built

- `/build-id` (`app/build-id/route.ts`), public like `/api/health`.
- The test copy, `scripts/test-copy.mjs` (rules in `scripts/test-copy-lib.mjs`, tested in
  `scripts/__tests__/test-copy-lib.test.mjs`). One run, one throwaway database on the planning
  box, named `fb_test_<time>_<random>`, dropped when the copy stops. It refuses any other
  `DATABASE_URL`, and connects the studio as `foundry_studio` so row-level security applies.
- The test settings moved out of `playwright.config.ts` into `e2e/server-env.mjs`, so the test copy
  and Playwright's own server use the same list.
- The factory's files, as on the website: `factory/`, `harness/appproc.py`, `harness/ci.py`,
  `harness/mutations/`, `harness/harness.config.json`, `harness/runtime.inputs.json`, `FACTORY.md`,
  `FACTORY_RULES.md`, `engineering.md`, `.factory/holdout/HOLDOUT.md`.
- `acceptWork` merges only for John. A founder's Accept writes "Signed off by <founder>, waiting
  for John" on the pull request.
- `CLAUDE.md` and the README brought up to date.

## Left open

- The factory's Postgres user (`factory`) needs `CREATEDB` and membership of `foundry_studio`
  before the factory can start a test copy itself. Needs John.
- The runtime host's own settings for the studio (operator files in `/home/factory/runtime/`).
  README, "Running it for the factory", says what they need.
- Whether Railway makes pull request environments for this project. Claude does this on Railway.

## Needs John

About 10 minutes: mint the password entry and put its hash in staging; add the Google redirect.
`CLAUDE.md` and `harness/` are protected, so John merges this on GitHub.

## Out of scope

Any screen change.
