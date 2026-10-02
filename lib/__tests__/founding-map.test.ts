import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FOUNDING_MAP_PATH, FOUNDING_STAGES, MAP_MARKER, QUADRANTS, extractFoundingMap, foundingOpener,
  mapProblem, mapSections, parseFoundingMap, renderFoundingMapFile, traceProblem,
} from '../founding-map';
import { parseReply } from '../composer';
import { railState } from '../composer-rail';
import { strikeTicket } from '../plan-draft';
import { placeOf } from '../knowledge';
// @ts-expect-error — a plain .mjs module from the lane, no type declarations
import { corpusGap, pageNameOf, partitionForDepartment } from '../../deploy/lane/brain-lib.mjs';
import { MAP, MAP_BODY, PLAN, handOverReply } from './fixtures/founding-walk';

/**
 * Where a new venture's first tickets come from (FB-236).
 *
 * Three things are under test, and each is an acceptance criterion that can fail without anyone
 * noticing: the walk reached the unknown unknowns, every first ticket points back at the map, and
 * the map lands somewhere the venture brain will read it.
 */

const ROOT = join(__dirname, '..', '..');
const PROMPT = readFileSync(join(ROOT, 'deploy/librechat/seed-agent.js'), 'utf8');

describe('reading the map the composer handed over', () => {
  it('reads the map out of the last stage’s reply, beside the plan', () => {
    const map = extractFoundingMap(parseReply(handOverReply()));
    expect(map?.venture_id).toBe('kiln');
    expect(map?.idea).toContain('keep its own book');
  });

  it('splits it into the four quadrants, keeping every point', () => {
    const sections = mapSections(MAP);
    expect(sections.map((s) => s.quadrant)).toEqual([...QUADRANTS]);
    // A heading with an explanation after it still counts as its quadrant.
    expect(sections.find((s) => s.quadrant === 'Unknown unknowns')?.points).toHaveLength(3);
    expect(sections.find((s) => s.quadrant === 'Known unknowns')?.points).toHaveLength(4);
  });

  it('a block that is not a map is not a map', () => {
    expect(parseFoundingMap('{"foundry_plan":1}')).toBeNull();
    expect(parseFoundingMap('not json')).toBeNull();
    expect(parseFoundingMap(JSON.stringify({ [MAP_MARKER]: 1, venture_id: 'kiln', idea: 'x' }))).toBeNull();
  });

  it('refuses a map too long to be a map', () => {
    const huge = JSON.stringify({ [MAP_MARKER]: 1, ...MAP, body: `${MAP_BODY}\n${'- x\n'.repeat(10_000)}` });
    expect(parseFoundingMap(huge)).toBeNull();
  });
});

