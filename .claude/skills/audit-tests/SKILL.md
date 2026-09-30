---
name: audit-tests
description: Audit whether existing tests earn their keep and which one actually owns each contract. Use when a suite feels slow or noisy, when coverage is proposed, when a test breaks for no behavioural reason, or when auditing a subsystem. Adapted from dzhng/skills audit-tests.
---

# Audit tests

Adapted from `engineering/audit-tests` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT). Their
framing is the question this project keeps needing:

> Audit **independent proof**: what bug would escape if this test disappeared?

**Fewer tests is not the goal.** Less maintenance for the same or better confidence is.

## Why this one matters here

This repository has **1,712 unit tests and about 310 browser tests**, and has still shipped five tests that
proved nothing. Volume has never been the problem. Knowing which test owns which contract is.

`write-tests` owns how to write one and how to falsify it. **This owns whether it adds proof, and where
that proof belongs.**

## The audit

1. **Bound it.** Pick one production responsibility, not a directory. Find every test that touches it —
   unit, browser, and the source-level checks in `lib/__tests__/` that read the tree.
2. **For each test, answer one question:** what bug escapes if this disappears? If the answer is "another
   test would catch it", name that test. If nothing would catch it, that is the proof it owns.
3. **Try to make it fail.** A test whose bug you cannot name and whose failure you cannot induce is not
   coverage, whatever the line count says.
4. **Find the contracts with no owner.** The interesting output of an audit is usually the gap, not the
   duplication.
5. **Then act:** keep, repair, combine, or remove — with the reason recorded, because a deleted test looks
   identical to a test nobody wrote.

## Where proof belongs in this repository

| kind | what it should own |
|---|---|
| unit (`lib/__tests__/`) | pure decisions — tone, ordering, parsing, access rules |
| source-level (reads the tree) | structural rules a runtime test cannot prove, such as "there is only one place a grant is signed" |
| browser (`e2e/`) | what a founder sees, at 1440×1000 and 393×851 |
| visual (`scripts/visual-parity-diff.mjs`) | whether a screen is flat, empty, badly framed, or drifting from its design |

**A structural rule tested at runtime is usually untestable.** "Only one button exists" cannot be proved by
rendering one button — that is why FB-183's check reads the whole tree.

## What not to do

Do not delete a test you cannot explain. Do not merge two tests that fail for different reasons. And do not
count a test as coverage because it is green — that is the mistake this skill exists to catch.
