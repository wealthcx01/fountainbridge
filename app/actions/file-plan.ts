'use server';

/**
 * Filing a whole plan on one press (FB-127, gap G5).
 *
 * ## What this changes for a founder
 *
 * They hand over a PRD and get N tickets in dependency order. Today they would file one, then
 * another, describing the same document from memory each time — and on 2026-08-23 five tickets filed
 * that way came back with the same id, five branches and five pull requests.
 *
 * A set is **one decision**, so it lands as one: **one branch, N ticket files, one pull request.**
 * That is also what makes the ids correct — allocated in a single pass across the whole set, at the
 * backlog's own width (FB-117, FB-118) — and what lets `Depends on` resolve across tickets none of
 * which have merged.
 *
 * ## The press
 *
 * This function is the only thing in the studio that turns a plan into work, and it will not act on
 * a plan the founder has not looked at: the caller passes the number of tickets it showed them, and
 * a disagreement is a refusal. A strike that landed between the render and the press changes that
 * number, and filing six tickets to a founder who read five is exactly the failure the count exists
 * to prevent. Everything upstream of here is pure and writes nothing.
 *
 * Nothing merges. A human still merges the pull request (CLAUDE.md #2), and the tickets do not
 * become work on a lane until they do.
 */

import { GitHubClient, GitHubError } from '@/lib/github';
import { clearTicketCache } from '@/lib/tickets';
import { clearAttentionCache } from '@/lib/attention';
import { fullRepoName } from '@/lib/venture-repos';
import { requireVentureRepo } from '@/lib/venture-access';
import type { Actor } from '@/lib/venture-access';
import {
  PLAN_MARKER, allocatePlanIds, effectiveDependsOn, keptTickets, parsePlanDraft, planBranch,
  planFilingOrder, planProblem, ticketPrefixFor, withDependsOn, type PlanDraft,
} from '@/lib/plan-draft';
import { ticketPath, withTicketId } from '@/deploy/librechat/ticket-mcp/ids.mjs';
import {
  FOUNDING_MAP_PATH, isFoundingPlan, mapProblem, parseFoundingMap, renderFoundingMapFile, traceProblem,
  MAP_MARKER, MAP_NOT_SENT,
  type FoundingMap,
} from '@/lib/founding-map';

export interface FiledTicket {
  slug: string;
  id: string;
  title: string;
  path: string;
}

export interface FilePlanResult {
  ok: boolean;
  message: string;
  url?: string;
  filed?: FiledTicket[];
}

/**
 * Every ticket name in flight, merged or not.
 *
 * The union is the honest backlog. Reading the default branch alone is what gave five tickets one
 * number: each filing writes to its own branch and the default branch never sees it. This set is
 * filed on one branch in one pass so it cannot collide with itself, but a founder filing a single
 * ticket in the composer at the same moment still can.
 *
 * The read budget (FB-083): one directory read, plus one per open `foundry/` branch. Bounded by what
 * is waiting rather than by the size of the backlog, and paid once on a press rather than on a page
 * load or a timer.
 */
