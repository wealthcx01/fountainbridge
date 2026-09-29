# Architecture replan — September 2026

**Status: PROPOSAL.** Nothing here is binding until John rules on it and this document is amended to say
so. It proposes four new decisions (**D10–D13**) and one amendment to a binding one (**D1**).

**Raised by:** John, 2026-09-29, at the mid-project check-in: *"I think we need to replan the
architecture."* Two pieces of feedback came with it — one on engineering, one on design — and they
converge on the same answer, which is the main reason to take it seriously.

**How to read this.** Each ruling states what changes, what it costs, and what I would not wave away.
Where I disagree with the feedback or with John's framing, it says so in the ruling rather than in a
footnote. Claims about outside products were checked against those products on 2026-09-29 and carry
what was actually found, including where it undercuts the idea.

---

## D10 — Claude Code is the workbench; Foundry is the ledger; the composer is the front door

**The ruling.** Stop building a chat surface that has to be as good as a general assistant. Build the
**`foundry-studio` MCP server** and let a founder's own Claude be the place work gets done.

Three surfaces, three jobs:

| | what it is for |
|---|---|
| **Claude Code** (desktop, terminal, phone) | the workbench. Planning, code, files, the actual making. |
| **Foundry MCP** | the ledger. Tickets, the trail, memory, run reports, budgets, the queue. |
| **The desk** | the spine. Read-mostly: what needs you, what happened, per-surface outcomes, the office. |

**Why this fits what is already true.** Non-negotiable 7 and the architecture spine already say git is
the record and the studio is a view and write path over it. The composer was never valuable as a chat
window — it was valuable as *the thing that turns a founder's loose sentence into a ticket file with a
trail.* **That is a tool call, not a text box.**

It also collapses **FB-144** ("two doors to one conversation"), which has sat unresolved because nobody
could say what the studio composer is for versus LibreChat. With this ruling there is one door and it is
the one the founder already has on their phone.

### The line that matters: propose, never grant

The MCP server exposes, venture-scoped by credential:

- **read** — the queue, a ticket and its trail, what happened, memory and corpus, run reports, budgets
- **write** — file a ticket, add to the corpus, comment on a ticket
- **decide** — `approval.proposed`, and **never** `approval.granted`

**That last line is the whole design.** Non-negotiable 4 says nothing external executes without a
recorded human approval, and **FB-183** is currently establishing that there is exactly one surface
where a grant gets signed. An MCP tool that could sign a grant would create a second one — invisibly, on
a device, with no screen showing what was signed. So Claude drafts and explains; the studio is where the
button is pressed. It also gives the mobile story a clean shape.

Isolation points the same way (non-negotiable 6): the credential is venture-scoped **server-side**, so a
founder's Claude cannot read another venture. Same rule, new client.

### What this costs, and what I will not wave away

1. **The composer is not only a chat.** It carries the studio's own guides (FB-079) and reads back the
   ticket file it wrote (FB-073). If Claude Code becomes the door, those have to move into the MCP tool
   definitions and their responses, or **the quality of filed tickets quietly drops** and nobody notices
   for a month.
2. **A non-technical founder may never open Claude Code.** Sell and Scale founders especially. So the
   composer is **retired as a first-class surface, not deleted**: it stays as the plain door, and the desk
   must fully serve someone who never installs anything. The MCP is the power path, never the only path.
3. **The honest counter-argument.** This is a bet that founders will install and trust a coding agent on
   their venture's machine. Some will love it; to others "Claude Code" is a stranger thing to be handed
   than a text box on a page they already trust. The mitigation is that it is **additive**: the studio
   stays whole without it, and the MCP server is useful to us and to the lanes on day one even if
   founders take a year to adopt it.

**Consequences:** the FB-140–149 composer set is re-cut as MCP tickets. The desk's write actions shrink to
approve / decline / reassign / open-in-Claude. The prompt bar becomes a launcher that seeds a Claude Code
session with ticket context rather than opening our own chat. "Discuss" on a ticket opens Claude Code with
the ticket pre-loaded.

