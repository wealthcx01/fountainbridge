# FB-265 — A decision that has waited too long gets a way out

**Status:** Todo · **Phase:** 3 · **Kind:** a small build, one screen · **Raised by:** the October
re-baseline (`docs/status/2026-10-re-baseline.md`, section 5, ticket 3), filed 2026-10-21 at John's
request · One ticket = one branch = one PR.

## Why

On 7 October ARCA had **11 decisions waiting on its founder. The oldest had waited 68 days.** The
re-baseline found that this, not missing software, is what holds ARCA back. A founder facing a long
pile can only approve or refuse each item. Some items are simply out of date: the moment for them
has passed. Today the only honest answer to those is to leave them, so the pile never shrinks.

## What to build

1. **A setting: how many days a waiting item may wait** before it is offered a way out. One number
   per venture, in the venture's manifest, with a studio default (suggest 21 days). Not hard-coded.
2. **"Withdraw it" on the desk and on the item's own page,** beside approve and refuse, only for an
   item that has waited longer than the setting. One plain sentence says why it is offered, for
   example: "This has waited 68 days. If it no longer matters, withdraw it."
3. **Withdrawing is recorded, never silent.** It is written the way a refusal is written today
   (`refuseExternalAction` in `app/actions/approvals.ts`): who withdrew it, when, and an optional
   reason, signed the same way. "What happened" shows it as one line.
4. **A withdrawn item leaves "Needs you"** and can't be approved afterwards. As with a refused one,
   the team must propose it again if it is wanted after all.

## Acceptance

- [ ] An item older than the setting shows "Withdraw it" with its one-line reason; a younger one
      doesn't.
- [ ] Withdrawing writes a signed record; the item leaves "Needs you"; approving it afterwards is
      refused with a plain message.
- [ ] "What happened" shows the withdrawal in one line.
- [ ] The setting is read from the manifest; the default applies when it is missing.
- [ ] Unit tests for the age rule and the record; a Playwright test for the button.
- [ ] Screens looked at, beside the design, at 1440×1000 and 393×851 (non-negotiable 11). The desk
      grows by no more than one line per item.

## Out of scope

- Measuring how long decisions take (FB-159).
- Withdrawing anything automatically. A person always presses the button.
- Pull requests in "Needs you". GitHub already lets them be closed; this is for the studio's own
  waiting items.
