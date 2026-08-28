/**
 * A document becomes a set of tickets (FB-127, gap G5).
 *
 * ## Why this exists
 *
 * A founder arrives with a PRD, a deck, a page of notes. In the desk design they hand it over and
 * watch it become N draft tickets in dependency order — smallest shippable first, each line struck
 * or kept, filed as one set on one press.
 *
 * Today they would file one ticket, then another, then another, describing the same document from
 * memory each time. The dogfood run of 2026-08-23 is the evidence: the composer *can* split an ask
 * into research → build → QA correctly, and it took a founder asking, then approving, then the filer
 * handing out the same id five times over (FB-117).
 *
 * ## Two properties this module exists to hold
 *
 * **A plan is inert.** Nothing here opens a branch, writes a file or reserves an id. Every function
 * is pure. A plan becomes work in exactly one place — `app/actions/file-plan.ts`, on one press — and
 * that is the property that makes "nothing files without the founder's word" checkable rather than
 * promised.
 *
 * **Dependencies are slugs, not ids.** An id is evidence a backlog was written to, and a draft has
 * written to nothing. So a plan says `depends_on: ['auction-feed-ingestion']`, and the ids arrive
 * only at the moment of filing, allocated in one pass across the whole set.
 *
 * ## Striking a line does not edit the graph
 *
 * A struck ticket keeps its own dependencies and stays in the plan carrying a flag. The dependency
 * graph a founder sees is **computed over the kept set**, resolving through struck tickets: strike
 * the research ticket and the build ticket that depended on it inherits whatever the research ticket
 * depended on, rather than being left pointing at something that will never be filed.
 *
 * Done this way round because striking is a toggle. Splicing the stored graph would be a one-way
 * door — un-striking a line could not put back the dependencies the strike dissolved.
 *
 * Mirrors `schema/PlanDraft.schema.json`; `lib/__tests__/plan-draft.test.ts` holds the two in
 * lock-step.
 */

import { nextTicketId } from '@/deploy/librechat/ticket-mcp/ids.mjs';
import type { ReplyBlock } from './composer';

/**
 * One ticket in a proposed set.
 *
 * No id, deliberately — see the module note. `body` is filed verbatim apart from two lines the filer
 * owns: the id in the heading, and `Depends on`, which cannot be written until the ids exist.
 */
export interface PlanTicketDraft {
  slug: string;
  title: string;
  body: string;
  /** Slugs of other tickets in THIS plan. Never ids. */
  depends_on: string[];
  /** Where in the founder's document this came from, so they can check nothing was invented. */
  source: string;
  /** The founder struck this line. Kept in the plan so the strike can be undone. */
  struck?: boolean;
}

export interface PlanDraft {
  venture_id: string;
  repo: string;
  source_title: string;
  tickets: PlanTicketDraft[];
  created_at: string;
}

/**
 * The key that says a fenced block is a plan and not a ticket.
 *
 * A marker inside the JSON rather than the fence's language tag, because `parseReply` throws the
 * language tag away and a plan must be recognisable from the block's content alone. It also means a
 * fenced block that merely happens to be JSON is never mistaken for a proposal to file six tickets.
 */
export const PLAN_MARKER = 'foundry_plan';

/** Slugs become paths and branch names, so they are checked rather than escaped. Matches the filer. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;

export const isSafePlanSlug = (v: unknown): v is string => typeof v === 'string' && SLUG.test(v);

/**
 * Read a plan out of what the composer wrote.
 *
 * Tolerant in one direction only. A block that is not a plan reads as "no plan", which is the common
 * case and must never be an error. A block that *claims* to be a plan and is malformed also reads as
 * no plan — the alternative is showing a founder a "File all 6" button over a set the studio could
 * not fully understand, and a press is not something to offer on a guess.
 */
