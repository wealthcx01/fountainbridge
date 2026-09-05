import { describe, it, expect } from 'vitest';
import {
  mintOfficeToken, readOfficeToken, officeEndpoint, officeConfigured,
  officeSecretEnvName, officeHostEnvName, officeMessageAllowed, OFFICE_TOKEN_TTL_MS, OFFICE_TOKEN_STEP_MS,
  rewriteOfficeCss, rewriteOfficeHtml, OFFICE_CHROME_HIDDEN,
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

describe('the office is addressed through the studio (FB-192)', () => {
  const T = 'arca.123.sig';

  it('gives the stylesheet a token, so the font is not refused', () => {
    // Untokened, the route falls to the session check, the frame has no cookie, and the answer is
    // 401 — which the browser reports as a CORS failure and which left the whole office drawn in
    // the browser's fallback sans-serif.
    const css = '@font-face{src:url(../fonts/FSPixelSansUnicode-Regular.ttf)}';
    expect(rewriteOfficeCss(css, 'arca', T)).toBe(
      '@font-face{src:url("/venture/arca/office/fonts/FSPixelSansUnicode-Regular.ttf?token=arca.123.sig")}',
    );
  });

  it('leaves data and absolute URLs in CSS alone', () => {
    for (const ref of ['data:font/ttf;base64,AAA', 'https://example.test/a.png', '//example.test/b.png']) {
      const css = `a{background:url(${ref})}`;
      expect(rewriteOfficeCss(css, 'arca', T)).toBe(css);
    }
  });

  it('does not rewrite its own output', () => {
    // The relative rewrite produces root-relative URLs, and running the two in the wrong order
    // rewrote them a second time: every asset came out addressed
    // `/venture/arca/office/venture/arca/office/assets/…` and the frame loaded nothing.
    const html = '<head><link href="./assets/x.css"><script src="./assets/y.js"></script></head>';
    const out = rewriteOfficeHtml(html, 'arca', T);
    expect(out).toContain('href="/venture/arca/office/assets/x.css?token=arca.123.sig"');
    expect(out).toContain('src="/venture/arca/office/assets/y.js?token=arca.123.sig"');
    expect(out).not.toContain('office/venture');
  });

  it('points the favicon at the office rather than at the studio root', () => {
    const out = rewriteOfficeHtml('<head><link href="/vite.svg"></head>', 'arca', T);
    expect(out).toContain('href="/venture/arca/office/vite.svg?token=arca.123.sig"');
  });

  it('hides the extension chrome a founder cannot use', () => {
    const out = rewriteOfficeHtml('<head></head>', 'arca', T);
    expect(out).toContain('data-foundry="office-chrome"');
    for (const selector of OFFICE_CHROME_HIDDEN) expect(out).toContain(selector);
    expect(out).toContain('display:none !important');
  });

  it('keeps the chrome list to what was actually seen on the pinned version', () => {
    // Zoom, Layout and Settings, the "what's new" card, and the version watermark. If a version bump
    // moves any of them this list is what has to be re-checked — so it is asserted, not assumed.
    expect([...OFFICE_CHROME_HIDDEN]).toEqual([
      '.absolute.top-8.left-8',
      '.absolute.bottom-10.left-10',
      '.absolute.bottom-42.right-28',
      '.absolute.bottom-8.right-28',
    ]);
  });
});
