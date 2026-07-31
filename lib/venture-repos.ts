import type { VentureSummary } from './ventures';

/**
 * Every repo whose engine state belongs to this venture: the venture's own, plus each department's.
 *
 * Lives in its own module because both the approvals read model and the run-report read model need
 * it, and `lib/approvals.ts` reaches (transitively) for `server-only` — importing this one function
 * from there dragged the whole server chain into the client bundle and broke the build. A two-line
 * pure function is the wrong thing to couple a trust boundary to.
 *
 * Before FB-045 this was `repos[0]`, from a time when a venture had one repo. Once Sell and Scale
 * got their own, the department that actually spends money filed its proposals in the marketing repo
 * while the studio read the product repo — so a real send waiting for the founder rendered as an
 * empty queue. A gate nobody can see is not a gate.
 */
export function approvalRepos(venture: VentureSummary): string[] {
  // Both guarded: a venture manifest with no `departments` block is legal, and the venture page
  // swallows a throw here into an empty list — which would show a founder no external actions
  // waiting rather than an error, the one failure this surface exists to prevent.
  const repos = [...(venture.repos ?? []), ...(venture.departments ?? []).map((d) => d.repo)];
  return [...new Set(repos.filter((r): r is string => typeof r === 'string' && r.length > 0))];
}
