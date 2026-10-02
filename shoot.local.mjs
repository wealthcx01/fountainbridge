// Screenshot routes at desktop and phone size, printing where each landed and its height.
// usage: node shoot.mjs <label> <email> <route>[,<route>...] [clickTestId]
import { chromium } from 'playwright';
const [label, email, routesArg, click] = process.argv.slice(2);
const OUT = '/tmp/claude-1000/-home-dev-projects-fountainbridge/44f7243d-d309-4a6c-ad2a-8409698761c7/scratchpad/shots';
const BASE = 'http://localhost:3301';
const sizes = [{ n: 'desktop', width: 1440, height: 1000 }, { n: 'phone', width: 393, height: 851 }];
const browser = await chromium.launch();
for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  await page.goto(BASE + '/login');
  await page.getByTestId('e2e-email').fill(email);
  await page.getByTestId('e2e-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  for (const r of routesArg.split(',')) {
    await page.goto(BASE + r, { timeout: 180000 });
    await page.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => {});
    if (click) {
      const el = page.locator(click).first();
      if (await el.count()) { await el.click(); await page.waitForTimeout(1500); }
      else console.log('click target not found:', click);
    }
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    const name = `${label}-${r.replace(/[^a-z0-9]+/gi, '_')}-${s.n}.png`;
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
    console.log(`${s.n} ${r} landed=${new URL(page.url()).pathname}${new URL(page.url()).search} height=${h} width=${w} -> ${name}`);
  }
  await page.close();
}
await browser.close();
