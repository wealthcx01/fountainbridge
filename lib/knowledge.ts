/**
 * What the venture has been given (FB-106).
 *
 * John: *"nothing that allows the founder to see what docs have been uploaded either to the composer
 * or the studio?"*
 *
 * Documents go in through the composer, land in the venture's `context/` and `library/` on git
 * (FB-078/FB-084) — and then vanish from the founder's view. The corpus is real and growing; the
 * walkthrough's own brand-positioning note is in there. The only way to see it was GitHub, which is
 * the product this studio exists to replace.
 *
 * Uploading into something you cannot then look at is posting into a void, and a founder who feels
 * that stops uploading — which quietly starves the thing that makes next month's work better.
 *
 * ## The shape on disk (D8)
 *
 *   context/<department>/<slug>.md    durable background — decisions, positioning, constraints
 *   library/<department>/<slug>.md    artifacts and outputs
 *
 * Pure, with the read injected, like every other read model — so the UI gate runs offline.
 */

export type KnowledgeArea = 'context' | 'library';

export interface KnowledgeDoc {
  /** Full repo path, and the identity of the document. */
  path: string;
  area: KnowledgeArea;
  /** The surface it was filed under. `general` when it was deposited without one. */
  department: string;
  /** The document's own title if it states one, else a readable form of its filename. */
  title: string;
  /** Bytes on disk — the honest size, whatever the studio can render of it. */
  bytes: number;
  /** The text, when the studio could read it. Null for something it cannot show as prose. */
  text: string | null;
}

export interface KnowledgeCorpus {
  docs: KnowledgeDoc[];
  /** Non-null when the read failed — never rendered as "you have given it nothing" (FB-021). */
  error: string | null;
}

/** One repo's corpus. Injected, so tests and the UI gate never reach the network. */
export type KnowledgeSource = (repo: string) => Promise<KnowledgeCorpus>;

/**
 * A readable title.
 *
 * The document's own first heading when it has one — a founder named it, and that name is better
 * than anything derived. Otherwise the filename, de-slugged: `brand-positioning.md` reads as "Brand
 * positioning", which is what they called it when they uploaded it anyway.
 */
export function titleOf(path: string, text: string | null): string {
  const heading = text?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const base = (path.split('/').pop() ?? path).replace(/\.[a-z0-9]+$/i, '');
  const words = base.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

/** `context/sell/brand-positioning.md` → area `context`, department `sell`. */
export function placeOf(path: string): { area: KnowledgeArea; department: string } | null {
  const m = path.match(/^(context|library)\/(?:([^/]+)\/)?[^/]+$/);
  if (!m) return null;
  return { area: m[1] as KnowledgeArea, department: m[2] ?? 'general' };
}

/** Build one document from a path and whatever text the read produced. */
export function toDoc(path: string, text: string | null, bytes: number): KnowledgeDoc | null {
  const place = placeOf(path);
  if (!place) return null;
  return { path, area: place.area, department: place.department, title: titleOf(path, text), bytes, text };
}

/**
 * Group for display: by area, then department, then title.
 *
 * Grouped rather than one long list because the two areas mean different things — background the
 * team reads before it works, and artifacts it produced or was handed — and a founder scanning for
 * "did my price list land?" is looking inside one of them, not both.
 */
export function byArea(docs: readonly KnowledgeDoc[]): Array<{ area: KnowledgeArea; docs: KnowledgeDoc[] }> {
  const order: KnowledgeArea[] = ['context', 'library'];
  return order
    .map((area) => ({
      area,
      docs: docs
        .filter((d) => d.area === area)
        .sort((a, b) => a.department.localeCompare(b.department) || a.title.localeCompare(b.title)),
    }))
    .filter((g) => g.docs.length > 0);
}

/** What each area is for, in the founder's words — shown as the section's own explanation. */
export const AREA_LABEL: Record<KnowledgeArea, string> = {
  context: 'Background your team reads before it works',
  library: 'Things your venture has produced or been handed',
};

/** "12 KB" / "1.2 MB" — a size a person can judge, not a byte count. */
export function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
