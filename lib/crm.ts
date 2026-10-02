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
  /**
   * The newest of those unanswered messages, or null when none is waiting. Kept apart from `last`
   * on purpose: `last` can be the founder's own note or email, logged after their message came in,
   * and quoting that as "what they wrote" would put our words in their mouth.
   */
  waiting: { summary: string; at: string } | null;
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
      lines.push(`- ${c.name}${c.waiting ? `: ${c.waiting.summary}` : ''}`);
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

// ── FB-235: the founder's view of the pipeline ─────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Why a person is on the founder's list. The order here is the order of urgency. */
export type NextActionStatus = 'awaiting-reply' | 'overdue' | 'due' | 'not-contacted';

export const NEXT_ACTION_STATUS_LABEL: Record<NextActionStatus, string> = {
  'awaiting-reply': 'Waiting for your reply',
  overdue: 'Follow-up overdue',
  due: 'Follow-up due',
  'not-contacted': 'Not contacted yet',
};

/** What the founder can do about it, right there. It drafts; it does not send. */
export interface NextActionDraft {
  label: string;
  /** What the composer is asked to draft, in the founder's own voice. */
  ask: string;
}

export interface NextAction {
  contactId: string;
  name: string;
  company: string | null;
  temperature: Temperature;
  status: NextActionStatus;
  /** One sentence saying why this person is on the list. */
  reason: string;
  draft: NextActionDraft;
}

/** How many people the list shows. A short list is the point: it is who needs you NOW. */
export const NEXT_ACTIONS_SHOWN = 5;

const TEMPERATURE_RANK: Record<Temperature, number> = { hot: 0, warm: 1, cold: 2 };
const STATUS_RANK: Record<NextActionStatus, number> = { 'awaiting-reply': 0, overdue: 1, due: 2, 'not-contacted': 3 };

