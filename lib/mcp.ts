import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The studio, as a set of tools (FB-200).
 *
 * A founder talking to Claude — in Claude's own app, on a phone, or in Claude Code on their
 * venture's machine — can ask the studio things and file work into it without visiting a website.
 *
 * ## The one rule, and it shapes every entry below
 *
 * **It reads, it files, and it proposes. It never grants.**
 *
 * Non-negotiable 4 says nothing external executes without a recorded human approval, and FB-183
 * spent a whole ticket establishing that there is exactly ONE surface where a grant is signed. A
 * tool that could sign would create a second one — invisibly, on a device, with no screen showing
 * what was agreed to. `approval.proposed` comes from Claude; `approval.granted` comes from a founder
 * who looked at it on the desk.
 *
 * That rule is not a convention here. It is a `kind` on every tool, an explicit list of the verbs no
 * tool may carry, and a test that enumerates the whole surface — so adding a tool that grants means
 * deliberately editing an assertion that says, in words, that you must not.
 */

/** What a tool is allowed to be. There is no fourth kind, and that is the point. */
export type ToolKind = 'read' | 'write' | 'propose';

export interface StudioTool {
  name: string;
  kind: ToolKind;
  /**
   * What the model is told. This is where FB-079's guidance lives now.
   *
   * The composer carries the studio's own advice about what makes a good ticket, and FB-200 warned
   * that moving the door to Claude would quietly lose it — "the quality of filed tickets drops
   * without anyone noticing". A tool description is the only place that advice can travel, so the
   * writing tools carry it and it is asserted, not hoped for.
   */
  description: string;
  input: Record<string, unknown>;
}

/**
 * Verbs no tool may carry, in its name or anywhere in what it tells the model it can do.
 *
 * A list rather than a judgement, because "does this tool grant?" is exactly the question that gets
 * answered optimistically at 23:00 by someone who is nearly finished.
 */
export const VERBS_NO_TOOL_MAY_CARRY = [
  'grant', 'approve', 'sign', 'send', 'spend', 'pay', 'merge', 'deploy', 'publish', 'delete',
] as const;

const str = (description: string) => ({ type: 'string', description });

export const STUDIO_TOOLS: readonly StudioTool[] = [
  {
    name: 'whats_waiting',
    kind: 'read',
    description:
      'What is waiting on the founder in this venture: decisions to make, finished work to read, and '
      + 'anything stuck. This is the same queue the desk shows, in the same order — oldest first.',
    input: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_ticket',
    kind: 'read',
    description:
      'One ticket and its trail: what was asked for, what has happened to it, and where it stands. '
      + 'Addressed by repository and id, because two repositories in one venture may share an id.',
    input: {
      type: 'object',
      properties: { repo: str('the repository, e.g. arca-marketing'), id: str('the ticket id, e.g. ARCA-61') },
      required: ['repo', 'id'],
      additionalProperties: false,
    },
  },
  {
    name: 'what_happened',
    kind: 'read',
    description:
      'What the venture’s team has actually done recently, newest first — one line per thing that '
      + 'happened, not repository housekeeping.',
    input: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'how many, default 10' } },
      additionalProperties: false,
    },
  },
  {
    name: 'budgets',
    kind: 'read',
    description: 'What this venture is allowed to spend this month, per surface, and what it has spent.',
    input: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'venture_memory',
    kind: 'read',
    description:
      'What the venture knows: the documents it has been handed and what its team has learned. '
      + 'Returns what each document is and when it was last used, never the document’s contents.',
    input: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'file_ticket',
    kind: 'write',
    // FB-079's guidance, carried where it can still reach the writing.
    description:
      'File a ticket for this venture’s team to work on. Write it the way the studio writes them: a '
      + 'title that names the outcome rather than the task, and a body that says what a founder '
      + 'wants and why, not how to build it. One ticket is one piece of work — if it needs the word '
      + '"and", it is two. It is filed as a proposal on a branch and nothing is built until the '
      + 'founder accepts it.',
    input: {
      type: 'object',
      properties: {
        surface: { type: 'string', enum: ['build', 'sell', 'scale'], description: 'which side of the venture' },
        title: str('what the outcome is'),
        body: str('what the founder wants and why'),
      },
      required: ['surface', 'title', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'comment_on_ticket',
    kind: 'write',
    description: 'Add a note to a ticket. Notes are for the founder and the team to read; they change nothing.',
    input: {
      type: 'object',
      properties: { repo: str('the repository'), id: str('the ticket id'), note: str('the note') },
      required: ['repo', 'id', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_approval',
    kind: 'propose',
    description:
      'Put something in front of the founder to decide — an email to send, money to spend, anything '
      + 'that would reach outside the company. This RAISES the question and does not answer it: the '
      + 'founder decides on the studio’s own screen, and nothing happens until they do.',
    input: {
      type: 'object',
      properties: {
        repo: str('the repository the action belongs to'),
        what: str('what would happen, in one sentence a founder can decide on'),
        why: str('why it is worth doing'),
      },
      required: ['repo', 'what', 'why'],
      additionalProperties: false,
    },
  },
] as const;

/** The tool by that name, or null. Never throws: an unknown name is a refusal, not a crash. */
export function toolFor(name: unknown): StudioTool | null {
  if (typeof name !== 'string') return null;
  return STUDIO_TOOLS.find((t) => t.name === name) ?? null;
}

/**
 * A ticket that says which venture a caller may use these tools on.
 *
 * The same shape as the office's (FB-198) and deliberately NOT the same ticket: the payload is
 * prefixed, so a credential minted for one purpose cannot be presented for the other. One secret,
 * two capabilities, and a leaked office ticket does not become the ability to file tickets.
 *
 * Which venture a caller may reach is decided HERE, by the studio, for someone who has already
 * passed `canAccessVenture` — never by anything the caller sends (non-negotiable 6).
 */
export const MCP_TICKET_TTL_MS = 12 * 60 * 60_000;
const TICKET = /^([a-z0-9][a-z0-9-]{0,62})\.(\d{1,15})\.([A-Za-z0-9_-]{1,200})$/;

const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(`mcp:${body}`).digest('base64url');

export function mintMcpTicket(ventureId: string, secret: string, now = Date.now()): string {
  const body = `${ventureId}.${now + MCP_TICKET_TTL_MS}`;
  return `${body}.${sign(body, secret)}`;
}

/** The venture a ticket is good for, or null. Never throws — a malformed ticket is simply not one. */
export function readMcpTicket(
  ticket: string | null | undefined,
  secret: string | undefined,
  now = Date.now(),
): { ventureId: string } | null {
  if (typeof ticket !== 'string' || !secret) return null;
  const m = TICKET.exec(ticket);
  if (!m) return null;
  const [, ventureId, expRaw, mac] = m;
  if (Number(expRaw) < now) return null;
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(sign(`${ventureId}.${expRaw}`, secret), 'utf8');
  // Length first: `timingSafeEqual` throws on a mismatch, and a throw would answer whether a guess
  // was the right length.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { ventureId };
}
