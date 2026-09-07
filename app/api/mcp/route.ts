import { loadVentures } from '@/lib/ventures';
import { loadVentureAttention } from '@/lib/attention';
import { readThread, appendToThread } from '@/app/actions/threads';
import { handleMcp, readMcpTicket, type McpCaller } from '@/lib/mcp';

/**
 * The studio, spoken to as a set of tools (FB-200).
 *
 * A founder talking to Claude — in Claude's own app, or in Claude Code on their venture's machine —
 * reaches the studio here. JSON-RPC over HTTP, one venture per credential.
 *
 * ## Why this is in the studio and not a separate server
 *
 * FB-200: *"Every write goes through the same choke-points the studio's own actions use, so a ticket
 * filed by Claude is indistinguishable downstream from one typed on the desk."* A server that
 * reached GitHub on its own would be a second write path with its own copy of the rules, and a
 * second copy is the one that drifts — which is exactly how FB-140's scanned and unscanned deposit
 * paths came about.
 *
 * So `comment_on_ticket` calls `appendToThread`, the same function the ticket screen calls, and the
 * access check inside it is the same `requireVentureRepo` — handed an `Actor` instead of reading a
 * session.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The ticket, from the header a model's client will actually send. */
function callerFrom(req: Request): McpCaller | null {
  const header = req.headers.get('authorization') ?? '';
  const ticket = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const claim = readMcpTicket(ticket, process.env.FOUNDRY_APPROVAL_SECRET);
  if (!claim) return null;
  // The email on the record of anything written through a tool. Not a person's address, because a
  // tool call is not a person — and a founder reading their own ticket's history should be able to
  // tell which of the two put a note there.
  return { ventureId: claim.ventureId, email: `studio-tools@${claim.ventureId}` };
}

export async function POST(req: Request) {
  const caller = callerFrom(req);
  if (!caller) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'This studio needs a ticket it issued. Ask the studio for one.' } },
      { status: 401 },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'That was not JSON.' } }, { status: 400 });
  }

  const answer = await handleMcp(body as Record<string, unknown>, caller, runTool);
  return Response.json(answer);
}

/**
 * What each tool actually does.
 *
 * Every one of them is scoped by `caller.ventureId` and never by anything in the arguments — a model
 * asking for another venture's queue is asking the wrong studio, and there is no argument it could
 * send that would change which venture this is.
 */
async function runTool(
  name: string,
  args: Record<string, unknown>,
  caller: McpCaller,
): Promise<string> {
  const venture = loadVentures().find((v) => v.id === caller.ventureId);
  if (!venture) throw new Error('that venture is not in this studio');

  if (name === 'whats_waiting') {
    const attention = await loadVentureAttention(venture);
    // Oldest first, because the oldest is the one costing the most — the same order the desk uses.
    const rows = [...attention.approvals].sort((a, b) => b.ageMs - a.ageMs);
    if (!rows.length) return `Nothing is waiting on the founder of ${venture.name}. The team runs on.`;
    const days = (ms: number) => Math.floor(ms / 86_400_000);
    return [
      `${rows.length} thing${rows.length === 1 ? '' : 's'} waiting on the founder of ${venture.name}, oldest first:`,
      ...rows.map((r) => `- ${r.repo}#${r.number} ${r.title} — waiting ${days(r.ageMs)} days`
        + (r.linkedTicketId ? ` (ticket ${r.linkedTicketId})` : '')),
      ...(attention.errors.length
        // Said rather than swallowed: a queue that could not be read fully is not a short queue.
        ? ['', `Some of this could not be read: ${attention.errors.join('; ')}`]
        : []),
      '',
      'The founder decides these on the studio’s own screen. Nothing here can decide them.',
    ].join('\n');
  }

  if (name === 'read_ticket') {
    const repo = String(args.repo ?? '');
    const id = String(args.id ?? '');
    const thread = await readThread(caller.ventureId, repo, id, { email: caller.email, scopedTo: caller.ventureId });
    if (!thread.ok) throw new Error(thread.message);
    const messages = thread.thread?.messages ?? [];
    return [
      `${repo} ${id}`,
      messages.length ? '' : 'No conversation on it yet.',
      ...messages.map((m) => `[${m.role} · ${m.at}] ${m.text}`),
    ].filter(Boolean).join('\n');
  }

  if (name === 'comment_on_ticket') {
    const repo = String(args.repo ?? '');
    const id = String(args.id ?? '');
    const note = String(args.note ?? '');
    // The same function the ticket screen calls, with the same access check inside it.
    const done = await appendToThread(
      caller.ventureId, repo, id, 'composer', note,
      { email: caller.email, scopedTo: caller.ventureId },
    );
    if (!done.ok) throw new Error(done.message);
    return `Added to ${repo} ${id}. It changes nothing on its own — the founder reads it on the ticket.`;
  }

  throw new Error(`no implementation for ${name}`);
}
