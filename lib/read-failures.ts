/**
 * What to tell a founder when the studio could not read something (FB-076).
 *
 * ## The problem
 *
 * The attention queue opened with this, above the actual work:
 *
 * > Some repos couldn't be read: arca-marketing: GitHub rate limit hit — try refresh shortly. ·
 * > arca-ops: GitHub rate limit hit — try refresh shortly. · modernisation-engine: GitHub rate limit
 * > hit — try refresh shortly. · thereset-platform: Repository wealthcx01/thereset-platform not
 * > found. · thereset-marketing: Repository wealthcx01/thereset-marketing not found.
 *
 * Five failures and two entirely different causes, run together into one sentence with `·`
 * separators, naming five repositories by their machine names, longer than any real item below it,
 * and offering "try refresh shortly" for three of them and nothing at all for the other two.
 *
 * Surfacing failure is right (CLAUDE.md #10). Surfacing it like that is a log line wearing a warning
 * box.
 *
 * ## What this does instead
 *
 * Groups by **cause**, because the cause is what decides whether the founder should do anything:
 * one will clear on its own, one needs an admin, one needs a repository that does not exist to be
 * created. Three sentences a person can act on, instead of five they cannot.
 */

/** Why a read failed, from the founder's point of view rather than GitHub's. */
export type FailureCause = 'busy' | 'not-allowed' | 'missing' | 'unknown';

export interface FailureGroup {
  cause: FailureCause;
  /** What happened, in one sentence, with the workstreams named plainly. */
  text: string;
  /** What happens next — including "this one will not clear on its own". */
  nextStep: string;
  /** Whether waiting will fix it. Drives whether this is worth a founder's attention at all. */
  transient: boolean;
  /** The workstreams affected, for the test ids and for counting. */
  repos: string[];
}

/**
 * Work out the cause from the message a read model produced.
 *
 * Matching on text is not lovely, but the alternative is threading a cause enum through four read
 * models that each build their own error strings — and the strings are already the contract those
 * models agreed. `unknown` is deliberately not silent: an unrecognised failure still reaches the
 * founder, because the failure this is modelled on was one nobody expected either.
 */
export function causeOf(message: string): FailureCause {
  if (/rate limit/i.test(message)) return 'busy';
  if (/not have permission|not accessible|forbidden/i.test(message)) return 'not-allowed';
  if (/not found|does not exist/i.test(message)) return 'missing';
  return 'unknown';
}

/** The workstream a failure message names, without its owner — a founder never needs the owner. */
export function repoOf(message: string): string {
  const named = message.match(/([\w.-]+\/)?([\w.-]+?)(?::| not found| could not)/);
  return named ? named[2] : message.split(':')[0].trim();
}

const list = (repos: string[]): string =>
  repos.length === 1 ? repos[0]
    : `${repos.slice(0, -1).join(', ')} and ${repos[repos.length - 1]}`;

const plural = (repos: string[], one: string, many: string) => (repos.length === 1 ? one : many);

/**
 * Every read failure, grouped into sentences a founder can act on.
 *
 * Ordered by what deserves attention: the things that will not fix themselves come first, because a
 * founder skimming should meet the ones that need them before the one that needs nobody.
 */
export function groupFailures(messages: string[]): FailureGroup[] {
  const byCause = new Map<FailureCause, string[]>();
  for (const m of messages) {
    const cause = causeOf(m);
    byCause.set(cause, [...(byCause.get(cause) ?? []), repoOf(m)]);
  }

  const groups: FailureGroup[] = [];
  const not = byCause.get('not-allowed');
  if (not) {
    groups.push({
      cause: 'not-allowed',
      transient: false,
      repos: not,
      text: `The studio is not allowed to read ${list(not)}.`,
      nextStep: `This will not clear on its own. An admin needs to give the studio access to `
        + `${plural(not, 'that workstream', 'those workstreams')}.`,
    });
  }
  const missing = byCause.get('missing');
  if (missing) {
    groups.push({
      cause: 'missing',
      transient: false,
      repos: missing,
      text: `${list(missing)} ${plural(missing, 'has', 'have')} not been set up yet.`,
      nextStep: `This will not clear on its own — ${plural(missing, 'that workstream is', 'those workstreams are')} `
        + 'named in your venture but does not exist yet.',
    });
  }
  const unknown = byCause.get('unknown');
  if (unknown) {
    groups.push({
      cause: 'unknown',
      transient: false,
      repos: unknown,
      text: `Something went wrong reading ${list(unknown)}.`,
      nextStep: 'Tell us if it keeps happening — this is not a state we expected.',
    });
  }
  // Last, because it is the only one that fixes itself and the only one a founder can ignore.
  const busy = byCause.get('busy');
  if (busy) {
    groups.push({
      cause: 'busy',
      transient: true,
      repos: busy,
      text: `${list(busy)} could not be read just now because the studio has been asking GitHub too often.`,
      nextStep: 'It clears on its own — give it a minute and refresh.',
    });
  }
  return groups;
}

/** Does anything here actually need the founder? Drives whether the note is worth their attention. */
export const needsAction = (groups: FailureGroup[]): boolean => groups.some((g) => !g.transient);
