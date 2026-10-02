# FB-250 — the brain refused every document with a slug line

**Status:** Done · **Phase:** 3 · **Found by:** FB-169, setting up Foundry Studio's own brain

## What happened

John asked for Foundry Studio to have a brain of its own, separate from ARCA's (FB-169). While
setting it up, the first update stopped on `content/foundry/00-hero.md` and indexed nothing else.

The reason: the studio's handbook, playbook, system and Foundry pages are written as markdown files
that each start with a `slug:` line, such as `slug: hero`. The website uses it to name each section.
gbrain reads a `slug:` line as the page's name in the brain. When that name disagrees with the
file's path (`hero` against `content/foundry/00-hero`), the current gbrain refuses the file. **One
refused file stops the whole update**, so all 32 of these files blocked the entire brain.

## What changed

- The line is now called `section:` in all 32 files. The values did not change.
- The loader (`lib/content.ts`) reads `section:`. Pages still get the same name for each section.
- A test fails if any content file has a `slug:` line, and if any file in a content folder fails to
  load. The loader skips a file without the line silently, so the second test is what notices a
  section vanishing from its page.

## Acceptance criteria

- [x] No file under `content/` has a `slug:` line.
- [x] Every page shows exactly what it showed before. Checked by loading every content folder on
      `main` and on this change: all 32 sections came out identical.
- [x] Foundry Studio's own brain updates past these files.