async function ticketNamesInFlight(client: GitHubClient, full: string, base: string): Promise<{ merged: string[]; all: string[] }> {
  const names = (await client.listDir(full, 'docs/tickets', base)).filter((e) => e.type === 'file').map((e) => e.name);

  let refs: Array<{ ref?: string }> = [];
  try {
    refs = await client.request<Array<{ ref?: string }>>(`/repos/${full}/git/matching-refs/heads/foundry/?per_page=100`);
  } catch {
    // No branches, or the listing failed. Allocating from the merged backlog alone is the FB-117 bug,
    // so this is said out loud rather than swallowed — and the settle check below is what catches it.
    console.warn('[file-plan] could not list in-flight ticket branches', { full });
    return { merged: names, all: names };
  }
  if (!Array.isArray(refs)) return { merged: names, all: names };
  if (refs.length >= 100) {
    console.warn('[file-plan] 100+ foundry branches; the id union may be incomplete', { full });
  }

  const branches = refs
    .map((r) => (typeof r?.ref === 'string' ? r.ref.replace(/^refs\/heads\//, '') : null))
    .filter((b): b is string => Boolean(b));

  const perBranch = await Promise.all(
    branches.map((b) => client.listDir(full, 'docs/tickets', b).catch(() => [])),
  );
  return { merged: names, all: names.concat(...perBranch.flat().filter((e) => e.type === 'file').map((e) => e.name)) };
}

/** The file this slug already has under this venture's prefix, or null. Hyphen-safe, unlike FB-146. */
function fileForSlug(names: string[], prefix: string, slug: string): string | null {
  const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escape(prefix)}-\\d+[a-z]?-${escape(slug)}\\.md$`, 'i');
  return names.find((n) => re.test(n)) ?? null;
}

export async function filePlan(
  ventureId: string,
  repo: string,
  plan: PlanDraft,
  /**
   * The number on the button that was pressed.
   *
   * A cheap assertion that the label and the payload agree, and honestly no more than that: both
   * come from the same client, so it is not a tamper check. What actually keeps a set from filing
   * unasked is that this function is the only writer and only the button calls it — and that
   * everything above is pure.
   */
  confirmedCount: number,
  /**
   * Who is filing, when it is not a signed-in browser (FB-225).
   *
   * Absent, this reads the session and behaves exactly as it always has. Present, it is the MCP
   * ticket's claim, and `requireVentureRepo` enforces `scopedTo` before anything else — so a ticket
   * naming one venture cannot file into another, whatever the arguments say. It must come from
   * `toolActor`: this is a server action, anyone can call it with any arguments, and an actor typed
   * into a request is refused (FB-257).
   *
   * Threaded through rather than given its own writer, because FB-200's whole point is that a ticket
   * filed by Claude is indistinguishable downstream from one typed on the desk. A second writer is
   * the one that drifts.
   */
  actor?: Actor,
  /**
   * The founding map this set came out of, when it came out of one (FB-236).
   *
   * Saved beside the tickets, on the same branch and in the same pull request, so a founder merges
   * the map and its first tickets as one decision — and so there is still exactly one writer.
   */
  founding?: FoundingMap,
): Promise<FilePlanResult> {
  const access = await requireVentureRepo(ventureId, repo, actor);
  if (!access.ok) return { ok: false, message: access.error };

  // The plan arrives from a browser. Everything below it turns a slug into a repository path with a
  // token far more privileged than the founder holding it, so the shape is checked HERE and not
  // taken on trust from the surface that sent it.
  //
  // This is not belt-and-braces. `parsePlanDraft` — which enforces the slug pattern — ran only in
  // the client component, and `ticketPath` builds `docs/tickets/<id>-<slug>.md`, which `encodeURI`
  // leaves every `/` and `.` in. A slug of `../../../.github/workflows/x` normalises out of
  // `docs/tickets/` on the way to GitHub. That turns "may file a ticket" into "may write any file in
  // the venture's repository", which is not a thing a founder may do.
  //
  // Round-tripped rather than spot-checked, so the server and the surface agree by construction
  // instead of by two lists of rules that have to be kept the same.
  const checked = parsePlanDraft(JSON.stringify({ [PLAN_MARKER]: 1, ...plan }));
  if (!checked) return { ok: false, message: 'That plan could not be read. Nothing was filed.' };
  plan = checked;

  if (plan.venture_id !== ventureId || plan.repo !== repo) {
    // The plan names where it belongs. A press that redirected it somewhere else would file a set of
    // tickets a founder read about one venture into another's backlog.
    return { ok: false, message: 'That plan was drafted for somewhere else. Nothing was filed.' };
  }

  const problem = planProblem(plan);
  if (problem) return { ok: false, message: problem };

  // A founding map arrives from the same browser as the plan, so it is round-tripped through the same
  // parser the panel used, and held to the same rules: it reached the unknown unknowns, it belongs to
  // this venture, and every ticket in the set points back at it.
  let map: FoundingMap | null = null;
  if (founding) {
    map = parseFoundingMap(JSON.stringify({ [MAP_MARKER]: 1, ...founding }));
    if (!map) return { ok: false, message: 'That founding map could not be read. Nothing was filed.' };
    if (map.venture_id !== ventureId) {
      return { ok: false, message: 'That founding map was drafted for somewhere else. Nothing was filed.' };
    }
    const unfinished = mapProblem(map) ?? traceProblem(plan);
    if (unfinished) return { ok: false, message: unfinished };
  } else if (isFoundingPlan(plan)) {
    // A founding set that arrives without its map would otherwise file as an ordinary plan: no map
    // saved, the unknown-unknowns check never run, and nobody told. Refused here as well as in the
    // panel, so a panel that dropped the map cannot get past it.
    return { ok: false, message: MAP_NOT_SENT };
  }

  const ordered = planFilingOrder(plan);
  if (ordered.length !== confirmedCount) {
    return {
      ok: false,
      message: `This plan has ${ordered.length} tickets in it now, not ${confirmedCount}. Nothing was filed — check it and press again.`,
    };
  }

  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) return { ok: false, message: 'Filing a plan is not set up on the studio yet — an admin needs to finish setting it up.' };

  const branch = planBranch(plan);
  if (!branch) return { ok: false, message: 'Every line is struck, so there is nothing to file.' };

  const full = fullRepoName(repo);
  const client = new GitHubClient({ token: writeToken });

  try {
    const info = await client.request<{ default_branch: string }>(`/repos/${full}`);
    const base = info.default_branch;

    // A venture has one founding map. A second walk that wrote over the first would erase the reasoning
    // its first tickets were filed from, so it is refused and said. Checked before any branch is cut,
    // and on the default branch only, so a second press of this same set still updates its own map.
    if (map && (await client.getFileWithSha(full, FOUNDING_MAP_PATH, base))) {
      return {
        ok: false,
        message: 'This venture already has a founding map, and filing this would write over it. Nothing was filed. '
          + 'Ask for the map to be updated as its own piece of work instead.',
      };
    }

    // Create the branch only if it is missing, so pressing twice updates the set rather than failing
    // at a founder who was not sure the first press landed.
    try {
      await client.request(`/repos/${full}/git/ref/heads/${branch}`);
    } catch {
      const baseRef = await client.request<{ object: { sha: string } }>(`/repos/${full}/git/ref/heads/${base}`);
      await client.request(`/repos/${full}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
      });
    }

    const { merged, all: inFlight } = await ticketNamesInFlight(client, full, base);
    const prefix = ticketPrefixFor(repo, inFlight);

    // Never write over a ticket that is already in the backlog.
    //
    // On a first press the branch is cut from the default branch, so everything merged is on it. A
    // plan slug matching a ticket that already exists would have been read as "this one is already
    // filed", and the reuse below would have replaced a real ticket's whole body — status, notes,
    // ticked criteria and all — while reporting the set as filed. Refused instead, by name, because
    // a founder can act on that and cannot act on a silent overwrite.
    const collision = ordered.map((t) => [t, fileForSlug(merged, prefix, t.slug)] as const).find(([, f]) => f);
    if (collision) {
      return {
        ok: false,
        message: `“${collision[0].title}” is already in your backlog. Rename it or strike it, then press again. Nothing was filed.`,
      };
    }

    // A second press must UPDATE this set, not double it.
    //
    // Pressing twice is ordinary — a founder who is not sure the first press landed presses again —
    // and without this it was ruinous: the first press's tickets are on this branch, so the union
    // counts them, the allocator steps past them, and the branch ends up carrying every ticket
    // twice under two sets of numbers. The single-ticket filer has had this since FB-097; the set
    // filer needs it for the same reason and did not have it.
    //
    // A ticket already here keeps the number the founder has already been told. Matched with a
    // hyphen-safe regex rather than `existingTicketFile`, whose `[A-Za-z]+` cannot cross the hyphen
    // in `THE-RESET` — so on the launch venture this guarantee would have quietly not held (FB-146).
    const onBranch = (await client.listDir(full, 'docs/tickets', branch)).filter((e) => e.type === 'file').map((e) => e.name);

    // A ticket from Claude's tools must not land on somebody else's waiting set (FB-257).
    //
    // The branch is named from the first ticket's short name. A tool ticket whose title gives the same
    // short name as the first ticket of a founder's set that is still waiting to be merged would land
    // on that set's branch, and the reuse below would replace that ticket's body. So, for a tool
    // ticket, a branch that already holds an unmerged ticket this plan does not name belongs to
    // another set, and the ticket is refused rather than written over it. A founder pressing their own
    // set twice is not affected: this applies only to tool calls.
    if (actor) {
      const mergedNames = new Set(merged);
      const ours = (name: string) => plan.tickets.some((t) => fileForSlug([name], prefix, t.slug));
      if (onBranch.some((name) => !mergedNames.has(name) && !ours(name))) {
        return {
          ok: false,
          message: `A different set of tickets is already waiting under the name “${plan.tickets[0].slug}”. `
            + 'Give this ticket a different title and try again. Nothing was filed.',
        };
      }
    }
    const already = new Map<string, string>();
    for (const t of ordered) {
      const file = fileForSlug(onBranch, prefix, t.slug);
      const id = file?.match(new RegExp(`^(.+?-\\d+[a-z]?)-`))?.[1];
      if (id) already.set(t.slug, id);
    }

    const fresh = allocatePlanIds(prefix, inFlight, ordered.filter((t) => !already.has(t.slug)).map((t) => t.slug));
    let next = 0;
    const ids = ordered.map((t) => already.get(t.slug) ?? fresh[next++]);
    const idBySlug = new Map(ordered.map((t, i) => [t.slug, ids[i]]));

    const filed: FiledTicket[] = [];
    // Sequentially, in dependency order: the ticket a founder sees first in the pull request is the
    // one that can be started first, and a partial failure leaves a prefix of the set rather than
    // holes in the middle of it.
    for (const [i, ticket] of ordered.entries()) {
      const id = ids[i];
      const dependencyIds = dependencyIdsFor(plan, ticket.slug, idBySlug);
      const path = ticketPath(id, ticket.slug);
      const body = withTicketId(withDependsOn(ticket.body, dependencyIds), id);

      const existing = await client.getFileWithSha(full, path, branch);
      await client.putFile(full, path, {
        content: body,
        message: `ticket: ${id} — ${ticket.title}`,
        branch,
        ...(existing ? { sha: existing.sha } : {}),
      });
      filed.push({ slug: ticket.slug, id, title: ticket.title, path });
    }

    // The map goes in last, because it lists the ids the tickets were just given. Written on the same
    // branch so the founder merges the map and its tickets together, or neither.
    if (map) {
      const sources = new Map(ordered.map((t) => [t.slug, t.source]));
      const content = renderFoundingMapFile(map, filed.map((f) => ({ id: f.id, title: f.title, source: sources.get(f.slug) ?? '' })));
      const existing = await client.getFileWithSha(full, FOUNDING_MAP_PATH, branch);
      await client.putFile(full, FOUNDING_MAP_PATH, {
        content,
        message: 'context: the founding map',
        branch,
        ...(existing ? { sha: existing.sha } : {}),
      });
    }

    const summary = filed.map((f) => `- \`${f.id}\` — ${f.title}`).join('\n');
    const prBody = [
      actor
        ? `Filed by Claude through the studio's tools (${access.email}), on the founder's behalf.`
        : `Filed from the Foundry composer by ${access.email}, as one set, on one press.`,
      '',
      `**From:** ${plan.source_title}`,
      '',
      summary,
      '',
      ...(map
        ? [
          `It also saves the founding map these tickets came from, as \`${FOUNDING_MAP_PATH}\`. `
            + 'Merging this saves both; closing it saves neither.',
          '',
        ]
        : []),
      '---',
      '',
      'Each ticket cites the section of the document it came from. Nothing here is merged, and no lane',
      'picks any of it up until it is.',
    ].join('\n');

    // The owner comes from the repository path, not from GITHUB_ORG: a manifest may declare a repo
    // already qualified with a different owner, and `fullRepoName` passes that through untouched. A
    // head filter built from the wrong owner matches nothing, misses the open pull request, and
    // turns an ordinary second press into "something went wrong".
    const owner = full.split('/')[0];
    const open = await client.request<Array<{ html_url: string }>>(
      `/repos/${full}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
    );
    if (Array.isArray(open) && open.length) {
      movedOn(ventureId);
      return { ok: true, message: `Updated all ${filed.length} tickets. They are still one piece of work.`, url: open[0].html_url, filed };
    }

    const pr = await client.request<{ html_url: string }>(`/repos/${full}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        // One ticket reads as that ticket. "<source>: 1 tickets" told a founder nothing about it.
        title: filed.length === 1 ? `${filed[0].id}: ${filed[0].title}` : `${plan.source_title}: ${filed.length} tickets`,
        head: branch,
        base,
        body: prBody,
      }),
    });
    movedOn(ventureId);
    return { ok: true, message: filed.length === 1 ? `Filed ${filed[0].id}.` : `Filed ${filed.length} tickets as one set.`, url: pr.html_url, filed };
  } catch (e) {
    // Surfaced, never swallowed (CLAUDE.md #10). A founder whose plan half-filed must not be told it
    // filed — the branch is named so they and an admin can see exactly what did land.
    console.error('[file-plan] failed', { ventureId, repo, branch, err: e });
    if (e instanceof GitHubError && e.status === 403) {
      return { ok: false, message: 'The studio is not allowed to write to this venture’s backlog. An admin needs to widen its access.' };
    }
    // Safe to press again: a ticket already filed keeps its number, so a second press finishes the
    // set rather than doubling it. Said plainly, because the alternative is a founder who does not
    // know whether their work exists.
    return {
      ok: false,
      message: 'Something went wrong partway through filing that set. Some of it may already be filed — '
        + 'pressing again will finish it rather than file anything twice.',
    };
  }
}

