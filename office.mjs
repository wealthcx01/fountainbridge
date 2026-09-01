import { chromium } from '@playwright/test';
const BASE = 'https://foundry-studio-production-4a73.up.railway.app';
const SP = '/tmp/claude-1000/-home-dev-projects-fountainbridge/44f7243d-d309-4a6c-ad2a-8409698761c7/scratchpad';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('password-email').fill('arca.founder@bruntsfield.capital');
await page.getByTestId('password-password').fill(process.env.FOUNDER_PW);
await page.getByTestId('password-submit').click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });

const read = async (label) => {
  await page.goto(`${BASE}/venture/arca?refresh=1`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('office-plate').waitFor({ timeout: 90000 });
  const live = (await page.getByTestId('office-live').count()) > 0;
  const desks = await page.locator('[data-testid^="office-desk-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-testid').replace('office-desk-', '')));
  const rows = await page.locator('[data-testid^="office-row-"]').evaluateAll((els) =>
    els.map((e) => [e.getAttribute('data-testid').replace('office-row-', ''),
                    e.getAttribute('data-state'),
                    e.querySelectorAll('td')[1].textContent.replace(/\s+/g, ' ').trim().slice(0, 70)]));
  const poses = await page.locator('[data-testid^="pixel-agent-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-testid').replace('pixel-agent-', '')));
  console.log(`\n--- ${label} ---`);
  console.log('live        :', live);
  console.log('summary     :', (await page.getByTestId('office-summary').textContent()).replace(/\s+/g, ' ').trim().slice(0, 90));
  console.log('plate poses :', poses.join(', '));
  console.log('agree       :', JSON.stringify(desks) === JSON.stringify(rows.map((r) => r[0])));
  for (const [id, state, doing] of rows) console.log(`   ${id.padEnd(16)} ${String(state).padEnd(15)} ${doing}`);
  return { live, poses, rows };
};

const before = await read('ARCA, now');
await page.screenshot({ path: `${SP}/office.png`, fullPage: false });
console.log('\nPOSES MATCH ROW STATES:', JSON.stringify(before.poses) === JSON.stringify(before.rows.map((r) => r[1])));
await b.close();
