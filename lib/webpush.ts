import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';

/**
 * Sending a Web Push message, with nothing but Node's own crypto (FB-141).
 *
 * ## Why this is written here rather than installed
 *
 * The transport decision in FB-141 is Web Push with keys the studio holds, so that no notification
 * about a founder's venture passes through somebody else's service. The usual library for it pulls in
 * a tree of dependencies to do two things, both of which are short and both of which are published
 * standards with test vectors:
 *
 *   1. **Encrypt the message** for one phone (RFC 8291, `aes128gcm` from RFC 8188). Only that phone
 *      can read it. The push service in the middle — Apple's or Google's — carries bytes it cannot
 *      open.
 *   2. **Prove the message is from us** (RFC 8292, "VAPID"): a short token signed with our private key.
 *      The phone subscribed against our public key, and the push service refuses anything not signed
 *      by its other half.
 *
 * The encryption is pinned in `lib/__tests__/webpush.test.ts` against the RFC's own worked example,
 * byte for byte, which is a far stronger check than a round trip through code I also wrote.
 *
 * ## Where the keys live
 *
 * `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, as base64url, in the studio's deployment environment
 * (CLAUDE.md #8). Never in the repository. `VAPID_SUBJECT` is a `mailto:` the push services can use
 * to reach us if we misbehave.
 */

/** A phone's subscription, exactly as the browser's `PushSubscription.toJSON()` gives it. */
export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export const b64url = {
  encode: (b: Uint8Array): string => Buffer.from(b).toString('base64url'),
  decode: (s: string): Buffer => Buffer.from(s, 'base64url'),
};

const hmac = (key: Uint8Array, data: Uint8Array): Buffer => createHmac('sha256', key).update(data).digest();

/** HKDF for one block of output, which is all RFC 8291 ever asks for (16 or 32 bytes). */
function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Buffer {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

/** The one record size we write. A push message is a sentence, so it always fits in one record. */
const RECORD_SIZE = 4096;

/**
 * Encrypt a message for one subscription (RFC 8291 + RFC 8188 `aes128gcm`).
 *
 * `salt` and `senderPrivateKey` are parameters only so the RFC's example can be reproduced exactly.
 * In use both are fresh random values for every message — reusing them would let anyone who saw two
 * messages learn something about both.
 */
export function encryptForSubscription(
  plaintext: Uint8Array,
  target: PushTarget,
  fixed: { salt?: Uint8Array; senderPrivateKey?: Uint8Array } = {},
): Buffer {
  const uaPublic = b64url.decode(target.keys.p256dh);
  const authSecret = b64url.decode(target.keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('That subscription does not carry a usable public key.');
  if (authSecret.length !== 16) throw new Error('That subscription does not carry a usable auth secret.');

  const ecdh = createECDH('prime256v1');
  if (fixed.senderPrivateKey) ecdh.setPrivateKey(Buffer.from(fixed.senderPrivateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, shared, keyInfo, 32);

  const salt = fixed.salt ? Buffer.from(fixed.salt) : randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  // One record, so it carries the "last record" delimiter (0x02) and no padding.
  if (plaintext.length + 1 + 16 > RECORD_SIZE) throw new Error('A push message must be short.');
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

/**
 * The VAPID header pair for one push service (RFC 8292).
 *
 * The token names the push service's origin as its audience, so a token captured by one service
 * cannot be replayed at another, and it expires in twelve hours — the longest the RFC allows is a
 * day, and nothing here needs more.
 */
export function vapidHeaders(endpoint: string, keys: VapidKeys, nowSeconds: number): Record<string, string> {
  const pub = b64url.decode(keys.publicKey);
  const priv = b64url.decode(keys.privateKey);
  if (pub.length !== 65 || priv.length !== 32) throw new Error('The VAPID keys are not in the expected shape.');
  const key = createPrivateKey({
    key: {
      kty: 'EC', crv: 'P-256',
      x: b64url.encode(pub.subarray(1, 33)),
      y: b64url.encode(pub.subarray(33, 65)),
      d: b64url.encode(priv),
    },
    format: 'jwk',
  });
  const head = b64url.encode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url.encode(Buffer.from(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: nowSeconds + 12 * 60 * 60,
    sub: keys.subject,
  })));
  const signature = sign('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return { Authorization: `vapid t=${head}.${claims}.${b64url.encode(signature)}, k=${keys.publicKey}` };
}

/** The keys from the environment, or null when this studio has none — then nothing is offered. */
export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidKeys | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || 'mailto:studio@bruntsfield.capital' };
}

/**
 * The public key a phone subscribes with — or null, and then the studio never offers the buzz at all.
 *
 * Offered only when a push could really be sent: both keys are set, and there is a database to keep
 * the phone in. A founder who says yes to a buzz the studio cannot send has been told something
 * untrue (CLAUDE.md #10).
 */
export function pushPublicKey(env: Record<string, string | undefined> = process.env): string | null {
  // The UI gate's rig has no database, so without this the browser test could never see the card.
  // Gated on E2E_TEST_LOGIN as well as PUSH_FIXTURE, like every other fixture switch: production
  // never has E2E_TEST_LOGIN, so there the database rule above always holds. On the rig, pressing
  // "Turn on" still fails honestly, because there is nowhere to keep the phone.
  const rig = env.E2E_TEST_LOGIN === '1' && env.PUSH_FIXTURE === '1';
  if (!env.DATABASE_URL?.trim() && !rig) return null;
  return vapidFromEnv(env)?.publicKey ?? null;
}

/**
 * The push services a subscription may point at.
 *
 * The studio's server is about to POST to whatever URL a browser handed it. Unchecked, that is a way
 * to make the studio send requests anywhere — into its own network included. Every real browser
 * subscribes against one of these, so anything else is refused when it is saved and again when it is
 * used.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge and every Android browser built on them
  /^web\.push\.apple\.com$/, // Safari, and every iPhone
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows, sometimes
];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try { url = new URL(endpoint); } catch { return false; }
  return url.protocol === 'https:' && url.port === '' && !url.username && PUSH_HOSTS.some((h) => h.test(url.hostname));
}

/** What happened to one message. `gone` means the phone has unsubscribed and the row can go. */
export type PushOutcome = 'sent' | 'gone' | 'failed';

export type Poster = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: Uint8Array }) =>
  Promise<{ status: number }>;

/** Send one message to one phone. Never throws — one dead phone must not stop the next. */
export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
  keys: VapidKeys,
  opts: { post?: Poster; nowSeconds?: number } = {},
): Promise<PushOutcome> {
  if (!isPushEndpoint(target.endpoint)) return 'failed';
  // Never follows a redirect: the address was checked to be a push service, and a redirect would
  // take the studio's request somewhere that was not. Ten seconds, so one slow phone cannot hold up
  // the timer for every venture after it.
  const post: Poster = opts.post ?? (async (url, init) => fetch(url, {
    ...init,
    body: new Uint8Array(init.body),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  }));
  try {
    const body = encryptForSubscription(Buffer.from(JSON.stringify(payload)), target);
    const res = await post(target.endpoint, {
      method: 'POST',
      headers: {
        ...vapidHeaders(target.endpoint, keys, opts.nowSeconds ?? Math.floor(Date.now() / 1000)),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        // A day. A founder whose phone is off overnight should still hear about it in the morning;
        // one who has been away for a week does not need a stale buzz.
        TTL: String(24 * 60 * 60),
        Urgency: 'high',
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.status >= 200 && res.status < 300 ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
