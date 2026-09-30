---
name: plain-english
description: Explain a change, a ticket or a screen in plain language for a founder — what problem it solves, how it works, and what it changes for them. Use when writing anything a founder reads, when a draft has gone technical, or when checking copy against non-negotiable 12. Adapted from dzhng/skills eli5.
---

# Plain English

Adapted from `engineering/eli5` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT). Renamed,
because "explain like I'm five" is the wrong register for the person this is aimed at: **a founder is not a
child, they are an expert in something else.**

> Simplify the telling, never the claims.

This is **non-negotiable 12 with a procedure**. That rule binds tickets, pull requests, commits, comments,
anything on a screen — and the last message of every turn.

## The register

Write for someone who is clever, busy, and does not live in the code. Full precision, plain words.

- **Short sentences.** The plain word over the clever one.
- **Say what happened, then what it means, then what to do.** In that order, every time.
- **Name the thing** instead of gesturing at it. "The desk" not "the relevant surface".
- **Detailed is not the opposite of simple.** A founder needs the specifics — they need them in words they
  already know.

## What this forbids

- Unexplained jargon.
- A table where a sentence would do.
- Density that saves the writer's time at the reader's expense.
- **Burying the answer at the end.**

`scripts/copy-lint.mjs` catches the mechanical part — the banned-word list, "team" not "agent". **This
covers everything it cannot**, which is most of it: a sentence can pass every automated check and still be
unreadable.

## The test

Read it back and ask: **could the founder act on this without asking a follow-up question?**

If the answer is no, the missing thing is usually one of three: what actually happened, what it means for
them, or what you need them to do.

## When explaining a change

1. **The problem, in their terms.** Not "the read model was unbounded" — "the page never finished loading".
2. **What it means.** What they saw, or would have seen.
3. **What changed**, in one or two sentences.
4. **What is still not true**, if anything. Say what was not checked rather than implying it was.
5. **What you need from them**, if anything, with the exact steps.

Step 4 is the one most often skipped and the one that builds the most trust.
