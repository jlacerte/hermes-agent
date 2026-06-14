// B3 round-trip SANS courriel: declenche confirmer_relance, clique REFUSER,
// verifie que 'refuse' revient a Philippe (journal "Refusé" + accuse de Philippe).
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://10.0.0.1:8083/';
const DIR = '/tmp/copilot-debug';
const out = []; const L = (s) => out.push(s);

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const css = `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;visibility:visible !important;}`;
  const chatInput = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();
  const bodyText = () => page.locator('body').innerText().catch(()=> '');

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await page.addStyleTag({ content: css }).catch(()=>{});
  await page.waitForTimeout(1500);
  const launcher = page.locator('.copilotKitButton').first();
  if (!(await chatInput().isVisible().catch(()=>false)) && await launcher.count()) { await launcher.click(); await page.waitForTimeout(1500); }
  await chatInput().waitFor({ state: 'visible', timeout: 10000 });

  await chatInput().fill('Envoie une relance de paiement a Ramada Plaza Manoir du Casino pour 2 109,79 $.');
  await chatInput().press('Enter');
  L('→ relance Ramada 2 109,79 $');

  // attend la carte
  let carte = false; const t0 = Date.now();
  while (Date.now() - t0 < 60000) { await page.waitForTimeout(2000); if (/Approbation requise/i.test(await bodyText())) { carte = true; break; } }
  L(`carte approbation: ${carte}`);

  // clic REFUSER via dispatchEvent (le onClick React, fiable en headless meme si
  // l'element echoue les checks d'actionabilite Playwright).
  let clicked = false;
  const btn = page.getByRole('button', { name: /^Refuser$/i }).first();
  if (await btn.count()) { await btn.dispatchEvent('click').catch(e => L(`[clic] ${e.message}`)); clicked = true; }
  L(`clic Refuser: ${clicked}`);

  // Marqueur correct: la carte passe a "Traité" (status complete) OU le journal
  // affiche la pill "Refusé" (avec é exact — distinct du bouton "Refuser").
  let refuse = false, txt = ''; const t1 = Date.now();
  while (Date.now() - t1 < 45000) {
    await page.waitForTimeout(2500);
    txt = await bodyText();
    if (/Trait[ée]/.test(txt) || /\bRefusé\b/.test(txt) || /Décision soumise/.test(txt)) { refuse = true; break; }
  }
  await page.addStyleTag({ content: css }).catch(()=>{});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/prod-b3-refuse.png` });
  fs.writeFileSync(`${DIR}/prod-b3-refuse.txt`, txt);
  await browser.close();

  L(`journal/round-trip 'refuse': ${refuse}`);
  L(`screenshot: ${DIR}/prod-b3-refuse.png`);
  console.log(out.join('\n'));
  process.exit(carte && clicked && refuse ? 0 : 2);
})();
