/**
 * Tickets a founder has filed but nobody has merged yet (FB-120).
 *
 * ## The gap this closes
 *
 * `loadVentureTickets` reads `docs/tickets` at the head of the venture repo's **default branch**. A
 * ticket the composer files lives on its own `foundry/<slug>` branch and reaches the default branch
 * only when its pull request merges. So between "the founder said yes" and "someone merged the PR",
 * the ticket they approved exists, is readable, and is nowhere the studio looks.
 *
 * It was worse than absent. The pull request still reached the attention queue, matched no card, and
 * fell through to `unmatchedWork` — which renders a PR number and the PR's title. A founder who had
 * just read the scope and the acceptance criteria in plain English and said yes could see
 * `#58 Research: which auction houses…` and nothing else. The thing they consented to was reachable
 * only by opening GitHub and reading a diff, which is the one thing the studio exists to spare them.
 *
 * ## Why `filed` is not a status the ticket declares
 *
 * Every filed ticket's markdown says `**Status:** Todo`, correctly — that is what it will be once it
 * lands. `filed` is a fact about WHERE the file is, which only the studio can see, so it is a board
 * grouping and never written into the contract `Ticket.status` (CLAUDE.md #7: schema changes happen
 * in bcap-contracts, not here).
 *
 * ## Cost
 *
 * One conditional file read per open ticket branch, on a page load that already lists those pull
 * requests. Bounded by the number of tickets a founder is waiting on, and it does not repeat on a
 * timer — the rule FB-083 settled.
 */

import { parseTicket, looksLikeTicket, type Ticket, type ParseWarning } from '../tools/ticket-parser/src/index';
import type { RawPr } from './attention';
import type { TicketWithMeta } from './tickets';
import { GitHubClient } from './github';

/** A ticket on an unmerged branch, and the pull request carrying it. */
export interface FiledTicket extends TicketWithMeta {
  prNumber: number;
  prUrl: string;
  branch: string;
}

/** Where a filed ticket's content is read from. Injectable so the shaping logic tests without network. */
export type BranchFileReader = (repo: string, path: string, ref: string) => Promise<string | null>;

/**
 * The ticket file a composer pull request adds, if it adds exactly one.
 *
 * A PR touching several ticket files is not a filing — it is a renumber, a bulk edit, or a lane
 * writing something else — and guessing which of them is "the" ticket would put a card on a founder's
 * board that nobody chose. One file or nothing.
 */
export function filedTicketPath(files: readonly string[]): string | null {
  if (files.length === 0) return null;
  // EVERY changed file has to be in the ticket queue. Without this, a lane branch that fixes code and
  // touches its own ticket file reads as a filing, and a founder gets a "just filed" card for work
  // that is half-built. A filing writes one ticket and nothing else.
  if (!files.every((f) => /^docs\/tickets\/[^/]+\.md$/i.test(f))) return null;
  const tickets = files.filter((f) => !/\/README\.md$/i.test(f));
  // Exactly one, or we are looking at a renumber or a bulk edit — and guessing which of them is
  // "the" ticket would put a card on a founder's board that nobody chose.
  return tickets.length === 1 ? tickets[0] : null;
}

/**
 * Which open pull requests are a founder filing a ticket.
 *
 * Branch-shaped rather than author-shaped: `foundry/` is the prefix the filing tool creates and the
 * lane's own work branches share it, so the single-ticket-file test above is what actually separates
 * them. A lane branch changes code and its ticket at most incidentally; a filing changes one file.
 */
export function filingPrs(prs: readonly RawPr[]): Array<{ pr: RawPr; path: string }> {
  const out: Array<{ pr: RawPr; path: string }> = [];
  for (const pr of prs) {
    if (pr.state !== 'open' || pr.merged) continue;
    if (!pr.branch.startsWith('foundry/')) continue;
    const path = filedTicketPath(pr.files ?? []);
    if (path) out.push({ pr, path });
  }
  return out;
}

/**
 * Read and parse the tickets those pull requests are filing.
 *
 * A file that cannot be read, or does not parse as a ticket, is left out rather than rendered as an
 * empty card. The pull request is still in the attention queue either way, so nothing disappears —
 * it just does not gain a card it cannot fill.
 */
