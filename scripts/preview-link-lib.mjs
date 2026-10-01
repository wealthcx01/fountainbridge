/**
 * Does a preview link actually open the preview? The judgement half (FB-243).
 *
 * Pure, so the part that can be wrong is the part with tests. `check-preview-link.mjs` does the
 * fetching.
 *
 * ## Why a health check does not catch this
 *
 * Railway forks a preview environment from production **with its variables**. `AUTH_URL` was a
 * literal production URL, so every preview inherited it and redirected to the live site. A reviewer
 * opening the link saw `main`, not the pull request's work, with nothing on screen to say so.
 *
 * Every ordinary check passed throughout: the preview was up, it answered, it returned HTML. A
 * health endpoint returning 200 proves a server is running and says nothing about whether the page
 * you were sent to is the page you asked for. **The host you land on is the measurement** — the
 * FB-151 lesson, where a probe timed two pages that had both redirected elsewhere.
 */

/**
 * Judge a finished redirect chain.
 *
 * `hops` is `[{ url, status, location }]`, oldest first. `expectedHost` is the host the link was
 * supposed to open.
 *
 * Three failures are told apart on purpose, because they call for different actions: a link that
 * goes somewhere else (fix `AUTH_URL`), a link that settles on an error (the preview is broken or
 * gone), and a link that never settles (a redirect loop).
 */
export function verdictFor(hops, expectedHost) {
  if (!Array.isArray(hops) || hops.length === 0) {
    return { ok: false, kind: 'unreachable', reason: 'nothing answered.' };
  }
  const last = hops[hops.length - 1];
  if (last.location) {
    return {
      ok: false,
      kind: 'never-settles',
      reason: 'the link never settles — it was still redirecting after the last hop.',
    };
  }

  let host;
  try {
    host = new URL(last.url).host;
  } catch {
    return { ok: false, kind: 'unreachable', reason: `could not read the final address: ${last.url}` };
  }

  if (host !== expectedHost) {
    return {
      ok: false,
      kind: 'wrong-host',
      landedOn: host,
      reason:
        `this link does not open the preview. Asked for ${expectedHost}, landed on ${host}. `
        + 'A reviewer following it would see that site with no way to know it is not the work in '
        + 'this pull request. Check AUTH_URL on the environment it was forked from — see FB-243.',
    };
  }

  // A preview that answers 404 is not a working preview. The first version of this check reported
  // "OK: stays on <host> (404)" for an environment that had been torn down, which is the same
  // family of fault as the one it exists to catch: a green answer to the wrong question.
  // 2xx and nothing else. A 3xx that is the final hop means the server said "redirect" without
  // saying where, and the reviewer sees an empty page.
  if (typeof last.status !== 'number' || last.status < 200 || last.status >= 300) {
    return {
      ok: false,
      kind: 'not-serving',
      status: last.status,
      reason:
        `the link stays on ${host} but answers ${last.status}. The preview is not serving — it may `
        + 'have been torn down when its pull request closed.',
    };
  }

  return { ok: true, kind: 'ok', host, status: last.status, reason: `stays on ${host} (${last.status}).` };
}
