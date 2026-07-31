#!/usr/bin/env node
// founding-plan.mjs (FB-056) — the bash↔JS edge of the founding run.
//
//   founding-plan.mjs check   <session.txt>
//       exit 0 if the session produced a usable founding plan; else the problems on stderr, exit 1.
//
//   founding-plan.mjs render  <session.txt> <venture-id> <venture-name> <out-dir> [start-at]
//       write the plan's files under <out-dir>; print one repo-relative path per line.
//
//   founding-plan.mjs pr-body <session.txt> <venture-id> <venture-name> <mission.txt>
//       the founder-facing PR body on stdout.
//
// Exit codes are the contract the shell reads: 0 ok, 1 unusable plan, 2 usage error. `render` is
// deliberately separate from `check` so the runner validates BEFORE it creates a branch — a
// half-written founding run in a founder's repo is worse than one that never started.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseFoundingPlan, renderFoundingFiles, renderPrBody } from './founding-lib.mjs';

function usage(msg) {
  console.error(`[founding] ${msg}`);
  console.error('usage: founding-plan.mjs check|render|pr-body <session.txt> …');
  process.exit(2);
}

function loadPlan(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    usage(`cannot read the session output: ${path}`);
  }
  const { plan, problems } = parseFoundingPlan(text);
  if (!plan) {
    console.error('[founding] the session did not produce a usable founding plan:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  return plan;
}

function main() {
  const [cmd, session, ...rest] = process.argv.slice(2);
  if (!cmd || !session) usage('need a command and the session output file');

  if (cmd === 'check') {
    const plan = loadPlan(session);
    console.log(`${plan.tickets.length} starter tickets, ${plan.goals.length} goals`);
    return 0;
  }

  if (cmd === 'render') {
    const [ventureId, ventureName, outDir, startAt] = rest;
    if (!ventureId || !ventureName || !outDir) usage('render needs <venture-id> <venture-name> <out-dir>');
    const plan = loadPlan(session);
    let files;
    try {
      files = renderFoundingFiles({
        plan,
        ventureId,
        ventureName,
        startAt: Number(startAt) > 0 ? Number(startAt) : 1,
      });
    } catch (err) {
      console.error(`[founding] ${err.message}`);
      return 1;
    }
    for (const file of files) {
      const full = join(outDir, file.path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, file.content);
      console.log(file.path);
    }
    return 0;
  }

  if (cmd === 'pr-body') {
    const [ventureId, ventureName, missionPath] = rest;
    if (!ventureId || !ventureName) usage('pr-body needs <venture-id> <venture-name>');
    const plan = loadPlan(session);
    let mission = '';
    if (missionPath) {
      try {
        mission = readFileSync(missionPath, 'utf8');
      } catch {
        // A missing mission file weakens the PR body but must not lose a good plan — the founder
        // still gets the north-star, the goals and the backlog.
        console.error(`[founding] note: could not read the mission at ${missionPath}`);
      }
    }
    const files = renderFoundingFiles({ plan, ventureId, ventureName });
    console.log(renderPrBody({ plan, ventureName, mission, files }));
    return 0;
  }

  usage(`unknown command "${cmd}"`);
}

process.exit(main());
