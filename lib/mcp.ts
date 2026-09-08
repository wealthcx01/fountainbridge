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

/**
 * The tools, and only the ones that work.
 *
 * FB-200's design named eight. Five are not wired yet, and they are **not listed here**, because a
 * tool a model can see and cannot use is a dead control — the same fault FB-192 removed from the
 * office when it hid Layout and Settings. A model offered a tool that fails will try it, tell the
 * founder it did something, and be wrong.
 *
 * What is missing is on the ticket, with why.
 */
export const STUDIO_TOOLS: readonly StudioTool[] = [
  {
    name: 'whats_waiting',
    kind: 'read',
    description:
      'What is waiting on the founder of this venture: decisions to make and finished work to read. '
      + 'The same queue the studio shows on the desk, oldest first, because the oldest is the one '
      + 'costing the most.',
    input: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_ticket',
    kind: 'read',
    description:
      'One ticket: what was asked for, what state it is in, and the conversation on it. Addressed by '
      + 'repository AND id, because two repositories in one venture may use the same id.',
    input: {
      type: 'object',
      properties: {
        repo: str('the repository, e.g. arca-marketing'),
        id: str('the ticket id, e.g. ARCA-61'),
      },
      required: ['repo', 'id'],
      additionalProperties: false,
    },
  },
  {
    name: 'comment_on_ticket',
    kind: 'write',
    description:
      'Add a note to a ticket, for the founder and the team to read. It changes nothing on its own '
      + 'and starts no work — say what you observed or what you would suggest, not what you have '
      + 'done.',
    input: {
      type: 'object',
      properties: {
        repo: str('the repository'),
        id: str('the ticket id'),
        note: str('what to add, in plain English'),
      },
      required: ['repo', 'id', 'note'],
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

/** What a caller is, once its ticket has been read. */
export interface McpCaller { ventureId: string; email: string }

/** A JSON-RPC request, as far as this server cares. */
export interface McpRequest { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }

export const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * The server's answer to one request.
 *
 * A pure function of the request and a set of tool implementations, so the protocol can be tested
 * without a socket and the implementations can be tested without the protocol. Errors are JSON-RPC
 * errors rather than thrown, because a transport that throws mid-stream tells a model nothing it can
 * act on.
 */
export type ToolRunner = (
  name: string,
  args: Record<string, unknown>,
  caller: McpCaller,
) => Promise<string>;

const fail = (id: unknown, code: number, message: string) =>
  ({ jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } });
const ok = (id: unknown, result: unknown) => ({ jsonrpc: '2.0' as const, id: id ?? null, result });

export async function handleMcp(
  req: McpRequest,
  caller: McpCaller,
  run: ToolRunner,
): Promise<Record<string, unknown>> {
  const { id, method, params } = req;

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'foundry-studio', version: '1' },
      // Said to the model, once, at the start. Everything else here enforces it; this explains it,
      // so a model does not spend a turn looking for the tool that signs things off.
      instructions:
        `You are connected to the Foundry Studio for the venture "${caller.ventureId}", and to that `
        + 'venture only. You can read what is waiting and comment on tickets. You cannot approve, '
        + 'send, spend, merge or deploy anything — the founder decides those on the studio’s own '
        + 'screen, and no tool here will do them however they are asked.',
    });
  }

  if (method === 'notifications/initialized') return ok(id, {});

  if (method === 'tools/list') {
    return ok(id, {
      tools: STUDIO_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input,
      })),
    });
  }

  if (method === 'tools/call') {
    const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
    const tool = toolFor(p.name);
    if (!tool) {
      // Named, so a model can correct itself rather than guessing at a synonym — and it is a refusal
      // rather than a crash, because an unknown name is an ordinary thing for a model to try.
      return fail(id, -32602, `There is no tool called "${String(p.name)}". This studio offers: `
        + `${STUDIO_TOOLS.map((t) => t.name).join(', ')}.`);
    }
    const args = (p.arguments ?? {}) as Record<string, unknown>;
    try {
      const text = await run(tool.name, args, caller);
      return ok(id, { content: [{ type: 'text', text }] });
    } catch (e) {
      // Loud, and naming the venture. A tool that fails quietly inside a chat is worse than one that
      // fails on a screen, because nobody is looking at it (CLAUDE.md #10).
      console.error('[mcp] a tool failed', { venture: caller.ventureId, tool: tool.name, message: (e as Error)?.message });
      return ok(id, {
        content: [{ type: 'text', text: `That did not work: ${(e as Error)?.message ?? 'unknown fault'}. Nothing changed.` }],
        isError: true,
      });
    }
  }

  return fail(id, -32601, `This studio does not answer "${String(method)}".`);
}
