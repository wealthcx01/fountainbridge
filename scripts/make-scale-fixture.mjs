#!/usr/bin/env node
/**
 * Build a fixture venture at ARCA's real size, so the desk's height can be measured against a
 * backlog rather than against six tickets (FB-178).
 *
 * ## Why this exists
 *
 * FB-178's last acceptance criterion asks for a height "measured against a venture with a real
 * backlog rather than a fixture with three tickets". The gate's ARCA fixture holds **6 tickets and
 * 6 run reports**. Production ARCA holds **73 tickets and 1,773 run reports**, and every fault this
 * ticket was raised for only appears at that size: the ticket board was 4,634px because there were
 * 73 tickets to draw, and the run panel was 2,621px because there were twenty rows of the same
 * sentence.
 *
 * Measuring a capped list against an uncapped fixture proves nothing. A cap of four over six items
 * and no cap at all over six items render the same screen.
 *
 * ## Why it generates rather than commits
 *
 * 1,773 run reports is 1,773 files. Committing them would put a fixture larger than the application
 * into the repository, and every future reader of `git log` would pay for it. They are generated
 * into `e2e/__scale__/`, which is gitignored, by `npm run test:e2e:scale`.
 *
 * ## What is deliberately NOT scaled
 *
 * Health, knowledge, routines and readings. Those are a venture's configuration and its corpus —
 * they do not grow with how much work a venture has done, which is the growth this ticket is about.
 * The spec leaves them pointed at the committed fixture, so the screen is otherwise the same one the
 * rest of the gate measures.
 *
 * Usage:  node scripts/make-scale-fixture.mjs [outDir]
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** ARCA's real numbers, read off production on 2026-09-02 and recorded in FB-178. */
const TICKETS = 73;
const RUN_REPORTS = 1_773;
/** Open pull requests. Production ARCA carried about twenty at once. */
const OPEN_WORK = 20;

const REPO = 'arca';
const OUT = process.argv[2] || 'e2e/__scale__';

/**
 * Statuses in the proportion production actually had: mostly done, which is the whole point. 37 of
 * ARCA's 73 were DONE, and a board that drew them was half the page.
 */
const STATUS_OF = (i) => {
  if (i % 100 < 50) return 'Done';
  if (i % 100 < 70) return 'In progress';
  if (i % 100 < 85) return 'To do';
  return 'Needs your OK';
};

