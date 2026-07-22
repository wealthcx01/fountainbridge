/**
 * Generic markdown-content loader (FB-016). Reads a `content/<dir>/*.md` folder — frontmatter
 * (slug/title/order/summary) + body — into ordered sections. Used by the Foundry story pages and
 * (via lib/playbook) the playbook. Server-only. Tolerant of a partial/malformed file: it's skipped,
 * never fatal.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export interface ContentSection {
  slug: string;
  title: string;
  order: number;
  summary: string;
  body: string;
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = (yaml.load(m[1]) as Record<string, unknown>) ?? {};
  return { data, body: m[2] };
}

/** Load every section under `dir`, ordered by `order`. */
export function loadContentSections(dir: string): ContentSection[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const sections: ContentSection[] = [];
  for (const file of files) {
    try {
      const { data, body } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
      if (typeof data.slug !== 'string' || !data.slug) continue;
      sections.push({
        slug: data.slug,
        title: typeof data.title === 'string' ? data.title : data.slug,
        order: typeof data.order === 'number' ? data.order : 999,
        summary: typeof data.summary === 'string' ? data.summary : '',
        body: body.trim(),
      });
    } catch {
      continue;
    }
  }
  return sections.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
