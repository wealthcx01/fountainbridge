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
 * A browser has a session. A tool call from Claude has a signed credential instead, naming one
 * venture. Rather than give the tools their own copy of the rules, they hand in an `Actor` and the
 * check stays here, because *"a security check that exists twice is a security check that will one
 * day differ"* is the sentence this file was written around, and a second door is exactly how
 * FB-140's scanned-and-unscanned deposit paths happened.
 *
 * An actor is **narrower** than a session, never wider: `scopedTo` pins it to one venture, so a
 * ticket minted for arca cannot be pointed at another venture even by an admin whose session could
 * have reached it.
 *
 * An actor is only believed if this module made it (`toolActor`, FB-257). Anything else that arrives
 * in the actor's place came from a request, and is refused.
 */
export interface Actor {
  email: string;
  /** The one venture this actor may touch. Set for a tool ticket; absent for a browser session. */
  scopedTo?: string;
}

/**
 * Every actor this server made, and no other (FB-257).
 *
 * `filePlan`, `readThread` and `appendToThread` are server actions, and **a server action is a public
 * endpoint**: anyone can call it with any arguments, signed in or not. Each takes an optional actor.
 * Before this, an actor was just an object with an email in it, and the email was believed — so a
 * request that sent `{ email: <a founder's address> }` (the addresses are in the public manifests)
 * was treated as that founder, without signing in, and could file into their backlog or read their
 * tickets' conversations.
 *
 * An actor now counts only if this module made it, in this process. Objects that arrive in a request
 * are new objects, never in this set, so they are refused. Nothing a request carries can put an
 * object into this set, so it cannot be forged that way.
 *
 * The set is kept on the server process itself, not inside this file. Next.js can load one file
 * twice — once for the tool route, once for the server actions it calls. If each copy kept its own
 * set, the route would make an actor in one and the action would look for it in the other, and every
 * tool call would be refused with "That credential is not one this studio issued." Keeping one set
 * per process means both copies see the same actors. (If that message ever appears on a real tool
 * call, this is the first place to look.)
 */
const ISSUED = Symbol.for('foundry-studio.tool-actors-issued');
const issued: WeakSet<Actor> = ((globalThis as { [ISSUED]?: WeakSet<Actor> })[ISSUED] ??= new WeakSet<Actor>());

/**
 * The actor for a call through the studio's tools, scoped to the one venture its credential names.
 *
 * Only `app/api/mcp/route.ts` makes these, and only after the credential's signature has been
 * checked. The actor may act on the venture the credential names, and on nothing else.
 *
 * Be clear about what that rests on. Nothing checks a person here: the credential is trusted because
 * it is signed with `FOUNDRY_APPROVAL_SECRET`. Today nothing in the studio signs credentials at all —
 * `mintMcpTicket` is only called by tests — so whoever holds that secret can make a 12-hour
 * credential for any venture. Whatever starts minting credentials later must first run the venture
 * check (`requireVenture` with no actor) for the person asking, and mint only for a venture they
 * passed it on.
 */
export function toolActor(ventureId: string): Actor {
  // The email names the tool, not a person, so a founder reading their ticket's history can tell
  // which of the two wrote there.
  const actor: Actor = Object.freeze({ email: `studio-tools@${ventureId}`, scopedTo: ventureId });
  issued.add(actor);
  return actor;
}
export type VentureAccess =
  | { ok: true; venture: VentureSummary; email: string }
  | { ok: false; error: string };

/**
 * The same check, for a write that belongs to the venture rather than to one of its repositories —
 * a founder's phone subscribing to its push (FB-141). `requireVentureRepo` below is this check plus
 * one more, so the rules exist once.
 */
export async function requireVenture(ventureId: string, actor?: Actor): Promise<VentureAccess> {
  if (actor != null) {
    // An actor this server did not make is something a request sent. Refused outright, never
    // treated as a session — see `issued` above.
    if (!issued.has(actor)) return { ok: false, error: 'That credential is not one this studio issued.' };
    // A ticket that names one venture may only ever be used on that venture.
    if (actor.scopedTo !== ventureId) {
      return { ok: false, error: 'That credential is for a different venture.' };
    }
    // The credential is trusted because it is signed (see `toolActor` for what that does and does
    // not prove), and it names this venture alone. Its tool email is not a founder's or an admin's, so running the check again would refuse
    // every tool call — which is what it did, and why no tool that writes had ever worked.
    const venture = loadVentures().find((v) => v.id === ventureId);
    if (!venture) return { ok: false, error: 'You do not have access to this venture.' };
    return { ok: true, venture, email: actor.email };
  }
  const email = (await auth())?.user?.email;
  if (!email) return { ok: false, error: 'You need to sign in.' };
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === ventureId);
  if (!venture || !canAccessVenture(access, ventureId)) {
    return { ok: false, error: 'You do not have access to this venture.' };
  }
  return { ok: true, venture, email };
}

export async function requireVentureRepo(
  ventureId: string,
  repo: string,
  actor?: Actor,
): Promise<VentureAccess> {
  const access = await requireVenture(ventureId, actor);
  if (!access.ok) return access;
  if (!(access.venture.repos ?? []).includes(repo)) {
    return { ok: false, error: 'That work is not in one of this venture’s repositories.' };
  }
  return access;
}
