/**
 * The Sell pipeline, as the studio reads it (FB-234).
 *
 * The record lives in the studio's own Postgres (`db/005_crm.sql`), not in git — John's ruling of
 * 2026-10-01, written up in FB-234: a person can ask to be forgotten, and a database can forget where
 * git cannot. This file is the shape of what is read and the plain-English words for it. It holds no
 * connection and sends nothing; `crm-load.ts` does the reading.
 *
 * ## These types wait on bcap-contracts
 *
 * Non-negotiable 7 says every rendered entity is a bcap-contracts type. Contact, Company, Deal and
 * Activity are not in bcap-contracts yet, and adding them is that repository's change, not this one's.
 * Until they arrive, these mirror the columns of `db/005_crm.sql` exactly and nothing else, so that
 * swapping them for the generated types is a rename rather than a redesign. FB-235 records this as
 * the part left to do.
 */

/** The stages a deal moves through, in order. `won` and `lost` are where a deal finishes. */
export const STAGES = ['added', 'contacted', 'meeting', 'proposal', 'follow_up', 'won', 'lost'] as const;
export type Stage = (typeof STAGES)[number];

/** The stages a deal is still moving through. */
export const OPEN_STAGES: readonly Stage[] = ['added', 'contacted', 'meeting', 'proposal', 'follow_up'];

/** What a founder reads for each stage. Our own words. */
export const STAGE_LABEL: Record<Stage, string> = {
  added: 'Added',
  contacted: 'Contacted',
  meeting: 'Meeting',
  proposal: 'Proposal sent',
  follow_up: 'Following up',
  won: 'Won',
  lost: 'Lost',
};

export type Temperature = 'cold' | 'warm' | 'hot';
export type ActivityKind = 'email_in' | 'email_out' | 'call' | 'meeting' | 'note';

export interface CrmContact {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  company: string | null;
  temperature: Temperature;
  /** ISO time, or null when not snoozed. */
  snoozedUntil: string | null;
  /** The latest thing that happened with them, or null when nothing has been recorded yet. */
  last: { kind: ActivityKind; summary: string; at: string } | null;
  /** Messages from them that nobody has answered yet. */
  awaitingReply: number;
}

export interface CrmDeal {
  id: string;
  title: string;
  contactId: string | null;
  company: string | null;
  stage: Stage;
  valueMinor: number | null;
  currency: string | null;
  probability: number | null;
  nextStep: string | null;
  /** `YYYY-MM-DD`, or null. */
  nextStepDue: string | null;
  stageChangedAt: string;
}

/**
 * One venture's pipeline, or the reason there is not one to show.
 *
 * Three different answers, and the screen says each one differently (CLAUDE.md #10):
 *   - `ok` — read. It may be empty, and empty is a true statement.
 *   - `not-connected` — this studio has no database configured, so there is no pipeline to read.
 *   - `unreadable` — there is a database and the read failed. Not the same as empty.
 */
export type PipelineRead =
  | {
      state: 'ok';
      contacts: CrmContact[];
      deals: CrmDeal[];
      /** True totals, so a capped read can say it was capped rather than look complete. */
      totals: { contacts: number; deals: number };
    }
  | { state: 'not-connected' }
  | { state: 'unreadable'; reason: string };

/** The most rows one read returns. The totals say when there were more. */
export const PIPELINE_READ_CAP = 1000;

/** Minor units to something a founder reads. The currency code is printed, never guessed. */
export function formatDealValue(valueMinor: number | null, currency: string | null): string | null {
  if (valueMinor === null || currency === null) return null;
  const major = valueMinor / 100;
  const whole = Number.isInteger(major) ? major.toLocaleString('en-GB') : major.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${whole} ${currency}`;
}

/**
 * The pipeline as plain text, for the Sell lane and for Claude (the `sell_pipeline` tool).
 *
 * Says what it can see, what it could not, and that nothing here sends. One person per line, so a
 * model can quote it back without inventing structure.
 */
export function describePipeline(ventureName: string, read: PipelineRead): string {
  if (read.state === 'not-connected') {
    return `${ventureName} has no pipeline yet: this studio has no database to keep one in. `
      + 'That means nothing has been recorded, not that nobody is being talked to.';
  }
  if (read.state === 'unreadable') {
    return `${ventureName}'s pipeline could not be read just now (${read.reason}). `
      + 'That is not the same as it being empty. Try again, and do not tell the founder it is empty.';
  }
  if (!read.contacts.length && !read.deals.length) {
    return `${ventureName}'s pipeline is empty. Nobody has been added yet.`;
  }

  const byId = new Map(read.contacts.map((c) => [c.id, c]));
  const lines: string[] = [`${ventureName}'s pipeline:`];
  for (const stage of STAGES) {
    const deals = read.deals.filter((d) => d.stage === stage);
    if (!deals.length) continue;
    lines.push('', `${STAGE_LABEL[stage]} (${deals.length}):`);
    for (const d of deals) {
      const who = d.contactId ? byId.get(d.contactId)?.name ?? null : null;
      const value = formatDealValue(d.valueMinor, d.currency);
      const parts = [
        `- ${d.title}`,
        who ? `with ${who}` : null,
        d.company ? `at ${d.company}` : null,
        value ? `worth ${value}` : null,
        d.nextStep ? `next: ${d.nextStep}${d.nextStepDue ? ` by ${d.nextStepDue}` : ''}` : null,
      ].filter(Boolean);
      lines.push(parts.join(', '));
    }
  }

  const waiting = read.contacts.filter((c) => c.awaitingReply > 0);
  if (waiting.length) {
    lines.push('', 'Waiting for a reply from the founder:');
    for (const c of waiting) {
      lines.push(`- ${c.name}${c.last ? `: ${c.last.summary}` : ''}`);
    }
  }

  if (read.totals.contacts > read.contacts.length || read.totals.deals > read.deals.length) {
    lines.push('', `This shows the first ${PIPELINE_READ_CAP} of each. There are `
      + `${read.totals.contacts} people and ${read.totals.deals} deals in all.`);
  }
  lines.push('', 'This only reads the pipeline. Nothing here can contact anyone; every message waits '
    + 'for the founder to approve it on the studio’s own screen.');
  return lines.join('\n');
}
