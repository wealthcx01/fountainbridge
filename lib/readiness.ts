/**
 * Is the *running* studio actually wired to the ventures it claims to serve? (FB-087)
 *
 * ## Why this exists
 *
 * The in-studio composer never worked in production. Not once. The route reads a venture's engine key
 * from `COMPOSER_API_KEY_<VENTURE_ID>`, and that variable was simply never set on Railway — so every
 * press a founder made returned an error, for weeks.
 *
 * Nothing in this repository could see it. Lint, typecheck, 646 unit tests and a twelve-case
 * end-to-end suite were all green the entire time, because every one of them runs against a local
 * server with a local `.env`. They proved the code worked. They could not prove the *deployment*
 * worked, because they never touched the deployment.
 *
 * That is the gap this module closes. Configuration that only exists in the environment can only be
 * checked *in* that environment, by the process that is running there.
 *
 * ## The rule it encodes
 *
 * A venture is READY when the studio can actually reach its box: it has a host (so there is a box at
 * all) and the key for that box is present. Anything else is a venture the founder can see but not
 * use — and it should say so, loudly, to someone who can fix it, rather than waiting for a founder to
 * press a button and get an error.
 *
 * ## What it must never do
 *
 * Report a key's **value**, its length, or any prefix of it. Whether a secret is set is an operational
 * fact; the secret itself is not, and a readiness endpoint that leaks a hint about a credential is a
 * worse bug than the one it was written to catch. `keySet` is a boolean and stays one.
 */

/** One venture's wiring, as the running process sees it. */
export interface VentureReadiness {
  id: string;
  /** The box's host, or null when the venture has no box yet. */
  host: string | null;
  /** The variable the studio looks up — named so a fix is copy-pasteable. */
  keyEnvName: string;
  /** Whether that variable is set. NEVER the value, the length, or a prefix. */
  keySet: boolean;
  /** Ready = the studio can reach this venture's engine. */
  ready: boolean;
  /** Plain English, for a human who has to fix it. Null when ready. */
  problem: string | null;
}

export interface Readiness {
  ok: boolean;
  ventures: VentureReadiness[];
}

/**
 * The environment variable holding a venture's engine key.
 *
 * Deliberately duplicated from `lib/composer` rather than imported: that module is pulled into the
 * client bundle, and this one reads `process.env` across every venture. A test asserts the two agree
 * so the duplication cannot drift — which matters more than usual here, because a mismatch between
 * "the name the studio reads" and "the name readiness checks" would make this module confidently
 * report health it never verified.
 */
export function keyEnvName(ventureId: string): string {
  return `COMPOSER_API_KEY_${ventureId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

/**
 * Read the wiring for each venture out of the live environment.
 *
 * Pure apart from the `env` it is handed, so the interesting cases are testable without a deployment.
 *
 * A venture with **no box** is `ready`, not broken: it is an honest state the studio already renders
 * ("your composer will appear once your box is set up"), and flagging it as a fault would train
 * whoever reads this to ignore the output — which is how a real fault gets missed.
 */
export function readiness(
  ventures: { id: string; vpsHost: string | null }[],
  env: Record<string, string | undefined>,
): Readiness {
  const rows = ventures.map<VentureReadiness>((v) => {
    const name = keyEnvName(v.id);
    const keySet = typeof env[name] === 'string' && env[name]!.trim() !== '';
    if (!v.vpsHost) {
      return { id: v.id, host: null, keyEnvName: name, keySet, ready: true, problem: null };
    }
    return {
      id: v.id,
      host: v.vpsHost,
      keyEnvName: name,
      keySet,
      ready: keySet,
      problem: keySet
        ? null
        : `${v.id} has a box at ${v.vpsHost}, but ${name} is not set on the studio. Its composer will `
          + `fail for the founder. Run deploy/librechat/enable-agents-api.sh on the box and set the `
          + `key it prints as ${name}.`,
    };
  });
  return { ok: rows.every((r) => r.ready), ventures: rows };
}
