/**
 * The team's own notes, turned into a decision (FB-081).
 *
 * ## The problem
 *
 * FB-064 put the lane's pull-request body on the work page under *"What the team says about it"*,
 * and it was right to: when the change is code a founder cannot read, the evidence that it was
 * checked is the thing they are actually judging.
 *
 * The form was wrong. The body is **4,332 characters** of gate transcript — every validation gate
 * with its full criterion and its full evidence, the PRP summary, the `/review` verdict, the `/qa`
 * findings — and the whole page came to 13,856. A founder scrolling four thousand words to find a
 * button learns to stop reading and press the button, which is the rubber-stamping FB-064 set out
 * to prevent, arrived at from the other direction.
 *
 * ## What a founder actually needs
 *
 * Three things, in this order: **what it did**, **whether it was checked**, and **anything unusual**.
 * The last one is the point. "All eight gates passed" is one line. "It took three attempts, and the
 * first two failed" is the line worth reading, and today it is indistinguishable from the routine.
 *
 * ## Reading prose is a compromise, and it is stated as one
 *
 * The lane writes this body as prose with conventional markers, so this parses text. FB-060 is the
 * ticket that gives the lane a defined shape to write instead; when it lands, this should consume
 * that shape and most of what follows can go.
 *
 * Until then the rule is: **never hide what could not be understood.** If the markers are missing,
 * `summarised` is false and the caller shows the body in full. A summary that quietly drops the one
 * paragraph explaining why something is risky would be worse than the wall of text it replaced.
 */

export interface Evidence {
  /** What the team says it did, in its own opening words. Null when the body has no prose. */
  did: string | null;
  /** Whether it was checked, in one sentence. Null when nothing recognisable said. */
  verdict: string | null;
  /** The things worth a founder's attention — what was NOT routine. */
  exceptions: string[];
  /** True when the markers were found. False means: show the body, do not pretend. */
  summarised: boolean;
  /**
   * The whole body as a founder should see it — the tool's own signature removed, nothing else
   * touched. One owner for that removal, so the summary and the full record cannot disagree about
   * what the team actually wrote.
   */
  record: string;
}

const GATE_HEADING = /^##\s+How the lane said it would check this/m;
/** `- ✅ name: criterion — evidence` / `- ❌ …` — one per validation gate the lane set itself. */
const GATE_LINE = /^\s*[-*]\s*(✅|❌|✓|✗)\s*([^:\n]{0,80})/gm;
/** `**Validation:** passed on round 2 of 2 (earlier rounds failed — …)` */
const ROUNDS = /\*\*Validation:\*\*[^\n]*?round\s+(\d+)\s+of\s+(\d+)/i;
/**
 * The review verdict line: `/review ✅ (review pass (0 critical))`.
 *
 * Matched to the END OF LINE rather than to the first `)`. The obvious `\(([^)]*)\)` stops at the
 * inner bracket and captures `review pass (0 critical` — so the critical count was never found, and
 * the real body's "0 critical" produced the right answer by luck rather than by working. A parser
 * that is accidentally right is one that will be quietly wrong the first time it matters.
 */