describe('the walk reached the unknown unknowns', () => {
  it('accepts a map that walked all four quadrants', () => {
    expect(mapProblem(MAP)).toBeNull();
  });

  it('refuses a map that stopped at the knowns', () => {
    // The failure this ticket names: a tidy list of what the founder already believed.
    const body = MAP_BODY.split('## Unknown unknowns')[0];
    expect(mapProblem({ ...MAP, body })).toMatch(/stops before the unknown unknowns — the risks nobody has thought of yet/);
  });

  it('refuses a map with the heading and nothing under it', () => {
    const body = `${MAP_BODY.split('## Unknown unknowns')[0]}## Unknown unknowns\n\nNone that I can see.`;
    expect(mapProblem({ ...MAP, body })).toMatch(/stops before the unknown unknowns — the risks nobody has thought of yet/);
  });

  it('refuses a map that skipped an earlier quadrant, and names it', () => {
    const body = MAP_BODY.replace(/## Unknown knowns[\s\S]*?(?=## Unknown unknowns)/, '');
    expect(mapProblem({ ...MAP, body })).toBe(
      'The map has nothing under unknown knowns. Ask the composer to fill that in before filing anything.',
    );
  });
});

describe('every first ticket points back at the map', () => {
  it('accepts a set whose every line names its part of the map', () => {
    expect(traceProblem(PLAN)).toBeNull();
  });

  it('refuses a line that does not, and names it', () => {
    const plan = { ...PLAN, tickets: PLAN.tickets.map((t, i) => (i === 2 ? { ...t, source: 'Seemed useful' } : t)) };
    expect(traceProblem(plan)).toContain('Ask the twelve owners');
  });

  it('a struck line is not held to it, because it is not being filed', () => {
    const plan = { ...PLAN, tickets: PLAN.tickets.map((t, i) => (i === 2 ? { ...t, source: 'Seemed useful' } : t)) };
    expect(traceProblem(strikeTicket(plan, 'ask-twelve-owners', true))).toBeNull();
  });
});

describe('the rail shows the map with its tickets', () => {
  it('carries the map in the plan state', () => {
    const state = railState({ latestReply: handOverReply(), aboutTicketId: null, filed: null });
    expect(state.kind).toBe('plan');
    if (state.kind !== 'plan') return;
    expect(state.plan.tickets).toHaveLength(5);
    expect(state.map?.idea).toBe(MAP.idea);
  });

  it('an ordinary plan has no map', () => {
    const reply = handOverReply().replace(/```\n\{"foundry_map"[^\n]*\n```\n/, '');
    const state = railState({ latestReply: reply, aboutTicketId: null, filed: null });
    expect(state.kind === 'plan' && state.map).toBeNull();
  });
});

describe('the browser test’s scripted reply is a real hand-over', () => {
  it('the composer fixture carries a map the studio accepts and five tickets that trace to it', () => {
    // e2e/founding.spec.ts drives the screen with this file. If it drifted from what the studio
    // accepts, the browser test would be photographing a refusal and calling it the happy path.
    const sse = readFileSync(join(ROOT, 'e2e/fixtures/composer/founding.sse'), 'utf8');
    const reply = sse.split('\n')
      .filter((l) => l.startsWith('data: {'))
      .map((l) => JSON.parse(l.slice(6)).choices?.[0]?.delta?.content ?? '')
      .join('');
    const state = railState({ latestReply: reply, aboutTicketId: null, filed: null });
    expect(state.kind).toBe('plan');
    if (state.kind !== 'plan' || !state.map) throw new Error('no map in the fixture');
    expect(state.plan.tickets).toHaveLength(5);
    expect(mapProblem(state.map)).toBeNull();
    expect(traceProblem(state.plan)).toBeNull();
  });
});

describe('the file the venture keeps', () => {
  const file = renderFoundingMapFile(MAP, [
    { id: 'KILN-001', title: 'Find out why the last two studio booking tools closed', source: 'Unknown unknowns: two earlier tools closed' },
  ]);

  it('carries the idea, every quadrant, and the tickets it produced with their ids', () => {
    expect(file).toContain(MAP.idea);
    for (const q of QUADRANTS) expect(file).toContain(`## ${q}`);
    expect(file).toContain('**KILN-001** — Find out why the last two studio booking tools closed (from: Unknown unknowns');
  });

  it('is saved where the venture brain reads it, and shared with every department', () => {
    // A map the brain skips is a map later work cannot plan from.
    expect(placeOf(FOUNDING_MAP_PATH)).toEqual({ area: 'context', department: 'general' });
    expect(corpusGap([FOUNDING_MAP_PATH], []).corpus).toBe(1);
    const page = { slug: pageNameOf(FOUNDING_MAP_PATH) };
    for (const dept of ['build', 'sell', 'scale']) expect(partitionForDepartment([page], dept)).toEqual([page]);
  });
});

describe('the composer on the box is told the same walk the studio checks', () => {
  // The walk's instructions live in seed-agent.js on a venture box, which cannot import this module.
  // So the two are held together here, the way method-drift holds the prompt to the playbook.

  it('names every stage of the walk', () => {
    for (const stage of FOUNDING_STAGES) expect(PROMPT).toContain(`**${stage.name}**`);
  });

  it('says the unknown unknowns may never be skipped', () => {
    expect(PROMPT).toMatch(/Never skip this stage/);
  });

  it('never lets the composer file a founding set itself', () => {
    expect(PROMPT).toMatch(/Never file a founding set yourself/);
  });

  it('the example map in the prompt is one the studio would accept', () => {
    // The prompt is a template literal: `\\n` in the source is `\n` in what the model reads, which
    // is what keeps the example valid JSON. A literal newline inside a JSON string would teach the
    // model to write maps the studio cannot read.
    const src = PROMPT.match(/\{"foundry_map":1,[\s\S]*?"body":"[^"]*"\}/)?.[0];
    expect(src, 'the prompt carries no example map').toBeTruthy();
    const asTheModelReadsIt = (src as string)
      .replace(/\n\s*/g, '')                       // the source's own line breaks sit between keys
      .replace(/\$\{VENTURE_ID\}/g, 'kiln')
      .replace(/\\(\\|n)/g, (_, c) => (c === 'n' ? '\n' : '\\'));   // what a template literal does
    const map = parseFoundingMap(asTheModelReadsIt);
    expect(map).not.toBeNull();
    expect(mapSections(map!).map((s) => s.quadrant)).toEqual([...QUADRANTS]);
  });

  it('day one types the same opener the composer suggests', () => {
    expect(PROMPT).toContain(foundingOpener('${VENTURE_NAME}'));
  });
});
