# FB-113 — A fresh box gets a composer with no tools

**Status:** Todo · **Phase:** 0 (provisioning) · **Found by:** FB-112, deploying the ticket-filer to
the ARCA box, 2026-08-19 — the mount fix was the defect; this is the gap it stood on ·
**Repo:** fountainbridge (provisioning) ·
**Branch:** `fb-113-a-fresh-box-gets-a-composer-with-no-tools` · One ticket = one branch = one PR.

## What was found

`deploy/librechat/install.sh` stages the recipe onto a new box. It copies **three** files:

```sh
cp -f "$SRC/docker-compose.yml" "$SRC/librechat.yaml" "$DEST"/   # line 43
cp    "$SRC/.env.example" "$DEST/.env"                           # line 46
```

`docker-compose.yml` bind-mounts **six** host paths that no line of the installer ever puts there:

| Host path (relative to `$DEST`) | What it is |
| --- | --- |
| `ticket-mcp/stdio.mjs` | the ticket-filer — the composer's only write tool |
| `ticket-mcp/ids.mjs` | id allocation (FB-097), mounted by FB-112 |
| `status-mcp/stdio.mjs` | "what's in review?" (FB-036) |
| `deposit-mcp/stdio.mjs` | knowledge deposit (FB-043) |
| `brain-mcp/stdio.mjs` | venture-brain search (FB-050) |
| `assets/logo.svg` | the Foundry mark |

`seed.sh` and `seed-agent.js` are not copied either, so there is nothing on the box to seed the
agents with once the stack is up.

On ARCA this was invisible because every one of those files was put there **by hand**, months of
small copies nobody wrote down. The install script has never been the thing that installs them.

## Why it fails quietly rather than loudly

A bind mount with a missing source does not error. **Docker creates an empty directory at the
target.** So on a fresh box:

- `/app/foundry/ticket-filer.mjs` exists — as a directory.
- The api container starts. Every container reports healthy.
- LibreChat spawns `node /app/foundry/ticket-filer.mjs`, node fails on a directory, and the MCP
  server never registers.
- The founder gets a composer that talks, and cannot file, deposit, search or report anything.

Provisioning "succeeds", the box looks right, and the product is hollow. That is the exact family
of failure the box-install gotchas list exists to catch, and it is currently the largest one:
FB-085 ("arca is reproducible") does not hold while the reproducible part omits the tools.

## Scope

- **Copy what the compose file mounts.** Derive it rather than hand-listing a seventh path that
  drifts: the mounted host paths are already declared in `docker-compose.yml`, so read them from
  there and copy each one, preserving directories.
- **Copy the seeding pair** (`seed.sh`, `seed-agent.js`) so a fresh box can seed its own agents.
- **Fail loudly when a source is missing**, at install time, naming the file — rather than letting
  docker turn it into an empty directory an hour later.
- **A test in the same shape as FB-112's**: every host path mounted by `docker-compose.yml` is a
  file the installer actually stages. FB-112 proved the container's view matches the compose file;
  this proves the box's view matches it too.

## Explicitly NOT here

- Changing the transport, the MCP servers, or anything they do. This is about the files arriving.
- A general deploy/rsync mechanism for the whole `deploy/` tree — `deploy/lane/*` has its own
  installers with their own state, and folding them together is a bigger design call than this gap.
- Re-provisioning ARCA. Its files are already in place; this is so the *next* venture box does not
  need the same undocumented hand-copying.

## Acceptance criteria

- [ ] Every host path bind-mounted by `docker-compose.yml` is staged by `install.sh`.
- [ ] `seed.sh` and `seed-agent.js` are on the box after an install.
- [ ] A missing source file stops the install with the path named, instead of becoming an empty
      directory inside the container.
- [ ] A test fails if a new mount is added to the compose file without the installer staging it.
- [ ] Verified on a box that was never touched by hand — the only honest test of a provisioning
      script. CI being green says nothing about whether box-side code runs.
