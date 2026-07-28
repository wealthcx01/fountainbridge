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