---

## D11 — Amend D1: ephemeral per-ticket build environments, a small persistent spine

**The ruling.** D1 ("one VPS per venture, from day one") stops meaning *one machine does everything*. Split
the machine's jobs by whether they hold state.

- **Ephemeral, per ticket.** The Build lane's actual work: clone the venture, work the one ticket, run the
  tests, serve a preview, tear down. Nothing survives.
- **Persistent, small.** The things that cannot be ephemeral: the office socket, the approval record, the
  gbrain index, the composer.

**Why John is right about the direction.** A per-ticket environment gives three things we want and do not
have: no contamination between tickets, nothing long-lived to rot, and **a direct link to see exactly what
was worked on** — which is FB-184 ("every ticket carries one link to the result") arriving for free. It
also directly relieves the constraint named in the mid-project brief: ARCA is at **83% disk with 6.4 GB
free**, because every capability we ship lands on the same box forever.

### Where I disagree: the free VM is the wrong mechanism

Checked on 2026-09-29, `railway.com/free-vm` offers **2 vCPU, 2 GB memory, ready in about 1.4 seconds**,
a preview URL on port 8080, and `ssh railway.new` with no signup. It is genuinely impressive. It is also
wrong for this job, for reasons that are in its own copy:

- **"Up to 3 boxes per IP address per day."** A lane that works several tickets a day would exhaust it.
- **"60 minutes to build, then 24 hours to claim. Unclaimed boxes are deleted with their files."**
- **2 GB of memory.** ARCA currently uses ~1.9 GB *at rest* running the lane, gbrain, the composer and the
  office. Claude Code plus a gbrain index does not fit in 2 GB with room to work.
- **A shared AI budget per IP**, and IPv4 only.

So: take the **shape** (ephemeral, per ticket, preview URL) and use Railway's real ephemeral environments,
which we already pay for and already use — see the D6 amendment, which noted we lost per-PR preview URLs
moving off Vercel and should "recover via Railway PR environments." **This ruling is that recovery.** The
free VM stays what it is: an excellent way to hand someone a throwaway box, not the substrate for a venture.

### What this costs

1. **Cold start is real work.** Each environment re-clones and, if the lane is to research anything,
   re-indexes gbrain. On this repo that was 415 files and 160 seconds. Either the index is prebuilt into
   the image, or the lane queries the *persistent* brain over the network. The second is better and is why
   the brain stays on the spine.
2. **The approval record must not be ephemeral.** It is the one thing in this product that must never be
   lost or reconstructible-by-guess. It stays on the persistent side, on ground the ephemeral worker has no
   credential to write (the FB-071/FB-072 property).
3. **D1's isolation argument still has to hold.** Today isolation is physical. A shared Railway project
   with per-ticket environments makes part of it logical, which is the same risk FB-170 introduced with a
   shared database and answered with a test that tries to read across ventures and fails. **The same test
   is required here before this ships**, not after.
4. **This is a binding-decision change.** D1 is amended, not reinterpreted, and the phased plan gets the
   amendment.

---

## D12 — Agents load skills; we adopt four and write none of them twice

**The ruling.** Adopt `dzhng/skills` (MIT, 967 stars, pushed 2026-09-29) as a skill source our agents load
as needed, rather than growing our own equivalents. Four earn their place immediately, one is a dependency
rather than a capability, and one thing John asked for is better served by something already in the repo.

### The one I would take first, which was not on John's list

**`visual/compare-screenshots`.** It ships an actual `visual-parity-diff.mjs` plus an eval, and its opening
line is the thing this project learned the hard way:

> *"Decide which image is **less wrong** against what the scene should show — not whether the candidate
> matches the baseline. The baseline is just an earlier attempt; it can be wrong too."*

**That is non-negotiable 11 with a mechanism instead of a sentence.** Today "look at the screen beside its
design" is a rule enforced by me remembering to do it, and the cost of its absence was a desk at 9,908px
against a design of 1,900 with every automated gate green. The skill also does the right thing when the
answer is unclear — *"stop and ask the user"* — which is exactly our design-gap discipline rather than a
guess.

