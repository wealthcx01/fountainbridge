import HandbookIndex from '@/app/handbook/page';

/**
 * The handbook, inside a venture (FB-124).
 *
 * The rail lists it, so it has to live under `/venture/[id]` to render inside the shell — a layout
 * only wraps its own subtree. The content is unchanged and deliberately NOT per-venture: the method
 * is one method across every venture, and a per-venture copy is per-venture drift. See FB-134, which
 * settles that against the design's phrasing.
 */
export default HandbookIndex;
