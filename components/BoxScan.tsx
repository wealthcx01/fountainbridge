import { howLongMs } from '@/lib/when';
import { findingLine, scanSentence, scanTone, type ScanState } from '@/lib/box-scan';

/**
 * The credential scan on each venture's machine (FB-206), as the admin ledger shows it.
 *
 * One line per venture, in the ledger's own order. A credential found is listed by file and kind,
 * never by value — the record does not hold the value, and this would not show it if it did.
 *
 * Admin-only by where it is mounted: `app/page.tsx` renders it after the founder redirects, so a
 * founder's request never reaches the read.
 */

const TONE_WORD: Record<ReturnType<typeof scanTone>, string> = {
  ok: 'clean',
  attention: 'check',
  blocked: 'credential found',
  idle: 'not known',
};

export interface BoxScanRow {
  ventureId: string;
  name: string;
  state: ScanState;
}

export function BoxScan({ rows }: { rows: BoxScanRow[] }) {
  const ago = (ms: number) => howLongMs(ms) ?? 'some time';
  return (
    <ul className="box-scan" data-testid="ledger-box-scan-list">
      {rows.map(({ ventureId, name, state }) => {
        const tone = scanTone(state);
        return (
          <li key={ventureId} data-testid={`box-scan-${ventureId}`} data-state={state.kind}
              data-stale={'stale' in state && state.stale ? 'true' : undefined}>
            <span aria-hidden="true" className={`mark mark-${tone}`} />
            <strong>{name}</strong>
            <span className="sr-only"> — {TONE_WORD[tone]}.</span>{' '}
            <span className="muted">{scanSentence(state, ago)}</span>
            {state.kind === 'found' && (
              <ul className="box-scan-findings" data-testid={`box-scan-findings-${ventureId}`}>
                {state.findings.map((f) => (
                  <li key={`${f.path}:${f.line}`}><code>{findingLine(f)}</code></li>
                ))}
                {state.count > state.findings.length && (
                  <li className="muted">
                    and {state.count - state.findings.length} more. Run the scan on the machine for the full list.
                  </li>
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
