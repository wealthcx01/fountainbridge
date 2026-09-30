import { describe, it, expect } from 'vitest';
import {
  signTicket, readTicket, allowedFromBrowser, routeFor, dressDocument, CHROME_HIDDEN,
  ALLOWED_FROM_BROWSER,
  liveRoster, forwardToBrowser, LIVE_WINDOW_MS,
  ticketsBySession, sessionIdFromPath, oneCharacterPerTicket,
} from '../office-gate-lib.mjs';

/**
 * FB-198 — the office gate.
 *
 * This is the only lock between a browser and a venture's own machine. It is not one of two. So
 * these are written as attempts to get through it, not as a demonstration that the happy path works.
 */
const SECRET = 'arca-office-secret-not-for-production';
const OTHER = 'a-different-venture-secret';
const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

const mint = (venture, secret = SECRET, exp = NOW + 30 * 60_000) =>
  `${venture}.${exp}.${signTicket(`${venture}.${exp}`, secret)}`;

const gate = { venture: 'arca', secret: SECRET, now: NOW };

describe('the ticket', () => {
  it('lets in a ticket the studio signed for this venture', () => {
    expect(readTicket(mint('arca'), gate)).toBe('arca');
  });

  it('refuses a ticket signed with another venture’s secret', () => {
    // The whole point of a secret per venture: a box that was broken into cannot mint for its
    // neighbours, and cannot be handed something minted by them either.
    expect(readTicket(mint('arca', OTHER), gate)).toBeNull();
  });

  it('refuses a ticket that names a different venture, even correctly signed', () => {
    const forOther = `sonder.${NOW + 60_000}.${signTicket(`sonder.${NOW + 60_000}`, SECRET)}`;
    expect(readTicket(forOther, gate)).toBeNull();
  });

  it('refuses a ticket that has expired, including one that expired a millisecond ago', () => {
    expect(readTicket(mint('arca', SECRET, NOW - 1), gate)).toBeNull();
    expect(readTicket(mint('arca', SECRET, NOW), gate)).toBe('arca');
  });

  it('refuses a ticket whose expiry has been edited', () => {
    const good = mint('arca');
    const [v, , sig] = good.split('.');
    expect(readTicket(`${v}.${NOW + 10 ** 12}.${sig}`, gate)).toBeNull();
  });

  it('refuses a signature that is the right length but wrong', () => {
    const good = mint('arca');
    const [v, e, sig] = good.split('.');
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(flipped).toHaveLength(sig.length);
    expect(readTicket(`${v}.${e}.${flipped}`, gate)).toBeNull();
  });

  it('refuses rubbish rather than throwing', () => {
    for (const junk of [
      null, undefined, '', '.', '..', 'arca', 'arca.', 'arca.abc.sig', 'arca.123',
      'arca.123.sig.extra', '../../etc/passwd', 'arca.123.'.padEnd(5000, 'x'),
      { toString: () => mint('arca') }, 42, [], {},
    ]) {
      expect(() => readTicket(junk, gate)).not.toThrow();
      expect(readTicket(junk, gate)).toBeNull();
    }
  });

  it('refuses everything when the box has no secret configured', () => {
    // A box that has lost its secret must refuse, never wave people through.
    expect(readTicket(mint('arca'), { venture: 'arca', secret: '', now: NOW })).toBeNull();
    expect(readTicket(mint('arca'), { venture: 'arca', secret: undefined, now: NOW })).toBeNull();
  });

  it('refuses a venture id dressed up to look like another', () => {
    for (const name of ['ARCA', 'arca ', ' arca', 'arca.', 'arca/..', 'arca%2e']) {
      const t = `${name}.${NOW + 60_000}.${signTicket(`${name}.${NOW + 60_000}`, SECRET)}`;
      expect(readTicket(t, gate)).toBeNull();
    }
  });
});

