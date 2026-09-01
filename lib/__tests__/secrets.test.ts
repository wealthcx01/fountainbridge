import { describe, it, expect } from 'vitest';
import { scanForSecrets, secretRefusal, SECRET_PATTERNS } from '../secrets';

/**
 * Refusing a credential (FB-140).
 *
 * The studio's own upload did not scan at all, while the composer's deposit tool always has. These
 * fix the rule in place, and — more importantly — fix what the refusal must never do.
 */
describe('spotting a credential', () => {
  const cases: Array<[string, string]> = [
    ['-----BEGIN RSA PRIVATE KEY-----\nMIIEow…', 'a private key'],
    ['AWS: AKIAIOSFODNN7EXAMPLE', 'an AWS access key'],
    ['key = sk-abcdefghijklmnopqrstuvwxyz01', 'an API key (sk-…)'],
    ['token ghp_' + 'a'.repeat(36), 'a GitHub token'],
    ['github_pat_' + 'b'.repeat(40), 'a GitHub fine-grained token'],
    ['xoxb-1234567890-abcdef', 'a Slack token'],
    ['tvly-abcdefghijkl', 'a Tavily key'],
    ['password: hunter2hunter2', 'a password/secret assignment'],
    ['api_key = "abcd1234efgh"', 'a password/secret assignment'],
  ];

  for (const [text, what] of cases) {
    it(`refuses ${what}`, () => {
      expect(scanForSecrets(text)).toBe(what);
    });
  }

  it('lets an ordinary document through', () => {
    // A coarse net still has to pass the thing founders actually upload.
    expect(scanForSecrets('# Brand positioning\n\nA trading desk, not a toy aisle. Price is the product.')).toBeNull();
    expect(scanForSecrets('Our password policy is that people should use a manager.')).toBeNull();
  });

  it('never returns the credential itself', () => {
    // The whole point is to keep it out of the record — including out of the message ABOUT it, which
    // is rendered on a screen and could be read over a shoulder or pasted into a support thread.
    const secret = 'ghp_' + 'z'.repeat(36);
    const what = scanForSecrets(`token ${secret}`)!;
    expect(what).not.toContain(secret);
    expect(secretRefusal('creds.md', what)).not.toContain(secret);
  });

  it('says what was seen, that nothing was saved, and what to do', () => {
    const msg = secretRefusal('deck.md', 'a private key');
    expect(msg).toContain('deck.md');
    expect(msg).toContain('a private key');
    expect(msg).toContain('not saved');
    expect(msg).toMatch(/remove it/i);
  });

  it('has no pattern that matches an empty document', () => {
    // A pattern that fires on nothing would refuse every upload, and the failure would look like a
    // security feature working.
    expect(scanForSecrets('')).toBeNull();
    for (const [re, what] of SECRET_PATTERNS) expect(re.test(''), what).toBe(false);
  });
});
