# FB-082 — A permissions error is not a rate limit

**Status:** Done · **Phase:** 2 · **Found by:** FB-077, when the fix did not make the message go
away · **Repo:** fountainbridge · **Branch:** `fb-082-a-permission-error-is-not-a-rate-limit` ·
One ticket = one branch = one PR.

## Why this matters (for the founder)
Three of your workstreams have been telling you *"GitHub rate limit hit — try refresh shortly"*.

You could have refreshed that page every minute for a week and it would never have changed, because
it was never a rate limit. The studio simply does not have permission to read those repositories, and
it has been giving you an instruction that cannot work.

Being told to do something useless is worse than being told nothing. It costs the founder their time
and it teaches them that the studio's error messages are noise.

## How it was found
FB-077 rebuilt the GitHub client to use fewer requests — conditional requests, coalescing, a
concurrency cap. Then the journey was walked again and **the message was still there.**

That is the whole value of re-walking. The temptation at that point is to assume the fix needs
tuning. Instead the numbers were checked:

```
core budget:  { limit: 5000, used: 95, remaining: 4905 }

GET /repos/wealthcx01/arca-marketing/pulls
  403
  x-ratelimit-remaining: 4896
  x-accepted-github-permissions: pull_requests=read
  { "message": "Resource not accessible by integration" }
```

**4,896 requests still in the budget.** It was never a rate limit. GitHub was saying, plainly, that
the App lacks the permission — and the studio was translating that into "try refresh shortly".

## The bug
`lib/attention.ts` classified the failure by status code alone:

```ts
if (e.status === 403 || e.status === 429) return { error: 'GitHub rate limit hit — try refresh shortly.' };
```

A 403 from GitHub means two completely different things: *you have used your budget* and *you are not
allowed to do that*. One clears by waiting. The other never does.

The client already tells them apart — `GitHubError.rateLimited` is true only for a 429, or a 403
whose remaining budget is genuinely zero. `lib/tickets.ts` uses that flag correctly and always has.
The attention queue did not, so the same underlying failure was described accurately on one surface
and falsely on another.

## What changed
The queue now uses `e.rateLimited`, and a permissions 403 gets its own message that says what it is
and, crucially, that **it will not clear on its own**:

> The studio does not have permission to read `wealthcx01/arca-marketing`. This will not clear on its
> own — an admin needs to give the Foundry GitHub App access to that repository.

## The configuration problem underneath it
The code was lying about the cause. The cause is real and is still there.

The Foundry GitHub App **is** installed on all four repositories — `/installation/repositories`
returns `arca`, `arca-marketing`, `arca-ops`, `modernisation-engine`. But listing pull requests
succeeds only on `arca`. The other three answer `Resource not accessible by integration`, and GitHub
names the missing permission in the response header: `pull_requests=read`.

Why one repository works and three do not is not resolvable from outside the App's settings, and this
ticket does not pretend to know. The likeliest reading is that the App's permission set was widened
after installation and the installation has not accepted the newer permissions for every repository —
GitHub requires an explicit approval when an App asks for more than it was granted.

**This needs John**, on his own GitHub settings:

> github.com → Settings → Developer settings → **GitHub Apps** → the Foundry Studio app →
> **Permissions & events** → confirm **Pull requests: Read-only** is requested → save. Then
> github.com → Settings → **Applications** → Installed GitHub Apps → Foundry Studio → **review and
> accept** the pending permission request.

Until that is done, three of the four workstreams cannot show their work — and now they say so
honestly instead of blaming a rate limit.

## Acceptance criteria
- [x] A permissions 403 is never described as a rate limit.
- [x] A genuine rate limit still is.
- [x] A missing repository still says so.
- [x] The permissions message says it will not clear on its own, and who can fix it.
- [ ] **The App is granted `pull_requests: read` on every venture repository.** John's, not mine.

## Verification
Three unit tests, one per cause — a permissions 403, a real rate limit, a missing repository — so the
three can never collapse back into one message.

Confirmed live before and after: the same three repositories, the same 403, with `x-ratelimit-remaining`
at 4,896 proving the budget was never the issue.

## The lesson
FB-077 was written on the assumption that "rate limit hit" meant a rate limit had been hit. It was a
reasonable assumption, it was wrong, and it survived a whole ticket because nobody checked the
premise against the wire.

The re-walk is what caught it. A fix that does not change what the founder sees has not been
verified — it has only been deployed.
