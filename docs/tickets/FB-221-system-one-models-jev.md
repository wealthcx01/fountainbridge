# FB-221 — System One models (TypeSafe's Jev): a fast typed decision-maker with nowhere to put it

**Verdict: DECLINE.** Jev removes a failure this studio does not have — a model returning the wrong
*shape* — while the confidence number we would have had to lean on is measurably unreliable, and every
judgement in the studio is already a rule we chose on purpose over a guess.

**Status:** Closed — its deliverable was a verdict (decline), recorded in the phased plan as D9. Closed 2026-10-07 by the October re-baseline (`docs/status/2026-10-re-baseline.md`). Was: filed · **Phase:** 3 · **Raised by:** John, 2026-09-25 · **Branch:**
`fb-221-system-one-models-decline` · One ticket = one branch = one PR.

**Sources read:** the launch post (`https://typesafe.ai/blog/introducing-system-one-models-and-jev`,
15 September 2026), the API reference (`https://docs.typesafe.ai/api.md`), the Latent Space interview
with the founder, and two independent evaluations — `github.com/priorbench/jev` (5,721 calls, 21
experiments, 50 predictions registered before collection) and a 7,977-item human-labelled
pre-registered study written up on DEV.

## What it is, in plain words

TypeSafe AI is a new lab, out of stealth in September 2026, founded by Diogo Almeida, who worked on the
training method behind ChatGPT. Their first model is **Jev**. They call the family **System One
models**, after the fast, automatic half of human thinking.

An ordinary language model writes words. You then read the words and hope they are the shape your
program expected. Jev does not write words at all. You hand it some state — a ticket, a message, a
record — and a list of typed questions, and it hands back typed answers with probabilities. There are
exactly three kinds of question:

- **Choice** — pick one of up to 255 options.
- **Score** — rate against a rubric of 2 to 10 named levels.
- **Noul** — a yes/no question, answered as a probability between 0 and 1.

One HTTP call, `POST https://api.typesafe.ai/v1/systemone`, bearer token. Many questions ride in one
call and are answered in parallel, so asking more costs almost no extra time. Input is $0.042 per
million tokens; output tokens are free. Answers come back in well under a second.

It is in **early access behind a waitlist**. No open-source release. Python and JavaScript SDKs exist.

## What is demonstrated, and what is only claimed

This matters, because it is a launch post and reads like one.

**Demonstrated, and it holds.** The output is always a valid member of the type you declared. One
independent run made **23,703 calls with zero invalid outputs**. It is genuinely fast and genuinely
cheap: roughly a tenth of a second of model time, and 800 typed judgements in a single 985 ms call for
$0.00075. For simple yes/no sorting in English it is good — 98.33% over 18,514 emails in one
independent test.

**Claimed, and not established.** The post says Jev reaches "similar levels of intelligence on System
One tasks compared to existing LLMs" while being two orders of magnitude faster and cheaper. The
numbers behind that — 193.6x faster, 444.6x cheaper — come from workflows written by TypeSafe's own
capabilities team, scored against a reference the models themselves produced. To their credit, the post
says so.

Independent work does not support the intelligence claim. The 7,977-item study put Jev **behind the
best of 19 language models on 14 of 15 tasks, by a median of 11.6 macro-F1 points** — level with the
mid-priced models, behind the frontier. A different independent run got 95.9% on its own 400-item
benchmark. The two disagree. That is the honest state of the evidence: promising, not proven.

**The claim we would have needed most is the weakest.** The whole appeal for us would be the confidence
number — let the machine decide when it is sure and hand the rest to a person. Two independent
measurements found the confidence miscalibrated (expected calibration error 0.107 and 0.071, the first
being 4.4x the noise floor), with Choice and Score **overconfident**. Worse: one evaluation fed it
random letters and got **0.99 confidence** back, and of 30 messages it got wrong at 0.99 confidence,
**none** were flagged as out of scope. A confidence score that stays high when the model is lost is not
a gate. It is a gate-shaped thing, which is worse than no gate, because you would build on it.

**And one claim is being read wrong nearly everywhere.** "0% hallucination" means the answer is always
one of the options you listed. It does not mean the answer is right. The founder says so himself in the
interview: schema safety is type safety, not accuracy.

## Why it does not fit the studio

### 1. The two things here that use a model both need it to write text

Every model call in this repo lives in two places, and both exist to produce prose or code:

- **The lane.** `deploy/lane/foundry-lib.sh` → `claude_lane()` is the single chokepoint; `claude -p` is
  invoked from `deploy/lane/supervisor.sh` five times a round (plan/PRP, implement, gate check,
  `/review`, `/qa-only`), plus `deploy/lane/run-once.sh` for a founder-facing plan and
  `deploy/lane/founding-run.sh` for a venture's first plan.
- **The composer.** `deploy/librechat/seed-agent.js` pins `claude-sonnet-5` for
  `agent_foundry_composer`.

The Next.js app makes **no model call of its own**. `app/api/composer/[id]/route.ts` is a signed proxy
in front of the box's composer agent — nothing more.

