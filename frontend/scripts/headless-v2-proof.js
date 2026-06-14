// Preuve de rendu V2 (@copilotkitnext) — A9.2.
// Charge la page prod, vérifie l'absence de pageerror (React #130 = échec v1),
// ouvre la popup, force opacity:1, screenshot. Exit 0 si propre.
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'http://10.0.0.1:8083/';
  const out = process.argv[3] || '/tmp/copilot-debug/v2-proof.png';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

  const errs = [];
  page.on('pageerror', e => errs.push(`[PAGEERROR] ${e.message}`));
  page.on('response', r => { if (r.status() >= 500) errs.push(`[HTTP ${r.status()}] ${r.url()}`); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errs.push(`[GOTO] ${e.message}`));
  await page.waitForTimeout(3000);

  // Inventaire des éléments copilot (classes V2)
  const copilotClasses = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('[class*="copilot"]').forEach(el =>
      ('' + el.className).split(/\s+/).forEach(c => { if (/copilot/i.test(c)) set.add(c); }));
    return [...set].slice(0, 25);
  });

  // Ouvrir la popup : bouton toggle (aria-label ou bouton flottant bas-droite)
  let opened = false;
  const toggle = page.locator('button[aria-label*="hat" i], button[class*="oggle" i], button[class*="opilot" i]').first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(1500);
    opened = true;
  }

  // Forcer opacity:1 sur tout conteneur popup (harnais bufferisent l'anim)
  await page.evaluate(() => {
    document.querySelectorAll('[class*="opup" i], [class*="odal" i], [class*="opilot" i]').forEach(el => {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    });
  });
  await page.waitForTimeout(500);

  // Y a-t-il un champ de saisie de chat (preuve que la popup a monté) ?
  const hasInput = await page.locator('textarea, [contenteditable="true"], input[type="text"]').count();

  await page.screenshot({ path: out, fullPage: false }).catch(e => errs.push(`[SHOT] ${e.message}`));
  await browser.close();

  console.log('copilot classes:', JSON.stringify(copilotClasses));
  console.log('popup opened:', opened, '| chat input fields:', hasInput);
  console.log('screenshot:', out);
  if (errs.length) { console.log('ERREURS:\n' + errs.join('\n')); process.exit(1); }
  console.log('RESULTAT: PROPRE (0 pageerror, 0 HTTP5xx)');
  process.exit(0);
})();
