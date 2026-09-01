import { toneColor, type Tone } from '@/lib/status';
import type { DeskState } from '@/lib/office';

/**
 * One agent at one desk (FB-139).
 *
 * Pixel art, drawn as a grid of 1-unit rects in a 16×16 viewBox and scaled by the container — so it
 * is crisp at any size, carries no asset, and costs one inline SVG. `shape-rendering: crispEdges`
 * keeps the pixels square rather than letting the browser smooth them into mush.
 *
 * ## Four poses, and each one is a fact
 *
 * - **working** — head down at the desk, arms out.
 * - **waiting-on-you** — the raised hand. The design's own signal, and it means the same thing the
 *   blocker banner counts, not "busy".
 * - **idle** — seated, still, hands down. Nothing on.
 * - **not-live** — an empty chair. The machine is not reporting, so there is nobody to draw. A
 *   figure sitting still here would read as an idle agent, which is the most convincing possible
 *   lie about a box that has stopped.
 *
 * `aria-hidden` throughout: every one of these states is written in words beside it, in the ledger,
 * which is the half a screen-reader user gets. A picture is the feeling; the ledger is the record.
 */

const TONE: Record<DeskState, Tone> = {
  working: 'working',
  'waiting-on-you': 'attention',
  idle: 'idle',
  'not-live': 'idle',
};

/** x, y, w, h — the pixels that differ between poses. The desk and chair are shared. */
const ARMS: Record<DeskState, Array<[number, number, number, number]>> = {
  // Both arms forward onto the desk.
  working: [[4, 8, 2, 1], [10, 8, 2, 1]],
  // One arm up. The whole point of the plate.
  'waiting-on-you': [[4, 8, 2, 1], [10, 4, 2, 4]],
  // Arms down at the sides.
  idle: [[4, 8, 1, 2], [11, 8, 1, 2]],
  'not-live': [],
};

export function PixelAgent({ state, size = 48 }: { state: DeskState; size?: number }) {
  const ink = toneColor(TONE[state]);
  const empty = state === 'not-live';
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      data-testid={`pixel-agent-${state}`}
    >
      {/* The desk, always. An office is still an office when nobody is at it. */}
      <rect x="2" y="10" width="12" height="1" fill="var(--color-border-strong)" />
      <rect x="3" y="11" width="1" height="3" fill="var(--color-border-strong)" />
      <rect x="12" y="11" width="1" height="3" fill="var(--color-border-strong)" />

      {empty ? null : (
        <>
          {/* head */}
          <rect x="6" y="2" width="4" height="4" fill={ink} />
          {/* body */}
          <rect x="5" y="6" width="6" height="4" fill={ink} />
          {ARMS[state].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} fill={ink} />
          ))}
        </>
      )}
    </svg>
  );
}
