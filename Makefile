# fountainbridge — lane tasks.
#
# validate-manifests: check every ventures/*.yaml against the bcap-contracts Venture JSON Schema
# (FB-003). The validator lives in tools/manifest-validate/ (isolated from the studio app, FB-005).
#
# parse-tickets: check that docs/tickets/*.md parse into the bcap-contracts Ticket contract
# (FB-004). The parser lives in tools/ticket-parser/ (isolated from the studio app, FB-005).
#
# provision-lint: shellcheck + syntax-check the provisioning scripts (FB-011) and the venture-box lane
# scripts (FB-039/040/041) — the RPIV engine is only linted here, never executed (it touches the box).

.PHONY: validate-manifests parse-tickets provision-lint

validate-manifests:
	cd tools/manifest-validate && npm ci && npm test

parse-tickets:
	cd tools/ticket-parser && npm ci && npm run typecheck && npm test

provision-lint:
	bash -n scripts/provision-venture.sh
	shellcheck scripts/provision-venture.sh
	for f in deploy/lane/*.sh; do bash -n "$$f"; done
	shellcheck deploy/lane/*.sh
