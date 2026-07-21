import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseTicket } from '../src/index';

/**
 * Every parsed Ticket — from clean templates AND from malformed edge cases — must validate against
 * the vendored bcap-contracts Ticket JSON Schema (FB-002, v0.1.0). This is the guarantee that makes
 * the parser safe for FB-006 to render: graceful degradation never produces an off-contract object.
 */

const SCHEMA = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', 'schema', 'Ticket.schema.json'), 'utf8'),
);
const FIX = join(import.meta.dirname, '..', 'fixtures');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

function everyFixture(): Array<{ repo: string; path: string; content: string }> {
  const out: Array<{ repo: string; path: string; content: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        out.push({ repo: 'fixture', path: `docs/tickets/${entry.name}`, content: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(FIX);
  return out;
}

test('every parsed ticket (clean and degraded) conforms to the Ticket contract', () => {
  const fixtures = everyFixture();
  assert.ok(fixtures.length > 0);
  for (const f of fixtures) {
    const { ticket } = parseTicket(f.content, { repo: f.repo, path: f.path });
    const ok = validate(ticket);
    assert.ok(ok, `${f.path} produced an off-contract Ticket: ${ajv.errorsText(validate.errors)}`);
  }
});
