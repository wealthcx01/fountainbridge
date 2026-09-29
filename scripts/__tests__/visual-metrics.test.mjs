import { describe, it, expect } from 'vitest';
import {
  luminance, flatness, coverage, framing, sceneMetrics, pixelDelta, readingFor,
} from '../visual-metrics.mjs';

/**
 * The measurements behind non-negotiable 11 (FB-226).
 *
 * Built on pixels constructed here rather than on PNG files, so every case is exact and a test that
 * passes for the wrong reason is hard to write. The fixtures deliberately include the two shapes this
 * project has actually shipped: a frame that is nothing at all, and a page whose content stops a long
 * way above the bottom of the capture.
 */

/** An image of one colour. */
function solid(width, height, [r, g, b]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** A pale page with `rows` of dark content at the top and nothing below it. */
function pageWithContent(width, height, rows) {
  const img = solid(width, height, [240, 240, 240]);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      img.data[i] = 20; img.data[i + 1] = 20; img.data[i + 2] = 20;
    }
  }
  return img;
}

describe('luminance', () => {
  it('weights green most, because that is what the eye does', () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
    expect(luminance(255, 0, 0)).toBeGreaterThan(luminance(0, 0, 255));
  });
  it('is 0 for black and 255 for white', () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(Math.round(luminance(255, 255, 255))).toBe(255);
  });
});

describe('a capture that failed', () => {
  it('calls a single flat colour flat', () => {
    // A screenshot of a failed render is uniform, and a uniform screenshot passes every test that
    // only checks the file exists. This is the check that does not.
    const f = flatness(solid(40, 40, [255, 255, 255]));
    expect(f.stdev).toBe(0);
    expect(f.flat).toBe(true);
  });

  it('does not call a real page flat', () => {
    const f = flatness(pageWithContent(40, 40, 10));
    expect(f.flat).toBe(false);
    expect(f.stdev).toBeGreaterThan(4);
  });

  it('reports an empty frame as a problem in words, not as a score', () => {
    const m = sceneMetrics(solid(40, 40, [255, 255, 255]));
    expect(m.problems.join(' ')).toMatch(/flat colour|capture may have failed/i);
  });
});

describe('what is actually drawn', () => {
  it('measures content against the commonest colour, not against white', () => {
    // The studio renders in the viewer's theme, so a dark screen's background is not white. Taking
        // white as background would report a dark page as almost entirely content.
    const dark = solid(20, 20, [16, 20, 19]);
    const c = coverage(dark);
    expect(c.coverage).toBe(0);
    expect(c.backgroundLuma).toBeLessThan(40);
  });

  it('counts the content rows and not the background', () => {
    const c = coverage(pageWithContent(10, 100, 25));
    // 25 rows of 100 are content.
    expect(c.coverage).toBeCloseTo(0.25, 5);
  });
});

