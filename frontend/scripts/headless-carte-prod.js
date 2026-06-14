// Test ciblé PROD (/ -> Hermès) : pilier Generative UI "afficher_carte" en V2.
// Garde la popup OUVERTE, screenshot au rendu, détecte la carte (marqueur ●).
const { launch, openChat, send, chatText, waitReply, force } = require('./v2-helpers');
const fs = require('fs');
const URL = process.argv[2] || 'http://10.0.0.1:8083/';
const SHOT = '/tmp/copilot-debug/carte-prod.png';
const out = []; const L = (s) => out.push(s);

let toolBack = false; // afficher_carte transite-t-il dans le flux AG-UI ?

(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));
  page.on('response', async r => {
    if (!r.url().includes('/api/copilotkit')) return;
    try { if ((await r.text()).includes('afficher_carte')) toolBack = true; } catch (e) {}
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await openChat(page);

  const MSG = 'Montre-moi une carte de démo avec 3 lignes: Nom: Justin, Rôle: Propriétaire, Entreprise: MECG';
  const base = (await chatText(page)).length;
  await send(page, MSG);
  L(`→ envoyé: "${MSG}"`);

  // CarteGenerique rend "● info/ok/attention" — absent du message user.
  let cardInDom = false, mtxt = ''; const start = Date.now();
  while (Date.now() - start < 120000) {
    await page.waitForTimeout(2000);
    mtxt = await chatText(page);
    if (/●\s*(info|ok|attention)/i.test(mtxt)) {
      cardInDom = true;
      await force(page);
      try { await page.screenshot({ path: SHOT }); } catch (e) {}
      break;
    }
  }
  if (!cardInDom) { await waitReply(page, base, { quiet: 2, max: 20000 }); mtxt = await chatText(page); }

  await force(page); await page.waitForTimeout(500);
  try { await page.screenshot({ path: SHOT }); } catch (e) {}
  fs.writeFileSync('/tmp/copilot-debug/carte-messages-dom.txt', mtxt || '(vide)');
  await browser.close();

  L('\n========== RESULTAT CARTE PROD (V2) ==========');
  L(`afficher_carte transité dans le flux AG-UI: ${toolBack}`);
  L(`Carte (marqueur ●) rendue dans la popup:    ${cardInDom}`);
  L(`\nScreenshot: ${SHOT}`);
  console.log(out.join('\n'));
  process.exit(cardInDom ? 0 : 1);
})();
