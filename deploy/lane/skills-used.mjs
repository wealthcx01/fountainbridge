#!/usr/bin/env node
/**
 * Print the skills one ticket's worker used, space separated, for `write_runreport` (FB-231).
 *
 *     node skills-used.mjs <ticket-slug>
 *
 * The thinking is in `skills-lib.mjs`; this is the I/O half, so the part that can be wrong is the
 * part that has tests.
 *
 * **Prints nothing and exits 0 when it cannot tell.** A missing session index, an unreadable
 * transcript, a ticket with no sessions — all of them mean "no skills recorded", which is what an
 * empty list in the run report means. The alternative is a wake that loses its work because a log
 * file was not where it expected, and that trade is never worth making (CLAUDE.md #10 is about
 * telling the founder the truth, and the truth here is recoverable on the next wake).
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { skillsForTicket } from './skills-lib.mjs';

const ticket = process.argv[2] || '';
const STATE_DIR = process.env.STATE_DIR || '/opt/foundry/lane/state';
const SESSION_INDEX = process.env.SESSION_INDEX || join(STATE_DIR, 'sessions.jsonl');

/**
 * Where Claude keeps a session's transcript.
 *
 * The directory is the working directory with every non-alphanumeric character replaced by a dash —
 * `/opt/foundry/lane/arca` becomes `-opt-foundry-lane-arca`. Overridable because the lane's worktree
 * is not always where this runs from, and because a test needs to point it somewhere real.
 */
const projectDir = () =>
  process.env.CLAUDE_PROJECT_DIR
  || join(homedir(), '.claude', 'projects', process.cwd().replace(/[^a-zA-Z0-9]/g, '-'));

const read = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const indexText = read(SESSION_INDEX) ?? '';
const skills = skillsForTicket({
  indexText,
  ticket,
  readTranscript: (session) => read(join(projectDir(), `${session}.jsonl`)),
});

if (skills.length) process.stdout.write(skills.join(' '));
