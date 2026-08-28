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
    expect(activeKey('/venture/arca/activity', base)).toBe('activity');
    expect(activeKey('/venture/arca/knowledge', base)).toBe('memory');
    expect(activeKey('/venture/arca/handbook', base)).toBe('handbook');
  });

  it('keeps a chapter under its section rather than falling back to the desk', () => {
    // The desk's href is the empty string and therefore a prefix of everything. Longest match wins,
    // which is why the desk is the fallback rather than the first hit.
    expect(activeKey('/venture/arca/handbook/how-we-build', base)).toBe('handbook');
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
  it('never marks Needs you, which leaves the venture subtree entirely', () => {
    // "Needs you" points at /attention today — a real screen that works, and the one FB-129 will
    // absorb. It is a shortcut, not a section, so no venture route may highlight it.
    for (const p of ['/venture/arca', '/venture/arca/activity', '/venture/arca/knowledge', '/attention']) {
      expect(activeKey(p, '/venture/arca'), p).not.toBe('needs');
    }
  });

  it('every row goes somewhere that exists today', () => {
    // The defect this locks out: the first rail listed Tickets, whose screen is FB-129 and does not
    // exist. The link 404'd, and Next's prefetch fired that 404 on every venture page load before a
    // founder clicked anything. design-lint did not catch it because it only sees buttons.
    expect(activeKey('/venture/arca/tickets', '/venture/arca')).toBe('desk');
  });
});
