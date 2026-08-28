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
import { fullRepoName } from '@/lib/venture-repos';
import { requireVentureRepo } from '@/lib/venture-access';
import {
  allocatePlanIds, effectiveDependsOn, keptTickets, orderPlan, planBranch, planProblem,
  ticketPrefixFor, withDependsOn, type PlanDraft,
} from '@/lib/plan-draft';
import { existingTicketFile, ticketPath, withTicketId } from '@/deploy/librechat/ticket-mcp/ids.mjs';

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
async function ticketNamesInFlight(client: GitHubClient, full: string, base: string): Promise<string[]> {
  const names = (await client.listDir(full, 'docs/tickets', base)).filter((e) => e.type === 'file').map((e) => e.name);

  let refs: Array<{ ref?: string }> = [];
  try {
    refs = await client.request<Array<{ ref?: string }>>(`/repos/${full}/git/matching-refs/heads/foundry/?per_page=100`);
  } catch {
    // No branches, or the listing failed. Allocating from the merged backlog alone is the FB-117 bug,
    // so this is said out loud rather than swallowed — and the settle check below is what catches it.
    console.warn('[file-plan] could not list in-flight ticket branches', { full });
    return names;
  }
  if (!Array.isArray(refs)) return names;
  if (refs.length >= 100) {
    console.warn('[file-plan] 100+ foundry branches; the id union may be incomplete', { full });
  }

  const branches = refs
    .map((r) => (typeof r?.ref === 'string' ? r.ref.replace(/^refs\/heads\//, '') : null))
    .filter((b): b is string => Boolean(b));

  const perBranch = await Promise.all(
    branches.map((b) => client.listDir(full, 'docs/tickets', b).catch(() => [])),
  );
  return names.concat(...perBranch.flat().filter((e) => e.type === 'file').map((e) => e.name));
}

export async function filePlan(
  ventureId: string,
  repo: string,
  plan: PlanDraft,
  /** How many tickets the founder was looking at when they pressed. A disagreement is a refusal. */
  confirmedCount: number,
): Promise<FilePlanResult> {
  const access = await requireVentureRepo(ventureId, repo);
  if (!access.ok) return { ok: false, message: access.error };

  if (plan.venture_id !== ventureId || plan.repo !== repo) {
    // The plan names where it belongs. A press that redirected it somewhere else would file a set of
    // tickets a founder read about one venture into another's backlog.
    return { ok: false, message: 'That plan was drafted for somewhere else. Nothing was filed.' };
  }

  const problem = planProblem(plan);
  if (problem) return { ok: false, message: problem };

  const { ordered } = orderPlan(plan);
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

    const inFlight = await ticketNamesInFlight(client, full, base);
    const prefix = ticketPrefixFor(repo, inFlight);

    // A second press must UPDATE this set, not double it.
    //
    // Pressing twice is ordinary — a founder who is not sure the first press landed presses again —
    // and without this it was ruinous: the first press's tickets are on this branch, so the union
    // counts them, the allocator steps past them, and the branch ends up carrying every ticket
    // twice under two sets of numbers. The single-ticket filer has had this since FB-097; the set
    // filer needs it for the same reason and did not have it.
    //
    // A ticket already here keeps the number the founder has already been told.
    const onBranch = (await client.listDir(full, 'docs/tickets', branch)).filter((e) => e.type === 'file').map((e) => e.name);
    const already = new Map<string, string>();
    for (const t of ordered) {
      const file = existingTicketFile(onBranch, t.slug);
      const id = file?.match(new RegExp(`^(${prefix}-\\d+[a-z]?)(?:[-.]|$)`, 'i'))?.[1];
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

    const summary = filed.map((f) => `- \`${f.id}\` — ${f.title}`).join('\n');
    const prBody = [
      `Filed from the Foundry composer by ${access.email}, as one set, on one press.`,
      '',
      `**From:** ${plan.source_title}`,
      '',
      summary,
      '',
      '---',
      '',
      'Each ticket cites the section of the document it came from. Nothing here is merged, and no lane',
      'picks any of it up until it is.',
    ].join('\n');

    const org = process.env.GITHUB_ORG ?? 'wealthcx01';
    const open = await client.request<Array<{ html_url: string }>>(
      `/repos/${full}/pulls?state=open&head=${encodeURIComponent(`${org}:${branch}`)}`,
    );
    if (Array.isArray(open) && open.length) {
      return { ok: true, message: `Updated all ${filed.length} tickets on the one pull request.`, url: open[0].html_url, filed };
    }

    const pr = await client.request<{ html_url: string }>(`/repos/${full}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: `${plan.source_title}: ${filed.length} tickets`,
        head: branch,
        base,
        body: prBody,
      }),
    });
    return { ok: true, message: `Filed ${filed.length} tickets as one set.`, url: pr.html_url, filed };
  } catch (e) {
    // Surfaced, never swallowed (CLAUDE.md #10). A founder whose plan half-filed must not be told it
    // filed — the branch is named so they and an admin can see exactly what did land.
    console.error('[file-plan] failed', { ventureId, repo, branch, err: e });
    if (e instanceof GitHubError && e.status === 403) {
      return { ok: false, message: 'The studio is not allowed to write to this venture’s backlog. An admin needs to widen its access.' };
    }
    return { ok: false, message: `Something went wrong filing that plan. Check the branch \`${branch}\` before pressing again.` };
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
