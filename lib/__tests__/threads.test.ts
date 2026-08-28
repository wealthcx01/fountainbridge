import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  appendMessage, emptyThread, isSafeTicketId, parseThread, threadPath, THREADS_REF,
  type Thread,
} from '../threads';

/**
 * A ticket's conversation (FB-126).
 *
 * The shape must satisfy the vendored schema (CLAUDE.md #7). The behaviour must protect a founder's
 * own words: never doubled, never summarised, never silently replaced by an empty thread when the
 * stored one could not be read.
 */

const SCHEMA = JSON.parse(readFileSync(join(__dirname, '..', '..', 'schema', 'Thread.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

const t0 = '2026-08-28T09:00:00.000Z';
const base = (): Thread => emptyThread('arca', 'arca', 'ARCA-068', t0);

describe('the thread keeps its contract', () => {
  it('an empty conversation is on-contract', () => {
    expect(validate(base()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('a real conversation is on-contract', () => {
    const t = appendMessage(
      appendMessage(base(), { at: t0, role: 'founder', text: 'the second line is wrong' }),
      { at: '2026-08-28T09:01:00.000Z', role: 'composer', text: 'changed it — file the revision?' },
    );
    expect(validate(t), JSON.stringify(validate.errors)).toBe(true);
    expect(t.messages).toHaveLength(2);
  });
});

describe('protecting what a founder actually said', () => {
  it('records it verbatim, never summarised', () => {
    // A thread is cited as the source of a revision, and a summary cannot be a source.
    const said = '  keep the wording about graded vintage — that is the whole point  ';
    const t = appendMessage(base(), { at: t0, role: 'founder', text: said });
    expect(t.messages[0]?.text).toBe(said);
  });

  it('refuses an empty turn', () => {
    for (const text of ['', '   ', '\n\t']) {
      expect(appendMessage(base(), { at: t0, role: 'founder', text }).messages).toHaveLength(0);
    }
  });

  it('does not double the last turn when a write is retried', () => {
    // The composer streams and a retried write must not say a founder's words back at them twice.
    const one = appendMessage(base(), { at: t0, role: 'founder', text: 'do it' });
    const two = appendMessage(one, { at: '2026-08-28T09:05:00.000Z', role: 'founder', text: 'do it' });
    expect(two.messages).toHaveLength(1);
    expect(two).toBe(one);
  });

  it('allows the same words from the other side', () => {
    const one = appendMessage(base(), { at: t0, role: 'founder', text: 'yes' });
    const two = appendMessage(one, { at: '2026-08-28T09:05:00.000Z', role: 'composer', text: 'yes' });
    expect(two.messages).toHaveLength(2);
  });

  it('moves updated_at with the last turn', () => {
    const t = appendMessage(base(), { at: '2026-08-28T10:00:00.000Z', role: 'founder', text: 'x' });
    expect(t.updated_at).toBe('2026-08-28T10:00:00.000Z');
  });
});

describe('reading what was stored', () => {
  it('reads a thread back', () => {
    const t = appendMessage(base(), { at: t0, role: 'founder', text: 'hello' });
    expect(parseThread(JSON.stringify(t))?.messages).toHaveLength(1);
  });

  it('returns nothing for anything that is not a thread', () => {
    for (const raw of [null, undefined, '', 'not json', '{}', '[]', '{"venture_id":"arca"}']) {
      expect(parseThread(raw), String(raw)).toBeNull();
    }
  });

  it('drops a malformed message rather than the whole conversation', () => {
    // One bad turn must not lose the other nine. The founder's words are the thing being protected.
    const raw = JSON.stringify({
      venture_id: 'arca', repo: 'arca', ticket_id: 'ARCA-068', updated_at: t0,
      messages: [
        { at: t0, role: 'founder', text: 'kept' },
        { role: 'founder', text: 'no timestamp' },
        { at: t0, role: 'wizard', text: 'not a role' },
        { at: t0, role: 'composer', text: 'also kept' },
      ],
    });
    expect(parseThread(raw)?.messages.map((m) => m.text)).toEqual(['kept', 'also kept']);
  });
});

describe('what may become a path', () => {
  it('accepts a real ticket id', () => {
    for (const id of ['ARCA-068', 'FB-126', 'SELL-002']) expect(isSafeTicketId(id), id).toBe(true);
  });

  it('refuses anything that could escape the directory', () => {
    for (const id of ['../../etc/passwd', 'a/b', '', '.', 'x'.repeat(100), 42, null]) {
      expect(isSafeTicketId(id as never), String(id)).toBe(false);
    }
  });

  it('puts a thread beside the other machine-written state, not in reviewed content', () => {
    // foundry-state carries approvals/, prps/ and runreports/. context/ is reviewed content behind a
    // pull request, and a pull request per message is not a conversation.
    expect(THREADS_REF).toBe('foundry-state');
    expect(threadPath('arca', 'ARCA-068')).toBe('threads/arca/ARCA-068.json');
    expect(threadPath('arca', 'ARCA-068')).not.toContain('context/');
  });

  it('keeps two repos in one venture apart', () => {
    // Two repos may share an id namespace, so the repo is part of the path or one overwrites the other.
    expect(threadPath('arca', 'X-1')).not.toBe(threadPath('arca-marketing', 'X-1'));
  });
});
