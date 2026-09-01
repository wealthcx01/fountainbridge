import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { approvalRepos } from '@/lib/venture-repos';
import { defaultKnowledgeSource, defaultProvenanceSource } from '@/lib/knowledge-load';
import { originOf, type KnowledgeRow } from '@/lib/knowledge';
import { GitHubClient } from '@/lib/github';
import { loadRoutines, type Routine } from '@/lib/routines';
import { fixtureRoutineSource, githubRoutineSource } from '@/lib/routines-load';
import { timed } from '@/lib/timing';
import { VentureForbidden } from '@/components/VentureForbidden';
import { KnowledgeView, MemoryWaiting } from '@/components/KnowledgeView';

/**
 * Memory — what this venture knows (FB-133, over FB-106).
 *
 * Documents went in through the composer and then vanished from the founder's view; FB-106 made the
 * corpus visible, and this makes it answerable: where each document came from, when it arrived, and
 * — below it — the recurring work that happens without anyone asking.
 *
 * Scoped server-side before anything is fetched, like every other venture route (CLAUDE.md #6).
 *
 * ## The read budget
 *
 * The corpus costs three reads per surface and not one more, whatever it grows to: two for the
 * documents (`context/`, `library/`) and one aliased query for every document's provenance, capped
 * at `MAX_PROVENANCE_PATHS`. Bounded per load, never on a timer, never a function of how much
 * history the venture has — FB-083's rule.
 *
 * The routines are the exception and it is worth stating rather than hiding: `loadRoutines` lists a
 * directory and then reads each file, so that half grows with the number of routines. It is the same
 * cost `/venture/[id]/routines` already pays, and a routine is a founder-approved standing order, so
 * the count is small and human-bounded rather than a function of history. If it ever stops being
 * small, it wants the same treatment the corpus got here — one query, not one per file.
 *
 * The repos run in parallel, and each one's provenance follows its own corpus rather than waiting
 * for all of them: the paths are not known until the corpus is read, so this is a genuine
 * dependency, not the FB-128 mistake of parallelising two calls that shared a cache.
 */
export default async function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  return (
    <Suspense fallback={<MemoryWaiting ventureName={venture.name} />}>
      <Memory venture={venture} />
    </Suspense>
  );
}

/**
 * The corpus once it is read (FB-157).
 *
 * Split out so the `<Suspense>` above has something to wait on. The heading, the explanation and the
 * Add control are all true before a document has been read, so they render immediately — and Add is
 * the thing a founder most often came to this screen to use.
 */
async function Memory({ venture }: { venture: VentureSummary }) {
  const id = venture.id;
  const corpusOf = defaultKnowledgeSource();
  const provenanceOf = defaultProvenanceSource();

  const [perRepo, routineResult] = await Promise.all([
    Promise.all(
      approvalRepos(venture).map(async (repo) => {
        // A corpus read that THROWS must not blank the screen (FB-137). It did: with the read
        // failing, `/venture/arca/knowledge` rendered nothing at all — not a panel saying what
        // could not be read, the whole page empty. The founder's own documents are what this
        // screen is for, and "gone" and "could not look" are the two things it must never confuse.
        const corpus = await timed('memory: the documents', () => corpusOf(repo), repo).catch(() => ({
          docs: [],
          error: `The studio could not read what ${repo} holds just now.`,
        }));
        // Provenance is a nicety; the corpus is the page. A history read that fails must cost the
        // founder a dash in two columns, never the list of what they have handed over.
        const commits = await timed(
          'memory: where each came from',
          () => provenanceOf(repo, corpus.docs.map((d) => d.path)),
          repo,
        ).catch(() => null);
        const rows: KnowledgeRow[] = corpus.docs.map((doc) => ({
          repo,
          doc,
          origin: originOf(commits?.get(doc.path) ?? null),
        }));
        return { rows, error: corpus.error, provenanceRead: commits !== null };
      }),
    ),
    loadRoutinesSafely(venture),
  ]);

  const rows = perRepo.flatMap((r) => r.rows);
  // An unreadable corpus must never render as "you have given it nothing" — the difference between
  // those two is a founder's own work (FB-021, on the surface where it matters most).
  const errors = perRepo.map((r) => r.error).filter((e): e is string => !!e);
  // Said out loud rather than swallowed: a dash the founder cannot explain is worse than a dash they
  // can (CLAUDE.md #10). True when a history read failed OR when the cap left rows undated.
  const provenanceMissing =
    perRepo.some((r) => !r.provenanceRead) || rows.some((r) => r.origin.kind === 'unknown');

  return (
    <KnowledgeView
      ventureId={id}
      ventureName={venture.name}
      rows={rows}
      errors={errors}
      routines={routineResult.routines}
      routineErrors={routineResult.errors}
      provenanceMissing={provenanceMissing}
    />
  );
}

/**
 * The routines, degrading rather than throwing.
 *
 * A venture with no recurring work and a venture whose records could not be read are different
 * facts, and showing the second as the first is the failure CLAUDE.md #10 exists to prevent — the
 * same distinction `app/venture/[id]/routines/page.tsx` draws, drawn the same way.
 */
async function loadRoutinesSafely(
  venture: Parameters<typeof loadRoutines>[0],
): Promise<{ routines: Routine[]; errors: string[] }> {
  const source =
    process.env.ROUTINES_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
      ? fixtureRoutineSource(process.env.ROUTINES_FIXTURE_DIR)
      : githubRoutineSource(new GitHubClient());
  try {
    return { routines: await timed('memory: recurring work', () => loadRoutines(venture, source), venture.id), errors: [] };
  } catch {
    return { routines: [], errors: ['The studio could not read this venture’s recurring work just now.'] };
  }
}
