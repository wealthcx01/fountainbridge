import { describe, it, expect } from 'vitest';
import { readiness, keyEnvName } from '../readiness';
import { composerKeyEnvName } from '../composer';

/**
 * The check that would have caught the bug (FB-087).
 *
 * The in-studio composer never worked in production because `COMPOSER_API_KEY_ARCA` was never set on
 * Railway. Every test in this repository was green throughout, because they all run against a local
 * server with a local `.env`. These tests are about the *rules*; the endpoint is what applies them
 * where it matters, which is inside the running deployment.
 */

const ARCA = { id: 'arca', vpsHost: 'arca.bruntsfield.capital' };
const NO_BOX = { id: 'thereset', vpsHost: null };

describe('reading the studio’s own wiring', () => {
  it('a venture with a box and its key is ready', () => {
    const r = readiness([ARCA], { COMPOSER_API_KEY_ARCA: 'sk-live' });
    expect(r.ok).toBe(true);
    expect(r.ventures[0].keySet).toBe(true);
    expect(r.ventures[0].problem).toBeNull();
  });

  it('a venture with a box and NO key is the exact bug, and is not ready', () => {
    const r = readiness([ARCA], {});
    expect(r.ok).toBe(false);
    expect(r.ventures[0].ready).toBe(false);
  });

  it('the problem names the variable and the script, so it is fixable without reading code', () => {
    const { problem } = readiness([ARCA], {}).ventures[0];
    expect(problem).toContain('COMPOSER_API_KEY_ARCA');
    expect(problem).toContain('enable-agents-api.sh');
    // And says what it costs, so nobody files it as cosmetic.
    expect(problem).toMatch(/fail for the founder/i);
  });

  it('an empty string is not a set key', () => {
    // Railway will happily hold an empty variable, and `typeof '' === 'string'` would call it set —
    // producing a green readiness report for a studio that cannot authenticate to anything.
    expect(readiness([ARCA], { COMPOSER_API_KEY_ARCA: '   ' }).ok).toBe(false);
  });

  it('a venture with no box yet is ready, not broken', () => {
    // THE RESET before its box exists. Flagging this as a fault would train whoever reads the report
    // to ignore it, which is how the real fault gets missed.
    const r = readiness([NO_BOX], {});
    expect(r.ok).toBe(true);
    expect(r.ventures[0].problem).toBeNull();
  });

  it('one broken venture makes the whole report not-ok', () => {
    expect(readiness([ARCA, NO_BOX], {}).ok).toBe(false);
    expect(readiness([ARCA, NO_BOX], { COMPOSER_API_KEY_ARCA: 'sk' }).ok).toBe(true);
  });

  it('never reports the key itself, its length, or a prefix', () => {
    // A readiness endpoint that leaks a hint about a credential is a worse bug than the one it was
    // written to catch.
    const secret = 'sk-c33d8af1a48c0fa87156a7573b663ae0';
    const json = JSON.stringify(readiness([ARCA], { COMPOSER_API_KEY_ARCA: secret }));
    expect(json).not.toContain(secret);
    expect(json).not.toContain(secret.slice(0, 8));
    expect(json).not.toContain(String(secret.length));
  });
});

describe('the two places that name the variable agree', () => {
  it('readiness looks up exactly what the composer route reads', () => {
    // The duplication is deliberate (lib/composer reaches the client bundle). If these ever drift,
    // readiness reports health for a variable nothing reads — confidently, and wrongly.
    for (const id of ['arca', 'thereset', 'the-reset', 'a.b-c']) {
      expect(keyEnvName(id)).toBe(composerKeyEnvName(id));
    }
  });

  it('the name matches what the box’s script prints', () => {
    // deploy/librechat/enable-agents-api.sh derives this from VENTURE_REPO (wealthcx01/arca → ARCA).
    // It printed COMPOSER_API_KEY_FOUNDRY on a stale box copy, which is how the variable went missing
    // in the first place: whoever ran it set a name nothing reads.
    expect(keyEnvName('arca')).toBe('COMPOSER_API_KEY_ARCA');
  });
});
