import { describe, it, expect } from 'vitest';
import { createPublicKey, verify, generateKeyPairSync } from 'node:crypto';
import { encryptForSubscription, vapidHeaders, isPushEndpoint, sendWebPush, b64url, type PushTarget } from '../webpush';

/**
 * Web Push, checked against the standard's own worked example (FB-141).
 *
 * A round trip through an encrypt and a decrypt that I both wrote would pass if both were wrong in
 * the same way. RFC 8291 Appendix A publishes every input and the exact bytes that must come out, so
 * this test reproduces that example and compares byte for byte. If any step — the key derivation, the
 * nonce, the header layout, the record delimiter — is off by one bit, this fails.
 */
const RFC_8291 = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  expected:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

const rfcTarget: PushTarget = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: RFC_8291.uaPublic, auth: RFC_8291.auth },
};

describe('encrypting a push for one phone', () => {
  it('reproduces RFC 8291’s worked example exactly', () => {
    const out = encryptForSubscription(Buffer.from(RFC_8291.plaintext), rfcTarget, {
      salt: b64url.decode(RFC_8291.salt),
      senderPrivateKey: b64url.decode(RFC_8291.asPrivate),
    });
    expect(b64url.encode(out)).toBe(RFC_8291.expected);
  });

  it('uses a fresh salt and key every time, so two messages never look alike', () => {
    const a = encryptForSubscription(Buffer.from('same'), rfcTarget);
    const b = encryptForSubscription(Buffer.from('same'), rfcTarget);
    expect(a.equals(b)).toBe(false);
  });

  it('refuses a subscription whose keys are not real keys', () => {
    expect(() => encryptForSubscription(Buffer.from('x'), { ...rfcTarget, keys: { p256dh: 'AAAA', auth: RFC_8291.auth } }))
      .toThrow(/public key/);
  });
});

/** A real P-256 key pair in the base64url shape the environment holds. */
function vapidPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), b64url.decode(pub.x!), b64url.decode(pub.y!)]);
  return { publicKey: b64url.encode(raw), privateKey: priv.d!, subject: 'mailto:studio@bruntsfield.capital', jwk: pub };
}

describe('proving the push is from us (VAPID)', () => {
  it('signs a token the public key verifies, addressed to that push service only', () => {
    const keys = vapidPair();
    const { Authorization } = vapidHeaders('https://web.push.apple.com/QGuQ', keys, 1_800_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(Authorization);
    expect(m).not.toBeNull();
    const [, head, claims, sig, k] = m!;
    expect(k).toBe(keys.publicKey);
    expect(JSON.parse(b64url.decode(claims).toString())).toEqual({
      aud: 'https://web.push.apple.com',
      exp: 1_800_000_000 + 12 * 3600,
      sub: 'mailto:studio@bruntsfield.capital',
    });
    const ok = verify('sha256', Buffer.from(`${head}.${claims}`),
      { key: createPublicKey({ key: keys.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, b64url.decode(sig));
    expect(ok).toBe(true);
  });
});

describe('where the studio is willing to send', () => {
  it('accepts the push services real browsers use', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/dXk')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QGuQ')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/gAAA')).toBe(true);
  });

  it('refuses anything else, so a subscription cannot point the server at its own network', () => {
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/x', // not TLS
      'https://169.254.169.254/latest/meta-data',
      'https://localhost:3000/api',
      'https://fcm.googleapis.com.evil.test/x', // a look-alike
      'https://fcm.googleapis.com:8443/x',
      'https://user@fcm.googleapis.com/x',
      'not a url',
    ]) expect(isPushEndpoint(bad), bad).toBe(false);
  });
});

describe('sending', () => {
  const keys = vapidPair();
  const target = { ...rfcTarget, endpoint: 'https://fcm.googleapis.com/fcm/send/abc' };

  it('posts an encrypted body with the headers a push service requires', async () => {
    let seen: { url: string; headers: Record<string, string>; body: Uint8Array } | null = null;
    const out = await sendWebPush(target, { title: 'ARCA needs you' }, keys, {
      post: async (url, init) => { seen = { url, headers: init.headers, body: init.body }; return { status: 201 }; },
    });
    expect(out).toBe('sent');
    expect(seen!.url).toBe(target.endpoint);
    expect(seen!.headers['Content-Encoding']).toBe('aes128gcm');
    expect(seen!.headers.TTL).toBe('86400');
    // Encrypted: the words are not in the body anywhere.
    expect(Buffer.from(seen!.body).toString('latin1')).not.toContain('ARCA');
  });

  it('reports a phone that has gone, so its row can be removed', async () => {
    expect(await sendWebPush(target, {}, keys, { post: async () => ({ status: 410 }) })).toBe('gone');
    expect(await sendWebPush(target, {}, keys, { post: async () => ({ status: 404 }) })).toBe('gone');
    expect(await sendWebPush(target, {}, keys, { post: async () => ({ status: 500 }) })).toBe('failed');
  });

  it('never posts to an endpoint that is not a push service', async () => {
    let posted = false;
    const out = await sendWebPush({ ...target, endpoint: 'https://169.254.169.254/x' }, {}, keys, {
      post: async () => { posted = true; return { status: 201 }; },
    });
    expect(out).toBe('failed');
    expect(posted).toBe(false);
  });
});
