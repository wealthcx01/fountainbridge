import { describe, it, expect, vi } from 'vitest';

// The desk reaches the approve controls, which import the sign-in module. Nothing here signs in.
vi.mock('@/auth', () => ({ auth: async () => null, signIn: async () => undefined, signOut: async () => undefined }));
// Drawn outside a running app, so there is no router; the desk only asks it where it is.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
  usePathname: () => '/venture/arca',
  useSearchParams: () => new URLSearchParams(),
}));
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { offerFor, type PreviewCheck } from '../result-link';
import { checkDoor, checkPreview, isDoorAddress, type Fetcher } from '../preview-check';
import type { DepartmentSummary } from '../ventures';

/**
 * FB-184, after review: the "does not open, so no link" half, on the screens themselves.
 *
 * The first version of this work was only ever tested with addresses that opened. Its review drew
 * the work page's two buttons and the desk's door with the check removed, and every test stayed
 * green. These draw each screen with an address that did NOT open, and look for the link.
 */

// Under vitest, JSX compiles to `React.createElement`; the components expect it in scope.
(globalThis as { React?: typeof React }).React = React;
const { SeeIt } = await import('@/components/SeeIt');
const { VentureBoard } = await import('@/components/VentureBoard');

const PREVIEW = 'https://arca-pr-13.up.railway.app';
const DOOR = 'https://arca-production-4e99.up.railway.app';
const opens = (url: string): PreviewCheck => ({ url, state: 'opens' });
const down = (url: string): PreviewCheck => ({ url, state: 'does-not-open', reason: 'it is not answering' });
const WHY_DOWN = 'it did not open when the studio checked, because it is not answering';

/** Every `href` in the markup. */
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe('the work page links a preview or the product only when it opened', () => {
  const launch = { label: 'Open the terminal', url: DOOR };
  const draw = (p: Partial<React.ComponentProps<typeof SeeIt>>) => renderToStaticMarkup(React.createElement(SeeIt, p));

  it('both open: both are links, to the checked addresses', () => {
    const html = draw({ previewCheck: opens(PREVIEW), launch, launchCheck: opens(DOOR) });
    expect(html).toContain('data-testid="work-preview"');
    expect(html).toContain('data-testid="work-launch"');
    expect(hrefs(html)).toEqual([PREVIEW, DOOR]);
    expect(html).not.toContain('-why');
  });

  it('the preview did not open: no link to it, and the reason instead', () => {
    const html = draw({ previewCheck: down(PREVIEW), launch, launchCheck: opens(DOOR) });
    expect(html).not.toContain('data-testid="work-preview"');
    expect(hrefs(html)).toEqual([DOOR]);
    expect(html).toContain('data-testid="work-preview-why"');
    expect(html).toContain(`The preview of this change: ${WHY_DOWN}.`);
  });

  it('the product did not open: no link to it, and the reason instead', () => {
    const html = draw({ previewCheck: opens(PREVIEW), launch, launchCheck: down(DOOR) });
    expect(html).not.toContain('data-testid="work-launch"');
    expect(hrefs(html)).toEqual([PREVIEW]);
    expect(html).toContain(`Open the terminal: ${WHY_DOWN}.`);
  });

  it('not checked: no link either, and it says so', () => {
    const html = draw({ previewCheck: { url: PREVIEW, state: 'not-checked' } });
    expect(hrefs(html)).toEqual([]);
    expect(html).toContain('it has not been checked yet, so there is no link');
  });

  it('nothing to check: no section at all', () => {
    expect(draw({})).toBe('');
  });
});

describe('the desk links a surface’s door only when it opened', () => {
  const build: DepartmentSummary = {
    id: 'build', name: 'Build — Product', repo: 'arca', queuePath: 'docs/tickets', gate: 'pr',
    provisioned: true, launch: { label: 'Open the terminal', url: DOOR }, connectors: [],
  };

  const desk = (doors: Record<string, PreviewCheck>) => renderToStaticMarkup(React.createElement(VentureBoard, {
    venture: { id: 'arca', name: 'ARCA', status: 'active', founderName: null, hasComposer: false },
    lanes: [],
    departments: [build],
    doors,
    office: { desks: [], live: true, text: 'running' },
    totalWarnings: 0,
    fetchedAgeMs: 0,
    org: 'wealthcx01',
  }));

  it('opens: the door is a link to the checked address, and Build says it is running', () => {
    const html = desk({ build: opens(DOOR) });
    expect(html).toContain('data-testid="dept-build-launch"');
    expect(hrefs(html)).toContain(DOOR);
    expect(html).toContain('preview of the app running');
    expect(html).not.toContain('dept-build-launch-why');
  });

  it('did not open: no link to it anywhere on the desk, the reason, and no "running"', () => {
    const html = desk({ build: down(DOOR) });
    expect(html).not.toContain('data-testid="dept-build-launch"');
    expect(hrefs(html)).not.toContain(DOOR);
    expect(html).toContain('data-testid="dept-build-launch-why"');
    expect(html).toContain(`Open the terminal: ${WHY_DOWN}.`);
    expect(html).not.toContain('preview of the app running');
  });

  it('never checked: no link and no "running"', () => {
    const html = desk({});
    expect(hrefs(html)).not.toContain(DOOR);
    expect(html).not.toContain('preview of the app running');
  });
});

