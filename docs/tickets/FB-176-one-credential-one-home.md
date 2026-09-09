# FB-176 — a token lives in one place, injected, never written into git config or a log

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-02

**Shipped in part:** the one home, the credential helper, the scanner, the lint and the runbook are
done and tested. **A finding still reaches nobody but `journalctl`** — that is FB-206, and the reason
it is a separate ticket is written there.

## What the rotation found

Rotating ARCA's lane token on 2026-09-02 turned up the same credential live in **five** places on the
venture box. Only one of them was the file anyone would think to rotate.

| where | how it got there |
| --- | --- |
| `/opt/foundry/lane/lane.env` | the installer, deliberately |
| `/opt/foundry/librechat/.env` | the composer's install, separately |
| `/opt/foundry/lane/arca/.git/config` | **embedded in the remote URL** by `git remote set-url` |
| `/root/.claude/projects/…/*.jsonl` × 3 | written into **session transcripts** on 3, 17 and 26 August |

Two of those are the problem:

- **The git remote URL.** `https://x-access-token:<token>@github.com/…` sits in plaintext inside the
  working tree the venture brain indexes and the lane operates in. Any `git remote -v`, any config
  dump, any support paste, prints a live credential.
- **The session transcripts.** A live token was written into three agent logs over three weeks.
  Nothing put it there on purpose, nothing noticed, and nothing would have stopped the fourth.

Both are now scrubbed and rotated. Neither is prevented from recurring.

## Why it is worse than it looks

Revoking the token would have broken the composer and every `git push` the lane makes, with no
message saying why — an outage on the venture box triggered by a *security improvement*, which is
exactly the shape of change nobody wants to make twice.

CLAUDE.md #8 says "no secrets in the repo" and is enforced by review and by `lib/secrets.ts` on the
founder's deposit path (FB-140). Neither covers the box's own filesystem, which is where the
credentials actually are.

## Scope

- **One home.** A single `/etc/foundry/credentials` (root, `600`), read by the lane, the composer and
  anything else that needs it. No second copy, and rotation touches one file.
- **Never in git config.** Use a git credential helper reading the same file, or push over a URL
  assembled at call time. `git remote -v` must not print a secret.
