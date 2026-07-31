import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('tolerates how a model decorates the heading', () => {
    // Every one of these blocked the ticket before. The PRP is model-generated against a fixed
    // vocabulary of five names, so losing good work to a stray colon is the wrong trade.
    for (const heading of [
      '## Validation gates', '## Validation Gates', '## Validation gates:',
      '### Validation gates', '## 5. Validation gates', '## 5) Validation gates',
      '#### **Validation gates**',
    ]) {
      const s = sections(`${heading}\n- [ ] happy path: works\n`);
      expect(Object.keys(s), `heading not recognised: ${heading}`).toEqual(['validation gates']);
    }
  });

  it('still does not confuse a different section for a required one', () => {
    expect(Object.keys(sections('## Validation notes\nx\n'))).toEqual(['validation notes']);
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
    const joined = v.problems.join(' ');
    for (const s of REQUIRED_SECTIONS.filter((x) => x !== 'intent')) {
      expect(joined.toLowerCase()).toContain(s);
    }
    // Quoted the way the PLAN prompt writes them, since this text is the model's retry hint.
    expect(joined).toContain('"Validation gates"');
    expect(joined).not.toContain('## ');   // no heading level — any level is accepted
  });

  it('rejects junk', () => {
    expect(validate('').ok).toBe(false);
    expect(validate(null).ok).toBe(false);
  });
});

describe('the PLAN prompt and this parser must agree', () => {
  // The contract lives in two files: prp-lib.mjs decides what a PRP must contain, supervisor.sh
  // tells the model what to write. Rename a section in one and every ticket blocks at PLAN with
  // "The lane couldn't write a proper plan" — a fleet-wide outage from a one-word edit. This turns
  // that into a red test.
  const supervisor = readFileSync(new URL('../supervisor.sh', import.meta.url).pathname, 'utf8');

  it('asks the model for every section this parser requires', () => {
    for (const name of REQUIRED_SECTIONS) {
      const heading = name.replace(/^./, (c) => c.toUpperCase());
      expect(supervisor, `the PLAN prompt is missing "## ${heading}"`).toContain(`## ${heading}`);
    }
  });

  it('asks the model for every gate dimension this parser recognises', () => {
    for (const dim of GATE_DIMENSIONS) {
      expect(supervisor, `the PLAN prompt never mentions the "${dim}:" label`).toContain(`${dim}:`);
    }
  });

  it('a PRP written exactly as the prompt describes is accepted', () => {
    const asPrompted = [
      '# PRP — x', '',
      ...REQUIRED_SECTIONS.slice(0, 4).map((n) => `## ${n.replace(/^./, (c) => c.toUpperCase())}\nsomething\n`),
      '## Validation gates',
      ...GATE_DIMENSIONS.map((d) => `- [ ] ${d}: something must be true`),
      '',
    ].join('\n');
    const v = validate(asPrompted);
    expect(v.ok, v.problems.join('; ')).toBe(true);
    expect(v.gateCount).toBe(GATE_DIMENSIONS.length);
    expect(missingDimensions(asPrompted)).toEqual([]);
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

  it('matches ids regardless of case or stray whitespace — a model writes these', () => {
    // The ids are the one input on this path authored by a model rather than by code. If the
    // normalisation went, every gate would read "not reported on", and the lane would burn a whole
    // repair round on already-correct code before blocking the founder.
    const checked = applyVerdicts(GOOD, [{ id: ' G1 ', pass: true, why: 'ok' }, { id: 'G2', pass: true }]);
    expect(checked[0]).toMatchObject({ pass: true, why: 'ok' });
    expect(checked[1].pass).toBe(true);
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

  it('summarises only the failures', () => {
    const summary = failureSummary(applyVerdicts(GOOD, [{ id: 'g1', pass: true, why: 'ok' }]));
    expect(summary).toContain('edge cases');
    expect(summary).not.toContain('happy path');
    expect(failureSummary(applyVerdicts(GOOD, GOOD_ALL_PASS))).toBe('');
  });

  it('caps the summary at three, however many failed', () => {
    // GOOD has exactly four gates, so a 1-pass fixture leaves exactly three failures and the cap is
    // a no-op on it — asserting the cap there would pass with `.slice(0, 3)` deleted. Six gates
    // makes the cap the only thing keeping a RunReport line readable.
    const six = `## Validation gates\n${['a', 'b', 'c', 'd', 'e', 'f'].map((t) => `- [ ] gate ${t}`).join('\n')}\n`;
    const summary = failureSummary(applyVerdicts(six, []));
    expect(summary.split('; ')).toHaveLength(3);
    expect(summary).toContain('gate a');
    expect(summary).not.toContain('gate d');
  });
});

const GOOD_ALL_PASS = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id, pass: true, why: 'ok' }));
