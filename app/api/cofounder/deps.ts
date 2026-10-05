import 'server-only';
import { loadVentures } from '@/lib/ventures';
import { withVenture } from '@/lib/db';
import { GitHubClient } from '@/lib/github';
import { loadVentureTickets, applyStatusInference, STATUS_GROUPS } from '@/lib/tickets';
import { loadVentureAttention } from '@/lib/attention';
import { ventureRuns } from '@/lib/venture-reads';
import { appendToThread } from '@/app/actions/threads';
import { toolActor } from '@/lib/venture-access';
import { fullRepoName } from '@/lib/venture-repos';
import { STATE_REF } from '@/lib/runreports';
import { MEMORY_PATH, type CofounderDeps } from '@/lib/cofounder-service';
import type { TicketSeen } from '@/lib/cofounder';
import type { Querier } from '@/lib/machine-store';
import type { VentureSummary } from '@/lib/ventures';

/**
 * The real things the cofounder's wake needs (FB-201): the manifests, the studio's database, and git.
 *
 * Everything it proposes goes through a function the studio already had. A note on a ticket is
 * `appendToThread` — the same function the ticket screen and the studio's tools (FB-200) call — with
 * the same access check inside it. So a note from the cofounder lands exactly where a founder's own
 * note lands, and there is no second way to write one that could drift from the first.
 */

/** Where a venture's memory file lives: its first repository, on the state branch. */
const memoryRepo = (v: VentureSummary): string | null => (v.repos[0] ? fullRepoName(v.repos[0]) : null);

async function readTickets(venture: VentureSummary): Promise<TicketSeen[] | null> {
  const [data, attention] = await Promise.all([loadVentureTickets(venture, { refresh: true }), loadVentureAttention(venture)]);
  // A repository it could not read is not a repository with nothing stuck in it. If none could be
  // read, it says so rather than reporting a quiet venture.
  if (data.lanes.length > 0 && data.lanes.every((l) => l.error)) return null;
  const out: TicketSeen[] = [];
  for (const lane of data.lanes) {
    // The same correction the desk makes: a ticket whose pull request is open is waiting on the
    // founder, not stuck with the team.
    const inferred = applyStatusInference(lane, attention.ticketStatus);
    for (const group of STATUS_GROUPS) {
      for (const item of inferred.groups[group]) {
        out.push({ repo: lane.repo, id: item.ticket.id, title: item.ticket.title, group, body: item.ticket.body_md });
      }
    }
  }
  return out;
}

export function cofounderDeps(): CofounderDeps {
  const env = process.env;
  return {
    env,
    ventures: loadVentures(),
    withVenture: <T>(id: string, fn: (q: Querier) => Promise<T>) => withVenture(id, (c) => fn(c as unknown as Querier)),
    readMemory: async (venture) => {
      const repo = memoryRepo(venture);
      if (!repo) return { text: null };
      const file = await new GitHubClient().getFileWithSha(repo, MEMORY_PATH, STATE_REF);
      return file ? { text: file.text, sha: file.sha } : { text: null };
    },
    writeMemory: async (venture, text, sha, message) => {
      const repo = memoryRepo(venture);
      const token = env.STUDIO_APPROVAL_GITHUB_TOKEN;
      if (!repo) throw new Error(`${venture.name} has no repository to keep the cofounder's memory in`);
      if (!token) throw new Error('the studio has no write credential, so the cofounder cannot save what it remembers');
      await new GitHubClient({ token }).putFile(repo, MEMORY_PATH, { content: text, message, branch: STATE_REF, sha });
    },
    readTickets,
    readRuns: async (venture) => {
      const runs = await ventureRuns(venture);
      return runs.reports.map((r) => ({ startedAt: r.startedAt, outcome: r.outcome, ticketsTouched: r.ticketsTouched }));
    },
    noteOnTicket: async (venture, repo, ticketId, text) => {
      const done = await appendToThread(venture.id, repo, ticketId, 'composer', text, toolActor(venture.id));
      return { ok: done.ok, message: done.message };
    },
    log: (line) => console.log(`[cofounder] ${line}`),
  };
}
