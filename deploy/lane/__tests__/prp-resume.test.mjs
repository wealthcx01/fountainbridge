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
  local method="GET" path="" data="" want_code=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -X) method="$2"; shift 2 ;;
      -d) data="$2"; shift 2 ;;
      -w) want_code="$2"; shift 2 ;;
      -o) shift 2 ;;
      http*) path="$1"; shift ;;
      *) shift ;;
    esac
  done
  local slug; slug=$(printf '%s' "$path" | sed -E 's|.*/contents/||; s|\\?.*||; s|/|_|g')
  if [ "$method" = "PUT" ]; then
    printf '%s' "$data" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{process.stdout.write(JSON.parse(d).content)})' > "$STORE/$slug"
    # Mirror curl: with -w '%{http_code}' the caller wants the STATUS, not the body.
    if [ -n "$want_code" ]; then echo "201"; else echo '{"content":{"sha":"abc"}}'; fi
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

  it('does not resume a PRP written from a DIFFERENT version of the ticket', () => {
    // run-once.sh clears the give-up markers when a founder EDITS a stuck ticket, so the lane
    // retries it. Without this binding the retry would read back the plan and gates written from
    // the OLD text, log "no re-planning", and the PR would claim it validated against them — the
    // founder's edit silently ignored.
    const src = join(dir, 'prp.md');
    const ticket = join(dir, 'ticket.md');
    const dest = join(dir, 'resumed.md');
    writeFileSync(src, [
      '# PRP — arca-t', '', '## Intent', 'x', '', '## Context', 'x', '', '## Approach', 'x', '',
      '## Tasks', '- [ ] x', '', '## Validation gates', '- [ ] happy path: works', '',
    ].join('\n'));
    writeFileSync(ticket, '# ARCA-T\n\n## Scope\n- the original ask\n');

    const first = run(`write_prp arca-t "${src}" "${ticket}" >/dev/null
      if read_prp arca-t "${dest}" "${ticket}"; then echo RESUMED; else echo REPLAN; fi`);
    expect(first).toContain('RESUMED');

    // The founder edits the ticket…
    writeFileSync(ticket, '# ARCA-T\n\n## Scope\n- actually, something quite different\n');
    const second = run(`if read_prp arca-t "${dest}" "${ticket}"; then echo RESUMED; else echo REPLAN; fi`);
    expect(second).toContain('REPLAN');
    expect(second).not.toContain('RESUMED');
  });

  it('re-planning after an edit leaves no stale PRP behind for the next read', () => {
    const src = join(dir, 'p2.md');
    const ticket = join(dir, 't2.md');
    const dest = join(dir, 'd2.md');
    writeFileSync(src, [
      '# PRP — arca-u', '', '## Intent', 'x', '', '## Context', 'x', '', '## Approach', 'x', '',
      '## Tasks', '- [ ] x', '', '## Validation gates', '- [ ] happy path: works', '',
    ].join('\n'));
    writeFileSync(ticket, 'v1');
    run(`write_prp arca-u "${src}" "${ticket}" >/dev/null`);
    writeFileSync(ticket, 'v2');
    const out = run(`read_prp arca-u "${dest}" "${ticket}" || true
      if [ -s "${dest}" ]; then echo LEFT-BEHIND; else echo CLEANED; fi`);
    expect(out).toContain('CLEANED');
  });

  it('reports why a PRP is malformed WITHOUT killing its caller', () => {
    // The harness runs `set -euo pipefail`, exactly as supervisor.sh does. prp_problems is only
    // ever called when validation already failed, so its pipeline's first command exits non-zero by
    // design — and an unguarded pipeline there would abort the assignment and take the lane down:
    // no `blocked` RunReport, no log line, claim branch stranded. Reporting a bad plan must never be
    // more fatal than the bad plan.
    const bad = join(dir, 'bad.md');
    writeFileSync(bad, '# PRP\n\n## Intent\nx\n');
    const out = run(`WHY="$(prp_problems "${bad}")"; echo "why=$WHY"; echo SURVIVED`);
    expect(out).toContain('SURVIVED');
    expect(out).toContain('validation gates');
    expect(out).not.toContain('[prp]');   // the prefix strip ran
  });

  it('survives prp_problems on a file that does not exist at all', () => {
    const out = run(`WHY="$(prp_problems "${dir}/nope.md")"; echo SURVIVED`);
    expect(out).toContain('SURVIVED');
  });

  it('counts zero gates — and stays numeric — for anything that is not a PRP', () => {
    // GATE_COUNT feeds `[ "${GATE_COUNT:-0}" -gt 0 ]`, which decides whether the gate-checking step
    // runs at all. Empty or multi-line output there would make `[` error out and silently skip it
    // while the PR body still claimed "PRP gates ✅".
    const bad = join(dir, 'bad2.md');
    writeFileSync(bad, '# PRP\n\n## Intent\nx\n');
    const out = run(`
      echo "a=[$(prp_gate_count "${bad}")]"
      echo "b=[$(prp_gate_count "${dir}/nope.md")]"
      if prp_ok "${bad}"; then echo OK1; else echo NOT-A-PRP1; fi
      if prp_ok "${dir}/nope.md"; then echo OK2; else echo NOT-A-PRP2; fi
    `);
    expect(out).toContain('a=[0]');
    expect(out).toContain('b=[0]');
    expect(out).toContain('NOT-A-PRP1');
    expect(out).toContain('NOT-A-PRP2');
  });

  it('refuses to persist an empty PRP', () => {
    const empty = join(dir, 'empty.md');
    writeFileSync(empty, '');
    const out = run(`if write_prp arca-z "${empty}"; then echo WROTE; else echo REFUSED; fi`);
    expect(out).toContain('REFUSED');
  });
});
