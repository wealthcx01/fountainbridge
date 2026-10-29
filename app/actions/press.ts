'use server';

/**
 * The studio's press door (FB-276): one press on one factory card.
 *
 * A server action is a public endpoint: anyone can call it with any arguments, signed in or not.
 * So nothing the call says about who is pressing is believed. In order:
 *
 *   1. signed in, and this venture is theirs (`requireVenture`, CLAUDE.md #6);
 *   2. the repository is one of the venture's own. If not, the answer is the one a missing card
 *      gets, so a typed-in card of another venture's tells the caller nothing;
 *   3. then `pressCard` (lib/press.ts): the card is this venture's, the press is one this person may
 *      make, the first press wins, and it is recorded for the planning box to collect.
 *
 * It never calls GitHub or Archon. The box does what the press asks, and says what happened through
 * its door (`docs/factory-cards.md`).
 */

import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { requireVenture } from '@/lib/venture-access';
import { approvalRepos } from '@/lib/venture-repos';
import { cardStore } from '@/lib/card-store-live';
import { pressCard, pressDeps, NOT_FOUND, type PressResult } from '@/lib/press';

export async function pressFactoryCard(
  ventureId: string,
  repo: string,
  number: number,
  action: string,
  note = '',
  seenHeadSha?: string,
): Promise<PressResult> {
  if (typeof ventureId !== 'string' || typeof repo !== 'string' || typeof number !== 'number') return { ok: false, message: NOT_FOUND };
  const access = await requireVenture(ventureId);
  if (!access.ok) return { ok: false, message: access.error };
  if (!approvalRepos(access.venture).includes(repo)) return { ok: false, message: NOT_FOUND };

  const store = cardStore();
  if (!store) return { ok: false, message: NOT_FOUND };
  const isJohn = authorizeVentures(access.email, loadVentures(), parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS)).isAdmin;
  try {
    return await pressCard(pressDeps(store), access.venture, { email: access.email, isJohn }, repo, number, action, { note, seenHeadSha });
  } catch (e) {
    console.error('[press] could not record a press', { message: (e as Error)?.message });
    return { ok: false, message: 'The studio could not record that just now. Nothing was done. Try again in a minute.' };
  }
}
