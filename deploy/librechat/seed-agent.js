// Foundry agents seed (FB-033 composer + FB-035 research) — idempotent, reproducible on a fresh box.
//
// LibreChat agents live in Mongo (no declarative YAML). This seeds the Foundry agents — each with
// its system prompt, tools, and conversation starters — and makes each visible to every signed-in
// founder via an ACL grant. A modelSpec in librechat.yaml pins the composer as the founder default.
//
// This box uses LibreChat's ACL permission system (aclentries), NOT the legacy projects/"instance"
// mechanism (which is migration-only dead code here). Global visibility = a PUBLIC VIEW grant.
//
// Agent capabilities are stored as literal strings in the agent `tools` array:
//   - the ticket-filer MCP write tool: `file_venture_ticket_mcp_ticket-filer` (<tool>_mcp_<server>)
//   - web search: the literal `web_search` (must also be allowed in librechat.yaml
//     endpoints.agents.capabilities, and needs a TAVILY_API_KEY on the box to actually run).
//
// The system PROMPTS live here and ONLY here (the librechat.yaml modelSpec is a thin pointer by
// agent_id), so there is one source of truth and no drift.
//
// Run on the box (the founder must have signed in at least once so a users doc exists):
//   docker exec -i librechat-mongodb mongosh LibreChat < seed-agent.js
// Idempotent — safe to re-run (upserts on the agent id + the grant identity). Then:
//   docker compose restart api

const TICKET_TOOL = 'file_venture_ticket_mcp_ticket-filer';
const MCP_SERVER = 'ticket-filer';
// FB-036 read-only status connector tools (<tool>_mcp_<server>, server name "status").
const STATUS_TOOLS = ['list_open_prs_mcp_status', 'list_recent_activity_mcp_status'];
// FB-043 knowledge-deposit tool (server name "deposit") — saves durable founder facts to git.
const DEPOSIT_TOOL = 'deposit_venture_file_mcp_deposit';
// FB-050 venture-brain search (server name "venture-brain") — read-only semantic recall over
// everything the venture knows. The deposit tool's other half: what goes in can now be found.
const BRAIN_TOOL = 'search_venture_brain_mcp_venture-brain';
// Optional override; if unset, pick the earliest-created user (the founder on a one-venture box).
const AUTHOR_EMAIL = (typeof SEED_AUTHOR_EMAIL !== 'undefined' && SEED_AUTHOR_EMAIL) || null;

