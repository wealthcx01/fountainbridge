/**
 * Which skills a worker used on a wake, read from the transcripts it already wrote (FB-231).
 *
 * John asked of the office: *"we should be able to see what skills each worker used."* The answer
 * was no, and for a plain reason — the office record holds eight fields per character and the run
 * report held nine. **Neither had room for a skill.** It was not hidden behind a permission or a
 * missing read; nobody wrote it down.
 *
 * ## Why this needs no new producer
 *
 * Every skill invocation is already on disk. Claude writes one JSON object per line to
 * `~/.claude/projects/<slug>/<session-id>.jsonl`, and a skill call appears in it as a tool use:
 *
 *     {"message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"write-tests"}}]}}
 *
 * And the lane already knows which sessions belong to which ticket: `note_session` has written
 * `{session, ticket, stage}` to `sessions.jsonl` on every `claude_lane` call since FB-231's first
 * half. So both halves of the fact exist and nothing joins them. This joins them.
 *
 * ## One wake is several sessions
 *
 * `supervisor.sh` calls `claude_lane` five times for one ticket — plan, implement, gate-check,
 * review, qa — and each gets its **own** session id, deliberately: no `--resume` anywhere, so the
 * review stage sees the diff and not the reasoning that produced it. That hold-out critic is the
 * thing most easily lost by reusing a session to save tokens.
 *
 * So the skills for a ticket are the **union across its sessions**, in the order each was first
 * used. A founder asking "what did my team use on this?" means the ticket, not one stage of it.
 *
 * ## What it must never do
 *
 * **Never fail the wake.** A transcript that cannot be read is a missing fact, not a reason to lose
 * the work — the same rule `note_session` follows. Every failure here returns what it has.
 *
 * And an empty list is **not** a claim that no skills were used. It means none were used, or the
 * transcript was unreadable, or the run predates this. The contract says so (bcap-contracts 0.4.0)
 * and the studio must not render it as a fact.
 */

/** The marker, kept as one constant so the parse and its tests cannot drift apart. */
const SKILL_TOOL = 'Skill';

/**
 * Distinct skill names in one transcript, in the order they were first used.
 *
 * Takes the file's text rather than a path: the parse is the part worth testing, and a function that
 * reads a file cannot be tested without one.
 *
 * Tolerant on purpose. A transcript is append-only and a wake can be killed mid-write, so the last
 * line is routinely half a JSON object. One unparseable line must not cost the other nine hundred.
 */
export function skillsInTranscript(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text ?? '').split('\n')) {
    // Cheap reject first: these files reach tens of megabytes and almost no line is a skill call.
    if (!line.includes(`"${SKILL_TOOL}"`)) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // a truncated final line, or a line that is not JSON at all
    }
    const content = record?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type !== 'tool_use' || part?.name !== SKILL_TOOL) continue;
      const name = typeof part?.input?.skill === 'string' ? part.input.skill.trim() : '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * The session ids the lane recorded against one ticket, oldest first.
 *
 * `sessions.jsonl` is append-only and one line per `claude_lane` call. Same tolerance as above: a
 * half-written line is skipped, never thrown.
 */
export function sessionsForTicket(indexText, ticket) {
  if (!ticket) return [];
  const out = [];
  const seen = new Set();
  for (const line of String(indexText ?? '').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row?.ticket !== ticket) continue;
    const session = typeof row?.session === 'string' ? row.session.trim() : '';
    if (!session || seen.has(session)) continue;
    seen.add(session);
    out.push(session);
  }
  return out;
}

/**
 * Every skill used on one ticket, across all of its sessions, first use first.
 *
 * `readTranscript(sessionId)` returns the transcript's text, or null when there is none to read —
 * injected so this stays pure and so the caller owns where transcripts live. A session with no
 * readable transcript contributes nothing and does not stop the others.
 */
export function skillsForTicket({ indexText, ticket, readTranscript }) {
  const out = [];
  const seen = new Set();
  for (const session of sessionsForTicket(indexText, ticket)) {
    let text = null;
    try {
      text = readTranscript(session);
    } catch {
      continue; // unreadable transcript: a missing fact, never a failed wake
    }
    if (!text) continue;
    for (const skill of skillsInTranscript(text)) {
      if (seen.has(skill)) continue;
      seen.add(skill);
      out.push(skill);
    }
  }
  return out;
}