/** Deliberately long enough to wrap. A one-word title measures a narrower row than a real one. */
const TITLE_OF = (i) => [
  'Card search across the whole set with fuzzy matching',
  'Price history for graded copies, back three years',
  'Deck export to the shop format collectors actually use',
  'Auction feed reconnects without dropping a listing',
  'Grade distribution chart on the valuation screen',
][i % 5] + ` (${i})`;

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** `<slug>-YYYYMMDDTHHMMSSZ.json` — the lane's name shape, which the loader sorts on. */
function stampFor(i) {
  const start = Date.parse('2026-06-01T00:00:00Z');
  const d = new Date(start + i * 37 * 60_000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  const dirs = {
    tickets: join(OUT, 'tickets', REPO),
    runreports: join(OUT, 'runreports', REPO),
    work: join(OUT, 'work', REPO),
    prs: join(OUT, 'prs'),
  };
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });

  for (let i = 1; i <= TICKETS; i++) {
    const title = TITLE_OF(i);
    await writeFile(join(dirs.tickets, `ARCA-${i}-generated.md`), [
      `# ARCA-${i} — ${title}`,
      '',
      `**Phase:** 1 · **Branch:** \`arca-${i}-generated\``,
      `**Status:** ${STATUS_OF(i)}`,
      '',
      '## Goal',
      `${title}. Generated at ARCA's real size by scripts/make-scale-fixture.mjs — see its header.`,
      '',
    ].join('\n'));
  }

  // A five-week history with BOTH things in it: distinct runs across the backlog, and clusters of
  // the identical park that made production unreadable — "Daily plan: team budget reached — parked
  // until tomorrow", written every five minutes for seven weeks.
  //
  // The mix is deliberate, and getting it wrong cost a round here. The first version of this
  // generator parked on one ticket nineteen times in twenty, which is closer to what ARCA's tail
  // actually looked like — and it made the fixture USELESS for the thing it was built to measure.
  // The desk reads the 20 newest reports and `collapseRepeats` merges consecutive identical ones, so
  // an all-parks history collapses to about three rows. Raising the run cap from four back to twenty
  // then changed the page height by almost nothing, and the ratchet stayed green over the exact
  // defect FB-178 was raised for.
  //
  // So: one park cluster of four in every twenty, the rest distinct. Both halves are now load-bearing
  // — the distinct runs are what a raised cap would draw, and the cluster is what proves the merge
  // still happens and still says how many times.
  // Counted from the NEWEST end, so the most recent thing the lane did is a park cluster. That is
  // both what ARCA was actually doing when FB-178 was written — "Stopped on ARCA-061 … parked until
  // tomorrow", re-parked every five minutes — and what puts the merged row where the desk can show
  // it, since the desk draws only the four newest rows. Counting from the oldest end put the cluster
  // ten reports back, off the bottom of the panel, and the repeat assertion failed over a fixture
  // that did contain repeats.
  const CLUSTER = 4;
  const inCluster = (i) => Math.floor((RUN_REPORTS - 1 - i) / CLUSTER) % 5 === 0;
  for (let i = 0; i < RUN_REPORTS; i++) {
    const parked = inCluster(i);
    const ticket = parked ? 'ARCA-61' : `ARCA-${(i % TICKETS) + 1}`;
    const started = new Date(Date.parse('2026-06-01T00:00:00Z') + i * 37 * 60_000).toISOString();
    await writeFile(join(dirs.runreports, `${ticket}-${stampFor(i)}.json`), JSON.stringify({
      ticket,
      lane: REPO,
      status: parked ? 'blocked' : 'progress',
      summary: parked
        ? 'Daily plan: team budget reached — parked until tomorrow.'
        : `Worked ${ticket} — ${TITLE_OF(i)} — and opened a branch.`,
      started,
      finished: started,
      repo: `wealthcx01/${REPO}`,
    }, null, 2));
  }

  // The heartbeat, dated against the pinned E2E_NOW so the engine reads as running rather than as
  // stalled-for-months. Same reasoning as the committed fixture's.
  await writeFile(join(dirs.runreports, '_heartbeat.json'), JSON.stringify({
    ticket: 'heartbeat', lane: REPO, status: 'idle',
    summary: 'Lane awake — nothing to work right now.',
    started: '2026-07-21T23:50:00Z', finished: '2026-07-21T23:50:00Z',
    repo: `wealthcx01/${REPO}`,
  }, null, 2));

  const prs = [];
  for (let n = 0; n < OPEN_WORK; n++) {
    const number = 100 + n;
    const title = `ARCA-${n + 1}: ${TITLE_OF(n + 1)}`;
    const createdAt = new Date(Date.parse('2026-07-01T00:00:00Z') + n * 6 * 3_600_000).toISOString();
    prs.push({
      number, title, url: `https://github.com/wealthcx01/${REPO}/pull/${number}`,
      author: 'wealthcx01', createdAt, branch: `arca-${n + 1}-generated`,
      state: 'open', merged: false, ciStatus: n % 3 === 0 ? 'pending' : 'success',
    });
    await writeFile(join(dirs.work, `${number}.json`), JSON.stringify({
      title, author: 'foundry-lane', createdAt, headSha: `sha-arca-${number}`,
      state: 'open', merged: false, mergeable: true,
      checks: n % 3 === 0 ? 'pending' : 'success',
      files: [{ path: `src/${n}.ts`, added: 20 + n, removed: n }],
      body: `Worked by the Foundry lane. ${title}.`,
      url: `https://github.com/wealthcx01/${REPO}/pull/${number}`,
    }, null, 2));
  }
  await writeFile(join(dirs.prs, `${REPO}.json`), JSON.stringify(prs, null, 2));

  process.stdout.write(
    `${OUT}: ${TICKETS} tickets, ${RUN_REPORTS} run reports, ${OPEN_WORK} open pull requests\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`make-scale-fixture: ${err.message}\n`);
  process.exit(1);
});
