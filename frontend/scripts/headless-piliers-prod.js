// Preuve E2E PROD (/ -> vrai Philippe/Hermes) des piliers branches sur vraies donnees.
// B2 ouvrir_facture | B1 afficher_carte (vraies donnees) | B3 confirmer_relance (HITL, clic REFUSER = aucun courriel).
// Usage: NODE_PATH=/tmp/copilot-debug/node_modules node scripts/headless-piliers-prod.js
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.argv[2] || 'http://10.0.0.1:8083/';
const DIR = '/tmp/copilot-debug';
const out = [];
const L = (s) => { out.push(s); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));

  // Force la popup CopilotKit visible (reste a opacity:0 en headless).
  await page.addStyleTag({ content: `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;visibility:visible !important;}` }).catch(()=>{});

  const chatInput = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();
  const messages = () => page.locator('.copilotKitMessages');
  const bodyText = () => page.locator('body').innerText().catch(()=> '');

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await page.addStyleTag({ content: `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;visibility:visible !important;}` }).catch(()=>{});
  await page.waitForTimeout(1500);

  const launcher = page.locator('.copilotKitButton').first();
  if (!(await chatInput().isVisible().catch(() => false)) && await launcher.count()) {
    await launcher.click(); await page.waitForTimeout(1500);
  }
  await chatInput().waitFor({ state: 'visible', timeout: 10000 });

  // Helper: envoie un message, attend qu'un marqueur apparaisse (dans body), screenshot.
  async function tour(msg, marqueurRe, shot, maxMs = 120000) {
    const inp = chatInput();
    await inp.fill(msg); await inp.press('Enter');
    L(`\n→ ${msg}`);
    const start = Date.now();
    let ok = false, txt = '';
    while (Date.now() - start < maxMs) {
      await page.waitForTimeout(2500);
      txt = await bodyText();
      if (marqueurRe.test(txt)) { ok = true; break; }
    }
    await page.addStyleTag({ content: `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;}` }).catch(()=>{});
    await page.waitForTimeout(400);
    try { await page.screenshot({ path: `${DIR}/${shot}` }); } catch (e) {}
    L(`   marqueur ${marqueurRe} -> ${ok}`);
    return { ok, txt };
  }

  const res = {};

  // --- B2: ouvrir une vraie facture. Marqueur = nom client reel (non tape par l'user). ---
  res.b2 = await tour(
    'Ouvre la facture FAC-2301.',
    /Ramada|Manoir|Casino/i,
    'prod-b2-facture.png'
  );

  // --- B1: carte avec vraies donnees comptes a recevoir. Marqueur = carte rendue (●). ---
  res.b1 = await tour(
    'Montre-moi une carte resume de mes comptes a recevoir (top 3 factures impayees).',
    /●\s*(info|ok|attention)/i,
    'prod-b1-carte.png'
  );

  // --- B3: HITL. Declenche la carte d'approbation. Marqueur = "Approbation requise". ---
  res.b3card = await tour(
    'Prepare une relance de paiement pour Ramada Plaza Manoir du Casino pour 2 109,79 $.',
    /Approbation requise/i,
    'prod-b3-approbation.png'
  );

  // --- B3 round-trip SANS courriel: clic REFUSER -> decision 'refuse' revient a Philippe. ---
  let b3refus = false;
  try {
    const btn = page.getByRole('button', { name: /Refuser/i }).first();
    if (await btn.count()) {
      await btn.click();
      const start = Date.now();
      while (Date.now() - start < 60000) {
        await page.waitForTimeout(2500);
        const t = await bodyText();
        // journal montre "Refusé" ET/OU Philippe confirme ne pas envoyer
        if (/Refus[ée]/i.test(t)) { b3refus = true; break; }
      }
    }
    await page.addStyleTag({ content: `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;}` }).catch(()=>{});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/prod-b3-refuse.png` });
  } catch (e) { L(`[B3 refus] ${e.message}`); }
  res.b3roundtrip = b3refus;

  const finalTxt = await bodyText();
  fs.writeFileSync(`${DIR}/prod-piliers-dom.txt`, finalTxt);
  await browser.close();

  L('\n========== RESULTAT PILIERS PROD ==========');
  L(`B2 ouvrir_facture (vraie donnee client):  ${res.b2.ok}`);
  L(`B1 afficher_carte (carte rendue):         ${res.b1.ok}`);
  L(`B3 carte d'approbation rendue:            ${res.b3card.ok}`);
  L(`B3 round-trip decision (refuse -> agent): ${res.b3roundtrip}`);
  console.log(out.join('\n'));
  const allOk = res.b2.ok && res.b1.ok && res.b3card.ok && res.b3roundtrip;
  process.exit(allOk ? 0 : 1);
})();
