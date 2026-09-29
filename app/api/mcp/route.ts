import { loadVentures } from '@/lib/ventures';
import { loadVentureAttention } from '@/lib/attention';
import { loadVentureHealth } from '@/lib/health';
import { ventureApprovals, ventureRuns } from '@/lib/venture-reads';
import { buildFeed } from '@/lib/activity-feed';
import { dedupeActivity, classifyActivity, isFounderVisible } from '@/lib/activity-kind';
import { loadEnvelopes } from '@/lib/budgets-load';
import { loadLedgerRow } from '@/lib/ledger-load';
import { rowReason } from '@/lib/ledger';
import { readThread, appendToThread } from '@/app/actions/threads';
import { filePlan } from '@/app/actions/file-plan';
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

/** Minor units to something a founder reads. No currency symbol guessing — the code is printed. */
const money = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`;

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

  if (name === 'what_happened') {
    // Assembled from the same three sources the activity screen uses, through the same pure
    // `buildFeed`. Not a second summary: FB-180 found that composing a summary from a different list
    // than the rows produced counts the rows did not show, and a tool answering differently from the
    // screen is the same fault with a longer fuse.
    const days = Number.isFinite(Number(args.days)) ? Math.max(1, Math.min(90, Number(args.days))) : 7;
    const [health, runs, approvals] = await Promise.all([
      loadVentureHealth(venture),
      ventureRuns(venture),
      ventureApprovals(venture),
    ]);
    const activity = dedupeActivity(health.activity).filter((e) => isFounderVisible(classifyActivity(e)));
    const surfaces = Object.fromEntries((venture.departments ?? []).map((d) => [d.repo, d.name]));
    const { items } = buildFeed({
      activity, runs: runs.reports, approvals, limit: 40, surfaces, ventureName: venture.name,
    });
    const since = Date.now() - days * 86_400_000;
    const recent = items.filter((i) => Date.parse(i.at) >= since);
    const failures = health.repos.filter((r) => r.error).map((r) => r.error as string);
    if (!recent.length) {
      return [
        `Nothing recorded for ${venture.name} in the last ${days} days.`,
        // An empty answer and an unreadable one are different facts, and saying "nothing happened"
        // when the truth is "this could not be read" is the failure CLAUDE.md #10 forbids.
        ...(failures.length ? ['', `Some of it could not be read: ${failures.join('; ')}`] : []),
      ].join('\n');
    }
    return [
      `What happened on ${venture.name} in the last ${days} days, newest first:`,
      ...recent.map((i) => `- [${i.at}] ${i.text}${i.meta ? ` (${i.meta})` : ''}`),
      ...(failures.length ? ['', `Some of it could not be read: ${failures.join('; ')}`] : []),
    ].join('\n');
  }

  if (name === 'budgets') {
    const envelopes = loadEnvelopes(venture.id);
    const row = await loadLedgerRow(venture, Date.now());
    const lines: string[] = [`What ${venture.name} may spend:`];
    if (!envelopes.envelopes.length) {
      lines.push('- No limits are set for this venture yet, so nothing here is bounded by one.');
    } else {
      for (const e of envelopes.envelopes) {
        lines.push(`- ${e.department}: ${money(e.limitMinor, e.currency)} per ${e.period}`);
      }
    }
    // The same sentence the desk shows, from the same function, so a founder is never told two
    // different things about their own money by two surfaces.
    lines.push('', row.spend
      ? `Spent so far: ${money(row.spend.spentMinor, row.spend.currency)} of `
        + `${money(row.spend.limitMinor, row.spend.currency)}`
        + `${row.spend.over ? ' — this has passed the limit.' : '.'}`
      : 'Spending could not be read, which is not the same as nothing having been spent.');
    lines.push(rowReason(row));
    if (envelopes.error) lines.push('', `The limits file could not be fully read: ${envelopes.error}`);
    return lines.join('\n');
  }

  if (name === 'venture_memory') {
    const question = String(args.question ?? '').trim();
    if (!question) throw new Error('ask a question');
    // What the venture has written down, by name, so the model can then read the ones that look
    // relevant with `read_ticket` or ask the founder. A real search over the corpus is FB-169's work
    // and is deliberately not faked here: returning a confident answer from a filename match would be
    // worse than returning the list.
    const attention = await loadVentureAttention(venture);
    const named = attention.approvals
      .filter((a) => a.linkedTicketId)
      .map((a) => `- ${a.repo} ${a.linkedTicketId}: ${a.title}`);
    if (!named.length) {
      return [
        `${venture.name} has nothing this tool can reach that bears on "${question}".`,
        'That means this tool found nothing, not that the venture knows nothing. Its documents are '
        + 'reachable to the team but not yet to this tool — FB-169 is that work.',
      ].join('\n');
    }
    return [
      `Work on ${venture.name} that may bear on "${question}":`,
      ...named.slice(0, 60),
      '',
      'This lists what exists; it does not answer the question. Read the ones that look right with '
      + 'read_ticket, and ask the founder rather than guessing.',
    ].join('\n');
  }

  if (name === 'file_ticket') {
    const repo = String(args.repo ?? '');
    const title = String(args.title ?? '').trim();
    const body = String(args.body ?? '').trim();
    if (!title || !body) throw new Error('a ticket needs a title and a body');
    // The same function the composer's confirm button calls, handed an actor instead of a session.
    // `confirmedCount` is 1 because this files exactly one ticket and the count exists to assert that
    // the label and the payload agree — see filePlan's own note on what it is and is not.
    const done = await filePlan(
      caller.ventureId, repo,
      { tickets: [{ title, body }] } as never,
      1,
      { email: caller.email, scopedTo: caller.ventureId },
    );
    if (!done.ok) throw new Error(done.message);
    return [
      `Filed into ${repo}: ${title}`,
      'It starts no work by itself. The team picks it up, and every change it leads to still comes '
      + 'back to the founder for a decision.',
    ].join('\n');
  }

  throw new Error(`no implementation for ${name}`);
}
