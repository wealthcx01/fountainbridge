# FB-161 — The studio could only ever see a thousand files, and never said so

**Status:** Done · **Area:** Studio / reads · **Depends on:** FB-139

## What was found

FB-139 put the office on the desk, and on its first production read every chair was empty: *"your
team is not working on this venture yet."* On the box, thirty seconds earlier, the lane had woken,
parked on its daily budget and written a run report.

Two defects, one behind the other.

### 1. Liveness read heartbeats only (fixed in FB-139)

A heartbeat is written only when a wake finds **nothing** to work. A busy machine leaves reports and
no heartbeat, so the studio read a running venture as one that had never started.

### 2. The listing was capped at a thousand, silently

With that fixed, the studio said *"your team has not checked in for 1 day"* — about a machine that
had run twenty minutes earlier. On the ref:

```
runreports on foundry-state (git tree)      1,551
returned by the contents API                1,000
```

**The contents API returns at most 1,000 entries and gives back the alphabetically first ones** —
no flag, no error, no hint. The lane names reports `<slug>-<UTC timestamp>.json`, so alphabetically
first is chronologically **oldest**.

Every surface built on that listing — the engine line on every screen, the run reports, the activity
feed, the office — has been reading a window that stopped advancing on **31 August**. It got one
report worse every five minutes and would never have recovered on its own.

## Why nothing caught it

Nothing could. The fixtures hold a handful of files, so no test at any level could reach a thousand;
CI never touches a real ref; and the symptom is not an error — it is a correct-looking answer about
a slightly older world, every time, quietly diverging.

It was found by putting a picture of the machine on the screen and looking at it.

## The fix

`GitHubClient.listDir` reads the **git trees API** (`/git/trees/<ref>?recursive=1`), filtered to one
directory. Its ceiling is far higher and, when it is hit, it **says so** — `truncated: true`, which
the studio logs. A cap that announces itself can be handled; a cap that lies cannot.

Every caller benefits: run reports, approvals, routines, and the ticket listings in `file-plan`.

## Out of scope

- **Pruning the ref.** 1,551 reports and growing is a box-side housekeeping question — shard by
  month, or expire — and it is real, but a studio that can only see a thousand files is a bug at any
  size. Filed as **FB-162**.

## Acceptance criteria

- [x] `listDir` returns every entry, past a thousand.
- [x] It lists one directory, not the whole tree beneath it.
- [x] A truncated tree is said out loud rather than shown as a subset.
- [x] A missing ref is still an empty directory, so a venture with no lane reads as quiet rather than
      broken.
- [ ] ARCA's engine line reads minutes rather than days, on production. *Recorded after the deploy.*
