import { describe, it, expect } from 'vitest';
import { mergeReadings, parseUsedFile } from '../readings-record.mjs';
import { digestWithPages, formatDigest } from '../brain-lib.mjs';

const work = { kind: 'ticket', id: 'ARCA-31', title: 'Grading history', url: '' };
const AT = '2026-09-02T10:00:00Z';

describe('what gets recorded as read', () => {
  it('records the founder’s corpus and nothing else', () => {
    // The brain indexes the whole repo. `Last used` is a column on the corpus, so a lane re-reading
    // its own ticket file must not appear there — it would be a row the screen cannot show.
    const out = mergeReadings('', ['context/sell/brand', 'docs/tickets/arca-31', 'src/app/page.tsx', 'library/build/spec'], work, AT);
    expect(Object.keys(out.readings).sort()).toEqual(['context/sell/brand', 'library/build/spec']);
  });

  it('keeps one entry per document, newest wins', () => {
    const first = mergeReadings('', ['context/sell/brand'], work, '2026-09-01T00:00:00Z');
    const second = mergeReadings(JSON.stringify(first), ['context/sell/brand'], { ...work, id: 'ARCA-40' }, AT);
    expect(Object.keys(second.readings)).toHaveLength(1);
    expect(second.readings['context/sell/brand']).toEqual({
      at: AT, work: { kind: 'ticket', id: 'ARCA-40', title: 'Grading history' },
    });
  });

  it('leaves documents this run did not read exactly as they were', () => {
    // The record is a merge, not a snapshot. A run that reads one document must not erase the dates
    // on every other one — which is what a naive rewrite would do, invisibly, forever.
    const first = mergeReadings('', ['context/sell/brand'], work, '2026-09-01T00:00:00Z');
    const second = mergeReadings(JSON.stringify(first), ['context/build/other'], work, AT);
    expect(second.readings['context/sell/brand'].at).toBe('2026-09-01T00:00:00Z');
    expect(second.readings['context/build/other'].at).toBe(AT);
  });

  it('starts again on an unreadable record rather than never recording again', () => {
    const out = mergeReadings('{ not json', ['context/sell/brand'], work, AT);
    expect(Object.keys(out.readings)).toEqual(['context/sell/brand']);
  });

  it('omits a URL rather than writing an empty one', () => {
    const out = mergeReadings('', ['context/sell/brand'], work, AT);
    expect(out.readings['context/sell/brand'].work).not.toHaveProperty('url');
  });

  it('reads the used-file as one slug per line, deduped', () => {
    expect(parseUsedFile('context/a\n\ncontext/b\ncontext/a\n')).toEqual(['context/a', 'context/b']);
    expect(parseUsedFile('')).toEqual([]);
  });
});

describe('the record and the prompt cannot disagree (FB-156)', () => {
  const page = (slug, score, text) => ({ slug, title: slug, score, chunk_text: text });

  it('records the pages the model was SHOWN, not the pages the index returned', () => {
    // A page can be dropped twice on the way into a digest: an excerpt that comes back empty, and
    // the maxChars break. Recording the retrieved set instead would put documents in the founder's
    // `Last used` column that nothing ever read.
    const results = [page('context/a', 0.9, 'real prose'), page('context/b', 0.8, '```only code```')];
    const { digest, slugs } = digestWithPages(results);
    expect(slugs).toEqual(['context/a']);
    expect(digest).not.toContain('context/b');
  });

  it('stops recording where the digest stops', () => {
    const results = [page('context/a', 0.9, 'x'.repeat(400)), page('context/b', 0.8, 'y'.repeat(400))];
    const { digest, slugs } = digestWithPages(results, { maxChars: 300, perPageChars: 400 });
    for (const slug of slugs) expect(digest).toContain(slug);
    expect(slugs.length).toBeLessThan(2);
  });

  it('formatDigest still returns the string every caller expects', () => {
    const results = [page('context/a', 0.9, 'real prose')];
    expect(formatDigest(results)).toBe(digestWithPages(results).digest);
    expect(typeof formatDigest(results)).toBe('string');
  });
});
