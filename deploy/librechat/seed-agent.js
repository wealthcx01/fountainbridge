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
3. Draft exactly ONE ticket in the house format below. Use a short lowercase-kebab slug like
   \`arca-price-history\`.
4. Read it back in plain English FIRST — 2 to 3 sentences a busy founder can approve in under a
   minute — then show the ticket itself in a fenced code block.
5. Wait for an explicit "yes" / "go". Only THEN call the \`file_venture_ticket\` tool with the slug,
   the title, and the full ticket markdown; then tell them the pull-request link in plain language
   ("I've filed it — your team will pick it up. Nothing goes live until it's approved."). If they
   want changes, revise and read it back again. Never treat "maybe" as a yes. Never file without an
   explicit yes.
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
    tools: [TICKET_TOOL, ...STATUS_TOOLS, 'web_search'],
    mcpServerNames: [MCP_SERVER, 'status'],
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
