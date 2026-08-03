import { describe, it, expect } from 'vitest';
import {
  composerEndpoint, composerKeyEnvName, describeTool, drainSse,
  emptyStream, formatInline, reduceChunk, withDocument, visibleActions, MAX_DOCUMENT_CHARS,
} from '../composer';

describe('finding a venture’s composer', () => {
  it('points at the venture’s own box, the same one the old link used', () => {
    expect(composerEndpoint('arca.bruntsfield.capital')).toBe('https://chat.arca.bruntsfield.capital');
  });

  it('has nothing to point at before the box exists', () => {
    expect(composerEndpoint(null)).toBeNull();
  });

  it('agrees with the venture module it deliberately duplicates', async () => {
    // composerEndpoint repeats ventureChatUrl rather than importing it, because lib/ventures reads
    // manifest files off disk and this module is imported by a client component. Two functions
    // returning the same string is drift waiting to happen, so it is asserted rather than assumed.
    const { ventureChatUrl } = await import('../ventures');
    for (const host of ['arca.bruntsfield.capital', 'x.example.com', null]) {
      expect(composerEndpoint(host)).toBe(ventureChatUrl(host));
    }
  });

  it('names one key per venture, so a key can never reach a second box', () => {
    expect(composerKeyEnvName('arca')).toBe('COMPOSER_API_KEY_ARCA');
    expect(composerKeyEnvName('the-reset')).toBe('COMPOSER_API_KEY_THE_RESET');
  });
});

describe('saying what the composer just did', () => {
  it('strips the transport suffix the engine adds to a tool name', () => {
    // The box returns `search_venture_brain_mcp_venture-brain`. Showing a founder that string would
    // be showing them our plumbing.
    expect(describeTool('search_venture_brain_mcp_venture-brain')).toBe('Looking through what your venture knows');
  });

  it('names every tool the ARCA box actually reports', () => {
    // These are the five real names off the box, not names we assumed. The first version of the
    // table guessed `file_ticket`, so the one action that matters most — the founder's words
    // becoming a real piece of work — rendered as "Working…". Found by filing a live ticket.
    expect(describeTool('file_venture_ticket_mcp_ticket-filer')).toBe('Filing this as a piece of work');
    expect(describeTool('deposit_venture_file_mcp_deposit')).toContain('knowledge');
    expect(describeTool('search_venture_brain_mcp_venture-brain')).toContain('venture knows');
    expect(describeTool('list_open_prs_mcp_status')).toContain('your team is doing');
    expect(describeTool('list_recent_activity_mcp_status')).toContain('your team is doing');
    expect(describeTool('web_search')).toContain('Searching the web');
  });

  it('stays vague rather than wrong about a tool it does not know', () => {
    // A confident wrong label on this surface is the FB-062 failure again: the whole reason actions
    // are shown is that they can be trusted.
    expect(describeTool('some_new_tool')).toBe('Working…');
  });
});

