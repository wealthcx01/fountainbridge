import { auth } from '@/auth';
import { requireVenture } from '@/lib/venture-access';
import { approvalRepos } from '@/lib/venture-repos';
import { cardStore } from '@/lib/card-store-live';
import { isPictureName } from '@/lib/review';

/**
 * One of a finished card's four pictures (FB-274), as the planning box took it (FB-275).
 *
 * A route, not a page, so the venture layout's guard does not run here. This checks for itself, on
 * every request: `requireVenture` (signed in, and this venture is theirs), the repository is one of
 * this venture's, and the picture is read from the card store scoped to this venture alone, so the
 * database will not hand over another venture's. Anything else gets the same 404 as a picture that
 * does not exist, so a founder cannot learn from the answer whether another venture's card is there
 * (CLAUDE.md #6).
 *
 * The bytes live in the studio's database, never in git and never on disk: this repository is public.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; repo: string; number: string; name: string }> },
) {
  const { id, repo, number, name } = await params;
  if (!(await auth())?.user?.email) return new Response('You need to sign in.', { status: 401 });
  const access = await requireVenture(id);

  const n = Number(number);
  const store = cardStore();
  const png = access.ok && store && isPictureName(name) && Number.isInteger(n) && n > 0 && approvalRepos(access.venture).includes(repo)
    ? await store.picture(access.venture.id, repo, n, name)
    : null;
  if (!png) return new Response('That picture is not here.', { status: 404 });

  return new Response(Buffer.from(png), {
    headers: {
      'content-type': 'image/png',
      // A picture of one venture's work is that venture's alone: never kept by a shared cache.
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      // Opened on its own, it is still only a picture: no scripts, nothing fetched.
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
