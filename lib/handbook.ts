/**
 * Founder Handbook loader (FB-023). Reads `content/handbook/*.md` — the plain-English guidebook
 * (how to start / build / sell / scale, and how Bruntsfield works alongside the founder) — into
 * ordered chapters for the (private, FB-015) /handbook pages. Thin wrapper over the shared content
 * loader (lib/content), like lib/playbook. A new chapter is just a markdown file dropped in.
 */

import { join } from 'node:path';
import { loadContentSections, type ContentSection } from './content';

export type HandbookChapter = ContentSection;

const DEFAULT_DIR = join(process.cwd(), 'content', 'handbook');

/** Load every handbook chapter, ordered by `order`. */
export function loadHandbook(dir: string = DEFAULT_DIR): HandbookChapter[] {
  return loadContentSections(dir);
}

/** One chapter by slug (or null). */
export function getHandbookChapter(slug: string, dir: string = DEFAULT_DIR): HandbookChapter | null {
  return loadHandbook(dir).find((c) => c.slug === slug) ?? null;
}

/**
 * Minutes to read a chapter, at 200 words a minute (FB-134).
 *
 * The design's chapter grid shows one, and a founder deciding whether to open a chapter now or after
 * lunch is asking a real question. 200 wpm is the ordinary prose figure — not a measurement of this
 * reader, and the copy says "min read" rather than claiming a number about them.
 *
 * Markdown punctuation does not count as a word: a chapter of bullet lists would otherwise read as
 * longer than a chapter of paragraphs saying the same thing. Never zero — a chapter that exists
 * takes some reading, and "0 min read" reads as broken rather than as short.
 */
export function minutesToRead(body: string, wordsPerMinute = 200): number {
  const words = body.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}
