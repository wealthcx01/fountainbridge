import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { recentSteps, summarise, RING_SIZE } from '@/lib/timing';
import { ago } from '@/lib/when';

/**
 * Where the studio spent its time (FB-151) — Bruntsfield only.
 *
 * Twice the studio has been made faster by reasoning about which code looked expensive, and twice
 * the reasoning was wrong: FB-128 optimised a page that was not the slow part, and FB-151 was
 * written believing the rail was, when `/login` — which has no rail — was equally slow. This is the
 * screen that ends that. It prints readings taken on the hot path of real requests.
 *
 * ## Why it is admin-only and unlinked
 *
 * A founder has no use for it and it uses engineering words on purpose. `STUDIO_ADMIN_EMAILS`
 * already decides who is Bruntsfield rather than a founder, so this reuses that rather than
 * inventing a second idea of who may see what. Nothing links here; it is a tool you type the path
 * to.
 *
 * ## What the numbers do NOT tell you
 *
 * They come from one server process. A deploy empties them, and if the studio is ever running more
 * than one instance you are reading whichever one answered you. The page says both out loud —
 * a diagnostic that overstates its own reach is worse than none.
 */
export const dynamic = 'force-dynamic';

export default async function TimingPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const access = authorizeVentures(email, loadVentures(), parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  // Not a 404 and not a redirect to a venture: this is a Bruntsfield tool, and a founder who lands
  // here by typing a path should be told plainly that it is not for them.
  if (!access.isAdmin) {
    return (
      <p className="card" data-testid="timing-forbidden" style={{ fontSize: 'var(--fs-body-sm)' }}>
        This page is for the Bruntsfield team. Nothing here is about your venture.
      </p>
    );
  }

  const steps = recentSteps();
  const rows = summarise(steps);

  return (
    <section data-testid="timing">
      {/* copy-lint-ok: admin-only diagnostics — Bruntsfield reads this page, never a founder */}
      <p className="eyebrow"><span className="eyebrow-id">Diagnostics</span> — Bruntsfield only</p>
      <h1 style={{ margin: '0 0 0.35rem' }}>Where the studio spent its time</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)', marginTop: 0 }}>
        {/* copy-lint-ok: admin-only diagnostics — names the server process on purpose */}
        The last {RING_SIZE} measured steps from real requests to <strong>this server process</strong>.
        A deploy empties them, and if more than one instance is running these are one instance&rsquo;s
        readings, not the whole picture.
      </p>

      {rows.length === 0 ? (
        <p className="card muted" data-testid="timing-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
          Nothing measured yet on this instance. Load a few screens and come back.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="records" data-testid="timing-table">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Median</th>
                <th scope="col">Slowest</th>
                <th scope="col">Readings</th>
                <th scope="col">Most recent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} data-testid={`timing-row-${row.name}`}>
                  <td>{row.name}</td>
                  <td>{row.medianMs} ms</td>
                  <td>{row.slowestMs} ms</td>
                  <td>{row.count}</td>
                  <td>{ago(new Date(row.newestAt).toISOString()) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', maxWidth: 'var(--content-narrow)' }}>
        Median rather than average, with the slowest beside it: the average of one cold start and
        nine warm reads describes neither.
      </p>
    </section>
  );
}
