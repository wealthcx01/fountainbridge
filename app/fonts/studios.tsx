import localFont from 'next/font/local';

/**
 * The Bruntsfield Studios typefaces (FB-274): Newsreader for headings and Instrument Sans for text,
 * as the "Studios, aligned" design draws them. IBM Plex Mono is already the studio's own.
 *
 * Served from this repository like the studio's other faces (FB-223 in `app/layout.tsx` says why:
 * a build must not reach Google). Both are the latin files Google serves, under the SIL Open Font
 * Licence. Only screens drawn in the new design system use them: they are named on `.bs-root`, and
 * nothing else asks for them.
 */
const newsreader = localFont({
  src: [{ path: './newsreader-latin.woff2', style: 'normal' }],
  weight: '300 500',
  display: 'swap',
  variable: '--font-newsreader',
});
const instrumentSans = localFont({
  src: [{ path: './instrument-sans-latin.woff2', style: 'normal' }],
  weight: '400 600',
  display: 'swap',
  variable: '--font-instrument-sans',
});

/** Put on the element that carries `bs-root`, so the design system's font tokens can name them. */
export const studiosFonts = `${newsreader.variable} ${instrumentSans.variable}`;
