import { describe, it, expect } from 'vitest';
import { boardState, emptyPanel, firstName, welcome } from '../firstrun';

const signals = (over = {}) =>
  ({ ticketCount: 0, runCount: 0, approvalCount: 0, historyCount: 0, readFailures: [], ...over });

describe('deciding what the board should be', () => {
  it('shows the welcome when everything read cleanly and there is nothing yet', () => {
    expect(boardState(signals())).toEqual({ kind: 'first-run' });
  });

  it('never shows a welcome when something could not be read', () => {
    // The distinction the whole file turns on. "Nothing has happened yet" and "we could not find
    // out" are different facts, and showing the first for the second tells a founder their venture
    // is a blank page when really the studio could not read it.
    const s = boardState(signals({ readFailures: ['thereset-platform could not be reached'] }));
    expect(s.kind).toBe('unreadable');
    if (s.kind === 'unreadable') expect(s.reasons).toEqual(['thereset-platform could not be reached']);
  });

  it('shows the board as soon as there is anything at all', () => {
    expect(boardState(signals({ ticketCount: 1 })).kind).toBe('board');
    expect(boardState(signals({ runCount: 1 })).kind).toBe('board');
    expect(boardState(signals({ approvalCount: 1 })).kind).toBe('board');
  });

  it('does not call a venture with a failing build a blank page', () => {
    // A live bug in the first version of this. THE RESET's platform repo has a failing build from
    // January and nothing else — no tickets, no runs, no approvals — so the board decided it was
    // brand new and greeted the founder with "nothing has happened yet, which is exactly right for
    // day one" over a red build. Comforting someone about a problem they have is the exact failure
    // this ticket exists to fix.
    expect(boardState(signals({ historyCount: 1 })).kind).toBe('board');
  });

  it('prefers the real board over the failure note when there is something to show', () => {
    // A partly-readable venture with work in it is still a working board; the failures are surfaced
    // elsewhere (the lane error rows) rather than replacing everything the founder came for.
    expect(boardState(signals({ ticketCount: 3, readFailures: ['x'] })).kind).toBe('board');
  });
});

describe('what an empty panel says', () => {
  it('names what would fill it and how it starts', () => {
    const p = emptyPanel('tickets', true);
    expect(p.what).toContain('work your venture is doing');
    expect(p.how).toContain('Tell the studio what you want');
  });

  it('never offers an action that does not exist yet', () => {
    // A venture with no box has no composer to be told. Offering the step anyway is worse than
    // offering none, because the founder clicks it and finds nothing.
    const p = emptyPanel('tickets', false);
    expect(p.how).not.toContain('Tell the studio');
    expect(p.how).toContain('nothing for you to do yet');
  });

  it('reads an empty approvals queue as the good state, not as a gap', () => {
    // Nothing waiting for your OK is success. Phrasing it like a missing thing teaches a founder to
    // worry about the one surface that should be calm until it is not.
    const p = emptyPanel('approvals', true);
    expect(p.how).toContain('Nothing is waiting for you');
  });

  it('explains that runs follow work, rather than implying the founder missed a step', () => {
    expect(emptyPanel('runs', true).how).toContain('after there is a piece of work');
  });
});

describe('the welcome', () => {
  it('greets the founder by name and offers exactly one action', () => {
    const w = welcome('THE RESET', 'Ross', true);
    expect(w.greeting).toBe('Welcome, Ross.');
    expect(w.action?.label).toBe('Tell the studio what you want');
    expect(w.action?.href('the-reset')).toBe('/venture/the-reset/composer');
  });

  it('falls back to the venture when there is no founder name', () => {
    expect(welcome('THE RESET', null, true).greeting).toBe('Welcome to THE RESET.');
  });

  it('says day one is meant to look like this', () => {
    // A blank page reads as a broken product unless something says otherwise.
    expect(welcome('THE RESET', 'Ross', true).body).toContain('exactly right for day one');
  });

  it('offers no action, and says so, when the venture has no box yet', () => {
    // Nothing to click and nothing to do — but the founder is told that plainly rather than being
    // left to work out why the page is empty.
    const w = welcome('THE RESET', 'Ross', false);
    expect(w.action).toBeNull();
    expect(w.waiting).toContain('fill up on its own');
    expect(w.body).toContain('you do not need to do anything');
    // A page with nothing to do AND nothing to read is indistinguishable from a broken one, so it
    // says what it is for instead.
    expect(w.coming.length).toBeGreaterThan(0);
  });

  it('lists nothing beside the action when there IS one', () => {
    // The ticket's own words: nothing else competes with it.
    expect(welcome('THE RESET', 'Ross', true).coming).toEqual([]);
  });
});

describe('greeting someone by name', () => {
  it('uses the first name', () => {
    expect(firstName('Ross Cameron')).toBe('Ross');
  });

  it('copes with one name, extra spaces, and none at all', () => {
    expect(firstName('Ross')).toBe('Ross');
    expect(firstName('  Ross   Cameron ')).toBe('Ross');
    expect(firstName(null)).toBeNull();
    expect(firstName('   ')).toBeNull();
  });
});
