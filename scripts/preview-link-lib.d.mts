/**
 * Types for the one judgement of whether a preview link opens its preview (FB-243, FB-184).
 *
 * `preview-link-lib.mjs` is plain JavaScript so `check-preview-link.mjs` can run it with no build
 * step. The studio needs the same judgement before it shows a founder a "see it running" link, and a
 * second copy would be two answers to one question. So there is one implementation and this declares
 * it, the way `deploy/librechat/ticket-mcp/ids.d.mts` does for the ticket-id allocator.
 */

export interface Hop {
  url: string;
  status: number;
  location: string | null;
}

export type Verdict =
  | { ok: true; kind: 'ok'; host: string; status: number; reason: string }
  | { ok: false; kind: 'unreachable' | 'never-settles' | 'wrong-host' | 'not-serving'; reason: string; landedOn?: string; status?: number };

/** Judge a finished redirect chain against the host the link was meant to open. */
export function verdictFor(hops: Hop[], expectedHost: string): Verdict;
