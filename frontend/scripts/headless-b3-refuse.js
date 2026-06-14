// B3 round-trip SANS courriel (V2): déclenche confirmer_relance (useHumanInTheLoop),
// clique REFUSER, vérifie que 'refuse' revient à Philippe (carte "Traité"/journal "Refusé").
// 0 courriel envoyé. Sélecteurs V2 via v2-helpers.
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

  await send(page, 'Envoie une relance de paiement a Ramada Plaza Manoir du Casino pour 2 109,79 $.');
  L('→ relance Ramada 2 109,79 $');

  // attend la carte d'approbation (texte de la carte HITL)
  let carte = false; const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    await page.waitForTimeout(2500);
    if (/Approbation requise/i.test(await bodyText(page))) { carte = true; break; }
  }
  L(`carte approbation: ${carte}`);

  // clic REFUSER via dispatchEvent (fiable en headless). Retry ~15s: la carte
  // reste désormais en "executing" (boutons présents) jusqu'au respond().
  let clicked = false;
  const tBtn = Date.now();
  while (Date.now() - tBtn < 15000 && !clicked) {
    const btn = page.getByRole('button', { name: /Refuser/i }).first();
    if (await btn.count()) {
      await btn.dispatchEvent('click').catch(e => L(`[clic] ${e.message}`));
      clicked = true;
      break;
    }
    await page.waitForTimeout(1500);
  }
  L(`clic Refuser: ${clicked}`);

  // marqueur: carte -> "Traité"/"Décision soumise" OU journal pill "Refusé"
  let refuse = false, txt = ''; const t1 = Date.now();
  while (Date.now() - t1 < 60000) {
    await page.waitForTimeout(2500);
    txt = await bodyText(page);
    if (/Trait[ée]/.test(txt) || /\bRefusé\b/.test(txt) || /Décision soumise/.test(txt)) { refuse = true; break; }
  }
  await force(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/prod-b3-refuse.png` }).catch(() => {});
  fs.writeFileSync(`${DIR}/prod-b3-refuse.txt`, txt);
  await browser.close();

  L(`round-trip 'refuse': ${refuse}`);
  L(`screenshot: ${DIR}/prod-b3-refuse.png`);
  console.log(out.join('\n'));
  process.exit(carte && clicked && refuse ? 0 : 2);
})();