describe('what a browser may say to a venture machine', () => {
  it('lets the handshake through, and only in that exact shape', () => {
    expect(allowedFromBrowser(JSON.stringify({ type: ALLOWED_FROM_BROWSER }))).toBe(true);
  });

  it('drops the message that would remove an agent', () => {
    // The reason this gate exists. pixel-agents accepts this from any connection.
    expect(allowedFromBrowser('{"type":"closeAgent","id":1}')).toBe(false);
    expect(allowedFromBrowser('{"type":"installHooks"}')).toBe(false);
    expect(allowedFromBrowser('{"type":"saveAgentSeats","seats":{}}')).toBe(false);
    expect(allowedFromBrowser('{"type":"setLastSeenVersion","version":"1.4"}')).toBe(false);
  });

  it('drops the handshake with anything smuggled alongside it', () => {
    expect(allowedFromBrowser('{"type":"webviewReady","id":1}')).toBe(false);
    expect(allowedFromBrowser('{"type":"webviewReady","then":{"type":"closeAgent"}}')).toBe(false);
    expect(allowedFromBrowser('{"id":1,"type":"webviewReady"}')).toBe(false);
  });

  it('drops shapes that are not a message at all', () => {
    for (const junk of [
      '', 'webviewReady', '"webviewReady"', 'null', 'true', '1', '[]', '{}',
      '["webviewReady"]', '[{"type":"webviewReady"}]', '{"type":["webviewReady"]}',
      '{"type":{"toString":"webviewReady"}}', 'not json at all', '{"type":"webviewReady"',
    ]) {
      expect(allowedFromBrowser(junk)).toBe(false);
    }
  });

  it('drops a message that is not a string, and a binary frame', () => {
    expect(allowedFromBrowser(Buffer.from('{"type":"webviewReady"}'))).toBe(false);
    expect(allowedFromBrowser('{"type":"webviewReady"}', true)).toBe(false);
  });

  it('refuses to parse something big enough to be an attack on its own', () => {
    const nested = `{"type":"webviewReady","x":${'['.repeat(200)}${']'.repeat(200)}}`;
    expect(allowedFromBrowser(nested)).toBe(false);
    expect(allowedFromBrowser(`{"type":"${'a'.repeat(10_000)}"}`)).toBe(false);
  });

  it('is case sensitive, so near misses are misses', () => {
    expect(allowedFromBrowser('{"type":"WebviewReady"}')).toBe(false);
    expect(allowedFromBrowser('{"type":"webviewready"}')).toBe(false);
    expect(allowedFromBrowser('{"type":"webviewReady "}')).toBe(false);
  });
});

describe('what the gate will serve', () => {
  it('serves the document and the socket, and asks both for a ticket', () => {
    expect(routeFor('/')).toEqual({ kind: 'document', needsTicket: true });
    expect(routeFor('/ws')).toEqual({ kind: 'socket', needsTicket: true });
  });

  it('serves the app’s own files without one', () => {
    expect(routeFor('/assets/index-D-OGLsbn.js')?.kind).toBe('asset');
    expect(routeFor('/fonts/FSPixelSansUnicode-Regular.ttf')?.kind).toBe('asset');
    expect(routeFor('/assets/characters/char_0.png')?.kind).toBe('asset');
  });

  it('refuses everything else, so the gate is not a way into the rest of the box', () => {
    for (const path of [
      '/etc/passwd', '/../../etc/passwd', '/assets/../../etc/passwd', '/assets/',
      '/api/agents', '/api/', '/ws/', '/wss', '/WS', '/index.html/../secrets',
      '/assets/a/../../b', '//evil.test/', '/assets/x%2f..%2f..%2fetc',
    ]) {
      expect(routeFor(path), path).toBeNull();
    }
  });

  it('answers a health check without a ticket, because an uptime monitor has none', () => {
    expect(routeFor('/api/health')).toEqual({ kind: 'health', needsTicket: false });
  });
});