const REVIEW = /\/review\s*(✅|❌)?\s*(\([^\n]*)/i;
const CRITICALS = /(\d+)\s*critical/i;
const QA_LINE = /\/qa:?\s*([^\n]*)/i;

/**
 * The boilerplate the lane opens every body with. Identical on every piece of work, so it carries no
 * information — and it is where the jargon lives, which is why substituting words into it produced
 * *"Worked by the Foundry lane through the full its usual research, plan, build, check routine"*.
 * Removing the sentence is better than rewriting it.
 */
const BOILERPLATE = /^Worked by the Foundry lane[^.]*\.\s*/i;

/** Words the lane writes for itself. A founder should never meet any of them. */
const JARGON: Array<[RegExp, string]> = [
  [/\bPRP\b/g, 'the plan it wrote up front'],
  [/\/review\b/g, 'the code review'],
  [/\/qa\b/g, 'the hands-on check'],
  [/\bCI\b/g, 'the automatic checks'],
  [/\bPR\b/g, 'this piece of work'],
];

/** Strip the lane's private vocabulary out of anything a founder will read. */
export function plainWords(text: string): string {
  return JARGON.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/**
 * The tool's signature on the bottom of every body (FB-107, and FB-100's item 2).
 *
 * A founder reviewing their own product's work met `🤖 Generated with [Claude Code](https://…)` and
 * a `Co-Authored-By:` trailer, rendered as raw markdown, inside the section headed "what the team
 * says about it". It is a commit convention this repo keeps on purpose — and it is addressed to
 * engineers, not to the person deciding whether the work is what they asked for.
 *
 * Stripped at PRESENTATION, not at the source: FB-060 will eventually give the lane a body shape
 * that has no footer in it, and until then the presenter must not wait for the writer.
 */
const MACHINERY_FOOTER =
  /(\n\s*)*(🤖\s*)?Generated with \[?Claude Code\]?(\([^)]*\))?[^\n]*|(\n\s*)*Co-[Aa]uthored-[Bb]y:[^\n]*/g;

/** Take the tool's signature off anything a founder is about to read. */
export function stripMachinery(text: string): string {
  return text.replace(MACHINERY_FOOTER, '').trimEnd();
}

/**
 * What the team says it did — the prose before the transcript begins.
 *
 * Capped, because the opening is occasionally three paragraphs of detail. The cap breaks on a
 * sentence boundary rather than mid-word: a summary that stops mid-sentence reads as broken software
 * rather than as an excerpt.
 */
function opening(body: string, limit = 400): string | null {
  const beforeGates = body.split(GATE_HEADING)[0].split(/\*\*Research:\*\*/)[0].trim();
  if (!beforeGates) return null;
  const plain = plainWords(stripMachinery(beforeGates).replace(BOILERPLATE, '')).replace(/\s*\n\s*/g, ' ').trim();
  if (!plain) return null;
  if (plain.length <= limit) return plain;
  const cut = plain.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${(lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : cut).trim()}…`;
}

/**
 * Read the lane's body into something a founder can decide from.
 *
 * The exceptions are the whole point, so each one is only produced when the body actually says so —
 * an inferred exception would be worse than none, because a founder who learns the warnings are
 * guesses stops reading the warnings.
 */
export function readEvidence(rawBody: string | null): Evidence {
  // The footer goes first, so it cannot reach the summary, the record, or a gate match.
  const body = rawBody ? stripMachinery(rawBody) : rawBody;
  if (!body?.trim()) return { did: null, verdict: null, exceptions: [], summarised: false, record: '' };

  const gates = [...body.matchAll(GATE_LINE)];
  const failed = gates.filter((g) => g[1] === '❌' || g[1] === '✗');
  const rounds = body.match(ROUNDS);
  const review = body.match(REVIEW);
  const qa = body.match(QA_LINE);

  // Nothing recognisable — say so, and let the caller show everything.
  if (gates.length === 0 && !rounds && !review) {
    return { did: opening(body), verdict: null, exceptions: [], summarised: false, record: body };
  }

  const exceptions: string[] = [];

  for (const gate of failed) {
    const name = gate[2].trim();
    exceptions.push(`One of the checks it set itself did not pass${name ? `: ${name}` : ''}.`);
  }

  // Needing more than one attempt is the single most useful signal on this page, and it is currently
  // buried mid-paragraph in a sentence that also contains the failing criterion verbatim.
  if (rounds) {
    const [, got, total] = rounds;
    const attempts = Number(got);
    if (attempts > 1) {
      // One sentence, not two. Passing on the final permitted attempt is worth knowing — one more
      // failure and it would have stopped — but it is the same fact as "it took N attempts", and
      // splitting it made the list look longer than the news in it.
      const lastChance = Number(total) > 1 && attempts === Number(total)
        ? ' That was its last allowed attempt.'
        : '';
      exceptions.push(
        `It took ${attempts} attempts to get this right — the earlier ones did not pass its own checks.${lastChance}`,
      );
    }
  }

  const criticals = review?.[2]?.match(CRITICALS) ?? null;
  if (criticals && Number(criticals[1]) > 0) {
    exceptions.push(`The code review raised ${criticals[1]} serious point${criticals[1] === '1' ? '' : 's'}.`);
  }

  // A hands-on check that did not happen is worth knowing, and the lane says so plainly when it
  // decides there is nothing to try in a browser.
  if (qa && /nothing to (qa|check|try)|no web ui|no frontend/i.test(qa[1])) {
    exceptions.push('Nobody tried this in a browser — your team judged there was nothing visible to try.');
  }
  if (/in lieu of an automated test|manual verification|no existing automated test/i.test(body)) {
    exceptions.push('This was checked by hand rather than by an automated test.');
  }

  const passed = gates.length - failed.length;
  const reviewed = review?.[1] === '✅' || /review pass/i.test(review?.[2] ?? '');
  let verdict: string | null = null;
  if (gates.length > 0) {
    verdict = failed.length === 0
      ? `It passed all ${passed} check${passed === 1 ? '' : 's'} the team set itself`
      : `It passed ${passed} of ${gates.length} checks the team set itself`;
    verdict += reviewed ? ', and a reviewer signed it off.' : '.';
  } else if (reviewed) {
    verdict = 'A reviewer signed this off.';
  }

  return { did: opening(body), verdict, exceptions, summarised: true, record: body };
}

