# FB-084 — Any file a founder has, into the corpus

**Status:** Done — Group 1 only, see below · **Phase:** 3 · **Depends on:** FB-078 (text and PDF), FB-050 (the venture
brain), FB-034 (the on-box vector store) · **Repo:** fountainbridge (+ venture box) ·
**Branch:** `fb-084-any-file-into-the-corpus` · One ticket = one branch = one PR.

**Non-negotiable** (John, 2026-08-01): a founder should be able to hand the studio **any** file —
markdown, PDF, PowerPoint, video — have it processed, and have it land in the vector store as part of
the venture's corpus. Uploading should be easy.

## Why this matters (for the founder)
Everything you know about your market is in files somebody sent you. A deck from a competitor's
investor day. A PDF of a research report. A spreadsheet of pricing. A recording of a customer call.

If the studio can only read the things you retype into it, then the venture's "knowledge" is a
transcript of your patience, not what you actually know. And the agents planning your work are
reasoning from that smaller thing without ever telling you they are.

## Where this stands after FB-078
FB-078 shipped text and PDF: attach it, the studio reads it, says what it understood, and the
composer's deposit tool files the text into `context/` as a pull request. `arca#32` proves the whole
path works, right through to the venture brain.

What it does not do is everything else — and "everything else" is most of what a founder has.

## What is actually possible, checked rather than assumed
Measured on the ARCA box on 2026-08-01:

| | Present | Consequence |
| --- | --- | --- |
| Claude Max (`claude` 2.1.197) | **yes**, `/usr/bin/claude` | a model that reads PDFs and images natively is already on the box |
| Vector store (`rag_api` + pgvector) | **yes**, both containers running | there is somewhere for embeddings to go |
| The venture brain (gbrain) | **yes**, indexes git | a second store, fed by the deposit path |
| `ffmpeg` | **no** | audio cannot be extracted from video |
| `whisper` or any transcription | **no** | audio cannot become text |
| Speech-to-text in `librechat.yaml` | **not configured** | the route exists; nothing is behind it |

So the formats divide into three groups, and honesty about which is which matters more than ambition:

**Group 1 — buildable now, no new infrastructure.** Office documents. A `.docx`, `.pptx` and `.xlsx`
are ZIP archives of XML; the text is in `word/document.xml`, `ppt/slides/slideN.xml` and
`xl/sharedStrings.xml`. This needs one tiny dependency and no service. **This ticket does it.**

**Group 2 — buildable, needs a decision.** Images, and PDFs that are scans. Claude reads both
natively — it is on the box already, and the Anthropic API takes image and document blocks directly.
The decision is *where*: the studio calling the API, or the box calling its own Claude. The box is
the right answer under D1 and needs the endpoint FB-078 also wanted and also did not build.

**Group 3 — needs infrastructure that does not exist.** Video and audio. `ffmpeg` to separate the
audio, then a transcription model — whisper.cpp on the box, or an API call which sends a customer's
voice off the venture's machine and is a decision about consent, not a technical choice. **This
ticket does not do it, and no amount of wanting it makes it a small change.**

## The second problem: there are two vector stores and the deposit reaches one
This matters as much as the formats, and it is invisible until you look.

- **gbrain** indexes the venture's git repository. A deposit lands in `context/`, and once the pull
  request is merged the brain can find it. This is the store the lanes plan from and the composer
  searches.
- **`rag_api` + pgvector** is LibreChat's own store, fed only by files uploaded on LibreChat's own
  screen — the screen FB-065 deliberately moved founders off.

So a founder who deposits through the studio reaches the brain and not the vector store; a founder
who uploads on the box's own screen reaches the vector store and not the brain. Neither is wrong on
its own and together they are a trap: the same document, filed two ways, findable by different halves
of the system.

The ticket that closes this should pick **one** store for deposited knowledge and say why. The
argument for gbrain is that it indexes git, which is already the source of truth (CLAUDE.md), and it
is what the lanes actually read. The argument for `rag_api` is that it holds embeddings of things too
big for git. That is a real design decision and it should be made deliberately, not settled by
whichever path a founder happened to use.

