import { describe, it, expect } from 'vitest';
// The REAL parser the studio board renders from (lib/tickets.ts imports this same module). Asserting
// against a reimplementation here would prove nothing — the property that matters is that a founding
// run's output survives the actual pipeline it lands in.
import { parseTicket } from '../../../tools/ticket-parser/src/index';
import {
  extractJson,
  parseFoundingPlan,
  renderFoundingFiles,
  renderPrBody,
  idPrefix,
  slugify,
  MIN_TICKETS,
} from '../founding-lib.mjs';

const goodPlan = {
  northStar: 'Every Scottish tradesperson quotes in under two minutes, from their van.',
  goals: [
    { title: 'Ten paying trades by Christmas', why: 'proves someone will pay, not just nod' },
    { title: 'Quote-to-sent under 120 seconds', why: 'the whole promise, measured' },
  ],
  tickets: [
    { title: 'Quote builder v0', why: 'the core loop', scope: ['line items', 'totals'], acceptance: ['a quote can be created and sent'] },
    { title: 'Send a quote by SMS', why: 'where trades actually live', acceptance: ['an SMS arrives with a link'] },
    { title: 'Accept a quote', why: 'closes the loop', outOfScope: ['payments'], acceptance: ['a customer can accept', 'the trade is notified'] },
  ],
};

const render = (plan = goodPlan, opts = {}) =>
  renderFoundingFiles({ plan, ventureId: 'arca', ventureName: 'ARCA', ...opts });

