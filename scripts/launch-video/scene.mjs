/**
 * The launch video's scene, as a pure function of time (FB-233).
 *
 * Adapted from `launch-video` and `renderer` in `dzhng/skills` (MIT). Theirs assumes Blender and a
 * GPU; this box has neither, and the substitution is an improvement rather than a compromise —
 * `renderer`'s own rule is that every asset must be reproducible from code rather than hand-edited,
 * and an SVG drawn from numbers is more reproducible than a `.blend` file, not less.
 *
 * ## Why this piece could not belong to another venture
 *
 * `launch-video`'s bar is that **if the piece could be re-skinned for another project, it has
 * failed**. So this one is built from the one rule ARCA's own brand document states most plainly:
 *
 *   > Gold is a signal, not a decoration. If gold shows up, it means ARCA has proven something about
 *   > that row of data.  — docs/brand/design-rationale.md
 *
 * So the video **enacts that rule**. It runs in near-black and warm parchment with no gold at all,
 * while the data accumulates and the score climbs. Gold arrives on one frame — the frame the score
 * crosses 80 and the holding is proven — and nowhere before it. Re-skinned for a venture with no
 * score and no threshold, the whole structure would be meaningless, which is the test passing.
 *
 * The mark drawn at the end is ARCA's own, copied from `client/src/components/ui/Logo.tsx`: a
 * graded-slab frame around an ascending bar read, crossed by a trendline that dips then breaks
 * upward. Its own comment calls that "the alpha signal ARCA's data pipeline is built to find", so
 * the film is that sentence and the mark is its last frame.
 *
 * ## Why a pure function
 *
 * `scene(t)` returns SVG for one instant and touches nothing. The renderer screenshots it, the tests
 * read it, and neither needs the other. A timing bug is then a thing you can assert about rather
 * than something you watch for.
 */

/** ARCA's palette, from docs/brand/design-rationale.md. Not approximations — the stated values. */
export const BRAND = {
  ground: '#0a0a0a',      // Diamond, near-black. "a serious instrument, not a consumer dashboard"
  text: '#eae6da',        // warm parchment
  gold: '#c9a860',        // antique gold — the signal, used once
  muted: '#6b6559',
  grid: '#1b1b1b',
  negative: '#8a4a3a',
};

/**
 * The typefaces, by the names `render.mjs` registers them under.
 *
 * Named constants rather than inline strings because the first render silently fell back: the scene
 * asked for Georgia, this machine has no serif installed at all, and Chromium quietly drew the whole
 * film in its default sans. Nothing errored and the frames looked plausible — the exact silent-
 * fallback failure this repository has been caught by before.
 *
 * These are the Bruntsfield design-system faces the repo already ships in `app/fonts/`, so the film
 * is set in the same type as the studio rather than in whatever a renderer happened to have.
 */
export const TYPE = {
  display: "'Source Serif 4', serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

export const FPS = 24;
export const WIDTH = 1280;
export const HEIGHT = 720;

/**
 * The beats, in seconds. Named rather than inlined so the tests can assert the one that matters:
 * gold does not exist before `proven`.
 */
export const BEATS = {
  open: 0,
  data: 1.2,       // rows of real figures begin to land
  scoring: 4.6,    // the score starts to climb
  proven: 8.2,     // it crosses 80 — the first gold frame in the film
  mark: 10.4,      // the brand mark resolves
  end: 13.5,
};

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** Smooth in and out. Linear motion reads as a slideshow; this reads as a machine settling. */
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t, from, to) => ease(clamp((t - from) / (to - from)));

/**
 * The score at time t: climbs, stalls one short of the threshold, then crosses.
 *
 * **It cannot reach 80 before `BEATS.proven`**, and that is the whole mechanism of the film rather
 * than a detail of the easing. The first draft shaped a curve towards 82 and let it arrive at 81 two
 * tenths early — so gold appeared before the beat that is supposed to introduce it, and the piece
 * quietly stopped making its own argument. Found by asserting it rather than by watching.
 *
 * Stalling at 79 is also the truer picture: the brand document's claim is that the top tier is
 * EARNED, and a number that sails through the threshold says the opposite.
 */
export function scoreAt(t) {
  if (t < BEATS.scoring) return 0;
  if (t < BEATS.proven) {
    const p = clamp((t - BEATS.scoring) / (BEATS.proven - BEATS.scoring));
    return Math.round(ease(p) * 79);
  }
  return 80 + Math.round(clamp((t - BEATS.proven) / 0.6) * 2);
}

/** True only once the score has crossed. The single switch that lets gold into the film. */
export const isProven = (t) => scoreAt(t) >= 80;

