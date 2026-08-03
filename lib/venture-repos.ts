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

/**
 * The GitHub-addressable name for a venture repo (FB-094).
 *
 * Manifests declare repos as bare slugs (`arca`), and everything internal — fixture directories,
 * ActiveGraph paths, display — keys off that slug. GitHub's API and the FB-044 attestation need
 * `owner/slug`. For weeks the studio passed the bare slug to both: every `/repos/arca/...` read
 * 404ed and was swallowed into "no lane / no approvals", and a studio-signed grant could never have
 * verified on the box, whose executor signs over its full `REPO`. The e2e fixtures are keyed by the
 * bare slug, so the whole suite stayed green — a local fixture proving the code while the deployment
 * read nothing (the FB-087 lesson, on the read side).
 *
 * One rule, applied at the GitHub/attestation boundary and nowhere else: prefix a bare slug with
 * the org; pass an already-qualified name through untouched.
 */
export function fullRepoName(repo: string, org: string = process.env.GITHUB_ORG ?? 'wealthcx01'): string {
  return repo.includes('/') ? repo : `${org}/${repo}`;
}
