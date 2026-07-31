import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The bash classifier that decides whether a ticket's work must be PROPOSED for a human rather than
 * merely done (FB-045). Exercised through a real shell, because the rule lives in
 * `is_external_action` in foundry-lib.sh and a re-implementation in JS would test the wrong thing.
 *
 * The case that matters most is SELL-001: it writes a positioning document and mentions in passing
 * that the landing page and "the emails" depend on it. The first version of this rule was a keyword
 * scan alone, so it matched "emails", told the lane to produce a send proposal for a ticket with no
 * send, and would have blocked the ticket when the lane correctly refused to invent one.
 */
const classify = (body) => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  const file = join(dir, 'ticket.md');
  writeFileSync(file, body);
  try {
    const script = `
      set -euo pipefail
      REPO=x/y BASE_BRANCH=main TICKET_GITHUB_TOKEN=t
      . deploy/lane/foundry-lib.sh
      if is_external_action "${file}"; then echo external; else echo ordinary; fi
    `;
    return execFileSync('bash', ['-c', script], { encoding: 'utf8' }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('what has to be proposed rather than just done', () => {
  it('takes the ticket at its word when it declares Gate: pr, whatever the prose mentions', () => {
    expect(classify(`# SELL-001 — Write the positioning one-pager
**Status:** Todo · **Gate:** pr

Everything else — the landing page, the emails, the way we describe ARCA — is downstream of this.
`)).toBe('ordinary');
  });

  it('treats a declared non-pr gate as an external action', () => {
    expect(classify(`# SELL-002 — Send the early-access invitation
**Status:** Todo · **Gate:** activegraph

Draft the invitation and propose the send.
`)).toBe('external');
  });

  it('reads the prose when the ticket declares no gate at all', () => {
    expect(classify(`# SELL-003 — Email the waiting list about the launch
**Status:** Todo

Nobody declared a gate here.
`)).toBe('external');
  });

  it('leaves ordinary undeclared work alone', () => {
    expect(classify(`# SELL-004 — Rewrite the pricing page copy
**Status:** Todo

Tighten the wording on the pricing page.
`)).toBe('ordinary');
  });

  it('is case-insensitive about the declaration', () => {
    expect(classify('# X — Y\n**status:** todo · **gate:** ACTIVEGRAPH\n')).toBe('external');
  });

  it('does not let an unrecognised gate fall through to ordinary', () => {
    // tbd-fb012 (Scale) is deliberately unspecified; an unknown gate must be the strict one.
    expect(classify('# X — Y\n**Status:** Todo · **Gate:** tbd-fb012\n')).toBe('external');
  });
});
