# Venture manifests

A **venture manifest** is one YAML file per venture under `ventures/`, validated against the
`Venture` contract from **bcap-contracts** (`schema/Venture.schema.json`, pinned to 0.1.0). This is
the discipline that keeps the studio generic: everything venture-specific is config, nothing
venture-specific lives in the studio core (FB-002 D4). A B2B, bank-sponsored wealth product is
"just another manifest" with different connectors and gates.

- **Launch venture:** `ventures/the-reset.yaml` (D5 — in the studio from Phase 1 v0).
- **Fixture venture:** `ventures/arca.yaml` (a real repo with an empty ticket queue — exercises
  scoping and parser tolerance before changes reach The Reset's view).
- **Template:** `ventures/example-venture.yaml` documents every field inline — copy it to
  onboard a new venture (next Tier 3 pick: CANON).

## Adding a venture

1. `cp ventures/example-venture.yaml ventures/<slug>.yaml` and edit. `<slug>` is the venture `id`
   (lowercase-kebab).
2. Fill the required fields (below). Leave `vps` out until FB-011 provisions the box.
3. `make validate-manifests` — must pass before you open a PR. CI runs the same check (the
   `Validate manifests` job).
4. One ticket = one branch = one PR; never merge.

## Field semantics

Required top-level: **`id`**, **`name`**, **`founder`**. Everything else is optional but every
real venture should declare `approval_matrix`, `repos`, `lanes`, and `departments`.

| Field | Meaning |
|---|---|
| `id` | Venture slug, the studio's scoping key (e.g. `the-reset`, `arca`). |
| `name` | Human-readable name (`THE RESET`). |
| `status` | `draft` \| `active` \| `paused` \| `archived` (default `draft`). |
| `tier3_ref` | Optional reference into the Tier 3 venture pack. |
| `founder` | The **product** founder — `name`, `github_login` (their own GitHub account, D2), `workspace_email`. See "One founder field" below. |
| `vps` | The venture's own box (D1): `host`, `provider`, optional `provisioned_at`. Omit until FB-011 fills it. |
| `approval_matrix` | D7 governance: rows mapping a `change_class` (`product-visible` \| `platform-infra` \| `high-blast-radius`) to an `approver` (`founder` \| `bruntsfield` \| `dual`). |
| `repos` | Repo slugs owned by the venture. |
| `lanes` | Workshop lanes (`id`, `venture_id`, `repo`, `tmux`, `standing_order`, optional `status`). |
| `departments` | Departments (`id`, `venture_id`, `name`, `repo`, `queue_path`, optional `connectors`, `gate`). `gate` ∈ `pr` \| `activegraph` \| `tbd-fb012`. |
| `connectors` | Connector names available to the venture. |

### One founder field (product authority)

The contract carries a **single** `founder` — the product authority (D7). For THE RESET that is
Ross; John (Bruntsfield/platform authority) is **not** a second founder field — his authority is
expressed through `approval_matrix` (`platform-infra` → `bruntsfield`, `high-blast-radius` →
`dual`), and he sees every venture as the Bruntsfield admin (D6 scoping), independent of any
per-venture founder. For the ARCA fixture, John is the founder.

### founder.workspace_email — never a personal mailbox

`workspace_email` is a Bruntsfield-assigned account on the venture's Google Workspace domain
(e.g. `ross@thereset.com`), managed by the founder. It is the studio login (Google OAuth) and the
venture-scoping key (D6). It must **never** be a personal consumer mailbox — the validator rejects
`gmail.com` / `googlemail.com` (D3, `docs/research-gtm.md` §1), mirroring the Pydantic contract's
own guard. FB-011 provisions the real identity.

## Validation

`make validate-manifests` runs `tools/manifest-validate` (a small, isolated Node/ajv tool — kept
out of the repo root so it needs no studio app; the app arrives in FB-005). It:

1. validates each `ventures/*.yaml` against `schema/Venture.schema.json` (structural), and
2. enforces two guarantees the JSON Schema can't express: `workspace_email` is not a consumer
   mailbox, and every embedded `lane`/`department` `venture_id` matches the venture `id`.

A deliberately-broken fixture (`tools/manifest-validate/fixtures/broken-venture.yaml`) proves the
validator actually rejects bad input — the self-test asserts it fails with specific errors, so a
green CI means "the validator works," not "the validator never complains."

The vendored `schema/Venture.schema.json` is pinned to bcap-contracts **0.1.0**. When bcap-contracts
publishes a new Venture schema, re-vendor it and re-run validation. FB-005 formalizes consuming the
contract as generated TS types.

## Generic / B2B posture rules

- **Nothing venture-specific in the studio core.** If a feature needs a venture's specifics, it
  belongs in the manifest (or the venture's `context/`/`library/`, D8), never hard-coded.
- **B2B is a manifest, not a fork.** A bank-sponsored wealth product is a venture with different
  `connectors` and `gates`; the machinery is identical. Keep the format generic enough that the
  next venture (Tier 3 or a B2B pilot) onboards by copying the template.
- **Secrets never live here.** Venture secrets live on the venture's box / deployment env, never
  in the manifest, the repo, or gbrain.
