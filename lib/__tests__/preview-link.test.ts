import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * A preview link has to open the preview (FB-243).
 *
 * The fault: Railway forks a preview from production with its variables, `AUTH_URL` was a literal
 * production URL, and every preview inherited it. The link worked, answered, returned HTML — and
 * showed the reviewer the live site instead of the pull request's work.
 *
 * Measured on the real thing on 2026-10-01: pull request 315's preview (forked before the fix) went
 * to `…-production-4a73…`; 316's (forked after) stayed on `…-pr-316…`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const { verdictFor } = await import(resolve(HERE, '../../scripts/preview-link-lib.mjs'));

const HOST = 'foundry-studio-fountainbridge-pr-316.up.railway.app';
const hop = (url: string, status: number, location: string | null = null) => ({ url, status, location });

describe('judging where a preview link lands', () => {
  it('passes a link that redirects to its own sign-in page', () => {
    // The real chain from PR 316, after the fix.
    const v = verdictFor([
      hop(`https://${HOST}`, 307, `https://${HOST}/login?callbackUrl=x`),
      hop(`https://${HOST}/login?callbackUrl=x`, 200),
    ], HOST);
    expect(v.ok).toBe(true);
  });

  it('fails a link that lands on production — the fault this exists for', () => {
    // The real chain from PR 315, before the fix.
    const v = verdictFor([
      hop(`https://${HOST}`, 307, 'https://foundry-studio-production-4a73.up.railway.app/login'),
      hop('https://foundry-studio-production-4a73.up.railway.app/login', 200),
    ], HOST);
    expect(v.ok).toBe(false);
    expect(v.kind).toBe('wrong-host');
    expect(v.landedOn).toBe('foundry-studio-production-4a73.up.railway.app');
    // The message has to tell a reader what to change, not just that something is wrong.
    expect(v.reason).toContain('AUTH_URL');
  });

  it('fails a torn-down preview that answers 404 on its own host', () => {
    // The first version of this check reported "OK: stays on <host> (404)" for exactly this — a
    // green answer to the wrong question, which is the family of fault it exists to catch.
    const v = verdictFor([hop(`https://${HOST}`, 404)], HOST);
    expect(v.ok).toBe(false);
    expect(v.kind).toBe('not-serving');
  });

  it('fails a server error on the right host', () => {
    expect(verdictFor([hop(`https://${HOST}`, 500)], HOST).ok).toBe(false);
  });

  it('fails a chain that never settles', () => {
    const v = verdictFor([hop(`https://${HOST}`, 307, `https://${HOST}/a`), hop(`https://${HOST}/a`, 307, `https://${HOST}/b`)], HOST);
    expect(v.ok).toBe(false);
    expect(v.kind).toBe('never-settles');
  });

  it('fails when nothing answered at all, rather than passing an empty chain', () => {
    expect(verdictFor([], HOST).ok).toBe(false);
    expect(verdictFor(null, HOST).ok).toBe(false);
  });

  it('tells the three failures apart, because they call for different actions', () => {
    // Wrong host → fix a variable. Not serving → the preview is gone. Never settles → a loop.
    const kinds = new Set([
      verdictFor([hop(`https://${HOST}`, 200, null)], 'somewhere-else.example').kind,
      verdictFor([hop(`https://${HOST}`, 404)], HOST).kind,
      verdictFor([hop(`https://${HOST}`, 307, `https://${HOST}/a`)], HOST).kind,
    ]);
    expect(kinds.size).toBe(3);
  });

  it('a 3xx that is the final hop with no location still counts as settled', () => {
    // Defensive: a 304 with no Location is not a redirect that failed to settle.
    expect(verdictFor([hop(`https://${HOST}`, 304)], HOST).ok).toBe(false);
  });
});
