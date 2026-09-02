/**
 * The colours the operating system reads (FB-141).
 *
 * ## Why raw hex lives here and nowhere else
 *
 * Every colour in the studio is a `--color-*` token, and `design-lint` enforces it. Two surfaces
 * cannot obey that rule: the web app manifest and the `theme-color` meta tag are consumed by iOS and
 * Android, not by CSS, so they cannot reference a custom property — they need a literal.
 *
 * Rather than scatter literals across `app/manifest.ts` and `app/layout.tsx`, they live here, and
 * `lib/__tests__/brand.test.ts` reads `app/globals.css` and asserts these still equal the tokens
 * they are copies of. That is the same treatment `lib/readiness.ts` gets for the environment variable
 * name it duplicates: the duplication is unavoidable, so the drift is what gets tested.
 *
 * `design-lint` exempts this file by name, for the same reason it exempts `globals.css` — it is a
 * declared source of values, not a component inventing them.
 */

/** `--color-accent`. The installed app's status bar and splash. */
export const THEME_COLOR = '#1a3b26';

/** `--color-paper`. The splash screen behind the icon, so it matches the studio it opens into. */
export const BACKGROUND_COLOR = '#f7f6f2';
