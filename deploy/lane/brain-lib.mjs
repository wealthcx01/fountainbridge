// Foundry venture-brain helpers (FB-050) — PURE functions, no I/O.
//
// The venture's brain is a gbrain index over the venture repo (context/, library/, docs/tickets/,
// code). This module holds the parts worth testing on their own: how a page is attributed to a
// department, how a lane's results are partitioned to its own department, how a result set becomes a
// research digest a model can read, and how a ticket becomes a search question.
//
// Imported by brain-query.mjs (the lane's RESEARCH step) and brain-bridge.mjs (the composer's
// read-only query path) so both partition and format identically. Zero dependencies — node only.

export const DEPARTMENTS = ['build', 'sell', 'scale', 'general'];

// The venture's D8 knowledge areas (FB-043's deposit tool writes `<area>/<dept>/<slug>.md`).
const AREAS = ['context', 'library'];

// gbrain slugs are path-derived and flattened: `context/build/ideal-customer.md` indexes as
// `context-build-ideal-customer`. There is no path field on a search hit, so the department is read
// back off that slug prefix. Documented limitation (same spirit as foundry-lib.sh's
// ticket_department default): a top-level file literally named `context/build-thing.md` would also
// match and be read as 'build'. The deposit tool only ever writes `<area>/<dept>/<slug>.md` with the
// dept from a fixed enum, so this does not arise on the deposit path.
const DEPT_SLUG_RE = new RegExp(`^(?:${AREAS.join('|')})-(${DEPARTMENTS.join('|')})(?:-|$)`);

/**
 * The department a brain page belongs to, or null when it is shared/unattributed (tickets, code,
 * root docs — material every department's lane may read).
 * @param {string} slug gbrain page slug
 * @returns {string|null}
 */
export function pageDepartment(slug) {
  if (typeof slug !== 'string') return null;
  const m = DEPT_SLUG_RE.exec(slug.trim().toLowerCase());
  if (!m) return null;
  return m[1] === 'general' ? null : m[1];
}

/**
 * Partition a result set to one department: drop pages that belong to a DIFFERENT department, keep
 * this department's own pages plus everything shared. A `build` lane must not plan its work off the
 * Sell surface's private context (D8 department partitions).
 *
 * Three cases, and the distinction matters:
 *   - No department asked for (null/undefined/empty) → the whole set. This is the FOUNDER's path;
 *     they own every surface.
 *   - A known department → that department plus shared pages.
 *   - An UNKNOWN department (a typo, or a surface added to a manifest but not here) → shared pages
 *     only. It must never widen to everything: a caller that asked to be constrained and got the
 *     whole brain instead is a silent authorization failure, and the caller can't tell.
 * @param {Array<{slug?: string}>} results
 * @param {string|null|undefined} department
 */
export function partitionForDepartment(results, department) {
  const list = Array.isArray(results) ? results : [];
  const dept = typeof department === 'string' ? department.trim().toLowerCase() : '';
  if (!dept || dept === 'general') return list.slice();
  const known = DEPARTMENTS.includes(dept);
  return list.filter((r) => {
    const owner = pageDepartment(r && r.slug);
    return owner === null || (known && owner === dept);
  });
}

/**
 * Pull the JSON array out of a `gbrain call query` stdout.
 *
 * gbrain writes clean JSON to stdout and its diagnostics to stderr, so the common path is a plain
 * parse. The scan exists because taking the first `[` blindly would throw on a future version that
 * logs a `[WARN] …` line to stdout — and that exception would surface as "the brain has nothing",
 * silently demoting the lane to reading files. Never throws: returns [] when there is no payload.
 * @param {string} stdout
 * @returns {Array<object>}
 */