describe('the document the founder gets', () => {
  it('carries the studio’s stylesheet', () => {
    const out = dressDocument('<html><head><title>Office</title></head><body></body></html>');
    expect(out).toContain('data-foundry="office-chrome"');
    for (const selector of CHROME_HIDDEN) expect(out).toContain(selector);
    expect(out).toContain('display:none !important');
  });

  it('still carries it if the document has no head to put it in', () => {
    expect(dressDocument('<body>hello</body>')).toContain('data-foundry="office-chrome"');
  });

  it('hides exactly the four things that were seen on the pinned version', () => {
    // If a version bump moves a button this list is what has to be re-checked, so it is asserted
    // rather than assumed.
    expect(CHROME_HIDDEN).toEqual([
      '.absolute.top-8.left-8',
      '.absolute.bottom-10.left-10',
      '.absolute.bottom-42.right-28',
      '.absolute.bottom-8.right-28',
    ]);
  });
});


describe('the office stops drawing agents that finished (FB-218)', () => {
  // ARCA's real numbers on 2026-09-29, six days after the restart that was called "a reset, not a
  // fix": 120 agents in the registry, and not one transcript written in the previous two hours.
  const NOW = 1_800_000_000_000;
  const minsAgo = (m) => NOW - m * 60_000;

  /** A roster shaped exactly like the office's own `existingAgents` message. */
  const rosterOf = (ids) => ({
    type: 'existingAgents',
    agents: [...ids],
    agentMeta: Object.fromEntries(ids.map((i) => [String(i), { palette: i % 8, hueShift: 0 }])),
    externalAgents: Object.fromEntries(ids.map((i) => [String(i), true])),
    folderNames: {},
  });

  it('keeps the working ones and drops the finished ones', () => {
    const files = new Map([[1, '/a.jsonl'], [2, '/b.jsonl'], [3, '/c.jsonl']]);
    const mtimes = { '/a.jsonl': minsAgo(1), '/b.jsonl': minsAgo(29), '/c.jsonl': minsAgo(240) };
    const { roster, dropped } = liveRoster(rosterOf([1, 2, 3]), files, (p) => mtimes[p], NOW);
    expect(roster.agents).toEqual([1, 2]);
    expect(dropped).toEqual([3]);
  });

  it('takes a room of 120 under ten, which is the whole point', () => {
    // Four working, 116 finished -- ARCA's shape. The acceptance criterion is "fewer than ten
    // figures in normal use, a day after any reset", so assert the bound and not just the filter.
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const mtimeOf = (p) => {
      const n = Number(/\/s(\d+)\.jsonl/.exec(p)[1]);
      return n <= 4 ? minsAgo(2) : minsAgo(60 * 24);
    };
    const { roster } = liveRoster(rosterOf(ids), files, mtimeOf, NOW);
    expect(roster.agents).toEqual([1, 2, 3, 4]);
    expect(roster.agents.length).toBeLessThan(10);
  });

  it('strips the dropped agents out of agentMeta and externalAgents too', () => {
    // Leaving them behind would hand the browser metadata for figures it was told do not exist, and
    // pixel-agents draws from whatever it is given.
    const files = new Map([[1, '/a.jsonl'], [2, '/b.jsonl']]);
    const { roster } = liveRoster(rosterOf([1, 2]), files,
      (p) => (p === '/a.jsonl' ? minsAgo(1) : minsAgo(600)), NOW);
    expect(Object.keys(roster.agentMeta)).toEqual(['1']);
    expect(Object.keys(roster.externalAgents)).toEqual(['1']);
  });

  it('never empties a room where work is happening', () => {
    // Criterion two. An empty office over a working machine is a worse lie than a full one, so this
    // is the case that must never regress.
    const ids = [7, 8, 9];
    const files = new Map(ids.map((i) => [i, `/w${i}.jsonl`]));
    const { roster, dropped } = liveRoster(rosterOf(ids), files, () => minsAgo(0), NOW);
    expect(roster.agents).toEqual(ids);
    expect(dropped).toEqual([]);
  });

  it('keeps an agent whose transcript it cannot find, rather than guessing it ended', () => {
    // No path recorded is "we cannot tell", not "it finished". Fail towards showing.
    const { roster, dropped } = liveRoster(rosterOf([1, 2]), new Map([[1, '/a.jsonl']]),
      () => minsAgo(1), NOW);
    expect(roster.agents).toEqual([1, 2]);
    expect(dropped).toEqual([]);
  });

  it('drops an agent whose transcript is gone', () => {
    const { dropped } = liveRoster(rosterOf([5]), new Map([[5, '/gone.jsonl']]), () => null, NOW);
    expect(dropped).toEqual([5]);
  });

  it('holds back per-agent news about an agent the browser was never told about', () => {
    // Without this the room refills itself one agentStatus at a time.
    const kept = new Set([1, 2]);
    expect(forwardToBrowser({ type: 'agentStatus', id: 1, status: 'waiting' }, kept)).toBe(true);
    expect(forwardToBrowser({ type: 'agentStatus', id: 97, status: 'waiting' }, kept)).toBe(false);
    expect(forwardToBrowser({ type: 'agentContextUsage', id: 97, contextTokens: 1 }, kept)).toBe(false);
  });

  it('forwards everything that is not about one agent', () => {
    const kept = new Set([1]);
    for (const type of ['layoutLoaded', 'settingsLoaded', 'characterSpritesLoaded', 'existingAgents']) {
      expect(forwardToBrowser({ type }, kept), type).toBe(true);
    }
  });

  it('uses a window generous enough that a long model call does not erase an agent', () => {
    expect(LIVE_WINDOW_MS).toBeGreaterThanOrEqual(15 * 60 * 1000);
  });
});


