/**
 * Foundry Playbook loader (FB-013). Reads `content/playbook/*.md` — our own educational content
 * (git = source of truth) — into ordered sections for the public landing + /playbook pages. Server-
 * only (filesystem). Frontmatter is a small YAML block (slug/title/order/summary) above the body.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export interface PlaybookSection {
  slug: string;
  title: string;
  order: number;
  summary: string;
  body: string; // markdown after the frontmatter
}

const DEFAULT_DIR = join(process.cwd(), 'content', 'playbook');

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = (yaml.load(m[1]) as Record<string, unknown>) ?? {};
  return { data, body: m[2] };
}

/** Load every playbook section, ordered by `order`. A file missing a slug is skipped, not fatal. */
export function loadPlaybook(dir: string = DEFAULT_DIR): PlaybookSection[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const sections: PlaybookSection[] = [];
  for (const file of files) {
    const { data, body } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
    if (typeof data.slug !== 'string' || !data.slug) continue;
    sections.push({
      slug: data.slug,
      title: typeof data.title === 'string' ? data.title : data.slug,
      order: typeof data.order === 'number' ? data.order : 999,
      summary: typeof data.summary === 'string' ? data.summary : '',
      body: body.trim(),
    });
  }
  return sections.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

/** One section by slug (or null). */
export function getPlaybookSection(slug: string, dir: string = DEFAULT_DIR): PlaybookSection | null {
  return loadPlaybook(dir).find((s) => s.slug === slug) ?? null;
}
