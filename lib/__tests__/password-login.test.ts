import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  MAX_FAILS,
  WINDOW_MS,
  authorizePassword,
  createThrottle,
  hashPassword,
  parsePasswordAccounts,
  verifyPassword,
} from '../password-login';

describe('hashPassword / verifyPassword', () => {
  it('round-trips, and refuses a wrong password', () => {
    const h = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', h)).toBe(true);
    expect(verifyPassword('correct horse battery stapl', h)).toBe(false);
    expect(verifyPassword('', h)).toBe(false);
  });

  it('salts: the same password hashes differently each time, and both verify', () => {
    const a = hashPassword('a password to keep');
    const b = hashPassword('a password to keep');
    expect(a).not.toBe(b);
    expect(verifyPassword('a password to keep', a)).toBe(true);
    expect(verifyPassword('a password to keep', b)).toBe(true);
  });

  it('never throws on garbage stored values — it just refuses', () => {
    for (const junk of [
      '',
      'plaintext-password-pasted-by-mistake',
      'scrypt:not:enough',
      'scrypt:0:8:1:AAAA:BBBB', // N below minimum
      'scrypt:16383:8:1:AAAA:BBBB', // N not a power of two
      'scrypt:1048576:8:1:AAAA:BBBB', // N over the safety cap — must not allocate
      'scrypt:16384:8:1::', // empty salt/hash
      'bcrypt:whatever',
    ]) {
      expect(verifyPassword('anything', junk)).toBe(false);
    }
  });
});

describe('parsePasswordAccounts', () => {
  const HASH = hashPassword('irrelevant');

  it('parses comma- and whitespace-separated entries, normalizing emails', () => {
    const { accounts, malformed } = parsePasswordAccounts(
      `Founder@Example.com=${HASH},  second@example.com=${HASH}\n third@example.com=${HASH}`,
    );
    expect([...accounts.keys()]).toEqual([
      'founder@example.com',
      'second@example.com',
      'third@example.com',
    ]);
    expect(malformed).toEqual([]);
  });

  it('is empty for unset or blank env', () => {
    expect(parsePasswordAccounts(undefined).accounts.size).toBe(0);
    expect(parsePasswordAccounts('').accounts.size).toBe(0);
    expect(parsePasswordAccounts('  ').accounts.size).toBe(0);
  });

  it('reports a malformed entry by position and never echoes its content', () => {
    // The likeliest mistake: a plaintext password where a hash belongs.
    const { accounts, malformed } = parsePasswordAccounts(
      `good@example.com=${HASH},oops@example.com=hunter2hunter2,${HASH}`,
    );
    expect(accounts.size).toBe(1);
    expect(accounts.has('good@example.com')).toBe(true);
    expect(malformed).toEqual([2, 3]);
  });
});

describe('throttle', () => {
  it(`blocks after ${MAX_FAILS} failures and unblocks when the window passes`, () => {
    let now = 1_000_000;
    const t = createThrottle(() => now);
    for (let i = 0; i < MAX_FAILS; i += 1) {
      expect(t.isBlocked('x@example.com')).toBe(false);
      t.recordFailure('x@example.com');
    }
    expect(t.isBlocked('x@example.com')).toBe(true);
    expect(t.isBlocked('other@example.com')).toBe(false); // per-email, not global
    now += WINDOW_MS + 1;
    expect(t.isBlocked('x@example.com')).toBe(false);
  });

  it('a success clears the count', () => {
    const t = createThrottle(() => 5);
    t.recordFailure('x@example.com');
    t.recordFailure('x@example.com');
    t.recordSuccess('x@example.com');
    for (let i = 0; i < MAX_FAILS - 1; i += 1) t.recordFailure('x@example.com');
    expect(t.isBlocked('x@example.com')).toBe(false);
  });
});

describe('authorizePassword — the decision Auth.js gets', () => {
  const accounts = new Map([['founder@example.com', hashPassword('a long founder password')]]);

  it('signs in a configured account with the right password, case-insensitively', () => {
    const t = createThrottle(() => 0);
    expect(authorizePassword('Founder@Example.COM ', 'a long founder password', accounts, t)).toEqual({
      id: 'founder@example.com',
      email: 'founder@example.com',
    });
  });

  it('returns the same null for unknown email and wrong password — no enumeration', () => {
    const t = createThrottle(() => 0);
    expect(authorizePassword('nobody@example.com', 'a long founder password', accounts, t)).toBeNull();
    expect(authorizePassword('founder@example.com', 'wrong', accounts, t)).toBeNull();
  });

  it('refuses even the RIGHT password while throttled', () => {
    let now = 0;
    const t = createThrottle(() => now);
    for (let i = 0; i < MAX_FAILS; i += 1) {
      authorizePassword('founder@example.com', 'wrong', accounts, t);
    }
    expect(authorizePassword('founder@example.com', 'a long founder password', accounts, t)).toBeNull();
    now = WINDOW_MS + 1;
    expect(authorizePassword('founder@example.com', 'a long founder password', accounts, t)).not.toBeNull();
  });

  it('an unknown email also burns throttle budget — probing is never free', () => {
    const t = createThrottle(() => 0);
    for (let i = 0; i < MAX_FAILS; i += 1) {
      authorizePassword('probe@example.com', 'guess', accounts, t);
    }
    expect(t.isBlocked('probe@example.com')).toBe(true);
  });

  it('refuses empty and non-string inputs', () => {
    const t = createThrottle(() => 0);
    expect(authorizePassword('', 'a long founder password', accounts, t)).toBeNull();
    expect(authorizePassword('founder@example.com', '', accounts, t)).toBeNull();
    expect(authorizePassword(undefined, undefined, accounts, t)).toBeNull();
    expect(authorizePassword({ evil: true }, ['x'], accounts, t)).toBeNull();
  });
});

describe('mint-password-login.mjs stays in lockstep with verifyPassword', () => {
  // The script deliberately duplicates the algorithm (it must run standalone, outside the TS
  // build). If the two ever drift, a minted entry would silently stop verifying — this is the
  // test that turns that into a red build. Runs node directly, so it works on any platform.
  const script = fileURLToPath(new URL('../../scripts/mint-password-login.mjs', import.meta.url));

  it('a minted entry parses and verifies', () => {
    const out = execFileSync(process.execPath, [script, 'Minted@Example.com'], {
      input: 'a-password-from-the-script\n',
      encoding: 'utf8',
    });
    const { accounts, malformed } = parsePasswordAccounts(out.trim());
    expect(malformed).toEqual([]);
    const stored = accounts.get('minted@example.com');
    expect(stored).toBeTruthy();
    expect(verifyPassword('a-password-from-the-script', stored as string)).toBe(true);
    expect(verifyPassword('a-different-password', stored as string)).toBe(false);
  });

  it('refuses a short password', () => {
    expect(() =>
      execFileSync(process.execPath, [script, 'x@example.com'], { input: 'short\n', encoding: 'utf8' }),
    ).toThrow();
  });
});
