// FB-005 — server-side venture registry + access scoping.
//
// The studio reads the venture manifests (ventures/*.yaml) that FB-003 validated against the
// bcap-contracts Venture contract, and decides which ventures a signed-in identity may see.
// Scoping is enforced HERE, server-side (fountainbridge non-negotiable 6 / D6), never in the UI:
//   - a Bruntsfield admin (John) sees every venture,
//   - a founder sees only the venture whose `founder.workspace_email` is theirs,
//   - anyone else sees nothing (a clean "not authorized").
//
// This module never runs in the browser (it reads the filesystem). Import it only from server
// components, route handlers, and server actions.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";

/** A lane bound to a venture repo (subset of the bcap-contracts Lane we render). */
export interface Lane {
  id: string;
  venture_id: string;
  repo: string;
  tmux: string;
  standing_order: string;
  status?: "active" | "idle" | "stale" | "archived";
}

/** A venture department (subset of the bcap-contracts Department). */
export interface Department {
  id: string;
  venture_id: string;
  name: string;
  repo: string;
  queue_path: string;
  connectors?: string[];
  gate: "pr" | "activegraph" | "tbd-fb012";
}

/** A venture manifest (subset of the bcap-contracts Venture the studio renders). */
export interface Venture {
  id: string;
  name: string;
  status?: "draft" | "active" | "paused" | "archived";
  tier3_ref?: string;
  founder: { name: string; github_login: string; workspace_email: string };
  vps?: { host: string; provider: string; provisioned_at?: string };
  approval_matrix?: { change_class: string; approver: string }[];
  repos?: string[];
  lanes?: Lane[];
  departments?: Department[];
  connectors?: string[];
}

// Directory holding the validated manifests (repo root / ventures).
const VENTURES_DIR = join(process.cwd(), "ventures");

/**
 * Bruntsfield admins see every venture (D6). Configured via BRUNTSFIELD_ADMIN_EMAILS
 * (comma-separated); defaults to John's Workspace account. Admin identity is separate from any
 * per-venture founder field — John is arca's founder AND an all-ventures admin.
 */
export function adminEmails(): string[] {
  const raw = process.env.BRUNTSFIELD_ADMIN_EMAILS ?? "john.gallagher@wealthcx.com";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

let _cache: Venture[] | null = null;

/** Load and cache every venture manifest. Manifests are validated in CI (FB-003), so parsing is
 * tolerant here: a malformed file is skipped with a warning rather than crashing the studio. */
export function loadVentures(): Venture[] {
  if (_cache) return _cache;
  let files: string[] = [];
  try {
    files = readdirSync(VENTURES_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch {
    _cache = [];
    return _cache;
  }
  const ventures: Venture[] = [];
  for (const file of files) {
    // The onboarding template is documentation, not a real venture — never surface it.
    if (file.startsWith("example")) continue;
    try {
      const doc = loadYaml(readFileSync(join(VENTURES_DIR, file), "utf8")) as Venture;
      if (doc && typeof doc === "object" && doc.id && doc.founder) ventures.push(doc);
    } catch {
      // Skip unparseable manifest; CI's validate-manifests job is the real gate.
    }
  }
  ventures.sort((a, b) => a.name.localeCompare(b.name));
  _cache = ventures;
  return ventures;
}

/** Reset the manifest cache (tests). */
export function _resetVentureCache(): void {
  _cache = null;
}

/** The ventures a given identity may see. Empty array => not authorized for any venture. */
export function venturesForUser(email: string | null | undefined): Venture[] {
  const all = loadVentures();
  if (isAdmin(email)) return all;
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  return all.filter((v) => v.founder?.workspace_email?.trim().toLowerCase() === normalized);
}

/** True iff the identity may see the named venture. Use this as the server-side guard before
 * fetching any venture-scoped data — never trust a venture id from the client alone. */
export function canAccessVenture(email: string | null | undefined, ventureId: string): boolean {
  return venturesForUser(email).some((v) => v.id === ventureId);
}

/** Fetch one venture by id IF the identity may see it; otherwise null (403 upstream). */
export function getScopedVenture(
  email: string | null | undefined,
  ventureId: string,
): Venture | null {
  return venturesForUser(email).find((v) => v.id === ventureId) ?? null;
}
