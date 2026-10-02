import { createHash } from 'node:crypto';
import { isSafePlanSlug, type PlanDraft } from './plan-draft';

/**
 * One ticket, asked for through the studio's tools, as a plan the filer will accept (FB-257).
 *
 * ## Why this exists
 *
 * Claude's `file_ticket` tool hands the studio a repository, a title and a body. The studio has one
 * function that files work — `filePlan` — and it only takes a complete plan: which venture, which
 * repository, where the work came from, a short name for each ticket, and a date. The tool used to
 * send a title and a body alone, so every ticket Claude tried to file was refused with "That plan
 * could not be read", and nothing was ever written.
 *
 * This builds the complete plan. It is pure — it writes nothing — so the filer stays the only writer.
 *
 * ## The tool is a public endpoint
 *
 * Everything here arrives from a model, which arrives from whatever a person typed. So it is checked
 * rather than trusted: the title is one plain line of a sensible length, and the body has a size
 * limit. The venture comes from the signed credential, never from the arguments, and the repository
 * is checked against the venture's own list by the filer.
 */

/** Where a ticket filed this way came from, in the words the founder will read on the ticket. */
export const TOOL_TICKET_SOURCE = 'a conversation with Claude';

/** Long enough for any honest one-line title; short enough to read in a list. */
export const TITLE_MAX = 160;

/** A ticket is a page, not a book. A body this big is a mistake, or something worse. */
export const BODY_MAX = 40_000;

/** The longest slug the filer's pattern allows. */
const SLUG_MAX = 60;

/**
 * A short name for the ticket, made from its title: `Show every live auction` → `show-every-live-auction`.
 *
 * It becomes part of a file name and a branch name, so only lower-case letters, digits and hyphens
 * survive. A title with none of those in it (one written entirely in another script, say) still gets
 * a name: `ticket-` and a fingerprint of the title. The fingerprint, rather than a random one, means
 * asking twice for the same ticket updates it instead of filing it twice.
 */
export function slugFromTitle(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')       // é → e, so "Café menu" keeps its word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let slug = words.slice(0, SLUG_MAX).replace(/-+$/g, '');
  if (!isSafePlanSlug(slug)) {
    slug = `ticket-${createHash('sha256').update(title).digest('hex').slice(0, 8)}`;
  }
  return slug;
}

/** The moment the plan was made, as a full date and time, which is how the plan records it. */
const today = (now: number) => new Date(now).toISOString();

export type ToolTicketPlan = { ok: true; plan: PlanDraft } | { ok: false; message: string };

/**
 * The one-ticket plan for this venture and repository, or the plain reason there is not one.
 *
 * The reasons are written for Claude to repeat to a founder, so each says what to change.
 */
export function oneTicketPlan(input: {
  ventureId: string;
  repo: unknown;
  title: unknown;
  body: unknown;
  now: number;
}): ToolTicketPlan {
  const { ventureId, now } = input;
  if (typeof input.repo !== 'string' || !input.repo.trim()) {
    return { ok: false, message: 'say which repository the ticket belongs in' };
  }
  if (typeof input.title !== 'string' || typeof input.body !== 'string') {
    return { ok: false, message: 'a ticket needs a title and a body, both as plain text' };
  }
  const repo = input.repo.trim();
  const title = input.title.trim();
  let body = input.body.trim();
  if (!title || !body) return { ok: false, message: 'a ticket needs a title and a body' };

  // The title goes into a commit message, a pull request and the board. A line break or a control
  // character in it would let one field write lines that look like others, so it is refused rather
  // than quietly cleaned: Claude can send a better one, and a silently rewritten title is not the
  // title anyone asked for.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(title)) return { ok: false, message: 'the title must be one line of plain text' };
  if (title.length > TITLE_MAX) return { ok: false, message: `keep the title to ${TITLE_MAX} characters or fewer` };
  if (body.length > BODY_MAX) return { ok: false, message: `keep the ticket to ${BODY_MAX.toLocaleString('en-GB')} characters or fewer` };

  // A body that does not open with a heading would be filed as "Untitled", or titled by whatever
  // heading sits lower down. The title is the heading the founder will expect, so it goes on top,
  // with the status every new ticket starts at. Only the first line counts: a heading further down
  // is a section of the ticket, not its title.
  if (!/^#\s+\S/.test(body)) body = `# ${title}\n\n**Status:** Todo\n\n${body}`;

  return {
    ok: true,
    plan: {
      venture_id: ventureId,
      repo,
      source_title: TOOL_TICKET_SOURCE,
      created_at: today(now),
      tickets: [{ slug: slugFromTitle(title), title, body, depends_on: [], source: TOOL_TICKET_SOURCE }],
    },
  };
}
