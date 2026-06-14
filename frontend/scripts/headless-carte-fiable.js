// DoD fiabilisation afficher_carte:
//  (1) "carte de mes comptes a recevoir (top 3)" -> carte rendue (footer "● statut")
//  (2) question conversationnelle simple -> TEXTE, PAS de NOUVELLE carte (anti sur-declenchement)
const { launch, bodyText, force, openChat, send, waitReply, chatText } = require('./v2-helpers');

const CARD_RE = /●\s*(info|ok|attention)/gi;
const countCards = (s) => (s.match(CARD_RE) || []).length;

// Attend qu'une NOUVELLE carte apparaisse (compte > baseline), patient (fetch Zoho lent).
async function waitCard(page, baseline, maxMs = 200000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(2500);
    if (countCards(await bodyText(page)) > baseline) return true;
  }
  return false;
}

(async () => {
  const { browser, page } = await launch();
  try {
    await page.goto('http://10.0.0.1:8083/', { waitUntil: 'networkidle', timeout: 30000 });
    await openChat(page);

    // (1) doit RENDRE une carte
    const base1 = countCards(await bodyText(page));
    await send(page, 'Montre-moi une carte resume de mes comptes a recevoir (top 3 factures impayees).');
    const card1 = await waitCard(page, base1);
    await force(page); await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/copilot-debug/carte-fiable-1.png' });

    // (2) question conversationnelle -> NE DOIT PAS ajouter de carte
    const base2 = countCards(await bodyText(page));
    const chatBase = (await chatText(page)).length;
    await send(page, 'En une phrase, c\'est quoi ton role aupres de moi ?');
    await waitReply(page, chatBase, { quiet: 3, poll: 2500, max: 120000 });
    await page.waitForTimeout(2000);
    const card2 = countCards(await bodyText(page)) > base2;
    await force(page); await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/copilot-debug/carte-fiable-2.png' });

    console.log('TOUR1_CARTE_RENDUE=' + card1);
    console.log('TOUR2_PAS_DE_CARTE=' + !card2);
    process.exit(card1 && !card2 ? 0 : 1);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
