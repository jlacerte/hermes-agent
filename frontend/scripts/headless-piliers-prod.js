// Preuve E2E PROD V2 (/ -> vrai Philippe/Hermes) des piliers branches sur vraies donnees.
// P2 ouvrir_facture | P5 afficher_carte (vraies donnees) | P3 confirmer_relance (HITL, clic REFUSER = aucun courriel).
// Selecteurs V2 (@copilotkitnext) via v2-helpers.js.
// Usage: NODE_PATH=$(pwd)/node_modules node scripts/headless-piliers-prod.js
const fs = require('fs');
const { launch, chatInput, bodyText, force, openChat, send } = require('./v2-helpers');
const URL = process.argv[2] || 'http://10.0.0.1:8083/';
const DIR = '/tmp/copilot-debug';
const out = [];
const L = (s) => { out.push(s); };

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const { browser, page } = await launch();
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await openChat(page);

  // Helper: envoie un message, attend qu'un marqueur apparaisse (dans body), screenshot.
  async function tour(msg, marqueurRe, shot, maxMs = 150000) {
    await send(page, msg);
    L(`\n→ ${msg}`);
    const start = Date.now();
    let ok = false, txt = '';
    while (Date.now() - start < maxMs) {
      await page.waitForTimeout(2500);
      txt = await bodyText(page);
      if (marqueurRe.test(txt)) { ok = true; break; }
    }
    await force(page);
    await page.waitForTimeout(400);
    try { await page.screenshot({ path: `${DIR}/${shot}` }); } catch (e) {}
    L(`   marqueur ${marqueurRe} -> ${ok}`);
    return { ok, txt };
  }

  const res = {};

  // --- P2: ouvrir une vraie facture. Marqueur = nom client reel (non tape par l'user). ---
  res.b2 = await tour(
    'Ouvre la facture FAC-2301.',
    /Ramada|Manoir|Casino/i,
    'prod-b2-facture.png'
  );

  // --- P5: carte avec vraies donnees comptes a recevoir. Marqueur = carte rendue (●). ---
  res.b1 = await tour(
    'Montre-moi une carte resume de mes comptes a recevoir (top 3 factures impayees).',
    /●\s*(info|ok|attention)/i,
    'prod-b1-carte.png'
  );

  // --- P3: HITL. Declenche la carte d'approbation. Marqueur = "Approbation requise". ---
  res.b3card = await tour(
    'Prepare une relance de paiement pour Ramada Plaza Manoir du Casino pour 2 109,79 $.',
    /Approbation requise/i,
    'prod-b3-approbation.png'
  );

  // --- P3 round-trip SANS courriel: clic REFUSER -> decision 'refuse' revient a Philippe. ---
  let b3refus = false;
  try {
    const btn = page.getByRole('button', { name: /Refuser/i }).first();
    if (await btn.count()) {
      await btn.click();
      const start = Date.now();
      while (Date.now() - start < 60000) {
        await page.waitForTimeout(2500);
        const t = await bodyText(page);
        if (/Refus[ée]/i.test(t)) { b3refus = true; break; }
      }
    }
    await force(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/prod-b3-refuse.png` });
  } catch (e) { L(`[P3 refus] ${e.message}`); }
  res.b3roundtrip = b3refus;

  const finalTxt = await bodyText(page);
  fs.writeFileSync(`${DIR}/prod-piliers-dom.txt`, finalTxt);
  await browser.close();

  L('\n========== RESULTAT PILIERS PROD (V2) ==========');
  L(`P2 ouvrir_facture (vraie donnee client):  ${res.b2.ok}`);
  L(`P5 afficher_carte (carte rendue):         ${res.b1.ok}`);
  L(`P3 carte d'approbation rendue:            ${res.b3card.ok}`);
  L(`P3 round-trip decision (refuse -> agent): ${res.b3roundtrip}`);
  console.log(out.join('\n'));
  const allOk = res.b2.ok && res.b1.ok && res.b3card.ok && res.b3roundtrip;
  process.exit(allOk ? 0 : 1);
})();
