import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { cardOf, cardSource, testPicture } from '@/lib/review-load';
import { isPictureName } from '@/lib/review';

/**
 * One of a finished card's four pictures (FB-274).
 *
 * A route, not a page, so the venture layout's guard does not run here. This checks for itself, on
 * every request: signed in, this venture is theirs, and the card is one of this venture's. Anything
 * else gets the same 404 as a picture that does not exist, so a founder cannot learn from the answer
 * whether another venture's card is there (CLAUDE.md #6).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; repo: string; number: string; name: string }> },
) {
  const { id, repo, number, name } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return new Response('You need to sign in.', { status: 401 });

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  const card = venture && canAccessVenture(access, id) && isPictureName(name)
    ? cardOf(venture, repo, Number(number), cardSource())
    : null;
  const svg = card && venture && isPictureName(name) ? testPicture(card, name, venture.name) : null;
  if (!svg) return new Response('That picture is not here.', { status: 404 });

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // A picture of one venture's work is that venture's alone: never kept by a shared cache.
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      // Opened on its own, it is still only a picture: no scripts, nothing fetched.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
