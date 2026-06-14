const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
  await page.goto('http://10.0.0.1:8083/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const launcher = page.locator('.copilotKitButton').first();
  const inp = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();
  if (!(await inp().isVisible().catch(() => false)) && await launcher.count()) { await launcher.click(); await page.waitForTimeout(1000); }
  await inp().fill('Montre-moi une carte de démo avec 3 lignes: Nom: Justin, Rôle: Propriétaire, Entreprise: MECG');
  await inp().press('Enter');
  let ok = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1500);
    const txt = await page.locator('.copilotKitMessages').innerText().catch(() => '');
    if (/●\s*(info|ok|attention)/i.test(txt)) { ok = true; break; }
  }
  // forcer l'opacite de la fenetre popup (animation headless bloquee a 0)
  await page.evaluate(() => {
    document.querySelectorAll('.copilotKitWindow,[class*="Window"]').forEach(e => { e.style.opacity = '1'; e.style.transition = 'none'; });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/copilot-debug/PROOF.png' });
  console.log('carte rendue =', ok);
  await browser.close();
})();
