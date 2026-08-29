import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference, STATUS_GROUPS } from '@/lib/tickets';
import { loadFiledForLanes, defaultBranchFileReader, type FiledTicket } from '@/lib/filed-tickets';
import { ticketsByRepoFrom } from '@/lib/venture-tickets-index';
import { loadVentureAttention } from '@/lib/attention';
import { VentureForbidden } from '@/components/VentureForbidden';
import { TicketsView } from '@/components/TicketsView';
import { TicketTrail } from '@/components/TicketTrail';
import type { VentureSummary } from '@/lib/ventures';
import { filterTickets, parseFilter, resolveSelected, rowKey, type TicketRow } from '@/lib/tickets-view';
import { loadApprovals, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from '@/lib/approvals';
import { loadRunReports, type RunReport } from '@/lib/runreports';
import { githubRunReportSource, fixtureRunReportSource } from '@/lib/runreports-load';
import { GitHubClient } from '@/lib/github';
import { trailSources } from '@/lib/trail-sources';
import { loadTrail } from '@/lib/trail-load';

/**
 * Tickets (FB-129) — the list, the ticket, and the decision, on one screen.
 *
 * A founder used to read a ticket in a drawer and decide about it on a different page, with nothing
 * on either saying the other existed. This is where both live.
 *
 * ## The selection is in the URL, deliberately
 *
 * Not component state. "Discuss in the composer →" leaves this screen and the founder comes back;
 * dependency chips link ticket to ticket; "Next decision →" is a navigation. All three break if a
 * ticket cannot be addressed — and it is also what makes a ticket linkable at all, from the desk's
 * queue, from a run report, from a message.
 */
export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; t?: string; refresh?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const { id } = await params;
  const { filter, t, refresh } = await searchParams;

  const ventures = loadVentures();
  const access = authorizeVentures(session.user.email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  // Denied BEFORE any data fetch, the same as the desk: an unauthorized session sees the refusal.
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const refreshing = refresh === '1';
  const data = await loadVentureTickets(venture, { refresh: refreshing });
  const attention = await loadVentureAttention(venture, {
    refresh: refreshing,
    tickets: ticketsByRepoFrom(data.lanes),
  });

  const inferred = data.lanes.map((lane) => applyStatusInference(lane, attention.ticketStatus));
  // FB-120: work filed minutes ago is not on the default branch yet, and a founder who just pressed
  // "File all" must find it here. Degrades to none rather than blanking a list that was fine.
  const filedByRepo = await loadFiledForLanes(inferred, attention.perRepo, defaultBranchFileReader())
    .catch(() => new Map<string, FiledTicket[]>());

  // What is actually waiting, keyed the same way the board keys it, so this screen and the desk
  // cannot disagree about which tickets need the founder.
  //
  // The OLDEST per ticket, not the last one seen. A ticket can carry more than one open pull request
  // — a lane retries, or files a revision — and a `Map` that took whichever came last would drop the
  // other from the list while the rail's badge went on counting it. Every waiting item is still
  // counted; they are just gathered under the ticket they belong to.
  const waitingFor = new Map<string, { repo: string; number: number; ageMs: number; also: number; headSha: string | null }>();
  for (const pr of attention.approvals) {
    if (!pr.linkedTicketId) continue;
    const key = `${pr.repo} ${pr.linkedTicketId}`;
    const held = waitingFor.get(key);
    if (!held) waitingFor.set(key, { repo: pr.repo, number: pr.number, ageMs: pr.ageMs, also: 0, headSha: pr.headSha });
    else if (pr.ageMs > held.ageMs) waitingFor.set(key, { repo: pr.repo, number: pr.number, ageMs: pr.ageMs, also: held.also + 1, headSha: pr.headSha });
    else held.also += 1;
  }
  const surfaceOf = new Map((venture.departments ?? []).map((d) => [d.repo, d.name]));

  // FB-120: a ticket the composer just filed arrives as a pull request on a `foundry/<slug>` branch
  // whose title carries no ticket id, so it links to nothing — and would be appended below as work
  // "not tied to anything you asked for", beside the very ticket it carries.
  //
  // ATTACHED to its own row rather than dropped. A filing is genuinely waiting on the founder — the
  // ticket does not join the backlog until it is merged (CLAUDE.md #2) — and the rail's badge counts
  // it. Excluding it here would have fixed the duplicate row and reopened the badge/filter
  // disagreement in the same change.
  const ageOfPr = new Map(attention.approvals.map((pr) => [`${pr.repo}#${pr.number}`, pr.ageMs]));
  const shaOfPr = new Map(attention.approvals.map((pr) => [`${pr.repo}#${pr.number}`, pr.headSha]));
  const filedPrs = new Set(
    [...filedByRepo].flatMap(([repo, fs]) => fs.map((f) => `${repo}#${f.prNumber}`)),
  );
  for (const [repo, fs] of filedByRepo) {
    for (const f of fs) {
      const age = ageOfPr.get(`${repo}#${f.prNumber}`);
      if (age === undefined) continue;   // its pull request is not open, so nothing waits
      waitingFor.set(`${repo} ${f.ticket.id}`, { repo, number: f.prNumber, ageMs: age, also: 0, headSha: shaOfPr.get(`${repo}#${f.prNumber}`) ?? null });
    }
  }
  // Where a filed ticket actually LIVES — its own branch, not the default one. Without this the
  // "see where this is written down" link points at the one branch the file is provably not on.
  const filedBranch = new Map(
    [...filedByRepo].flatMap(([repo, fs]) => fs.map((f) => [`${repo} ${f.ticket.id}`, f.branch] as const)),
  );

  const rows: TicketRow[] = [];
  for (const lane of inferred) {
    const filed = filedByRepo.get(lane.repo) ?? [];
    const groups = filed.length ? { ...lane.groups, filed } : lane.groups;
    for (const group of STATUS_GROUPS) {
      for (const item of groups[group] ?? []) {
        rows.push({
          id: item.ticket.id,
          title: item.ticket.title,
          repo: lane.repo,
          group,
          item,
          waiting: waitingFor.get(`${lane.repo} ${item.ticket.id}`) ?? null,
          surface: surfaceOf.get(lane.repo) ?? null,
        });
      }
    }
  }

  // Finished work tied to no ticket at all (FB-099's gap, and FB-129's version of it). It still
  // waits on the founder, so it is a row. Leaving it out is how the rail came to say "Needs you 4"
  // over a filter showing 2: the badge counted what was waiting, the screen counted what happened
  // to have a ticket file.
  const onBoard = new Set(rows.map((r) => `${r.repo} ${r.id}`));
  for (const pr of attention.approvals) {
    if (pr.linkedTicketId && onBoard.has(`${pr.repo} ${pr.linkedTicketId}`)) continue;
    if (filedPrs.has(`${pr.repo}#${pr.number}`)) continue;
    rows.push({
      id: `${pr.repo}#${pr.number}`,
      title: pr.ticketTitle ?? pr.title,
      repo: pr.repo,
      group: 'pr-open',
      item: null,
      waiting: { repo: pr.repo, number: pr.number, ageMs: pr.ageMs, headSha: pr.headSha },
      surface: surfaceOf.get(pr.repo) ?? null,
    });
  }

  const refs = new Map(inferred.map((lane) => [lane.repo, lane.ref]));

  const activeFilter = parseFilter(filter);
  const selected = resolveSelected(rows, filterTickets(rows, activeFilter), typeof t === 'string' ? t : null);

  return (
    <TicketsView
      ventureId={venture.id}
      ventureName={venture.name}
      rows={rows}
      filter={activeFilter}
      // The RESOLVED key, not the raw query. The client used to resolve it again with different
      // fallbacks, so the trail loaded here could belong to a different ticket than the one rendered.
      selectedId={selected ? rowKey(selected) : null}
      // FB-130: STREAMED, not awaited.
      //
      // Blocking the page on it took the tickets screen from usable to **23 seconds** on ARCA's real
      // backlog — measured, three loads, against a desk that costs 6.5s. The trail is supplementary:
      // a founder came here to read a ticket and decide on it, and neither needs the history. So the
      // list and the ticket render immediately and the history arrives when it arrives.
      //
      // Skipped entirely for a row with no ticket file: nothing here can match a `repo#number` id.
      trail={
        selected?.item ? (
          <Suspense fallback={<TrailPending />}>
            <TrailFor venture={venture} row={selected} attention={attention} filedByRepo={filedByRepo} />
          </Suspense>
        ) : null
      }
      refs={Object.fromEntries(refs)}
      filedBranches={Object.fromEntries(filedBranch)}
      org={process.env.GITHUB_ORG ?? 'wealthcx01'}
      errors={[...data.lanes.filter((l) => l.error).map((l) => l.error as string), ...attention.errors]}
    />
  );
}


/**
 * The selected ticket's history, loaded off the critical path (FB-130).
 *
 * Its own async component so React can stream it: the list and the ticket paint immediately and this
 * arrives after. Blocking the page on it cost **23 seconds** on ARCA's real backlog against a 6.5s
 * desk, and a founder came to this screen to read a ticket and decide on it — neither of which needs
 * the history.
 *
 * The read budget, honestly (FB-154 fixes it properly):
 *
 * - `loadApprovals` walks every approval the venture has and is not cached. It is here only to learn
 *   which approvals belong to THIS ticket, which is a question the store cannot currently be asked.
 * - `loadRunReports` is left at its default 20. Raising it to 200 to stop run hops vanishing turned
 *   into `200 × READ_MARGIN` = **600 file reads per repository**, which was most of the 23 seconds.
 *   The cap is honest instead: when there were more reports than were read, the trail says its
 *   history may be short rather than passing a truncated one off as complete.
 */
async function TrailFor({
  venture,
  row,
  attention,
  filedByRepo,
}: {
  venture: VentureSummary;
  row: TicketRow;
  attention: Awaited<ReturnType<typeof loadVentureAttention>>;
  filedByRepo: Map<string, FiledTicket[]>;
}) {
  const testRig = process.env.E2E_TEST_LOGIN === '1';
  const [approvals, runs] = await Promise.all([
    loadApprovals(
      venture,
      process.env.APPROVALS_FIXTURE_DIR && testRig
        ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
        : githubApprovalSource(new GitHubClient()),
    ).catch(() => ({ approvals: [] as ActiveGraphApproval[], capped: false })).then((r) => (Array.isArray(r) ? { approvals: r, capped: false } : r)),
    loadRunReports(
      venture,
      process.env.RUNREPORTS_FIXTURE_DIR && testRig
        ? fixtureRunReportSource(process.env.RUNREPORTS_FIXTURE_DIR)
        : githubRunReportSource(new GitHubClient()),
    ).catch(() => ({ reports: [] as RunReport[], heartbeats: [] as RunReport[], total: 0 })),
  ]);

  const trail = await loadTrail(venture, row.repo, row.id, trailSources(venture, {
    approvals: approvals.approvals,
    runs: runs.reports.filter((r) => !r.isHeartbeat && r.repo === row.repo && r.ticketsTouched.includes(row.id)),
    work: attention.approvals,
    filedPrNumbers: Object.fromEntries(
      [...filedByRepo].flatMap(([repo, fs]) => fs.map((f) => [`${repo} ${f.ticket.id}`, f.prNumber] as const)),
    ),
  }));

  // More reports existed than were read — so runs for this ticket MAY have been missed.
  //
  // Only said when none were found. ARCA has over a hundred run reports and twenty are read, so
  // marking every trail degraded made the warning fire on every ticket forever, and a warning that
  // is always on is one nobody reads. When the window did turn up this ticket's runs it plainly
  // covered it; when it turned up none, "there may be more I could not see" is the honest state and
  // the difference a founder needs.
  const mightHaveMissedRuns =
    runs.total > runs.reports.length && !trail.hops.some((h) => h.source === 'run');
  return <TicketTrail trail={mightHaveMissedRuns ? { ...trail, degraded: true } : trail} />;
}


/**
 * What the founder sees while the history is still being read.
 *
 * A named state rather than a blank space, because the alternative is a ticket that looks finished
 * and then grows a section under the reader's hands. It says what is happening and that nothing is
 * waiting on them.
 */
function TrailPending() {
  return (
    <section
      data-testid="trail-pending"
      style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}
    >
      <p className="eyebrow" style={{ marginTop: 0 }}>Follow the change</p>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
        Reading what happened to this one…
      </p>
    </section>
  );
}