It also handles the single-image case: measuring whether a frame is flat, empty or badly framed. That is
directly useful on the **empty office** question FB-218 just opened.

### For Scale

**`graphics/launch-video`** — makes showreel-grade motion-graphics video from a repo, explicitly *"a video
to post on X/social."* Real fit, and it sets a high bar on purpose: *"if the piece could be re-skinned for
any other project, it has failed."*

**`graphics/renderer`** — and here I have to correct the framing. It is **architecture rules for GPU
rendering with TypeGPU/WebGPU**, for games and data visualisation. It is not a marketing or social tool. It
earns its place only as the thing that keeps `launch-video`'s rendering sane. Adopting it *as a Scale
capability* would be adopting a graphics-engine style guide and calling it growth.

The social *sending* half is not in either skill and is not solved by them. It stays what the ratified GTM
research says it is: drafted by an agent, **gated on a recorded approval**, and for LinkedIn, human-sent.
A video is an artifact; posting it is an external action.

### For founders defining tickets

John asked for **`dzhng/deep-research`** (MIT, 19.7k stars). It is good and it is the wrong shape for this
job: a standalone Node application needing its own search-API keys, last pushed **April 2026** — five
months stale while the skills repo was pushed today.

`dzhng/skills` already contains **`engineering/explore-unknowns`** (a five-stage walk from known-knowns to
unknown-unknowns, with references per stage) and **`engineering/auto-research`**. A skill our agents load
beats a second application to deploy, key and keep alive on every venture. **Recommendation: take the
skills, not the app** — and revisit only if a founder's research genuinely needs a search-engine crawl the
skills cannot do.

`engineering/write-spec` and `close-spec` are also worth reading against our ticket format before FB-144 is
re-cut.

### What this costs

Skills are instructions, so they carry the same risk as any instruction: they are followed most of the
time. The lesson in D13 applies to them too — anything that must happen every time needs a mechanism.

---

## D13 — Memory is state or event, and dated by a script rather than a sentence

**The ruling.** Adopt the write-path rule from Cole Medin's second-brain-rot workshop into the venture
corpus (`context/`, `library/`) and into gbrain, with the **mechanism** rather than only the instruction.

Every fact is one of two things:

- **State** — one current value that changes: a price, a status, an owner, a date. Find the matching line
  and **replace** it. Never add a second line for the same subject.
- **Event** — a thing that happened. **Append** to the log. Never edit or delete an existing entry.

> *"If unsure, append to the Log and say so. A missing state update is recoverable; a rewritten history is
> not."*

**Why this matters here specifically.** A model's default is to append, never to update — so a knowledge
base grows contradictions rather than correcting them. We already have the symptom: the mid-project brief
had to be assembled by reading tickets, and this session found a ticket that still said `filed` after its
work shipped, twice. The venture corpus will rot the same way, faster, because a lane writes to it
unattended.

### The mechanism, which is the actual finding

From the workshop, measured on a real system:

> *"'Date every entry' was followed **10% of the time as a prompt** and **94.7% of the time once a script
> added the date after the run.** Anything that must happen every time needs a mechanism, not a sentence."*

**That is the same lesson as our own Playwright gate** — it was advisory, a red one merged itself, and
FB-124 shipped a studio with two navigations. A rule without a mechanism is a suggestion.

So this ruling is three things, and only the first is a sentence:

1. The state/event rule in the instructions the lane reads.
2. **A script that stamps dates from the git diff after every write**, not a request that the model do it.
3. **A check that the log section is append-only** — in a diff of a log, red lines are a bug, because red
   plus green means a line was rewritten. That is mechanically checkable and needs no judgement.

And a fourth, to know whether any of it works: **a golden set of questions about this venture whose answers
we already know**, run against the brain periodically. The workshop's own set went from 16/26 to 23/26 after
the fix. Without it, "the memory is good" is an opinion.

