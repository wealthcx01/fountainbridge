import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Which skills a worker used, read from what it already wrote (FB-231).
 *
 * Imports the module the lane actually calls, not a copy of it — the same rule as
 * `runreports-writer-shape.test.ts`, and for the same reason: a test against a copy proves the copy
 * works.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_MJS = resolve(HERE, '../../deploy/lane/skills-lib.mjs');
const { skillsInTranscript, sessionsForTicket, skillsForTicket } = await import(SKILLS_MJS);

/** One transcript line, in the shape Claude actually writes. Verified against a real transcript. */
const skillCall = (skill: string) => JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill, args: 'something' } }] },
});
const otherCall = (name: string) => JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name, input: { command: 'ls' } }] },
});
const indexLine = (session: string, ticket: string, stage: string) =>
  JSON.stringify({ session, ticket, stage, at: '2026-10-01T09:00:00Z' });

describe('reading skills out of a transcript', () => {
  it('finds the skills a worker used, in the order it first used them', () => {
    const text = [
      otherCall('Bash'),
      skillCall('write-tests'),
      otherCall('Read'),
      skillCall('compare-screenshots'),
    ].join('\n');
    expect(skillsInTranscript(text)).toEqual(['write-tests', 'compare-screenshots']);
  });

  it('names a skill once however many times it was used', () => {
    // A worker that runs /review three times used one skill, not three. The founder's question is
    // "what did it use", not "how many calls did it make".
    const text = [skillCall('review'), skillCall('write-tests'), skillCall('review')].join('\n');
    expect(skillsInTranscript(text)).toEqual(['review', 'write-tests']);
  });

  it('ignores every other tool, even one carrying a field called skill', () => {
    // The first version of this test used tools whose input had no `skill` key at all, so dropping
    // the tool-NAME check entirely still passed it. It proved the parse ignored tools that looked
    // nothing like a skill call, which was never in doubt.
    // It has to share a LINE with a genuine call, or the cheap `includes('"Skill"')` pre-filter
    // throws it away before the name check is reached — and then the test proves the filter rather
    // than the check. Found by deleting the name check and watching this still pass.
    const mixed = JSON.stringify({
      message: {
        content: [
          { type: 'tool_use', name: 'Skill', input: { skill: 'review' } },
          { type: 'tool_use', name: 'Task', input: { skill: 'not-a-skill-call' } },
        ],
      },
    });
    const text = [otherCall('Bash'), otherCall('Edit'), otherCall('Skillet'), mixed].join('\n');
    expect(skillsInTranscript(text)).toEqual(['review']);
  });

  it('ignores a skill name on something that is not a tool use', () => {
    const notAToolUse = JSON.stringify({
      message: { content: [{ type: 'tool_result', name: 'Skill', input: { skill: 'review' } }] },
    });
    expect(skillsInTranscript(notAToolUse)).toEqual([]);
  });

  it('survives a half-written last line, because a killed wake leaves one', () => {
    // Transcripts are append-only and a wake can be killed mid-write. One broken line must not cost
    // the other nine hundred.
    const text = `${skillCall('write-tests')}\n{"message":{"content":[{"type":"tool_u`;
    expect(skillsInTranscript(text)).toEqual(['write-tests']);
  });

  it('returns nothing for an empty or absent transcript rather than throwing', () => {
    expect(skillsInTranscript('')).toEqual([]);
    expect(skillsInTranscript(null)).toEqual([]);
    expect(skillsInTranscript(undefined)).toEqual([]);
  });

  it('does not mistake the word Skill elsewhere in a line for a skill call', () => {
    // The cheap string reject admits lines that merely mention it; the parse has to be the judge.
    const prose = JSON.stringify({
      message: { content: [{ type: 'text', text: 'I will invoke the "Skill" tool next' }] },
    });
    expect(skillsInTranscript(prose)).toEqual([]);
  });
});

describe('joining sessions to a ticket', () => {
  const index = [
    indexLine('s1', 'FB-231', 'plan'),
    indexLine('s2', 'FB-231', 'implement'),
    indexLine('s3', 'FB-999', 'implement'),
    indexLine('s4', 'FB-231', 'review'),
  ].join('\n');

  it('takes every session for the ticket and none of another ticket’s', () => {
    expect(sessionsForTicket(index, 'FB-231')).toEqual(['s1', 's2', 's4']);
    expect(sessionsForTicket(index, 'FB-999')).toEqual(['s3']);
  });

  it('returns nothing when the ticket is unknown or missing', () => {
    expect(sessionsForTicket(index, 'FB-000')).toEqual([]);
    expect(sessionsForTicket(index, '')).toEqual([]);
    expect(sessionsForTicket('', 'FB-231')).toEqual([]);
  });

  it('skips a half-written index line without losing the rest', () => {
    const broken = `${indexLine('s1', 'FB-231', 'plan')}\n{"session":"s2","tic\n${indexLine('s3', 'FB-231', 'qa')}`;
    expect(sessionsForTicket(broken, 'FB-231')).toEqual(['s1', 's3']);
  });
});

