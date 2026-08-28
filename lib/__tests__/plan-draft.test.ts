import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  PLAN_MARKER, allocatePlanIds, effectiveDependsOn, extractPlanDraft, keptTickets, orderPlan,
  parsePlanDraft, planBranch, planFilingOrder, planOrder, planProblem, strikeTicket,
  ticketPrefixFor, withDependsOn, type PlanDraft,
} from '../plan-draft';
import { parseReply } from '../composer';

/**
 * A PRD becomes a ticket set (FB-127).
 *
 * The shape must satisfy the vendored schema (CLAUDE.md #7). The behaviour must hold two things: a
 * plan is inert until a founder presses once, and a dependency in a filed set must resolve while
 * every ticket in it is still unmerged.
 */

const SCHEMA = JSON.parse(readFileSync(join(__dirname, '..', '..', 'schema', 'PlanDraft.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

const at = '2026-08-28T09:00:00.000Z';

/** The 2026-08-23 dogfood run, as the composer proposed it: research → build ×3 → QA. */
const plan = (): PlanDraft => ({
  venture_id: 'arca',
  repo: 'arca',
  source_title: 'Auction aggregator PRD',
  created_at: at,
  tickets: [
    { slug: 'auction-source-research', title: 'Which auction houses publish a feed', body: '# Which auction houses publish a feed\n\n**Status:** Todo · **Area:** Research · **Depends on:** —\n\nbody', depends_on: [], source: '§1 Sources' },
    { slug: 'auction-feed-ingestion', title: 'Ingest auction feeds', body: '# Ingest auction feeds\n\n**Status:** Todo · **Area:** ETL · **Depends on:** —\n\nbody', depends_on: ['auction-source-research'], source: '§2 Ingestion' },
    { slug: 'auction-live-view', title: 'One page showing every live auction', body: '# One page showing every live auction\n\n**Status:** Todo · **Area:** Web · **Depends on:** —\n\nbody', depends_on: ['auction-feed-ingestion'], source: '§3 The view' },
    { slug: 'auction-notifications', title: 'Notify when a watched card is listed', body: '# Notify when a watched card is listed\n\n**Status:** Todo · **Area:** Web · **Depends on:** —\n\nbody', depends_on: ['auction-feed-ingestion'], source: '§4 Notifications' },
    { slug: 'auction-aggregator-qa', title: 'QA the aggregator end to end', body: '# QA the aggregator end to end\n\n**Status:** Todo · **Area:** QA · **Depends on:** —\n\nbody', depends_on: ['auction-live-view', 'auction-notifications'], source: '§5 Acceptance' },
  ],
});

describe('the plan keeps its contract', () => {
  it('a proposed set is on-contract', () => {
    expect(validate(plan()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('a set with a line struck is still on-contract', () => {
    expect(validate(strikeTicket(plan(), 'auction-notifications', true)), JSON.stringify(validate.errors)).toBe(true);
  });

  it('the schema refuses a draft that carries an id', () => {
    // An id is evidence a backlog was written to, and a draft has written to nothing.
    const withId = plan();
    (withId.tickets[0] as unknown as Record<string, unknown>).id = 'ARCA-068';
    expect(validate(withId)).toBe(false);
  });
});

describe('reading a plan out of what the composer wrote', () => {
  const asBlock = (p: unknown) => JSON.stringify({ [PLAN_MARKER]: 1, ...(p as object) });

  it('reads a whole set', () => {
    const parsed = parsePlanDraft(asBlock(plan()));
    expect(parsed?.tickets).toHaveLength(5);
    expect(parsed?.tickets[4]?.depends_on).toEqual(['auction-live-view', 'auction-notifications']);
  });

  it('finds it inside a reply that is mostly prose', () => {
    const reply = [
      'Here is how I would break that document up.',
      '',
      '```',
      asBlock(plan()),
      '```',
      '',
      'Strike anything you do not want and press file.',
    ].join('\n');
    expect(extractPlanDraft(parseReply(reply))?.tickets).toHaveLength(5);
  });

  it('is not fooled by a fenced block that merely happens to be JSON', () => {
    // Without the marker this is a code sample, and offering a "File all 6" button over it would be
    // proposing to write to a founder's backlog on a guess.
    expect(parsePlanDraft(JSON.stringify({ venture_id: 'arca', repo: 'arca', tickets: [] }))).toBeNull();
    expect(extractPlanDraft(parseReply('```\n{"a":1}\n```'))).toBeNull();
  });

  it('reads an ordinary ticket draft as no plan at all', () => {
    expect(extractPlanDraft(parseReply('```\n# ARCA-NEW — Show set name\n\nbody\n```'))).toBeNull();
  });

  it('refuses a malformed plan rather than showing a press over half of one', () => {
    for (const broken of [
      { ...plan(), tickets: [] },
      { ...plan(), tickets: [{ ...plan().tickets[0], slug: '../../etc/passwd' }] },
      { ...plan(), tickets: [{ ...plan().tickets[0], body: '' }] },
      { ...plan(), tickets: [{ ...plan().tickets[0], source: '' }] },
      { ...plan(), tickets: [{ ...plan().tickets[0], depends_on: ['NOT A SLUG'] }] },
      { ...plan(), tickets: [plan().tickets[0], plan().tickets[0]] },
      { ...plan(), repo: '' },
    ]) {
      expect(parsePlanDraft(asBlock(broken)), JSON.stringify(broken).slice(0, 60)).toBeNull();
    }
    expect(parsePlanDraft('not json at all')).toBeNull();
    expect(parsePlanDraft(null)).toBeNull();
  });

  it('drops a ticket depending on itself rather than refusing the whole plan', () => {
    const self = { ...plan(), tickets: [{ ...plan().tickets[0], depends_on: ['auction-source-research'] }] };
    expect(parsePlanDraft(asBlock(self))?.tickets[0]?.depends_on).toEqual([]);
  });
});

describe('striking a line', () => {
  it('does not file it', () => {
    const struck = strikeTicket(plan(), 'auction-notifications', true);
    expect(keptTickets(struck).map((t) => t.slug)).not.toContain('auction-notifications');
    expect(keptTickets(struck)).toHaveLength(4);
  });

  it('can be undone, because it is a toggle and not a deletion', () => {
    const back = strikeTicket(strikeTicket(plan(), 'auction-notifications', true), 'auction-notifications', false);
    expect(keptTickets(back)).toHaveLength(5);
    expect(effectiveDependsOn(back, 'auction-aggregator-qa')).toEqual(['auction-live-view', 'auction-notifications']);
  });

  it('leaves nothing depending on a ticket that will never be filed', () => {
    // QA depended on notifications. Strike notifications and QA must not carry a dependency on it —
    // it inherits what notifications needed instead. That the inherited edge is already implied by
    // another one is redundant and harmless; a dangling edge would not be.
    const struck = strikeTicket(plan(), 'auction-notifications', true);
    const deps = effectiveDependsOn(struck, 'auction-aggregator-qa');
    expect(deps).not.toContain('auction-notifications');
    expect(deps).toEqual(['auction-live-view', 'auction-feed-ingestion']);
  });

  it('passes a dependency through a struck line rather than dropping it', () => {
    // Strike ingestion and the view still needs the research that ingestion needed — the chain
    // shortens, it does not break.
    const struck = strikeTicket(plan(), 'auction-feed-ingestion', true);
    expect(effectiveDependsOn(struck, 'auction-live-view')).toEqual(['auction-source-research']);
  });

  it('passes it through two struck lines in a row', () => {
    // QA → live-view → ingestion → research, with the middle two struck. The chain shortens to the
    // research ticket rather than snapping.
    const struck = strikeTicket(strikeTicket(plan(), 'auction-feed-ingestion', true), 'auction-live-view', true);
    expect(effectiveDependsOn(struck, 'auction-aggregator-qa')).toEqual(['auction-notifications', 'auction-source-research']);
  });
});

describe('the order the set is filed in', () => {
  it('puts everything a ticket needs before the ticket', () => {
    const { ordered, cycle } = orderPlan(plan());
    expect(cycle).toEqual([]);
    const at = (slug: string) => ordered.findIndex((t) => t.slug === slug);
    expect(at('auction-source-research')).toBeLessThan(at('auction-feed-ingestion'));
    expect(at('auction-feed-ingestion')).toBeLessThan(at('auction-live-view'));
    expect(at('auction-live-view')).toBeLessThan(at('auction-aggregator-qa'));
    expect(at('auction-notifications')).toBeLessThan(at('auction-aggregator-qa'));
  });

  it('keeps the composer’s own order between tickets that do not depend on each other', () => {
    // The proposal already reads smallest-shippable-first; re-sorting it by name would throw away
    // the one piece of judgement the model contributed.
    const { ordered } = orderPlan(plan());
    expect(ordered.map((t) => t.slug)).toEqual([
      'auction-source-research', 'auction-feed-ingestion', 'auction-live-view',
      'auction-notifications', 'auction-aggregator-qa',
    ]);
  });

  it('orders what is left after a strike, not what was proposed', () => {
    const { ordered } = orderPlan(strikeTicket(plan(), 'auction-feed-ingestion', true));
    expect(ordered.map((t) => t.slug)).toEqual([
      'auction-source-research', 'auction-live-view', 'auction-notifications', 'auction-aggregator-qa',
    ]);
  });

  it('names the loop rather than filing an order it invented', () => {
    const looped = plan();
    looped.tickets[0].depends_on = ['auction-aggregator-qa'];
    const { ordered, cycle } = orderPlan(looped);
    expect(ordered).toEqual([]);
    expect(cycle).toHaveLength(5);
  });
});

describe('when a plan must not be filed at all', () => {
  it('is silent about a set that is fine', () => {
    expect(planProblem(plan())).toBeNull();
    expect(planProblem(strikeTicket(plan(), 'auction-notifications', true))).toBeNull();
  });

  it('says so when every line is struck', () => {
    let all = plan();
    for (const t of plan().tickets) all = strikeTicket(all, t.slug, true);
    expect(planProblem(all)).toMatch(/nothing to file/i);
  });

  it('refuses a dependency on something outside the plan', () => {
    const stray = plan();
    stray.tickets[1].depends_on = ['a-ticket-that-does-not-exist'];
    expect(planProblem(stray)).toMatch(/not in this plan/i);
  });

  it('refuses one that reaches a filed ticket through a struck line', () => {
    // `effectiveDependsOn` drops a slug it cannot find, so this filed happily with the dependency
    // silently gone — a founder left with `Depends on: —` where they had declared one.
    const stray = plan();
    stray.tickets[1].depends_on = ['a-ticket-that-does-not-exist'];
    expect(planProblem(strikeTicket(stray, 'auction-feed-ingestion', true))).toMatch(/not in this plan/i);
  });

  it('refuses a loop, and says which tickets are in it', () => {
    const looped = plan();
    looped.tickets[0].depends_on = ['auction-aggregator-qa'];
    expect(planProblem(looped)).toMatch(/loop/i);
    expect(planProblem(looped)).toContain('auction-source-research');
  });

  it('every refusal ends by saying nothing was filed', () => {
    const looped = plan();
    looped.tickets[0].depends_on = ['auction-aggregator-qa'];
    const stray = plan();
    stray.tickets[1].depends_on = ['nope-not-here'];
    for (const p of [looped, stray]) expect(planProblem(p)).toContain('Nothing was filed.');
  });
});

describe('one order for reading and for filing', () => {
  it('is the same list the filer writes', () => {
    // The panel rendered the composer's proposed order while the filer wrote the topological one.
    // A set proposed out of dependency order would have been read in one order and filed in another.
    const out = plan();
    out.tickets.reverse();
    expect(planFilingOrder(out).map((t) => t.slug)).toEqual(planOrder(out).map((t) => t.slug));
    expect(planOrder(out)[0]?.slug).toBe('auction-source-research');
  });

  it('does not reshuffle the list when a line is struck', () => {
    // A list that reorders under a founder's eyes when they strike something is a list they stop
    // trusting. Struck lines hold their place; only the filed set shortens.
    const before = planOrder(plan()).map((t) => t.slug);
    const after = planOrder(strikeTicket(plan(), 'auction-feed-ingestion', true)).map((t) => t.slug);
    expect(after).toEqual(before);
    expect(planFilingOrder(strikeTicket(plan(), 'auction-feed-ingestion', true)).map((t) => t.slug))
      .toEqual(before.filter((s) => s !== 'auction-feed-ingestion'));
  });

  it('still renders something when the plan loops', () => {
    // The set is refused; the panel still has to show the founder what it refused.
    const looped = plan();
    looped.tickets[0].depends_on = ['auction-aggregator-qa'];
    expect(planOrder(looped)).toHaveLength(5);
  });
});

describe('reading a venture’s own ticket prefix', () => {
  it('reads a hyphenated prefix, which the launch venture has', () => {
    // THE-RESET. The first version matched letters only, so it silently fell back to the repo name
    // — right by luck, and wrong the moment a box set a prefix of its own.
    expect(ticketPrefixFor('the-reset', ['THE-RESET-001-onboarding.md', 'THE-RESET-002-x.md'])).toBe('THE-RESET');
  });

  it('is not confused by a date in a ticket name', () => {
    expect(ticketPrefixFor('arca', ['ARCA-12-2024-notes.md'])).toBe('ARCA');
  });

  it('falls back to the repo when the backlog is empty', () => {
    expect(ticketPrefixFor('the-reset', [])).toBe('THE-RESET');
    expect(ticketPrefixFor('wealthcx01/arca', [])).toBe('ARCA');
  });
});

describe('handing the set its ids in one pass (FB-117, FB-118)', () => {
  // ARCA's real backlog: filed by hand, three digits, up to 067.
  const backlog = ['ARCA-001-terminal-setup.md', 'ARCA-066-e2e-smoke-in-ci.md', 'ARCA-067-api-key-in-source.md', 'README.md'];

  it('gives five tickets five different numbers', () => {
    const ids = allocatePlanIds('ARCA', backlog, orderPlan(plan()).ordered.map((t) => t.slug));
    expect(ids).toEqual(['ARCA-068', 'ARCA-069', 'ARCA-070', 'ARCA-071', 'ARCA-072']);
    expect(new Set(ids).size).toBe(5);
  });

  it('writes them at the width the backlog already uses', () => {
    // ARCA-068, not ARCA-68 — the seam FB-118 closed.
    expect(allocatePlanIds('ARCA', backlog, ['one'])[0]).toBe('ARCA-068');
  });

  it('skips the struck line rather than reserving a number for it', () => {
    const struck = strikeTicket(plan(), 'auction-notifications', true);
    const ids = allocatePlanIds('ARCA', backlog, orderPlan(struck).ordered.map((t) => t.slug));
    expect(ids).toEqual(['ARCA-068', 'ARCA-069', 'ARCA-070', 'ARCA-071']);
  });
});

describe('writing the real dependencies into the ticket', () => {
  const body = plan().tickets[1].body;

  it('replaces the placeholder the composer had to leave', () => {
    expect(withDependsOn(body, ['ARCA-068'])).toContain('**Depends on:** ARCA-068');
  });

  it('leaves the rest of the metadata line alone', () => {
    const out = withDependsOn(body, ['ARCA-068', 'ARCA-069']);
    expect(out).toContain('**Status:** Todo · **Area:** ETL · **Depends on:** ARCA-068, ARCA-069');
  });

  it('writes an em dash for a ticket that depends on nothing', () => {
    expect(withDependsOn(body, [])).toContain('**Depends on:** —');
  });

  it('adds the line to a metadata line that has none', () => {
    const out = withDependsOn('# T\n\n**Status:** Todo · **Area:** ETL\n\nbody', ['ARCA-068']);
    expect(out).toContain('**Status:** Todo · **Area:** ETL · **Depends on:** ARCA-068');
  });

  it('still says it when the composer wrote no metadata line at all', () => {
    expect(withDependsOn('# T\n\nbody', ['ARCA-068'])).toContain('**Depends on:** ARCA-068');
  });

  it('invents no line for a body that needs none', () => {
    expect(withDependsOn('# T\n\nbody', [])).toBe('# T\n\nbody');
  });
});

describe('where the set lands', () => {
  it('is one branch for the whole plan', () => {
    expect(planBranch(plan())).toBe('foundry/plan-auction-source-research');
  });

  it('does not change its name when a line is struck', () => {
    // It did, and the cost was a second branch and a second pull request on the retry the
    // idempotency is written for: strike the first line, press again, get a fresh set of numbers
    // while the first pull request still holds the originals.
    const struck = strikeTicket(plan(), 'auction-source-research', true);
    expect(planBranch(struck)).toBe('foundry/plan-auction-source-research');
  });

  it('never collides with the single-ticket filer’s branch names', () => {
    expect(planBranch(plan())).not.toBe('foundry/auction-source-research');
  });

  it('has nowhere to land when every line is struck', () => {
    let all = plan();
    for (const t of plan().tickets) all = strikeTicket(all, t.slug, true);
    expect(planBranch(all)).toBeNull();
  });
});
