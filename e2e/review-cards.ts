import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { request, type APIRequestContext, type Browser } from '@playwright/test';
import { studioTestEnv } from './server-env.mjs';

/**
 * FB-275: the test cards, put into the studio the way the planning box will, through its door.
 *
 * Each card in `e2e/fixtures/review` is a card in the door's own format (`docs/factory-cards.md`),
 * sent signed with the rig's test secret. Then each of its pictures is drawn, turned into a PNG by
 * the browser, and sent the same way. Nothing reaches the studio by any other route.
 *
 * The signature is made here from the recipe in the doc, not with the studio's own code, so these
 * tests also show that a sender following the doc gets in.
 *
 * Safe to run more than once: the same card again replaces itself.
 */

const FIXTURES = 'e2e/fixtures/review';
const SECRET = studioTestEnv().FACTORY_DOOR_SECRET;

/** Which pictures each test card has. THE RESET's has no "before": it is a new screen. */
const PICTURES: Record<string, string[]> = {
  'arca/20': ['before-computer', 'after-computer', 'before-phone', 'after-phone'],
  'arca/21': ['before-computer', 'after-computer', 'before-phone', 'after-phone'],
  'thereset-platform/5': ['after-computer', 'after-phone'],
};
const VENTURE_NAME: Record<string, string> = { arca: 'ARCA', 'thereset-platform': 'THE RESET' };

export interface TestCard {
  repo: string;
  number: number;
  title: string;
  headSha: string;
  finishedAt: string;
  [part: string]: unknown;
}

export function testCards(): TestCard[] {
  return readdirSync(FIXTURES).flatMap((repo) =>
    readdirSync(join(FIXTURES, repo))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(FIXTURES, repo, f), 'utf8')) as TestCard),
  );
}

/** Send one thing through the door, signed as the box signs it. */
export async function sendToDoor(api: APIRequestContext, body: string, secret: string = SECRET, at: number = Date.now()) {
  const timestamp = String(Math.floor(at / 1000));
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  return api.post('/api/factory', {
    data: body,
    headers: { 'content-type': 'application/json', 'x-factory-timestamp': timestamp, 'x-factory-signature': signature },
  });
}

/** Every test card and its pictures, into the studio at `baseURL`. Fails loudly if the door says no. */
export async function putReviewCards(browser: Browser, baseURL: string): Promise<void> {
  const api = await request.newContext({ baseURL });
  try {
    for (const card of testCards()) {
      const sent = await sendToDoor(api, JSON.stringify(card));
      if (!sent.ok()) throw new Error(`the door refused ${card.repo}#${card.number}: ${sent.status()} ${await sent.text()}`);
      for (const name of PICTURES[`${card.repo}/${card.number}`] ?? []) {
        const png = await drawn(browser, card, name);
        const body = JSON.stringify({
          kind: 'screenshot', repo: card.repo, number: card.number, name,
          headSha: card.headSha, takenAt: card.finishedAt, png: png.toString('base64'),
        });
        const pic = await sendToDoor(api, body);
        if (!pic.ok()) throw new Error(`the door refused ${name} of ${card.repo}#${card.number}: ${pic.status()} ${await pic.text()}`);
      }
    }
  } finally {
    await api.dispose();
  }
}

/** One test picture, as a PNG of its own size. */
async function drawn(browser: Browser, card: TestCard, name: string): Promise<Buffer> {
  const phone = name.endsWith('phone');
  const [width, height] = phone ? [393, 851] : [1440, 1000];
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html><body style="margin:0">${testPicture(card.title, name, width, height, VENTURE_NAME[card.repo] ?? card.repo)}</body></html>`);
    return await page.screenshot({ type: 'png' });
  } finally {
    await ctx.close();
  }
}

/**
 * A test picture, drawn from the card's own words (FB-274).
 *
 * The real pictures are taken by the planning box (cowgate CG-0065). These are plain stand-ins of
 * the right size: a light page with the venture's name, which picture it is, and its size. Nothing
 * in them is a real screen, which is why they may be made from this public repository.
 */
export function testPicture(cardTitle: string, name: string, w: number, h: number, ventureName: string): string {
  const phone = name.endsWith('phone');
  const after = name.startsWith('after');
  const pad = phone ? 24 : 48;
  // A phone's width holds about 24 letters of the title a line; two lines at most.
  const title = phone && cardTitle.length > 24
    ? [cardTitle.slice(0, cardTitle.lastIndexOf(' ', 24)), cardTitle.slice(cardTitle.lastIndexOf(' ', 24) + 1)]
    : [cardTitle];
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  const rows = Array.from({ length: phone ? 6 : 5 }, (_, i) => {
    const y = (phone ? 220 : 240) + i * (phone ? 92 : 120);
    return `<rect x="${pad}" y="${y}" width="${w - pad * 2}" height="${phone ? 76 : 96}" fill="#f4f1ec" stroke="#e4ded4"/>` +
      `<rect x="${pad + 16}" y="${y + 16}" width="${phone ? 44 : 60}" height="${phone ? 44 : 64}" fill="#e4ded4"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/>` +
    `<rect width="${w}" height="${phone ? 56 : 64}" fill="#f4f1ec"/>` +
    `<text x="${pad}" y="${phone ? 36 : 40}" font-family="sans-serif" font-size="${phone ? 16 : 18}" font-weight="600" fill="#22201c">${esc(ventureName)}</text>` +
    title.map((line, i) =>
      `<text x="${pad}" y="${(phone ? 112 : 136) + i * 30}" font-family="sans-serif" font-size="${phone ? 22 : 32}" font-weight="600" fill="#22201c">${esc(line)}</text>`).join('') +
    `<text x="${pad}" y="176" font-family="sans-serif" font-size="${phone ? 14 : 16}" fill="#77716a">Test picture · ${after ? 'after' : 'before'} · ${w}×${h}</text>` +
    (after ? rows : `<text x="${pad}" y="${phone ? 260 : 300}" font-family="sans-serif" font-size="${phone ? 15 : 18}" fill="#77716a">Not built yet.</text>`) +
    `</svg>`;
}