describe('the skills for one ticket, across the whole wake', () => {
  const index = [
    indexLine('plan-1', 'FB-231', 'plan'),
    indexLine('impl-1', 'FB-231', 'implement'),
    indexLine('review-1', 'FB-231', 'review'),
  ].join('\n');

  const transcripts: Record<string, string> = {
    'plan-1': skillCall('explore-unknowns'),
    'impl-1': [skillCall('write-tests'), skillCall('explore-unknowns')].join('\n'),
    'review-1': skillCall('review'),
  };

  it('unions across the five stages, because one wake is five sessions', () => {
    // supervisor.sh calls claude_lane five times for one ticket, each with its own session id and
    // deliberately no --resume. A founder asking "what did my team use on this" means the ticket.
    const used = skillsForTicket({
      indexText: index, ticket: 'FB-231', readTranscript: (s: string) => transcripts[s] ?? null,
    });
    expect(used).toEqual(['explore-unknowns', 'write-tests', 'review']);
  });

  it('keeps going when one stage’s transcript cannot be read', () => {
    // A missing fact, never a failed wake.
    const used = skillsForTicket({
      indexText: index,
      ticket: 'FB-231',
      readTranscript: (s: string) => {
        if (s === 'impl-1') throw new Error('EACCES');
        return transcripts[s] ?? null;
      },
    });
    expect(used).toEqual(['explore-unknowns', 'review']);
  });

  it('returns an empty list when nothing can be read at all, and never throws', () => {
    expect(skillsForTicket({
      indexText: index, ticket: 'FB-231', readTranscript: () => { throw new Error('nope'); },
    })).toEqual([]);
    expect(skillsForTicket({ indexText: '', ticket: 'FB-231', readTranscript: () => null })).toEqual([]);
  });
});

describe('what a founder reads on the ticket (FB-231)', () => {
  it('says nothing at all when nothing was recorded — the half that matters', async () => {
    // Empty means "none used" OR "this run predates the record" OR "the transcript was unreadable",
    // and nothing can tell those apart. Every one of ARCA's ~9,900 reports is in that state, so a
    // sentence here would state a fact about all of them that nobody measured.
    const { guidesClause } = await import('../trail');
    expect(guidesClause([])).toBe('');
    expect(guidesClause(['', '  '])).toBe('');
  });

  it('names the guides in words, not filenames', async () => {
    const { guidesClause } = await import('../trail');
    // "write-tests" is a filename. "write tests" is a thing a person does.
    expect(guidesClause(['write-tests'])).toBe(' It followed its write tests guide.');
    expect(guidesClause(['write-tests', 'compare-screenshots']))
      .toBe(' It followed its write tests and compare screenshots guides.');
  });

  it('never says the word "skill", which a founder has no reason to know', async () => {
    const { guidesClause } = await import('../trail');
    expect(guidesClause(['write-tests', 'audit-tests'])).not.toMatch(/skill/i);
  });

  it('caps the list, because nine names is not a sentence', async () => {
    const { guidesClause } = await import('../trail');
    const many = ['write-tests', 'audit-tests', 'code-hygiene', 'review', 'plain-english'];
    const said = guidesClause(many);
    expect(said).toContain('and 2 more');
    expect(said).not.toContain('plain english');
    expect(said.length).toBeLessThan(120);
  });

  it('reaches the trail a founder actually opens', async () => {
    // The clause is useless if it never gets rendered, which is the failure mode a pure-function
    // test cannot see.
    const { buildTrail } = await import('../trail');
    const trail = buildTrail({
      ventureId: 'arca',
      repo: 'arca',
      ticketId: 'ARCA-1',
      runs: [{
        laneId: 'build', startedAt: '2026-10-01T09:00:00Z', endedAt: '2026-10-01T09:30:00Z',
        trigger: 'scheduled', outcome: 'progress', summaryMd: 'worked', ticketsTouched: ['ARCA-1'],
        errorDetail: null, skillsUsed: ['write-tests'], prUrl: null, repo: 'arca', isHeartbeat: false,
      }],
      events: [], pr: null, approvalIds: [],
    } as never);
    const run = trail.hops.find((h: { source: string }) => h.source === 'run');
    expect(run?.text).toContain('It followed its write tests guide.');
  });
});

describe('the studio reads the field off the record (FB-231)', () => {
  const base = {
    lane_id: 'build', started_at: '2026-10-01T09:00:00Z', ended_at: '2026-10-01T09:30:00Z',
    trigger: 'scheduled', outcome: 'progress', summary_md: 'worked', tickets_touched: ['ARCA-1'],
  };

  it('parses skills_used from a contract-shaped report', async () => {
    const { fromLaneRecord } = await import('../runreports');
    const r = fromLaneRecord({ ...base, skills_used: ['write-tests', 'review'] }, 'arca');
    expect(r?.skillsUsed).toEqual(['write-tests', 'review']);
  });

  it('reads an old report with no such field as empty, never as missing', async () => {
    // Every report ARCA has written is this shape. It must parse, and it must not be a claim.
    const { fromLaneRecord } = await import('../runreports');
    expect(fromLaneRecord(base, 'arca')?.skillsUsed).toEqual([]);
  });

  it('refuses rubbish in the field rather than rendering it', async () => {
    const { fromLaneRecord } = await import('../runreports');
    expect(fromLaneRecord({ ...base, skills_used: 'write-tests' }, 'arca')?.skillsUsed).toEqual([]);
    expect(fromLaneRecord({ ...base, skills_used: [1, null, 'review', '  '] }, 'arca')?.skillsUsed)
      .toEqual(['review']);
  });

  it('the record the lane writes round-trips into the record the studio reads', async () => {
    // Writer and reader checked against each other, the same rule as runreports-writer-shape.
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const { buildRecord } = await import(resolve(here, '../../deploy/lane/runreport-record.mjs'));
    const { fromLaneRecord } = await import('../runreports');

    const written = buildRecord({
      slug: 'ARCA-1', status: 'progress', summary: 'did it', prUrl: '', started: base.started_at,
      repo: 'wealthcx01/arca', lane: 'arca', trigger: 'scheduled', now: base.ended_at,
      skillsUsed: ['write-tests', 'compare-screenshots'],
    });
    expect(written.skills_used).toEqual(['write-tests', 'compare-screenshots']);
    expect(fromLaneRecord(written, 'arca')?.skillsUsed)
      .toEqual(['write-tests', 'compare-screenshots']);
  });
});
