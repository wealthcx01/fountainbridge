import { describe, it, expect } from 'vitest';
import {
  placeOf, titleOf, toDoc, byArea, describeSize, AREA_LABEL,
  whoAdded, originOf, describeOrigin, orderRows, memorySummary,
  type DocCommit, type KnowledgeRow,
} from '../knowledge';
import { onDate } from '../when';

describe('placing a document', () => {
  it('reads the area and the surface off the path', () => {
    expect(placeOf('context/sell/brand-positioning.md')).toEqual({ area: 'context', department: 'sell' });
    expect(placeOf('library/build/set-naming.md')).toEqual({ area: 'library', department: 'build' });
  });

  it('files a document deposited without a surface under general', () => {
    expect(placeOf('context/price-list.md')).toEqual({ area: 'context', department: 'general' });
  });

  it('ignores anything that is not in the corpus', () => {
    // The corpus is context/ and library/. A ticket is not a document a founder handed over.
    expect(placeOf('docs/tickets/ARCA-1-x.md')).toBeNull();
    expect(placeOf('README.md')).toBeNull();
    expect(placeOf('context/sell/deep/nested.md')).toBeNull();
  });
});

describe('naming a document', () => {
  it('prefers the name the founder gave it', () => {
    expect(titleOf('context/sell/x.md', '# Brand positioning\n\nbody')).toBe('Brand positioning');
  });

  it('falls back to a readable form of the filename', () => {
    expect(titleOf('context/sell/brand-positioning.md', null)).toBe('Brand positioning');
    expect(titleOf('context/general/price_list.md', 'no heading here')).toBe('Price list');
  });
});

describe('building the corpus for display', () => {
  const doc = (path: string, text: string | null = 'x', bytes = 100) => toDoc(path, text, bytes)!;

  it('keeps a document it cannot render, with its real size', () => {
    // A founder who uploaded a 2MB deck needs to see that it landed. Dropping it would teach them
    // the upload failed when it did not.
    const d = doc('library/build/deck.pdf', null, 2_000_000);
    expect(d.text).toBeNull();
    expect(describeSize(d.bytes)).toBe('1.9 MB');
  });

  it('groups by area and says what each area is for', () => {
    const groups = byArea([doc('library/build/b.md'), doc('context/sell/a.md')]);
    expect(groups.map((g) => g.area)).toEqual(['context', 'library']);
    expect(AREA_LABEL.context).toContain('reads before it works');
  });

  it('leaves out an area with nothing in it', () => {
    expect(byArea([doc('context/sell/a.md')]).map((g) => g.area)).toEqual(['context']);
  });

  it('sizes a document the way a person judges one', () => {
    expect(describeSize(400)).toBe('400 bytes');
    expect(describeSize(12_000)).toBe('12 KB');
  });
});

// --- provenance (FB-133) ----------------------------------------------------------------------

describe('who handed a document over', () => {
  it('names the founder when the studio wrote it', () => {
    expect(whoAdded({ messageHeadline: 'knowledge: price-list.pdf', authorName: 'foundry-studio' })).toBe('You');
  });

  it('names the composer rather than the founder when the composer deposited it', () => {
    // Not "You": the deposit tool is called by the machine during a founder's conversation, and
    // attributing its judgement to the founder is exactly the small lie this screen must not tell.
    expect(whoAdded({ messageHeadline: 'context: Brand positioning', authorName: 'arca-bot' })).toBe('Your composer');
  });

  it('falls back to whoever actually wrote it', () => {
    expect(whoAdded({ messageHeadline: 'sell: refresh the price list', authorName: 'Ross' })).toBe('Ross');
  });

  it('says "your team" only when there is no name at all', () => {
    expect(whoAdded({ messageHeadline: 'chore: tidy', authorName: null })).toBe('Your team');
    expect(whoAdded({ messageHeadline: 'chore: tidy', authorName: '  ' })).toBe('Your team');
  });
});

