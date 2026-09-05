import { describe, it, expect } from 'vitest';
import {
  mintOfficeToken, readOfficeToken, officeEndpoint, officeConfigured,
  officeSecretEnvName, officeHostEnvName, officeMessageAllowed, OFFICE_TOKEN_TTL_MS,
} from '../office-embed';

/**
 * FB-163 — the venture office, embedded read-only.
 *
 * Everything here is the half a browser could attack: the capability that says which venture, and
 * the filter that is the only thing making "read-only" true.
 */
const SECRET = 'studio-signing-secret';

describe('the office capability (FB-163)', () => {
  it('names one venture, and the studio can read its own token back', () => {
    const t = mintOfficeToken('arca', SECRET);
    expect(readOfficeToken(t, SECRET)?.ventureId).toBe('arca');
  });

  it('carries nothing about the box', () => {
    // The whole point of proxying: no host and no credential of the venture box reaches a browser.
    // The token is the venture, an expiry and a signature — and the signature is over those two, so
    // there is nowhere for a hostname to hide in it.
    const boxHost = 'chat.arca.bruntsfield.capital';
    const boxSecret = 'the-box-shared-secret';
    const t = mintOfficeToken('arca', SECRET);
    expect(t).not.toContain(boxHost);
    expect(t).not.toContain(boxSecret);
    expect(t).not.toContain(SECRET);
    expect(t.split('.')).toHaveLength(3);
    expect(t.split('.')[0]).toBe('arca');
  });

  it('is refused when it was signed with anything else', () => {
    const forged = mintOfficeToken('arca', 'not-the-studio-secret');
    expect(readOfficeToken(forged, SECRET)).toBeNull();
  });

  it('cannot be edited to name a different venture', () => {
    // The signature covers the venture id, so swapping it invalidates the token rather than
    // granting a founder a look at somebody else's office.
    const t = mintOfficeToken('arca', SECRET);
    const swapped = t.replace(/^arca\./, 'the-reset.');
    expect(readOfficeToken(swapped, SECRET)).toBeNull();
  });

  it('expires', () => {
    const now = Date.now();
    const t = mintOfficeToken('arca', SECRET, now);
    expect(readOfficeToken(t, SECRET, now + OFFICE_TOKEN_TTL_MS - 1_000)?.ventureId).toBe('arca');
    expect(readOfficeToken(t, SECRET, now + OFFICE_TOKEN_TTL_MS + 1_000)).toBeNull();
  });

  it('shrugs at rubbish rather than throwing', () => {
    for (const junk of [null, undefined, '', 'a', 'a.b', 'a.b.c.d', 'arca.notanumber.sig']) {
      expect(readOfficeToken(junk as string, SECRET)).toBeNull();
    }
    expect(readOfficeToken(mintOfficeToken('arca', SECRET), undefined)).toBeNull();
  });
});

describe('read-only is a filter, not a setting (FB-163)', () => {
  /**
   * The box accepts `closeAgent` from ANY connection and calls dismiss + removeAgent. Only the hooks
   * install is token-gated upstream. So a viewer who could talk to the box could remove agents from
   * the office — which is why this is an allow-list of one and not a deny-list.
   */
  it('passes the handshake', () => {
    expect(officeMessageAllowed(JSON.stringify({ type: 'webviewReady' }))).toBe(true);
  });

  it('drops everything that could change the office', () => {
    for (const type of ['closeAgent', 'setWatchAllSessions', 'setHooksEnabled', 'saveLayout', 'createAgent']) {
      expect(officeMessageAllowed(JSON.stringify({ type })), type).toBe(false);
    }
  });

  it('drops anything that is not a message at all', () => {
    for (const raw of ['', 'not json', '[]', 'null', '{}', JSON.stringify({ type: 7 })]) {
      expect(officeMessageAllowed(raw)).toBe(false);
    }
  });
});

describe('a venture is either fully wired or has no office (FB-163)', () => {
  const host = officeHostEnvName('arca');
  const secret = officeSecretEnvName('arca');

  it('reads both halves from the same variables the socket proxy reads', () => {
    expect(host).toBe('OFFICE_HOST_ARCA');
    expect(secret).toBe('OFFICE_SECRET_ARCA');
  });

  it('needs both, so the frame can never load against a socket that cannot open', () => {
    expect(officeConfigured('arca', {})).toBe(false);
    expect(officeConfigured('arca', { [host]: 'chat.arca.example' })).toBe(false);
    expect(officeConfigured('arca', { [secret]: 'x' })).toBe(false);
    expect(officeConfigured('arca', { [host]: 'chat.arca.example', [secret]: 'x' })).toBe(true);
  });

  it('a venture with no box has no office, which is most of them', () => {
    expect(officeEndpoint('the-reset', {})).toBeNull();
    expect(officeConfigured('the-reset', {})).toBe(false);
  });

  it('one credential per venture, because one box per venture', () => {
    expect(officeSecretEnvName('the-reset')).toBe('OFFICE_SECRET_THE_RESET');
  });
});
