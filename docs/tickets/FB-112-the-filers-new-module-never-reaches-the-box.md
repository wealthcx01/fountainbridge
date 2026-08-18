# FB-112 — The filer's new module never reaches the box

**Status:** Done · **Phase:** 3 · **Found by:** deploying FB-097 to the ARCA box, 2026-08-18 —
the re-seed John asked for · **Repo:** fountainbridge (provisioning) ·
**Branch:** `fb-112-the-filers-new-module-never-reaches-the-box` · One ticket = one branch = one PR.

## What was found

FB-097 made the ticket-filer allocate real ids, and put the allocation in a sibling module:
`deploy/librechat/ticket-mcp/ids.mjs`, imported by `stdio.mjs` as `./ids.mjs`. It is covered by
`ids.test.mjs`, it is correct, and it has never run on a venture box.

The MCP servers are not built into an image. Each one is a **single file bind-mounted into the
LibreChat container** by name:

```yaml
- ./ticket-mcp/stdio.mjs:/app/foundry/ticket-filer.mjs:ro
```

`/app/foundry/` contains exactly the four files that line names — checked on the ARCA box:

```
$ docker exec librechat-api ls /app/foundry/
brain-search.mjs  deposit.mjs  status-connector.mjs  ticket-filer.mjs
```

So `import … from './ids.mjs'` resolves to `/app/foundry/ids.mjs`, which does not exist. Copying
FB-097's filer to a box and restarting would have made the composer's **only write tool** fail at
startup — a founder asks for a ticket and no tool is there. Strictly worse than the `-NEW` names
FB-097 set out to fix.

Nothing caught it because every test runs on the host, where `ids.mjs` sits next to `stdio.mjs` and
the import resolves fine. The host and the container disagree, and only the container matters.

## What ships

- **The mount**, next to the file that imports it, with a comment tying the two together so the
  next split module does not repeat this.
- **A test over the deploy config rather than the code** —
  `deploy/librechat/__tests__/mcp-mounts.test.mjs`. It reads `librechat.yaml` for the entrypoints
  LibreChat actually spawns, follows every relative import in each one, and asserts the container
  path it resolves to is mounted. It also fails on a mount whose host file is missing, because
  docker answers that by silently creating an empty directory at the target.
- Verified by removing the mount and watching the test fail with the resolved container path in the
  message.

## Explicitly NOT here

- **Making `install.sh` sync the MCP files.** It copies `docker-compose.yml` and `librechat.yaml`
  only; the `*-mcp/*.mjs` files reach a box by hand. That is a real provisioning gap — a fresh box
  gets no filer at all — but it is a change to the install path, not to this defect. Its own ticket.
- Any change to id allocation. FB-097's logic is untouched; this is only about the file arriving.

## Acceptance criteria

- [x] `/app/foundry/ids.mjs` exists in the container and the filer starts.
- [x] A relative import with no matching mount fails the test suite, naming the container path.
- [x] The ARCA box files a ticket with a real id end to end.
