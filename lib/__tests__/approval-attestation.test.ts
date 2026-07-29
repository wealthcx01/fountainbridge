import { describe, it, expect } from 'vitest';
import { attestationFor, approverRoleForDepartment, canApprove } from '../approval-attestation';
import type { VentureSummary } from '../ventures';

const venture: VentureSummary = {
  id: 'arca',
  name: 'ARCA',
  status: 'active',
  founderName: 'John',
  founderEmail: 'john@bruntsfield.capital',
  repos: ['arca'],
  vpsHost: 'arca.bruntsfield.capital',
  departments: [],
  approvalMatrix: [
    { changeClass: 'product-visible', approver: 'founder' },
    { changeClass: 'high-blast-radius', approver: 'dual' },
  ],
};

describe('attestationFor — MUST match deploy/executor/executor.mjs', () => {
  it('pins a known vector (studio↔executor compatibility)', () => {
    // Recomputed identically by the executor's expectedAttestation() — this vector is the contract.
    expect(attestationFor('appr-1', 'sha-abc', 'john@bruntsfield.capital', 'test-secret')).toBe(
      '675b7702cef8d7a12663a755c8e856339ed38d4d3fdc77e2f7b068076bba8946',
    );
  });
  it('is case-insensitive on the approver (executor lowercases too)', () => {
    expect(attestationFor('appr-1', 'sha-abc', 'John@Bruntsfield.Capital', 'test-secret')).toBe(
      attestationFor('appr-1', 'sha-abc', 'john@bruntsfield.capital', 'test-secret'),
    );
  });
  it('changes if the pinned proposal sha changes (TOCTOU protection)', () => {
    expect(attestationFor('appr-1', 'sha-abc', 'john@bruntsfield.capital', 's')).not.toBe(
      attestationFor('appr-1', 'sha-XYZ', 'john@bruntsfield.capital', 's'),
    );
  });
});

describe('D7 routing + authorization', () => {
  it('routes an external/high-blast-radius action to the matrix approver', () => {
    expect(approverRoleForDepartment(venture, 'sell')).toBe('dual');
  });
  it('defaults to founder when the matrix does not name high-blast-radius', () => {
    expect(approverRoleForDepartment({ ...venture, approvalMatrix: [] }, 'sell')).toBe('founder');
  });
  it('lets the founder or an admin issue a founder-role grant; denies a stranger', () => {
    expect(canApprove('john@bruntsfield.capital', 'founder', venture, [])).toBe(true);
    expect(canApprove('admin@bruntsfield.capital', 'founder', venture, ['admin@bruntsfield.capital'])).toBe(true);
    expect(canApprove('random@example.com', 'founder', venture, [])).toBe(false);
  });
  it('requires an admin for a bruntsfield-role grant', () => {
    expect(canApprove('john@bruntsfield.capital', 'bruntsfield', venture, [])).toBe(false);
    expect(canApprove('admin@bruntsfield.capital', 'bruntsfield', venture, ['admin@bruntsfield.capital'])).toBe(true);
  });
  it('denies an empty email', () => {
    expect(canApprove('', 'founder', venture, [])).toBe(false);
  });
});
