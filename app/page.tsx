import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { readiness } from '@/lib/readiness';
import { defaultNow } from '@/lib/health';
import { ledgerSummary, provisioningPatterns, waitingNow, type LedgerRow } from '@/lib/ledger';
import { loadLedgerRow, loadWaitingAges } from '@/lib/ledger-load';
import { Ledger, LedgerRowWaiting, WaitingNote } from '@/components/Ledger';

/**
 * Home (FB-015: private — no public landing).
 *
 * A founder with one venture never gets here: they are taken to their desk (FB-066). Bruntsfield
 * gets the ledger — every founder's desk in one table, coloured by whose attention each venture
 * needs (FB-136).
 *
 * ## Why the rows stream one at a time
 *
 * A row costs what a venture's own rail costs, and `loadRunReports` is ~4.3s (FB-157). Five ventures
 * awaited together would make this the slowest screen in the studio — the one screen whose job is to
 * tell Bruntsfield, at a glance, where to look. So the table draws immediately and each row arrives
 * on its own: a venture whose records are slow does not hold up the four that are not.
 */
export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const ventures = loadVentures();
  const access = authorizeVentures(
    session.user.email,
    ventures,
    parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS),
  );
  if (access.ventureIds.length === 0) redirect('/not-authorized');

  const visible = ventures.filter((v) => access.isAdmin || access.ventureIds.includes(v.id));

  // FB-066: a founder with one venture never sees a picker. Choosing between one thing is not a
  // choice — it is a page in the way of the thing they came for.
  if (!access.isAdmin && visible.length === 1) redirect(`/venture/${visible[0].id}`);

  if (!access.isAdmin) return <FounderVentures ventures={visible} />;

  return (
    <section data-testid="ledger">
      {/* copy-lint-ok: admin-only — Bruntsfield reads this screen, never a founder */}
      <p className="eyebrow"><span className="eyebrow-id">Bruntsfield</span> — all ventures</p>
      <h1 style={{ margin: '0 0 0.35rem' }}>Studio administration</h1>
      <p className="muted" style={{ maxWidth: 'var(--content-narrow)', fontSize: 'var(--fs-body-sm)' }}>
        Every founder&rsquo;s desk, in one ledger. A row is amber when its founder is the bottleneck,
        red when its team has stopped. Open a venture to see exactly what its founder sees.
      </p>

      <Suspense fallback={<LedgerLoading ventures={visible} />}>
        <LoadedLedger ventures={visible} />
      </Suspense>

      <hr className="hr" />

      <div className="grid-3" data-testid="ledger-footnotes">
        <Wiring ventures={visible} />
        <Suspense fallback={<p className="muted" style={{ fontSize: 'var(--fs-body-sm)' }}>Counting what is waiting…</p>}>
          <Waiting ventures={visible} />
        </Suspense>
        <Onboarding ventures={visible} />
      </div>
    </section>
  );
}

/**
 * The table before any row is in: every venture named, nothing claimed about any of them.
 *
 * Its own test id, **not** the real table's (FB-158's lesson, repeated here on the first attempt).
 * While a Suspense boundary resolves, the fallback and the streamed content are both in the
 * document — sharing one id makes "is the ledger there?" un-askable, and it put two seven-column
 * tables on a 393px screen at the moment the phone check measured.
 */
function LedgerLoading({ ventures }: { ventures: VentureSummary[] }) {
  return (
    <div className="table-scroll">
      <table className="records" data-testid="ledger-waiting">
        <tbody>
          {ventures.map((v) => (
            <LedgerRowWaiting key={v.id} ventureId={v.id} name={v.name} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The ledger, once every row is in.
 *
 * One boundary rather than one per row: the summary sentence has to count the rows the table shows,
 * and a sentence that changes under the reader as rows land would be worse than a table that arrives
 * whole. The rows still load in parallel — what waits is the render, not the reads.
 */
async function LoadedLedger({ ventures }: { ventures: VentureSummary[] }) {
  const now = defaultNow();
  const rows: LedgerRow[] = await Promise.all(ventures.map((v) => loadLedgerRow(v, now)));
  return (
    <>
      <p data-testid="ledger-summary" style={{ fontSize: 'var(--fs-subhead)' }}>{ledgerSummary(rows)}</p>
      <Ledger rows={rows} />
    </>
  );
}

/**
 * Which ventures cannot actually be used yet (FB-087's readiness, on the screen that can act on it).
 *
 * The design's example is exact: *"Caldera's composer key is not set; its founder meets a dead
 * button on day one. Fix before invite."* Read from the running process, because configuration that
 * only exists in the environment can only be checked there.
 */
function Wiring({ ventures }: { ventures: VentureSummary[] }) {
  const report = readiness(ventures, process.env);
  const broken = report.ventures.filter((v) => !v.ready);
  return (
    <div data-testid="ledger-wiring">
      <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>Wiring</p>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
        {broken.length === 0
          ? 'Every venture is wired to its own machine.'
          : /* copy-lint-ok: admin-only wiring diagnostics — names the variable so the fix is copy-pasteable */
            broken.map((v) => `${v.problem} (${v.keyEnvName})`).join(' ')}
        {broken.length ? ' Fix before inviting a founder — they would meet a dead button on day one.' : null}
      </p>
    </div>
  );
}

async function Waiting({ ventures }: { ventures: VentureSummary[] }) {
  const ages = await loadWaitingAges(ventures, defaultNow()).catch(() => [] as number[]);
  return <WaitingNote waiting={waitingNow(ages)} />;
}

/** Which accounts a new founder could be provisioned from — derived, not designated. */
function Onboarding({ ventures }: { ventures: VentureSummary[] }) {
  const patterns = provisioningPatterns(ventures, readiness(ventures, process.env).ventures);
  return (
    <div data-testid="ledger-onboarding">
      <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>Onboarding</p>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
        {patterns.length
          ? `Provision the next founder from ${patterns.join(' or ')} — ${patterns.length === 1 ? 'it has' : 'they have'} a founder account, a machine and a working key.`
          : 'No venture is complete enough to copy yet: a pattern needs a founder account, a machine and a working key.'}
      </p>
    </div>
  );
}

/** The picker, for the rare founder with more than one venture. Unchanged by FB-136. */
function FounderVentures({ ventures }: { ventures: VentureSummary[] }) {
  return (
    <section>
      <p className="eyebrow"><span className="eyebrow-id">Ventures</span> — your ventures</p>
      <h1>Foundry Studio</h1>
      <hr className="hr" />
      <div className="grid" data-testid="venture-grid">
        {ventures.map((v) => (
          <Link key={v.id} href={`/venture/${v.id}`} className="card card-link" data-testid={`venture-${v.id}`}>
            <div className="stack">
              <h3 style={{ margin: '0.1rem 0 0' }}>{v.name}</h3>
              <span className={`tag ${v.status === 'active' ? 'tag-accent' : ''}`}>{v.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
