import { describe, expect, it } from 'vitest';
import {
  isLeftBehind, newDatabaseName, ownerNote, studioDatabaseUrl, throwawayProblem, THROWAWAY_NAME,
} from '../test-copy-lib.mjs';

/**
 * The test copy's rules (FB-272). The one that matters: it only ever uses a throwaway database on
 * this machine. These addresses are invented; none of them reaches anything.
 */

describe('which database addresses a test copy may use', () => {
  it.each([
    ['the Supabase pooler', 'postgresql://foundry_studio.abc:pw@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'],
    ['a Supabase direct address, even with a throwaway-looking name', 'postgresql://postgres:pw@db.abc.supabase.co:5432/fb_test_x'],
    ["staging's Railway database", 'postgresql://postgres:pw@postgres.railway.internal:5432/railway'],
    ["Railway's public proxy", 'postgresql://postgres:pw@shuttle.proxy.rlwy.net:41234/fb_test_x'],
    ['a local database that is not a throwaway', 'postgresql://dev@localhost/postgres'],
    ['a local database whose name only contains the prefix', 'postgresql://dev@localhost/my_fb_test_db'],
    ['a socket address naming a real database', 'postgresql://dev@localhost/brain_firm?host=/var/run/postgresql'],
    ['a local host overridden by a remote ?host=', 'postgresql://dev@localhost/fb_test_x?host=db.abc.supabase.co'],
    ['something that is not Postgres', 'mysql://dev@localhost/fb_test_x'],
    ['nonsense', 'not a url'],
    ['nothing', ''],
  ])('refuses %s', (_name, url) => {
    expect(throwawayProblem(url)).toEqual(expect.any(String));
  });

  it.each([
    ['through the socket', 'postgresql://dev@localhost/fb_test_20261028t1600_abc123?host=%2Fvar%2Frun%2Fpostgresql'],
    ['on 127.0.0.1', 'postgres://dev:pw@127.0.0.1:5432/fb_test_1'],
    ['on ::1', 'postgresql://dev@[::1]:5432/fb_test_1'],
  ])('accepts a throwaway database %s', (_name, url) => {
    expect(throwawayProblem(url)).toBeNull();
  });

  it('says why, in a sentence that names the machine', () => {
    expect(throwawayProblem('postgresql://u:p@db.abc.supabase.co/postgres')).toMatch(/another machine \(db\.abc\.supabase\.co\)/);
  });
});

describe('the address the studio is given', () => {
  const url = studioDatabaseUrl({ database: 'fb_test_1', user: 'factory', socket: '/var/run/postgresql' });

  it('is itself a throwaway address', () => {
    expect(throwawayProblem(url)).toBeNull();
  });

  it('acts as foundry_studio, so row-level security applies', () => {
    expect(new URL(url).searchParams.get('options')).toBe('-c role=foundry_studio');
  });

  it('turns TLS off, which a socket does not have', () => {
    expect(new URL(url).searchParams.get('sslmode')).toBe('disable');
  });
});

describe('names', () => {
  it('makes a throwaway name', () => {
    const name = newDatabaseName(new Date('2026-10-28T16:00:00Z'), 'abc123');
    expect(name).toBe('fb_test_20261028t1600_abc123');
    expect(THROWAWAY_NAME.test(name)).toBe(true);
  });

  it('makes a different name each time', () => {
    expect(newDatabaseName()).not.toBe(newDatabaseName());
  });
});

describe('what counts as left behind', () => {
  const here = { host: 'box', alive: (pid) => pid === 1, exists: (path) => path === '/live' };
  const note = (o) => ownerNote({ host: 'box', pid: 1, state: '/live', started: 'now', ...o });

  it('a copy still running, with its state folder, is not', () => {
    expect(isLeftBehind(note({}), here)).toBe(false);
  });

  it('a copy whose process has gone is', () => {
    expect(isLeftBehind(note({ pid: 2 }), here)).toBe(true);
  });

  it('a copy whose state folder has gone is (the factory deletes it when a run ends)', () => {
    expect(isLeftBehind(note({ state: '/gone' }), here)).toBe(true);
  });

  it('a copy made on another machine is left alone', () => {
    expect(isLeftBehind(note({ host: 'elsewhere', pid: 2 }), here)).toBe(false);
  });

  it('a database with no note, or a note it did not write, is left alone', () => {
    expect(isLeftBehind(null, here)).toBe(false);
    expect(isLeftBehind('someone else wrote this', here)).toBe(false);
    expect(isLeftBehind(JSON.stringify({ by: 'someone else', host: 'box', pid: 2, state: '/gone' }), here)).toBe(false);
  });
});
