/**
 * The composer, as a read model the studio can render (FB-065).
 *
 * ## Why this exists
 *
 * Telling the studio what you want is the most important thing a founder does, and until now it
 * happened in a different application, at a different address, that looked like a different product —
 * because it was one. This is the pure half of moving that conversation inside the studio: work out
 * where a venture's engine lives, turn its stream into things a founder can read, and say plainly
 * what a tool call was. The half that touches the network lives in `app/api/composer`.
 *
 * ## What the engine actually does, as opposed to what the docs say
 *
 * The engine stays LibreChat, reached through its documented Agents API rather than the internal
 * browser route the ARCA dogfood had to reverse-engineer. Driving the real thing turned up three
 * facts that shape everything here, none of which are in the documentation:
 *
 *  1. **A tool call arrives split across chunks, and its indices disagree.** The chunk carrying the
 *     tool's `id` and `name` came back with `index: 1`, while every chunk carrying that same call's
 *     arguments came back with `index: 0`. Keying strictly by index — the obvious reading of the
 *     OpenAI format — splits one call into two, and the founder sees a phantom second action.
 *  2. **A `conversation_id` you did not get from the engine is rejected**, and the engine never
 *     tells you the one it generated. So the studio cannot thread by id; it carries the transcript
 *     and sends it each turn, which is how an OpenAI-compatible API is meant to be used anyway.
 *  3. **Tool names are mangled by transport** — `search_venture_brain` comes back as
 *     `search_venture_brain_mcp_venture-brain`. Rendering that to a founder would be showing them
 *     our plumbing.
 */

/** One turn in the conversation, as the founder sees it. */
export interface ComposerMessage {
  role: 'user' | 'assistant';
  content: string;
  /** What it did while answering. Empty for an ordinary reply. */
  actions?: ComposerAction[];
}

/**
 * Something the composer did, not just said.
 *
 * These are shown, never hidden. After FB-062 — where the composer told a founder it had filed a
 * ticket it had not filed — a visible action is the evidence that "filed" means filed.
 */
export interface ComposerAction {
  id: string;
  /** The raw tool name, for tests and debugging. Never rendered. */
  tool: string;
  /** What it did, in the founder's language. */
  label: string;
  /** Streamed JSON arguments, accumulated. May be partial while streaming. */
  args: string;
}

/**
 * Where a venture's composer engine lives.
 *
 * By the same convention as the old chat link (`chat.<box host>`), because it is the same box — the
 * engine did not move, only the surface did. Null until the venture has a box, so the studio can
 * say "coming with your box" rather than fail at a founder.
 *
 * It deliberately repeats `ventureChatUrl` rather than importing it: that module reads the manifest
 * files off disk, and this one is imported by a client component. A test asserts the two agree, so
 * the duplication cannot drift silently.
 */
export function composerEndpoint(vpsHost: string | null): string | null {
  return vpsHost ? `https://chat.${vpsHost}` : null;
}

/**
 * The environment variable holding a venture's engine key.
 *
 * One key per venture, because one box per venture (D1) — a key that could reach two ventures would
 * be a hole in the isolation the whole architecture rests on. `deploy/librechat/enable-agents-api.sh`
 * mints it on the box and prints this exact name.
 */