**This partly supersedes FB-222 take 1.** The fire budget and `NO_REPLY` (from Buzz, FB-220) are about how
often something is *said*; this is about how it is *stored*. Both are needed and they are not the same
ticket.

---

## Sell: a pipeline shaped like the one John already runs

**Not yet a ruling, because it is not yet grounded.**

**`dzhng/crm.cli`** (MIT) describes itself as *"an open-source, headless CRM built for agents. No UI. No
dashboard. Just a CLI and a FUSE-mounted filesystem."* That is an unusually good fit: **files and a CLI
is our spine**, not a competing database, and "built for agents" is the posture the whole Sell surface
needs. Last pushed May 2026, so it is stable rather than abandoned, and small enough to read end to end.
The FUSE mount is the one thing to check on a box before committing.

**What I have not done: the Decile Hub scrape.** John gave me his login for
`bruntsfieldcapital.decilehub.com` so I could model Sell on the pipeline he already runs for raising from
LPs. I have not used it, for two reasons, and one of them is my fault to raise now rather than later:

1. **The password was pasted into a chat transcript**, so it should be changed before it is used anywhere
   else, not after. John has said keys get rotated when the studio is complete; a password now sitting in a
   log is a different case from a key on a schedule.
2. **A signed-in scrape of a third-party platform is an external action** under non-negotiable 4, and a
   standing rule on this project already forbids reproducing another product's copy even as a placeholder
   (it is the rule we wrote for cofounder.co, and it applies to Decile Hub identically). What we would take
   is the **shape** — pipeline stages, what a deal record holds, how email threads attach to a contact, what
   the dashboard chooses to show first — never its words or its screens.

So the Sell ruling waits on one decision from John and one changed password. The work it would unblock is
real and I would sequence it after D10, because a pipeline with no ledger to write to is a second store of
record.

---

## `duet-agent`: read, do not adopt yet

**`dzhng/duet-agent`** (Apache-2.0, pushed today, 46 stars) is *"an opinionated full-stack agent harness with
native memories, long running tasks, and multi-agent relay."*

Every one of those three is something we have already built and dogfooded: the lane is the harness, gbrain
is the memory, the systemd timer plus the executor is the long-running task, and the office is the relay
made visible. Adopting a harness means replacing the spine, which is the same class of decision as
`block/buzz` and gets the same answer for the same reason (see **D9**).

**What is worth taking is the same thing we took from Cole Medin and from Buzz: the model, not the code.**
At 46 stars and a few weeks old it is too early to put a founder's venture on. It is the right thing to read
before D10's MCP server is designed, because "native memories and multi-agent relay" is precisely the
territory that server sits in.

---

## What I would file, in this order

On John's ruling, and not before — these are not filed yet:

1. **The MCP server** (D10), read + write + propose, never grant. The biggest single change and the one
   everything else assumes.
2. **FB-144 rewritten** as the ruling memo: Claude Code is the workbench, the composer is the front door,
   the grant is signed in neither.
3. **`compare-screenshots` as the mechanism behind non-negotiable 11** (D12). Smallest, and it protects
   against the failure that has cost this project the most.
4. **The state/event write path plus its date-stamping script and append-only check** (D13).
5. **Ephemeral per-ticket build environments** (D11), with the cross-venture read test required *before* it
   ships.
6. **The FB-140–149 re-cut**, once 1 and 2 are settled.
7. **Sell:** `crm.cli` plus a Decile-Hub-shaped pipeline — after the password is changed and the scrape is
   approved.
8. **Scale:** `launch-video`, with sending still gated.

**Two design gaps for Claude Design, from this replan and from FB-218:**

- If the desk becomes read-mostly and its prompt bar becomes a launcher, **what does the desk look like
  when the founder's real work is happening somewhere else?** That is a different screen from the one
  designed.
- **What does an empty office look like?** FB-218's bound makes empty a normal state between wakes, and
  nobody has ruled on the picture.
