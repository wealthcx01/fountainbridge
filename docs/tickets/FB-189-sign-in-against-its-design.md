# FB-189 — Sign in was never compared, and it is the screen a founder sees before they trust anything

**Status:** Done · **Phase:** 3 · **Found by:** the FB-175 audit's own admission, compared 2026-09-04

## Why this exists

`docs/design-conformance.md` scored nine screens and said this about the tenth:

> **Sign in was never compared.** It is the one screen a founder sees before they trust anything, and
> it is not in this table because I did not do it.

It has been compared now.

## Both sides, at 1440×1000 and 393×851

| | design | live |
| --- | --- | --- |
| desktop | 1,000px | 1,000px |
| phone | 851px | 851px |

**The heights are identical and tell you nothing.** Both are one screen with no scroll, which is the
whole point of the screen and is also true of any two pages that fit. Everything below was found by
reading the picture.

## What is different

The words are right. FB-135 built the copy and FB-100 fixed the sentence that told a founder with a
password that Google was the way in. What is wrong is everything around them.

1. **The wordmark is an afterthought on the one screen it matters most.** The design gives it 24px
   serif caps, a hairline rule, then `FOUNDRY STUDIO` letterspaced in the accent. Ours is 21.6px
   **mixed case** with the sub-line crammed underneath and no rule.
2. **The hierarchy is inverted.** The design's `Sign in` is 32px and the wordmark leads. Ours is 56px
   — `--fs-h1` at this width — so the page shouts the verb and whispers whose studio it is.
3. **The fields are boxed; the design's are underlined and centred.** `border: none;
   border-bottom: 1px solid` with the text centred, and the focus state thickens the underline in the
   accent.
4. **The Sign in button is full width.** The design's is `inline-block` with 24px of side padding —
   a modest control under the fields, not a second thing competing with *Continue with Google*.
5. **The footer line has no rule above it.** The design separates it: `border-top`, 36px above,
   14px below.

## And one thing that is not only this screen

**There are two wordmarks in the product.** The rail hard-codes `BRUNTSFIELD` in caps; the top bar
and this page render `Bruntsfield` in mixed case through `.wordmark-name`. The design draws it in
caps in all three places, at 24px, 19px and 17px. Fixing it here fixes the top bar with it, which is
the right outcome — one wordmark.

## Scope

- The sign-in screen matches the design's own figures: wordmark, rule, heading size, underlined
  fields, the modest button, the footer rule.
- `.wordmark-name` becomes the design's caps, which corrects the top bar at the same time.
- Tokens, not raw values (`design-lint`).
- Both doors keep working, and the refusal path keeps its one generic message (FB-092).

## What shipped

The screen is still one screen — 1,000px on desktop, 851px on a phone, the same as the design and
the same as before. **Not one pixel of the fix shows up in the height**, which is the clearest thing
this ticket has to say about heights as a measure.

| | before | after |
| --- | --- | --- |
| wordmark | `Bruntsfield`, 21.6px, no rule | `BRUNTSFIELD`, 24px caps, hairline rule |
| heading | 56px (`--fs-h1`) | 34px (`--fs-h2`) |
| fields | boxed, left-aligned | underlined, centred, accent on focus |
| second door | full-width button | a modest centred control |
| footer | floating under the form | separated by a rule |
| divider | text between two rules | plain centred text |

And the top bar came with it: `.wordmark-name` is caps now, so the rail, the top bar and the sign-in
page finally draw the same wordmark.

## Acceptance criteria

- [x] Rendered beside the design at 1440×1000 and 393×851 and read. **1,000px and 851px, both sides.**
- [x] One wordmark in the product, in the design's form.
- [x] `Sign in` is the design's size, not the page-title size. **34px against the design's 32px.**
- [x] Both doors still sign in, and a wrong password still fails with one message and no session.
- [x] No screen scrolls sideways at either size.
