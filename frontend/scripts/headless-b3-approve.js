// B3 chemin APPROUVER -> envoi RÉEL (V2). Destinataire de TEST = justin@mecg.ca (sûr).
// Déclenche confirmer_relance, clique Approuver, vérifie carte 'Traité' + accusé Philippe.
const { launch, openChat, send, bodyText, force } = require('./v2-helpers');
const fs = require('fs');
const URL = process.argv[2] || 'http://10.0.0.1:8083/';
const DIR = '/tmp/copilot-debug';
const out = []; const L = (s) => out.push(s);

(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await openChat(page);

  // TEST: relance dirigée vers justin@mecg.ca (pas le vrai client). Anti-lookup
  // Zoho pour déclencher confirmer_relance tout de suite.
  await send(page, "Ne fais AUCUNE recherche Zoho. Demande-moi tout de suite l'approbation (confirmer_relance) pour une relance a Ramada de 2 109,79 $. Si j'approuve, envoie le courriel de relance UNIQUEMENT a justin@mecg.ca (test, surtout pas au client).");
  L('→ relance TEST -> justin@mecg.ca (sans lookup Zoho)');

  let carte = false; const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    await page.waitForTimeout(2000);
    if (/Approbation requise/i.test(await bodyText(page))) { carte = true; break; }
  }
  L(`carte approbation: ${carte}`);

  // clic Approuver, retry ~15s (la carte reste en executing jusqu'au respond)
  let clicked = false; const tBtn = Date.now();
  while (Date.now() - tBtn < 15000 && !clicked) {
    const btn = page.getByRole('button', { name: /Approuver/i }).first();
    if (await btn.count()) { await btn.dispatchEvent('click').catch(e => L(`[clic] ${e.message}`)); clicked = true; break; }
    await page.waitForTimeout(1500);
  }
  L(`clic Approuver: ${clicked}`);

  // transition carte 'Traité' (respond('approuve') parti) puis accusé de Philippe
  let traite = false, txt = ''; const t1 = Date.now();
  while (Date.now() - t1 < 120000) {
    await page.waitForTimeout(3000);
    txt = await bodyText(page);
    if (/Trait[ée]/.test(txt) || /Approuvé/.test(txt) || /Décision soumise/.test(txt)) { traite = true; break; }
  }
  // laisse Philippe finir l'envoi côté serveur (NE PAS fermer le SSE trop tôt,
  // sinon turn2 = interrupted_during_api_call avant la fin de l'envoi courriel)
  await page.waitForTimeout(35000);
  txt = await bodyText(page);
  await force(page);
  await page.screenshot({ path: `${DIR}/prod-b3-approve.png` }).catch(() => {});
  fs.writeFileSync(`${DIR}/prod-b3-approve.txt`, txt);
  await browser.close();

  L(`carte 'Traité'/round-trip: ${traite}`);
  L(`screenshot: ${DIR}/prod-b3-approve.png`);
  console.log(out.join('\n'));
  process.exit(carte && clicked && traite ? 0 : 2);
})();
