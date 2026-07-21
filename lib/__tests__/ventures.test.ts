import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadVentures } from '../ventures';

const DIR = join(process.cwd(), 'ventures');

describe('loadVentures (against the real ventures/ manifests)', () => {
  it('loads arca and the-reset, skips the example template', () => {
    const ids = loadVentures(DIR).map((v) => v.id);
    expect(ids).toContain('arca');
    expect(ids).toContain('the-reset');
    expect(ids).not.toContain('example-venture');
  });

  it('extracts the founder workspace email and name', () => {
    const reset = loadVentures(DIR).find((v) => v.id === 'the-reset');
    expect(reset?.founderEmail).toBe('ross@thereset.com');
    expect(reset?.founderName).toBe('Ross');
  });

  it('returns a sorted, summarized shape', () => {
    const vs = loadVentures(DIR);
    expect(vs.map((v) => v.id)).toEqual([...vs.map((v) => v.id)].sort());
    for (const v of vs) {
      expect(typeof v.name).toBe('string');
      expect(Array.isArray(v.repos)).toBe(true);
    }
  });

  it('returns [] for a missing directory (never throws)', () => {
    expect(loadVentures('/no/such/dir')).toEqual([]);
  });
});