describe('one character per ticket, helpers invisible (FB-231)', () => {
  // John's ruling, 2026-09-30. A character means a PIECE OF WORK, not an agent and not a department.
  //
  // Why it is needed on top of FB-218's bound: supervisor.sh calls claude_lane five times per round --
  // plan, implement, gate check, review, qa -- each a fresh `claude -p` writing its own transcript, and
  // MAX_VALIDATION_ROUNDS defaults to 2. So before this, ONE TICKET DREW FIVE TO ELEVEN CHARACTERS.
  const NOW = 1_800_000_000_000;
  const minsAgo = (m) => NOW - m * 60_000;

  const rosterOf = (ids) => ({
    type: 'existingAgents',
    agents: [...ids],
    agentMeta: Object.fromEntries(ids.map((i) => [String(i), { palette: i % 8 }])),
    externalAgents: Object.fromEntries(ids.map((i) => [String(i), true])),
  });

  it('reads the lane index, and skips a half-written line rather than throwing', () => {
    // A partial last line is normal for a file being appended to while it is read.
    const text = [
      '{"session":"a","ticket":"ARCA-61","stage":"plan","at":"x"}',
      '',
      'not json at all',
      '{"session":"b","ticket":"ARCA-61","stage":"implement","at":"y"}',
      '{"session":"c","ticket":"ARCA-9"',
    ].join('\n');
    const m = ticketsBySession(text);
    expect(m.get('a')).toBe('ARCA-61');
    expect(m.get('b')).toBe('ARCA-61');
    expect(m.has('c')).toBe(false);
  });

  it('lets a later entry correct an earlier one for the same session', () => {
    const m = ticketsBySession([
      '{"session":"a","ticket":"WRONG"}',
      '{"session":"a","ticket":"ARCA-61"}',
    ].join('\n'));
    expect(m.get('a')).toBe('ARCA-61');
  });

  it('takes the session id out of a transcript path', () => {
    expect(sessionIdFromPath('/root/.claude/projects/-opt-foundry-lane-arca/abc-123.jsonl')).toBe('abc-123');
    expect(sessionIdFromPath('nonsense')).toBeNull();
    expect(sessionIdFromPath(undefined)).toBeNull();
  });

  it('draws ONE character for a ticket worked by five sessions', () => {
    // The real shape: one wake, five stages, five transcripts.
    const ids = [1, 2, 3, 4, 5];
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const ticketOf = new Map(ids.map((i) => [`s${i}`, 'ARCA-61']));
    const mtimes = { '/s1.jsonl': minsAgo(20), '/s2.jsonl': minsAgo(15), '/s3.jsonl': minsAgo(10), '/s4.jsonl': minsAgo(5), '/s5.jsonl': minsAgo(1) };
    const { roster, collapsed, ticketOfAgent } = oneCharacterPerTicket(rosterOf(ids), ticketOf, files, (p) => mtimes[p]);
    expect(roster.agents).toEqual([5]);           // the most recently active stage
    expect(collapsed).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    expect(ticketOfAgent[5]).toBe('ARCA-61');
  });

  it('draws one character per ticket when two tickets are in flight', () => {
    const ids = [1, 2, 3, 4];
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const ticketOf = new Map([['s1', 'ARCA-61'], ['s2', 'ARCA-61'], ['s3', 'SELL-1'], ['s4', 'SELL-1']]);
    const mtimes = { '/s1.jsonl': minsAgo(9), '/s2.jsonl': minsAgo(2), '/s3.jsonl': minsAgo(8), '/s4.jsonl': minsAgo(1) };
    const { roster } = oneCharacterPerTicket(rosterOf(ids), ticketOf, files, (p) => mtimes[p]);
    expect(roster.agents).toEqual([2, 4]);
    expect(roster.agents).toHaveLength(2);
  });

  it('keeps an agent whose session the index does not know, rather than hiding it', () => {
    // No record is "we cannot tell", not "this is a helper" -- the same fail-towards-showing rule as the
    // liveness bound, because an empty office over a working machine is the worse lie.
    const ids = [1, 2];
    const files = new Map([[1, '/known.jsonl'], [2, '/unknown.jsonl']]);
    const ticketOf = new Map([['known', 'ARCA-61']]);
    const { roster, collapsed } = oneCharacterPerTicket(rosterOf(ids), ticketOf, files, () => minsAgo(1));
    expect(roster.agents).toEqual([1, 2]);
    expect(collapsed).toEqual([]);
  });

  it('keeps every agent when the index is empty, so an unreadable file empties nothing', () => {
    const ids = [1, 2, 3];
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const { roster } = oneCharacterPerTicket(rosterOf(ids), new Map(), files, () => minsAgo(1));
    expect(roster.agents).toEqual(ids);
  });

  it('strips the collapsed helpers out of agentMeta and externalAgents too', () => {
    const ids = [1, 2];
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const ticketOf = new Map([['s1', 'ARCA-61'], ['s2', 'ARCA-61']]);
    const mtimes = { '/s1.jsonl': minsAgo(9), '/s2.jsonl': minsAgo(1) };
    const { roster } = oneCharacterPerTicket(rosterOf(ids), ticketOf, files, (p) => mtimes[p]);
    expect(Object.keys(roster.agentMeta)).toEqual(['2']);
    expect(Object.keys(roster.externalAgents)).toEqual(['2']);
  });

  it('keeps the office\'s own order, so the room does not reshuffle between messages', () => {
    const ids = [7, 3, 9];
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const ticketOf = new Map([['s7', 'A'], ['s3', 'B'], ['s9', 'C']]);
    const { roster } = oneCharacterPerTicket(rosterOf(ids), ticketOf, files, () => minsAgo(1));
    expect(roster.agents).toEqual([7, 3, 9]);
  });

  it('together with the liveness bound, eleven sessions become one character', () => {
    // The whole point, end to end: a ticket at its worst (2 rounds x 5 stages, plus a stray) where some
    // stages have finished. FB-218 drops the finished; FB-231 collapses the rest to one.
    const ids = Array.from({ length: 11 }, (_, i) => i + 1);
    const files = new Map(ids.map((i) => [i, `/s${i}.jsonl`]));
    const ticketOf = new Map(ids.map((i) => [`s${i}`, 'ARCA-61']));
    // The first eight finished long ago; the last three are recent.
    const mtimeOf = (p) => {
      const n = Number(/\/s(\d+)\.jsonl/.exec(p)[1]);
      return n <= 8 ? minsAgo(600) : minsAgo(12 - n);
    };
    const live = liveRoster(rosterOf(ids), files, mtimeOf, NOW);
    expect(live.roster.agents).toEqual([9, 10, 11]);
    const one = oneCharacterPerTicket(live.roster, ticketOf, files, mtimeOf);
    expect(one.roster.agents).toHaveLength(1);
  });
});