describe('reading a document’s origin', () => {
  const record = (over: Partial<DocCommit> = {}): DocCommit => ({
    committedDate: '2026-06-20T09:00:00Z',
    messageHeadline: 'knowledge: price-list.pdf',
    authorName: 'foundry-studio',
    totalCount: 1,
    ...over,
  });

  it('is an arrival when exactly one change touched the path', () => {
    expect(originOf(record())).toEqual({ kind: 'added', who: 'You', at: '2026-06-20T09:00:00Z' });
  });

  it('is a change, not an arrival, once the path has a history', () => {
    // The date we hold is the LAST change. Printing "Added" over it would be the invented number
    // this screen exists to refuse.
    expect(originOf(record({ totalCount: 4 }))).toEqual({
      kind: 'changed', who: 'You', at: '2026-06-20T09:00:00Z',
    });
  });

  it('is unknown when there is nothing to read, and never a default date', () => {
    expect(originOf(null)).toEqual({ kind: 'unknown' });
    expect(originOf(record({ committedDate: '' }))).toEqual({ kind: 'unknown' });
  });
});

describe('saying when a document arrived', () => {
  it('says Added for an arrival and Updated for a change', () => {
    expect(describeOrigin({ kind: 'added', who: 'You', at: '2026-06-20T09:00:00Z' }, onDate))
      .toBe('Added 20 June 2026');
    expect(describeOrigin({ kind: 'changed', who: 'You', at: '2026-06-20T09:00:00Z' }, onDate))
      .toBe('Updated 20 June 2026');
  });

  it('says nothing at all when it does not know', () => {
    expect(describeOrigin({ kind: 'unknown' }, onDate)).toBeNull();
    // An unreadable timestamp is the same absence, not a broken sentence with a blank in it.
    expect(describeOrigin({ kind: 'added', who: 'You', at: 'not-a-date' }, onDate)).toBeNull();
  });
});

describe('ordering the memory table', () => {
  const row = (path: string, origin: KnowledgeRow['origin']): KnowledgeRow => ({
    doc: toDoc(path, null, 10)!,
    origin,
  });

  it('puts the most recent first — a founder is checking this morning’s upload landed', () => {
    const rows = [
      row('context/sell/old.md', { kind: 'added', who: 'You', at: '2026-01-01T00:00:00Z' }),
      row('context/sell/new.md', { kind: 'changed', who: 'Ross', at: '2026-08-30T00:00:00Z' }),
      row('context/sell/mid.md', { kind: 'added', who: 'You', at: '2026-05-05T00:00:00Z' }),
    ];
    expect(orderRows(rows).map((r) => r.doc.path)).toEqual([
      'context/sell/new.md', 'context/sell/mid.md', 'context/sell/old.md',
    ]);
  });

  it('sinks the undated rather than floating them to the top', () => {
    // Undated at the top would read as "just now", which is the one thing it is not.
    const rows = [
      row('context/sell/undated.md', { kind: 'unknown' }),
      row('context/sell/dated.md', { kind: 'added', who: 'You', at: '2020-01-01T00:00:00Z' }),
    ];
    expect(orderRows(rows).map((r) => r.doc.path)).toEqual(['context/sell/dated.md', 'context/sell/undated.md']);
  });

  it('breaks ties on the title so the order is reproducible', () => {
    const rows = [
      row('context/sell/zebra.md', { kind: 'unknown' }),
      row('context/sell/apple.md', { kind: 'unknown' }),
    ];
    expect(orderRows(rows).map((r) => r.doc.title)).toEqual(['Apple', 'Zebra']);
  });

  it('does not mutate what it was given', () => {
    const rows = [
      row('context/sell/b.md', { kind: 'added', who: 'You', at: '2026-01-01T00:00:00Z' }),
      row('context/sell/a.md', { kind: 'added', who: 'You', at: '2026-09-01T00:00:00Z' }),
    ];
    const before = rows.map((r) => r.doc.path);
    orderRows(rows);
    expect(rows.map((r) => r.doc.path)).toEqual(before);
  });
});

describe('the sentence over the table', () => {
  const row = (path: string): KnowledgeRow => ({ doc: toDoc(path, null, 10)!, origin: { kind: 'unknown' } });

  it('counts what is on the screen and nothing else', () => {
    expect(memorySummary([row('context/sell/a.md'), row('library/build/b.md')]))
      .toBe('2 documents across 2 areas — background and artifacts.');
  });

  it('reads correctly for a single document in a single area', () => {
    expect(memorySummary([row('context/sell/a.md')]))
      .toBe(`1 document across 1 area — ${AREA_LABEL.context.toLowerCase()}.`);
  });

  it('says nothing has been handed over rather than "0 documents"', () => {
    expect(memorySummary([])).toBe('Nothing handed over yet.');
  });
});
