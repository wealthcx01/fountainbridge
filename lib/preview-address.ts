/**
 * Which addresses the studio's server will ever open (FB-184).
 *
 * Its own file, with no imports, because `lib/work.ts` needs `isPreviewAddress` and is imported by a
 * client component; `lib/preview-check.ts` reads a file in the test rig and cannot be.
 */

/**
 * The hosts a preview can live on. Matched against the PARSED hostname, start to end — never by
 * searching the address as text. A text search let `http://169.254.169.254/?a.up.railway.app`
 * through, and the studio's own server would have opened an internal address of someone's choosing
 * (FB-184 review). Anyone who can post a commit status on a venture repo chooses this address.
 */
const PREVIEW_HOST = /^[a-z0-9][a-z0-9-]*\.(?:up\.railway\.app|vercel\.app|netlify\.app|pages\.dev)$/i;

/** An https address on a preview host, on the default port. The only kind the studio will open. */
export function isPreviewAddress(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.port === '' && !u.username && !u.password && PREVIEW_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * A surface's door, from the venture's manifest (FB-093's `launch:`): an http or https address on
 * the default port, on a named host. Not limited to preview hosts, because a venture's product can
 * live on its own domain. http is allowed because the manifest allows it (`lib/ventures.ts`,
 * "http(s) only"), and a door the manifest accepts must not lose its link for that alone. The manifest
 * is reviewed config in this repository, not something anyone with a commit status can write, so the
 * wider rule is safe here and only here. Still never an IP address, never `localhost`, never a host
 * with no dot: the studio's server must not be pointed inward.
 */
export function isDoorAddress(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.port === '' && !u.username && !u.password
      && host.includes('.') && !host.startsWith('[') && !/^[\d.]+$/.test(host)
      && host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.internal');
  } catch {
    return false;
  }
}

