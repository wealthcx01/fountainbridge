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

/** The digits a filename carries for this prefix, as written — `ARCA-007-x.md` → `"007"`. */
function idDigits(filename, prefix) {
  const m = filename.match(new RegExp(`^${escapeRe(prefix)}-(\\d+)(?:[-.]|$)`, 'i'));
  return m ? m[1] : null;
}

/** `ARCA-12-price-history.md` / `ARCA-12.md` → 12, for this prefix only. */
export function idNumber(filename, prefix) {
  const digits = idDigits(filename, prefix);
  return digits === null ? null : Number(digits);
}

/**
 * The width a venture gets when it has no ticket of its own to copy.
 *
 * Three, because that is what every venture repo in the portfolio already writes by hand — the first
 * ticket the composer files should look like the ones a person would have written after it, not
 * establish a second convention that the next hundred have to match.
 */
export const DEFAULT_ID_WIDTH = 3;

/**
 * How wide this venture writes its ticket numbers (FB-118).
 *
 * Every ticket ARCA has is three digits; every ticket the composer filed was two. So the backlog read
 * in two formats, and which one a ticket had depended on nothing a founder could see — whether a
 * person or the machine created it. That is a visible seam in the one artifact meant to make those
 * two indistinguishable, and `ls docs/tickets/` sorts the narrow ones wrong.
 *
 * The width is read from the backlog rather than fixed, because it is the venture's convention and
 * not ours. **The most common width wins**, ties going to the wider — deterministic, so a mixed
 * backlog does not depend on which file happens to sort first, and biased towards padding because
 * padding is the direction that keeps sorting intact.
 *
 * The considered alternative was "match the highest-numbered ticket", which reads the newest
 * convention rather than the commonest. It is better for a venture MIGRATING to padding and worse
 * for the case in front of us: ARCA's highest tickets are the two-digit ones the composer filed, so
 * that rule would have kept writing the narrow ids this exists to stop. A backlog that has genuinely
 * changed convention outvotes its own history soon enough; one stray narrow file at the top never
 * does. Live correctness beat the hypothetical.
 */
export function idWidth(prefix, filenames) {
  const counts = new Map();
  for (const name of filenames) {
    const digits = idDigits(name, prefix);
    if (digits === null) continue;
    counts.set(digits.length, (counts.get(digits.length) ?? 0) + 1);
  }
  if (counts.size === 0) return DEFAULT_ID_WIDTH;
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/** An id, rendered at the backlog's width. Never truncates: `ARCA-099` + 1 is `ARCA-100`. */
export function formatTicketId(prefix, n, width) {
  return `${prefix}-${String(n).padStart(width, '0')}`;
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
  return formatTicketId(prefix, highest + 1, idWidth(prefix, filenames));
}

/**
 * The ticket this branch already carries, if any.
 *
 * Re-filing the same slug UPDATES the ticket rather than filing a second one — the composer tells
 * founders to revise and re-file, so this is a common path, not an edge case. Without it, allocation
 * would hand out a fresh number on every revision and leave a trail of half-written duplicates.
 */
/**
 * Whether WE are the one who has to give this number up (FB-117).
 *
 * Checked *after* the write, because a lost race leaves nothing to catch: every filing commits to its
 * own branch, so two tickets can be handed the same number and both writes succeed. A duplicate id is
 * a successful write of the wrong name, and the only way to find one is to go and look.
 *
 * **Only the loser moves.** "Is anyone else on my number, and if so I'll take the next one" is
 * symmetric: two filings that collide would both see a clash, both step to the same next number, and
 * collide again — a fix that reproduces the bug one number along. So the tie is broken the same way
 * by everyone without anyone having to coordinate: lowest filename keeps the id, everybody else
 * renumbers. Deterministic, and it needs no lock, no clock and no shared state.
 *
 * Returns the winner's filename when we must renumber, null when the id is ours to keep.
 */
export function mustRenumber(id, ourSlug, filenames) {
  const mine = `${id}-${ourSlug}.md`.toLowerCase();
  // By NUMBER, not by the id as written (FB-118). Once ids can be padded, `ARCA-74` and `ARCA-074`
  // are the same ticket number in two spellings, and a string-prefix comparison sees two different
  // ones — so both filings would keep number 74 and neither would ever know. That is the duplicate
  // this function exists to catch, wearing a different width.
  //
  // Only for an id that is a prefix and digits, though (FB-147). `ARCA-68a` and `ARCA-NEW` are ids
  // this codebase still recognises elsewhere, and neither parses as a number — so the first version
  // of this returned "no clash" for them, which is not a smaller answer than the old one, it is the
  // wrong one. They keep the comparison they had.
  const plain = id.match(/^(.+)-(\d+)$/);
  const sharing = filenames
    .filter((n) => (plain
      ? idNumber(n, plain[1]) === Number(plain[2])
      : n.toLowerCase().startsWith(`${id.toLowerCase()}-`)))
    .map((n) => n.toLowerCase());
  // Our own file is in the union by construction — we just wrote it — but not if that listing came
  // back short. Assume ourselves present rather than read a partial list as "no clash".
  if (!sharing.includes(mine)) sharing.push(mine);
  if (sharing.length < 2) return null;

  const winner = sharing.slice().sort()[0];
  return winner === mine ? null : winner;
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