describe('extractJson — a model returns JSON *somewhere*', () => {
  it('reads a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('reads a ```json fence', () => {
    expect(extractJson('Here is the plan:\n```json\n{"a":1}\n```\nHope that helps!')).toEqual({ a: 1 });
  });

  it('reads an unlabelled fence', () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('reads an object buried in prose, and stops at its real end', () => {
    // The naive lastIndexOf('}') would swallow the trailing sentence's brace and fail to parse.
    expect(extractJson('Thinking… {"a":{"b":2}} — and that closes the } discussion.')).toEqual({ a: { b: 2 } });
  });

  it('is not fooled by a brace inside a string', () => {
    expect(extractJson('{"a":"} not the end"}')).toEqual({ a: '} not the end' });
  });

  it('skips a prose fence and finds the real object after it', () => {
    expect(extractJson('```\njust thinking out loud\n```\n{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null on nothing parseable, including a truncated object', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('')).toBeNull();
    expect(extractJson('{"a": 1')).toBeNull(); // session cut off mid-plan
  });
});

describe('parseFoundingPlan — tolerant about wrapping, strict about shape', () => {
  it('accepts a good plan wrapped in prose and a fence', () => {
    const { plan, problems } = parseFoundingPlan('Sure!\n```json\n' + JSON.stringify(goodPlan) + '\n```');
    expect(problems).toEqual([]);
    expect(plan.northStar).toContain('two minutes');
    expect(plan.tickets).toHaveLength(3);
  });

  it('accepts north_star as well as northStar', () => {
    const { plan } = parseFoundingPlan({ ...goodPlan, northStar: undefined, north_star: 'A thing.' });
    expect(plan.northStar).toBe('A thing.');
  });

  it('refuses a plan with no north-star', () => {
    const { plan, problems } = parseFoundingPlan({ ...goodPlan, northStar: '  ' });
    expect(plan).toBeNull();
    expect(problems.join()).toMatch(/northStar/);
  });

  it(`refuses fewer than ${MIN_TICKETS} tickets — a founding run owes a backlog, not an idea`, () => {
    const { plan, problems } = parseFoundingPlan({ ...goodPlan, tickets: goodPlan.tickets.slice(0, 2) });
    expect(plan).toBeNull();
    expect(problems.join()).toMatch(/only 2 usable tickets/);
  });

  it('refuses a ticket with no acceptance criteria, naming it', () => {
    const tickets = [...goodPlan.tickets, { title: 'Do something vague' }];
    const { plan, problems } = parseFoundingPlan({ ...goodPlan, tickets });
    expect(plan).toBeNull();
    expect(problems.join()).toMatch(/Do something vague/);
  });

  it('refuses garbage rather than seeding a repo with it', () => {
    expect(parseFoundingPlan('the model apologised and wrote nothing').problems[0]).toMatch(/no JSON/);
    expect(parseFoundingPlan({}).plan).toBeNull();
  });

  it('drops untitled tickets instead of rendering an empty one', () => {
    const { plan } = parseFoundingPlan({ ...goodPlan, tickets: [...goodPlan.tickets, { title: '' }] });
    expect(plan.tickets).toHaveLength(3);
  });
});

describe('the rendered tickets are real tickets', () => {
  it('parses through the studio’s own parser with ZERO warnings', () => {
    for (const file of render().filter((f) => f.path.startsWith('docs/tickets/'))) {
      const { ticket, warnings } = parseTicket(file.content, { repo: 'arca', path: file.path });
      // A founding run whose output lands on the board flagged "may not be a ticket file" has failed
      // at the one thing it exists for.
      expect(warnings, `${file.path}: ${warnings.map((w) => w.code).join(', ')}`).toEqual([]);
      expect(ticket.id).toMatch(/^ARCA-\d{3}$/);
      expect(ticket.status).toBe('todo');
      expect(ticket.title).toBeTruthy();
      expect(ticket.branch).toMatch(/^arca-\d{3}-/);
    }
  });

  it('numbers sequentially and can start past an existing backlog', () => {
    const ids = render(goodPlan, { startAt: 7 })
      .filter((f) => f.path.startsWith('docs/tickets/'))
      .map((f) => parseTicket(f.content, { repo: 'arca', path: f.path }).ticket.id);
    expect(ids).toEqual(['ARCA-007', 'ARCA-008', 'ARCA-009']);
  });

  it('carries the scope, out-of-scope and acceptance criteria through as checkboxes', () => {
    const third = render().find((f) => f.path.includes('accept-a-quote'));
    expect(third.content).toContain('- [ ] a customer can accept');
    expect(third.content).toContain('## Out of scope');
    expect(third.content).toContain('- payments');
  });

  it('writes the north-star to context/, not to a ticket', () => {
    const files = render();
    const context = files.find((f) => f.path === 'context/north-star.md');
    expect(context.content).toContain('two minutes');
    expect(context.content).toContain('Ten paying trades by Christmas');
    expect(files.filter((f) => f.path.startsWith('docs/tickets/'))).toHaveLength(3);
  });

  it('gives every file a distinct path', () => {
    const paths = render().map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('id prefixes and slugs', () => {
  it('takes initials from a hyphenated venture id, first letters from a single word', () => {
    expect(idPrefix('the-reset')).toBe('TR');
    expect(idPrefix('arca')).toBe('ARCA');
    expect(idPrefix('modernisation-engine')).toBe('ME');
  });

  it('yields nothing for an id that cannot make a legal prefix', () => {
    // The parser needs 2+ letters; a one-letter or digits-only id cannot produce a valid ticket id,
    // and inventing one would put un-parseable tickets on a founder's board.
    expect(idPrefix('x')).toBe('');
    expect(idPrefix('123')).toBe('');
    expect(idPrefix('')).toBe('');
  });

  it('refuses to render rather than emit tickets the parser will reject', () => {
    expect(() => renderFoundingFiles({ plan: goodPlan, ventureId: '123', ventureName: 'X' })).toThrow(/prefix/);
  });

  it('slugifies to a safe filename fragment', () => {
    expect(slugify('Send a quote — by SMS!')).toBe('send-a-quote-by-sms');
    expect(slugify('  ')).toBe('');
  });
});

describe('the PR body is the founder’s decision point', () => {
  const body = renderPrBody({ plan: goodPlan, ventureName: 'ARCA', mission: 'Quoting is broken.\nFix it.', files: render() });

  it('leads with the north-star and lists the backlog', () => {
    expect(body).toContain('**North-star:**');
    expect(body).toContain('Quote builder v0');
    expect(body).toContain('Starter backlog (3 tickets)');
  });

  it('quotes the mission it was given, so the founder can judge the leap', () => {
    expect(body).toContain('> Quoting is broken.\n> Fix it.');
  });

  it('says plainly that nothing is authoritative until the human merges', () => {
    expect(body).toMatch(/Nothing[\s\S]*?authoritative until you say so/);
    expect(body).toContain('merging it is the decision');
  });
});
