import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * FB-206 — who the home page shows the credential scan to.
 *
 * The browser test signs in a founder with ONE venture, who is redirected before the page draws
 * anything. The founder this guards is the rarer one: a founder with two or more ventures, who stays
 * on `/` and sees the venture picker. No fixture founder has two ventures, so this renders the real
 * page here, with sign-in and the manifests mocked, and checks the scan is never read for them.
 */

// Components in this repo are compiled with the classic JSX runtime, which expects `React` in scope.
(globalThis as Record<string, unknown>).React = React;

const auth = vi.fn();
const loadVentures = vi.fn();
const loadVentureScan = vi.fn();
const defaultScanSource = vi.fn();

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/box-scan-load', () => ({
  loadVentureScan: (...a: unknown[]) => loadVentureScan(...a),
  defaultScanSource: () => defaultScanSource(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`redirected to ${to}`); },
}));

const { default: Home } = await import('../page');

const FOUNDER = 'two.ventures@bruntsfield.capital';
const ADMIN = 'admin@bruntsfield.capital';
const venture = (id: string, founderEmail: string) => ({
  id, name: id.toUpperCase(), description: null, status: 'active', founderName: null, founderEmail,
  repos: [id], approvalMatrix: [], vpsHost: `${id}.example`, departments: [],
});

/** Every element type in a tree, by name, without rendering anything async. */
function typeNames(node: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(node)) { node.forEach((n) => typeNames(n, out)); return out; }
  if (!isValidElement(node)) return out;
  const t = node.type as string | { name?: string };
  out.push(typeof t === 'string' ? t : t?.name ?? '');
  typeNames((node.props as { children?: ReactNode }).children, out);
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STUDIO_ADMIN_EMAILS = ADMIN;
  loadVentures.mockReturnValue([venture('arca', FOUNDER), venture('the-reset', FOUNDER), venture('other', 'x@y.z')]);
});

describe('the credential scan on the home page (FB-206)', () => {
  it('a founder with two ventures gets the picker, and the scan is never read or drawn', async () => {
    auth.mockResolvedValue({ user: { email: FOUNDER } });
    const page = await Home();
    const html = renderToStaticMarkup(page as React.ReactElement);
    expect(html).toContain('venture-grid');
    expect(html).not.toContain('Credential scan');
    expect(html).not.toContain('ledger-box-scan');
    expect(loadVentureScan, 'a founder’s request read a box scan').not.toHaveBeenCalled();
    expect(defaultScanSource).not.toHaveBeenCalled();
  });

  it('the admin gets it — so the test above is not passing because the section is gone', async () => {
    auth.mockResolvedValue({ user: { email: ADMIN } });
    const page = await Home();
    expect(typeNames(page)).toContain('LoadedBoxScan');
  });
});