describe('assembling a streamed reply', () => {
  const chunk = (delta: unknown, finish: string | null = null) =>
    ({ choices: [{ index: 0, delta, finish_reason: finish }] });

  it('joins the text as it arrives', () => {
    let s = emptyStream();
    s = reduceChunk(s, chunk({ role: 'assistant' }));
    s = reduceChunk(s, chunk({ content: 'Two ' }));
    s = reduceChunk(s, chunk({ content: 'sentences.' }));
    expect(s.content).toBe('Two sentences.');
    expect(s.done).toBe(false);
  });

  it('keeps one tool call together even though the engine’s indices disagree', () => {
    // Taken from a real stream off the ARCA box: the chunk carrying the tool's id and name came
    // back as index 1, and every chunk carrying that same call's arguments came back as index 0.
    // Keying strictly by index — the obvious reading of the format — invents a second action the
    // founder never triggered.
    let s = emptyStream();
    s = reduceChunk(s, chunk({
      tool_calls: [{ index: 1, id: 'toolu_01', type: 'function', function: { name: 'search_venture_brain_mcp_venture-brain', arguments: '' } }],
    }));
    s = reduceChunk(s, chunk({ tool_calls: [{ index: 0, function: { arguments: '{"question": "price feed' } }] }));
    s = reduceChunk(s, chunk({ tool_calls: [{ index: 0, function: { arguments: '"}' } }] }));

    expect(s.actions).toHaveLength(1);
    expect(s.actions[0].args).toBe('{"question": "price feed"}');
    expect(s.actions[0].label).toBe('Looking through what your venture knows');
  });

  it('keeps two genuinely different calls apart', () => {
    let s = emptyStream();
    s = reduceChunk(s, chunk({ tool_calls: [{ index: 0, id: 'a', function: { name: 'web_search', arguments: '' } }] }));
    s = reduceChunk(s, chunk({ tool_calls: [{ index: 1, id: 'b', function: { name: 'file_ticket', arguments: '' } }] }));
    expect(s.actions.map((a) => a.tool)).toEqual(['web_search', 'file_ticket']);
  });

  it('ignores arguments that arrive before any call was named', () => {
    const s = reduceChunk(emptyStream(), chunk({ tool_calls: [{ index: 0, function: { arguments: '{}' } }] }));
    expect(s.actions).toHaveLength(0);
  });

  it('finishes when the engine says it finished', () => {
    expect(reduceChunk(emptyStream(), chunk({}, 'stop')).done).toBe(true);
  });

  it('survives a chunk with no choices at all', () => {
    const s = emptyStream();
    expect(reduceChunk(s, {})).toBe(s);
    expect(reduceChunk(s, null)).toBe(s);
  });
});

