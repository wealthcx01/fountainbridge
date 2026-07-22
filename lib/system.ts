/**
 * "How the Foundry works" loader (FB-017). Reads `content/system/*.md` — our own plain-language
 * explanations of the real machinery (lanes, tickets, gstack, gbrain, ActiveGraph, the approval
 * matrix) — into ordered sections for the (private, FB-015) /how-it-works pages. Thin wrapper over
 * the shared content loader (lib/content). Add a new component page by dropping a markdown file in.
 */

import { join } from 'node:path';
import { loadContentSections, type ContentSection } from './content';

export type SystemSection = ContentSection;

const DEFAULT_DIR = join(process.cwd(), 'content', 'system');

/** Load every system section, ordered by `order`. */
export function loadSystem(dir: string = DEFAULT_DIR): SystemSection[] {
  return loadContentSections(dir);
}

/** One section by slug (or null). */
export function getSystemSection(slug: string, dir: string = DEFAULT_DIR): SystemSection | null {
  return loadSystem(dir).find((s) => s.slug === slug) ?? null;
}
