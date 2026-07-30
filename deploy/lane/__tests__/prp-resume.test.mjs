// "Clear the chat, resume from the board" (Archon, via docs/jstack-bruntsfield-method.md §3) is the
// property that makes a lane restartable: the durable context is the ticket plus the PRP, never a
// session's history. That rests entirely on write_prp/read_prp round-tripping a markdown file
// through the GitHub contents API — base64, newline handling and all — so it gets driven for real
// against a stubbed API rather than trusted.

import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIB = new URL('../foundry-lib.sh', import.meta.url).pathname;
let dir;

// A stand-in for gh_api that stores PUT content in a file and serves it back on GET, mimicking the
// shape read_prp/write_prp actually parse: {"content":"<base64 with newlines>","sha":"…"}.
function harness(body) {
  return `
set -euo pipefail
export REPO=owner/repo TICKET_GITHUB_TOKEN=x STATE_REF=foundry-state
. ${LIB}
STORE="${dir}/store"
mkdir -p "$STORE"
ensure_state_ref() { return 0; }
gh_api() {
  local method="GET" path="" data=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -X) method="$2"; shift 2 ;;
      -d) data="$2"; shift 2 ;;
      http*) path="$1"; shift ;;
      *) shift ;;
    esac
  done
  local slug; slug=$(printf '%s' "$path" | sed -E 's|.*/contents/||; s|\\?.*||; s|/|_|g')
  if [ "$method" = "PUT" ]; then
    printf '%s' "$data" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{process.stdout.write(JSON.parse(d).content)})' > "$STORE/$slug"
    echo '{"content":{"sha":"abc"}}'
  else
    if [ -f "$STORE/$slug" ]; then
      # GitHub wraps base64 at 60 chars with newlines — reproduce that, it is what read_prp must survive.
      node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");const w=s.match(/.{1,60}/g).join("\\n");process.stdout.write(JSON.stringify({content:w,sha:"abc"}))' "$STORE/$slug"
    else
      echo '{"message":"Not Found"}'
    fi
  fi
}
${body}
`;
}

const run = (body) => execFileSync('bash', ['-c', harness(body)], { encoding: 'utf8' });

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prp-resume-')); mkdirSync(join(dir, 'store'), { recursive: true }); });

describe('PRP persistence — the board is the durable context', () => {
  it('round-trips a PRP byte for byte', () => {
    const prp = [
      '# PRP — arca-x', '', '## Intent', 'A thing the founder wanted — with an em dash and “quotes”.', '',
      '## Context', 'Files: `src/a.ts`', '', '## Approach', 'Change it.', '',
      '## Tasks', '- [ ] do it', '', '## Validation gates',
      '- [ ] happy path: it renders', '- [ ] edge cases: empty is fine',
      '- [ ] errors: failure shows a message', '- [ ] coverage: tests cover both', '',
    ].join('\n');
    const src = join(dir, 'prp.md');
    const dest = join(dir, 'resumed.md');
    writeFileSync(src, prp);

    const out = run(`write_prp arca-x "${src}" && read_prp arca-x "${dest}" && echo ROUNDTRIP-OK`);
    expect(out).toContain('ROUNDTRIP-OK');
    expect(readFileSync(dest, 'utf8')).toBe(prp);
  });

  it('a resumed PRP is still a valid PRP (so the lane can skip re-planning)', () => {
    const src = join(dir, 'prp.md');
    const dest = join(dir, 'resumed.md');
    writeFileSync(src, [
      '# PRP — arca-y', '', '## Intent', 'x', '', '## Context', 'x', '', '## Approach', 'x', '',
      '## Tasks', '- [ ] x', '', '## Validation gates', '- [ ] happy path: works', '',
    ].join('\n'));

    const out = run(`
      write_prp arca-y "${src}" >/dev/null
      read_prp arca-y "${dest}"
      if prp_ok "${dest}"; then echo RESUMABLE; else echo NOT-RESUMABLE; fi
      echo "gates=$(prp_gate_count "${dest}")"
    `);
    expect(out).toContain('RESUMABLE');
    expect(out).toContain('gates=1');
  });

  it('reports no PRP for a ticket that has never been planned', () => {
    // The first-run case. It must fail cleanly, not produce an empty file the lane would treat as a
    // plan — that would skip planning entirely and implement against nothing.
    const dest = join(dir, 'absent.md');
    const out = run(`if read_prp never-planned "${dest}"; then echo FOUND; else echo NONE; fi`);
    expect(out).toContain('NONE');
    expect(out).not.toContain('FOUND');
  });

  it('refuses to persist an empty PRP', () => {
    const empty = join(dir, 'empty.md');
    writeFileSync(empty, '');
    const out = run(`if write_prp arca-z "${empty}"; then echo WROTE; else echo REFUSED; fi`);
    expect(out).toContain('REFUSED');
  });
});
