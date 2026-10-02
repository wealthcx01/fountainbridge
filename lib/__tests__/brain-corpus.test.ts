import { describe, it, expect } from 'vitest';
import {
  CORPUS_RECORD_PATH, CORPUS_STALE_MS, NAMED_IN_NOTE, corpusNote, parseCorpusRecord, readCorpusText, type CorpusRead,
} from '../brain-corpus';
import { loadCorpusRead } from '../brain-corpus-load';
// @ts-expect-error — a plain .mjs module from the lane, no type declarations
import { RECORD_PATH, toRecord, parseGap } from '../../deploy/lane/brain-corpus-record.mjs';

/**
 * FB-169 — the Memory screen says how many documents the team cannot find.
 *
 * The cases that matter are the ones that must NOT read alike: no record, a record that cannot be
 * read, a check that did not finish, a measured zero, and a real gap.
 */
const NOW = Date.parse('2026-10-02T12:00:00Z');
const AT = '2026-10-02T11:00:00Z';
const opts = { ventureName: 'ARCA', nowMs: NOW };
const record = (over: Record<string, unknown> = {}): CorpusRead => {
  const r = parseCorpusRecord({ at: AT, corpus: 5, missingCount: 0, missing: [], ...over });
  if (!r) throw new Error('fixture is not a record');
  return { kind: 'record', record: r };
};

describe('the box and the studio agree on the record', () => {
  it('reads from the path the box writes to', () => {
    expect(CORPUS_RECORD_PATH).toBe(RECORD_PATH);
  });

  it('reads what the box writes, unchanged', () => {
    const written = toRecord(parseGap('3 5\ncontext/build/a.md\ncontext/build/b.md\ncontext/build/c.md'), { at: AT });
    expect(readCorpusText(JSON.stringify(written))).toEqual({
      kind: 'record',
      record: { at: AT, corpus: 5, missingCount: 3, missing: ['context/build/a.md', 'context/build/b.md', 'context/build/c.md'] },
    });
  });

  it('reads the box’s "could not check" as unknown, not as zero', () => {
    const written = toRecord(parseGap('?'), { at: AT });
    const read = readCorpusText(JSON.stringify(written));
    expect(read).toEqual({ kind: 'record', record: { at: AT, corpus: null, missingCount: null, missing: [] } });
  });
});

describe('reading the file', () => {
  it('no file is "absent", not a clean answer', () => {
    expect(readCorpusText(null)).toEqual({ kind: 'absent' });
  });

  it('a file that is there but broken is "unreadable", not "absent"', () => {
    expect(readCorpusText('{not json').kind).toBe('unreadable');
    expect(readCorpusText(JSON.stringify({ missingCount: 0 })).kind).toBe('unreadable'); // no date
    expect(readCorpusText(JSON.stringify({ at: AT, missingCount: -1 })).kind).toBe('unreadable');
  });

  it('believes the names over a count that is too small', () => {
    const r = parseCorpusRecord({ at: AT, corpus: 5, missingCount: 1, missing: ['a.md', 'b.md'] });
    expect(r?.missingCount).toBe(2);
  });
});

describe('the sentence under the table', () => {
  it('says plainly when nothing checks — never that nothing is missing', () => {
    const note = corpusNote({ kind: 'absent' }, opts);
    expect(note.tone).toBe('quiet');
    expect(note.text).toMatch(/^Nothing checks yet/);
    expect(note.text).toMatch(/cannot say whether any are missing/);
    expect(note.text).not.toMatch(/can find all/);
  });

  it('says it could not read the check, rather than guessing', () => {
    const note = corpusNote({ kind: 'unreadable', error: 'x' }, opts);
    expect(note.text).toMatch(/could not read the check/);
    expect(note.text).not.toMatch(/can find all|cannot find \d/);
  });

  it('says the check did not finish, distinct from a zero', () => {
    const note = corpusNote(record({ missingCount: null, corpus: null }), opts);
    expect(note.text).toMatch(/did not finish/);
    expect(note.text).not.toMatch(/can find all/);
  });

  it('says a measured zero as a zero, with the total and the day', () => {
    const note = corpusNote(record(), opts);
    expect(note).toEqual({ tone: 'quiet', text: 'Your team can find all 5 of your documents when it looks up what ARCA knows (checked 2 October).' });
  });

  it('counts and names what cannot be found, using the titles on the rows', () => {
    const note = corpusNote(
      record({ missingCount: 2, missing: ['context/build/policy.md', 'context/build/kraken-d-source-mismatch.md'] }),
      { ...opts, titles: new Map([['context/build/policy.md', 'No fake demo data']]) },
    );
    expect(note.tone).toBe('attention');
    expect(note.text).toMatch(/^Your team cannot find 2 documents of your 5 when it looks up what ARCA knows, so it works without them\./);
    // The title from the table where there is one; the file name in words where there is not.
    expect(note.text).toContain('They are: No fake demo data, kraken d source mismatch.');
    expect(note.text).toContain('nothing you need to do');
  });

  it('speaks of one document as one', () => {
    const note = corpusNote(record({ missingCount: 1, missing: ['context/build/a.md'] }), opts);
    expect(note.text).toMatch(/cannot find 1 document of your 5 .* without it\. It is: a\. It is still kept here/);
  });

  it('names only the first few, and counts the rest', () => {
    const missing = Array.from({ length: NAMED_IN_NOTE + 3 }, (_, i) => `context/sell/d${i}.md`);
    const note = corpusNote(record({ corpus: 20, missingCount: missing.length, missing }), opts);
    expect(note.text).toContain(`d${NAMED_IN_NOTE - 1}, and 3 more.`);
    expect(note.text).not.toContain(`d${NAMED_IN_NOTE},`);
  });

  it('says when the answer is old enough to doubt', () => {
    const old = new Date(NOW - CORPUS_STALE_MS - 60_000).toISOString();
    expect(corpusNote(record({ at: old }), opts).text).toMatch(/has not run since, so it may be out of date/);
    expect(corpusNote(record(), opts).text).not.toMatch(/out of date/);
  });
});

describe('loading it', () => {
  it('reads the venture’s first surface, which is the one its machine indexes', async () => {
    const asked: string[] = [];
    await loadCorpusRead(['arca', 'arca-marketing'], async (repo) => { asked.push(repo); return { kind: 'absent' }; });
    expect(asked).toEqual(['arca']);
  });

  it('turns a failed read into "unreadable", never a throw and never "absent"', async () => {
    const read = await loadCorpusRead(['arca'], async () => { throw new Error('rate limited'); });
    expect(read).toEqual({ kind: 'unreadable', error: 'rate limited' });
  });

  it('a venture with no surface has no record', async () => {
    expect(await loadCorpusRead([], async () => { throw new Error('should not be asked'); })).toEqual({ kind: 'absent' });
  });
});