export function parsePlanDraft(raw: string | null | undefined): PlanDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (!p[PLAN_MARKER]) return null;

  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  const venture_id = str(p.venture_id);
  const repo = str(p.repo);
  const source_title = str(p.source_title);
  if (!venture_id || !repo || !source_title || !Array.isArray(p.tickets)) return null;

  const tickets: PlanTicketDraft[] = [];
  for (const raw of p.tickets) {
    if (!raw || typeof raw !== 'object') return null;
    const t = raw as Record<string, unknown>;
    const slug = t.slug;
    const title = str(t.title);
    const body = str(t.body);
    const source = str(t.source);
    if (!isSafePlanSlug(slug) || !title || !body || !source) return null;
    const deps = Array.isArray(t.depends_on) ? t.depends_on : [];
    if (!deps.every(isSafePlanSlug)) return null;
    tickets.push({
      slug,
      title,
      body,
      source,
      depends_on: [...new Set(deps as string[])].filter((d) => d !== slug),
      struck: t.struck === true,
    });
  }
  if (tickets.length === 0) return null;
  if (new Set(tickets.map((t) => t.slug)).size !== tickets.length) return null;

  return {
    venture_id,
    repo,
    source_title,
    tickets,
    created_at: str(p.created_at) ?? new Date(0).toISOString(),
  };
}

/** The plan in a composer reply, if there is one. Drafts are fenced blocks; most replies have none. */
export function extractPlanDraft(blocks: ReplyBlock[]): PlanDraft | null {
  for (const block of blocks) {
    if (block.kind !== 'draft') continue;
    const plan = parsePlanDraft(block.text);
    if (plan) return plan;
  }
  return null;
}

/** Toggle a line. Nothing is removed: a strike a founder cannot undo is a worse control than none. */
export function strikeTicket(plan: PlanDraft, slug: string, struck: boolean): PlanDraft {
  return {
    ...plan,
    tickets: plan.tickets.map((t) => (t.slug === slug ? { ...t, struck } : t)),
  };
}

/** What would actually be filed, in the plan's own order. */
export const keptTickets = (plan: PlanDraft): PlanTicketDraft[] => plan.tickets.filter((t) => !t.struck);

/**
 * A ticket's dependencies **within the kept set**, resolving through struck ones.
 *
 * Strike the research ticket and the build ticket that depended on it inherits what research
 * depended on. Without this the filed set would carry a dependency on a ticket that was never filed
 * — a chain that looks right on the board and can never resolve.
 *
 * An inherited edge can duplicate one the set already implies — strike the notifications ticket and
 * QA inherits the ingestion ticket it already reached through the view. Left in rather than reduced:
 * a redundant dependency is noise on one line, a dangling one is a chain that can never resolve, and
 * only one of those is worth an algorithm.
 *
 * Cycles among struck tickets cannot spin this: every slug is visited once.
 */
export function effectiveDependsOn(plan: PlanDraft, slug: string): string[] {
  const by = new Map(plan.tickets.map((t) => [t.slug, t]));
  const out: string[] = [];
  const seen = new Set<string>([slug]);
  const queue = [...(by.get(slug)?.depends_on ?? [])];

  while (queue.length) {
    const next = queue.shift() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    const dep = by.get(next);
    if (!dep) continue;                       // names nothing in this plan — dropped, reported by planProblem
    if (dep.struck) queue.push(...dep.depends_on);
    else out.push(next);
  }
  return out;
}

/**
 * The kept set in the order it should be filed: everything a ticket depends on before the ticket.
 *
 * Kahn's algorithm, with ties broken by the order the composer proposed rather than by name — the
 * proposal already reads smallest-shippable-first, and re-sorting it alphabetically would throw away
 * the one piece of judgement the model contributed.
 *
 * A cycle is returned, never thrown and never quietly broken. A set that cannot be ordered must not
 * be filed, and the founder is owed the names of the tickets that made it unorderable.
 */
