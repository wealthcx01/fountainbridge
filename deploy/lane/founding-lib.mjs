/**
 * The founding run (FB-056) — a venture's first day, as code.
 *
 * A founder writes a paragraph about what they are building. A Chief-of-Staff session turns that
 * into a north-star, the first goals, and a starter backlog. This module is everything about that
 * which is *not* the model call: extracting the plan from whatever the session actually printed,
 * refusing to proceed on a plan that is not usable, and rendering it into house-format tickets and
 * `context/` files.
 *
 * Split this way on purpose — the model call needs auth, a box and a repo; this is pure string
 * work, so the part that decides what lands in a founder's repo is fully testable.
 *
 * Applies meridian's `parseFoundingPlan` (docs/ideas-from-meridian.md), including its tolerant
 * extractor: a model asked for JSON returns JSON *somewhere* — fenced, prefaced with "Here's the
 * plan:", or trailed by a summary. Being strict about the wrapper throws away a good plan over
 * punctuation, so we go looking for it. Being tolerant about the *shape* would be the opposite
 * mistake: a half-formed plan seeds a founder's repo with rubbish, so validation is strict.
 */

/** A founding run must produce a real backlog, not a single idea. */
export const MIN_TICKETS = 3;

/**
 * Pull a JSON object out of model output.
 *
 * Tries, in order: a ```json fence, any ``` fence, then the first balanced `{…}` run in the prose.
 * The balanced scan is brace-counting and string-aware — a naive `indexOf('{')`/`lastIndexOf('}')`
 * swallows trailing prose that happens to contain a brace, and a regex cannot match nesting at all.
 *
 * @param {string} text
 * @returns {unknown|null} the parsed value, or null if nothing parseable is in there
 */
export function extractJson(text) {
  const src = String(text ?? '');
  const candidates = [];

  const fenced = src.match(/```(?:json)?\s*\n([\s\S]*?)```/gi) ?? [];
  for (const block of fenced) {
    candidates.push(block.replace(/```(?:json)?\s*\n?/i, '').replace(/```\s*$/, ''));
  }
  const balanced = firstBalancedObject(src);
  if (balanced) candidates.push(balanced);

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object') return value;
    } catch {
      // Try the next candidate. A fence that is not valid JSON is common — a model will happily
      // fence its prose — and is not a reason to give up on the object further down.
    }
  }
  return null;
}

