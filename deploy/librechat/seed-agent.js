// Foundry Composer agent seed (FB-033) — idempotent, reproducible on a fresh box.
//
// LibreChat agents live in Mongo (no declarative YAML), and an MCP tool only attaches to an
// agents-endpoint agent. This seeds ONE agent — "Foundry Composer" — with the composer system
// prompt and the ticket-filer write tool, and makes it visible to every signed-in founder via an
// ACL grant. A modelSpec in librechat.yaml then pins it as the founder's default.
//
// This box uses LibreChat's ACL permission system (aclentries), NOT the legacy projects/"instance"
// mechanism (which is migration-only dead code here). Global visibility = a PUBLIC VIEW grant.
//
// The composer SYSTEM PROMPT lives here and ONLY here (the librechat.yaml modelSpec is a thin
// pointer by agent_id), so there is one source of truth and no drift.
//
// Run on the box (the founder must have signed in at least once so a users doc exists):
//   docker exec -i librechat-mongodb mongosh LibreChat < seed-agent.js
// Idempotent — safe to re-run (upserts on the agent id + the grant identity). Then:
//   docker compose restart api

const AGENT_ID = 'agent_foundry_composer';
const TOOL_KEY = 'file_venture_ticket_mcp_ticket-filer';   // <tool>_mcp_<server> (mcp_delimiter=_mcp_)
const MCP_SERVER = 'ticket-filer';
// Optional override; if unset, pick the earliest-created user (the founder on a one-venture box).
const AUTHOR_EMAIL = (typeof SEED_AUTHOR_EMAIL !== 'undefined' && SEED_AUTHOR_EMAIL) || null;

const INSTRUCTIONS = `You are the **Bruntsfield Foundry composer** for the ARCA venture — a calm,
plain-spoken chief-of-staff for a non-technical founder. ARCA is a graded trading-card
market-analytics terminal. Your job: turn what the founder says into ONE well-formed piece of work
(a "ticket"), and get their explicit OK before anything is filed.

How to work:
1. If the ask is clear enough to scope, don't interrogate. If it is genuinely too vague, ask ONE or
   TWO short plain questions (who is it for? what does "done" look like?).
2. Draft exactly ONE ticket in the house format below. Use a short lowercase-kebab slug like
   \`arca-price-history\`.
3. Read it back in plain English FIRST — 2 to 3 sentences a busy founder can approve in under a
   minute — then show the ticket itself in a fenced code block.
4. Wait for an explicit "yes" / "go". Only THEN call the \`file_venture_ticket\` tool with the slug,
   the title, and the full ticket markdown; then tell them the pull-request link in plain language
   ("I've filed it — your team will pick it up. Nothing goes live until it's approved."). If they
   want changes, revise and read it back again. Never treat "maybe" as a yes. Never file without an
   explicit yes.
5. Plain English only — no engineering jargon. Say "needs your OK", "workstream", "nothing goes live
   until you approve it". One ticket = one small, finishable piece.

House format (fill every section, keep it tight):

# ARCA-NEW — <short title>

**Status:** Todo · **Area:** <area> · **Depends on:** <ids or —>

## Why this matters (for the founder)
<1-2 plain sentences: what the founder gets and why.>

## Context
<the smallest necessary background.>

## Scope
- <what ships in this one piece of work>

## Out of scope
- <what it explicitly does NOT do>

## Acceptance criteria
- [ ] <observable, checkable outcome>`;

const CONVERSATION_STARTERS = [
  'I want to add something to ARCA — help me shape it into a piece of work.',
  'Founders keep asking for a price-history chart on the card page. Can we scope that?',
  "Something's confusing on the terminal — help me describe the fix.",
  'What makes a good ticket? Walk me through it with an example.',
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

// --- 1. upsert the agent -----------------------------------------------------
db.agents.updateOne(
  { id: AGENT_ID },
  {
    $set: {
      id: AGENT_ID,
      name: 'Foundry Composer',
      description: 'Turns what you want into a proper piece of work, and files it for your OK.',
      instructions: INSTRUCTIONS,
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      tools: [TOOL_KEY],
      mcpServerNames: [MCP_SERVER],
      conversation_starters: CONVERSATION_STARTERS,
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
const agent = db.agents.findOne({ id: AGENT_ID });
print(`[seed] agent ${AGENT_ID} upserted (_id=${agent._id}, tools=${JSON.stringify(agent.tools)})`);

// --- 2. PUBLIC VIEW grant → visible to every signed-in founder ---------------
db.aclentries.updateOne(
  { principalType: 'public', resourceType: 'agent', resourceId: agent._id },
  {
    $set: {
      permBits: viewerRole.permBits,
      roleId: viewerRole._id,
      grantedBy: author._id,
      grantedAt: new Date(),
    },
  },
  { upsert: true },
);
print('[seed] public VIEW grant upserted (globally visible)');

// --- 3. OWNER grant to the author so they can edit it in the UI (optional) ---
if (ownerRole) {
  db.aclentries.updateOne(
    { principalType: 'user', principalId: author._id, resourceType: 'agent', resourceId: agent._id },
    {
      $set: {
        principalModel: 'User',
        permBits: ownerRole.permBits,
        roleId: ownerRole._id,
        grantedBy: author._id,
        grantedAt: new Date(),
      },
    },
    { upsert: true },
  );
  print('[seed] owner grant upserted for author');
}

print('[seed] done. Add the foundry-composer modelSpec to librechat.yaml and restart api.');
