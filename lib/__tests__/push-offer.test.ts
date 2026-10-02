import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pushOffer, type PushOfferInput } from '../push-offer';
import { pushPublicKey } from '../webpush';

/**
 * When the studio asks a phone whether it may buzz it (FB-141).
 *
 * The ticket's three rules: ask after a decision and never on first load; turning it off is one
 * press and sticks; an iPhone in a browser tab is told to install first rather than asked.
 */

/** A founder on an Android phone with the studio installed, who has decided nothing yet. */
const fresh: PushOfferInput = {
  supported: true,
  keyConfigured: true,
  permission: 'default',
  subscribed: false,
  decided: false,
  declined: false,
  ios: false,
  standalone: true,
  onNeedsYou: false,
};

describe('asking for permission', () => {
  it('never asks on first load — only after a decision', () => {
    expect(pushOffer(fresh)).toBe('none');
    expect(pushOffer({ ...fresh, onNeedsYou: true })).toBe('none');
    expect(pushOffer({ ...fresh, decided: true })).toBe('offer');
  });

  it('never asks when the studio could not send a push anyway', () => {
    expect(pushOffer({ ...fresh, decided: true, keyConfigured: false })).toBe('none');
    expect(pushOffer({ ...fresh, decided: true, supported: false })).toBe('none');
  });

  it('on an iPhone in a browser tab, says how to install instead of asking', () => {
    const iphoneTab = { ...fresh, ios: true, standalone: false, supported: false, decided: true };
    expect(pushOffer(iphoneTab)).toBe('install-first');
    // Installed from the Home Screen, the same phone can be asked.
    expect(pushOffer({ ...iphoneTab, standalone: true, supported: true })).toBe('offer');
    // And not before a decision, there either.
    expect(pushOffer({ ...iphoneTab, decided: false })).toBe('none');
  });
});

describe('turning it off sticks', () => {
  it('a founder who said no is never asked again, anywhere', () => {
    const no = { ...fresh, decided: true, declined: true };
    expect(pushOffer(no)).toBe('none');
    expect(pushOffer({ ...no, ios: true, standalone: false })).toBe('none');
  });

  it('keeps one quiet way back, only where the buzz would land', () => {
    expect(pushOffer({ ...fresh, decided: true, declined: true, onNeedsYou: true })).toBe('off');
  });

  it('a subscribed phone sees one line to turn it off where the buzz lands, and nothing elsewhere', () => {
    const on = { ...fresh, decided: true, subscribed: true, permission: 'granted' as const };
    expect(pushOffer({ ...on, onNeedsYou: true })).toBe('on');
    expect(pushOffer(on)).toBe('none');
  });

  it('a browser that has blocked notifications is told so, not offered a button that cannot work', () => {
    const blocked = { ...fresh, decided: true, permission: 'denied' as const };
    expect(pushOffer(blocked)).toBe('none');
    expect(pushOffer({ ...blocked, onNeedsYou: true })).toBe('blocked');
  });
});

describe('every decision counts as one', () => {
  // The offer only appears after `noteDecision`. A new approve or refuse button that forgets to call
  // it would silently mean the studio never asks a founder who only ever uses that button.
  const DECISIONS = /await (acceptWork|sendBackWork|approveExternalAction|refuseExternalAction|decideRoutine|releasePlan|filePlan)\(/g;

  it('every call to a decision action in a screen goes through noteDecision', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const e of readdirSync(join(process.cwd(), 'components'), { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.tsx')) continue;
      const src = readFileSync(join(process.cwd(), 'components', e.name), 'utf8');
      for (const m of src.matchAll(DECISIONS)) {
        seen += 1;
        if (!src.slice(Math.max(0, m.index! - 'noteDecision('.length), m.index!).endsWith('noteDecision(')) {
          offenders.push(`${e.name}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // Nine on the work, send and routine screens, plus releasing a held plan and filing a plan:
    // eleven today. A scan that found nothing would pass for the wrong reason.
    expect(seen).toBeGreaterThanOrEqual(11);
  });
});

describe('the key the studio offers', () => {
  const keys = { VAPID_PUBLIC_KEY: 'BPub', VAPID_PRIVATE_KEY: 'priv', DATABASE_URL: 'postgres://x' };

  it('is offered only when a push could really be sent', () => {
    expect(pushPublicKey(keys)).toBe('BPub');
    expect(pushPublicKey({ ...keys, DATABASE_URL: '' })).toBeNull(); // nowhere to keep the phone
    expect(pushPublicKey({ ...keys, VAPID_PRIVATE_KEY: undefined })).toBeNull(); // nothing to sign with
  });

  it('the browser-test rig may offer it without a database, and only the rig', () => {
    const rig = { ...keys, DATABASE_URL: '', E2E_TEST_LOGIN: '1', PUSH_FIXTURE: '1' };
    expect(pushPublicKey(rig)).toBe('BPub');
    // The fixture switch alone is not enough: a production studio never has E2E_TEST_LOGIN.
    expect(pushPublicKey({ ...rig, E2E_TEST_LOGIN: undefined })).toBeNull();
    expect(pushPublicKey({ ...rig, PUSH_FIXTURE: undefined })).toBeNull();
    // And the rig still needs the keys.
    expect(pushPublicKey({ ...rig, VAPID_PUBLIC_KEY: undefined })).toBeNull();
  });
});
