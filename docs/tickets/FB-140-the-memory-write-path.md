# FB-140 — The memory write path (gap G9)

**Status:** Shipped in part ·  **Area:** Studio + venture repo · **Depends on:** FB-133
**Design:** `docs/design/foundry-desk/` — screen 7, the "Add" control and the "Last used" column.
**Gap:** G9.

## Why this matters (for the founder)

Day one asks the founder to hand over what they already have: *"research, notes, a deck, exports from
other conversations. Hand it over, and it becomes what Arca knows."*

Today that is not true. The composer reads a document for one message and forgets it (FB-078). A
founder who uploads their PRD, closes the tab and comes back finds the venture knows nothing about it —
which makes the first promise the studio makes to a founder the first one it breaks.

## What is true today

FB-078 reads a document per message, in memory. D8 defines `context/` and `library/` in the venture
repo, with heavy binaries in object storage and pointers in git. gbrain indexes git. `lib/knowledge.ts`
reads what is there.

## Scope

- **A persistent upload path into the venture repo**, per D8: text and light documents into
  `library/`, heavy binaries to object storage with a pointer committed.
- **gbrain indexing on write**, so a document is findable by the agents that plan from it — which is
  the entire point of handing it over.
- **Usage citations surfaced back.** The "Last used" column becomes real: a document says when the
  composer last read it. A citation that cannot be established shows nothing rather than a guess.
- **Secrets are refused, in words.** The deposit tool already rejects them; the same rule applies here
  and the refusal explains itself (CLAUDE.md #8).
- **Venture isolation** (CLAUDE.md #6): a document lands in its own venture's repo, server-side enforced.

## Out of scope

- Editing or deleting a document.
- OCR, parsing or summarising on upload. It is stored and indexed; the composer reads it.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make ticket-drift
```

On the ARCA box before review:

```
# upload a PRD → it lands in the venture repo, gbrain finds it, the composer cites it in a draft
# upload something containing a credential → refused, with a reason
```

## What was already true, and what was not

FB-106 built the upload: a document goes to `context/general/<slug>.md` on a branch and opens a
proposal, so the same human review that governs every other change governs this one. That half
persists.

**The scanning half did not exist.** The composer's deposit tool has refused credentials since the
day it was written — *"this content becomes permanent git history"* — and the studio's own Add
control **did not scan at all**. Two doors into one place and one of them guarded, on a control the
studio itself puts in front of a founder on day one.

That is fixed, and the rule now lives in `lib/secrets.ts` with a drift test asserting the box's copy
still refuses everything the studio refuses **and the reverse** — the direction that actually bit.

### Order matters, and it was wrong first

The scan runs **before** the emptiness check. A file that is nothing but a private key has little
readable prose in it, so it was refused as *"there was no readable text in it"* — a true sentence
that tells a founder the wrong thing about the most important refusal the studio makes.

## Acceptance criteria

- [x] A document uploaded from Memory persists in the venture repo per D8 — as a proposal, which is
      the gate, not a gap.
- [x] A document containing a secret is refused with an explanation, not silently stripped. Refused,
      never redacted: stripping a credential and saving the rest would tell a founder their document
      was stored while quietly changing it, and leave them believing the credential was handled when
      it had only been moved.
- [x] The refusal never repeats the credential back — it is rendered on a screen and could be read
      over a shoulder or pasted into a support thread.
- [x] A document can never land in another venture's repo, asserted by a test on the write path as
      well as the read.
- [ ] **gbrain indexes it, and the composer can cite it in a later session.** The box's
      `foundry-brain-sync.timer` is active and re-indexes the venture's git every six minutes, so a
      document is indexed once its proposal is **accepted** — not on upload, because until then it is
      not in the venture's records. That is the right behaviour and it is not the same as what this
      criterion asks; proving the cite needs a document all the way through.
- [ ] **"Last used" reflects a real read, or shows nothing.** It shows nothing today, which is the
      honest half. Making it real needs a record of what the agents read, which is **FB-156** — filed
      from FB-133 for exactly this reason, and not duplicated here.
- [ ] Proven end to end on the ARCA box — upload, index, cite. Blocked on the ARCA venture token
      (FB-072); `STUDIO_APPROVAL_GITHUB_TOKEN`'s scope is the open question and it is John's to
      settle. What is proven without it is above.

## Verified on production

Signed in as ARCA's founder, where the studio holds a real write credential — so this is the door
with the consequences behind it, not the fixture rig:

```
upload   runbook-with-a-key.txt, containing `ghp_zzzz…` among ordinary prose

refusal  "runbook-with-a-key.txt" was not saved — it looks like it contains a GitHub
         token. Anything handed over becomes part of your venture's permanent records,
         so a credential in it could not be taken back out. Remove it and hand the
         document over again.

leaks the value back?   no
says nothing was saved? yes
```

No branch, no proposal, no commit — the refusal happens before any of them.
