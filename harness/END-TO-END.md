# End to end: what a founder and John do in the studio

Journeys 1 to 3 are the studio today. Journeys 4 to 7 are the factory page, and each passes once its
step in `docs/prd/factory-pilot-release.md` is merged. A journey that changes is updated in that
issue's pull request, with John's approval, because `harness/` is a protected path.

**The test copy** is a fresh copy of the studio, started by the factory's runtime check for each
run. It reads the test fixtures, not GitHub. People sign in through the test sign-in door
(`E2E_TEST_LOGIN` and its secret). The founders are `arca.founder@bruntsfield.capital` (ARCA) and
`ross@bruntsfield.capital` (THE RESET). John is the address in `STUDIO_ADMIN_EMAILS`.

**Recorded** means the studio's server accepted it. In the test copy only, each decision and press
is also written as one line to a file in the copy's state folder, so the checker can count them.
**The stand-in factory** is a small program the checker runs in place of the planning box. It sends
cards through the box's door, and collects presses from it.

## 1. A founder arrives at their own venture

ARCA's founder opens the studio while signed out, and is sent to `/login`. They sign in, and land
straight on ARCA's desk. The desk names ARCA and says how many decisions wait on them.

**Value:** one founder, one venture, no picker.
**Checked by:** a signed-out request for `/` is sent to `/login`. After sign-in, `/` leads to
`/venture/arca`, and the page holds ARCA's name and no other venture's.

## 2. A founder refuses a piece of work, with a reason

From "Needs you", ARCA's founder opens a waiting item, presses "Refuse, and say why", types a
reason and sends it. The item leaves "Needs you" and shows as refused, with their reason.

**Value:** one recorded refusal, carrying the founder's email and their reason.
**Checked by:** the state folder holds exactly one new decision, of kind refused, for that item.

## 3. John sees every venture

John signs in. He sees the ledger with a row for each venture: ARCA, THE RESET and Modernisation
Engine.

**Value:** the partner's view, which no founder gets.
**Checked by:** a row for every venture in `ventures/` except the example.

## 4. A founder sees their venture's cards, in Telegram's words

The stand-in factory sends four cards. One is ARCA's "🟡 Needs you". One is a stuck card on an ARCA
ticket, with Try again, Split it and Stop. One is THE RESET's "🔴 Failed". One is a "✅ Done" on
cowgate, one of Bruntsfield's own repositories. ARCA's founder opens the factory page.

**Value:** exactly the two ARCA cards, with the same words the cards carry for Telegram. There is
no "Open the run in Archon" link. What a founder sees of the costs is John's decision 4 in the
release plan. John sees all four cards, each with its cost against its issue's budget.
**Checked by:** the page text matches each card's text as the stand-in sent it, word for word.

## 5. A press goes through the factory's own path

John presses Stop on ARCA's stuck card. The page says "Sent to the factory". The stand-in collects
the press, acts, and reports back. The card then shows the result, and its buttons are gone.
Pressed again, it says: "This card is out of date: the run isn't waiting at it any more. Nothing was
done." A press the stand-in reports from Telegram also shows on the page.

**Value:** one press, recorded once, collected once.
**Checked by:** one press in the state folder, and one collection in the stand-in's log.

## 6. Founder A can't see or press founder B's card

ARCA's founder tries to reach THE RESET's card four ways:

- in the list;
- by its address, typed directly;
- by calling the studio's press door directly, with that card's id;
- through `/venture/the-reset/factory`.

Each way gets nothing. The cowgate card never shows to a founder either. A button John keeps for
himself (decisions 1 and 2 in the release plan) is refused in the same way when the founder presses
it on their own card.

**Value:** isolation that holds on the server, not just in the page.
**Checked by:** a typed-in address for B's card gets the same answer as an id that doesn't exist.
No press is recorded. The stand-in has nothing to collect. B's card is unchanged.

## 7. The factory goes quiet

The stand-in stops reporting. After the set time, the page shows one line: "The factory hasn't
reported since 10:42. These cards may be out of date." The buttons are switched off, and the page
says why. A press the factory never collected ends with "Nothing was done." When the stand-in reports
again, the buttons come back.

**Value:** a founder is never shown a live-looking button that does nothing.
**Checked by:** the line and the switched-off buttons, before and after.
