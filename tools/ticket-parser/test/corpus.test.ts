import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTicket, type ParseResult } from '../src/index';

/**
 * Acceptance criteria (FB-004):
 *   - 100% of sampled real tickets parse WITHOUT throwing.
 *   - ≥90% parse with ZERO warnings.
 * Measured over the committed real-ticket corpus (grassmarket + fountainbridge). The corpus is
 * real files copied into fixtures/ so CI is deterministic (no GitHub fetch — that's FB-006).
 */

const REAL = join(import.meta.dirname, '..', 'fixtures', 'real');

function corpus(): Array<{ repo: string; path: string; content: string }> {
  const out: Array<{ repo: string; path: string; content: string }> = [];
  for (const repo of readdirSync(REAL)) {
    const dir = join(REAL, repo);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      out.push({ repo, path: `docs/tickets/${file}`, content: readFileSync(join(dir, file), 'utf8') });
    }
  }
  return out;
}

test('real-ticket corpus: 100% parse without throwing, ≥90% with zero warnings', () => {
  const files = corpus();
  assert.ok(files.length >= 12, `expected a real corpus of ≥12 tickets, got ${files.length}`);

  let clean = 0;
  const warned: string[] = [];
  for (const f of files) {
    let result: ParseResult | undefined;
    assert.doesNotThrow(() => {
      result = parseTicket(f.content, { repo: f.repo, path: f.path });
    }, `parsing ${f.repo}/${f.path} threw`);
    const warnings = result!.warnings;
    if (warnings.length === 0) clean += 1;
    else warned.push(`${f.path} → ${warnings.map((w) => w.code).join(',')}`);
  }

  const rate = clean / files.length;
  // Surface the real numbers (fail-loud, CLAUDE.md #10) even on success.
  console.log(
    `[corpus] ${files.length} real tickets · ${clean} zero-warning (${(rate * 100).toFixed(1)}%)` +
      (warned.length ? `\n[corpus] warned:\n  - ${warned.join('\n  - ')}` : ''),
  );
  assert.ok(rate >= 0.9, `zero-warning rate ${(rate * 100).toFixed(1)}% is below the 90% bar`);
});