/** `YYYY-MM-DD` to the start of that day, UTC. */
const dayStart = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);
const todayStart = (nowMs: number): number => {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const daysWord = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
/** Calendar days, not elapsed hours: a message from 21:00 last night was "yesterday", not "today". */
const sinceWords = (iso: string, nowMs: number): string => {
  const days = Math.round((todayStart(nowMs) - todayStart(Date.parse(iso))) / DAY_MS);
  if (!Number.isFinite(days) || days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${daysWord(days)} ago`;
};

/** Every draft request ends the same way, so the composer never takes "draft" as "send". */
export const DRAFT_ONLY = 'Draft it for me to read first. Do not send anything.';

/** The composer cuts a seeded request at this many characters (`app/venture/[id]/composer`). */
export const COMPOSER_ASK_MAX = 500;

/**
 * A draft request that always ends with `DRAFT_ONLY`, however long the person's message was.
 *
 * The request is cut BEFORE the instruction is added, never after: the composer truncates at 500
 * characters, and a long message quoted in full would push "do not send anything" off the end.
 */
function draftAsk(body: string): string {
  const room = COMPOSER_ASK_MAX - DRAFT_ONLY.length - 1;
  const trimmed = body.length > room ? `${body.slice(0, room - 1)}…` : body;
  return `${trimmed} ${DRAFT_ONLY}`;
}

/**
 * Who needs the founder now, most urgent first (FB-235's "Next actions").
 *
 * One row per person, for the most urgent reason they have, so the same name never appears twice.
 * The ranking, in order:
 *   1. They wrote in and nobody has answered. Somebody is waiting on us, which costs the most.
 *   2. A follow-up is past its date.
 *   3. A follow-up is due today or tomorrow.
 *   4. A warm or hot person on an open deal has never been contacted.
 * Within each, hot before warm before cold, then the longest-waiting first.
 *
 * Left off on purpose: anyone snoozed until later, and anyone whose only deals are won or lost.
 */
export function nextActions(
  read: PipelineRead,
  nowMs: number,
): { shown: NextAction[]; more: number } {
  if (read.state !== 'ok') return { shown: [], more: 0 };

  const today = todayStart(nowMs);
  const candidates: Array<NextAction & { waitedMs: number }> = [];

  for (const c of read.contacts) {
    if (c.snoozedUntil && Date.parse(c.snoozedUntil) > nowMs) continue;
    const open = read.deals.filter((d) => d.contactId === c.id && OPEN_STAGES.includes(d.stage));
    const base = { contactId: c.id, name: c.name, company: c.company, temperature: c.temperature };

    if (c.awaitingReply > 0 && c.last) {
      const more = c.awaitingReply > 1 ? ` They have written ${c.awaitingReply} times without an answer.` : '';
      candidates.push({
        ...base,
        status: 'awaiting-reply',
        reason: `Wrote ${sinceWords(c.last.at, nowMs)}: “${c.last.summary}”.${more}`,
        draft: {
          label: 'Draft a reply with AI',
          ask: draftAsk(`Draft a reply to ${c.name}${c.company ? ` at ${c.company}` : ''}. They wrote: “${c.last.summary}”.`),
        },
        waitedMs: nowMs - Date.parse(c.last.at),
      });
      continue;
    }

    // The most pressing dated next step on any of their open deals.
    const dated = open
      .filter((d) => d.nextStepDue && Number.isFinite(dayStart(d.nextStepDue)))
      .sort((a, b) => dayStart(a.nextStepDue as string) - dayStart(b.nextStepDue as string))[0];
    if (dated) {
      const due = dayStart(dated.nextStepDue as string);
      const late = Math.round((today - due) / DAY_MS);
      if (due <= today + DAY_MS) {
        const step = dated.nextStep ?? 'The next step';
        const when = late > 0 ? `was due ${daysWord(late)} ago` : late === 0 ? 'is due today' : 'is due tomorrow';
        candidates.push({
          ...base,
          status: late > 0 ? 'overdue' : 'due',
          reason: `${step} on “${dated.title}” ${when}.`,
          draft: {
            label: 'Draft the follow-up with AI',
            ask: draftAsk(`Draft a follow-up to ${c.name} about “${dated.title}”. The next step is: ${step}.`),
          },
          waitedMs: today - due,
        });
        continue;
      }
    }

    if (!c.last && c.temperature !== 'cold' && open.length > 0) {
      const deal = open[0];
      candidates.push({
        ...base,
        status: 'not-contacted',
        reason: `On “${deal.title}” as ${c.temperature}, and nobody has written to them yet.`,
        draft: {
          label: 'Draft a first message with AI',
          ask: draftAsk(`Draft a first message to ${c.name}${c.company ? ` at ${c.company}` : ''} about “${deal.title}”.`),
        },
        waitedMs: nowMs - Date.parse(deal.stageChangedAt),
      });
    }
  }

  candidates.sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || TEMPERATURE_RANK[a.temperature] - TEMPERATURE_RANK[b.temperature]
    || (b.waitedMs || 0) - (a.waitedMs || 0)
    || a.name.localeCompare(b.name));

  const shown = candidates.slice(0, NEXT_ACTIONS_SHOWN).map(({ waitedMs: _waited, ...rest }) => rest);
  return { shown, more: Math.max(0, candidates.length - NEXT_ACTIONS_SHOWN) };
}

/**
 * The summary line's numbers, and only the ones that are true (FB-235, item 5).
 *
 * A total is printed only when it can be added up honestly: every open deal has a value, and they are
 * all in one currency. Otherwise the line says what is missing, instead of printing a partial sum
 * that looks like the whole. The same for the expected value, which also needs a chance of closing
 * on every open deal — a figure the founder never set is not one the studio will guess.
 */
export interface PipelineNumbers {
  people: number;
  open: number;
  won: number;
  lost: number;
  /** "4,500 GBP", or null with `openValueMissing` saying why. */
  openValue: string | null;
  openValueMissing: string | null;
  expected: string | null;
  expectedMissing: string | null;
}

export function pipelineNumbers(read: PipelineRead & { state: 'ok' }): PipelineNumbers {
  const open = read.deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const won = read.deals.filter((d) => d.stage === 'won').length;
  const lost = read.deals.filter((d) => d.stage === 'lost').length;
  const base = { people: read.totals.contacts, open: open.length, won, lost };

  if (!open.length) {
    return { ...base, openValue: null, openValueMissing: null, expected: null, expectedMissing: null };
  }

  const priced = open.filter((d) => d.valueMinor !== null && d.currency !== null);
  const currencies = new Set(priced.map((d) => d.currency));
  let openValue: string | null = null;
  let openValueMissing: string | null = null;
  if (priced.length < open.length) {
    const n = open.length - priced.length;
    openValueMissing = `${n} of ${open.length} open deals ${n === 1 ? 'has' : 'have'} no value yet, so there is no total.`;
  } else if (currencies.size > 1) {
    openValueMissing = `Open deals are in ${[...currencies].join(' and ')}, so they are not added together.`;
  } else {
    openValue = formatDealValue(priced.reduce((n, d) => n + (d.valueMinor as number), 0), priced[0].currency);
  }

  let expected: string | null = null;
  let expectedMissing: string | null = null;
  if (openValue) {
    const unscored = open.filter((d) => d.probability === null).length;
    if (unscored) {
      expectedMissing = `An expected value needs a chance of closing on every open deal; ${unscored} ${unscored === 1 ? 'has' : 'have'} none.`;
    } else {
      const sum = open.reduce((n, d) => n + Math.round(((d.valueMinor as number) * (d.probability as number)) / 100), 0);
      expected = formatDealValue(sum, open[0].currency);
    }
  }

  return { ...base, openValue, openValueMissing, expected, expectedMissing };
}

/** A person's temperature as one of the studio's five tones, so it takes the shared colours. */
export const TEMPERATURE_TONE = { hot: 'attention', warm: 'working', cold: 'idle' } as const;
