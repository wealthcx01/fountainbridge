import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * The launch video keeps ARCA's own rule (FB-233).
 *
 * `launch-video`'s bar is that **if the piece could be re-skinned for another project, it has
 * failed**. This film is built from the one line ARCA's brand document states most plainly:
 *
 *   > Gold is a signal, not a decoration. If gold shows up, it means ARCA has proven something.
 *
 * So the test of the film is the test of that rule: **no gold anywhere before the score crosses 80.**
 * Every assertion below is about that, and they are what make the claim checkable rather than a
 * thing somebody says in a pull request.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENE = resolve(HERE, '../../scripts/launch-video/scene.mjs');
const { scene, scoreAt, isProven, BEATS, BRAND, FPS, TYPE, totalFrames } = await import(SCENE);

const everyFrame = function* () {
  for (let f = 0; f < totalFrames(); f++) yield { f, t: f / FPS };
};

describe('gold is a signal, not a decoration', () => {
  it('appears on no frame before the score has crossed', () => {
    // The whole film, frame by frame. Not a sample: one leaked frame is the rule broken.
    const leaks: number[] = [];
    for (const { t } of everyFrame()) {
      if (!isProven(t) && scene(t).includes(BRAND.gold)) leaks.push(Number(t.toFixed(3)));
    }
    expect(leaks, `gold appears at ${leaks.slice(0, 5).join(', ')}s, before anything is proven`).toEqual([]);
  });

  it('appears on the very frame it crosses, not a beat later', () => {
    const frames = [...everyFrame()];
    const crossed = frames.find(({ t }) => isProven(t));
    const golden = frames.find(({ t }) => scene(t).includes(BRAND.gold));
    expect(crossed).toBeDefined();
    expect(golden?.f).toBe(crossed?.f);
  });

  it('the score stalls one short of the threshold rather than sailing through it', () => {
    // The brand document's claim is that the top tier is EARNED. A number that crosses early says
    // the opposite -- and the first draft of this scene did exactly that, reaching 81 two tenths
    // before the beat meant to introduce gold. Found by asserting it, not by watching.
    const before = Math.max(...[...everyFrame()].filter(({ t }) => t < BEATS.proven).map(({ t }) => scoreAt(t)));
    expect(before).toBe(79);
    expect(scoreAt(BEATS.proven)).toBe(80);
  });

  it('ends at 82, so the badge it earns is the top tier the brand document names', () => {
    expect(scoreAt(BEATS.end)).toBe(82);
    expect(scene(BEATS.end)).toContain('STRONG');
  });
});

describe('it could not be re-skinned for another venture', () => {
  it('is made of ARCA’s own facts, not a template’s', () => {
    const last = scene(BEATS.end);
    // Its own brand line, its own score, its own grading vocabulary.
    expect(last).toContain('Gold is a signal, not a decoration.');
    expect(last).toContain('ARCA SCORE');
    expect(last).toContain('PSA 10');
    expect(last).toContain('GRADED CARD INTELLIGENCE');
  });

  it('draws ARCA’s own mark, the one in its repository, and draws it visibly', () => {
    // The exact trendline path from client/src/components/ui/Logo.tsx -- "a trendline that dips then
    // breaks upward", which its own comment calls the alpha signal the pipeline exists to find.
    const last = scene(BEATS.end);
    expect(last).toContain('M7 16.5 L14 20 L22.3 7.5');

    // Present is not the same as visible. Setting that path's opacity to 0 left the first version of
    // this test perfectly green while the most meaningful line in the mark was gone -- found by
    // doing exactly that and watching nothing fail.
    const trendline = /<path d="M7 16\.5 L14 20 L22\.3 7\.5"[^/]*\/>/.exec(last)?.[0] ?? '';
    expect(trendline, 'the trendline is not in the final frame').not.toBe('');
    const opacity = Number(/opacity="([\d.]+)"/.exec(trendline)?.[1] ?? '0');
    expect(opacity, 'the trendline is drawn invisibly').toBeGreaterThan(0.5);

    // And it is fully drawn by the end rather than stuck mid-stroke.
    const offset = Number(/stroke-dashoffset="([\d.]+)"/.exec(trendline)?.[1] ?? '99');
    expect(offset, 'the trendline never finishes drawing').toBeLessThan(0.01);
  });

  it('uses the stated palette, not an approximation of it', () => {
    // docs/brand/design-rationale.md names these values.
    expect(BRAND.ground).toBe('#0a0a0a');
    expect(BRAND.text).toBe('#eae6da');
    expect(BRAND.gold).toBe('#c9a860');
  });

  it('uses no gradient anywhere, because the brand rules them out by name', () => {
    for (const { t } of everyFrame()) {
      expect(scene(t)).not.toMatch(/Gradient|gradient/);
    }
  });

  it('asks for the brand faces by name, so a fallback is not silent', () => {
    // The first render asked for Georgia. This machine has no serif at all, so Chromium drew the
    // whole film in its default sans with no error and nothing on the frame to say so.
    expect(TYPE.display).toContain('Source Serif 4');
    expect(TYPE.mono).toContain('IBM Plex Mono');
    expect(scene(BEATS.end)).toContain('Source Serif 4');
  });
});

describe('the scene is a function of time and nothing else', () => {
  it('gives the same frame for the same instant, every time', () => {
    // A film that renders differently on two runs is not reproducible from code, which is the one
    // rule `renderer` insists on.
    expect(scene(6.0)).toBe(scene(6.0));
    expect(scene(BEATS.proven)).toBe(scene(BEATS.proven));
  });

  it('produces a well-formed frame at every instant, including the edges', () => {
    for (const t of [0, 0.001, BEATS.data, BEATS.proven, BEATS.end, BEATS.end + 5]) {
      const svg = scene(t);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
    }
  });
});
