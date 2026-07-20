// FB-003 — venture manifest validator.
//
// Loads each ventures/*.yaml and validates it against the vendored bcap-contracts `Venture`
// JSON Schema (schema/Venture.schema.json, pinned to bcap-contracts 0.1.0). Beyond structural
// JSON-Schema validation it mirrors two guarantees the schema alone cannot express:
//   1. founder.workspace_email is never a personal consumer mailbox (D3 — the Pydantic contract
//      enforces this; JSON Schema's `format: email` does not).
//   2. every embedded lane/department `venture_id` matches the venture `id` (loader consistency).
//
// Usage:  node validate.mjs <file.yaml> [more.yaml ...]
// Exit 0 iff every file is valid; non-zero with useful, path-anchored errors otherwise.

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { load as loadYaml } from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SCHEMA_PATH = resolve(REPO_ROOT, "schema", "Venture.schema.json");

// Consumer domains a founder's venture identity must never be (D3 / research-gtm §1).
const CONSUMER_EMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function buildValidator() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

// Extra invariants the JSON Schema can't express. Returns an array of message strings.
function semanticErrors(venture) {
  const errors = [];
  const email = venture?.founder?.workspace_email;
  if (typeof email === "string" && email.includes("@")) {
    const domain = email.trim().toLowerCase().split("@").pop();
    if (CONSUMER_EMAIL_DOMAINS.has(domain)) {
      errors.push(
        `founder.workspace_email is a personal consumer mailbox (${domain}); it must be a ` +
          `venture-domain Google Workspace account (D3, research-gtm §1)`,
      );
    }
  }
  for (const [field, items] of [
    ["lanes", venture?.lanes],
    ["departments", venture?.departments],
  ]) {
    if (!Array.isArray(items)) continue;
    items.forEach((item, i) => {
      if (item && item.venture_id !== venture.id) {
        errors.push(
          `${field}[${i}].venture_id (${JSON.stringify(item.venture_id)}) must match the ` +
            `venture id (${JSON.stringify(venture.id)})`,
        );
      }
    });
  }
  return errors;
}

// js-yaml turns unquoted ISO timestamps into JS Date objects; JSON Schema wants strings. Convert
// Dates back to ISO strings so `provisioned_at: 2026-01-01T00:00:00Z` (quoted or not) validates.
function normalizeDates(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeDates(v)]));
  }
  return value;
}

// Turn one ajv error into a readable, property-anchored message.
function formatAjvError(e) {
  const where = e.instancePath || "/";
  if (e.keyword === "additionalProperties" && e.params?.additionalProperty) {
    return `${where} unknown field '${e.params.additionalProperty}' (additional properties are forbidden)`;
  }
  if (e.keyword === "enum" && Array.isArray(e.params?.allowedValues)) {
    return `${where} ${e.message} (${e.params.allowedValues.join(", ")})`;
  }
  return `${where} ${e.message}`.trim();
}

// Validate one file. Returns { file, ok, errors: string[] }.
export function validateFile(validate, file) {
  const rel = relative(REPO_ROOT, resolve(file));
  let doc;
  try {
    doc = normalizeDates(loadYaml(readFileSync(file, "utf8")));
  } catch (err) {
    return { file: rel, ok: false, errors: [`YAML parse error: ${err.message}`] };
  }
  if (doc === null || typeof doc !== "object") {
    return { file: rel, ok: false, errors: ["manifest is empty or not a mapping"] };
  }
  const errors = [];
  if (!validate(doc)) {
    for (const e of validate.errors ?? []) errors.push(formatAjvError(e));
  }
  errors.push(...semanticErrors(doc));
  return { file: rel, ok: errors.length === 0, errors };
}

// Validate many files. Returns { results, ok }.
export function validateFiles(files) {
  const validate = buildValidator();
  const results = files.map((f) => validateFile(validate, f));
  return { results, ok: results.every((r) => r.ok) };
}

function printReport(results) {
  for (const r of results) {
    if (r.ok) {
      console.log(`  ok    ${r.file}`);
    } else {
      console.log(`  FAIL  ${r.file}`);
      for (const e of r.errors) console.log(`          - ${e}`);
    }
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} manifest(s) valid.`);
}

// CLI entry (only when run directly, not when imported by test.mjs).
if (resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: node validate.mjs <file.yaml> [more.yaml ...]");
    process.exit(2);
  }
  const { results, ok } = validateFiles(files);
  printReport(results);
  process.exit(ok ? 0 : 1);
}
