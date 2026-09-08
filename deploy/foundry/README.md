# `/etc/foundry` — the box's credentials, in one place

FB-176. Rotating ARCA's lane token on 2026-09-02 found the same live credential in **five** places on
one venture box. Only one of them was the file anyone would have thought to rotate.

| where it was | how it got there |
| --- | --- |
| `/opt/foundry/lane/lane.env` | the lane installer, deliberately |
| `/opt/foundry/librechat/.env` | the composer's install, separately |
| `/opt/foundry/lane/arca/.git/config` | baked into a clone URL, by a clone that predates the fix |
| three files under `/root/.claude/projects/…` | written into agent session transcripts, on three separate days |

Nothing put the token in the last two on purpose, nothing noticed, and nothing would have stopped a
fourth. Revoking it would have broken the composer and every push the lane makes, with no message
saying why — an outage caused by a security improvement, which is the shape of change nobody wants to
make twice.

## The rule

**One file holds the secrets: `/etc/foundry/credentials`, owned by root, mode `0600`.** Everything
else reads from it. Rotation touches one file and restarts two units.

`KEY=value`, one per line, no `export`, no quotes needed. That format is read identically by systemd's
`EnvironmentFile=`, by docker-compose's `env_file:`, and by `set -a; . file; set +a` in a shell — the
three consumers on a venture box — so there is one file and no translation between them.

Everything that is **not** a secret stays where it was. `lane.env` still holds `FOUNDRY_DEPARTMENTS`,
budgets and the rest; `brain.env` still holds the brain's settings. This file is only for things that
would matter if they leaked.

## What lives here

| key | used by |
| --- | --- |
| `TICKET_GITHUB_TOKEN` | the lane, the composer's ticket-filer, the deposit tool, the status connector |
| `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` | the lane's Claude runs |
| `COMPOSER_API_KEY` | the studio, to reach this box's composer |
| `FOUNDRY_OFFICE_SECRET` | the office gate |

## Installing it

```bash
sudo deploy/foundry/install-credentials.sh
```

It moves any secret it finds in `lane.env` and the composer's `.env` into `/etc/foundry/credentials`,
leaves a comment in their place saying where the value went, and refuses to run if it would end up
writing an empty file. It is safe to run twice.

## Checking it

```bash
sudo deploy/foundry/secret-scan.mjs
```

Walks the places a credential has actually been found on a box and exits non-zero if one is anywhere
but here. It prints the file and what kind of thing it is — **never the value**, because a scanner
that prints the secret it found has just written it to another log.

## Rotating

`docs/rotating-a-venture-credential.md`. It names every consumer, because the rotation this ticket
came from was partial and was only caught by grepping the whole filesystem afterwards.
