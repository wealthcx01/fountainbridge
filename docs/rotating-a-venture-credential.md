# Rotating a venture's credential

FB-176. The rotation this procedure exists because of was **partial**: the token was changed in the
one file anyone would think of, and stayed live in four other places. It was only caught by grepping
the whole filesystem afterwards.

So this names every consumer. If you rotate by this list and the scan at the end is clean, nothing is
stale.

## Before you start

Rotating breaks things in a specific order, and it is worth knowing which: the composer stops filing
tickets, and every `git push` the lane makes fails — with no message saying why. That is why step 6
proves the box works **before** step 7 revokes the old credential, and not the other way round.

## 1. Mint the new one

Fine-grained token, resource owner `wealthcx01`, **only** this venture's repositories from its
manifest's `repos:` block. Permissions: **Contents: Read and write**, **Pull requests: Read and
write**, Metadata read-only. Nothing else — no Administration, no Actions, no Secrets.

`docs/venture-github-token.md` has the full procedure and the 404 proof that it cannot see anything
outside the venture. Run that proof before the token goes near the box.

## 2. Put it in the one home

```bash
sudo install -d -m 0700 -o root -g root /etc/foundry
sudo -e /etc/foundry/credentials      # TICKET_GITHUB_TOKEN=<new value>
sudo chmod 600 /etc/foundry/credentials
```

If the box has not been migrated yet, run `sudo deploy/foundry/install-credentials.sh` first — it
moves what is already there and leaves a pointer in each old location.

## 3. Reload the consumers

There are two, and they take the value differently.

| consumer | how it reads the file | what to run |
| --- | --- | --- |
| the lane | systemd `EnvironmentFile=` | `sudo systemctl daemon-reload && sudo systemctl restart foundry-lane.timer` |
| the composer | docker-compose `env_file:` | `docker compose up -d --force-recreate` in `/opt/foundry/librechat` |

**The composer must be recreated, not restarted.** A container reads its env file when it is created;
`restart` reuses the old environment and the token you just rotated is still the old one inside it.
That is written in `deploy/librechat/README.md` because it has caught people before.

## 4. Repair any clone that predates the fix

`install-departments.sh` has stored a tokenless `origin` since FB-045, and `foundry-lib.sh` supplies
the credential per call. A clone made **before** that still has one baked into `.git/config`:

```bash
for d in /opt/foundry/lane/*/; do
  [ -d "$d/.git" ] || continue
  git -C "$d" remote set-url origin "https://github.com/$(git -C "$d" remote get-url origin | sed 's|.*github.com/||')"
done
```

Better, install the credential helper once and nothing has to remember:

```bash
sudo install -m 0755 deploy/foundry/git-credential-foundry /opt/foundry/git-credential-foundry
sudo git config --system credential.https://github.com.helper /opt/foundry/git-credential-foundry
```

## 5. Scrub what has already been written down

The last rotation found the token in three agent session transcripts under `/root/.claude/projects/`.
Nothing put it there on purpose. Find them, and edit or delete the files:

```bash
sudo /opt/foundry/secret-scan.mjs
```

It prints the file and the line, never the value.

## 6. Prove the box works — before revoking anything

- File one real ticket through the composer.
- Let one lane wake (`sudo systemctl start foundry-lane.service`), and check its run report.
- `git -C /opt/foundry/lane/<repo> fetch origin` succeeds.

If any of those fail, the old credential is still live and you can put it back.

## 7. Now revoke the old one

GitHub → Settings → Developer settings → Fine-grained tokens → the old token → Revoke.

## 8. Scan, and read the answer

```bash
sudo /opt/foundry/secret-scan.mjs
```

Exit 0 and *"No credential found outside /etc/foundry/credentials"* is the end of the rotation.

A finding names the file and the line. A **problem** — a path it could not read — is not a clean
result: it means the scan was incomplete, and it says so rather than reporting a box it never looked
at as healthy.

## Every consumer, in one list

Keep this current. It is the whole point of the document.

| what | where it reads from |
| --- | --- |
| the lane (`run-once.sh`, `supervisor.sh`, `foundry-lib.sh`) | systemd `EnvironmentFile=/etc/foundry/credentials` |
| the composer's ticket-filer (`ticket-mcp`) | the composer container's `env_file` |
| the deposit tool (`deposit-mcp`) | the same |
| the status connector (`status-mcp`) | the same |
| `install-departments.sh`, when adding a surface | reads the credentials file directly |
| `git fetch` / `git push` on any venture clone | the credential helper, or `origin_url()` per call |