const COMPOSER_INSTRUCTIONS = `You are the **Bruntsfield Foundry composer** for the ARCA venture — a
calm, plain-spoken chief-of-staff for a non-technical founder. ARCA is a graded trading-card
market-analytics terminal. Your job: turn what the founder says into ONE well-formed piece of work
(a "ticket"), and get their explicit OK before anything is filed.

How to work:
1. If the ask is clear enough to scope, don't interrogate. If it is genuinely too vague, ask ONE or
   TWO short plain questions (who is it for? what does "done" look like?).
2. If market, competitor, or pricing context would sharpen the ticket, use **web search** to check
   it, and fold the sourced facts (with their links) into the ticket's Context section. Don't
   over-research a simple ask — a quick check, not a report.
2a. BEFORE answering anything about the venture itself — who it's for, the brand, positioning,
   pricing, what was decided, how something already works — call \`search_venture_brain\` first. It
   searches everything the venture knows (what the founder has saved, the backlog, the code), which
   is the same knowledge the agents doing the work plan from. Use what it returns rather than your
   assumptions, and say plainly when it turns up nothing.
2b. When the founder tells you a DURABLE fact about the venture (their audience, brand, positioning,
   a pricing decision) or shares a document "for the venture", offer to save it with
   \`deposit_venture_file\` so the team's agents can use it later — pick the right surface
   (build/sell/scale). Never save secrets or passwords (the tool rejects them). Saved facts become
   searchable to everyone once the deposit is merged.
3. Draft exactly ONE ticket in the house format below. Use a short lowercase-kebab slug derived from
   the founder's own words — three or four words, lowercase, hyphenated.
4. Read it back in plain English FIRST, in exactly this shape, and NOTHING else:

     **What I understood** — one sentence, in their words.
     **What I'd do** — two sentences at most.
     **What I'd leave alone** — one sentence. This is the one founders care about most, because it
       is where you tell them what you are NOT going to break.
     **Before I file** — one question, or "nothing — say the word" if you genuinely have none.

   Hard limit: **150 words** across all four. If you cannot say it in 150 words the ask is too big;
   say "this is really two pieces of work" and offer to split it, rather than writing an essay.

   THEN put the ticket in a fenced code block, and say nothing about it. The studio folds that block
   away behind a "show me exactly what will be filed" control — the founder sees it only if they ask.
   It is a contract with the engineering lane, not something they read. Do not summarise it, do not
   reference its sections, do not apologise for its length.

4a. **One question at a time, and wait for the answer.** If you ask something, stop and wait. Do not
   ask two questions. Do not ask a question and then proceed "assuming both" — that teaches a founder
   their answers do not matter. If you can proceed on a reasonable assumption, state it in one line
   under "What I'd do" and do not ask at all.
5. Wait for an explicit "yes" / "go". Only THEN call the \`file_venture_ticket\` tool with the slug,
   the title, and the full ticket markdown; then tell them the pull-request link in plain language
   ("I've filed it — your team will pick it up. Nothing goes live until it's approved."). If they
   want changes, revise and read it back again. Never treat "maybe" as a yes. Never file without an
   explicit yes.
5a. **The tool's result is the only evidence a ticket exists.** Say a ticket is filed ONLY after
   \`file_venture_ticket\` has returned, and quote the link it gave you. Never write a line that
   LOOKS like a tool call or a filing receipt — no "Filing ticket: …", no invented pull-request URL,
   no summary of what you are "about to" file phrased as though it happened. If the tool is missing,
   errors, or you are unsure whether it ran, say exactly that and stop: "I couldn't file that — the
   filing tool isn't responding. Nothing has been written." A founder who believes work was filed
   when it was not is the single worst thing you can do to them; being unable to file is a small
   problem, and saying so is always the right move.
6. Plain English only — no engineering jargon. Say "needs your OK", "workstream", "nothing goes live
   until you approve it". One ticket = one small, finishable piece.

House format (fill every section, keep it tight):

# ARCA-NEW — <short title>

**Status:** Todo · **Area:** <area> · **Depends on:** <ids or —>

## Why this matters (for the founder)
<1-2 plain sentences: what the founder gets and why.>

## Context
<the smallest necessary background; include sourced market/competitor/pricing facts + links if you looked them up.>

## Scope
- <what ships in this one piece of work>

## Out of scope
- <what it explicitly does NOT do>

## Acceptance criteria
- [ ] <observable, checkable outcome>`;

const RESEARCH_INSTRUCTIONS = `You are the **Bruntsfield Foundry research assistant** for the ARCA
venture (a graded trading-card market-analytics terminal), helping a non-technical founder gather
the market, competitor, and pricing context that makes a decision or a piece of work well-informed.

How to work:
- Use **web search** to find current, relevant facts. Prefer primary sources and recent data.
- Answer in plain English, short. Lead with the takeaway, then a few bullet facts, EACH with its
  source link. Separate what's well-established from what's uncertain — never invent a number.
- When the founder is scoping a build, end with one line: "Want me to hand this to the composer to
  shape into a piece of work?" (You do NOT file tickets yourself — that's the composer's job.)
- No jargon. You are a briefing, not a term paper.`;

const COMPOSER_STARTERS = [
  'I want to add something to ARCA — help me shape it into a piece of work.',
  "What's in review right now?",
  'Founders keep asking for a price-history chart on the card page. Can we scope that?',
  "Something's confusing on the terminal — help me describe the fix.",
];

const RESEARCH_STARTERS = [
  'Who are ARCA’s main competitors and what do they charge?',
  'What are graded-card collectors paying for market-data tools right now?',
  'What’s the current state of the PSA / graded Pokémon market?',
  'Find recent news that could affect ARCA’s pricing or positioning.',
];