- **A scanner, run on the box, that fails loudly** (#10) when a `github_pat_`, `ghp_`, private key or
  bearer token appears anywhere outside that one file — the working trees, `.git/config`, the
  transcripts under `/root/.claude/`, systemd units, logs. It runs on a timer and its finding is
  surfaced in the studio's admin ledger rather than only in a log nobody opens.
- **A rotation runbook** that names all consumers, so the next rotation cannot be partial. This one
  was partial and was only caught by grepping the whole filesystem afterwards.
- Extend `lib/secrets.ts`'s patterns rather than writing a second set — one definition of what a
  credential looks like (the FB-140 drift test already guards that pair).

## Acceptance criteria

- [x] One file holds the token; `grep -r` across `/opt`, `/root` and `/etc` finds it nowhere else. —
      `deploy/foundry/install-credentials.sh`, run against a copy of a box in
      `deploy/foundry/__tests__/install-credentials.test.mjs`, with the scanner itself as the check.
- [x] `git remote -v` on a venture worktree prints no credential, and the lane still pushes. — the
      stored `origin` has been tokenless since FB-045 and `foundry-lib.sh` supplies the credential per
      call; `deploy/foundry/git-credential-foundry` closes the remaining gap, which is that a
      per-call URL puts the token on the **process command line** where `ps aux` prints it.
      *"The lane still pushes" is not proven — that needs the box.*
- [x] The scanner finds a planted token in each of the five locations above, and says which. —
      `deploy/foundry/secret-scan.mjs`, tested against all five, asserting it names the file and the
      line and never the value.
- [ ] **A planted token surfaces in the studio, not only in a log.** — **not done. FB-206.**

## Run on ARCA's box — 2026-09-09

John authorised the migration. It is done, and the box's own scan says so:

> **No credential found outside `/etc/foundry/credentials`.** (exit 0)

Four secrets now live in one root-only file: `TICKET_GITHUB_TOKEN`, `ANTHROPIC_API_KEY`,
`CLAUDE_CODE_OAUTH_TOKEN`, `TAVILY_API_KEY`. The lane ran a pass and pushed a run report — a real git
write, through a **tokenless remote** and the new credential helper — and the composer answers 200
with its credentials from the same file.

### Three things the real box taught, none of which a fixture would have

**1. The scan returned 727 findings.** Two were real. The rest were a settings form with a `password`
field, a pricing provider with `apiKey =`, jQuery's minified bundle, a ticket file *about* an API key
in source, and **this ticket's own credential helper**, matching on the words `access-token` in its
documentation.

The other two copies of that pattern set scan **one document a founder hands over**, where a coarse
net is right: a false positive costs a rename. This one sweeps **a filesystem containing source
code**, where the same net is unusable. The patterns are graded now — `strong` shapes only a
credential has, `loose` for the assignment heuristic, which is counted and summarised rather than
listed. A report nobody can read is the same failure as a log nobody opens.

**2. Twenty-three of the remaining twenty-six were a dependency's test fixtures.** `/root/.claude/skills/gstack/`
is a vendored toolkit whose redaction library ships example AWS keys and private keys, as it should.
A daily timer that fails every day because a dependency contains an example credential is a timer
whose failure means nothing within a week. `skills` is skipped, like `node_modules`. **`projects` is
not** — that is the sibling directory where three live tokens were actually found, and it is the
reason this scanner exists.

**3. The key list was one short of the box it ran on.** ARCA's composer held a `TAVILY_API_KEY` that
nobody had written into `SECRET_KEYS`, so the first migration left it behind and the scan found it —
**the same partial rotation this ticket exists to prevent, committed by the script written to prevent
it.** The installer now also moves any key whose *value* matches a strong pattern, so it moves
anything the scanner would fail on and the two cannot disagree about what a secret is.

And one bug found by that fix: the value check's last command is a test, which under `set -e` inside a
command substitution killed the script before it reached its own "nothing to move" guard — leaving an
empty credentials file behind, which is exactly the state that guard exists to prevent.

### Left behind on purpose

The box still runs the pre-FB-205 `run-once.sh`, so new run reports still say *"Daily lane budget
reached"*. The studio's rewriter renders it correctly, so a founder reads the right sentence either
way. Deploying the lane scripts is a bigger blast radius than a credential move and was not what was
authorised today.
- [x] The runbook lists every consumer, and rotating by it leaves nothing stale. —
      `docs/rotating-a-venture-credential.md`.

## Done, 2026-09-08 — everything but the last one

**One home.** `/etc/foundry/credentials`, root, `0600`. `KEY=value` is read identically by systemd's
`EnvironmentFile=`, docker-compose's `env_file:` and `set -a; . file` in a shell — the three consumers
on a box — so there is one file and no translation. Both the lane unit and the composer's compose file
read it **last**, so a stale copy left in `lane.env` cannot beat the file that gets rotated, and both
read it optionally, so a box that has not been migrated yet still starts rather than failing to boot
over a security tidy-up.

**The migration is tested, not just written.** It ships to a box and runs as root, so "it parses" is
not evidence. Seven tests run it against a copy of a box: the token ends in exactly one file *with the
scanner as the check*, a pointer is left where the value was, nothing that is not a secret is touched,
and it is safe to run twice.

**It nearly created a sixth copy.** The first version took a `.pre-fb176` backup of each file before
editing it — with the live token still in it, in exactly the class of place the new scanner flags.
Found by running it and then scanning the result. The backup is now taken once per file and has its
own secrets blanked: it keeps the configuration, which is what a backup is for, and not the value,
which is safely in the home by then.

**The scanner will not print what it finds.** A scanner that shows you the secret has written that
secret into another log, which is the fault it exists to catch. It prints the path, the line number
and the kind. A test asserts the value reaches neither the words nor the JSON.

**It says when it could not look.** A path it cannot read is reported, not skipped. "We looked and
found nothing" and "we could not look" are different answers and only one of them is reassuring.

**Three copies of one net, and a guard.** The scanner cannot import `lib/secrets.ts` — it is a
standalone script root runs from a timer, on a box with no build step. `lib/__tests__/secret-drift.test.ts`
now covers the third copy in both directions, and was checked by removing a pattern and watching it
fail.

**Both new shell scripts are in `make provision-lint`.** A script that runs as root on a venture box
is the last place to skip a linter.
