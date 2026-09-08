# FB-213 — a surface's "open the queue" opens everybody's queue

**Status:** filed · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-10) ·
**Branch:** `fb-213-a-surface-link-that-goes-to-that-surface` · One ticket = one branch = one PR.

## What was found

> *"open the queue →"* on each surface column links `/tickets` with no filter, **so Build, Sell and
> Scale all land on the same screen.**

Three links, three different labels' worth of promise, one destination. A founder who presses Sell's
and gets Build's work has been told something untrue by a control the studio drew.

## Why it matters

It is the same class as the `?work=` parameter nothing read (FB-138): a link that goes somewhere, but
not where its own label says. Those are worse than a missing link, because the founder has no way to
tell it did not work.

## Scope, in two steps and in this order

1. **Stop the link lying, today.** Until the filter exists, label it *"all tickets →"*. One word, and
   the studio stops promising something it does not do. This half is small enough to ship on its own
   and should not wait for the second.
2. **Then make it true.** A surface filter on Tickets (`?surface=build`), each column pointing at its
   own. `lib/tickets-view.ts` already groups by repository, and a department maps to a repository in
   the manifest — so this is a filter over data the screen holds, not a new read.

The filter should reuse the existing tab mechanism rather than adding a second way to narrow the same
list. Two filters that do not know about each other is how a screen ends up showing nothing and
explaining nothing.

## Out of scope

Changing what a surface *is*. The department → repository mapping is the manifest's (`ventures/*.yaml`)
and is not touched.

## Acceptance criteria

- [ ] Sell's link lands on Sell's tickets, and Build's on Build's.
- [ ] The surface filter and the status tabs compose, and the screen says which two are applied.
- [ ] A surface with no tickets says so, and does not read as a broken filter.
- [ ] Before the filter exists, no link claims to be per-surface.