/** The first `{…}` run whose braces balance, ignoring braces inside JSON strings. */
function firstBalancedObject(src) {
  const start = src.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null; // unterminated — the session was cut off mid-plan
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * Validate and normalise a founding plan.
 *
 * Returns `{ plan, problems }`. `problems` non-empty means DO NOT PROCEED — the caller writes
 * nothing and reports why. A founding run that seeds a repo with a malformed backlog is worse than
 * one that fails: the founder would have to unpick it by hand, on day one.
 *
 * @param {string|unknown} input raw session output, or an already-parsed object
 */
export function parseFoundingPlan(input) {
  const raw = typeof input === 'string' ? extractJson(input) : input;
  const problems = [];
  if (!raw || typeof raw !== 'object') {
    return { plan: null, problems: ['no JSON object found in the session output'] };
  }

  const northStar = str(raw.northStar ?? raw.north_star);
  if (!northStar) problems.push('no northStar — the venture has no stated point');

  const goals = arr(raw.goals)
    .map((g) => ({ title: str(g?.title ?? g), why: str(g?.why) }))
    .filter((g) => g.title);
  if (!goals.length) problems.push('no goals');

  const tickets = arr(raw.tickets)
    .map((t) => ({
      title: str(t?.title),
      why: str(t?.why),
      scope: arr(t?.scope).map(str).filter(Boolean),
      outOfScope: arr(t?.outOfScope ?? t?.out_of_scope).map(str).filter(Boolean),
      acceptance: arr(t?.acceptance).map(str).filter(Boolean),
    }))
    .filter((t) => t.title);

  if (tickets.length < MIN_TICKETS) {
    problems.push(`only ${tickets.length} usable ticket${tickets.length === 1 ? '' : 's'} (need ${MIN_TICKETS})`);
  }
  // A ticket with no acceptance criteria is a wish. The lane's own PRP step (FB-052) will demand
  // validation gates from it later, so a starter ticket that cannot say what "done" means would
  // block on its first wake — better to reject it now, while a human is watching.
  const vague = tickets.filter((t) => !t.acceptance.length).map((t) => t.title);
  if (vague.length) problems.push(`ticket(s) with no acceptance criteria: ${vague.join('; ')}`);

  if (problems.length) return { plan: null, problems };
  return { plan: { northStar, goals, tickets }, problems: [] };
}

/**
 * A ticket-id prefix for a venture.
 *
 * The parser's id pattern is 2+ uppercase letters, a hyphen, digits (`ARCA-001`). A hyphenated
 * venture id becomes its initials, which is both valid and how a founder would say it out loud
 * ("the-reset" → TR); a single word takes its first four letters ("arca" → ARCA).
 *
 * @returns {string} the prefix, or '' if the id cannot yield a legal one (the caller must then be told)
 */
export function idPrefix(ventureId) {
  const parts = String(ventureId ?? '')
    .split(/[^A-Za-z]+/)
    .filter(Boolean);
  if (!parts.length) return '';
  const candidate =
    parts.length > 1 ? parts.map((p) => p[0]).join('').toUpperCase() : parts[0].slice(0, 4).toUpperCase();
  return /^[A-Z]{2,}$/.test(candidate) ? candidate : '';
}

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

/**
 * Render one starter ticket as house-format markdown.
 *
 * The format is not decorative: it is what `tools/ticket-parser` reads, and what the studio board
 * renders from. It must parse with ZERO warnings — a founding run whose own output shows up on the
 * founder's board flagged "⚠ this may not be a ticket file" has failed at the thing it exists for.
 * `__tests__/founding-lib.test.mjs` asserts exactly that, through the real parser.
 */
export function renderTicket({ id, ticket, ventureId, ventureName, northStar }) {
  // Tolerate a plan that did not come through parseFoundingPlan — the optional lists are genuinely
  // optional, and a hand-written plan (or a future caller) should not crash on an absent `scope`.
  const scope = arr(ticket.scope);
  const outOfScope = arr(ticket.outOfScope);
  const acceptance = arr(ticket.acceptance);
  const branch = `${id.toLowerCase()}-${slugify(ticket.title)}`;
  const lines = [
    `# ${id} — ${ticket.title}`,
    '',
    `**Status:** Todo · **Phase:** 0 · **Depends on:** none · **Repo:** ${ventureId} · **Branch:** \`${branch}\``,
    'One ticket = one branch = one PR.',
    '',
    '## Why this matters (for the founder)',
    ticket.why || `A first step toward ${ventureName}’s north-star: ${northStar}`,
    '',
    '## Context',
    `From ${ventureName}’s founding run — the starter backlog generated from the mission statement.`,
    'Written by an agent, kept because a human reviewed it. Sharpen it before working it.',
    '',
  ];

  if (scope.length) {
    lines.push('## Scope', ...scope.map((s) => `- ${s}`), '');
  }
  if (outOfScope.length) {
    lines.push('## Out of scope', ...outOfScope.map((s) => `- ${s}`), '');
  }
  lines.push('## Acceptance criteria', ...acceptance.map((a) => `- [ ] ${a}`), '');
  lines.push(
    '## Verification',
    'Set when this ticket is picked up — the lane’s PLAN step turns these acceptance criteria into',
    'the PRP’s validation gates (FB-052).',
    '',
  );
  return lines.join('\n');
}

/**
 * The whole plan → the files a founding-run PR contains.
 *
 * @returns {{path: string, content: string}[]} repo-relative paths, ready to commit
 */
export function renderFoundingFiles({ plan, ventureId, ventureName, startAt = 1 }) {
  const prefix = idPrefix(ventureId);
  if (!prefix) throw new TypeError(`cannot derive a ticket-id prefix from venture id "${ventureId}"`);

  const files = plan.tickets.map((ticket, i) => {
    const id = `${prefix}-${String(startAt + i).padStart(3, '0')}`;
    return {
      path: `docs/tickets/${id}-${slugify(ticket.title)}.md`,
      content: renderTicket({ id, ticket, ventureId, ventureName, northStar: plan.northStar }),
    };
  });

  // The north-star belongs in context/, not in a ticket: it is durable background every future lane
  // session reads (D8), not a unit of work that gets closed.
  files.push({
    path: 'context/north-star.md',
    content: [
      `# ${ventureName} — north-star`,
      '',
      plan.northStar,
      '',
      '## First goals',
      '',
      ...plan.goals.flatMap((g) => [`- **${g.title}**${g.why ? ` — ${g.why}` : ''}`]),
      '',
      '---',
      '',
      'Written by the founding run (FB-056) from the founder’s mission statement, and reviewed by a',
      'human before it landed. It is a starting position, not a commitment — edit it as the venture',
      'learns. Every lane session reads this for context, so keeping it true is worth the minute.',
      '',
    ].join('\n'),
  });

  return files;
}

/** The PR body for a founding run — what the human is being asked to approve. */
export function renderPrBody({ plan, ventureName, mission, files }) {
  const tickets = files.filter((f) => f.path.startsWith('docs/tickets/'));
  return [
    `# ${ventureName} — founding run`,
    '',
    `**North-star:** ${plan.northStar}`,
    '',
    'This is a venture’s first day, drafted by an agent from the mission statement below. **Nothing',
    'here is authoritative until you say so** — it is a starting position to react to, and reacting',
    'is faster than starting from a blank repo.',
    '',
    '## First goals',
    ...plan.goals.map((g) => `- **${g.title}**${g.why ? ` — ${g.why}` : ''}`),
    '',
    `## Starter backlog (${tickets.length} tickets)`,
    ...plan.tickets.map((t) => `- **${t.title}** — ${t.why || 'see the ticket'}`),
    '',
    '## The mission it was given',
    '',
    '> ' + String(mission ?? '').trim().split('\n').join('\n> '),
    '',
    '---',
    '',
    'Read the tickets, cut the ones that are wrong, then merge. The lane picks up whatever is left',
    'on the board — so this PR is the gate, and merging it is the decision.',
    '',
  ].join('\n');
}
