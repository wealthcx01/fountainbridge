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
 *
 * ## Two doors, one guard (FB-200)
 *
 * A browser has a session. A tool call from Claude has a ticket instead — one the studio minted for
 * somebody who had already passed this check. Rather than give the tools their own copy of the
 * rules, they hand in an `Actor` and the check stays here, because *"a security check that exists
 * twice is a security check that will one day differ"* is the sentence this file was written
 * around, and a second door is exactly how FB-140's scanned-and-unscanned deposit paths happened.
 *
 * An actor is **narrower** than a session, never wider: `scopedTo` pins it to one venture, so a
 * ticket minted for arca cannot be pointed at another venture even by an admin whose session could
 * have reached it.
 */
export interface Actor {
  email: string;
  /** The one venture this actor may touch. Set for a tool ticket; absent for a browser session. */
  scopedTo?: string;
}
export type VentureAccess =
  | { ok: true; venture: VentureSummary; email: string }
  | { ok: false; error: string };

export async function requireVentureRepo(
  ventureId: string,
  repo: string,
  actor?: Actor,
): Promise<VentureAccess> {
  // A ticket that names one venture may only ever be used on that venture. Checked before anything
  // else, because it is the narrowest rule and the cheapest to be sure of.
  if (actor?.scopedTo && actor.scopedTo !== ventureId) {
    return { ok: false, error: 'That credential is for a different venture.' };
  }
  const email = actor?.email ?? (await auth())?.user?.email;
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
