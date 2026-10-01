#!/usr/bin/env node
/**
 * Draw the scene frame by frame and encode it (FB-233).
 *
 *     node scripts/launch-video/render.mjs [outDir]
 *
 * The I/O half. Every decision about what appears is in `scene.mjs`, which is pure and tested, so
 * the part that can be wrong about the film is the part with assertions on it.
 *
 * ## Why a browser and not Blender
 *
 * `renderer`'s rule is that every asset must be reproducible from code rather than hand-edited. An
 * SVG computed from numbers satisfies that more completely than a `.blend` file does: there is no
 * binary anywhere in the chain, and the whole film is diffable. Blender is also not installed on
 * this machine and a GPU is not available, so the alternative was no film at all.
 *
 * Chromium rasterises the SVG and ffmpeg encodes the frames. Both are already here for the UI gate.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { scene, totalFrames, FPS, WIDTH, HEIGHT } from './scene.mjs';

/**
 * The brand faces, embedded from the repository's own files.
 *
 * Embedded rather than named: this machine has no serif installed, so asking for one by name gets
 * the renderer's default sans with no error and no sign on the frame. A film whose typeface depends
 * on what happened to be installed is not reproducible from code, which is the one rule `renderer`
 * insists on.
 */
async function fontFaces() {
  const faces = [
    ['Source Serif 4', 'app/fonts/source-serif-4-latin.woff2', 400],
    ['IBM Plex Mono', 'app/fonts/ibm-plex-mono-400-latin.woff2', 400],
    ['IBM Plex Mono', 'app/fonts/ibm-plex-mono-500-latin.woff2', 500],
  ];
  const css = [];
  for (const [family, path, weight] of faces) {
    const b64 = (await readFile(path)).toString('base64');
    css.push(`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;`
      + `src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
  }
  return css.join('');
}

const OUT = process.argv[2] || 'library/launch-video';
const FRAMES = join(OUT, 'frames');

const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}\n${err.slice(-800)}`))));
});

async function main() {
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  const n = totalFrames();
  const css = await fontFaces();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  for (let f = 0; f < n; f++) {
    const svg = scene(f / FPS);
    // `setContent` rather than a data URL: a data URL of this size is slower and harder to debug.
    await page.setContent(
      `<style>${css}</style><body style="margin:0;background:#0a0a0a">${svg}</body>`,
      { waitUntil: 'load' },
    );
    // `font-display: block` plus this wait, because a frame drawn before the face loads is drawn in
    // the fallback and nothing says so.
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(FRAMES, `f${String(f).padStart(5, '0')}.png`) });
    if (f % 40 === 0) process.stdout.write(`  frame ${f}/${n}\n`);
  }
  await browser.close();

  const mp4 = join(OUT, 'arca-launch.mp4');
  await run('ffmpeg', [
    '-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%05d.png'),
    // yuv420p and an even frame size, or it will not play in a browser or on a phone.
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow',
    '-movflags', '+faststart', mp4,
  ]);

  // A still for the post, taken from the one frame the film is about.
  await run('ffmpeg', ['-y', '-i', mp4, '-ss', '8.6', '-frames:v', '1', join(OUT, 'arca-launch-still.png')]);
  await rm(FRAMES, { recursive: true, force: true });
  process.stdout.write(`\nwrote ${mp4}\n`);
}

main().catch((err) => {
  process.stderr.write(`launch-video: ${err.message}\n`);
  process.exit(1);
});
