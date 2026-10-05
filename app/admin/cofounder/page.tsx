import { readFileSync } from 'node:fs';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { cofounderOverview, type CofounderOverview, type VentureCofounderView } from '@/lib/cofounder-admin';
import { normaliseSettings, STUCK_AFTER_DAYS } from '@/lib/cofounder';
import { MEMORY_PATH } from '@/lib/cofounder-service';
import { cofounderDeps } from '@/app/api/cofounder/deps';
import {
  CofounderLookNowButton,
  CofounderReleaseButton,
  CofounderSettingsForm,
  CofounderStopButton,
} from '@/components/CofounderControls';

/**
 * The studio's cofounder, and the dial you turn it with (FB-201) — Bruntsfield only.
 *
 * John asked for the limits on an always-on cofounder to be "settings that I manage in the admin
 * view". This is that view. It can make the cofounder quieter, narrower or silent. It cannot make it
 * dangerous: there is no switch here that lets it send, spend, merge, deploy or approve, and the page
 * says so in words, because a reader who cannot find that switch should understand its absence is
 * the design.
 *
 * Admin-only and unlinked, like the budgets and timing pages.
 */
export const dynamic = 'force-dynamic';

const when = (d: Date | string) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** Fixture rows for the UI gate, which runs with no database or GitHub. Only when the test login is on. */
function fixtureOverview(path: string): CofounderOverview {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CofounderOverview;
  return {
    stop: raw.stop,
    ventures: raw.ventures.map((v) => ({ ...v, settings: normaliseSettings(v.settings) })),
  };
}

async function readOverview(): Promise<CofounderOverview | { error: string }> {
  const fixture = process.env.COFOUNDER_FIXTURE;
  if (fixture && process.env.E2E_TEST_LOGIN === '1') return fixtureOverview(fixture);
  if (!process.env.DATABASE_URL?.trim()) {
    return { error: 'The studio has no database set up yet, so the cofounder’s settings cannot be shown or changed here. Until there is one it stays off.' };
  }
  try {
    return await cofounderOverview(cofounderDeps());
  } catch (e) {
    console.error('[cofounder] could not read the overview', { message: (e as Error)?.message });
    return { error: 'The studio could not read the cofounder’s settings just now. Nothing has changed; try again in a minute.' };
  }
}

/** One sentence on where this venture stands, before the dial. */
function standing(v: VentureCofounderView, stopped: boolean): string {
  if (stopped) return 'Stopped, with every other venture.';
  if (!v.settings.on) return 'Off.';
  if (v.memory?.latch) return 'Holding back until a person decides.';
  return `On. It wakes every ${v.settings.wakeEveryHours} hour${v.settings.wakeEveryHours === 1 ? '' : 's'}.`;
}

function VentureCard({ v, stopped }: { v: VentureCofounderView; stopped: boolean }) {
  return (
    <article className="card budget-card" data-testid={`cofounder-${v.ventureId}`}>
      <h2 className="budget-name">{v.name}</h2>
      <p className="budget-line" data-testid={`cofounder-${v.ventureId}-standing`}>
        <strong>{standing(v, stopped)}</strong>{' '}
        {v.memory?.lastWake
          ? <>Last looked {when(v.memory.lastWake)}: {v.memory.lastOutcome}</>
          : v.memoryError ?? 'It has not looked at this venture yet.'}
      </p>
      {v.memory?.latch ? (
        <div className="budget-proposal" data-testid={`cofounder-${v.ventureId}-latch`}>
          <p className="budget-line">
            On {when(v.memory.latch.at)} it asked the founder to decide: {v.memory.latch.reason} The question is
            on the ticket itself. Until somebody releases it, it will not look at {v.name} again.
          </p>
          <CofounderReleaseButton ventureId={v.ventureId} />
        </div>
      ) : null}
      <p className="budget-line muted" style={{ fontSize: 'var(--fs-meta)' }}>
        {v.setBy && v.setAt ? `Settings last changed by ${v.setBy} on ${when(v.setAt)}.` : 'Nobody has changed these settings yet, so they are the defaults.'}
      </p>
      <CofounderSettingsForm ventureId={v.ventureId} ventureName={v.name} initial={v.settings} />
      <div className="cofounder-look">
        <CofounderLookNowButton ventureId={v.ventureId} />
      </div>
    </article>
  );
}

export default async function CofounderPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const access = authorizeVentures(email, loadVentures(), parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  if (!access.isAdmin) {
    return (
      <p className="card" data-testid="cofounder-forbidden" style={{ fontSize: 'var(--fs-body-sm)' }}>
        This page is for the Bruntsfield team. Nothing here is about your venture.
      </p>
    );
  }

  const overview = await readOverview();

  return (
    <section data-testid="cofounder-admin">
      <p className="eyebrow"><span className="eyebrow-id">The studio&rsquo;s cofounder</span> — Bruntsfield only</p>
      <h1 style={{ margin: '0 0 0.35rem' }}>What it notices, and how often it speaks</h1>
      <div className="muted cofounder-intro">
        <p>
          While the founder is away, the studio looks over each venture that has this switched on. When a ticket
          has been in progress for {STUCK_AFTER_DAYS} days without moving forward, it says so on that ticket, once.
          If it asks the founder to decide, it then holds back on that venture until a person releases it.
        </p>
        <p data-testid="cofounder-floor">
          <strong>It can notice and propose. It can never send anything, spend money, accept a change into the product, put anything live, or approve anything.</strong>{' '}
          There is no switch on this page that changes that, and there never will be. That missing switch is the
          design: a setting that allowed it would be a way to remove the founder&rsquo;s approval from a form.
          Everything below can only make it quieter, narrower or silent.
        </p>
        <p>
          What it remembers is a plain file anyone can open, kept with each venture&rsquo;s records:{' '}
          <code>{MEMORY_PATH}</code>, on the foundry-state branch of the venture&rsquo;s first repository.
        </p>
      </div>

      {'error' in overview ? (
        <p className="card muted" data-testid="cofounder-unavailable" style={{ fontSize: 'var(--fs-body-sm)' }}>
          {overview.error}
        </p>
      ) : (
        <>
          <div className="card cofounder-stop" data-testid="cofounder-stop-card">
            <p className="budget-line">
              {overview.stop.stopped
                ? <>It is <strong>stopped for every venture</strong>{overview.stop.setBy && overview.stop.setAt ? <>, by {overview.stop.setBy} on {when(overview.stop.setAt)}</> : null}. Nothing wakes until somebody lifts this, whatever each venture&rsquo;s settings say.</>
                : <>One switch stops it for every venture at once, whatever each venture&rsquo;s own settings say.</>}
            </p>
            <CofounderStopButton stopped={overview.stop.stopped} />
          </div>
          <div className="budget-list">
            {overview.ventures.map((v) => <VentureCard key={v.ventureId} v={v} stopped={overview.stop.stopped} />)}
          </div>
        </>
      )}
    </section>
  );
}