describe('reading the stream off the wire', () => {
  it('carries an incomplete event to the next read instead of parsing half of it', () => {
    // A chunk can arrive split mid-JSON. Parsing the half would drop part of a sentence silently.
    const { events, rest } = drainSse('data: {"a":1}\n\ndata: {"b":');
    expect(events).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b":');
  });

  it('reads several events out of one read', () => {
    const { events } = drainSse('data: {"a":1}\n\ndata: {"b":2}\n\n');
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('passes the terminator through so the caller can stop', () => {
    expect(drainSse('data: [DONE]\n\n').events).toEqual(['[DONE]']);
  });

  it('ignores SSE lines that are not data', () => {
    expect(drainSse(': keep-alive\n\nevent: ping\n\n').events).toEqual([]);
  });
});

describe('reading the reply as prose, not as markdown source', () => {
  it('turns emphasis into emphasis instead of showing the asterisks', () => {
    // The engine answers in markdown, so a founder was reading `**held**` literally — a product
    // showing its own plumbing.
    expect(formatInline('it refreshes **held** cards')).toEqual([
      { text: 'it refreshes ' }, { text: 'held', strong: true }, { text: ' cards' },
    ]);
  });

  it('marks code without the backticks', () => {
    expect(formatInline('into `card_prices` today')).toEqual([
      { text: 'into ' }, { text: 'card_prices', code: true }, { text: ' today' },
    ]);
  });

  it('leaves plain prose exactly as written', () => {
    expect(formatInline('nothing special here')).toEqual([{ text: 'nothing special here' }]);
  });

  it('never turns model output into markup', () => {
    // Spans are rendered as React nodes, so this stays text. If this ever became HTML, the composer
    // would have an injection route into the founder's browser.
    const spans = formatInline('<script>alert(1)</script> and **bold**');
    expect(spans[0].text).toContain('<script>');
    expect(spans.every((s) => typeof s.text === 'string')).toBe(true);
  });

  it('leaves an unclosed marker alone rather than eating the rest of the sentence', () => {
    expect(formatInline('a ** dangling marker')).toEqual([{ text: 'a ** dangling marker' }]);
  });
});

describe('depositing a document', () => {
  it('carries the document into the message, named', () => {
    const out = withDocument('Save this.', { name: 'positioning.md', text: 'We win on trust.' });
    expect(out).toContain('Save this.');
    expect(out).toContain('positioning.md');
    expect(out).toContain('We win on trust.');
  });

  it('asks for the deposit itself when the founder only attached a file', () => {
    expect(withDocument('   ', { name: 'notes.md', text: 'x' })).toContain('save this to my venture');
  });

  it('says when a document was cut, rather than cutting it silently', () => {
    const out = withDocument('', { name: 'big.md', text: 'x'.repeat(MAX_DOCUMENT_CHARS + 500) });
    expect(out).toContain('too long to include');
  });

  it('leaves an ordinary message alone', () => {
    expect(withDocument('Just a message', null)).toBe('Just a message');
  });

});

describe('splitting a reply into what is read and what is inspected', () => {
  it('puts the ticket draft in its own block, out of the founder’s way', async () => {
    // The 4,282-character reply. The founder needs the two paragraphs; the ticket underneath them is
    // a contract with the lane and belongs behind a control.
    const { parseReply, hasDraft } = await import('../composer');
    const blocks = parseReply([
      'Here is the situation in plain English.',
      '',
      '```markdown',
      '# ARCA-NEW — Market page price freshness',
      '## Scope',
      '- [ ] Every card price has a refresh interval',
      '```',
      '',
      'Want me to file this?',
    ].join('\n'));

    expect(blocks.map((b) => b.kind)).toEqual(['text', 'draft', 'text']);
    expect(blocks[1].text).toContain('# ARCA-NEW');
    expect(hasDraft(blocks)).toBe(true);
  });

  it('renders a heading as a heading, not as literal hashes', async () => {
    const { parseReply } = await import('../composer');
    expect(parseReply('## Why this matters')).toEqual([{ kind: 'heading', text: 'Why this matters' }]);
  });

  it('strips a checkbox marker, which a founder should never meet', async () => {
    // `- [ ]` matches the bullet pattern too, so the checkbox form has to win or the founder reads a
    // literal "[ ]" in the middle of a sentence.
    const { parseReply } = await import('../composer');
    expect(parseReply('- [ ] Prices are refreshed daily')).toEqual([
      { kind: 'item', text: 'Prices are refreshed daily' },
    ]);
    expect(parseReply('- [x] Already done')).toEqual([{ kind: 'item', text: 'Already done' }]);
  });

  it('handles bullets and numbers alike', async () => {
    const { parseReply } = await import('../composer');
    expect(parseReply('- one\n* two\n1. three\n2) four').map((b) => b.text))
      .toEqual(['one', 'two', 'three', 'four']);
  });

  it('keeps a paragraph together and splits on a blank line', async () => {
    const { parseReply } = await import('../composer');
    const blocks = parseReply('line one\nline two\n\nsecond paragraph');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('line one\nline two');
  });

  it('treats an unterminated fence as a draft, not as prose', async () => {
    // A truncated reply. Showing its contents as the answer is how a founder ends up reading half a
    // ticket and thinking it was addressed to them.
    const { parseReply } = await import('../composer');
    const blocks = parseReply('Here is what I would file:\n```\n# ARCA-NEW\n## Scope');
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'draft']);
  });

  it('says there is no draft when the reply is only prose', async () => {
    const { parseReply, hasDraft } = await import('../composer');
    expect(hasDraft(parseReply('Just a question for you.'))).toBe(false);
  });

  it('does not invent a draft out of an empty fence', async () => {
    const { parseReply, hasDraft } = await import('../composer');
    expect(hasDraft(parseReply('text\n```\n```\nmore'))).toBe(false);
  });
});

describe('keeping the read-back’s four parts apart', () => {
  it('starts a new block at each bold label, even with no blank line between', async () => {
    // The composer writes its four sections on consecutive lines. Joining them — which is right for
    // ordinary prose — turned the read-back into a single 345-word wall, which is most of what this
    // ticket set out to stop.
    const { parseReply } = await import('../composer');
    const blocks = parseReply([
      '**What I understood** — prices are stale.',
      '**What I’d do** — fix the refresh.',
      '**What I’d leave alone** — the catalog work.',
      '**Before I file** — whole market, or just held cards?',
    ].join('\n'));
    expect(blocks).toHaveLength(4);
    expect(blocks[0].text).toContain('What I understood');
    expect(blocks[3].text).toContain('Before I file');
  });

  it('still keeps ordinary wrapped prose together', async () => {
    const { parseReply } = await import('../composer');
    expect(parseReply('a sentence that wraps\nonto a second line')).toHaveLength(1);
  });

  it('does not split on bold that is not at the start of a line', async () => {
    const { parseReply } = await import('../composer');
    expect(parseReply('this is **important** and continues\nhere')).toHaveLength(1);
  });
});

