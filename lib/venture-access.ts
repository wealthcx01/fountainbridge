import 'server-only';

import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from './ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from './authz';

/**
 * The check every write into a venture's repositories starts with (CLAUDE.md #6).
 *
 * Venture isolation is server-side and absolute: a session scoped to one venture must never reach
 * another's data, and that is enforced here rather than by the surface that calls it. Two write paths
 * — a ticket's conversation (FB-126) and a filed plan (FB-127) — need exactly this check, and a
 * security check that exists twice is a security check that will one day differ.
 *
 * The repo argument is checked against the venture's own manifest rather than trusted. Without that,
 * a client that named someone else's repository would have its content written there under this
 * founder's name.
 *
 * Returned, never thrown, so each caller decides how to speak about a refusal.
 */
export type VentureAccess =
  | { ok: true; venture: VentureSummary; email: string }
  | { ok: false; error: string };

export async function requireVentureRepo(ventureId: string, repo: string): Promise<VentureAccess> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: 'You need to sign in.' };

  const admins = parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS);
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, admins);
  const venture = ventures.find((v) => v.id === ventureId);
  if (!venture || !canAccessVenture(access, ventureId)) {
    return { ok: false, error: 'You do not have access to this venture.' };
  }
  if (!(venture.repos ?? []).includes(repo)) {
    return { ok: false, error: 'That work is not in one of this venture’s repositories.' };
  }
  return { ok: true, venture, email };
}
