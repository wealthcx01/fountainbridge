import { describe, it, expect } from 'vitest';
import {
  GATE_DIMENSIONS,
  REQUIRED_SECTIONS,
  applyVerdicts,
  failureSummary,
  formatGateReport,
  gates,
  missingDimensions,
  sections,
  validate,
} from '../prp-lib.mjs';

const GOOD = `# PRP — arca-price-history

## Intent
Collectors can see what a card sold for over the last year.

## Context
The card page renders from \`src/card/page.tsx\`; pricing already comes from \`lib/pricing.ts\`.

## Approach
Add a chart component fed by the existing pricing service. Touches two files.

## Tasks
- [ ] Add PriceHistoryChart
- [ ] Render it on the card page

## Validation gates
- [ ] happy path: the card page shows a 12-month chart for a card with sales
- [ ] edge cases: a card with no sales renders an empty state, not a crash
- [ ] errors: a pricing-service failure shows a message, not a blank page
- [ ] coverage: unit tests cover the empty and error states
`;

describe('sections — a PRP splits into its parts', () => {
  it('keys sections by lowercased heading and drops the title', () => {
    const s = sections(GOOD);
    expect(Object.keys(s)).toEqual(['intent', 'context', 'approach', 'tasks', 'validation gates']);
    expect(s.intent).toContain('Collectors can see');
    expect(s.intent).not.toContain('# PRP');
  });

  it('is empty for a document with no headings', () => {
    expect(sections('just prose')).toEqual({});
    expect(sections('')).toEqual({});
    expect(sections(null)).toEqual({});
  });
});

describe('gates — the part that makes it a PRP', () => {
  it('extracts every checklist item with a stable id and its dimension', () => {
    const g = gates(GOOD);
    expect(g).toHaveLength(4);
    expect(g[0]).toMatchObject({ id: 'g1', dimension: 'happy path' });
    expect(g[3]).toMatchObject({ id: 'g4', dimension: 'coverage' });
    expect(g[1].text).toContain('empty state');
  });

  it('accepts an unlabelled gate but records no dimension', () => {
    const g = gates('## Validation gates\n- [ ] the thing works end to end\n');
    expect(g).toHaveLength(1);
    expect(g[0].dimension).toBeNull();
  });

  it('does not treat an arbitrary prefix as a dimension', () => {
    expect(gates('## Validation gates\n- [ ] note: something\n')[0].dimension).toBeNull();
  });

  it('ignores checklist items OUTSIDE the gates section', () => {
    // Tasks are also `- [ ]` items; counting them as gates would let a PRP with no gates pass.
    expect(gates(GOOD).every((g) => !g.text.startsWith('Add PriceHistoryChart'))).toBe(true);
    expect(gates('## Tasks\n- [ ] build it\n')).toEqual([]);
  });

  it('handles ticked boxes and bullet variants', () => {
    const g = gates('## Validation gates\n- [x] one\n* [ ] two\n-  [X]  three\n');
    expect(g.map((x) => x.text)).toEqual(['one', 'two', 'three']);
  });
});

describe('validate — a plan without gates is not a PRP', () => {
  it('accepts a complete PRP', () => {
    const v = validate(GOOD);
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
    expect(v.gateCount).toBe(4);
  });

  it('rejects a plan that says nothing about how done is checked', () => {
    const noGates = GOOD.replace(/## Validation gates[\s\S]*$/, '');
    const v = validate(noGates);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toContain('validation gates');
  });

  it('rejects an empty gates section without also double-reporting it', () => {
    const v = validate(`${GOOD.replace(/## Validation gates[\s\S]*$/, '')}## Validation gates\n`);
    expect(v.ok).toBe(false);
    expect(v.problems.filter((p) => p.includes('validation gates'))).toHaveLength(1);
  });

  it('names every missing section', () => {
    const v = validate('# PRP\n\n## Intent\nsomething\n');
    expect(v.ok).toBe(false);
    for (const s of REQUIRED_SECTIONS.filter((x) => x !== 'intent')) {
      expect(v.problems.join(' ')).toContain(s);
    }
  });

  it('rejects junk', () => {
    expect(validate('').ok).toBe(false);
    expect(validate(null).ok).toBe(false);
  });
});

describe('missingDimensions — advisory coverage of the four dimensions', () => {
  it('is empty when all four are named', () => {
    expect(missingDimensions(GOOD)).toEqual([]);
  });

  it('names the ones not covered', () => {
    const partial = '## Validation gates\n- [ ] happy path: it works\n';
    expect(missingDimensions(partial)).toEqual(['edge cases', 'errors', 'coverage']);
    expect(GATE_DIMENSIONS).toHaveLength(4);
  });
});

describe('applyVerdicts — silence is not success', () => {
  it('marks a gate nobody reported on as NOT passed', () => {
    const checked = applyVerdicts(GOOD, [{ id: 'g1', pass: true, why: 'saw the chart' }]);
    expect(checked[0]).toMatchObject({ pass: true, why: 'saw the chart' });
    expect(checked[1]).toMatchObject({ pass: false, why: 'not reported on' });
    expect(checked.filter((g) => g.pass)).toHaveLength(1);
  });

  it('treats anything other than an explicit true as not passed', () => {
    const checked = applyVerdicts(GOOD, [
      { id: 'g1', pass: 'true' }, { id: 'g2', pass: 1 }, { id: 'g3' }, { id: 'g4', pass: true },
    ]);
    expect(checked.map((g) => g.pass)).toEqual([false, false, false, true]);
  });

  it('survives junk verdicts without throwing', () => {
    expect(applyVerdicts(GOOD, null).every((g) => !g.pass)).toBe(true);
    expect(applyVerdicts(GOOD, [null, 'x', { pass: true }]).every((g) => !g.pass)).toBe(true);
  });
});

describe('formatGateReport / failureSummary — what the founder reads', () => {
  it('renders a tick or a cross per gate with the evidence', () => {
    const checked = applyVerdicts(GOOD, [
      { id: 'g1', pass: true, why: 'rendered in the test' },
      { id: 'g2', pass: false, why: 'empty state crashes' },
    ]);
    const report = formatGateReport(checked);
    expect(report).toContain('✅ happy path: the card page shows a 12-month chart');
    expect(report).toContain('❌ edge cases:');
    expect(report).toContain('empty state crashes');
    expect(report.split('\n')).toHaveLength(4);
  });

  it('says so plainly when there is nothing to report', () => {
    expect(formatGateReport([])).toContain('No validation gates');
    expect(formatGateReport(null)).toContain('No validation gates');
  });

  it('summarises only the failures, capped', () => {
    const checked = applyVerdicts(GOOD, [{ id: 'g1', pass: true, why: 'ok' }]);
    const summary = failureSummary(checked);
    expect(summary).toContain('edge cases');
    expect(summary).not.toContain('happy path');
    expect(summary.split(';')).toHaveLength(3);
    expect(failureSummary(applyVerdicts(GOOD, GOOD_ALL_PASS))).toBe('');
  });
});

const GOOD_ALL_PASS = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id, pass: true, why: 'ok' }));