describe('agreeing to a specific draft', () => {
  it('names the draft, so a yes cannot attach to the wrong thing', async () => {
    // It already went wrong once: asked to file, the composer answered "I don't have a drafted
    // ticket from earlier in this conversation" — the agreement and the draft had come apart.
    const { parseReply, draftTitle, fileThisMessage } = await import('../composer');
    const blocks = parseReply('Here it is.\n```\n# ARCA-NEW — Market page price freshness\n## Scope\n- x\n```');
    const title = draftTitle(blocks);
    expect(title).toBe('ARCA-NEW — Market page price freshness');
    const msg = fileThisMessage(title);
    expect(msg).toContain('Market page price freshness');
    expect(msg).toContain('stop and tell me rather than filing something else');
  });

  it('falls back to the first real line when the draft has no heading', async () => {
    const { parseReply, draftTitle } = await import('../composer');
    expect(draftTitle(parseReply('x\n```\nsome ticket without a heading\nmore\n```'))).toBe('some ticket without a heading');
  });

  it('offers nothing to agree to when there is no draft', async () => {
    // The button must never appear meaninglessly, or a founder learns it sometimes does nothing.
    const { parseReply, draftTitle } = await import('../composer');
    expect(draftTitle(parseReply('Just a question — whole market, or held cards only?'))).toBeNull();
  });

  it('still guards against filing the wrong thing when it has no title to name', async () => {
    const { fileThisMessage } = await import('../composer');
    expect(fileThisMessage(null)).toContain('stop and tell me');
  });
});

describe('what the search tool leaves behind', () => {
  it('strips the citation markers a founder was being shown', async () => {
    // A real reply: "…GemRate owns population dataturn1search1turn1search2
    // ARCA's own backlog…". Private Use Area characters, meaningless outside the tool that wrote
    // them, rendering in a browser as blank boxes. Found by reading a live reply — the machine-word
    // scan missed them because they are not words.
    const { stripPrivateMarkers } = await import('../composer');
    const raw = 'GemRate owns population data.turn1search1turn1search2ARCA’s own backlog is different.';
    const clean = stripPrivateMarkers(raw);
    expect(clean).not.toMatch(/[-]/);
    expect(clean).toContain('population data.');
    expect(clean).toContain('ARCA’s own backlog');
  });

  it('does not weld two sentences together when the markers sat between them', async () => {
    // Removing them can leave "…population data ARCA's own backlog…", which reads worse than the
    // markers did.
    const { stripPrivateMarkers } = await import('../composer');
    expect(stripPrivateMarkers('One thing.Another thing.')).toBe('One thing. Another thing.');
  });

  it('leaves ordinary prose exactly alone', async () => {
    const { stripPrivateMarkers } = await import('../composer');
    const plain = 'A normal sentence. Another one. With a — dash and “quotes”.';
    expect(stripPrivateMarkers(plain)).toBe(plain);
  });

  it('cleans them before the reply is split into blocks', async () => {
    const { parseReply } = await import('../composer');
    const blocks = parseReply('Some finding.turn1search1More detail here.');
    expect(blocks.map((b) => b.text).join(' ')).not.toMatch(/[-]/);
  });
});

describe('activity lines a founder actually reads (FB-088)', () => {
  const act = (label: string, i: number) => ({ id: `c${i}`, tool: 't', label, args: '' });

  it('collapses an immediate repeat — the stutter seen on a live walk', () => {
    // Observed against the real ARCA box: the composer searched the venture brain twice and told the
    // founder "Looking through what your venture knows" twice before an otherwise excellent answer.
    const a = [act('Looking through what your venture knows', 1), act('Looking through what your venture knows', 2)];
    expect(visibleActions(a).map((x) => x.label)).toEqual(['Looking through what your venture knows']);
  });

  it('keeps a genuine sequence that returns to the same tool', () => {
    // search → read → search is a real sequence; flattening it would misrepresent what happened.
    const a = [act('search', 1), act('read', 2), act('search', 3)];
    expect(visibleActions(a).map((x) => x.label)).toEqual(['search', 'read', 'search']);
  });

  it('leaves one action and none alone', () => {
    expect(visibleActions([])).toEqual([]);
    expect(visibleActions([act('one', 1)])).toHaveLength(1);
  });
});
