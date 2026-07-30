/**
 * Bridging FB-044's file-shaped approvals into the FB-051 event log.
 *
 * FB-044 stored an approval as up to three files — `proposal.json`, `grant.json`, `execution.json` —
 * and inferred status from which of them existed. Ventures already have approvals in that shape, and
 * the deployed executor still writes it, so the ticket's "retired **or bridged**" resolves to
 * bridged: derive the equivalent events, and let the whole studio operate on one model.
 *
 * What the bridge can and cannot recover is worth being precise about, because it decides how much a
 * bridged record can be trusted:
 *
 *   - Order and causation are RECONSTRUCTED, not recorded. The v0 files carry no sequence, so the
 *     chain here is the only order those three files could have happened in — true, but inferred.
 *   - Timestamps may be missing. v0 did not require them.
 *   - The granting actor comes from `grant.json.approver`, which FB-044's HMAC attestation binds, so
 *     it is as trustworthy as that attestation — the one part of v0 that was cryptographically real.
 *
 * So a bridged approval is marked `bridged: true`. It is a faithful reading of what v0 recorded; it
 * is not the same evidence as a natively event-sourced approval, and the studio should not imply it
 * is. New approvals should be written as events.
 */

import type { ApprovalEvent, Actor, ComplianceRecord } from './activegraph';

export interface LegacyFiles {
  proposal: unknown;
  grant: unknown;
  execution: unknown;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The timestamp v0 recorded, if any. Undated events are honest about it rather than inventing "now". */
function at(source: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = str(source[k]);
    if (v) return v;
  }
  return '';
}

/**
 * v0 wrote an approver as a bare string. Everyone who could grant in v0 was a human — the executor
 * refused anything else — so `founder` is the right reading, not a guess that could mask a machine
 * grant. A machine could not have produced a valid attestation.
 */
function approverActor(grant: Record<string, unknown>): Actor {
  const id = str(grant.approver) ?? str(grant.granted_by) ?? 'unknown';
  return { kind: 'founder', id };
}

/** Lift a v0 `compliance` blob, keeping only what §5 actually specifies. */
function complianceOf(proposal: Record<string, unknown>): ComplianceRecord | undefined {
  const c = obj(proposal.compliance);
  if (!Object.keys(c).length) return undefined;
  const basis = obj(c.lawful_basis ?? c.lawfulBasis);
  const suppression = obj(c.suppression_check ?? c.suppressionCheck);
  const identity = obj(c.sending_identity ?? c.sendingIdentity);
  return {
    recipient: str(c.recipient) ?? '',
    pecrClass: (str(c.pecr_class ?? c.pecrClass) as ComplianceRecord['pecrClass']) ?? 'individual',
    lawfulBasis: {
      kind: (str(basis.kind) as ComplianceRecord['lawfulBasis']['kind']) ?? 'consent',
      ref: str(basis.ref) ?? '',
    },
    suppressionCheck: {
      checked: suppression.checked === true,
      suppressed: suppression.suppressed === true,
      listRef: str(suppression.list_ref ?? suppression.listRef),
    },
    draftSha: str(c.draft_sha ?? c.draftSha) ?? '',
    channel: str(c.channel) ?? '',
    sendingIdentity: { address: str(identity.address) ?? '', scope: str(identity.scope) ?? '' },
  };
}

/**
 * Derive the event chain a v0 approval implies. Returns [] when there is no proposal — an approval is
 * defined by having been proposed, and a stray grant with nothing to grant is not an approval.
 */
export function eventsFromLegacy(files: LegacyFiles): ApprovalEvent[] {
  if (!files.proposal || typeof files.proposal !== 'object') return [];
  const proposal = obj(files.proposal);
  const grant = obj(files.grant);
  const execution = obj(files.execution);

  const events: ApprovalEvent[] = [];
  const push = (event: Omit<ApprovalEvent, 'seq' | 'causedBy'>) => {
    const head = events[events.length - 1];
    events.push({ ...event, seq: events.length + 1, causedBy: head ? head.seq : null });
  };

  const amount = proposal.amount_minor;
  push({
    type: 'approval.proposed',
    at: at(proposal, 'proposed_at', 'at', 'created_at'),
    // v0 proposals were written by a lane. Attributing them to a human would be the one lie that
    // matters here — it would make an ungranted action look approved.
    actor: { kind: 'lane', id: str(proposal.proposed_by) ?? 'lane' },
    summary: str(proposal.summary),
    department: str(proposal.department),
    ticket: str(proposal.ticket),
    amountMinor: typeof amount === 'number' && Number.isInteger(amount) && amount >= 0 ? amount : 0,
    currency: str(proposal.currency),
    compliance: complianceOf(proposal),
    data: { bridged: true },
  });

  if (files.grant && typeof files.grant === 'object') {
    push({
      type: 'approval.granted',
      at: at(grant, 'granted_at', 'at'),
      actor: approverActor(grant),
      data: { bridged: true, attestation: str(grant.attestation) ?? null },
    });
  }

  if (files.execution && typeof files.execution === 'object') {
    const status = str(execution.status);
    const type =
      status === 'executed'
        ? 'approval.executed'
        : status === 'executing'
          ? 'approval.executing'
          : status === 'rejected'
            ? 'approval.rejected'
            : 'approval.failed';
    const result = obj(execution.result);
    push({
      type,
      at: at(execution, 'executed_at', 'at'),
      actor: { kind: 'executor', id: str(execution.executor) ?? 'executor' },
      data: {
        bridged: true,
        reason: str(execution.reason) ?? str(result.note) ?? undefined,
      },
    });
  }

  return events;
}

/** True when every event in a log came from the bridge rather than from a real append. */
export function isBridged(events: ApprovalEvent[]): boolean {
  return events.length > 0 && events.every((e) => (e.data as { bridged?: boolean } | undefined)?.bridged === true);
}
