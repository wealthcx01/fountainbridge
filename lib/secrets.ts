/**
 * Refusing a document that carries a credential (FB-140, CLAUDE.md #8).
 *
 * ## Why this exists as its own module
 *
 * The composer's deposit tool has scanned every deposit since it was written — *"this content
 * becomes permanent git history"* — and **the studio's own upload did not scan at all**. A founder
 * on the Memory screen could hand over a file containing a private key and it would go into the
 * venture's records forever, through a control the studio itself offers.
 *
 * Two doors to one place, one of them guarded. So the rule lives here, and
 * `scripts/__tests__/secret-drift.test.ts` asserts the box's copy has not drifted from it.
 *
 * ## What it is and is not
 *
 * A refusal, not a redaction. Stripping a secret and saving the rest would tell a founder their
 * document was stored while quietly changing it, and would leave them believing a credential was
 * handled when it was only moved. The document is not saved, and the studio says which kind of thing
 * it saw — enough to find it, never the value.
 *
 * It is deliberately a coarse net. A false positive costs a founder one confused minute and a
 * rename; a false negative is a live credential in git history forever.
 */

/** What a match means, in words a founder can act on. Never the matched text itself. */
export const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/-----BEGIN[ A-Z]*PRIVATE KEY-----/, 'a private key'],
  [/AKIA[0-9A-Z]{16}/, 'an AWS access key'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'an API key (sk-…)'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}/, 'a GitHub fine-grained token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/\btvly-[A-Za-z0-9-]{10,}/, 'a Tavily key'],
  [/(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?\S{8,}/i, 'a password/secret assignment'],
];

/** What kind of credential this text appears to contain, or null. Never returns the value. */
export function scanForSecrets(text: string): string | null {
  for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) return what;
  return null;
}

/**
 * The refusal a founder reads.
 *
 * Names the file and the kind of thing, says plainly that nothing was saved, and gives the next
 * step. A refusal a founder cannot act on is a dead end with a lecture attached.
 */
export function secretRefusal(filename: string, what: string): string {
  return (
    `“${filename}” was not saved — it looks like it contains ${what}. Anything handed over becomes `
    + 'part of your venture’s permanent records, so a credential in it could not be taken back out. '
    + 'Remove it and hand the document over again.'
  );
}
