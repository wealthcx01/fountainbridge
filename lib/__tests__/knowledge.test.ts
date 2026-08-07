import { describe, it, expect } from 'vitest';
import { placeOf, titleOf, toDoc, byArea, describeSize, AREA_LABEL } from '../knowledge';

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