/** Real-shaped figures for the ledger. Deterministic, so every render is identical. */
const ROWS = [
  { ref: 'PSA 10', name: 'Charizard · Base Set', v: '£14,820', d: '+6.4%' },
  { ref: 'PSA 9', name: 'Blastoise · Base Set', v: '£3,110', d: '+2.1%' },
  { ref: 'CGC 9.5', name: 'Venusaur · Base Set', v: '£2,740', d: '−0.8%' },
  { ref: 'PSA 10', name: 'Pikachu · Illustrator', v: '£—', d: 'no comp' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** ARCA's own mark, from client/src/components/ui/Logo.tsx. `draw` reveals the trendline. */
function mark(x, y, size, colour, draw) {
  const s = size / 32;
  // The trendline is ~24 units long; dashoffset walks it so the line is drawn rather than faded in.
  const len = 26;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${colour}" stroke="${colour}">
    <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="none" stroke-opacity="0.35" stroke-width="1.5"/>
    <rect x="8" y="18" width="3.4" height="7" rx="0.6" stroke="none"/>
    <rect x="14.3" y="13.5" width="3.4" height="11.5" rx="0.6" stroke="none"/>
    <rect x="20.6" y="9" width="3.4" height="16" rx="0.6" stroke="none"/>
    <path d="M7 16.5 L14 20 L22.3 7.5" fill="none" stroke-width="1.6" stroke-linecap="round"
          stroke-linejoin="round" opacity="0.9"
          stroke-dasharray="${len}" stroke-dashoffset="${(1 - draw) * len}"/>
    <circle cx="22.3" cy="7.5" r="1.6" stroke="none" opacity="${draw > 0.98 ? 1 : 0}"/>
  </g>`;
}

/**
 * One frame, as SVG.
 *
 * Flat fills only and no gradients anywhere, because the brand document rules both out by name.
 */
export function scene(t) {
  const parts = [];
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${BRAND.ground}"/>`);

  // A faint terminal rule, so the ground reads as an instrument rather than a void.
  const gridIn = seg(t, BEATS.open, BEATS.data) * 0.5;
  for (let i = 1; i < 6; i++) {
    parts.push(`<line x1="96" y1="${110 + i * 78}" x2="${WIDTH - 96}" y2="${110 + i * 78}" stroke="${BRAND.grid}" stroke-width="1" opacity="${gridIn}"/>`);
  }

  // The eyebrow. ARCA's own words about itself, not copy invented for a film.
  const eyebrowIn = seg(t, 0.2, 1.4);
  parts.push(`<text x="96" y="92" fill="${BRAND.muted}" opacity="${eyebrowIn}"
    font-family="${TYPE.mono}" font-size="17" letter-spacing="3.5">ARCA · GRADED CARD INTELLIGENCE</text>`);

  // The ledger. Rows land one at a time; every figure is parchment, never gold.
  ROWS.forEach((row, i) => {
    const at = BEATS.data + i * 0.52;
    const o = seg(t, at, at + 0.5);
    if (o <= 0.001) return;
    const y = 196 + i * 78;
    const slide = (1 - o) * 14;
    parts.push(`<g opacity="${o}" transform="translate(${slide},0)">
      <text x="96" y="${y}" fill="${BRAND.muted}" font-family="${TYPE.mono}" font-size="16" letter-spacing="1.5">${esc(row.ref)}</text>
      <text x="232" y="${y}" fill="${BRAND.text}" font-family="${TYPE.display}" font-size="25">${esc(row.name)}</text>
      <text x="${WIDTH - 300}" y="${y}" fill="${BRAND.text}" font-family="${TYPE.mono}" font-size="23" text-anchor="end">${esc(row.v)}</text>
      <text x="${WIDTH - 96}" y="${y}" fill="${row.d.startsWith('−') ? BRAND.negative : BRAND.muted}" font-family="${TYPE.mono}" font-size="17" text-anchor="end">${esc(row.d)}</text>
    </g>`);
  });

  // The score. Parchment while it climbs; gold only once it has crossed.
  if (t >= BEATS.scoring - 0.3) {
    const o = seg(t, BEATS.scoring - 0.3, BEATS.scoring + 0.4);
    const n = scoreAt(t);
    const proven = isProven(t);
    const colour = proven ? BRAND.gold : BRAND.text;
    const pop = proven ? 1 + (1 - seg(t, BEATS.proven, BEATS.proven + 0.45)) * 0.07 : 1;
    parts.push(`<g opacity="${o}" transform="translate(96,560) scale(${pop})">
      <text x="0" y="0" fill="${BRAND.muted}" font-family="${TYPE.mono}" font-size="15" letter-spacing="3">ARCA SCORE</text>
      <text x="0" y="62" fill="${colour}" font-family="${TYPE.display}" font-size="74">${n}</text>
    </g>`);
    if (proven) {
      const bo = seg(t, BEATS.proven, BEATS.proven + 0.5);
      parts.push(`<g opacity="${bo}" transform="translate(250,560)">
        <rect x="0" y="12" width="128" height="40" rx="5" fill="none" stroke="${BRAND.gold}" stroke-width="1.4"/>
        <text x="64" y="39" fill="${BRAND.gold}" font-family="${TYPE.mono}" font-size="15"
              letter-spacing="2.5" text-anchor="middle">STRONG</text>
      </g>`);
    }
  }

  // The line that says why the gold is there. ARCA's own rule, quoted.
  const lineIn = seg(t, BEATS.proven + 0.7, BEATS.proven + 1.6);
  if (lineIn > 0.001) {
    parts.push(`<text x="96" y="672" fill="${BRAND.muted}" opacity="${lineIn}"
      font-family="${TYPE.display}" font-size="22" font-style="italic">Gold is a signal, not a decoration.</text>`);
  }

  // The mark, drawn rather than faded, and the wordmark.
  const markIn = seg(t, BEATS.mark, BEATS.mark + 1.1);
  if (markIn > 0.001) {
    parts.push(mark(WIDTH - 300, 520, 96, BRAND.gold, markIn));
    const w = seg(t, BEATS.mark + 0.5, BEATS.mark + 1.3);
    parts.push(`<text x="${WIDTH - 180}" y="596" fill="${BRAND.text}" opacity="${w}"
      font-family="${TYPE.display}" font-size="52" letter-spacing="2">ARCA</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('')}</svg>`;
}

export const totalFrames = () => Math.round(BEATS.end * FPS);
