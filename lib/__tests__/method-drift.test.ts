import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The composer's prompt and our own guides must keep saying the same thing (FB-079).
 *
 * ## Why this exists
 *
 * The guides live in `content/playbook/` in the studio repository. The composer's prompt lives in
 * `deploy/librechat/seed-agent.js` and runs on a **venture box**, which has no access to the studio
 * repository at all. So the prompt cannot reference the guides — it has to carry a distilled copy of
 * the ideas.
 *
 * That is two copies of the same claim, which is drift waiting to happen. Someone rewrites the
 * playbook, and the composer carries on asking founders questions from a version of the method we no
 * longer believe — with a link to a page that now says something else.
 *
 * This is the mechanism instead of a promise. It asserts the distilled ideas are still supported by
 * the source, and that every page the prompt cites still exists. Rewrite the playbook and this fails,
 * which forces the prompt to be revisited in the same change.
 *
 * It deliberately does NOT compare wording. The prompt is a distillation and should read differently;
 * what must not change is what it claims.
 */

const ROOT = join(__dirname, '..', '..');
const PROMPT = readFileSync(join(ROOT, 'deploy/librechat/seed-agent.js'), 'utf8');
const PLAYBOOK = readdirSync(join(ROOT, 'content/playbook'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => readFileSync(join(ROOT, 'content/playbook', f), 'utf8'))
  .join('\n');

describe('the composer knows our method', () => {
  it('carries the two ideas that most change a ticket', () => {
    // "Most power origination for new companies comes from counter-positioning or cornered
    // resource" — John, and the reason these two are named rather than all seven.
    expect(PROMPT).toMatch(/counter-position/i);
    expect(PROMPT).toMatch(/cornered resource/i);
  });

  it('carries the benefit-versus-barrier idea, which is the whole point', () => {
    expect(PROMPT).toMatch(/barrier/i);
    expect(PROMPT).toMatch(/benefit without a barrier/i);
  });

  it('carries the beachhead idea', () => {
    expect(PROMPT).toMatch(/beachhead/i);
  });

  it('tells the composer when NOT to use it', () => {
    // A founder who gets a strategy question about a broken image stops telling you about broken
    // images. The gate matters more than the content.
    expect(PROMPT).toMatch(/bug, a fix, a tidy-up|say nothing/i);
  });
});

describe('the prompt and the guides still agree', () => {
  it('the barrier claim is what the playbook actually says', () => {
    // If someone rewrites moats.md to argue something else, this fails and the prompt must be
    // revisited in the same change.
    expect(PLAYBOOK).toMatch(/benefit without a barrier/i);
    expect(PLAYBOOK).toMatch(/can'?t or won'?t.{0,20}copy/i);
  });

  it('counter-positioning and cornered resource are still in the playbook', () => {
    expect(PLAYBOOK).toMatch(/counter[- ]position/i);
    expect(PLAYBOOK).toMatch(/cornered resource/i);
  });

  it('the beachhead claim is what the playbook actually says', () => {
    expect(PLAYBOOK).toMatch(/beachhead/i);
    expect(PLAYBOOK).toMatch(/one specific group|one specific pain/i);
  });

  it('every page the prompt sends a founder to actually exists', () => {
    // A link to a page that does not exist is worse than no link: it teaches a founder that the
    // studio's own references are unreliable.
    const cited = [...PROMPT.matchAll(/\/playbook\/([a-z-]+)/g)].map((m) => m[1]);
    expect(cited.length).toBeGreaterThan(0);
    const slugs = new Set(
      readdirSync(join(ROOT, 'content/playbook'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => readFileSync(join(ROOT, 'content/playbook', f), 'utf8').match(/^slug:\s*(\S+)/m)?.[1])
        .filter(Boolean) as string[],
    );
    for (const slug of new Set(cited)) expect(slugs, `cited /playbook/${slug}`).toContain(slug);
  });
});

/**
 * The gate the composer states in prose must be a rule about its own reply (FB-119).
 *
 * The dogfood run of 2026-08-23 produced a read-back ending "Before I file — nothing — say the
 * word", and then filed five tickets in the same message. The founder never said the word.
 *
 * It was not disobedience. The gate was written as a property of the FOUNDER's message — "wait for an
 * explicit yes" — and the founder's message had been `file the whole set`. A yes existed; it was just
 * a yes to a ticket that did not exist yet. Nothing said that does not carry.
 *
 * So these assert the three things the prompt has to keep saying. They are deliberately about claims
 * rather than wording: rephrase the prompt freely, but a rewrite that drops the rule fails here
 * rather than in front of a founder.
 */
describe('the composer cannot file in the reply that reads a ticket back', () => {
  it('says a read-back ends the reply', () => {
    expect(PROMPT).toMatch(/read-back ends your reply/i);
    expect(PROMPT).toMatch(/never read a ticket back and file it in the same message/i);
  });

  it('does not hand the composer the phrase that broke the gate', () => {
    // The first attempt at this ticket added the rule and left the TEMPLATE telling the composer to
    // write "nothing — say the word". It filed anyway, on the box, with the rule three steps below.
    // The shape a model is told to output beats a rule it is told to follow, so the phrase has to go
    // rather than be argued with.
    const template = PROMPT.slice(PROMPT.indexOf('Before I file'), PROMPT.indexOf('Hard limit'));
    expect(template).not.toMatch(/"nothing — say the word"/);
    expect(template).toMatch(/shall I file it\?/);
  });

  it('makes the gate a question rather than an offer', () => {
    // "Say the word" is a sentence that sounds like a stop without being one. A question mark is a
    // shape the composer can check itself against; a flourish is not.
    expect(PROMPT).toMatch(/ENDING IN A QUESTION MARK/);
    expect(PROMPT).toMatch(/never write "say the word"/i);
  });

  it('gives the composer a way to obey a founder who already said go', () => {
    // The attempt before this one only tightened the gate, and it broke live anyway: a founder said
    // "I approve in advance, no more questions" three times and the composer wrote "shall I file
    // it?" and filed. It was not disobeying — it was obeying, while reading out a sentence that said
    // otherwise. A rule with no branch for the obvious case gets one improvised for it.
    expect(PROMPT).toMatch(/Filing now, as you asked/);
    expect(PROMPT).toMatch(/DO NOT write "Before I file" at all/);
  });

  it('names the thing that is actually forbidden', () => {
    // Not "it filed" — a founder is allowed to pre-approve. What is forbidden is one reply that
    // claims to be waiting and is not.
    expect(PROMPT).toMatch(/if your reply asks "shall I file it\?", your reply\s+does not file it/i);
    expect(PROMPT).toMatch(/a reply that says it is waiting and is not/i);
  });

  it('says a yes that predates the draft is not a yes to it', () => {
    // The whole failure in one claim. Without it, "just file it" reads as standing approval for
    // words the founder has not seen.
    expect(PROMPT).toMatch(/before the draft existed is not a yes to the draft/i);
  });

  it('tells the composer what to do with a set, so it does not have to improvise one', () => {
    // It improvised the split well and the gate badly. A normal ask the prompt does not cover is a
    // gate written by whichever model is answering.
    expect(PROMPT).toMatch(/is a SET/);
    expect(PROMPT).toMatch(/read back ONCE/i);
    expect(PROMPT).toMatch(/one yes files the whole set/i);
  });

  it('still refuses to name a ticket the filing tool did not name', () => {
    // FB-097 and FB-117 both end here: an id the composer chose is a ticket nobody can approve.
    expect(PROMPT).toMatch(/never one you chose|Do NOT invent a ticket number/);
  });
});
