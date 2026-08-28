/**
 * Types for the one ticket-id allocator (FB-127).
 *
 * `ids.mjs` runs on a venture box under mongosh/node and is deliberately plain JavaScript with no
 * build step. The studio needs the same logic to file a plan as a set, and a second copy would be
 * exactly the drift FB-117 and FB-118 were: two allocators disagreeing about what an id is.
 *
 * So there is one implementation and this declares it. The box ignores `.d.ts`; the studio gets types
 * without `allowJs`.
 */

/** `ARCA-12-price-history.md` → 12, for this prefix only. Null when the name carries no id. */
export function idNumber(filename: string, prefix: string): number | null;

/** One past the highest already filed, at the backlog's own width. */
export function nextTicketId(prefix: string, filenames: string[]): string;

/** How wide this venture writes its ticket numbers, read off the backlog (FB-118). */
export function idWidth(prefix: string, filenames: string[]): number;

/** An id at a given width. Pads, never truncates. */
export function formatTicketId(prefix: string, n: number, width: number): string;

/** The width a venture with nothing filed gets. */
export const DEFAULT_ID_WIDTH: number;

/** The other ticket holding this id, when we are the one that must give it up. */
export function mustRenumber(id: string, ourSlug: string, filenames: string[]): string | null;

/** The ticket this branch already carries, if any — so a revision keeps its number. */
export function existingTicketFile(filenames: string[], slug: string): string | null;

/** Where a numbered ticket lives. */
export function ticketPath(id: string, slug: string): string;

/** Put the allocated id into the ticket's own heading, leaving an already-numbered one alone. */
export function withTicketId(body: string, id: string): string;

/** A ticket that never got a real number. */
export function isUnnumbered(id: string | null | undefined): boolean;
