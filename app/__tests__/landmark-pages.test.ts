import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ALL_CHECKED } from '@/e2e/landmark-pages';

/**
 * FB-168 — the landmark check in e2e/landmarks.spec.ts counts the main regions on a list of pages
 * that is written out by hand. A list like that goes stale quietly: a new page is added, nobody
 * remembers the list, and the new page is never counted. This test reads every page the app has
 * (each `page.tsx` under app/) and fails, naming the page, if the list opens none of them.
 */

const APP = join(process.cwd(), 'app');

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'api') return [];
    if (statSync(full).isDirectory()) return pageFiles(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

/** `app/venture/[id]/tickets/page.tsx` → `/venture/[id]/tickets`. */
function routeOf(file: string): string {
  const dir = relative(APP, file).split(sep).slice(0, -1);
  return '/' + dir.join('/');
}

/** A route with each `[segment]` part standing for any one path segment. */
function matcher(route: string): RegExp {
  const parts = route.split('/').map((part) => (/^\[.+\]$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|\\]/g, '\\$&')));
  return new RegExp(`^${parts.join('/')}$`);
}

const routes = pageFiles(APP).map(routeOf);
const checked = ALL_CHECKED.map((p) => p.split('?')[0]);

describe('the landmark check opens every page the studio has', () => {
  it('finds the pages to compare against', () => {
    // A walk that found nothing would make the next test pass on an empty list.
    expect(routes).toContain('/venture/[id]/tickets');
    expect(routes.length).toBeGreaterThan(20);
  });

  it('opens at least one path for every page', () => {
    const missed = routes.filter((r) => !checked.some((p) => matcher(r).test(p)));
    expect(missed, `pages the landmark check never opens: ${missed.join(', ')}`).toEqual([]);
  });

  it('opens no path that is not a page', () => {
    const stray = checked.filter((p) => !routes.some((r) => matcher(r).test(p)));
    expect(stray, `paths in the list that match no page: ${stray.join(', ')}`).toEqual([]);
  });
});
