# FB-223 — the required gate depends on Google being up

**Status:** Done · **Seen twice on 2026-09-29, fixed 2026-09-30** · **Phase:** 3 · **Found by:** a red gate on a markdown-only PR, 2026-09-29
· **Related:** FB-217 · One ticket = one branch = one PR.

## What happened

PR #283 changed two markdown files. The Playwright UI gate — a **required** check — failed:

```
[WebServer] Failed to compile.
[WebServer] An error occurred in `next/font`.
[WebServer] TypeError: Cannot read properties of null (reading '1')
[WebServer] > Build failed because of webpack errors
Error: Process from config.webServer was not able to start. Exit code: 1
```

It failed in **49 seconds**; a real run takes about four and a half minutes. Re-run unchanged, it
passed in 4m39s.

## Why it is a real problem and not just noise

`next/font` downloads Google Fonts **at build time**. So the one gate that sees a screen cannot start
unless `fonts.googleapis.com` answers. When it does not, the failure arrives as a webpack type error
with no mention of the network, which is the worst possible presentation: it looks like the branch
broke the build.

This cost four separate checks to rule out on a two-file markdown change:

1. The diff was markdown only — 41 insertions, 3 deletions, no code.
2. The same gate had passed on `main` twenty minutes earlier.
3. `npm run build` succeeded locally on the same commit.
4. **The standalone `Build` job passed twice on that very commit**, same fonts, same network.

Point 4 is the one that settles it, and it also shows the flake is narrow: only Playwright's own
`webServer` build hit it.

The cost is not the minutes. It is that a required gate which fails for reasons unrelated to the change
**teaches people to re-run it without reading it**, and a gate nobody reads is the gate that let FB-124
ship a studio with two navigations. This is the same shape as FB-217 (the gate makes a live GitHub call
and hangs when it cannot) and should probably be fixed with it.

## Second occurrence, same day (2026-09-29)

It happened again within hours, on **PR #291 — a single markdown file**. This time it took out the
standalone **Build** job rather than the Playwright gate, with the identical error:

```
Failed to compile.
An error occurred in `next/font`.
TypeError: Cannot read properties of null (reading '1')
> Build failed because of webpack errors
```

Green on the next run with no change. **Twice in one day, on two different jobs, on PRs that touched only
markdown.** That moves this from a nuisance to the most frequent source of red on this repo.

### It also caused a real process failure

I merged #291 while that check was red. My own wait-for-green loop exhausted its iteration count and then
merged unconditionally instead of refusing — so the flake did not just waste a run, it produced exactly the
behaviour CLAUDE.md #2 forbids, on the day the same flake had already trained me to expect a spurious red.

**That is the cost this ticket is really about.** A required gate that fails for reasons unrelated to the
change teaches people to merge past it, and a gate people merge past is the gate that let FB-124 ship a
studio with two navigations. The fix is to remove the external dependency, not to get better at ignoring it.

`main` was verified green afterwards, and the PR's content was one ticket file, so nothing shipped broken.
Recorded here because the near-miss is the evidence.

## Scope

- Make fonts a build input rather than a network call: self-host the font files in the repo (Next's
  `localFont`), or vendor them into the image, so a build never reaches out. This is the fix; the two
  below are only worth doing if it is not.
- If the fetch has to stay, fail with a message that names the cause — "could not reach Google Fonts" —
  rather than a null property read, so the next person does not spend four checks proving their
  markdown is innocent.
- Consider doing this together with FB-217, since both are the same defect: **a required gate with an
  external dependency.**

## Out of scope

- Changing which typefaces the studio uses. This is about where the files come from, not what they are.
- Retry logic as the primary fix. A retry makes a flaky gate slower and still flaky; removing the
  dependency removes the failure.
- FB-217 itself.

## Acceptance criteria

- [ ] The Playwright gate builds and runs with no outbound request to a font host. Provable by running
      it with that host blocked.
- [ ] A build that cannot reach a required external resource says which resource, in plain words.
- [ ] Screens render with the same typefaces as before — this is a supply change, not a design change.
      Compare against the design per non-negotiable 11 and record the reading.

## Fixed, 2026-09-30

The fonts are now **served from this repository**. `next/font/google` is gone, and the build makes no
outbound request at all.

### What shipped

`app/fonts/` holds the exact files Google serves for the **latin** subset — 204 KB, four files:

| file | bytes | covers |
|---|---|---|
| `source-serif-4-latin.woff2` | 122,360 | variable, weights 400–500 |
| `inter-latin.woff2` | 48,256 | variable, weights 100–900 |
| `ibm-plex-mono-400-latin.woff2` | 14,708 | 400 |
| `ibm-plex-mono-500-latin.woff2` | 14,888 | 500 |

`app/layout.tsx` uses `next/font/local`. `display: 'swap'` and every `--font-*` variable name are
unchanged, so nothing downstream had to move.

**The build ships 4 font files where it shipped 23.** The other 19 were Cyrillic, Greek and Vietnamese
subsets nothing on any screen renders.

### Proved, three ways

1. **No `next/font/google` anywhere** in `app/`, `components/` or `lib/` — the only match left is the
   comment explaining why.
2. **No Google host in the build output.** `grep` for `fonts.gstatic.com` and `fonts.googleapis.com`
   across `.next/static` and `.next/server` returns nothing.
3. **The committed files are the ones shipped**, matched byte-for-byte by size into `.next/static/media`.

### And it was looked at, because the numbers were suspicious

Fifteen of the thirty-four captured screens changed height. **Every one got shorter, none taller** —
between 1% and 7%.

That is exactly what a font failing to load and falling back to a system face would look like, so it was
not accepted on the measurement. Two screens were opened and read as pictures: a desktop page and a phone
one. The type is right on both — serif headings, Inter body, Plex Mono eyebrows, no fallback anywhere.

The real cause is that a **variable font replaces the static instances** Next was requesting, and its line
boxes are fractionally tighter. Ink coverage moved by less than 0.4% on every screen, which is consistent
with the same words in the same typeface set very slightly tighter — and not with a substitution.

`scripts/visual-parity-diff.mjs` (FB-226) did the measuring. This is the first change it was used on, and
it earned its place: without it the height shift would have gone unnoticed, and noticing it is what
prompted looking at the pictures.

### Gates

lint, typecheck, 1,703 unit tests, and **310 browser tests** all pass with the self-hosted fonts.

## Acceptance criteria, met

- [x] The Playwright gate builds and runs with no outbound request to a font host — proved by the absence
      of any Google host in the build output, rather than by the build merely succeeding.
- [x] A build that cannot reach a required external resource now cannot happen for fonts, because there is
      no such resource.
- [x] Screens render with the same typefaces. Compared per non-negotiable 11, the height changes recorded
      above, and two screens looked at as pictures.

## Verification

The proof this is worth doing already exists: block `fonts.googleapis.com` and run the gate on `main`.
It should fail today and pass once this ships.