export function orderPlan(plan: PlanDraft): { ordered: PlanTicketDraft[]; cycle: string[] } {
  const kept = keptTickets(plan);
  const keptSlugs = new Set(kept.map((t) => t.slug));
  const deps = new Map(kept.map((t) => [t.slug, effectiveDependsOn(plan, t.slug).filter((d) => keptSlugs.has(d))]));

  const ordered: PlanTicketDraft[] = [];
  const placed = new Set<string>();

  for (;;) {
    const ready = kept.filter((t) => !placed.has(t.slug) && (deps.get(t.slug) ?? []).every((d) => placed.has(d)));
    if (ready.length === 0) break;
    for (const t of ready) {
      ordered.push(t);
      placed.add(t.slug);
    }
  }

  return { ordered, cycle: kept.filter((t) => !placed.has(t.slug)).map((t) => t.slug) };
}

/**
 * The order the plan is READ in, and therefore the order it is filed in.
 *
 * Computed as though nothing were struck, so striking a line never reorders the list under a
 * founder's eyes. The filed order is this order with the struck lines removed, which keeps the two
 * identical by construction — before this the panel rendered the composer's proposed order while the
 * filer wrote `orderPlan`'s, so a set proposed out of dependency order would have been read in one
 * order and filed in another.
 *
 * Restricting a valid topological order to a subset leaves it valid, and striking a line only ever
 * shortens a chain, so filtering this is safe.
 */
export function planOrder(plan: PlanDraft): PlanTicketDraft[] {
  const nothingStruck = { ...plan, tickets: plan.tickets.map((t) => ({ ...t, struck: false })) };
  const { ordered, cycle } = orderPlan(nothingStruck);
  // A cycle has no order. `planProblem` refuses the set; this still has to render something, and
  // the proposal's own order is the only honest fallback.
  return cycle.length ? plan.tickets : ordered.map((t) => plan.tickets.find((o) => o.slug === t.slug) as PlanTicketDraft);
}

/** The kept tickets, in the order they are read and filed. */
export const planFilingOrder = (plan: PlanDraft): PlanTicketDraft[] => planOrder(plan).filter((t) => !t.struck);

/**
 * The one reason this plan cannot be filed, in a founder's words — or null.
 *
 * One sentence rather than a list, and about the plan rather than about the schema. A founder who
 * cannot file needs to know what to do next; which field failed validation is a fact for a log.
 */
export function planProblem(plan: PlanDraft): string | null {
  const kept = keptTickets(plan);
  if (kept.length === 0) return 'Every line is struck, so there is nothing to file.';

  const keptSlugs = new Set(kept.map((t) => t.slug));
  const known = new Set(plan.tickets.map((t) => t.slug));
  // Every ticket, not only the kept ones: a struck ticket's dependencies are inherited by whatever
  // depended on it, so a slug naming nothing in the plan reaches a filed ticket through a struck
  // one. `effectiveDependsOn` drops it silently, which would leave a founder with a `Depends on: —`
  // where a real dependency had been declared and discarded.
  for (const t of plan.tickets) {
    const unknown = t.depends_on.find((d) => !known.has(d));
    if (unknown) return `“${t.title}” depends on something that is not in this plan. Nothing was filed.`;
  }
  for (const t of kept) {
    const dangling = effectiveDependsOn(plan, t.slug).find((d) => !keptSlugs.has(d));
    if (dangling) return `“${t.title}” depends on a line that is not being filed. Nothing was filed.`;
  }

  const { cycle } = orderPlan(plan);
  if (cycle.length) {
    return `These depend on each other in a loop, so there is no order to file them in: ${cycle.join(', ')}. Nothing was filed.`;
  }
  return null;
}

/**
 * The prefix this backlog names its tickets with.
 *
 * Read off the backlog rather than configured, and that is deliberate. The box-side filer takes it
 * from `VENTURE_TICKET_PREFIX` or the repo name; the studio cannot see that box's environment, and a
 * studio that guessed `ARCA` while the box wrote `PKMN` would file a set that reads as a different
 * venture's work. Reading what is already there agrees with the box by construction, whatever the
 * box was told.
 *
 * The most common prefix wins, so one stray file from a rename does not rename the next ticket. A
 * backlog with nothing in it falls back to the repo's own name, which is exactly what the filer does.
 */
