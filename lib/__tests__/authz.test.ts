import { describe, it, expect } from 'vitest';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '../authz';

// Mirrors the real manifests: arca's founder is John (who is also the admin), the-reset's is Ross.
const ventures = [
  { id: 'arca', founderEmail: 'john.gallagher@wealthcx.com' },
  { id: 'the-reset', founderEmail: 'ross@thereset.com' },
];
const admins = ['john.gallagher@wealthcx.com'];

describe('authorizeVentures — the three FB-005 acceptance cases', () => {
  it('admin (John) sees every venture', () => {
    const a = authorizeVentures('john.gallagher@wealthcx.com', ventures, admins);
    expect(a.isAdmin).toBe(true);
    expect([...a.ventureIds].sort()).toEqual(['arca', 'the-reset']);
  });

  it('a founder sees only their own venture', () => {
    const a = authorizeVentures('ross@thereset.com', ventures, admins);
    expect(a.isAdmin).toBe(false);
    expect(a.ventureIds).toEqual(['the-reset']);
  });

  it('an unlisted account sees nothing', () => {
    expect(authorizeVentures('nobody@example.com', ventures, admins)).toEqual({
      isAdmin: false,
      ventureIds: [],
    });
  });

  it('a signed-out identity sees nothing', () => {
    expect(authorizeVentures(null, ventures, admins).ventureIds).toEqual([]);
    expect(authorizeVentures(undefined, ventures, admins).ventureIds).toEqual([]);
  });

  it('matching is case- and whitespace-insensitive', () => {
    expect(authorizeVentures('  ROSS@TheReset.com ', ventures, admins).ventureIds).toEqual([
      'the-reset',
    ]);
  });

  it('a venture with no founder email is never matched by a founder', () => {
    const vs = [{ id: 'x', founderEmail: null }];
    expect(authorizeVentures('someone@x.com', vs, []).ventureIds).toEqual([]);
  });

  it('a blank/whitespace identity matches nothing — even a manifest with a blank founder email', () => {
    const vs = [{ id: 'blank', founderEmail: '   ' }];
    expect(authorizeVentures('   ', vs, ['   '])).toEqual({ isAdmin: false, ventureIds: [] });
    expect(authorizeVentures('', vs, [])).toEqual({ isAdmin: false, ventureIds: [] });
  });
});

describe('canAccessVenture', () => {
  it('admin can access any venture', () => {
    expect(canAccessVenture({ isAdmin: true, ventureIds: [] }, 'anything')).toBe(true);
  });
  it('a founder can access only listed ventures', () => {
    const a = { isAdmin: false, ventureIds: ['the-reset'] };
    expect(canAccessVenture(a, 'the-reset')).toBe(true);
    expect(canAccessVenture(a, 'arca')).toBe(false);
  });
});

describe('parseAdminEmails', () => {
  it('splits on commas/whitespace and trims', () => {
    expect(parseAdminEmails('a@x.com, b@y.com  c@z.com')).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
  });
  it('handles undefined/empty', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails('   ')).toEqual([]);
  });
});
