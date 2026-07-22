/**
 * Foundry Playbook loader (FB-013). Reads `content/playbook/*.md` — our own educational content
 * (git = source of truth) — into ordered sections for the (private, FB-015) /playbook pages. Thin
 * wrapper over the shared content loader (lib/content).
 */

import { join } from 'node:path';
import { loadContentSections, type ContentSection } from './content';

export type PlaybookSection = ContentSection;

const DEFAULT_DIR = join(process.cwd(), 'content', 'playbook');

/** Load every playbook section, ordered by `order`. */
export function loadPlaybook(dir: string = DEFAULT_DIR): PlaybookSection[] {
  return loadContentSections(dir);
}

/** One section by slug (or null). */
export function getPlaybookSection(slug: string, dir: string = DEFAULT_DIR): PlaybookSection | null {
  return loadPlaybook(dir).find((s) => s.slug === slug) ?? null;
}
