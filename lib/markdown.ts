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

/**
 * Drop the ticket's own `# ARCA-44 — Title` line.
 *
 * Every surface that renders a ticket body also shows its title above it, so the body rendered the
 * same name a second time — as a page-level heading competing with the page's own. Two `<h1>`s is
 * also two answers to "what is this about".
 *
 * Lives here rather than beside the loader (where FB-107 first wrote it) because the ticket drawer
 * needs it too, and the drawer is a client component that must not pull in a module that reaches
 * for the network.
 */
export function withoutTitleHeading(bodyMd: string): string {
  return bodyMd.replace(/^\s*#\s+[^\n]*\n+/, '');
}

/**
 * Split a ticket body into its opening and the rest (FB-185).
 *
 * ## Why a ticket is not shown whole
 *
 * The Tickets screen renders the ticket beside the list, and a ticket file is written for whoever
 * has to build the thing: `Why this matters`, `Context`, `Scope`, `Out of scope`, `Acceptance
 * criteria`, usually with links and quoted research. ARCA-068 is 1,730px of that on its own, which
 * is most of why the screen measured 6,864px against a design of 1,090px.
 *
 * The design's ticket detail is the point of the ticket and then the decision. It shows no scope
 * list and no research bullets. So this returns the ticket's **first section** as `summary` and
 * everything from the second heading on as `rest`, and the screen puts `rest` one press away rather
 * than dropping it — a founder deciding on work is entitled to every word of it, just not all at
 * once and not stacked above the decision.
 *
 * Cutting on the heading rather than on a paragraph count is what makes this predictable: ticket
 * files here write a heading and its prose with no blank line between them, so "two paragraphs"
 * lands in a different place in every ticket, while "the first section" is the same place in all of
 * them. A ticket with no headings falls back to its first two paragraphs.
 */
export function splitTicketBody(
  bodyMd: string,
  { sections = 1 }: { sections?: number } = {},
): { summary: string; rest: string } {
  const text = bodyMd.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  // Never cut inside a fenced code block: a fence contains blank lines and a `#` comment inside one
  // is not a heading. Cutting there would render the rest of the ticket as code.
  const open: boolean[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const mark = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (mark) {
      if (fence === null) fence = mark[1][0];
      else if (line.trimStart().startsWith(fence)) fence = null;
      open.push(true);
      continue;
    }
    open.push(fence !== null);
  }

  let seen = 0;
  let cut = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (open[i]) continue;
    if (!/^\s{0,3}#{1,6}\s/.test(lines[i])) continue;
    seen += 1;
    if (seen > sections) { cut = i; break; }
  }

  if (cut < 0) return splitOnParagraphs(text, 2);
  const summary = lines.slice(0, cut).join('\n').trim();
  const rest = lines.slice(cut).join('\n').trim();
  // A heading with nothing under it is not an opening worth showing on its own.
  if (!summary) return { summary: text.trim(), rest: '' };
  return { summary, rest };
}

/** The fallback for a ticket written without headings: its first `count` paragraphs. */
function splitOnParagraphs(text: string, count: number): { summary: string; rest: string } {
  const lines = text.split('\n');
  let prose = 0;
  let cut = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue;
    const isProse = !/^\s{0,3}([-*+]\s|\d+[.)]\s|>|\||`{3,}|~{3,})/.test(lines[i]);
    let j = i;
    while (j + 1 < lines.length && lines[j + 1].trim() !== '') j += 1;
    if (isProse) {
      prose += 1;
      if (prose >= count) { cut = j + 1; break; }
    }
    i = j;
  }
  if (cut < 0 || cut >= lines.length) return { summary: text.trim(), rest: '' };
  return { summary: lines.slice(0, cut).join('\n').trim(), rest: lines.slice(cut).join('\n').trim() };
}
