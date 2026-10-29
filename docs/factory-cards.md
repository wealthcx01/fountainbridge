# The factory's door: cards, pictures, preview links and heartbeats

The planning box sends the studio four kinds of thing: **cards**, **screenshots**, **preview links**
and **heartbeats**. They all go through one door, `POST /api/factory`, signed with a secret only the
box and the studio hold. This page is what the box's side (cowgate CG-0063 and CG-0065) is built
against. The studio's side is `lib/factory-door.ts` (FB-275).

## Rules that hold for every request

- **The venture is never yours to say.** The studio works it out from the card's `repo` and the
  venture manifests' `repos`. A repository no venture lists is refused. You may send `venture` as a
  check; if it does not match the repository's venture, the request is refused.
- **Anything not marked founder-safe is John's.** A card's founder-safe parts are the fields listed
  under "Plain parts" below, by name. Every other field on a card is kept for John only and never
  reaches a founder's browser. So a new field is safe to add: it stays John's until the studio names
  it as plain. Plain parts are still checked again for a dollar figure, "What to do next" or Archon
  before a founder reads them, but do not rely on that.
- **Screenshots live in the studio's database only.** Never in git, never on disk.

## Signing

Send two headers with every request:

| Header | Value |
|---|---|
| `x-factory-timestamp` | the time now, in whole seconds since 1970 (Unix time), as digits |
| `x-factory-signature` | `sha256=` and the lower-case hex HMAC-SHA256, keyed with `FACTORY_DOOR_SECRET`, of the timestamp, a full stop, then the exact bytes of the body |

Sign the bytes you send. Do not re-encode the JSON after signing. The timestamp must be within five
minutes of the studio's clock, either way, or the request is refused; sign again on every retry.

A worked example. Secret `example-secret`, timestamp `1793782800`, body `{"kind":"heartbeat"}`:

```
signed text:  1793782800.{"kind":"heartbeat"}
header:       x-factory-signature: sha256=33fb545d78ddc9df7b1428e21a112c6776d67017c2ba13186f8b66664d200f0a
```

In a shell: `printf '%s' "$ts.$body" | openssl dgst -sha256 -hmac "$FACTORY_DOOR_SECRET"`.

## Sizes

- A screenshot request: at most 6 MB in all; the PNG itself at most 4 MB once decoded.
- Everything else: at most 64 KB.

## The four kinds

Every body is a JSON object with `kind`. Dates are ISO 8601, for example `2026-11-04T09:15:00Z`.

### `card`

One card per pull request. Send it again whenever it changes; the newest `sentAt` wins, and an
older one arriving late is refused with 409.

```json
{
  "kind": "card",
  "repo": "arca",
  "number": 21,
  "runId": "run-7f3a",
  "state": "finished",
  "sentAt": "2026-11-04T09:15:00Z",
  "previewUrl": "https://arca-pr-21.up.railway.app",

  "ref": "ARCA-072",
  "title": "Prices in pounds for every collector",
  "finishedAt": "2026-11-04T09:15:00Z",
  "headSha": "4f2c9e1",
  "summary": "Every price on ARCA now shows in pounds, whichever country a collector signs up from.",
  "changes": [{ "label": "Changed", "text": "prices show in pounds everywhere, with the pound sign." }],
  "reaches": "Every collector who sees a price on ARCA",
  "checks": { "passed": 3, "total": 3 },
  "trail": [{ "at": "2026-11-04T09:15:00Z", "tone": "ok", "text": "Your team finished it and checked it three ways." }],

  "forJohn": {
    "cost": "$2.10, of a $15 budget",
    "nextStep": "What to do next: approve it once ARCA's founder has signed it off.",
    "runUrl": "https://archon.example/runs/7f3a"
  }
}
```

**Where it is from** (needed): `repo` (the manifests' name, `arca`, or the full `wealthcx01/arca`),
`number` (the pull request), `state`, `sentAt`. Optional: `runId` (up to 100 characters),
`venture` (a check only), `previewUrl` (must be a preview address, see below; leave it out to keep
the one the studio has).

`state` is one of `finished`, `stuck`, `sent-back`, `done`, `failed`, `needs-you`. Only a `finished`
card has a Review screen.

**Plain parts** (founder-safe, by name): `ref` (up to 40 characters), `title` (needed, up to 300),
`finishedAt`, `headSha` (the commit the work and its pictures are of), `demo` (true for made-up
cards), `summary` (up to 4,000), `changes` (up to 30 of `{ label, text }`), `reaches` (up to 500),
`checks` (`{ passed, total }`), `trail` (up to 50 of `{ at, tone, text }`, where `tone` is `ok`,
`working`, `attention`, `blocked` or `idle`). Leave out what a card does not have.

**John's parts**: everything else. The Review screen shows John `forJohn.cost`, `forJohn.nextStep`
and `forJohn.runUrl` (which must be an `https://` address). Anything else is kept for him too.

### `screenshot`

One picture of one card's work. Send the card first.

```json
{
  "kind": "screenshot",
  "repo": "arca",
  "number": 21,
  "name": "after-phone",
  "headSha": "4f2c9e1",
  "takenAt": "2026-11-04T09:16:00Z",
  "png": "<the PNG, base64>"
}
```

`name` is `before-computer`, `after-computer`, `before-phone` or `after-phone` (1440×1000 and
393×851). It must be a PNG: the studio checks the first bytes and reads the size from them.
`headSha` must be the card's: a picture of another version is refused. When a newer card arrives
with a different `headSha`, the pictures of the old one are removed, so send them again.

### `preview`

The pull request's preview link, when it comes up after the card. Send `"url": null` to remove it.

```json
{ "kind": "preview", "repo": "arca", "number": 21, "url": "https://arca-pr-21.up.railway.app" }
```

A preview address is `https://` on a preview host (`*.up.railway.app`, `*.vercel.app`,
`*.netlify.app`, `*.pages.dev`), with no port and no user name (`lib/preview-address.ts`). The
studio opens it again before it draws it as a link.

### `heartbeat`

Once a minute. The studio keeps the time from your signed timestamp.

```json
{ "kind": "heartbeat", "box": "planning-box" }
```

`box` is optional (`planning-box` when left out): lower-case letters, digits and dashes.

## Answers

Every answer but the first is JSON: `{ "ok": true|false, "message": "<a sentence>" }`.

| Status | Means | Do |
|---|---|---|
| 404, not JSON | the door is closed: no `FACTORY_DOOR_SECRET` is set on this studio | ask John to set one |
| 200 | kept | nothing |
| 400 | a field is wrong; the message names it | fix the sender |
| 401 | not signed, wrongly signed, or the timestamp is more than five minutes out | check the secret and the clock |
| 409 | a newer card is already here; or a picture or preview for a card not sent yet, or of another version | send the card first, or drop it |
| 413 | too big | send less |
| 415 | the picture is not a PNG | send a PNG |
| 422 | no venture lists that repository, two do, the `venture` sent does not match, or the address is not a preview address | fix the manifest or the sender |
| 500, 503 | the studio could not keep it, or has no database | try again later; tell John if it lasts |
