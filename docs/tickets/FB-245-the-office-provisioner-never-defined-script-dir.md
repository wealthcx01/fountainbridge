# FB-245 — the office provisioner never defined `SCRIPT_DIR`, so it had never installed a gate

**Status:** Done · **Phase:** 3 · **Found by:** deploying the office to ARCA, 2026-10-01

## What happened

With John's approval, `scripts/provision-office.sh arca` was run for real. It stopped partway:

    installed 1.4.1
    active
    scripts/provision-office.sh: line 160: SCRIPT_DIR: unbound variable

`SCRIPT_DIR` was **never defined anywhere in the file.** Every reference to it sits inside the
gate-install step — the three `scp` commands that copy `office-gate.mjs`, `office-gate-lib.mjs`, the
systemd unit and the room layout onto the box. `set -u` makes an unset variable fatal, so **that step
has never run to completion since FB-198 wrote it.**

Which explains the script's own header:

> This exists because ARCA's office was stood up by hand, and a thing that lives only in one
> operator's shell history is not a thing the next venture has.

It was still a thing that lived only in one operator's shell history. The script that was meant to
end that could not do the part that mattered.

## Why nothing caught it

- `bash -n` parses; it does not resolve variables.
- The repo's `provision-lint` runs `shellcheck`, which did not fail the build on it.
- No test runs this script, and a test that did would need a box to run it against.

It is the `running-it-beats-reading-it` lesson again, exactly: every gate green, and the script fails
on first real use. The only thing that found it was running it.

## The fix

    SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

Defined beside the other path constants, with a note saying why it is there.

## The deploy it was blocking, and what that deploy proved

Run afterwards, successfully. Verified on the box rather than from its own output:

| | before | after |
| --- | --- | --- |
| gate started | 2026-09-23 21:35 UTC | **2026-10-01 14:40 UTC** |
| `liveRoster` (FB-218) on the box | **absent** | present |
| `oneCharacterPerTicket` (FB-231) | **absent** | present |
| `office-gate-lib.mjs` SHA256 | — | **identical to `main`** |

The gate answers correctly, checked three ways:

- a ticket signed seconds earlier → **200**
- the same ticket with one character appended → **401**
- a correctly-signed ticket naming **another venture** → **401** (non-negotiable 6, from outside)

And the room was rendered and looked at: it draws, with no console errors, and it is **empty**.

## The number the deploy was for

    transcripts on the box      : 625
    written in the last 30 min  : 0
    newest written              : 2026-10-01 01:48  (13 hours ago)

**Before this deploy the office would have drawn 625 figures over a machine where nothing had run for
thirteen hours.** FB-218 was written against a room of 120; the real number on ARCA today is five
times that. It now draws none, which is the truth.

## Acceptance criteria

- [x] `provision-office.sh` runs to completion against a real box.
- [x] The gate on ARCA is byte-identical to what `main` holds.
- [x] The gate still refuses a tampered ticket and another venture's ticket.
- [x] The room renders, and its emptiness is checked against whether anything is actually running.

## Follow-on, not done here

`provision-lint` does not fail on an undefined variable. Enabling shellcheck's `SC2154` across the
provisioning scripts would have caught this before it reached a box, and would be worth doing before
the next script is written rather than after it fails.
