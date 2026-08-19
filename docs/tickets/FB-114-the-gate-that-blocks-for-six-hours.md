# FB-114 — The gate that blocks for six hours

**Status:** Done · **Phase:** 0 (CI) · **Found by:** merging FB-112 and FB-113, 2026-08-19 — the same
job wedged twice in one day · **Repo:** fountainbridge · **Asked for by:** John, 2026-08-19 — *"Get
Playwright working, uninstall and reinstall if there is an issue"* ·
**Branch:** `fb-114-the-gate-that-blocks-for-six-hours` · One ticket = one branch = one PR.

## What happened

The Playwright UI gate stopped on `Install Playwright browser` and stayed there.

- **PR #119:** started 19:15, killed by GitHub's 6-hour job ceiling at 01:15. Six hours, and the gate
  never ran a single test.
- **PR #121:** same step, same day. Caught it at 15 minutes and cancelled it by hand.

Both cleared on re-run, so the install is not broken — it is **intermittently unbounded**. That is
worse than broken, because a broken gate fails in a minute and an unbounded one holds the merge
queue all day. `main` had no route to merge while it hung.

## Why it hangs

```yaml
- name: Install Playwright browser
  run: npx playwright install --with-deps chromium
```

`--with-deps` shells out to `apt-get` to install the browser's system libraries. `apt-get` can block
indefinitely on a dpkg lock or an unresponsive mirror; it does not time out on its own. And **no job
in this workflow declared `timeout-minutes`**, so nothing bounded it below GitHub's 6-hour default.

There was also no cache, so every run re-downloaded the browser — paying the risk on every single
PR rather than only when the version changes.

## What ships

- **A bound on the job** (`timeout-minutes: 20`) and on each slow step, so a wedge costs 8 minutes,
  not 360.
- **The same bound on every other job** (`timeout-minutes: 15`). The Playwright step is where it
  happened, but nothing in the workflow was bounded — `build` hanging would have cost exactly the
  same six hours. Fixing only the one that failed would leave the others to find later.
- **The browser cached**, keyed on the resolved `@playwright/test` version. A version bump misses the
  cache deliberately: testing a new Playwright against a stale browser is the kind of green that
  means nothing.
- **The apt path taken only on a cache miss.** On a hit the browser is present and only
  `install-deps` runs. Both paths are bounded.

Deliberately **not** "uninstall and reinstall": nothing is installed wrongly. The version resolves,
the browser downloads, the tests pass — on the runs that finish. Reinstalling would have changed a
thing that was not broken and left the actual defect (an unbounded apt call) in place to hang again.

## Explicitly NOT here

- Moving to the official Playwright container image. It removes the apt step entirely and is
  probably where this ends up, but it changes how every e2e run is built and deserves its own
  ticket rather than riding on an availability fix.
- Any change to the tests themselves.

## Acceptance criteria

- [x] No job in `ci.yml` can run longer than 20 minutes.
- [x] The browser install is bounded at 8 minutes and cannot hold the queue.
- [x] The browser is cached across runs and re-fetched when the Playwright version changes.
- [x] The UI gate still passes and still uploads its screenshot gallery.
