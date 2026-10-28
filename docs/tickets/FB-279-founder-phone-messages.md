# FB-279 — Founders get a message on their phone

**Status:** Todo · **Kind:** medium · **Budget:** $25 · **Rough date:** 9 November 2026 · **Pilot step:** 8 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

John hears about factory work on his phone, through Telegram. A founder only finds out by opening
the studio. John asked for founders to get phone messages too (28 October).

## What to do

When one of a founder's cards needs them (finished, stuck, or sent back to them), their phone gets a
short message in plain English with a link to the card. No dollar figures, and none of the lines
written for John. A founder hears only about their own venture.

**The channel (John, 28 October): the studio's own phone notifications, with email as the
fallback.**

- **Notifications from the studio itself.** The founder adds the studio to their phone's home screen
  and switches notifications on. Nothing goes through an outside messaging service.
- **Email for anyone who hasn't switched them on,** or whose phone no longer accepts them. The same
  short message, sent to the founder's sign-in address.
- Never both for the same card: a founder whose notification was delivered gets no email.

**Start from what exists.** The studio already installs to a phone's home screen (FB-141) and sends
push notifications (`lib/push.ts`, `lib/push-send.ts`, `lib/push-store.ts`, `lib/webpush.ts`, with an
offer to switch them on in `lib/push-offer.ts`). This ticket adds factory cards as a reason to send
one, and the email fallback, which the studio does not have yet: it needs a way to send email (for
example the same Google Workspace sending the website uses), set up by John.

## Done when

- [ ] A finished card on ARCA sends exactly one message to ARCA's founder, and none to anyone else.
- [ ] With notifications on, it arrives as a notification and no email is sent. With them off, it
  arrives as an email instead.
- [ ] A test proves a founder never gets a message about another venture.
- [ ] A founder can switch the messages off.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.
