'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { subscribeToPush, unsubscribeFromPush } from '@/app/actions/push';
import { DECIDED_EVENT, PUSH_KEYS, PUSH_WORDS, pushOffer, type PushOffer } from '@/lib/push-offer';

/**
 * Asking a founder's phone whether it may buzz them, and turning it off again (FB-141).
 *
 * What it shows is decided by `pushOffer` (lib/push-offer.ts), which is pure and tested. This file is
 * the browser half: reading what the device can do, asking, and telling the studio's server.
 *
 * It draws nothing until a founder has decided something on this device. After that, a card at the
 * foot of the screen asks once. "Not now" is remembered here and the studio never asks again on this
 * device; the Tickets screen's "Needs you" list — where every buzz lands — keeps one quiet line for
 * turning it on or off.
 *
 * Failure is loud (CLAUDE.md #10): if the browser or the server refuses, the card says which, in a
 * sentence, and nothing pretends the phone will buzz.
 */
function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* a private window forgets; nothing breaks */ }
}

/** The public half of the studio's key, as the bytes `PushManager.subscribe` wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

interface Device {
  supported: boolean;
  permission: 'default' | 'granted' | 'denied';
  subscription: PushSubscription | null;
  ios: boolean;
  standalone: boolean;
}

async function readDevice(): Promise<Device> {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return { supported, permission: 'default', subscription: null, ios, standalone };
  let subscription: PushSubscription | null = null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    subscription = reg ? await reg.pushManager.getSubscription() : null;
  } catch { /* no registration yet: not subscribed */ }
  return { supported, permission: Notification.permission, subscription, ios, standalone };
}

export function PushSwitch({ ventureId, publicKey }: { ventureId: string; publicKey: string | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  // Where every buzz lands: Tickets, filtered to "Needs you" — which is also the screen's default.
  const onNeedsYou = /\/tickets$/.test(pathname ?? '') && (params?.get('filter') ?? 'needs') === 'needs';

  const [device, setDevice] = useState<Device | null>(null);
  const [decided, setDecided] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const d = await readDevice();
    setDevice(d);
    setDecided(read(PUSH_KEYS.decided) === '1');
    setDeclined(read(PUSH_KEYS.declined(ventureId)) === '1');
    setOn(Boolean(d.subscription) && read(PUSH_KEYS.on(ventureId)) === '1');
  }, [ventureId]);

  useEffect(() => {
    void refresh();
    const onDecided = () => { void refresh(); };
    window.addEventListener(DECIDED_EVENT, onDecided);
    return () => window.removeEventListener(DECIDED_EVENT, onDecided);
  }, [refresh]);

  if (!device) return null;
  const state: PushOffer = pushOffer({
    supported: device.supported,
    keyConfigured: Boolean(publicKey),
    permission: device.permission,
    subscribed: on,
    decided,
    declined,
    ios: device.ios,
    standalone: device.standalone,
    onNeedsYou,
  });
  if (state === 'none' && !message) return null;

  const notNow = () => {
    write(PUSH_KEYS.declined(ventureId), '1');
    setDeclined(true);
    setMessage(null);
  };

  const turnOn = () => startTransition(async () => {
    setMessage(null);
    if (!publicKey) return;
    try {
      // The browser's own prompt. Asked only here, on a press, after a decision.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(permission === 'denied'
          ? 'Your browser said no, so this device will not get notifications. You can change that in the browser’s settings.'
          : 'Nothing was turned on.');
        await refresh();
        return;
      }
      // `ready` never settles in a browser that refused to register the service worker (a private
      // window, some company policies). Without a limit the button would say "Asking your browser…"
      // for ever; with one, the founder is told nothing was turned on.
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('no service worker')), 10_000)),
      ]);
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const r = await subscribeToPush(ventureId, sub.toJSON());
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      write(PUSH_KEYS.on(ventureId), '1');
      write(PUSH_KEYS.declined(ventureId), null);
      await refresh();
    } catch {
      setMessage('This device would not set up notifications just now. Nothing was turned on. Try again in a minute.');
    }
  });

  const turnOff = () => startTransition(async () => {
    setMessage(null);
    // Remembered here first, so even if the server cannot be reached the studio never asks again on
    // this device — "turn it off" must stick whatever else happens.
    write(PUSH_KEYS.on(ventureId), null);
    write(PUSH_KEYS.declined(ventureId), '1');
    const endpoint = device.subscription?.endpoint;
    const r = await unsubscribeFromPush(ventureId, endpoint);
    if (!r.ok) setMessage(r.message);
    await refresh();
  });

  if (state === 'offer' || state === 'install-first') {
    const words = state === 'offer' ? PUSH_WORDS.offer : PUSH_WORDS.installFirst;
    return (
      <aside className="push-offer" data-testid="push-offer" aria-label="Notifications on this device">
        <p className="push-offer-title">{words.title}</p>
        <p className="push-offer-body">{words.body}</p>
        {message ? <p className="push-offer-error" role="alert" data-testid="push-message">{message}</p> : null}
        <p className="push-offer-actions">
          {state === 'offer' ? (
            <button type="button" className="btn btn-primary" data-testid="push-yes" disabled={pending} onClick={turnOn}>
              {pending ? 'Asking your browser…' : PUSH_WORDS.offer.yes}
            </button>
          ) : null}
          <button type="button" className="btn" data-testid="push-not-now" disabled={pending} onClick={notNow}>
            {words.no}
          </button>
        </p>
      </aside>
    );
  }

  return (
    <p className="push-line muted" data-testid={`push-${state}`}>
      {state === 'on' ? PUSH_WORDS.on.body : null}
      {state === 'off' ? PUSH_WORDS.off.body : null}
      {state === 'blocked' ? PUSH_WORDS.blocked.body : null}
      {state === 'on' ? (
        <button type="button" className="btn" data-testid="push-turn-off" disabled={pending} onClick={turnOff}>
          {PUSH_WORDS.on.off}
        </button>
      ) : null}
      {state === 'off' ? (
        <button type="button" className="btn" data-testid="push-turn-on" disabled={pending} onClick={turnOn}>
          {PUSH_WORDS.off.on}
        </button>
      ) : null}
      {message ? <span className="push-offer-error" role="alert" data-testid="push-message">{message}</span> : null}
    </p>
  );
}
