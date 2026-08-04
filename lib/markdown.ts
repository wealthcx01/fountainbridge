/**
 * Making repo-written markdown safe to READ (FB-105).
 *
 * The studio renders ticket bodies with react-markdown and deliberately WITHOUT `rehype-raw`: these
 * files come from a repo, and a renderer that executed their HTML would be one copied ticket away
 * from running someone else's markup in a founder's session.
 *
 * The cost of that, unnoticed until the browser audit: anything shaped like a tag is parsed as HTML
 * and then dropped on the floor. A ticket that reads
 *
 *     read the slug from the repo (<slug>, <path>) and from here
 *
 * reached the founder as *"read the slug from the repo (, ) and from here"* — a sentence with holes
 * in it, on the surface whose whole job is to say what was asked for. That is what made GitHub feel
 * like it had "more detail": it did, because the studio was silently deleting some.
 *
 * So the angle brackets are escaped into text before parsing. Nothing is rendered as HTML, and
 * nothing disappears.
 */

/**
 * Escape `<` so a placeholder survives to the screen, leaving genuine autolinks alone.
 *
 * `<https://example.com>` and `<mailto:…>` are real markdown and still work; `<slug>`, `<repo>` and
 * `<owner/repo>` become the literal text they were always meant to be.
 */
export function showAngleBrackets(md: string): string {
  return md.replace(/<(?!https?:\/\/|mailto:)/g, '&lt;');
}

/**
 * Drop the ticket's own `**Status:** …` claim from its body (FB-105).
 *
 * A ticket file states its status in a metadata line, and the studio shows the status as a chip
 * above the body — computed, not copied: an open piece of work moves a ticket to "Needs your OK"
 * whatever its markdown still says. So the drawer showed "Needs your OK" and, two lines below it,
 * `Status: Todo`. Two answers to one question, in one view, and the wrong one written larger.
 *
 * Only the status segment goes. The rest of that line — the phase, who asked for it, their own words
 * — is information the chips do not carry, and dropping the whole line to fix one fragment of it
 * would be the summary-that-loses-the-point mistake again.
 */
export function withoutStatusClaim(md: string): string {
  return md.replace(/\*\*Status:\*\*\s*[^·\n]*?(\s*·\s*|(?=\n)|$)/, '');
}
