import { describe, it, expect } from 'vitest';
import {
  signTicket, readTicket, allowedFromBrowser, routeFor, dressDocument, CHROME_HIDDEN,
  ALLOWED_FROM_BROWSER,
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
