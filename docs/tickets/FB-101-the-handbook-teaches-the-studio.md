# FB-101 — The handbook teaches the studio

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"we are maybe needing
another section of the handbook to just understand the whole process of using the tool,
understanding how to draft tickets and follow them"* · **Repo:** fountainbridge ·
**Branch:** `fb-101-the-handbook-teaches-the-studio` · One ticket = one branch = one PR.

## The gap

The Handbook explains the *philosophy* — gates, moats, the playbook — and never the *product*. A
founder's first practical questions have no page: How do I get work done here? What happens after I
press send in the composer? What does "Needs you" want from me? What is a good ask versus a vague
one? Who is "the team"? John built most of this platform and still finds the journey confusing;
Ross arrives with none of that context.

## What ships

A new Handbook chapter — **"Using your studio"** — written in the founder's vocabulary, walking the
six verbs of the journey in order:

1. **Sign in** — the two doors (Google, email+password), and which venture you'll see.
2. **Ask** — the composer: what to say (plain English, one want at a time), what it will do
   (search what the venture knows, ask one question, read the work back, file nothing until you
   say yes), and what a good ask looks like versus a vague one — with two worked examples,
   including the real brand-redesign conversation shape.
3. **Watch** — who "your team" actually is (Claude, working on this venture's own machine, waking
   every five minutes), what the board shows while work is happening, and what "parked — needs a
   human" means.
4. **Review** — the "Needs you" queue: what each card is, what accepting does, what happens if you
   do nothing, and how to send something back.
5. **Launch** — where to see your product, and how a reviewed change relates to what's live.
6. **The rules that never bend** — nothing goes to the outside world (emails, posts, spend)
   without your recorded OK; everything is written down where you can read it later.

Plus a short **"When something looks wrong"** section: what the warning badges mean in plain words
(including "this work has no automatic checks" — it means the venture's code has no self-testing
yet, so your read of the work is the only check), and what to do about each.

## Rules for the writing

- Every term the studio's UI uses appears here with a one-line plain meaning — and nothing in this
  chapter may use a term the UI doesn't. This chapter becomes the vocabulary contract FB-103's
  copy mechanism lints against.
- No git words (branch, PR, merge, repo) except in a single "for the curious" aside that maps
  studio words to git words for founders who want it.
- Screenshots optional; short enough to read in five minutes.

## Explicitly NOT here

- Rewriting the UI copy itself (FB-100, FB-103).
- Admin/Bruntsfield documentation — this chapter is for founders only.

## Acceptance criteria

- [ ] A founder who has never seen the studio can follow the chapter through ask → review →
      accept on their real venture without asking a human anything.
- [ ] Every badge and warning a founder can meet is explained in plain words.
- [ ] "The team" is introduced by name before any page refers to it.
- [ ] The chapter renders in the Handbook nav and the e2e gallery includes it.
