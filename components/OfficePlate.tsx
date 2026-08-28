import { TEAM_INTRO, TEAM_TITLE } from '@/lib/glossary';

/**
 * The office (FB-128) — a placeholder that admits what it is.
 *
 * In the design this is the live plate: one character per agent on the venture's machine, a raised
 * hand where something waits on the founder, beside the ledger of what each is doing right now. It
 * is the product's feeling, and it is the half of the desk that is not built — the venture box does
 * not report agent state yet. **FB-139** is that work.
 *
 * So it is drawn as a placeholder rather than as an empty office, and it says which. A frozen
 * last-known scene would be worse than nothing: a founder would read stillness as their team being
 * idle, when the truth is that nobody is reporting. Same wording as the rail's, which is the point —
 * two surfaces saying one thing two ways is how a fact starts to look like two facts.
 */
export function OfficePlate() {
  return (
    <section data-testid="office-plate" style={{ marginBottom: '1.5rem' }}>
      <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
        <span className="eyebrow-id">The office</span> — {TEAM_TITLE}
      </p>
      <div
        data-testid="office-placeholder"
        style={{
          padding: '1rem',
          border: '1px dashed var(--color-border-strong)',
          background: 'var(--color-paper-sunken)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-ink-muted)',
          maxWidth: 'var(--content-narrow)',
        }}
      >
        Not live yet. Your team’s desks appear here once this venture’s machine reports what they are
        doing. {TEAM_INTRO}
      </div>
    </section>
  );
}