export function composerKeyEnvName(ventureId: string): string {
  return `COMPOSER_API_KEY_${ventureId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

/**
 * A tool's name, as a founder should read it.
 *
 * The suffix strip handles fact 3 above. The fallback is deliberately vague rather than wrong: an
 * unknown tool becomes "Working…", never a guess at what it did, because the whole point of showing
 * actions is that they can be trusted.
 */
// Matched against the tool names the ARCA box actually reports, not against names we assumed:
// `file_venture_ticket`, `deposit_venture_file`, `search_venture_brain`, `list_open_prs`,
// `list_recent_activity`. The first draft of this table guessed `file_ticket`, so the single most
// important action a founder can see — the moment their words become a real piece of work — rendered
// as "Working…". That is the FB-062 failure wearing a different coat.
const TOOL_LABELS: Array<[RegExp, string]> = [
  [/file.*ticket|create.*ticket|ticket.?filer/i, 'Filing this as a piece of work'],
  [/^deposit/i, 'Saving this to your venture’s knowledge'],
  [/venture_brain|^search_venture/i, 'Looking through what your venture knows'],
  [/web_search|^tavily/i, 'Searching the web'],
  [/list_open_prs|list_recent_activity|status/i, 'Checking what your team is doing'],
];

export function describeTool(rawName: string): string {
  // `search_venture_brain_mcp_venture-brain` → `search_venture_brain`.
  const name = rawName.replace(/_mcp_[\w-]+$/, '');
  for (const [pattern, label] of TOOL_LABELS) if (pattern.test(name)) return label;
  return 'Working…';
}

/** Accumulated state of one streamed reply. The reducer below is the only thing that mutates it. */
export interface StreamState {
  content: string;
  actions: ComposerAction[];
  done: boolean;
}

export const emptyStream = (): StreamState => ({ content: '', actions: [], done: false });

interface RawChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
}

/**
 * Fold one SSE chunk into the reply being built.
 *
 * The tool-call handling is where fact 1 lives. A chunk that names a tool starts a new action; a
 * chunk that only carries arguments is appended to the action it belongs to — matched by index when
 * that index is one we have seen, and otherwise to the most recent action, because the engine's own
 * indices disagree between the two. Getting this wrong shows a founder an action that never happened.
 */
export function reduceChunk(state: StreamState, raw: unknown): StreamState {
  const chunk = raw as RawChunk;
  const choice = chunk?.choices?.[0];
  if (!choice) return state;

  let { content } = state;
  let actions = state.actions;

  if (typeof choice.delta?.content === 'string') content += choice.delta.content;

  for (const call of choice.delta?.tool_calls ?? []) {
    const name = call.function?.name;
    if (name) {
      // A named chunk always starts an action — this is the only moment we learn what it is.
      actions = [...actions, {
        id: call.id ?? `call-${actions.length}`,
        tool: name,
        label: describeTool(name),
        args: call.function?.arguments ?? '',
      }];
      continue;
    }
    const args = call.function?.arguments;
    if (!args || actions.length === 0) continue;
    // Arguments only. Belongs to the action at this index if we have one, else the newest — the
    // engine's index for arguments does not match the index it announced the call under.
    const at = typeof call.index === 'number' && call.index < actions.length ? call.index : actions.length - 1;
    actions = actions.map((a, i) => (i === at ? { ...a, args: a.args + args } : a));
  }

  return { content, actions, done: state.done || choice.finish_reason != null };
}

/**
 * Split an SSE buffer into complete data payloads, returning whatever is left over.
 *
 * A chunk can arrive split mid-JSON, so the remainder has to be carried to the next read. Parsing
 * a half-received line would drop a piece of the reply silently, which on this surface means a
 * founder reading a sentence that is missing its middle.
 */
export function drainSse(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: string[] = [];
  for (const part of parts) {
    for (const line of part.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) events.push(trimmed.slice(5).trim());
    }
  }
  return { events, rest };
}

/**
 * One run of the composer's reply, with the emphasis it meant rather than the characters it typed.
 *
 * The engine answers in markdown, so a founder was reading `**held**` and `` `card_prices` `` as
 * literal text. Not a crash, just a product that looks like it is leaking its own plumbing — the
 * same class of thing as showing a founder a tool name.
 *
 * Deliberately tokens, not HTML: the component renders these as React nodes, so nothing the model
 * writes can become markup. A composer that could emit HTML into the studio would be a model with
 * an injection route into the founder's browser.
 */
export type Span = { text: string; strong?: boolean; code?: boolean };

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

export function formatInline(text: string): Span[] {
  const spans: Span[] = [];
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      spans.push({ text: part.slice(2, -2), strong: true });
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      spans.push({ text: part.slice(1, -1), code: true });
    } else {
      spans.push({ text: part });
    }
  }
  return spans.length > 0 ? spans : [{ text }];
}

/** The largest document the studio will carry into a conversation, in characters. */
export const MAX_DOCUMENT_CHARS = 60_000;

/**
 * A deposited document, folded into the message the founder sends.
 *
 * The Agents API has no upload of its own — uploads are a JWT-only route on LibreChat's own surface,
 * which the studio deliberately does not hold a credential for. So a document becomes text in the
 * conversation, and the composer's existing deposit tool is what actually files it. That covers what
 * founders deposit (notes, research, positioning) and honestly does not cover a PDF or a deck.
 */
export function withDocument(message: string, doc: { name: string; text: string } | null): string {
  if (!doc) return message;
  const text = doc.text.length > MAX_DOCUMENT_CHARS
    ? `${doc.text.slice(0, MAX_DOCUMENT_CHARS)}\n\n[…the rest of this document was too long to include]`
    : doc.text;
  const ask = message.trim() || 'Please save this to my venture’s knowledge.';
  return `${ask}\n\n--- ${doc.name} ---\n${text}\n--- end of ${doc.name} ---`;
}

/** Files a founder can deposit as text. Anything else is refused with a reason, never silently. */
export const READABLE_DOCUMENT = /\.(md|markdown|txt|csv|tsv|json|ya?ml|log)$/i;

export function documentRefusal(name: string): string | null {
  if (READABLE_DOCUMENT.test(name)) return null;
  return 'The studio can read text documents (.md, .txt, .csv, .json, .yaml). ' +
    `“${name}” is not one, so it was not sent — paste what matters, or drop it in the chat on your venture’s own box.`;
}
