import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyGrant, describeProvenance } from '../provenance';

const SECRET = 'studio-signing-secret';
const ID = 'send-launch-email';
const SHA = 'abc123';
const APPROVER = 'ross@bruntsfield.capital';
const sign = (id = ID, sha = SHA, approver = APPROVER, secret = SECRET) =>
  createHmac('sha256', secret).update(`${id}|${sha}|${approver.toLowerCase()}`).digest('hex');

const grant = (over: Record<string, unknown> = {}) => ({
  approver: APPROVER, proposal_sha: SHA, attestation: sign(), granted_at: '2026-07-30T11:00:00Z', ...over,
});

describe('a grant is an approval only when the studio can prove it issued it', () => {
  it('accepts its own signature and names the approver', () => {
    const v = verifyGrant(ID, SHA, grant(), SECRET);
    expect(v).toMatchObject({ provenance: 'attested', approver: APPROVER, grantedAt: '2026-07-30T11:00:00Z' });
  });

  it('REFUSES a grant a lane forged, and refuses to name anyone', () => {
    // The lane holds repo-write on this ref and can write any file it likes. What it cannot do is
    // produce this HMAC — the secret lives on the studio and the executor, never on a lane box.
    const forged = grant({ approver: 'john@bruntsfield.capital', attestation: 'not-a-real-hmac' });
    const v = verifyGrant(ID, SHA, forged, SECRET);
    expect(v.provenance).toBe('unattested');
    expect(v.approver).toBeNull();          // an unverified name is noise, not evidence
    expect(v.reason).toMatch(/not issued by the studio/);
  });

  it('refuses a grant signed for a DIFFERENT approval or approver', () => {
    expect(verifyGrant(ID, SHA, grant({ attestation: sign('other-id') }), SECRET).provenance).toBe('unattested');
    expect(verifyGrant(ID, SHA, grant({ approver: 'someone@else.com' }), SECRET).provenance).toBe('unattested');
  });

  it('refuses once the proposal has changed under it', () => {
    // The attestation pins the sha that was approved — the same TOCTOU protection the executor
    // relies on, surfaced to the founder instead of discovered at execution time.
    const v = verifyGrant(ID, 'a-different-sha', grant(), SECRET);
    expect(v.provenance).toBe('unattested');
    expect(v.reason).toMatch(/changed after it was approved/);
  });

  it('refuses a grant signed with a different secret', () => {
    expect(verifyGrant(ID, SHA, grant({ attestation: sign(ID, SHA, APPROVER, 'other') }), SECRET).provenance)
      .toBe('unattested');
  });

  it('does not fall back to trusting the file when it cannot verify', () => {
    // No secret must mean "cannot verify", never "assume fine" — an unverifiable grant is exactly
    // what this exists to catch.
    expect(verifyGrant(ID, SHA, grant(), undefined).provenance).toBe('unattested');
    expect(verifyGrant(ID, SHA, grant({ attestation: undefined }), SECRET).reason).toMatch(/no attestation/);
    expect(verifyGrant(ID, SHA, grant({ approver: '' }), SECRET).reason).toMatch(/names no approver/);
    expect(verifyGrant(ID, null, grant(), SECRET).reason).toMatch(/could not be read/);
  });

  it('reports no grant at all as `none`, not as a failure', () => {
    expect(verifyGrant(ID, SHA, null, SECRET)).toMatchObject({ provenance: 'none', approver: null });
    expect(verifyGrant(ID, SHA, undefined, SECRET).provenance).toBe('none');
  });
});

describe('what the founder is told', () => {
  it('names the human and the date when it verifies', () => {
    expect(describeProvenance(verifyGrant(ID, SHA, grant(), SECRET)))
      .toBe(`Approved by ${APPROVER} on 2026-07-30, verified by the studio.`);
  });

  it('says plainly that an unverified grant is not an approval', () => {
    const note = describeProvenance(verifyGrant(ID, SHA, grant({ attestation: 'x' }), SECRET))!;
    expect(note).toContain('cannot verify it');
    expect(note).toContain('Treat it as unapproved');
    expect(note).toContain('the executor will refuse');
  });

  it('says nothing when nothing has been granted', () => {
    expect(describeProvenance(verifyGrant(ID, SHA, null, SECRET))).toBeNull();
  });
});