describe('framing — the 9,908px failure, measured', () => {
  it('finds where content stops and how much height is wasted below it', () => {
    // A 1000-row capture whose content ends at row 200. This is the shape of the desk that shipped:
    // correct content, far too much frame.
    const fr = framing(pageWithContent(10, 1000, 200));
    expect(fr.firstContentRow).toBe(0);
    expect(fr.lastContentRow).toBe(199);
    expect(fr.trailingEmptyFraction).toBeCloseTo(0.8, 2);
  });

  it('flags a capture with a whole screen of nothing under the content', () => {
    // 1000 rows, content ends at 100 -> a 899px tail.
    const m = sceneMetrics(pageWithContent(10, 1000, 100));
    expect(m.trailingEmptyRows).toBe(900);
    expect(m.problems.join(' ')).toMatch(/empty/i);
  });

  it('does NOT flag a short page that simply has space under it', () => {
    // The false positive the first version had, found by running it on this repo's own 34 captures:
    // a 720px error page whose content ends around row 400 is 44% empty and completely fine. Only the
    // absolute tail separates that from the 9,908px desk.
    //
    // The fixture is SPARSE on purpose. A block of 400 solid dark rows in a 720px frame makes ink the
    // commonest colour, which inverts `coverage`'s background detection — see its note. Real captures
    // are 2-5% content, so this models one of those.
    const img = solid(10, 720, [240, 240, 240]);
    for (let y = 0; y < 400; y += 8) {
      for (let x = 0; x < 10; x++) {
        const i = (y * 10 + x) * 4;
        img.data[i] = 20; img.data[i + 1] = 20; img.data[i + 2] = 20;
      }
    }
    const m = sceneMetrics(img);
    expect(m.trailingEmptyFraction).toBeGreaterThan(0.4);
    expect(m.trailingEmptyRows).toBe(327);
    expect(m.problems).toEqual([]);
  });

  it('says so in its own note that content past half the frame inverts the background guess', () => {
    // A real limitation, kept as a test so it is a known property rather than a surprise. A frame that
    // is mostly ink reports the ink as background. Every real capture in this repo is 2-5% content, so
    // it does not bite -- but a future dense screen would, and this is where that is recorded.
    const mostlyInk = pageWithContent(10, 100, 70);
    expect(coverage(mostlyInk).backgroundLuma).toBeLessThan(60);
  });

  it('does not flag a page whose content reaches the bottom', () => {
    // NOT `pageWithContent(10, 100, 100)`: filling every row makes the image a single colour, which
    // is correctly flat — a uniform dark frame and a uniform white one are the same failure. A real
    // page has content AND background, so this interleaves them all the way down.
    const img = solid(10, 100, [240, 240, 240]);
    for (let y = 0; y < 100; y += 4) {
      for (let x = 0; x < 10; x++) {
        const i = (y * 10 + x) * 4;
        img.data[i] = 20; img.data[i + 1] = 20; img.data[i + 2] = 20;
      }
    }
    const m = sceneMetrics(img);
    expect(m.lastContentRow).toBe(96);
    expect(m.trailingEmptyFraction).toBeLessThan(0.05);
    expect(m.problems).toEqual([]);
  });

  it('calls a frame filled edge to edge with one colour flat, not full', () => {
    // The case the fixture above got wrong, kept as a test because it is a real capture failure: a
    // render that painted one block reads as 100% content to a naive measure.
    const m = sceneMetrics(pageWithContent(10, 100, 100));
    expect(m.problems.join(' ')).toMatch(/flat colour/i);
  });
});

describe('comparing two captures', () => {
  it('reports differing sizes rather than throwing, because that is the interesting case', () => {
    // A pair that cannot be compared is a finding, not a crash. And the height ratio is the number
    // CLAUDE.md #11 asks for in every PR.
    const d = pixelDelta(pageWithContent(10, 900, 50), pageWithContent(10, 300, 50));
    expect(d.sizesDiffer).toBe(true);
    expect(d.heightRatio).toBe(3);
  });

  it('counts differing pixels when the sizes match', () => {
    const a = pageWithContent(10, 100, 50);
    const b = pageWithContent(10, 100, 25);
    const d = pixelDelta(a, b);
    expect(d.sizesDiffer).toBe(false);
    // 25 rows of 100 changed from dark to pale.
    expect(d.differingFraction).toBeCloseTo(0.25, 5);
  });

  it('sees no difference between a capture and itself', () => {
    const a = pageWithContent(10, 100, 50);
    expect(pixelDelta(a, a).differingFraction).toBe(0);
  });
});

describe('what the reviewer is told', () => {
  it('always ends by sending them to look at the pictures', () => {
    // The one thing this must not do is let a number stand in for looking. That is the failure it was
    // written to prevent, so it is asserted rather than trusted.
    const r = readingFor('desk', pageWithContent(10, 100, 50), pageWithContent(10, 100, 30));
    expect(r).toMatch(/look at both/i);
    expect(r).toMatch(/never which is right/i);
  });

  it('never says pass or fail, because no threshold means correct', () => {
    // FB-124 shipped two navigations that would have scored well against the previous screenshot,
    // because the previous screenshot had them too.
    const r = readingFor('desk', pageWithContent(10, 100, 50), pageWithContent(10, 100, 50));
    expect(r).not.toMatch(/\b(pass|passed|fail|failed|ok|correct)\b/i);
  });

  it('names a size mismatch and asks for the ratio to be recorded', () => {
    const r = readingFor('desk', pageWithContent(10, 900, 50), pageWithContent(10, 300, 50));
    expect(r).toMatch(/different sizes/i);
    expect(r).toMatch(/height ratio/i);
  });

  it('surfaces a broken capture on either side of the pair', () => {
    const r = readingFor('desk', solid(10, 100, [255, 255, 255]), pageWithContent(10, 100, 50));
    expect(r).toMatch(/reference:.*flat colour/i);
  });
});
