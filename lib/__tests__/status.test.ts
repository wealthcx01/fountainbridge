import { describe, it, expect } from 'vitest';
import {
  TONES,
  TONE_MEANING,
  toneColor,
  ciRunTone,
  prCiTone,
  ticketTone,
  approvalTone,
  laneErrorTone,
  type Tone,
} from '../status';

// The point of one status vocabulary is that a founder learns a colour once. These tests pin the
// two properties that makes true: every domain status maps to a tone, and a tone renders as a
// token rather than a colour. The specific mappings are pinned too — a silent re-tone is a design
// change that should have to argue for itself in a diff.

describe('the tone vocabulary', () => {
  it('is exactly five tones, each with a stated meaning', () => {
    expect(TONES).toEqual(['ok', 'working', 'attention', 'blocked', 'idle']);
    for (const tone of TONES) expect(TONE_MEANING[tone]).toBeTruthy();
  });

  it('renders every tone as a token, never a colour', () => {
    for (const tone of TONES) {
      expect(toneColor(tone)).toBe(`var(--tone-${tone})`);
      expect(toneColor(tone)).not.toMatch(/#[0-9a-f]/i);
    }
  });
});

describe('every domain status maps onto the vocabulary', () => {
  const inVocabulary = (t: Tone) => expect(TONES).toContain(t);

  it('CI run conclusions', () => {
    expect(ciRunTone('success')).toBe('ok');
    expect(ciRunTone('failure')).toBe('blocked');
    expect(ciRunTone('in_progress')).toBe('working');
    // A cancelled run is idle, not blocked: nobody has to act on it.
    expect(ciRunTone('cancelled')).toBe('idle');
    expect(ciRunTone('unknown')).toBe('idle');
    // No CI at all is the common first-run state and must not read as a failure.
    expect(ciRunTone(undefined)).toBe('idle');
  });

  it('PR check status', () => {
    (['success', 'failure', 'pending', 'unknown'] as const).forEach((s) => inVocabulary(prCiTone(s)));
    expect(prCiTone('failure')).toBe('blocked');
    expect(prCiTone('pending')).toBe('working');
  });

  it('ticket columns — pr-open is the founder’s turn, so it reads as attention', () => {
    expect(ticketTone('done')).toBe('ok');
    expect(ticketTone('in-progress')).toBe('working');
    expect(ticketTone('pr-open')).toBe('attention');
    expect(ticketTone('todo')).toBe('idle');
  });

  it('approvals — proposed is attention, because nothing external moves without a human', () => {
    expect(approvalTone('proposed')).toBe('attention');
    expect(approvalTone('granted')).toBe('working');
    expect(approvalTone('executing')).toBe('working');
    expect(approvalTone('executed')).toBe('ok');
    expect(approvalTone('rejected')).toBe('blocked');
  });

  it('lane faults — only the two known setup states are benign (FB-021)', () => {
    expect(laneErrorTone('no-credentials')).toBe('attention');
    expect(laneErrorTone('unreadable')).toBe('attention');
    // Everything else fails loud. An unclassified fault dressed as a benign notice is exactly the
    // silent-failure mode non-negotiable 10 exists to prevent.
    expect(laneErrorTone('error')).toBe('blocked');
    expect(laneErrorTone('rate-limit')).toBe('blocked');
    expect(laneErrorTone(null)).toBe('blocked');
  });
});
