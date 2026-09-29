#!/usr/bin/env node
/**
 * Read screenshots, measure them, write the artifacts a person needs to look at (FB-226).
 *
 * Adapted from `visual/compare-screenshots` in `dzhng/skills` (MIT). Theirs assumes a `web/`
 * subdirectory and resolves its dependencies from there; this repo is flat, so the file reading is
 * ours and the thinking is theirs.
 *
 * All the judgement lives in `visual-metrics.mjs`, which is pure and tested. This file only does I/O,
 * so the part that can be wrong is the part that has tests.
 *
 * ## Two modes
 *
 *   CANDIDATE_DIR=e2e/__screenshots__ node scripts/visual-parity-diff.mjs
 *     Measures each capture on its own: is it flat, empty, badly framed? Needs no counterpart, and is
 *     worth running first — arguing about a difference between two broken captures wastes everyone.
 *
 *   REFERENCE_DIR=design-shots CANDIDATE_DIR=e2e/__screenshots__ node scripts/visual-parity-diff.mjs
 *     Pairs by filename and reports how far apart each pair is.
 *
 * `OUT_DIR` (default `visual-diff/`) gets a side-by-side and an absolute-difference heatmap per pair,
 * plus `reading.md` and `metrics.json`.
 *
 * ## What this is not
 *
 * **It never passes or fails anything**, and it is not a gate. The numbers locate where two images
 * differ; only a person deciding what the screen should show knows which one is wrong. That is why the
 * design comparison in CLAUDE.md #11 still ends with "look at both" — this makes looking cheaper and
 * better aimed, and it cannot replace it.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { sceneMetrics, pixelDelta, readingFor, luminance } from './visual-metrics.mjs';

const REFERENCE_DIR = process.env.REFERENCE_DIR?.trim() || null;
const CANDIDATE_DIR = process.env.CANDIDATE_DIR?.trim() || 'e2e/__screenshots__';
const OUT_DIR = process.env.OUT_DIR?.trim() || 'visual-diff';

const pngsIn = async (dir) => {
  const names = await readdir(dir).catch(() => {
    throw new Error(`cannot read ${dir} — is that the right directory?`);
  });
  return names.filter((n) => extname(n).toLowerCase() === '.png').sort();
};

const read = async (path) => PNG.sync.read(await readFile(path));

/** Two images beside each other, at the taller one's height, so a size difference is visible. */
function sideBySide(a, b) {
  const width = a.width + b.width;
  const height = Math.max(a.height, b.height);
  const out = new PNG({ width, height });
  out.data.fill(255);
  const blit = (src, xOffset) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const s = (y * src.width + x) * 4;
        const d = (y * width + (x + xOffset)) * 4;
        out.data[d] = src.data[s];
        out.data[d + 1] = src.data[s + 1];
        out.data[d + 2] = src.data[s + 2];
        out.data[d + 3] = 255;
      }
    }
  };
  blit(a, 0);
  blit(b, a.width);
  return out;
}

/**
 * Where the two differ, in brightness.
 *
 * Grey means the same, and the brighter a pixel the further apart they are. Not a colour ramp on
 * purpose: a red-on-green heatmap is unreadable to a good number of people and this is meant to be
 * looked at.
 */
function heatmap(a, b) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      const d = Math.abs(
        luminance(a.data[ia], a.data[ia + 1], a.data[ia + 2])
        - luminance(b.data[ib], b.data[ib + 1], b.data[ib + 2]),
      );
      const v = Math.min(255, Math.round(d));
      const o = (y * width + x) * 4;
      out.data[o] = v; out.data[o + 1] = v; out.data[o + 2] = v; out.data[o + 3] = 255;
    }
  }
  return out;
}

const outPath = (name) => join(OUT_DIR, name);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const candidates = await pngsIn(CANDIDATE_DIR);
  if (!candidates.length) throw new Error(`no PNGs in ${CANDIDATE_DIR} — nothing to measure.`);

  const lines = [];
  const metrics = {};

  if (!REFERENCE_DIR) {
    lines.push(`# Each capture on its own — ${candidates.length} from ${CANDIDATE_DIR}`, '');
    for (const name of candidates) {
      const img = await read(resolve(CANDIDATE_DIR, name));
      const m = sceneMetrics(img);
      metrics[name] = m;
      lines.push(
        `## ${name}`,
        `- ${m.width}x${m.height}, content ends at row ${m.lastContentRow}`,
        `- ${Math.round(m.coverage * 100)}% of pixels are content`,
        ...(m.problems.length
          ? m.problems.map((p) => `- **${p}**`)
          : ['- nothing measurable looks wrong — which is not the same as right']),
        '',
      );
    }
    lines.push(
      '---',
      '',
      'These numbers say nothing about whether the screens are **correct**. Open the pictures.',
    );
  } else {
    const references = await pngsIn(REFERENCE_DIR);
    const paired = candidates.filter((n) => references.includes(n));
    const onlyCandidate = candidates.filter((n) => !references.includes(n));
    const onlyReference = references.filter((n) => !candidates.includes(n));

    lines.push(`# ${REFERENCE_DIR} against ${CANDIDATE_DIR}`, '');
    // Said first, because an unpaired capture is usually the real finding and is the easiest thing to
    // skim past when a list of percentages follows it.
    if (onlyReference.length) lines.push(`**In the reference only:** ${onlyReference.join(', ')}`, '');
    if (onlyCandidate.length) lines.push(`**In the candidate only:** ${onlyCandidate.join(', ')}`, '');
    if (!paired.length) lines.push('**No filenames matched.** Nothing could be compared.', '');

    for (const name of paired) {
      const id = basename(name, '.png');
      const a = await read(resolve(REFERENCE_DIR, name));
      const b = await read(resolve(CANDIDATE_DIR, name));
      metrics[name] = {
        delta: pixelDelta(a, b),
        reference: sceneMetrics(a),
        candidate: sceneMetrics(b),
      };
      await writeFile(outPath(`${id}--side-by-side.png`), PNG.sync.write(sideBySide(a, b)));
      await writeFile(outPath(`${id}--difference.png`), PNG.sync.write(heatmap(a, b)));
      lines.push(`## ${id}`, '```', readingFor(id, a, b), '```',
        `Side by side: \`${id}--side-by-side.png\` · Where they differ: \`${id}--difference.png\``, '');
    }
    lines.push(
      '---',
      '',
      '**This decides nothing.** The reference is an earlier attempt and can be wrong too. Decide what',
      'the screen *should* show, then judge which image is less wrong against that. If the right answer',
      'is not clear — competing readings, or a taste call — stop and ask, and record it as a design gap',
      'rather than defaulting to the reference.',
    );
  }

  await writeFile(outPath('reading.md'), lines.join('\n'));
  await writeFile(outPath('metrics.json'), JSON.stringify(metrics, null, 2));
  process.stdout.write(`${lines.join('\n')}\n\nWritten to ${OUT_DIR}/\n`);
}

main().catch((err) => {
  process.stderr.write(`visual-parity-diff: ${err.message}\n`);
  process.exit(1);
});
