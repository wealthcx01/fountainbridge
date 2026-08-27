import { describe, it, expect } from 'vitest';
import { activeKey } from '../../components/RailNav';

/**
 * The rail (FB-124).
 *
 * `activeKey` is the one piece of logic in the rail worth testing on its own: everything else is
 * layout, and the thing that goes wrong with a nav is a route matching the wrong row — which is
 * invisible until someone notices the wrong item is highlighted on a page they rarely visit.
 */
describe('which rail row is the current screen', () => {
  const base = '/venture/arca';

  it('marks the desk on the venture root', () => {
    expect(activeKey('/venture/arca', base)).toBe('desk');
  });

  it('marks each section from its own route', () => {
    expect(activeKey('/venture/arca/tickets', base)).toBe('tickets');
    expect(activeKey('/venture/arca/activity', base)).toBe('activity');
    expect(activeKey('/venture/arca/knowledge', base)).toBe('memory');
    expect(activeKey('/venture/arca/handbook', base)).toBe('handbook');
  });

  it('keeps a chapter under its section rather than falling back to the desk', () => {
    // The desk's href is the empty string and therefore a prefix of everything. Longest match wins,
    // which is why the desk is the fallback rather than the first hit.
    expect(activeKey('/venture/arca/handbook/how-we-build', base)).toBe('handbook');
    expect(activeKey('/venture/arca/tickets/ARCA-068', base)).toBe('tickets');
  });

  it('is not confused by a venture id that contains another route name', () => {
    expect(activeKey('/venture/tickets-co/knowledge', '/venture/tickets-co')).toBe('memory');
  });

  it('falls back to the desk for a route the rail does not list', () => {
    // `work/[repo]/[number]` is a real route with no rail row. Highlighting nothing is wrong;
    // highlighting the wrong thing is worse. The desk is where that founder came from.
    expect(activeKey('/venture/arca/work/arca/58', base)).toBe('desk');
  });
});

describe('a shortcut is not a section', () => {
  it('marks Tickets, not Needs you, on the needs-you filter', () => {
    // "Needs you" is /tickets?filter=needs — a filtered view. `usePathname()` carries no query, so a
    // path-based match would tie with Tickets and win on raw length, highlighting the shortcut on
    // every ticket route. The section a founder is in is Tickets; Needs you is how they got there.
    expect(activeKey('/venture/arca/tickets', '/venture/arca')).toBe('tickets');
    expect(activeKey('/venture/arca/tickets/ARCA-068', '/venture/arca')).toBe('tickets');
  });
});
