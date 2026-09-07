import { describe, it, expect } from 'vitest';
import {
  mintOfficeToken, readOfficeToken, officeEndpoint, officeConfigured,
  officeSecretEnvName, officeHostEnvName, officeMessageAllowed, OFFICE_TOKEN_TTL_MS, OFFICE_TOKEN_STEP_MS,
  officeWatchUrl, officeSocketUrl,
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
    // The expiry is measured from the start of the half hour the token was minted in (FB-192), so
    // it is good for at least the TTL and at most the TTL plus one step. Both ends are checked.
    const now = Date.now();
    const t = mintOfficeToken('arca', SECRET, now);
    expect(readOfficeToken(t, SECRET, now + OFFICE_TOKEN_TTL_MS - 1_000)?.ventureId).toBe('arca');
    expect(readOfficeToken(t, SECRET, now + OFFICE_TOKEN_TTL_MS + OFFICE_TOKEN_STEP_MS + 1_000)).toBeNull();
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

describe('the token does not change under a re-rendering page (FB-192)', () => {
  // The token goes in the iframe's URL. A token that changes changes the `src`, and a changed `src`
  // reloads the frame — which closes the office socket and redraws the room from nothing. The desk
  // re-renders itself once a minute while a venture is working, so before this the founder's office
  // reset every sixty seconds.
  const SECRET = 'not-for-production';

  it('mints the same token twice a minute apart', () => {
    const at = Date.UTC(2026, 8, 5, 10, 1, 0);
    expect(mintOfficeToken('arca', SECRET, at)).toBe(
      mintOfficeToken('arca', SECRET, at + 60_000),
    );
  });

  it('mints the same token across a whole half hour of renders', () => {
    const at = Date.UTC(2026, 8, 5, 10, 0, 0);
    const minted = new Set(
      Array.from({ length: 30 }, (_, minute) => mintOfficeToken('arca', SECRET, at + minute * 60_000)),
    );
    expect(minted.size).toBe(1);
  });

  it('is good for at least half an hour, wherever in the half hour it was minted', () => {
    // The worst case is a token minted at the very end of a bucket: it still has a full step left.
    for (const minute of [0, 15, 29]) {
      const at = Date.UTC(2026, 8, 5, 10, minute, 59);
      const token = mintOfficeToken('arca', SECRET, at);
      expect(readOfficeToken(token, SECRET, at + OFFICE_TOKEN_STEP_MS - 1_000)?.ventureId).toBe('arca');
      expect(readOfficeToken(token, SECRET, at + 2 * OFFICE_TOKEN_STEP_MS + OFFICE_TOKEN_TTL_MS)).toBeNull();
    }
  });

  it('still names one venture, and a token for another is not accepted', () => {
    const at = Date.UTC(2026, 8, 5, 10, 0, 0);
    const token = mintOfficeToken('arca', SECRET, at);
    expect(readOfficeToken(token, SECRET, at)?.ventureId).toBe('arca');
    expect(readOfficeToken(token, 'a-different-secret', at)).toBeNull();
  });
});



describe('where the browser watches the office (FB-198)', () => {
  const env = {
    OFFICE_HOST_ARCA: 'chat.arca.bruntsfield.capital',
    OFFICE_SECRET_ARCA: 'arca-office-secret',
  };
  const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

  it('sends the browser to the venture’s own box, not to the studio', () => {
    const url = officeWatchUrl('arca', env, NOW)!;
    expect(url.startsWith('https://chat.arca.bruntsfield.capital/office/?token=')).toBe(true);
  });

  it('sends the socket to the box’s root, because the office builds that address itself', () => {
    const url = officeSocketUrl('arca', env, NOW)!;
    expect(url.startsWith('wss://chat.arca.bruntsfield.capital/ws?token=')).toBe(true);
  });

  it('carries a ticket the box will accept for this venture', () => {
    const ticket = decodeURIComponent(officeWatchUrl('arca', env, NOW)!.split('token=')[1]);
    expect(readOfficeToken(ticket, env.OFFICE_SECRET_ARCA, NOW)).toEqual({ ventureId: 'arca' });
  });

  it('signs with the venture’s own office secret, never the studio’s approval secret', () => {
    // A venture box that was broken into must not be able to forge a grant (CLAUDE.md #4), so it
    // never learns the secret that signs one.
    const ticket = decodeURIComponent(officeWatchUrl('arca', env, NOW)!.split('token=')[1]);
    expect(readOfficeToken(ticket, 'the-studios-approval-secret', NOW)).toBeNull();
  });

  it('gives the page and the socket the same ticket, so one check answers for both', () => {
    const a = decodeURIComponent(officeWatchUrl('arca', env, NOW)!.split('token=')[1]);
    const b = decodeURIComponent(officeSocketUrl('arca', env, NOW)!.split('token=')[1]);
    expect(a).toBe(b);
  });

  it('offers nothing at all for a venture with no box', () => {
    expect(officeWatchUrl('sonder', env, NOW)).toBeNull();
    expect(officeSocketUrl('sonder', env, NOW)).toBeNull();
    // Half-wired is the same as not wired: a frame that can never connect is worse than the plate.
    expect(officeWatchUrl('arca', { OFFICE_HOST_ARCA: env.OFFICE_HOST_ARCA }, NOW)).toBeNull();
    expect(officeSocketUrl('arca', { OFFICE_SECRET_ARCA: env.OFFICE_SECRET_ARCA }, NOW)).toBeNull();
  });

  it('never puts the office secret in a URL', () => {
    for (const url of [officeWatchUrl('arca', env, NOW)!, officeSocketUrl('arca', env, NOW)!]) {
      expect(url).not.toContain(env.OFFICE_SECRET_ARCA);
    }
  });
});
