#!/usr/bin/env node
/**
 * Mint a STUDIO_PASSWORD_LOGINS entry (FB-092).
 *
 *   node scripts/mint-password-login.mjs founder@example.com
 *
 * The password is read from stdin — NEVER from argv, where it would land in shell history and
 * process listings. Interactively you are prompted (echo suppressed); non-interactively pipe it:
 *
 *   echo "the-password" | node scripts/mint-password-login.mjs founder@example.com
 *
 * Output is one `email=scrypt:...` line. Append it (comma- or space-separated) to
 * STUDIO_PASSWORD_LOGINS on the deployment (Railway → foundry-studio → Variables). The hash is
 * safe to store in an env var; the password itself is never written anywhere.
 *
 * Algorithm must stay in lockstep with lib/password-login.ts (verifyPassword) — a unit test
 * (lib/__tests__/password-login.test.ts) runs this script and verifies its output there.
 */

import { randomBytes, scryptSync } from 'node:crypto';
import { stdin as input, stdout, stderr } from 'node:process';
import * as readline from 'node:readline';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email.includes('@')) {
  stderr.write('usage: node scripts/mint-password-login.mjs <email>   (password on stdin)\n');
  process.exit(2);
}

function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

function finish(password) {
  const trimmed = password.replace(/\r?\n$/, '');
  if (trimmed.length < 12) {
    stderr.write('refusing: password must be at least 12 characters\n');
    process.exit(1);
  }
  stdout.write(`${email}=${hashPassword(trimmed)}\n`);
}

if (input.isTTY) {
  // Interactive: prompt without echoing. readline with the output muted is the stdlib way.
  const rl = readline.createInterface({ input, output: stdout, terminal: true });
  stdout.write(`password for ${email}: `);
  // eslint-disable-next-line no-underscore-dangle -- the documented trick to mute echo
  rl._writeToOutput = () => {};
  rl.question('', (answer) => {
    rl.close();
    stdout.write('\n');
    finish(answer);
  });
} else {
  let data = '';
  input.setEncoding('utf8');
  input.on('data', (c) => { data += c; });
  input.on('end', () => finish(data));
}
