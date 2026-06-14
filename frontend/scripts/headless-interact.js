// Harnais Playwright INTERACTIF — parle a Philippe et capture le rendu reel
// Usage: node scripts/headless-interact.js [url] [message]
// Defaut: http://10.0.0.1:8083/demo  "Ouvre la facture FAC-1042"
//
// Capture: console, pageerror, requetes /api/copilotkit, le panneau facture (DOM),
// et un screenshot PNG dans /tmp/copilot-debug/shot.png
// Exit 0 = action reussie (panneau facture rempli), 1 = echec

const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://10.0.0.1:8083/demo';
const MESSAGE = process.argv[3] || 'Ouvre la facture FAC-1042';
const SHOT = '/tmp/copilot-debug/shot.png';

const log = [];
function L(s) { log.push(s); }

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let erreurs = 0;

  page.on('console', m => L(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', e => { erreurs++; L(`[PAGEERROR] ${e.message}`); });
  page.on('requestfailed', r => L(`[REQ FAILED] ${r.method()} ${r.url()}`));

  // Capture des reponses de l'API CopilotKit (corps inclus pour voir les erreurs)
  page.on('response', async resp => {
    const u = resp.url();
    const s = resp.status();
    if (u.includes('/api/copilotkit') || u.includes('/api/clientlog')) {
      let body = '';
      try { body = (await resp.text()).slice(0, 400); } catch (e) {}
      L(`[API ${s}] ${u}\n   -> ${body.replace(/\n/g, ' ')}`);
      if (s >= 500) erreurs++;
    } else if (s >= 500) {
      erreurs++; L(`[HTTP ${s}] ${u}`);
    }
  });

  L(`=== NAVIGATION: ${URL} ===`);
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) { L(`[GOTO ERROR] ${e.message}`); }
  await page.waitForTimeout(2500);

  // 1. Ouvrir la popup CopilotKit (launcher dedie UNIQUEMENT)
  L('=== OUVERTURE DU CHAT ===');
  const popupInput = page.locator('.copilotKitWindow textarea, .copilotKitInput textarea');
  // Le launcher CopilotPopup
  const launcher = page.locator('.copilotKitButton').first();
  try {
    // Si l'input du chat n'est pas deja visible, cliquer le launcher
    const inputVisible = await popupInput.first().isVisible().catch(() => false);
    if (!inputVisible) {
      if (await launcher.count() > 0) {
        await launcher.click();
        L('Launcher CopilotKit clique.');
      } else {
        L('[WARN] Aucun .copilotKitButton trouve.');
      }
      await page.waitForTimeout(1500);
    } else {
      L('Chat deja ouvert.');
    }
  } catch (e) { L(`[LAUNCHER] ${e.message}`); }

  // 2. Saisie — STRICTEMENT dans l'input du chat CopilotKit
  L('=== SAISIE DU MESSAGE ===');
  const input = popupInput.first();
  try {
    await input.waitFor({ state: 'visible', timeout: 8000 });
    await input.fill(MESSAGE);   // fill focus l'element sans clic (evite l'interception)
    L(`Message tape dans le chat: "${MESSAGE}"`);
    const sendBtn = page.locator('.copilotKitSendButton, button[data-copilotkit-send]').first();
    if (await sendBtn.count() > 0) {
      await sendBtn.click();
      L('Envoi via bouton CopilotKit.');
    } else {
      await input.press('Enter');
      L('Envoi via Enter.');
    }
  } catch (e) {
    L(`[INPUT ERROR — popup chat introuvable] ${e.message}`);
    erreurs++;
  }

  // 3. Attendre la reponse de Hermes + l'execution de l'action (panneau rempli)
  L('=== ATTENTE REPONSE HERMES (max 45s) ===');
  let actionOK = false;
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const bodyTxt = await page.locator('body').innerText().catch(() => '');
    // Succes = la carte AG-UI catch-all a rendu un tool-call de Hermes dans le chat
    // (marqueur stable "AG-UI·MECG"), OU le panneau Frontend Action est rempli.
    const carteAGUI = bodyTxt.includes('AG-UI·MECG');
    const panneauRempli =
      bodyTxt.includes('Deslauriers') && !bodyTxt.includes('Aucune facture ouverte');
    if (carteAGUI || panneauRempli) {
      actionOK = true;
      L(`Rendu detecte apres ~${i + 1}s — carteAGUI=${carteAGUI}, panneauRempli=${panneauRempli}.`);
      break;
    }
  }
  if (!actionOK) L('Aucun rendu detecte dans le delai (ni carte AG-UI ni panneau rempli).');

  // 4. Capturer le panneau facture + screenshot
  await page.waitForTimeout(800);
  const panelText = await page.locator('body').innerText().catch(() => '');
  L('=== TEXTE VISIBLE (extrait facture) ===');
  // On extrait les lignes autour de "Numero"/"Client"/"Montant"/"Statut"
  const lines = panelText.split('\n').map(s => s.trim()).filter(Boolean);
  const idx = lines.findIndex(l => /Frontend Action/i.test(l));
  L(lines.slice(Math.max(0, idx), idx + 25).join(' | '));

  // Reponse de Philippe dans le chat
  L('=== REPONSE DE PHILIPPE (chat) ===');
  const chatTxt = await page.locator('.copilotKitMessages, .copilotKitMessage').allInnerTexts().catch(() => []);
  L(chatTxt.join('\n---\n').slice(0, 800) || '(aucun message chat capture)');

  try {
    await page.screenshot({ path: SHOT, fullPage: true });
    L(`Screenshot: ${SHOT}`);
  } catch (e) { L(`[SHOT ERROR] ${e.message}`); }

  await browser.close();
  console.log(log.join('\n'));
  console.log('');
  if (actionOK && erreurs === 0) {
    console.log('RESULTAT: SUCCES — action executee, 0 erreur');
    process.exit(0);
  } else {
    console.log(`RESULTAT: ECHEC — actionOK=${actionOK}, erreurs=${erreurs}`);
    process.exit(1);
  }
})();
