/**
 * Numbers about a screenshot, and about a pair of them (FB-226).
 *
 * Adapted from `visual/compare-screenshots` in `dzhng/skills` (MIT), whose framing is the reason this
 * exists at all:
 *
 *   > Decide which image is **less wrong** against what the scene should show — not whether the
 *   > candidate matches the baseline. The baseline is just an earlier attempt; it can be wrong too.
 *
 * That is non-negotiable 11 with a mechanism instead of a sentence. Its absence cost this project more
 * than any other failure: thirty tickets shipped with every gate green while the desk was 9,908px
 * against a design of ~1,900.
 *
 * ## What these numbers are for, and what they are not
 *
 * **They locate where two images differ. They never decide which one is right.** A high difference
 * against the design might mean the screen is wrong, or might mean the design is. Only a person looking
 * at both decides, and `SKILL.md` says so where an agent will read it.
 *
 * Kept pure and separate from any file reading so it can be tested on pixels built by hand rather than
 * on PNGs that have to be generated first. Everything here takes plain `{width, height, data}` with
 * RGBA bytes — the shape `pngjs` produces.
 */

/** Perceptual luminance, 0–255. Rec. 709, because green carries most of the apparent brightness. */
export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Is this image essentially one flat colour?
 *
 * The question behind it is "did the capture actually get the page, or a blank frame?" A screenshot of
 * a failed render is uniform, and a uniform screenshot passes every test that only checks a file
 * exists. `stdev` is the measure: a real screen has text and edges, so it varies.
 *
 * `flat` at a standard deviation under 4 is deliberately conservative — a genuinely minimal screen can
 * be quiet, so this is evidence to look at the picture, never a verdict on its own.
 */
export function flatness({ width, height, data }) {
  const n = width * height;
  if (n === 0) return { mean: 0, stdev: 0, flat: true };
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const d = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) - mean;
    sq += d * d;
  }
  const stdev = Math.sqrt(sq / n);
  return { mean, stdev, flat: stdev < 4 };
}

/**
 * How much of the frame is not background.
 *
 * Background is taken as the most common luminance bucket rather than as white, because this studio
 * renders in a viewer's theme and a dark screen's background is not white. Anything more than
 * `tolerance` away from that bucket counts as content.
 *
 * `coverage` near zero on a page that should show something means an empty frame — which is exactly
 * the question FB-218 opened about the office between wakes.
 *
 * **Known limit:** a frame that is more than half ink reports the ink as background, and its coverage
 * then reads near zero. Every capture in this repo is 2-5% content so it does not bite here, and a
 * test records the property rather than leaving it to be rediscovered. A genuinely dense screen would
 * need a different background rule.
 */
export function coverage({ width, height, data }, tolerance = 12) {
  const n = width * height;
  if (n === 0) return { coverage: 0, backgroundLuma: 0 };
  const buckets = new Uint32Array(256);
  const lumas = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = Math.round(luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
    lumas[i] = l;
    buckets[l]++;
  }
  let backgroundLuma = 0;
  for (let l = 1; l < 256; l++) if (buckets[l] > buckets[backgroundLuma]) backgroundLuma = l;
  let content = 0;
  for (let i = 0; i < n; i++) if (Math.abs(lumas[i] - backgroundLuma) > tolerance) content++;
  return { coverage: content / n, backgroundLuma };
}

/**
 * Where the content sits in the frame.
 *
 * A screen can be entirely correct and badly framed — everything crammed into the top eighth, or a
 * long tail of empty space below the fold. `lastContentRow` is the honest measure of how tall the page
 * really is, as opposed to how tall the capture is, and the gap between them is dead space.
 */
export function framing({ width, height, data }, tolerance = 12) {
  const { backgroundLuma } = coverage({ width, height, data }, tolerance);
  let firstContentRow = -1;
  let lastContentRow = -1;
  for (let y = 0; y < height; y++) {
    let rowHasContent = false;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (Math.abs(luminance(data[i], data[i + 1], data[i + 2]) - backgroundLuma) > tolerance) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) {
      if (firstContentRow === -1) firstContentRow = y;
      lastContentRow = y;
    }
  }
  const usedRows = lastContentRow === -1 ? 0 : lastContentRow - firstContentRow + 1;
  return {
    firstContentRow,
    lastContentRow,
    // Dead space BELOW the content, as a fraction of the capture. This is the number that would have
    // caught the 9,908px desk: half of it was finished work nobody needed, but the tail was real
    // content, so what this catches is the other failure — a tall capture that is mostly nothing.
    trailingEmptyFraction: height === 0 ? 0 : (height - 1 - lastContentRow) / height,
    /**
     * Empty rows below the content, absolutely.
     *
     * The fraction alone is not enough, and the first version of this got it wrong: a 720px error page
     * whose content ends at row 400 is 44% empty and completely fine, because a short page in a
     * viewport-height capture *should* have space under it. The 9,908px desk had a tail of nearly eight
     * thousand pixels. Only the absolute number separates those two.
     */
    trailingEmptyRows: lastContentRow === -1 ? height : height - 1 - lastContentRow,
    contentFraction: height === 0 ? 0 : usedRows / height,
  };
}

