# fountainbridge — lane tasks.
#
# validate-manifests: check every ventures/*.yaml against the bcap-contracts Venture JSON Schema
# (FB-003). The validator lives in tools/manifest-validate/ (isolated from the studio app, FB-005).
#
# parse-tickets: check that docs/tickets/*.md parse into the bcap-contracts Ticket contract
# (FB-004). The parser lives in tools/ticket-parser/ (isolated from the studio app, FB-005).
#
# ticket-drift: fail when a ticket file says work is in progress that git says already shipped
# (FB-070). Eight tickets were lying on 2026-07-31 and the only reason anyone noticed was that
# someone happened to check; the first run of this found eighteen.
#
# provision-lint: shellcheck + syntax-check the provisioning scripts (FB-011) and the venture-box lane
# scripts (FB-039/040/041) — the RPIV engine is only linted here, never executed (it touches the box).
#
# design-lint: enforce the studio design contract (FB-057, docs/studio-design-contract.md) — tokens
# only, one status vocabulary, no dead controls. Needs no install; it reads app/ and components/.
#
# copy-lint: enforce the founder vocabulary contract (FB-103, lib/glossary.ts) — no engineering word
# reaches a founder's screen without a reasoned per-line opt-out. Needs no install; it reads app/,
# components/ and the copy-bearing modules in lib/.
#
# sign-approval-fixtures: re-sign the e2e approval fixtures after adding or renaming one. Since
# FB-051 an unsigned grant reads `unattested` and stays `proposed`, so a fixture that means
# "granted" has to be signed like the real thing.

.PHONY: validate-manifests parse-tickets provision-lint design-lint copy-lint sign-approval-fixtures ticket-drift

validate-manifests:
	cd tools/manifest-validate && npm ci && npm test

parse-tickets:
	cd tools/ticket-parser && npm ci && npm run typecheck && npm test

design-lint:
	node scripts/design-lint.mjs

copy-lint:
	node scripts/copy-lint.mjs

sign-approval-fixtures:
	node scripts/sign-approval-fixtures.mjs

# ticket-drift: fail when a ticket file says work is in progress that git says already shipped
# (FB-070). Eight tickets were lying on 2026-07-31 and the only reason anyone noticed was that
# someone happened to check; the first run of this found eighteen.
ticket-drift:
	bun scripts/ticket-drift.mjs

provision-lint:
	bash -n scripts/provision-venture.sh
	shellcheck scripts/provision-venture.sh
	bash -n scripts/sync-box.sh
	shellcheck scripts/sync-box.sh
	for f in deploy/lane/*.sh; do bash -n "$$f"; done
	shellcheck deploy/lane/*.sh
	for f in deploy/librechat/*.sh; do bash -n "$$f"; done
	shellcheck deploy/librechat/*.sh
