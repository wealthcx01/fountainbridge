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
    // FB-084 reads .docx/.pptx/.xlsx; these are the OLD binary formats, a different thing entirely.
    expect(refusalFor('deck.ppt')).toContain('an older slide deck');
    expect(refusalFor('model.xls')).toContain('an older spreadsheet');
    expect(refusalFor('brief.doc')).toContain('an older Word document');
    expect(refusalFor('logo.png')).toContain('an image');
    expect(refusalFor('bundle.zip')).toContain('an archive');
  });

  it('always offers a way forward', () => {
    for (const f of ['deck.ppt', 'model.xls', 'mystery.xyz', 'call.mp4']) {
      expect(refusalFor(f) ?? '', f).toMatch(/PDF|paste the part that matters|transcript/);
    }
  });

  it('refuses nothing it can actually read', () => {
    for (const f of ['notes.md', 'report.pdf', 'brief.docx', 'deck.pptx', 'model.xlsx']) {
      expect(refusalFor(f), f).toBeNull();
    }
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

  it('does not blame a scan for a document that read perfectly but is short', () => {
    // A .docx that extracted cleanly — no welded words, entities unescaped — but held thirteen words
    // was told it was "most likely a scan or photographs of pages". A founder can see it is not a
    // photograph, and starts wondering what else the studio is guessing at.
    const r = emptyRefusal('brief.docx', 'Positioning brief. Serious collectors want provenance they can trace.');
    expect(r).not.toContain('scan');
    expect(r).not.toContain('photographs');
    expect(r).toContain('9 words');
    expect(r).toContain('paste it into the chat');
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

describe('office documents (FB-084)', () => {
  it('reads the modern formats and refuses the old binary ones', async () => {
    const { documentKind } = await import('../documents');
    for (const f of ['brief.docx', 'deck.pptx', 'model.xlsx']) expect(documentKind(f), f).toBe('office');
    // `.doc` is a completely different format. Claiming to read one and returning nothing would be
    // worse than refusing it.
    for (const f of ['brief.doc', 'deck.ppt', 'model.xls']) expect(documentKind(f), f).toBe('unsupported');
  });

  it('does not weld words together when it strips the XML', async () => {
    // <w:t>Market</w:t><w:t>Movers</w:t> becomes "MarketMovers" if you strip tags indiscriminately.
    const { textFromOfficeXml } = await import('../documents');
    expect(textFromOfficeXml('<w:p><w:r><w:t>Market</w:t></w:r><w:r><w:t>Movers</w:t></w:r></w:p>'))
      .toBe('Market Movers');
  });

  it('reads slide text and unescapes what XML escaped', async () => {
    const { textFromOfficeXml } = await import('../documents');
    expect(textFromOfficeXml('<a:t>Card Ladder &amp; GemRate</a:t><a:t>&quot;the terminal&quot;</a:t>'))
      .toBe('Card Ladder & GemRate "the terminal"');
  });

  it('knows where the words live in each format', async () => {
    const { officeParts } = await import('../documents');
    expect(officeParts('a.docx').match('word/document.xml')).toBe(true);
    expect(officeParts('a.pptx').match('ppt/slides/slide3.xml')).toBe(true);
    expect(officeParts('a.pptx').match('ppt/slideLayouts/slideLayout1.xml')).toBe(false);
    expect(officeParts('a.xlsx').match('xl/sharedStrings.xml')).toBe(true);
    // Only a deck has an order that matters.
    expect(officeParts('a.pptx').ordered).toBe(true);
    expect(officeParts('a.docx').ordered).toBe(false);
  });

  it('puts a deck back in its own order', async () => {
    // A ZIP's entry order is not a deck's order: slide10 can precede slide2. Reading it shuffled
    // would hand the venture a market story with its argument out of sequence.
    const { slideNumber } = await import('../documents');
    const zipOrder = ['ppt/slides/slide10.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide1.xml'];
    expect([...zipOrder].sort((a, b) => slideNumber(a) - slideNumber(b)))
      .toEqual(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide10.xml']);
  });

  it('does not tell someone with a recording to export it as a PDF', async () => {
    // Nonsense advice, and a founder given it learns the studio is not listening. There is no ffmpeg
    // and no transcription on a venture box, and the refusal says so.
    const { refusalFor } = await import('../documents');
    for (const f of ['call.mp4', 'interview.mp3', 'demo.mov']) {
      expect(refusalFor(f), f).toContain('cannot listen');
      expect(refusalFor(f), f).not.toContain('Export it as a PDF');
      expect(refusalFor(f), f).toContain('transcript');
    }
  });
});
