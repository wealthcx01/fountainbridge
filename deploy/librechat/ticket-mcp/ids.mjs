/**
 * Giving a filed ticket a real number (FB-097).
 *
 * The composer filed everything as `<PREFIX>-NEW`. It was meant to be a placeholder for a moment and
 * became the permanent name of everything a founder creates: the walkthrough counted FOUR distinct
 * pieces of work all called **ARCA-NEW**, in the board, the queue, the feed and git history alike.
 *
 * What that costs, quietly:
 *
 *   - Nothing can be referred to. "Approve ARCA-NEW" is ambiguous four ways, and a founder on the
 *     phone cannot name the thing they mean. A shared short name is the entire point of an id.
 *   - Dependencies cannot be declared: `Depends on: ARCA-NEW` means nothing.
 *   - The board sorts and groups by id, so the -NEW cluster collects at the bottom in an order
 *     nobody chose, and two of them collide the moment either is renamed.
 *
 * Pure on purpose, and in its own file: `stdio.mjs` starts an MCP server the moment it is imported,
 * so nothing in it can be tested. The allocation is the part with the edge cases.
 */

/** `ARCA-12-price-history.md` / `ARCA-12.md` → 12, for this prefix only. */
export function idNumber(filename, prefix) {
  const m = filename.match(new RegExp(`^${prefix}-(\\d+)(?:[-.]|$)`, 'i'));
  return m ? Number(m[1]) : null;
}

/**
 * The next id for this venture: one past the highest already filed.
 *
 * Highest rather than count, because tickets get deleted and renamed and a count would hand out an
 * id that already exists. `-NEW` files are ignored — they are the thing being replaced, and reading
 * one as a number would be reading the bug as data.
 */
export function nextTicketId(prefix, filenames) {
  const highest = filenames.reduce((max, name) => {
    const n = idNumber(name, prefix);
    return n !== null && n > max ? n : max;
  }, 0);
  return `${prefix}-${highest + 1}`;
}

/**
 * The ticket this branch already carries, if any.
 *
 * Re-filing the same slug UPDATES the ticket rather than filing a second one — the composer tells
 * founders to revise and re-file, so this is a common path, not an edge case. Without it, allocation
 * would hand out a fresh number on every revision and leave a trail of half-written duplicates.
 */
/**
 * Which other ticket already carries this id, if any (FB-117).
 *
 * Checked *after* the write, because a lost race leaves nothing to catch: every filing commits to its
 * own branch, so two tickets can be handed the same number and both writes succeed. A duplicate id is
 * a successful write of the wrong name, and the only way to find one is to go and look.
 *
 * Our own file is not a clash with itself — the same id and the same slug is the ticket we just wrote.
 */
export function idTakenElsewhere(id, ourSlug, filenames) {
  const mine = `${id}-${ourSlug}.md`.toLowerCase();
  const prefix = `${id.toLowerCase()}-`;
  return (
    filenames.find((n) => {
      const lower = n.toLowerCase();
      return lower.startsWith(prefix) && lower !== mine;
    }) ?? null
  );
}

export function existingTicketFile(filenames, slug) {
  return (
    filenames.find((n) => new RegExp(`^[A-Za-z]+-\\d+-${escapeRe(slug)}\\.md$`, 'i').test(n)) ??
    filenames.find((n) => n.toLowerCase() === `${slug}.md`) ??
    null
  );
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where a numbered ticket lives. Matches what the venture repos already do by hand. */
export const ticketPath = (id, slug) => `docs/tickets/${id}-${slug}.md`;

/**
 * Put the allocated id into the ticket's own heading.
 *
 * The model writes the title; the id is the filer's job, because only the filer can see the backlog.
 * Three shapes arrive here: the old `# ARCA-NEW — Title` placeholder, a bare `# Title`, and a
 * heading that already carries a real id (a revision) — which is left exactly as it is.
 */
export function withTicketId(body, id) {
  const firstHeading = body.match(/^#\s+(.+)$/m);
  if (!firstHeading) return `# ${id} — Untitled\n\n${body}`;

  const heading = firstHeading[1].trim();
  const placeholder = heading.match(/^[A-Za-z]+-NEW\s*[—–-]\s*(.+)$/);
  if (placeholder) return body.replace(firstHeading[0], `# ${id} — ${placeholder[1].trim()}`);

  // Already numbered — a revision of a ticket that has an id. Leave it alone; renumbering a ticket
  // a founder has already been told the name of is worse than any tidiness it would buy.
  if (/^[A-Za-z]+-\d+[a-z]?\s*[—–-]/.test(heading)) return body;

  return body.replace(firstHeading[0], `# ${id} — ${heading}`);
}

/** A ticket that never got a real number. The studio flags these rather than treating them as names. */
export const isUnnumbered = (id) => /-NEW$/i.test(id ?? '');
