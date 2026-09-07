import { describe, it, expect } from 'vitest';
import {
  STUDIO_TOOLS, VERBS_NO_TOOL_MAY_CARRY, toolFor,
  mintMcpTicket, readMcpTicket, MCP_TICKET_TTL_MS,
  handleMcp, MCP_PROTOCOL_VERSION, type McpCaller,
} from '../mcp';

/**
 * FB-200 — the studio as a set of tools.
 *
 * The rule these are written to defend is that nothing here grants. A test that only checked the
 * happy path would pass on the day somebody adds a tool that signs an approval, which is the one day
 * it would matter.
 */
describe('nothing here grants', () => {
  it('every tool is a read, a write, or a proposal — there is no fourth kind', () => {
    for (const t of STUDIO_TOOLS) {
      expect(['read', 'write', 'propose'], t.name).toContain(t.kind);
    }
  });

  it('no tool carries a verb that would act outside the company', () => {
    // Checked against the NAME and against what the tool tells the model it can do, because a
    // description is the part a model actually reads.
    for (const t of STUDIO_TOOLS) {
      for (const verb of VERBS_NO_TOOL_MAY_CARRY) {
        expect(t.name.includes(verb), `${t.name} is named for "${verb}"`).toBe(false);
      }
    }
    // And nothing offered says it can act, either — a description is the part a model reads.
    for (const t of STUDIO_TOOLS) {
      expect(t.description, t.name).not.toMatch(/\b(approve|grant|send it|spend|merge|deploy)\b/i);
    }
  });

  it('is exactly this surface, so adding to it is a deliberate act', () => {
    // If this list changes, someone changed what a founder's Claude can do. That should require
    // editing an assertion, not merely appending to an array.
    expect(STUDIO_TOOLS.map((t) => `${t.kind}:${t.name}`)).toEqual([
      'read:whats_waiting',
      'read:read_ticket',
      'write:comment_on_ticket',
    ]);
  });

  it('refuses a tool it does not have, rather than guessing at one it does', () => {
    for (const name of ['grant_approval', 'send_email', 'file_tickets', '', null, undefined, 42, {}]) {
      expect(toolFor(name as string)).toBeNull();
    }
  });
});

describe('what the tools tell the model about themselves', () => {
  it('a comment says plainly that it starts nothing', () => {
    // A model that believes commenting begins work will tell a founder their thing is under way.
    expect(toolFor('comment_on_ticket')!.description).toMatch(/changes nothing|starts no work/);
  });

  it('every tool says something, because an unexplained tool is used wrongly', () => {
    for (const t of STUDIO_TOOLS) expect(t.description.length, t.name).toBeGreaterThan(60);
  });
});

describe('which venture a caller may reach', () => {
  const SECRET = 'studio-signing-secret';
  const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

  it('lets through a ticket the studio signed', () => {
    expect(readMcpTicket(mintMcpTicket('arca', SECRET, NOW), SECRET, NOW)).toEqual({ ventureId: 'arca' });
  });

  it('is not the office’s ticket, so one cannot be presented as the other', () => {
    // Same secret, different purpose. A leaked office ticket must not become the ability to file
    // tickets, and vice versa — so the payload is prefixed before it is signed.
    const office = `arca.${NOW + 60_000}.` + require('node:crypto')
      .createHmac('sha256', SECRET).update(`arca.${NOW + 60_000}`).digest('base64url');
    expect(readMcpTicket(office, SECRET, NOW)).toBeNull();
  });

  it('refuses another venture’s ticket, an expired one, and an edited one', () => {
    const good = mintMcpTicket('arca', SECRET, NOW);
    const [v, e, sig] = good.split('.');
    expect(readMcpTicket(good, SECRET, NOW + MCP_TICKET_TTL_MS + 1)).toBeNull();
    expect(readMcpTicket(`${v}.${NOW + 10 ** 12}.${sig}`, SECRET, NOW)).toBeNull();
    expect(readMcpTicket(good, 'a-different-secret', NOW)).toBeNull();
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(readMcpTicket(`${v}.${e}.${flipped}`, SECRET, NOW)).toBeNull();
  });

  it('shrugs at rubbish rather than throwing', () => {
    for (const junk of [null, undefined, '', '.', 'arca', 'arca.1', 'arca.a.b', 'a'.repeat(5000), 42, {}]) {
      expect(() => readMcpTicket(junk as string, SECRET, NOW)).not.toThrow();
      expect(readMcpTicket(junk as string, SECRET, NOW)).toBeNull();
    }
    expect(readMcpTicket(mintMcpTicket('arca', SECRET, NOW), undefined, NOW)).toBeNull();
  });
});

