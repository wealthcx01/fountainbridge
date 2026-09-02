import { describe, it, expect } from 'vitest';
import { shouldNotify, pushMessage, pushDestination } from '../push';

/**
 * The one push (FB-141).
 *
 * "Nothing else pushes" is the kind of rule that erodes one well-meant addition at a time, so it is
 * pinned here rather than left to judgement.
 */
describe('when a founder’s phone should buzz', () => {
  it('fires when the queue goes from empty to not', () => {
    expect(shouldNotify({ before: 0, now: 1 })).toBe(true);
    expect(shouldNotify({ before: 0, now: 6 })).toBe(true);
  });

  it('stays silent for every item after the first', () => {
    // Nine decisions must not be nine buzzes. A phone that buzzes nine times is a phone whose owner
    // turns notifications off, which loses the one notification that mattered.
    expect(shouldNotify({ before: 1, now: 2 })).toBe(false);
    expect(shouldNotify({ before: 5, now: 9 })).toBe(false);
  });

  it('stays silent when the queue shrinks or clears', () => {
    expect(shouldNotify({ before: 3, now: 1 })).toBe(false);
    expect(shouldNotify({ before: 3, now: 0 })).toBe(false);
    expect(shouldNotify({ before: 0, now: 0 })).toBe(false);
  });

  it('fires again after the queue has been cleared', () => {
    // The transition is what matters, so a founder who clears everything and is blocked again the
    // next morning is told again.
    expect(shouldNotify({ before: 0, now: 2 })).toBe(true);
  });

  it('never buzzes on the first look at a queue', () => {
    // A founder installing the studio and immediately being buzzed about a backlog that has been
    // there a week is a notification about the past, and it teaches them the buzz does not mean
    // "something just happened".
    expect(shouldNotify({ before: null, now: 6 })).toBe(false);
    expect(shouldNotify({ before: null, now: 0 })).toBe(false);
  });
});

describe('what the push says', () => {
  it('names the venture and counts what waits', () => {
    expect(pushMessage('ARCA', 6)).toEqual({
      title: 'ARCA needs you',
      body: '6 things are waiting on your decision.',
    });
    expect(pushMessage('ARCA', 1).body).toBe('One thing is waiting on your decision.');
  });

  it('says nothing about WHAT is waiting', () => {
    // A lock screen is read by whoever is holding the phone, and the titles of a venture's work are
    // not for them.
    const { title, body } = pushMessage('ARCA', 3);
    expect(`${title} ${body}`).not.toMatch(/ARCA-\d/);
  });
});

describe('where the push opens', () => {
  it('opens the queue, filtered to what waits on this founder', () => {
    // Not the desk. A founder woken by a buzz has one question, and answering it with a whole screen
    // and a search is how a useful notification becomes an annoying one.
    expect(pushDestination('arca')).toBe('/venture/arca/tickets?filter=needs');
  });
});
