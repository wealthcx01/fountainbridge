# FB-246 — shellcheck did not see the variable that broke the deploy, and now it does

**Status:** Done · **Phase:** 3 · **Found by:** FB-245's follow-on, 2026-10-01

## Why

FB-245: `scripts/provision-office.sh` referenced `SCRIPT_DIR` and never defined it. Under `set -u`
that is fatal, so the step that copies the office onto a venture's box had **never once run to
completion**. It reached a real deploy before anybody noticed.

The follow-on written there was *"enabling shellcheck's SC2154 would have caught this"*. **That was
wrong**, and checking it rather than doing it is how this ticket exists.

## What was actually true

SC2154 — *"referenced but not assigned"* — is **already on by default**. It did not fire because
shellcheck deliberately **exempts ALL-CAPS names**, on the reasonable assumption that they come from
the environment. `SCRIPT_DIR` is all-caps.

Checked, not assumed:

| | shellcheck 0.11.0, default settings |
| --- | --- |
| `echo "${lower_case_var}"` | SC2154, **exit 1** |
| `echo "${UPPER_CASE_VAR}"` | nothing, **exit 0** |

So turning on "SC2154" would have changed nothing at all. The setting that matters is the optional
`check-unassigned-uppercase`, which lifts that exemption.

## What changed

A `.shellcheckrc` at the repo root:

    enable=check-unassigned-uppercase
    external-sources=true
    source-path=SCRIPTDIR

In the file rather than as a flag on the Makefile, so it applies to a developer running `shellcheck`
by hand as well as to CI. There was nothing to change in the Makefile beyond a comment pointing at it.

**`external-sources` is not optional here.** Turning the check on alone produced false reports in
five lane scripts about `REPO`, `API`, `STATE_REF` and others — all of which `foundry-lib.sh` *does*
assign, at the top, with defaults. Shellcheck simply could not see through
`. "$SCRIPT_DIR/foundry-lib.sh"`. A check that cries wolf is a check people switch off, so it has to
be able to read what it is talking about.

## The two real findings it surfaced

**`TICKET_GITHUB_TOKEN`** — genuinely required from the environment and never assigned. It is now
defaulted to empty and **checked where it is used**:

    need_github_token() {
      [ -n "$TICKET_GITHUB_TOKEN" ] && return 0
      flog "TICKET_GITHUB_TOKEN is not set. The lane cannot reach GitHub without it — put it in the"
      flog "lane's environment file (/opt/foundry/lane/lane.env) and restart the timer."
      return 1
    }

Defaulted rather than demanded at source time because `install-gbrain.sh` sources this library and
does no GitHub work. Checked at all because the two things that happen today are both unhelpful:
`set -u` aborts with *"TICKET_GITHUB_TOKEN: unbound variable"* from whichever line touched it first,
and an empty token gets a 401 that reads like a revoked one. Neither says what to fix (CLAUDE.md
#10).

**`FOUNDRY_BRAIN_TOKEN`** — a false positive. It is set by `. "$BRAIN_ENV"` on the same line that
reads it, a runtime source shellcheck cannot follow. Disabled on that line, with the reason.

## Proved by breaking it

| | |
| --- | --- |
| FB-245's exact bug reintroduced | **SC2154: SCRIPT_DIR is referenced but not assigned**, exit 1 |
| a lane script given a variable defined nowhere | **caught**, exit 1 |
| every linted script as it stands | clean |

One test of mine was wrong and is worth recording: removing `STATE_REF="foundry-state"` from
`supervisor.sh` did **not** trip the check — correctly, because `foundry-lib.sh` still assigns it and
shellcheck now follows the source. The check was right and the test was wrong.

## The linter's own test

CI's "Provision scripts" job went green on the first run — which is exactly the shape of result worth
distrusting. A pass can mean *"the check ran and found nothing"* or *"shellcheck did not understand
the setting and ignored it"*, and those look identical from outside.

So `scripts/lint-canary/undefined-uppercase.sh` exists: a file whose only content is an undefined
uppercase variable, which `provision-lint` asserts shellcheck **fails** on.

    provision-lint: the undefined-variable check is live (canary fails, as it must)

Comment the setting out of `.shellcheckrc` and the lint stops with:

    provision-lint: shellcheck PASSED the canary — check .shellcheckrc is being read

**A configuration file is a claim.** The canary is the thing that checks the claim is still true —
on every run, on whatever shellcheck version the runner happens to ship, forever. Without it, a
future runner upgrade that renamed or dropped the option would take the check away silently and
nothing would go red.

It sits in its own directory so none of the existing globs lint it by accident, and its header says
in the first line not to fix the fault inside it.

## Acceptance criteria

- [x] An undefined uppercase variable fails the lint.
- [x] It applies to the lane scripts, not only the provisioning ones.
- [x] It applies to a run by hand, not only to CI.
- [x] No false reports left behind for somebody to learn to ignore.
- [x] The setting is proved live on every run, not assumed from a green tick.