describe('a link is offered only for an address that opened', () => {
  it('opens: a link to the checked address; otherwise words and no address at all', () => {
    expect(offerFor(opens(DOOR))).toEqual({ kind: 'link', href: DOOR });
    expect(offerFor(down(DOOR))).toEqual({ kind: 'why', text: WHY_DOWN });
    expect(JSON.stringify(offerFor(down(DOOR)))).not.toContain(DOOR);
    expect(offerFor(null)).toBeNull();
  });
});

/** A fetcher that answers from a script and records every address it was asked to open. */
function scripted(answers: Record<string, { status: number; location?: string }>, fetched: string[] = []): Fetcher {
  return async (url) => {
    fetched.push(url);
    const a = answers[url];
    if (!a) throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).host}`);
    return { status: a.status, headers: { get: (n: string) => (n.toLowerCase() === 'location' ? a.location ?? null : null) } };
  };
}

describe('a founder’s product behind a sign-in still counts as opening (FB-184 review)', () => {
  const APP = 'https://app.example-venture.com/';

  it('a redirect to its own sign-in page opens', async () => {
    const f = scripted({ [APP]: { status: 302, location: '/login' }, [`${APP}login`]: { status: 200 } });
    expect((await checkDoor(APP, f)).state).toBe('opens');
  });

  it('a redirect to a sign-in on another site opens, and the studio does not follow it', async () => {
    const fetched: string[] = [];
    const f = scripted({ [APP]: { status: 302, location: 'https://accounts.example-idp.com/signin?next=app' } }, fetched);
    expect((await checkDoor(APP, f)).state).toBe('opens');
    expect(fetched).toEqual([APP]);
  });

  it.each([401, 403])('a page that answers %i (sign in first) opens', async (status) => {
    expect((await checkDoor(APP, scripted({ [APP]: { status } }))).state).toBe('opens');
  });

  it.each([404, 500, 502])('a page that answers %i does not open', async (status) => {
    expect(await checkDoor(APP, scripted({ [APP]: { status } }))).toEqual({
      url: APP, state: 'does-not-open', reason: 'it is not answering',
    });
  });

  it('a door that keeps redirecting on its own site does not open', async () => {
    const f = scripted({ [APP]: { status: 302, location: '/a' }, [`${APP}a`]: { status: 302, location: '/' } });
    expect(await checkDoor(APP, f)).toEqual({ url: APP, state: 'does-not-open', reason: 'it keeps redirecting' });
  });

  it('a preview stays strict: a redirect to another site, or a 401, is not the preview', async () => {
    const P = 'https://arca-pr-20.up.railway.app/';
    const away = scripted({ [P]: { status: 302, location: 'https://arca-production-4e99.up.railway.app/' } });
    expect(await checkPreview(P, away)).toEqual({ url: P, state: 'does-not-open', reason: 'it opens a different site' });
    expect((await checkPreview(P, scripted({ [P]: { status: 401 } }))).state).toBe('does-not-open');
  });
});

describe('a door on http, which the manifest allows, is checked and called a door', () => {
  it('opens on http', async () => {
    const url = 'http://app.example-venture.com';
    expect(isDoorAddress(url)).toBe(true);
    expect((await checkDoor(url, scripted({ [url]: { status: 200 } }))).state).toBe('opens');
  });

  it('an address the studio will not open is never called a preview', async () => {
    const check = await checkDoor('https://localhost/', scripted({}));
    expect(check).toEqual({ url: 'https://localhost/', state: 'does-not-open', reason: 'it is not a public web address the studio can check' });
  });
});

describe('one check gives up after six seconds in all, not twenty', () => {
  it('a slow chain of redirects stops when time runs out, and says it could not be reached', async () => {
    const APP = 'https://slow.example-venture.com/';
    let t = 0;
    const fetched: string[] = [];
    // Every hop redirects to the next and takes 2.5 seconds by this clock.
    const f: Fetcher = async (url) => {
      fetched.push(url);
      t += 2_500;
      return { status: 302, headers: { get: (n: string) => (n === 'location' ? `/${fetched.length}` : null) } };
    };
    const check = await checkDoor(APP, f, () => t);
    expect(check).toEqual({ url: APP, state: 'does-not-open', reason: 'it could not be reached' });
    expect(fetched.length).toBe(3);
  });
});
