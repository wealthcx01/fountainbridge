import { describe, it, expect } from 'vitest';
import { isUnnumbered } from '../ticket-ids';

describe('spotting a ticket that never got a number', () => {
  it('knows one when it sees one, in either case', () => {
    expect(isUnnumbered('ARCA-NEW')).toBe(true);
    expect(isUnnumbered('sell-new')).toBe(true);
  });

  it('leaves real ids alone', () => {
    expect(isUnnumbered('ARCA-44')).toBe(false);
    expect(isUnnumbered('FB-097')).toBe(false);
    // "NEW" inside a name is not the placeholder suffix.
    expect(isUnnumbered('ARCA-12-NEWSLETTER')).toBe(false);
  });

  it('does not fall over on nothing', () => {
    expect(isUnnumbered(null)).toBe(false);
    expect(isUnnumbered(undefined)).toBe(false);
  });
});
