import { beforeEach, describe, expect, it, vi } from 'vitest';

// The server actions, replaced: these tests are about what the component does with their answer.
const { acceptWork, sendBackWork } = vi.hoisted(() => ({ acceptWork: vi.fn(), sendBackWork: vi.fn() }));
vi.mock('@/app/actions/work', () => ({ acceptWork, sendBackWork }));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * FB-273: Accept and Send back are drawn by one component, `components/Decision.tsx`.
 *
 * Two things are held here. What a press does, which is the same on every screen. And what each
 * screen shows before anyone presses, which must stay exactly as it was: the screens' own browser
 * tests (`e2e/work.spec.ts`, `e2e/tickets-view.spec.ts`) find these buttons by their test ids.
 */

// Under vitest, JSX compiles to `React.createElement`; the component expects it in scope.
(globalThis as { React?: typeof React }).React = React;
const { Decision, decisionOutcome, press } = await import('@/components/Decision');

const WORK = { repo: 'arca', number: 10, headSha: 'abc1234' };
const SIGNED_OFF = { ok: true, signedOff: true, message: 'Signed off by you, waiting for John. Nothing changes in your product until he approves it.' };
const MERGED = { ok: true, message: 'Accepted. It is now part of your product.' };
const SENT = { ok: true, message: 'Sent. Your team picks this up on its next wake.' };

beforeEach(() => {
  acceptWork.mockReset();
  sendBackWork.mockReset();
});

describe('a press', () => {
  it('Accept passes the commit the founder was shown, and says it was an Accept', async () => {
    acceptWork.mockResolvedValue(SIGNED_OFF);
    const r = await press('arca', WORK, 'accept');
    expect(acceptWork).toHaveBeenCalledWith('arca', 'arca', 10, 'abc1234');
    expect(sendBackWork).not.toHaveBeenCalled();
    expect(r).toEqual({ ...SIGNED_OFF, decided: 'accept' });
  });

  it('Accept without a commit sends none, rather than an empty one', async () => {
    acceptWork.mockResolvedValue(SIGNED_OFF);
    await press('arca', { repo: 'arca', number: 10, headSha: null }, 'accept');
    expect(acceptWork).toHaveBeenCalledWith('arca', 'arca', 10, undefined);
  });

  it('Send back passes the note, and says it was a Send back', async () => {
    sendBackWork.mockResolvedValue(SENT);
    const r = await press('arca', WORK, 'send-back', 'Shorter, please.');
    expect(sendBackWork).toHaveBeenCalledWith('arca', 'arca', 10, 'Shorter, please.');
    expect(acceptWork).not.toHaveBeenCalled();
    expect(r).toEqual({ ...SENT, decided: 'send-back' });
  });

  it('a refused press comes back as it was said, marked with which button it was', async () => {
    acceptWork.mockResolvedValue({ ok: false, message: 'You need to sign in.' });
    expect(await press('arca', WORK, 'accept')).toEqual({ ok: false, message: 'You need to sign in.', decided: 'accept' });
  });
});

describe('what the Tickets screen says after a press', () => {
  it("a founder's Accept is a sign-off, waiting for John", () => {
    expect(decisionOutcome({ ...SIGNED_OFF, decided: 'accept' })).toEqual({
      heading: 'Signed off, waiting for John',
      text: SIGNED_OFF.message,
    });
  });

  it("John's Accept is approved", () => {
    expect(decisionOutcome({ ...MERGED, decided: 'accept' }).heading).toBe('Approved and verified');
  });

  it('a Send back says nothing went out, whatever the server said', () => {
    expect(decisionOutcome({ ...SENT, decided: 'send-back' })).toEqual({
      heading: 'Sent back with your note',
      text: 'Nothing went out. Your team re-opens it, reads your note, and comes back with a revision.',
    });
  });
});

describe('each screen, before anyone presses', () => {
  const draw = (p: Partial<React.ComponentProps<typeof Decision>>) =>
    renderToStaticMarkup(React.createElement(Decision, { look: 'work', ventureId: 'arca', work: WORK, ...p }));
  const ids = (html: string) => [...html.matchAll(/data-testid="([^"]*)"/g)].map((m) => m[1]);

  it('the work page: Accept and Send back, in its words', () => {
    const html = draw({ look: 'work' });
    expect(ids(html)).toEqual(['work-decision', 'work-accept', 'work-sendback-open']);
    expect(html).toContain('>Accept this work<');
    expect(html).toContain('>Send it back with a note<');
  });

  it('the work page: when it cannot be accepted, the reason stands where Accept was', () => {
    const blocked = React.createElement('p', { 'data-testid': 'work-blocked' }, 'It clashes.');
    expect(ids(draw({ look: 'work', blocked }))).toEqual(['work-decision', 'work-blocked', 'work-sendback-open']);
  });

  it('the work page: work already merged has nothing to press', () => {
    const html = draw({ look: 'work', merged: true });
    expect(ids(html)).toEqual(['work-decision', 'work-state']);
    expect(html).toContain('>accepted<');
  });

  it('the Tickets screen: its own words for the same two buttons', () => {
    const html = draw({ look: 'tickets' });
    expect(ids(html)).toEqual(['detail-approve', 'detail-refuse']);
    expect(html).toContain('>Make it part of my product<');
    expect(html).toContain('>Refuse, and say why<');
  });

  it('the drawer: Accept and Send back', () => {
    const html = draw({ look: 'drawer' });
    expect(ids(html)).toEqual(['drawer-accept', 'drawer-sendback-open']);
    expect(html).toContain('>Accept this work<');
  });
});