## Scope of THIS pull request
- **Office documents** — `.docx`, `.pptx`, `.xlsx` and their OpenDocument equivalents where the
  shape allows. Extracted in the studio alongside PDF, refused by name when malformed.
- **Slides keep their structure.** A deck extracted into one wall of words loses what made it a deck;
  slide boundaries are preserved so the text reads as slides.
- Every refusal stays specific, and nothing is ever deposited empty (FB-078's rule).

## Explicitly NOT in this pull request
- **Video and audio.** No `ffmpeg`, no transcription, and sending a customer's voice off the box is a
  consent decision rather than a technical one. Named as its own follow-up rather than half-built.
- **Images and scanned PDFs through Claude.** Needs the box-side endpoint FB-078 also deferred.
- **Choosing one vector store.** Named above; too large to bolt on here.

## Acceptance criteria
- [x] `.docx`, `.pptx` and `.xlsx` can be attached and become venture knowledge.
- [x] A deck's slide boundaries survive — and its **order** does, which the archive's does not.
- [x] A malformed office file is refused, and nothing is written.
- [x] Unsupported formats are refused with what to do instead.
- [x] The two-vector-store problem is written down above.

## Proven on the running studio
A `.pptx` written deliberately **out of order in the archive** — slide3, slide1, slide2 — and with a
layout master containing decoy text:

```
I read deck.pptx — 3 pages, about 41 words.

## Slide 1
ARCA A terminal for graded cards
## Slide 2
The wedge Card Ladder charges 150 a year. Market Movers charges 10 a month.
## Slide 3
Why now Grading volume tripled since 2021 and nobody screens on it.
```

Correct order, layout boilerplate excluded, boundaries kept. A `.docx` extracted equally cleanly —
*"Positioning brief Serious collectors want provenance they can trace & numbers they trust."* — with
the XML entity unescaped and no welded words, which is what `<w:t>Positioning</w:t><w:t>brief</w:t>`
does if you strip tags indiscriminately.

And a video was refused with the only honest answer: *"The studio cannot listen to call.mp4 yet — it
has no way to turn a recording into words. If you have a transcript or notes, those it can read."*

## A defect the walk found
The `.docx` above was **refused** on its first run, as *"most likely a scan or photographs of pages"*.

The extraction had worked perfectly. The document simply held thirteen words, under the emptiness
threshold — and the refusal assumed a cause it had not established. A founder looking at a Word file
they wrote themselves, being told it is a photograph, does not conclude "the threshold is
conservative". They conclude the studio is guessing, and then wonder what else it guesses at.

The refusal now distinguishes **nothing at all** (a scan) from **very little** (a short document that
came through fine), and says the word count so the founder can judge for themselves.

## What is NOT done — the honest ledger against a non-negotiable
The requirement was *any* format. This delivers Group 1. The rest is named, sized, and not started:

| | State | What it needs |
| --- | --- | --- |
| markdown, text, CSV, JSON, YAML | **done** (FB-078) | — |
| PDF with a text layer | **done** (FB-078) | — |
| Word, PowerPoint, Excel (modern) | **done, here** | — |
| Images, scanned PDFs | **not done** | Claude reads both natively and is already on the box; needs the box-side endpoint FB-078 also deferred |
| Older `.doc` / `.ppt` / `.xls` | **not done** | a genuinely different binary format; a converter |
| **Video and audio** | **not done** | `ffmpeg` (absent) to separate the audio, then transcription — whisper on the box, or an API call that sends a customer's voice off the venture's machine, which is a **consent decision** and not a technical one |
| One vector store rather than two | **not done** | the design decision written up above |

Video is the one worth being clearest about: it is not a small change, it is not close, and the
version of it that would be quick — post the audio to a transcription API — is the version that takes
a customer's recorded voice off the venture's own box. That is precisely the sort of thing this
system asks a human to approve, so it should be a decision, not a shortcut.

## Verification
Unit tests over each format's shape, then the real walk on ARCA: attach a genuine `.pptx` and a
`.docx`, confirm what the studio says it understood matches the file, deposit one, and read the
resulting pull request to confirm the words arrived intact.