export async function loadFiledTickets(
  repo: string,
  prs: readonly RawPr[],
  read: BranchFileReader,
): Promise<FiledTicket[]> {
  const filings = filingPrs(prs);
  const results = await Promise.all(
    filings.map(async ({ pr, path }) => {
      let content: string | null = null;
      try {
        content = await read(repo, path, pr.branch);
      } catch {
        return null;
      }
      if (!content) return null;
      const parsed = parseTicket(content, { repo, path });
      if (!looksLikeTicket(parsed)) return null;
      return {
        ticket: parsed.ticket,
        warnings: parsed.warnings,
        prNumber: pr.number,
        prUrl: pr.url,
        branch: pr.branch,
      } satisfies FiledTicket;
    }),
  );
  const filed = results.filter((r): r is FiledTicket => r !== null);
  filed.sort((a, b) => a.ticket.id.localeCompare(b.ticket.id, undefined, { numeric: true }));
  return filed;
}

/**
 * Drop filings whose ticket is already on the board.
 *
 * The window that needs this: a pull request merges, the default branch now carries the ticket, and
 * the pull-request listing is a cache older than that. For a moment both sources have it, and a
 * founder would see the same piece of work twice, in two different columns. The merged copy is the
 * truer one, so the filing yields.
 */
export function withoutAlreadyOnBoard(
  filed: readonly FiledTicket[],
  idsOnBoard: ReadonlySet<string>,
): FiledTicket[] {
  return filed.filter((f) => !idsOnBoard.has(f.ticket.id));
}

/** Live reader: one conditional GET per filed ticket, at the branch the pull request is on. */
export function githubBranchFileReader(client: GitHubClient, org: string): BranchFileReader {
  return async (repo, path, ref) => {
    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    return client.getFileContent(fullName, path, ref);
  };
}

/** The ids a lane already shows, for `withoutAlreadyOnBoard`. */
export function ticketIdsOnBoard(groups: Record<string, TicketWithMeta[]>): Set<string> {
  const ids = new Set<string>();
  for (const items of Object.values(groups)) for (const i of items) ids.add(i.ticket.id);
  return ids;
}

export type { Ticket, ParseWarning };

/**
 * Every lane's filed tickets, deduplicated against what the lane already shows.
 *
 * Deliberately runs AFTER `applyStatusInference`. A filed ticket's own pull request is open, so
 * inference would move it straight to `pr-open` — "needs your OK" on work nobody has started, which
 * is the wrong sentence and loses the distinction this whole ticket exists to draw.
 */
export async function loadFiledForLanes(
  lanes: ReadonlyArray<{ repo: string; groups: Record<string, TicketWithMeta[]> }>,
  perRepo: ReadonlyArray<{ repo: string; result: { prs: readonly RawPr[] } }>,
  read: BranchFileReader,
): Promise<Map<string, FiledTicket[]>> {
  const byRepo = new Map<string, FiledTicket[]>();
  await Promise.all(
    lanes.map(async (lane) => {
      const prs = perRepo.find((p) => p.repo === lane.repo)?.result.prs ?? [];
      const filed = await loadFiledTickets(lane.repo, prs, read);
      const fresh = withoutAlreadyOnBoard(filed, ticketIdsOnBoard(lane.groups));
      if (fresh.length) byRepo.set(lane.repo, fresh);
    }),
  );
  return byRepo;
}

/** The default reader: fixtures when the UI gate is driving, live GitHub otherwise. */
export function defaultBranchFileReader(): BranchFileReader {
  const dir = process.env.FILED_TICKETS_FIXTURE_DIR;
  if (dir && process.env.E2E_TEST_LOGIN === '1') {
    // Same switch that already turns the studio into a test rig elsewhere, for the same reason: one
    // well-known flag, not several, and a stray env var alone must not swap real data for files.
    return async (_repo, path, ref) => {
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      try {
        return readFileSync(join(dir, ref.replace(/\//g, '_'), path.replace(/\//g, '_')), 'utf8');
      } catch {
        return null;
      }
    };
  }
  return githubBranchFileReader(new GitHubClient(), process.env.GITHUB_ORG ?? 'wealthcx01');
}
