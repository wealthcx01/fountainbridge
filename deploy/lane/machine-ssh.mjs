/**
 * Reaching a ticket machine over SSH, with a key made for this one run (FB-239).
 *
 * The key pair is made fresh for each run, its public half is the only key the machine accepts, and
 * the private half is deleted when the run ends. So the key that opens one ticket's machine opens no
 * other machine, and is gone before the next ticket starts.
 *
 * File contents — credentials included — go over the SSH connection's input, never on a command
 * line, where any process on either machine could read them from the process list.
 *
 * Like `machine-hetzner.mjs`, this has never been pointed at a real machine.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Make the run's key pair in a private directory. Returns the public key and a way to delete both. */
export function makeRunKey(runId) {
  const dir = mkdtempSync(join(tmpdir(), 'foundry-run-'));
  const keyPath = join(dir, 'id_ed25519');
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', `foundry-run-${runId}`, '-f', keyPath]);
  return {
    dir,
    keyPath,
    publicKey: readFileSync(`${keyPath}.pub`, 'utf8').trim(),
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** The ssh arguments, kept separate so they can be read and tested without a machine. */
export function sshArgs({ keyPath, knownHosts, ip }) {
  return [
    '-i', keyPath,
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    // A brand-new machine has a brand-new host key. Accept it on first contact, but only into this
    // run's own file, so it can never be confused with any other machine's.
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', `UserKnownHostsFile=${knownHosts}`,
    '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=30',
    `root@${ip}`,
  ];
}

export function sshTransport({ keyPath, dir, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const knownHosts = join(dir, 'known_hosts');

  function ssh(machine, command, { input, timeoutMs = 120_000 } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('ssh', [...sshArgs({ keyPath, knownHosts, ip: machine.ip }), command], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`timed out after ${Math.round(timeoutMs / 60000)} min`)); }, timeoutMs);
      child.stdout.on('data', (c) => { out += c; });
      child.stderr.on('data', (c) => { err += c; });
      child.on('error', (e) => { clearTimeout(timer); reject(e); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(Object.assign(new Error(`ssh exited ${code}: ${err.trim().slice(-300)}`), { code, out }));
      });
      child.stdin.end(input ?? '');
    });
  }

  return {
    async waitReachable(machine, { timeoutMs }) {
      const until = Date.now() + timeoutMs;
      for (;;) {
        // cloud-init has finished when this file exists; before that the packages are not there.
        try { await ssh(machine, 'test -f /var/lib/cloud/instance/boot-finished', { timeoutMs: 20_000 }); return; } catch (e) {
          if (Date.now() > until) throw new Error(`machine ${machine.name} could not be reached: ${e.message}`);
        }
        await sleep(10_000);
      }
    },

    async send(machine, files) {
      for (const f of files) {
        const mode = f.mode.toString(8);
        // The path is ours (machine-lib builds it); quoted anyway.
        await ssh(machine, `install -D -m ${mode} /dev/stdin '${f.path.replace(/'/g, '')}'`, { input: f.content });
      }
    },

    async run(machine, command, { timeoutMs }) {
      try {
        return await ssh(machine, command, { timeoutMs });
      } catch (err) {
        // The worker's own exit code is in its result file; a non-zero exit here is not by itself a
        // broken run. A timeout is, and so is 255, which is ssh's own code for a lost connection.
        if (Number.isInteger(err.code) && err.code !== 255) return err.out ?? '';
        throw err;
      }
    },

    async fetch(machine, path) {
      try {
        return await ssh(machine, `cat '${path.replace(/'/g, '')}'`, { timeoutMs: 60_000 });
      } catch {
        return null;
      }
    },
  };
}
