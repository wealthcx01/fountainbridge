import { describe, it, expect } from 'vitest';
import {
  lastUse, parseReadings, readingKey, readingsNote, workHref, NO_READINGS,
  type ReadingsRecord,
} from '../readings';

const record = (readings: Record<string, unknown>): ReadingsRecord => ({
  log: parseReadings({ version: 1, readings }),
  present: true,
  error: null,
});

const READ = {
  at: '2026-09-02T10:00:00Z',
  work: { kind: 'ticket', id: 'ARCA-31', title: 'Grading history', url: 'https://example.test/x' },
};

describe('joining a document to the record of what was read', () => {
  it('drops the extension, because the brain indexes paths without one', () => {
    expect(readingKey('context/sell/brand.md')).toBe('context/sell/brand');
    expect(readingKey('library/build/2026.09.plan.md')).toBe('library/build/2026.09.plan');
  });

  it('leaves a path alone when there is no extension to drop', () => {
    // A trailing dot is not an extension, and a dot in a directory name is not the file's.
    expect(readingKey('context/sell/brand')).toBe('context/sell/brand');
    expect(readingKey('context/v1.2/notes')).toBe('context/v1.2/notes');
  });

  it('finds the document the box recorded', () => {
    const use = lastUse(record({ 'context/sell/brand': READ }), 'context/sell/brand.md');
    expect(use).toEqual({ kind: 'used', at: READ.at, work: { ...READ.work } });
  });
});

describe('the three states, which must not collapse into one dash', () => {
  it('a document absent from a record that EXISTS has never been read', () => {
    expect(lastUse(record({ 'context/sell/other': READ }), 'context/sell/brand.md'))
      .toEqual({ kind: 'never' });
  });

  it('a venture with no record at all says so instead — that is not "never read"', () => {
    expect(lastUse(NO_READINGS, 'context/sell/brand.md')).toEqual({ kind: 'unrecorded' });
  });

  it('a record that could not be READ is never rendered as "never read"', () => {
    // The failure this whole screen exists to avoid: a broken read printed as a fact about the
    // venture. `unrecorded` is the studio admitting it does not know.
    const broken: ReadingsRecord = { log: new Map(), present: true, error: 'boom' };
    expect(lastUse(broken, 'context/sell/brand.md')).toEqual({ kind: 'unrecorded' });
  });
});

describe('parsing what the box wrote', () => {
  it('ignores entries with no instant — a reading with no date is not a reading', () => {
    const log = parseReadings({ readings: { 'context/a': { work: READ.work }, 'context/b': READ } });
    expect([...log.keys()]).toEqual(['context/b']);
  });

  it('keeps the date when the work cannot be named, rather than dropping the reading', () => {
    const log = parseReadings({ readings: { 'context/a': { at: READ.at, work: { kind: 'ticket' } } } });
    expect(log.get('context/a')).toEqual({ at: READ.at, work: null });
  });

  it('refuses a work URL that is not http(s)', () => {
    // The record comes off a git ref a lane writes to. A `javascript:` href rendered into the
    // founder's table would be a script the studio invited in.
    const log = parseReadings({
      readings: { 'context/a': { at: READ.at, work: { kind: 'ticket', id: 'A-1', title: 'A', url: 'javascript:alert(1)' } } },
    });
    expect(log.get('context/a')?.work?.url).toBeNull();
  });

  it('reads garbage as an empty record rather than throwing', () => {
    expect(parseReadings(null).size).toBe(0);
    expect(parseReadings({ readings: 'nope' }).size).toBe(0);
    expect(parseReadings({ readings: { 'context/a': 7 } }).size).toBe(0);
  });
});

describe('where a reading links to', () => {
  it('a ticket goes to this studio’s ticket view, not to a URL the box guessed', () => {
    expect(workHref({ kind: 'ticket', id: 'ARCA-31', title: 'x', url: 'https://example.test/x' }, 'arca'))
      .toBe('/venture/arca/tickets?t=ARCA-31');
  });

  it('anything else uses the URL the box gave, and nothing when it gave none', () => {
    expect(workHref({ kind: 'conversation', id: 'c1', title: 'x', url: 'https://example.test/c' }, 'arca'))
      .toBe('https://example.test/c');
    expect(workHref({ kind: 'conversation', id: 'c1', title: 'x', url: null }, 'arca')).toBeNull();
  });
});

describe('the sentence under the table', () => {
  it('says nothing is recorded when nothing is', () => {
    expect(readingsNote([NO_READINGS])).toMatch(/nothing on this venture records/);
  });

  it('names the mixed case rather than letting one surface speak for all of them', () => {
    const note = readingsNote([NO_READINGS, record({ 'context/a': READ })]) ?? '';
    expect(note).toMatch(/Some of your surfaces/);
  });

  it('once everything records, a dash means the document is unread', () => {
    expect(readingsNote([record({ 'context/a': READ })])).toMatch(/nothing has read that document yet/);
  });

  it('is silent when there are no surfaces to describe', () => {
    expect(readingsNote([])).toBeNull();
  });
});
