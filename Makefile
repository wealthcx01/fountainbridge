# fountainbridge — lane tasks.
#
# validate-manifests: check every ventures/*.yaml against the bcap-contracts Venture JSON Schema
# (FB-003). The validator lives in tools/manifest-validate/ (isolated from the studio app, FB-005).

.PHONY: validate-manifests

validate-manifests:
	cd tools/manifest-validate && npm ci && npm test
