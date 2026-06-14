// Test ciblé PROD (/ -> Hermes) : pilier Generative UI "afficher_carte".
// Garde la popup OUVERTE, screenshot au moment de la reponse, detecte le rendu carte.
// Usage: NODE_PATH=/tmp/copilot-debug/node_modules node scripts/headless-carte-prod.js
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.argv[2] || 'http://10.0.0.1:8083/';
const SHOT = '/tmp/copilot-debug/carte-prod.png';
const out = [];
const L = (s) => out.push(s);

let toolBack = false; // afficher_carte revient dans une reponse runtime ?

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));
  page.on('response', async r => {
    if (!r.url().includes('/api/copilotkit')) return;
    try { if ((await r.text()).includes('afficher_carte')) toolBack = true; } catch (e) {}
  });

  const chatInput = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();
  const messages = () => page.locator('.copilotKitMessages');

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await page.waitForTimeout(2000);

  // ouvrir la popup UNE fois
  const launcher = page.locator('.copilotKitButton').first();
  if (!(await chatInput().isVisible().catch(() => false)) && await launcher.count()) {
    await launcher.click(); await page.waitForTimeout(1500);
  }
  const inp = chatInput();
  await inp.waitFor({ state: 'visible', timeout: 8000 });

  const MSG = 'Montre-moi une carte de démo avec 3 lignes: Nom: Justin, Rôle: Propriétaire, Entreprise: MECG';
  await inp.fill(MSG); await inp.press('Enter');
  L(`→ envoye: "${MSG}"`);

  // attendre le rendu carte (marqueur ●) OU une reponse texte; NE PAS refermer
  const start = Date.now();
  let cardInDom = false, mtxt = '';
  while (Date.now() - start < 90000) {
    await page.waitForTimeout(2000);
    mtxt = await messages().innerText().catch(() => '');
    // DemoCard rend une ligne "● info/ok/attention" — absente du message user
    cardInDom = /●\s*(info|ok|attention)/i.test(mtxt);
    if (cardInDom) {
      // screenshot IMMEDIAT, popup ouverte, avant tout risque de fermeture
      try { await page.screenshot({ path: SHOT }); } catch (e) {}
      try { await messages().screenshot({ path: '/tmp/copilot-debug/carte-element.png' }); } catch (e) {}
      break;
    }
    // une vraie reponse texte longue sans carte = echec (Philippe a improvise)
    const after = mtxt.split(MSG).pop() || '';
    if (after.replace(/\s/g, '').length > 60 && !/●/.test(after)) break;
  }

  // screenshot POPUP OUVERTE, sans rien refermer
  await page.waitForTimeout(500);
  try { await page.screenshot({ path: SHOT }); } catch (e) {}
  fs.writeFileSync('/tmp/copilot-debug/messages-dom.txt', mtxt || '(vide)');
  await browser.close();

  L('\n========== RESULTAT ==========');
  L(`afficher_carte revenu dans une reponse runtime: ${toolBack}`);
  L(`Carte (marqueur ●) rendue dans la popup:        ${cardInDom}`);
  L(`\n--- texte messages popup (700c) ---\n${(mtxt || '').slice(0, 700)}`);
  L(`\nScreenshot: ${SHOT}  | DOM complet: /tmp/copilot-debug/messages-dom.txt`);
  console.log(out.join('\n'));
  process.exit(cardInDom ? 0 : 1);
})();