/**
 * Everything worth knowing about one capture on its own, with no counterpart.
 *
 * Deliberately usable before any comparison exists: measuring whether a frame is flat, empty or badly
 * framed needs no baseline, and finding that out first stops a reviewer arguing about a difference
 * between two broken captures.
 */
export function sceneMetrics(image) {
  const f = flatness(image);
  const c = coverage(image);
  const fr = framing(image);
  const problems = [];
  if (f.flat) problems.push('the frame is essentially one flat colour — the capture may have failed');
  if (c.coverage < 0.005) problems.push('almost nothing is drawn — the frame looks empty');
  // A whole screen of nothing at the bottom. 600px is about one viewport, so this fires when a reader
  // would have to scroll past an empty screen — and stays quiet for a short page that simply has space
  // under it. Tuned against this repo's own 34 captures: the two error pages stopped tripping it and
  // nothing real started.
  if (fr.trailingEmptyRows > 600) {
    problems.push(
      `${fr.trailingEmptyRows}px below the content is empty `
      + `(${Math.round(fr.trailingEmptyFraction * 100)}% of the capture) — about `
      + `${(fr.trailingEmptyRows / 600).toFixed(1)} screens of nothing`,
    );
  }
  return {
    width: image.width,
    height: image.height,
    meanLuma: Number(f.mean.toFixed(2)),
    stdevLuma: Number(f.stdev.toFixed(2)),
    coverage: Number(c.coverage.toFixed(4)),
    ...fr,
    problems,
  };
}

/**
 * How far apart two images are, per pixel.
 *
 * Returns the count and the fraction rather than a pass or a fail, because **there is no threshold
 * that means "correct"**. FB-124 shipped a studio with two navigations that would have scored well
 * against the previous screenshot, since the previous screenshot also had them.
 *
 * `sizesDiffer` is reported rather than thrown, so a pair that cannot be compared is a finding instead
 * of a crash — a differently-sized capture is usually the most interesting thing in the run.
 */
export function pixelDelta(a, b, threshold = 0.1) {
  if (a.width !== b.width || a.height !== b.height) {
    return {
      sizesDiffer: true,
      a: { width: a.width, height: a.height },
      b: { width: b.width, height: b.height },
      // Height is the cheap proxy this project already trusts: CLAUDE.md #11 asks for it in every PR.
      heightRatio: b.height === 0 ? null : Number((a.height / b.height).toFixed(3)),
    };
  }
  const n = a.width * a.height;
  let differing = 0;
  const cut = threshold * 255;
  for (let i = 0; i < n; i++) {
    const la = luminance(a.data[i * 4], a.data[i * 4 + 1], a.data[i * 4 + 2]);
    const lb = luminance(b.data[i * 4], b.data[i * 4 + 1], b.data[i * 4 + 2]);
    if (Math.abs(la - lb) > cut) differing++;
  }
  return {
    sizesDiffer: false,
    differingPixels: differing,
    differingFraction: n === 0 ? 0 : Number((differing / n).toFixed(4)),
  };
}

/**
 * What a reviewer should be told, in words, about a pair.
 *
 * Never a verdict. Every line either states a measurement or says what to go and look at, because the
 * one thing this must not do is let a number stand in for looking — which is the whole failure it was
 * written to prevent.
 */
export function readingFor(id, reference, candidate) {
  const delta = pixelDelta(reference, candidate);
  const lines = [`${id}:`];
  if (delta.sizesDiffer) {
    lines.push(
      `  the two captures are different sizes — reference ${delta.a.width}x${delta.a.height}, `
      + `candidate ${delta.b.width}x${delta.b.height}`,
      `  height ratio ${delta.heightRatio ?? 'n/a'} — record it, and if it is far from 1 that is the finding`,
    );
  } else {
    lines.push(`  ${Math.round(delta.differingFraction * 100)}% of pixels differ`);
  }
  for (const [label, img] of [['reference', reference], ['candidate', candidate]]) {
    const m = sceneMetrics(img);
    if (m.problems.length) lines.push(`  ${label}: ${m.problems.join('; ')}`);
  }
  lines.push('  Now look at both pictures. These numbers say where they differ, never which is right.');
  return lines.join('\n');
}
