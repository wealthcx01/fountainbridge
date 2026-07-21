# fountainbridge — lane tasks.
#
# validate-manifests: check every ventures/*.yaml against the bcap-contracts Venture JSON Schema
# (FB-003). The validator lives in tools/manifest-validate/ (isolated from the studio app, FB-005).
#
# parse-tickets: check that docs/tickets/*.md parse into the bcap-contracts Ticket contract
# (FB-004). The parser lives in tools/ticket-parser/ (isolated from the studio app, FB-005).

.PHONY: validate-manifests parse-tickets

validate-manifests:
	cd tools/manifest-validate && npm ci && npm test

parse-tickets:
	cd tools/ticket-parser && npm ci && npm run typecheck && npm test
