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

// ── FB-169: the folder a department's knowledge lives in is NOT always its id ──────────────────────
//
// gbrain will not index any directory named `build`, at any depth. It is in gbrain's own
// PRUNE_DIR_NAMES beside `node_modules`, `vendor` and `dist`, on the reasonable assumption that
// `build/` holds compiled output — and there is no option to waive it (checked against
// garrytan/gbrain main on 2026-10-01; gbrain made the same mistake with `ops/` and removed it, #2404).
//
// The Foundry's departments are build, sell and scale, and each venture keeps its knowledge in
// `context/<department>/`. So **the whole Build department of every venture was invisible to its
// brain**: on ARCA, three of its five corpus documents could not be found by any search, and every
// Build fact a founder ever saved through the composer vanished from the team's knowledge with no
// error. FB-169 recorded the symptom and ruled out `.gitignore`; the ignore list that mattered was
// gbrain's.
//
// So Build's knowledge lives in `context/product/` — the department's display name is already
// "Build — Product" — and `build/` is still READ, so anything filed before this keeps its department.
// The deposit tool (deploy/librechat/deposit-mcp) and the studio (lib/knowledge.ts) carry the same
// map; `lib/__tests__/department-folders.test.ts` fails if the three ever disagree, or if any
// department's folder is one gbrain prunes.
export const FOLDER_OF_DEPARTMENT = { build: 'product', sell: 'sell', scale: 'scale', general: 'general' };

/** Folder → department. `build` stays readable for documents filed before FB-169. */
export const DEPARTMENT_OF_FOLDER = {
  product: 'build', build: 'build', sell: 'sell', scale: 'scale', general: 'general',
};

/**
 * Directory names gbrain will never descend into, copied from gbrain's `PRUNE_DIR_NAMES`
 * (src/core/sync.ts). Kept here so a test can fail when a department's folder collides with one —
 * the collision that hid ARCA's Build department.
 */
export const GBRAIN_PRUNED_DIRS = ['node_modules', 'vendor', 'dist', 'build', 'venv', '.raw'];

/**
 * Which of the venture's tracked documents the brain does not hold (FB-169).
 *
 * `tracked` is `git ls-files context library`; `slugs` is `gbrain list`'s first column, which names a
 * page by its path without `.md` (`context/sell/arca-brand-positioning`, read from the ARCA box
 * 2026-10-01). README.md is left out on both sides: gbrain skips it by design, and in a venture's
 * context/ and library/ it is only the folder's own explanation.
 *
 * A brain holding a subset looks exactly like a healthy one — the sync succeeds, searches return
 * results — so this is the only thing that says the answer came from a smaller world.
 */
export function corpusGap(tracked, slugs) {
  const have = new Set(slugs.map((s) => String(s).trim()).filter(Boolean));
  const corpus = tracked
    .map((p) => String(p).trim())
    .filter((p) => /^(context|library)\/.+\.mdx?$/i.test(p) && !/(^|\/)readme\.mdx?$/i.test(p));
  const missing = corpus.filter((p) => !have.has(pageNameOf(p)));
  return { corpus: corpus.length, missing };
}

/**
 * The name gbrain gives the page for a file: gbrain's `slugifyPath` (src/core/sync.ts), simplified.
 * Each folder and file name is lowercased, accents dropped, punctuation removed and spaces turned to
 * hyphens: `context/sell/Brand Notes.md` → `context/sell/brand-notes`. Simplified means a rare name
 * could be reported missing when it is not — a false alarm, never a missed one.
 */
export function pageNameOf(path) {
  return String(path).replace(/\.mdx?$/i, '').split('/').map((seg) => seg
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}.\s_-]/gu, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean).join('/');
}

// The venture's D8 knowledge areas (FB-043's deposit tool writes `<area>/<dept>/<slug>.md`).
const AREAS = ['context', 'library'];

// A gbrain slug is path-derived, and there is no path field on a search hit, so the department is
// read back off the slug's prefix.
//
// **gbrain emits TWO slug shapes, and this accepted only the one it never emits for a corpus page.**
// Measured against ARCA's live index on 2026-09-02: markdown notes keep their separators
// (`context/sell/arca-brand-positioning`, `docs/tickets/arca-062-arca-brand-redesign`) while code
// and data files are flattened (`modules-cards-jobs-ts`, `trkd_scraper-output-websockets-json`).
// Every founder-deposited document is a note, so every one of them arrives slash-separated — and
// this regex required a hyphen. It matched nothing, `pageDepartment` returned null for every corpus
// page, null means *shared, every lane may read it*, and the D8 partition has been inert since
// FB-050 (FB-165).
//
// Both shapes are accepted because both are real, not as a hedge: a flattened `context-build-x` is
// what a differently-configured index would produce, and the cost of accepting it is nil.
//
// Documented limitation, unchanged: a top-level file literally named `context/build-thing.md` also
// matches and reads as 'build'. The deposit tool only ever writes `<area>/<dept>/<slug>.md` with the
// dept from a fixed enum, so this does not arise on the deposit path.
const DEPT_SLUG_RE = new RegExp(`^(?:${AREAS.join('|')})[-/](${Object.keys(DEPARTMENT_OF_FOLDER).join('|')})(?:[-/]|$)`);

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
  const dept = DEPARTMENT_OF_FOLDER[m[1]];
  return !dept || dept === 'general' ? null : dept;
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
  return digestWithPages(results, opts).digest;
}

/**
 * The digest AND the pages that actually went into it (FB-156).
 *
 * `formatDigest` delegates here rather than the record being computed alongside it, because the two
 * must not be able to disagree. A page can be dropped twice on the way into a digest — an excerpt
 * that comes back empty, and the `maxChars` break — so "the pages we retrieved" and "the pages the
 * model was shown" are genuinely different lists. Recording the first while showing the second would
 * put documents in the founder's `Last used` column that nothing ever read: exactly the invented
 * fact the column stayed empty for a ticket and a half to avoid.
 *
 * @returns {{digest: string, slugs: string[]}} slugs in the order they appear in the digest
 */
export function digestWithPages(results, opts = {}) {
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
  const slugs = [];
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
    slugs.push(p.slug);
    used += entry.length + 1;
  }
  return { digest: lines.join('\n'), slugs };
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
