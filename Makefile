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
#   shellcheck's settings live in .shellcheckrc at the repo root, so they apply to a run by hand too
#   (FB-246). The one that matters: uppercase variables that are never assigned are a failure, which
#   is how provision-office.sh shipped a fatal undefined SCRIPT_DIR past this target.
# scripts (FB-039/040/041) — the RPIV engine is only linted here, never executed (it touches the box).
#
# design-lint: enforce the studio design contract (FB-057, docs/studio-design-contract.md) — tokens
# only, one status vocabulary, no dead controls. Needs no install; it reads app/ and components/.
#
# copy-lint: enforce the founder vocabulary contract (FB-103, lib/glossary.ts) — no engineering word
# reaches a founder's screen without a reasoned per-line opt-out. Needs no install; it reads app/,
# components/ and the copy-bearing modules in lib/.
#
# activegraph-test: the approval gate in real ActiveGraph (FB-171). Builds a throwaway virtualenv in
# .ag-venv with the same pinned version the box runs, then runs the gate's tests against it. Needs
# `uv` or a Python with ensurepip; CI uses setup-python.
#
# sign-approval-fixtures: re-sign the e2e approval fixtures after adding or renaming one. Since
# FB-051 an unsigned grant reads `unattested` and stays `proposed`, so a fixture that means
# "granted" has to be signed like the real thing.

.PHONY: validate-manifests parse-tickets provision-lint design-lint copy-lint sign-approval-fixtures ticket-drift activegraph-test

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

ACTIVEGRAPH_PIN ?= 1.10.0
activegraph-test:
	@if [ ! -x .ag-venv/bin/python ]; then \
		if command -v uv >/dev/null 2>&1; then uv venv .ag-venv --python 3.12 && VIRTUAL_ENV=.ag-venv uv pip install activegraph==$(ACTIVEGRAPH_PIN); \
		else python3 -m venv .ag-venv && .ag-venv/bin/pip install activegraph==$(ACTIVEGRAPH_PIN); fi; \
	fi
	.ag-venv/bin/python -m unittest deploy/activegraph/test_foundry_graph.py

# ticket-drift: fail when a ticket file says work is in progress that git says already shipped
# (FB-070). Eight tickets were lying on 2026-07-31 and the only reason anyone noticed was that
# someone happened to check; the first run of this found eighteen.
ticket-drift:
	bun scripts/ticket-drift.mjs

provision-lint:
	# FB-246: the linter's own test. shellcheck MUST fail on this file; if it ever passes, the
	# setting that catches undefined uppercase variables has stopped applying and every script here
	# would silently lose the check. A configuration file is a claim — this checks the claim.
	@if shellcheck scripts/lint-canary/undefined-uppercase.sh >/dev/null 2>&1; then \
		echo "provision-lint: shellcheck PASSED the canary — check .shellcheckrc is being read"; exit 1; \
	else echo "provision-lint: the undefined-variable check is live (canary fails, as it must)"; fi
	bash -n scripts/provision-venture.sh
	shellcheck scripts/provision-venture.sh
	bash -n scripts/provision-office.sh
	shellcheck scripts/provision-office.sh
	bash -n scripts/sync-box.sh
	shellcheck scripts/sync-box.sh
	node --check deploy/office/office-gate.mjs
	node --check deploy/office/office-gate-lib.mjs
	for f in deploy/lane/*.sh; do bash -n "$$f"; done
	shellcheck deploy/lane/*.sh
	# FB-176: the box's credential scripts ship to a venture box like the lane's do, and a script
	# that runs as root on a box is the last place to skip a linter.
	bash -n deploy/foundry/install-credentials.sh
	shellcheck deploy/foundry/install-credentials.sh
	bash -n deploy/foundry/git-credential-foundry
	shellcheck deploy/foundry/git-credential-foundry
	node --check deploy/foundry/secret-scan.mjs
	# FB-239: the venture box's request for a ticket machine, and the machine's own calls to the studio.
	for f in deploy/lane/ticket-machine.mjs deploy/lane/worker-call.mjs; do node --check "$$f"; done
	for f in deploy/librechat/*.sh; do bash -n "$$f"; done
	shellcheck deploy/librechat/*.sh