Jev gives up string generation on purpose. It cannot write a PR body, a plan, a code change or a reply
to a founder. There is no third job for it to take.

The one place this repo deliberately reserved for a model later is `lib/activity-summary.ts`, which
says: *"FB-108 leaves room for a model-written line later, behind a cache."* A **model-written line** is
precisely the thing Jev does not do.

### 2. Every judgement in the studio is already a rule, chosen over a guess, with the reason beside it

| the decision | where it lives | how it is made today |
|---|---|---|
| which department's queue to work | `deploy/lane/foundry-lib.sh` → `departments()` | declared order in `FOUNDRY_DEPARTMENTS`; first workable ticket wins |
| whether work is engineering-sensitive | `deploy/lane/run-once.sh` → blast-radius routing | one regex over auth, payment, migration, secret, deploy |
| who may approve, and whether two must | `lib/approval-attestation.ts` → `approverRoleForDepartment()`, `canApprove()` | the manifest's D7 matrix, deny by default |
| what a ticket's status is | `lib/attention.ts` | derived from the pull request's state |
| which pull request belongs to which ticket | `lib/ticket-match.ts` (FB-099) | id, then slug — **"It never guesses"** |
| which decision a founder should see first | `lib/tickets-view.ts` → `decisionOrder()` | longest-waiting first |
| whether a ticket has gone stale | `lib/ticket-drift.ts` (FB-216) | 14 days untouched while marked in progress |
| what kind of activity a commit was | `lib/activity-kind.ts` | the paths it touched, never the title; no paths ⇒ `unknown` |
| whether a document is readable | `lib/documents.ts` | extension plus a real extraction attempt |
| whether the copy uses an engineering word | `scripts/copy-lint.mjs`, `lib/glossary.ts` (FB-103) | a banned-word list |

`lib/ticket-match.ts` is the clearest case. It is the obvious home for a fuzzy matcher, and FB-099
decided against guessing: unmatched work is shown as unmatched, because two numbers six centimetres
apart telling different stories is worse than one honest gap. Swapping that rule for a probability
would undo the ticket that fixed it.

### 3. The four places it nearly fits — and why each one is a no

An honest decline has to name its own best counter-argument. There are four.

**`lib/founding-lens.ts` → `isStrategicAsk()`.** Twelve regexes decide whether a founder's message
reaches past "make this change" into "what should we be doing". This is a genuine intent classifier,
and Jev's Noul is exactly its shape. But the file's own comment explains the tuning: *"The cost of a
false positive — interrogating someone who asked for a button to move — is much higher than the cost of
a false negative."* A classifier that answers nonsense at 0.99 confidence cannot be tuned that way, and
this sits in the composer's request path, where we have already spent tickets (FB-151, FB-196) getting
latency down.

**`deploy/lane/foundry-lib.sh` → `is_external_action()`.** This is the nearest thing here to a
classification failure that actually happened, and it points the other way. A prose keyword scan
matched "emails" in SELL-001 — a positioning document that only *mentioned* emails — and the lane was
told to produce a send proposal for a ticket with no send. The fix was **not** a better guess. It was to
let the ticket declare `**Gate:**` and have the declaration win, with the scan demoted to a fallback.
When a classifier guarding an external action got it wrong, the answer was to stop guessing.

**`lib/read-failures.ts` → `causeOf()`.** Regex over error text to sort a failure into busy /
not-allowed / missing / unknown, with a comment conceding text-matching is not lovely. Jev would do
this better. It would also mean a third-party API call on the path that runs *when reads are already
failing* — the worst possible moment to add a dependency.

**FB-201's noticing pass.** The cofounder that notices needs two judgements: which observations are
worth interrupting a founder for (a Score), and whether text arriving from outside is trying to
instruct the agent rather than inform it (a Noul). Both are real and neither exists yet. The second is
the reason to still say no: it is adversarial-intent detection, and on the nearest independent test —
phishing over 2,000 messages — Jev's direct verdict scored **62.6%**. A screen that misses four in ten
attempts is not a screen.

### 4. It would be our first external dependency inside a required gate

Every job in `.github/workflows/ci.yml` — lint, typecheck, test, manifests, tickets, build, design,
copy, ticket-drift, provision — runs with **no secrets and no third-party network calls**. `grep -n
"secrets\." .github/workflows/ci.yml` returns nothing. Nothing in CI can be broken by someone else's
outage.

The most tempting CI use is the gap `scripts/copy-lint.mjs` openly admits: it checks banned words, not
whether a sentence is plain, direct English. A Score against a rubric would cover that. But this repo's
own history says an advisory check is worthless — the Playwright gate was advisory, a red one merged
itself, and FB-124 shipped a studio with two navigations and a 250px rail on a 393px phone. So it would
have to be required. That puts a pre-GA API from a two-month-old company, with no published rate
limits, no SLA and no statement on data retention or training, in front of the merge button — and makes
a required check whose answer can differ between two identical runs.

