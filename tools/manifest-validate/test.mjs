// FB-003 — manifest validator self-test. Green iff:
//   - every real ventures/*.yaml validates, AND
//   - the deliberately-broken fixture FAILS with useful, specific errors.
// This is what the CI `manifests` job runs (`npm test`), so CI stays green while proving that
// the validator actually rejects bad input — a validator that never fails is worthless.

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateFiles } from "./validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const VENTURES_DIR = resolve(REPO_ROOT, "ventures");
const BROKEN = resolve(HERE, "fixtures", "broken-venture.yaml");

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures += 1;
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

// 1. Every real manifest must validate.
const realManifests = readdirSync(VENTURES_DIR)
  .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
  .map((f) => resolve(VENTURES_DIR, f));

if (realManifests.length < 3) {
  fail(`expected >=3 real manifests (the-reset, arca, example), found ${realManifests.length}`);
}

const real = validateFiles(realManifests);
for (const r of real.results) {
  if (r.ok) pass(`valid: ${r.file}`);
  else fail(`expected ${r.file} to validate, got:\n      ${r.errors.join("\n      ")}`);
}

// 2. The broken fixture must FAIL, and its errors must be specific (not a bare crash).
const broken = validateFiles([BROKEN]).results[0];
if (broken.ok) {
  fail("expected broken-venture.yaml to FAIL validation, but it passed");
} else {
  const joined = broken.errors.join(" | ").toLowerCase();
  const expectedSignals = ["gmail", "venture_id", "bogus_field", "gate"];
  const missing = expectedSignals.filter((s) => !joined.includes(s));
  if (missing.length) {
    fail(`broken fixture failed but missing expected error signal(s): ${missing.join(", ")}`);
  } else {
    pass(`broken fixture correctly rejected with ${broken.errors.length} specific error(s)`);
  }
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll manifest-validation checks passed.");
