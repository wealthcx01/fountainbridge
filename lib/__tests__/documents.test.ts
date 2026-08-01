import { describe, it, expect } from 'vitest';
import {
  describeExtraction, documentKind, emptyRefusal, looksEmpty, refusalFor, tooLargeRefusal,
  MAX_DOCUMENT_BYTES,
} from '../documents';

describe('what a founder handed over', () => {
  it('reads the documents founders actually have', () => {
    for (const f of ['notes.md', 'data.csv', 'config.yaml', 'export.json', 'run.log']) {
      expect(documentKind(f), f).toBe('text');
    }
    expect(documentKind('market-report.pdf')).toBe('pdf');
    expect(documentKind('MARKET-REPORT.PDF')).toBe('pdf');
  });

  it('names the format it cannot read, rather than shrugging', () => {
    // "Unsupported file type" reads as a shrug; a founder cannot tell whether it is coming later or
    // never. Naming it reads as a decision.
    expect(refusalFor('deck.pptx')).toContain('a slide deck');
    expect(refusalFor('model.xlsx')).toContain('a spreadsheet');
    expect(refusalFor('brief.docx')).toContain('a Word document');
    expect(refusalFor('logo.png')).toContain('an image');
    expect(refusalFor('bundle.zip')).toContain('an archive');
  });

  it('always offers a way forward', () => {
    for (const f of ['deck.pptx', 'model.xlsx', 'mystery.xyz']) {
      expect(refusalFor(f), f).toMatch(/PDF|paste the part that matters/);
    }
  });

  it('refuses nothing it can actually read', () => {
    expect(refusalFor('notes.md')).toBeNull();
    expect(refusalFor('report.pdf')).toBeNull();
  });
});

describe('the refusal that matters most', () => {
  it('knows a scanned PDF when the text comes back empty', () => {
    // Pages of images with no text layer extract to a handful of stray characters. Depositing that
    // would teach the venture brain that a 60-page market report contains nothing.
    expect(looksEmpty('')).toBe(true);
    expect(looksEmpty('   \n  \n ')).toBe(true);
    expect(looksEmpty('1 2 3 4 5 6 7 8 9 10 11 12')).toBe(true);   // page numbers only
    expect(looksEmpty('\f \f \f')).toBe(true);
  });

  it('accepts a short but real document', () => {
    // A one-page note is legitimate and must not be mistaken for a failed scan.
    expect(looksEmpty(
      'Our positioning is that serious collectors want a terminal, not a price lookup. '
      + 'The wedge is graded cards where the population data already exists.',
    )).toBe(false);
  });

  it('says nothing was saved, and why, and what would work', () => {
    const r = emptyRefusal('scan.pdf');
    expect(r).toContain('scan.pdf');
    expect(r).toContain('Nothing was saved');
    expect(r).toContain('selectable text');
  });
});

describe('saying what was understood', () => {
  it('says the size back, so a founder can catch a partial read', () => {
    // A silent "saved" on a 60-page report is indistinguishable from a failed extraction.
    const d = describeExtraction({ name: 'market.pdf', text: 'word '.repeat(4200), pages: 62 });
    expect(d).toContain('market.pdf');
    expect(d).toContain('62 pages');
    expect(d).toContain('4.2 thousand words');
  });

  it('counts small documents exactly rather than rounding to nothing', () => {
    expect(describeExtraction({ name: 'note.md', text: 'one two three' })).toContain('about 3 words');
  });

  it('leaves the page count out when the format has none', () => {
    expect(describeExtraction({ name: 'note.md', text: 'a b c' })).not.toContain('page');
  });
});

describe('the size limit', () => {
  it('says the size, the limit, and what to do', () => {
    const r = tooLargeRefusal('huge.pdf', 40 * 1024 * 1024);
    expect(r).toContain('40MB');
    expect(r).toContain(`${MAX_DOCUMENT_BYTES / 1024 / 1024}MB`);
    expect(r).toContain('Split it');
  });
});
