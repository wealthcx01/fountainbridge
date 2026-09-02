# FB-176 — a token lives in one place, injected, never written into git config or a log

**Status:** Open · **Phase:** 3 · **Raised by:** John, 2026-09-02

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

- [ ] One file holds the token; `grep -r` across `/opt`, `/root` and `/etc` finds it nowhere else.
- [ ] `git remote -v` on a venture worktree prints no credential, and the lane still pushes.
- [ ] The scanner finds a planted token in each of the five locations above, and says which.
- [ ] A planted token surfaces in the studio, not only in a log.
- [ ] The runbook lists every consumer, and rotating by it leaves nothing stale.
