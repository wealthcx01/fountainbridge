# FB-244 — re-provisioning the office mints a new secret and breaks the founder's view

**Status:** Done · **Phase:** 3 · **Found by:** a dry run before deploying the office to ARCA, 2026-10-01

## What the dry run said, on its first line

    $ scripts/provision-office.sh arca --dry-run
    [office] generated a new office secret for arca

That is the whole fault. The studio signs every watching ticket with its own copy of that secret
(`OFFICE_SECRET_ARCA`). Mint a new one on the box and the gate refuses every ticket the studio
signs — so the founder's office stops working, and stays broken until a person remembers the two
manual commands this script prints at the end.

The script's own header promises the opposite:

> Idempotent: re-running installs the same pinned version, rewrites the same unit, and leaves an
> already-correct Caddyfile alone.

Nothing there says "and rotates the credential the studio depends on". A reader would reasonably
re-run it to ship a code change — which is exactly what it is for now — and break the thing they were
fixing.

## Why it mattered today

ARCA's office gate has been running since **2026-09-23 21:35 UTC**. FB-218 (which stops the room
filling with agents that finished days ago) merged on the 29th, and FB-231 (one character per
ticket, rather than five to eleven) on the 30th. **Neither is on the box.** The deploy that fixes
that is a re-provision, and a re-provision was the one thing that would have broken the office while
doing it.

## What changed

An existing secret is now **reused**. One is generated only when the box has none, or when
`--rotate-secret` is passed outright.

- Default: read the secret from the box's own `gate.env`, keep it, and say so. The studio needs no
  change, which is the point — shipping a fixed gate should not touch a credential at all.
- `--rotate-secret`: mint one, and print the studio's two manual steps as before.
- The studio steps are printed **only when the secret actually changed**. Printing them on every run
  trains a reader to skip them on the run where they matter.

The rule they were there for is unchanged: a secret is never shared **between ventures**. That is
about two boxes, not about two runs against one box.

## A second bug found while fixing the first

`GATE_DIR` was defined at line 147 and the new code reads the secret at line 88. A shell variable
used before it is set is an empty string, not an error, so the read would have looked in `/gate.env`,
found nothing, and **silently generated a new secret anyway** — the original fault wearing the fix's
clothes. Moved up beside the other path constants.

## Checks

- `bash -n`; shellcheck runs in CI.
- Dry run against ARCA now reports *"reusing the office secret already on
  chat.arca.bruntsfield.capital — not rotated, so the studio needs no change"*.
- `--rotate-secret` still reports the rotation and still prints the studio's half.
- **The secret is never printed on the reuse path** — checked by reading the real one off the box and
  grepping the whole dry-run output for it.

## Acceptance criteria

- [x] Re-provisioning an existing office does not change its secret.
- [x] A box with no secret still gets one.
- [x] Rotation is still possible, and still tells the operator what the studio needs.
- [x] The secret is not printed when it has not changed.

## What this unblocks, and what it does not

It makes the ARCA office deploy **safe**. It does not make it **done**: pushing the current gate to
ARCA's box is a deploy, and under non-negotiable 4 a deploy waits on a recorded human approval. The
ask is in that conversation, not in this ticket.