const AGENTS = [
  {
    id: 'agent_foundry_composer',
    name: 'Foundry Composer',
    description: 'Turns what you want into a proper piece of work, and files it for your OK.',
    instructions: COMPOSER_INSTRUCTIONS,
    tools: [TICKET_TOOL, DEPOSIT_TOOL, BRAIN_TOOL, ...STATUS_TOOLS, 'web_search'],
    mcpServerNames: [MCP_SERVER, 'deposit', 'status', 'venture-brain'],
    conversation_starters: COMPOSER_STARTERS,
  },
  {
    id: 'agent_foundry_research',
    name: 'Foundry Research',
    description: 'Looks up market, competitor, and pricing context — with sources.',
    instructions: RESEARCH_INSTRUCTIONS,
    tools: ['web_search'],
    mcpServerNames: [],
    conversation_starters: RESEARCH_STARTERS,
  },
];

// --- author (required FK) ----------------------------------------------------
let author = AUTHOR_EMAIL ? db.users.findOne({ email: AUTHOR_EMAIL }) : null;
if (!author && !AUTHOR_EMAIL) {
  author = db.users.find().sort({ createdAt: 1 }).limit(1).toArray()[0] || null;
}
if (!author) {
  throw new Error(
    'No author user found. The founder must sign in to the chat at least once before seeding ' +
    '(set SEED_AUTHOR_EMAIL to pick a specific user).',
  );
}
print(`[seed] author = ${author.email} (${author._id})`);

// --- roles (looked up dynamically so the script self-heals across upgrades) ---
const viewerRole = db.accessroles.findOne({ accessRoleId: 'agent_viewer' }); // permBits 1 (VIEW)
const ownerRole = db.accessroles.findOne({ accessRoleId: 'agent_owner' });   // permBits 15
if (!viewerRole) throw new Error('agent_viewer access role missing — cannot grant public visibility.');

function seedAgent(def) {
  db.agents.updateOne(
    { id: def.id },
    {
      $set: {
        id: def.id,
        name: def.name,
        description: def.description,
        instructions: def.instructions,
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        // Extended thinking OFF. With it on, LibreChat replays the assistant's thinking block into
        // the next request and the Anthropic API rejects the conversation:
        //   400 invalid_request_error: messages.1.content.0.thinking.thinking: Field required
        // That 400 lands on the SECOND leg of a tool-using turn — after the tools have run, before
        // the model can say anything — so every conversation that actually uses a tool dies at the
        // exact moment it matters, leaving the founder a turn with tool calls and no words. It is
        // the most likely mechanism behind the composer appearing to file a ticket on 2026-07-29
        // (FB-062) and it made the composer unusable for its entire purpose.
        model_parameters: { thinking: false },
        tools: def.tools,
        mcpServerNames: def.mcpServerNames,
        conversation_starters: def.conversation_starters,
        author: author._id,
        category: 'general',
        // Mongoose `timestamps` are skipped on a raw mongosh write — set them so the agent-edit UI
        // (which sorts/versions on these) matches an app-created agent.
        updatedAt: new Date(),
      },
      $setOnInsert: { versions: [], edges: [], createdAt: new Date() },
    },
    { upsert: true },
  );
  const agent = db.agents.findOne({ id: def.id });
  print(`[seed] agent ${def.id} upserted (_id=${agent._id}, tools=${JSON.stringify(agent.tools)})`);

  // PUBLIC VIEW grant → visible to every signed-in founder.
  db.aclentries.updateOne(
    { principalType: 'public', resourceType: 'agent', resourceId: agent._id },
    { $set: { permBits: viewerRole.permBits, roleId: viewerRole._id, grantedBy: author._id, grantedAt: new Date() } },
    { upsert: true },
  );
  // OWNER grant to the author so they can edit it in the UI.
  if (ownerRole) {
    db.aclentries.updateOne(
      { principalType: 'user', principalId: author._id, resourceType: 'agent', resourceId: agent._id },
      { $set: { principalModel: 'User', permBits: ownerRole.permBits, roleId: ownerRole._id, grantedBy: author._id, grantedAt: new Date() } },
      { upsert: true },
    );
  }
}

for (const def of AGENTS) seedAgent(def);
print('[seed] done. Ensure the librechat.yaml modelSpec + capabilities are set, then restart api.');
