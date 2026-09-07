import { describe, it, expect } from 'vitest';
import {
  STUDIO_TOOLS, VERBS_NO_TOOL_MAY_CARRY, toolFor,
  mintMcpTicket, readMcpTicket, MCP_TICKET_TTL_MS,
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
    // `propose_approval` is the one tool allowed to say the word, because saying it is its job —
    // and its description has to make plain that it does not do it.
    const propose = toolFor('propose_approval')!;
    expect(propose.kind).toBe('propose');
    expect(propose.description).toMatch(/does not answer it|nothing happens until/);
  });

  it('is exactly this surface, so adding to it is a deliberate act', () => {
    // If this list changes, someone changed what a founder's Claude can do. That should require
    // editing an assertion, not merely appending to an array.
    expect(STUDIO_TOOLS.map((t) => `${t.kind}:${t.name}`)).toEqual([
      'read:whats_waiting',
      'read:read_ticket',
      'read:what_happened',
      'read:budgets',
      'read:venture_memory',
      'write:file_ticket',
      'write:comment_on_ticket',
      'propose:propose_approval',
    ]);
  });

  it('refuses a tool it does not have, rather than guessing at one it does', () => {
    for (const name of ['grant_approval', 'send_email', 'file_tickets', '', null, undefined, 42, {}]) {
      expect(toolFor(name as string)).toBeNull();
    }
  });
});

describe('the guidance that makes a filed ticket a good one travels with the tool', () => {
  it('tells the model how the studio writes a ticket', () => {
    // FB-200 warned that moving the door to Claude would quietly lose the composer's guidance
    // (FB-079) and that ticket quality would drop with nobody noticing. A description is the only
    // place it can travel, so it is asserted.
    const filed = toolFor('file_ticket')!;
    expect(filed.description).toMatch(/outcome rather than the task/);
    expect(filed.description).toMatch(/one piece of work/);
    expect(filed.description).toMatch(/nothing is built until/);
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
