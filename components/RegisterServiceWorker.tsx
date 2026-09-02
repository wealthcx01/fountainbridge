'use client';

import { useEffect } from 'react';

/**
 * Registering the service worker (FB-141).
 *
 * A client component because registration is a browser call, and it does nothing else: no caching
 * strategy, no update prompt, no offline page. `public/sw.js` explains why it caches almost nothing.
 *
 * Silent on failure, deliberately. A founder who is not going to install the studio to their home
 * screen gains nothing from being told a service worker did not register, and every browser that
 * refuses one — private windows, some enterprise policies — is a browser where the studio works
 * perfectly well without it.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installability is a nicety; the studio is a website first. */
    });
  }, []);
  return null;
}