/**
 * A ticket's dependencies as real ids, resolved across the set being filed.
 *
 * This is the line that makes a dependency real rather than decorative. The composer could not write
 * it — at drafting time none of these tickets have a number — so the filer owns it, and it is only
 * writable at all because the whole set was allocated in one pass.
 */
function dependencyIdsFor(plan: PlanDraft, slug: string, idBySlug: Map<string, string>): string[] {
  const kept = new Set(keptTickets(plan).map((t) => t.slug));
  return effectiveDependsOn(plan, slug)
    .filter((d) => kept.has(d))
    .map((d) => idBySlug.get(d))
    .filter((id): id is string => Boolean(id));
}

/**
 * The founder has just filed their first work — stop showing them day one (FB-143).
 *
 * `loadVentureTickets` and `loadVentureAttention` cache per venture for two minutes. Without this a
 * founder files their first piece of work, goes back to their desk, and is greeted by *"your team is
 * set up and waiting for its first piece of work"* — for up to two minutes, with no way past it but
 * a URL parameter they have never seen.
 *
 * That is the worst two minutes in the product to be told nothing has happened. `clearTicketCache`
 * has been exported since FB-006 and called by nothing.
 *
 * Both caches: the tickets decide `boardState`, and the attention queue is where a filed set becomes
 * visible as work in progress (FB-120).
 */
function movedOn(ventureId: string): void {
  void ventureId; // the caches are per-venture keyed internally; clearing is all-or-nothing today
  clearTicketCache();
  clearAttentionCache();
}