There is also nowhere to run it on a venture box. A key would need provisioning per venture and
rotating (`docs/rotating-a-venture-credential.md`), and the box would be sending one venture's ticket
text and program state to a shared third party. Our isolation rules are written about isolation between
ventures (D1, non-negotiable 6) and do not yet answer that question. Answering it is real work, for a
capability we have no use for.

## What the real gap is, and it is ours

Anyone reaching for a company called TypeSafe is reaching for typed contracts. Our typed-contract gap
is not in any vendor's product. It is here:

`ajv` and `ajv-formats` are **devDependencies**. `schema/*.json` — Venture, Ticket, RunReport,
Department, Thread, Trail, PlanDraft — is validated at build time by `tools/manifest-validate/` and in
unit tests, and **nowhere at runtime**. Everything the lane writes and the studio then reads is checked
by hand-written coercion instead: `lib/runreports.ts` → `fromLaneRecord()`, `lib/ventures.ts`,
`lib/plan-draft.ts` → `parsePlanDraft()`, `lib/threads.ts`, `lib/trail.ts`, and the fail-closed
validators on the box in `deploy/lane/proposal-lib.mjs` and `routines-lib.mjs`. Their agreement with the
schemas rests on tests, not on a shared validator. `DepartmentGate` (`pr | activegraph | tbd-fb012`) is
re-declared independently in three places: `lib/ventures.ts` as a bare string,
`lib/approval-attestation.ts` as a union, and `deploy/lane/foundry-lib.sh` as `case` arms.

That is a real, cheap, deterministic ticket, and non-negotiable 7 is about exactly it. It should be
filed. It is not this ticket.

## Scope

- Write `docs/decision-system-one-models.md`: what Jev is, the three question types, the numbers above
  with their sources, the four reasons this studio has no place for it, the four near-misses with the
  files named, and the reopen conditions below. Same shape as `docs/ideas-from-meridian.md` — adopted /
  worth applying next / explicitly not adopting — because that is the file that stopped us
  re-litigating meridian.
- Add one line to FB-201 pointing at the new document, so whoever builds the noticing pass finds this
  evaluation instead of repeating it.
- File a follow-up ticket for the runtime schema-validation gap named above. A file in this PR, not
  work in this PR.
- Add the decision document to `README.md`'s read order.

## Out of scope

- Any code change. No dependency, no API client, no key, no CI job. Declining is the deliverable.
- Joining the waitlist or testing Jev against ARCA's real tickets. That is its own ticket, and it
  should only be filed once one of the reopen conditions is met.
- Fixing the runtime schema-validation gap. The follow-up ticket is in scope; the work is not.
- The gap in `scripts/copy-lint.mjs` — that a sentence can pass the banned-word list and still be
  unreadable. It is real, it is named in CLAUDE.md #12, and it does not need this vendor.
- FB-201 itself.

## What would make us look again

Written as conditions someone can check, not as sentiment:

- [ ] Jev is generally available, with published rate limits, a data-retention statement, and a written
      commitment not to train on customer input.
- [ ] An independent evaluation shows that low confidence actually predicts being wrong, and that
      out-of-scope input is refused rather than answered at 0.99.
- [ ] FB-201 is built, and its "worth interrupting" judgement is being made badly by a rule.

If all three hold, the first use is FB-201's Score. Never a gate, never the approval matrix, never
`is_external_action()`.

## Acceptance criteria

- [ ] `docs/decision-system-one-models.md` exists, and a non-technical reader can answer three
      questions from it alone: what Jev does, why we are not using it, and what would change our mind.
- [ ] It separates what independent testing demonstrated from what the launch post asserted, and names
      both independent evaluations, including that they disagree with each other.
- [ ] It states plainly that "0% hallucination" means the output is always a valid member of the
      declared type, and does not mean the answer is correct.
- [ ] It names all four near-misses with their files, so the next person does not think we missed them.
- [ ] FB-201 links to it.
- [ ] A follow-up ticket file exists for runtime validation of lane-written artifacts against
      `schema/*.json`.
- [ ] `git diff --stat` on this branch touches only markdown. No new entry in `package.json`, no new
      secret, no new CI job.
- [ ] CI green with no new external network call.

## Verification

Documents only. There is no screen, so non-negotiable 11 does not apply — say that in the PR body
rather than leaving it blank.

Three claims in this ticket are load-bearing and were checked against the repo rather than assumed:

- **No model call in the studio app.** `grep -rlE "anthropic|ANTHROPIC|api\.openai|claude -p|claude
  --print"` across `app/`, `components/`, `lib/`, `scripts/` and `deploy/` hits only `deploy/lane/*`,
  `deploy/librechat/*`, and one test fixture in `lib/__tests__/work-evidence.test.ts`. The app's only
  model path is the proxy in `app/api/composer/[id]/route.ts`.
- **CI holds no secrets.** `grep -n "secrets\." .github/workflows/ci.yml` returns nothing.
- **`ajv` is a devDependency.** `package.json` lines 40-41; no runtime import anywhere in `lib/`,
  `app/` or `deploy/`.

Anyone who wants to overturn this decision should re-run those three checks first. If an answer has
changed, the shape of the argument has changed with it.