export function ticketPrefixFor(repo: string, filenames: string[]): string {
  const counts = new Map<string, number>();
  for (const name of filenames) {
    // Lazy, so `ARCA-12-2024-notes.md` reads its prefix as ARCA and not ARCA-12, and non-greedy
    // across hyphens so `THE-RESET-001-x.md` reads THE-RESET rather than matching nothing at all.
    const m = name.match(/^([A-Za-z][A-Za-z0-9-]*?)-\d+(?:[-.]|$)/);
    if (!m) continue;
    const prefix = m[1].toUpperCase();
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? best[0] : (repo.split('/').pop() || repo).toUpperCase();
}

/**
 * N ids for N tickets, in one pass.
 *
 * The whole reason a set is filed as a set. Allocating one at a time against a backlog that has not
 * changed is what gave five tickets the same number in the 2026-08-23 run — the branch each was
 * written to was invisible to the next allocation. Here the list grows as ids come out of it, so the
 * fifth ticket allocates against the four before it.
 *
 * Width comes from `nextTicketId` (FB-118), so a set joining ARCA's backlog reads `ARCA-075` and not
 * `ARCA-75`.
 */
export function allocatePlanIds(prefix: string, filenames: string[], slugs: string[]): string[] {
  const inFlight = [...filenames];
  return slugs.map((slug) => {
    const id = nextTicketId(prefix, inFlight);
    inFlight.push(`${id}-${slug}.md`);
    return id;
  });
}

/** The `Depends on` value as the house format writes it. An em dash, not an empty string, for none. */
const dependsValue = (ids: string[]): string => (ids.length ? ids.join(', ') : '—');

/**
 * Write the real ids into a ticket's `Depends on` line.
 *
 * The composer cannot write this line: at the time it drafts, the ids do not exist. So the filer owns
 * it, the same way it owns the id in the heading — and it is the difference between a dependency the
 * board can render and a decoration.
 *
 * Three shapes arrive: a metadata line that already has a `Depends on` (the common one, usually with
 * a placeholder in it), a metadata line without one, and a body with no metadata line at all.
 */
export function withDependsOn(body: string, ids: string[]): string {
  const value = dependsValue(ids);

  const existing = body.match(/\*\*Depends on:\*\*[^\n·]*/);
  if (existing) return body.replace(existing[0], `**Depends on:** ${value}`);

  if (ids.length === 0) return body;   // nothing to say, and no line worth inventing to say it

  const status = body.match(/^.*\*\*Status:\*\*.*$/m);
  if (status) return body.replace(status[0], `${status[0].trimEnd()} · **Depends on:** ${value}`);

  const heading = body.match(/^#\s+.*$/m);
  if (heading) return body.replace(heading[0], `${heading[0]}\n\n**Depends on:** ${value}`);
  return `**Depends on:** ${value}\n\n${body}`;
}

/**
 * The one branch a plan lands on.
 *
 * One branch and one pull request for the whole set, because the set is one decision. Named from the
 * first kept ticket so a founder looking at the pull request list can tell which plan it is, and
 * prefixed `foundry/plan-` so it never collides with the single-ticket filer's `foundry/<slug>`.
 */
export function planBranch(plan: PlanDraft): string | null {
  if (keptTickets(plan).length === 0) return null;
  // Named from the FIRST PROPOSED ticket, not the first kept one — striking a line must not rename
  // the branch. It did: a founder whose first press half-failed, who then struck the line they no
  // longer wanted and pressed again, got a second branch cut from base, a second set of numbers and
  // a second pull request, while the first still held the originals. Exactly the retry this is
  // written for.
  return `foundry/plan-${plan.tickets[0].slug}`;
}
