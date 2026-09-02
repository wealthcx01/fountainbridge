import type { MetadataRoute } from 'next';
import { BACKGROUND_COLOR, THEME_COLOR } from '@/lib/brand';

/**
 * The pocket studio, installable (FB-141).
 *
 * The design's screen 11 is a studio a founder keeps open all day; a browser tab is not that. This is
 * the manifest that lets it live on a home screen — and on iOS it is also the gate for anything else:
 * Safari will not accept a push subscription at all until a PWA has been added to the home screen.
 *
 * ## `display: standalone`, not `fullscreen`
 *
 * Standalone keeps the system status bar. A founder deciding whether to approve something should be
 * able to see the time and their battery; taking the whole screen for a studio is the kind of
 * confidence a tool has not earned.
 *
 * ## `start_url` is the ventures root, not a venture
 *
 * The studio is venture-scoped server-side, and a founder with one venture is redirected into it
 * (FB-066). Hard-coding a venture into an installed icon would put one venture's id on a device that
 * might later belong to a founder of another (CLAUDE.md #6 — isolation is decided by the session, and
 * an icon is not a session).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bruntsfield Foundry Studio',
    short_name: 'Foundry',
    description: 'Launch and run your venture: what waits on you, what your team is doing, and one place to ask.',
    start_url: '/',
    display: 'standalone',
    // The studio's own paper and ink, so the splash and the status bar match the screen behind them.
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops to a circle. `maskable` tells it the mark is inside the safe zone, so it is
      // not clipped — the icons are generated with that padding (scripts/make-icons.mjs).
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