describe('the protocol', () => {
  const caller: McpCaller = { ventureId: 'arca', email: 'studio-tools@arca' };
  const never = async () => { throw new Error('should not have been called'); };

  it('introduces itself, and tells the model what it cannot do', async () => {
    const r = await handleMcp({ id: 1, method: 'initialize' }, caller, never) as never as
      { result: { protocolVersion: string; instructions: string } };
    expect(r.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    // Said once, at the start, so a model does not spend a turn hunting for the tool that signs off.
    expect(r.result.instructions).toMatch(/arca/);
    expect(r.result.instructions).toMatch(/cannot approve, send, spend, merge or deploy/);
  });

  it('lists only the tools that work', async () => {
    const r = await handleMcp({ id: 2, method: 'tools/list' }, caller, never) as never as
      { result: { tools: { name: string; inputSchema: unknown }[] } };
    expect(r.result.tools.map((t) => t.name)).toEqual(STUDIO_TOOLS.map((t) => t.name));
    for (const t of r.result.tools) expect(t.inputSchema).toBeTruthy();
  });

  it('refuses a tool it does not have, and says which it does', async () => {
    // Named, so a model corrects itself rather than guessing at a synonym.
    const r = await handleMcp(
      { id: 3, method: 'tools/call', params: { name: 'approve_approval' } }, caller, never,
    ) as never as { error: { code: number; message: string } };
    expect(r.error.code).toBe(-32602);
    expect(r.error.message).toMatch(/no tool called "approve_approval"/);
    expect(r.error.message).toMatch(/whats_waiting/);
  });

  it('scopes every call to the caller’s venture, whatever the arguments say', async () => {
    let sawVenture = '';
    await handleMcp(
      // The argument a model would send if it were trying, or merely confused.
      { id: 4, method: 'tools/call', params: { name: 'whats_waiting', arguments: { venture: 'the-reset' } } },
      caller,
      async (_n, _a, c) => { sawVenture = c.ventureId; return 'ok'; },
    );
    expect(sawVenture).toBe('arca');
  });

  it('turns a failing tool into an answer rather than a crash', async () => {
    const r = await handleMcp(
      { id: 5, method: 'tools/call', params: { name: 'whats_waiting' } }, caller,
      async () => { throw new Error('the box is not answering'); },
    ) as never as { result: { isError: boolean; content: { text: string }[] } };
    expect(r.result.isError).toBe(true);
    // And says nothing happened, because a model told only "that failed" will offer to retry a write.
    expect(r.result.content[0].text).toMatch(/the box is not answering/);
    expect(r.result.content[0].text).toMatch(/Nothing changed/);
  });

  it('refuses a method it does not answer, rather than throwing', async () => {
    const r = await handleMcp({ id: 6, method: 'resources/list' }, caller, never) as never as
      { error: { code: number } };
    expect(r.error.code).toBe(-32601);
  });

  it('shrugs at rubbish', async () => {
    for (const junk of [{}, { method: null }, { method: 42 }, { id: 1 }]) {
      await expect(handleMcp(junk, caller, never)).resolves.toHaveProperty('error');
    }
  });
});
