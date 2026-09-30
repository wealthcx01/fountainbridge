# What needs John, with the exact steps

**Updated 2026-09-30.** Four things. Each one says what it unblocks, exactly where to click, and how you
will know it worked.

Nothing here stops code being written. Two of them stop us *proving* things, which is worse: work that
cannot be shown finished tends to get reported as finished.

**A note on the instructions below.** The GitHub steps I gave on 2026-09-29 were wrong, and so were the
Supabase steps earlier in this project. Both times I described a path from memory instead of checking. The
steps here were checked against the current documentation, and where a URL is a shortcut rather than a
documented path it says so. If a screen does not match what is written here, that is my error and worth
telling me rather than hunting for it.

---

## 1. Let Railway see the arca repository

**What it unblocks:** the preview link. A founder clicking through from a ticket to the thing actually
running. It is the single biggest gap between the studio you have and one you would rely on.

**Why it is needed:** Railway talks to GitHub through a connector, and that connector is given permission
**one repository at a time**. It has permission for the studio's code. My strong suspicion is that it was
never given permission for `arca`. Everything else is already done and verified.

**Why I got this wrong last time:** I told you to go to organisation settings. **`wealthcx01` is a personal
account, not an organisation**, so that path does not exist. Below is the personal-account path.

### The steps

1. Click your **profile picture**, top right of GitHub.
2. Click **Settings**.
3. In the left sidebar, under the heading **Integrations**, click **Applications**.
4. Click the **Installed GitHub Apps** tab.
5. Find **Railway** in the list and click **Configure** next to it.
6. Scroll to **Repository access**.
7. Look at which option is selected:
   - If it says **All repositories** — Railway can already see `arca`, and this is not the problem. Stop
     here and tell me; it means Railway is behaving differently on two identically-configured projects and
     belongs with their support.
   - If it says **Only select repositories** — look at the list underneath. **Is `arca` there?**
8. If `arca` is missing: open the **Select repositories** dropdown, choose **arca**, then click **Save** at
   the bottom.

*A shortcut to step 4, if you prefer: `github.com/settings/installations`. The documentation describes the
click path rather than the URL, so the clicks above are the reliable route.*

**How you will know it worked:** tell me, and I will open one throwaway pull request on arca and watch for a
temporary environment to appear. That takes about three minutes and I will close the test immediately, as I
did twice already.

---

## 2. The memory system cannot record new work

**What it unblocks:** gbrain answering questions about anything done from 29 September onwards.

**What is actually wrong, and it is my fault.** `gbrain doctor` reported a pending migration and printed a
one-line recovery command. I ran it. It came back needing host decisions, I parked it, and **parking it was
not neutral** — from that point the index silently stopped accepting new work.

**How bad it is:** less than it sounds. Searching, symbol lookup and all 687 existing pages work normally.
Only *new* commits stop being indexed. So it degrades slowly rather than breaking.

**Why I will not fix it alone:** the fix is `gbrain sources writer activate`, and its own help says routine
maintenance must not do this. A dry run showed why — it is refused until **every** project on the machine
has a declared owner, including grassmarket's. It is a machine-wide change across three projects with a
documented procedure.

### What I need from you

Just a decision, one of:

- **"Do it"** — I read the procedure properly, then walk through it and stop at anything that would affect
  grassmarket or sd3 without saying so first.
- **"Leave it"** — fine for now. The cost is that in a month, "what did we decide about X" will miss the
  last month. Worth revisiting before that.
- **"Start fresh"** — rebuild the index from scratch. Simplest, loses nothing that is not in git, costs a
  re-index (415 files, about three minutes on this repo).

My recommendation is **start fresh**, because everything gbrain knows is derived from git anyway, and it
avoids a topology change on three projects to recover something we can rebuild.

---

## 3. A way to prove the desk loads fast enough

**What it unblocks:** the last unticked criterion on FB-170. The desk used to take six seconds. The fix
takes it from 61 requests per page load to 1, which is measured and locked in a test. **What is not proved
is the wall-clock claim**, and its checkbox stays unticked until it is.

**Why I cannot prove it:** production needs a signed-in founder. Every request without one lands on the
sign-in page, and timing that would repeat a mistake this project has already made once. Locally the
`GITHUB_TOKEN` in `.env.local` is present but **empty**, and there is no database address, so the real path
cannot run here either.

### Either of these works, whichever is easier

**Option A, quickest.** Sign in to production as ARCA's founder in a browser, open the desk, and tell me
roughly how long until you can read it. Your impression is a valid measurement and it is the one that
matters.

**Option B, repeatable.** Put a working GitHub token and the studio database address into `.env.local`. Then
I can measure it whenever it changes, not once. Deliver them **without pasting them into the chat**:

```
read -s -p 'token: ' T && printf 'GITHUB_TOKEN=%s\n' "$T" >> .env.local && unset T
```

Then the same for the database address. `.env.local` is already ignored by git.

---

## 4. Two passwords, at the end — agreed, recorded here so it is not forgotten

You have said keys get rotated when the studio is complete. Recorded rather than nagged:

- **Your Decile Hub password.** It is in a chat transcript. It also **parks the Sell pipeline** (FB-235),
  because modelling that work needs a signed-in read and I will not use a password from a log.
- **The OpenAI key** in `~/.gbrain/config.json`. I printed that file while diagnosing the memory fault, so
  it is in a transcript too. It is outside the repository, so no rule was broken, but it is exposed.

Neither blocks anything except FB-235.

---

## What I am doing while these wait

Working the outstanding tickets in priority order, starting with the ones that need nothing from you. The
order is on the ticket board and the top unblocked item is the build check that keeps failing for reasons
unrelated to the change — it has already made me merge something I should not have, which is exactly how a
required gate stops being believed.