export function parseHits(stdout) {
  const s = String(stdout || '').trim();
  const end = s.lastIndexOf(']');
  if (end === -1) return [];
  for (let start = s.indexOf('['); start !== -1 && start < end; start = s.indexOf('[', start + 1)) {
    try {
      const parsed = JSON.parse(s.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not the real payload start — try the next bracket */ }
  }
  return [];
}

// The supervisor wraps the digest in <venture-knowledge> markers and tells the model everything
// inside them is reference data, never instructions. That boundary is only worth anything if the
// content cannot close it: an indexed page containing the literal closing marker would otherwise
// break out, and everything after it would read as supervisor-authored prompt text. Retrieval is by
// semantic similarity, so a single crafted file merged into the repo could aim itself at a whole
// class of tickets — and the very next phase writes code and opens a PR.
const DELIMITER_RE = /<\/?venture-knowledge\s*>?/gi;

// Collapse a chunk of markdown into one readable paragraph for the digest.
function excerpt(text, maxChars) {
  const flat = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')       // fenced code adds noise, not meaning, to a plan prompt
    .replace(DELIMITER_RE, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= maxChars) return flat;
  return `${flat.slice(0, maxChars).trimEnd()}…`;
}

/**
 * Turn gbrain hits into a compact, plain-text digest for a model prompt. Chunks are deduped to one
 * entry per page (highest-scoring chunk wins) and the whole digest is capped, so RESEARCH can never
 * blow up the PLAN prompt.
 * @param {Array<{slug?: string, title?: string, score?: number, chunk_text?: string}>} results
 * @param {{maxChars?: number, perPageChars?: number, maxPages?: number}} [opts]
 * @returns {string} '' when there is nothing worth showing
 */
export function formatDigest(results, opts = {}) {
  const { maxChars = 4000, perPageChars = 600, maxPages = 8 } = opts;
  const best = new Map();
  for (const r of Array.isArray(results) ? results : []) {
    if (!r || typeof r !== 'object') continue;
    const slug = typeof r.slug === 'string' ? r.slug : '';
    if (!slug) continue;
    const score = Number.isFinite(r.score) ? r.score : 0;
    const prev = best.get(slug);
    if (!prev || score > prev.score) best.set(slug, { slug, title: r.title, score, text: r.chunk_text });
  }
  const pages = [...best.values()].sort((a, b) => b.score - a.score).slice(0, maxPages);

  const lines = [];
  let used = 0;
  for (const p of pages) {
    const body = excerpt(p.text, perPageChars);
    if (!body) continue;
    // The label is page-controlled too, so it gets the same treatment.
    const rawLabel = p.title && p.title !== p.slug ? `${p.title} (${p.slug})` : p.slug;
    const label = String(rawLabel).replace(DELIMITER_RE, ' ').replace(/\s+/g, ' ').trim();
    const entry = `- ${label}\n  ${body}`;
    if (used + entry.length > maxChars) break;
    lines.push(entry);
    used += entry.length + 1;
  }
  return lines.join('\n');
}

/**
 * Build the RESEARCH question for a ticket: its title plus the intent/scope prose, flattened. Hybrid
 * search wants meaningful words, not markdown scaffolding — checkboxes, bullets and headings are
 * stripped and the whole thing is capped.
 * @param {string} ticketText raw ticket markdown
 * @param {{maxChars?: number}} [opts]
 */
export function researchQuestion(ticketText, opts = {}) {
  const { maxChars = 400 } = opts;
  const text = String(ticketText || '');
  const title = (/^#\s+(.+)$/m.exec(text)?.[1] || '').replace(/\s+/g, ' ').trim();

  // The sections that say what the work IS. "Out of scope"/"Verification" describe what it isn't or
  // how it's checked — both pull the query away from the subject matter. Every heading allows a
  // trailing qualifier, because real tickets in this repo carry them ("## Scope (Phase 1 …)",
  // "## Context — arca"); an exact-match alternative would silently capture nothing and quietly
  // degrade the query to a bare title.
  const wanted = /^##\s+(why this matters[^\n]*|context[^\n]*|scope[^\n]*)\s*$/i;
  const body = [];
  let capture = false;
  for (const raw of text.split('\n')) {
    const heading = /^##\s+/.test(raw);
    if (heading) { capture = wanted.test(raw.trim()); continue; }
    if (!capture) continue;
    const line = raw
      .replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '')   // task checkboxes
      .replace(/^\s*[-*]\s+/, '')
      .replace(/[`*_>]/g, '')
      .trim();
    if (line) body.push(line);
  }

  const question = [title, body.join(' ')].filter(Boolean).join('. ').replace(/\s+/g, ' ').trim();
  if (question.length <= maxChars) return question;
  return question.slice(0, maxChars).replace(/\s+\S*$/, '');   // cut on a word boundary
}
