# FB-116 — Box-side files reach a box

**Status:** Done · **Phase:** 0 (provisioning) · **Found by:** three tickets in a row shipping code
that no box would ever run, 2026-08-19 · **Repo:** fountainbridge (provisioning) ·
**Branch:** `fb-116-box-side-files-reach-a-box` · One ticket = one branch = one PR.

## What was found

There has never been a way to put `deploy/lane/*` on a venture box.

`provision-venture.sh` creates the box and clones the venture repos. `deploy/librechat/install.sh`
stages the LibreChat recipe (FB-113). **Nothing stages the lane at all** — not the supervisor, not
`foundry-lib.sh`, not one of the nine helper modules. They reached ARCA by hand, over months, and
that fact was written down nowhere. It is not even in `provision-venture.sh`'s list of steps that
need a human.

The cost, on one day:

| Merged, tested, running nowhere | What the box still does instead |
| --- | --- |
| FB-047 `routines-fire.mjs`, `routines-lib.mjs` | approved routines never fire |
| FB-060 `handoff-*.mjs`, `runreport-record.mjs`, `supervisor.sh`, `foundry-lib.sh` | PR bodies still built from `tail -1` |
| FB-069 (composer half, `seed-agent.js`) | the composer still has not read the playbook |

A dry run against ARCA the moment the script existed: **10 lane files differ.**

## What ships

`scripts/sync-box.sh <user@host> [--dry-run]`.

- **The ship list is derived, never hand-kept.** The lane list is every file in `deploy/lane` bar its
  tests; the LibreChat list is the compose file's own bind-mount sources plus the seeder. A new
  helper is shipped because it exists, not because someone remembered — which is precisely the
  FB-112 failure, one level up.
- **It only writes files that exist in this repo, and never deletes.** That is the entire safety
  argument and it is structural rather than a list of exclusions to maintain: `lane.env`,
  `brain.env`, `state/`, the cloned venture repos and `librechat/.env` have no counterpart here, so
  no path exists by which this can touch them.
- **It says what changed**, not what it sent. "12 files synced" teaches an operator nothing;
  "3 changed, 9 already current" is a fact.
- **It verifies afterwards by checksum** and fails if anything still differs. A sync that reports
  success without checking is the exact class of failure this ends.
- **It reloads systemd only when a unit actually changed**, and restarts nothing — that stays a
  deliberate act.
- **It says what it cannot do for you**: a changed `seed-agent.js` needs a re-seed, a changed
  `docker-compose.yml` needs `up -d` rather than `restart`. Both are lessons this lane paid for.

`make provision-lint` now covers it, so it is shellcheck-clean like every other script that touches
a box.

## Explicitly NOT here

- Running it automatically on merge. Deploying to a venture box is a deliberate act, and an
  auto-deploy on green would have shipped tonight's supervisor changes into a running lane unasked.
- Pulling: this pushes from a checkout. A box holds no checkout of this repo and giving it one is a
  different design with its own credential questions.

## Acceptance criteria

- [x] Every file in `deploy/lane` reaches the box, derived from the directory rather than a list.
- [x] Every host path the compose file mounts reaches the box, plus the seeder.
- [x] A box's own state cannot be written or deleted.
- [x] The run reports what changed and verifies it afterwards.
- [x] `--dry-run` shows the difference without writing — exercised against ARCA before anything moved.
- [x] It is covered by `make provision-lint`.
- [ ] **Run for real against ARCA**, and the lane confirmed working afterwards. Deliberately separate
      from the merge: see above.
