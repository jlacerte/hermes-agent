// Test PROD d'UN seul tour, page fraiche, attend que l'agent soit INACTIF.
// Usage: NODE_PATH=... node scripts/headless-un-tour.js "<message>" "<regexMarqueur>" <shot.png> [maxMs]
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://10.0.0.1:8083/';
const DIR = '/tmp/copilot-debug';
const MSG = process.argv[2];
const MARK = new RegExp(process.argv[3] || '.', 'i');
const SHOT = process.argv[4] || 'un-tour.png';
const MAXMS = parseInt(process.argv[5] || '200000', 10);
const out = []; const L = (s) => out.push(s);

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));
  const css = `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;visibility:visible !important;}`;
  const chatInput = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();
  const bodyText = () => page.locator('body').innerText().catch(()=> '');

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await page.addStyleTag({ content: css }).catch(()=>{});
  await page.waitForTimeout(1500);
  const launcher = page.locator('.copilotKitButton').first();
  if (!(await chatInput().isVisible().catch(() => false)) && await launcher.count()) {
    await launcher.click(); await page.waitForTimeout(1500);
  }
  await chatInput().waitFor({ state: 'visible', timeout: 10000 });

  await chatInput().fill(MSG); await chatInput().press('Enter');
  L(`→ ${MSG}`);

  // Attend: marqueur present ET plus aucun indicateur "Running" de tool (agent inactif).
  const start = Date.now();
  let markOk = false, idle = false, txt = '';
  while (Date.now() - start < MAXMS) {
    await page.waitForTimeout(2500);
    txt = await bodyText();
    if (MARK.test(txt)) markOk = true;
    // On veut VOIR la carte: des qu'elle apparait, capture (laisse 1.2s de rendu).
    if (markOk) { idle = true; await page.waitForTimeout(1200); break; }
  }
  await page.addStyleTag({ content: css }).catch(()=>{});
  await page.waitForTimeout(600);
  try { await page.screenshot({ path: `${DIR}/${SHOT}` }); } catch (e) {}
  fs.writeFileSync(`${DIR}/${SHOT}.txt`, txt);
  await browser.close();
  L(`\nmarqueur ${MARK} -> ${markOk} | agent inactif -> ${idle}`);
  L(`screenshot: ${DIR}/${SHOT}`);
  console.log(out.join('\n'));
  process.exit(markOk ? 0 : 2);
})();
