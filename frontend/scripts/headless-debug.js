// Harnais Playwright headless — auto-debug copilot-ui
// Usage: node scripts/headless-debug.js [url]
// Exit code 0 = propre, 1 = au moins un PAGEERROR ou HTTP>=500

const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'http://10.0.0.1:8083/';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const logs = [];
  let erreurs = 0;

  // Capture des messages console
  page.on('console', msg => {
    logs.push(`[console.${msg.type()}] ${msg.text()}`);
  });

  // Erreurs JavaScript non capturées — compte comme erreur
  page.on('pageerror', err => {
    erreurs++;
    logs.push(`[PAGEERROR] ${err.message}\n${err.stack || ''}`);
  });

  // Requêtes réseau échouées (DNS, connexion refusée, etc.)
  page.on('requestfailed', req => {
    logs.push(`[REQ FAILED] ${req.method()} ${req.url()}`);
  });

  // Réponses HTTP — erreurs 4xx loggées, 5xx comptées comme erreurs
  page.on('response', resp => {
    const status = resp.status();
    if (status >= 500) {
      erreurs++;
      logs.push(`[HTTP ${status}] ${resp.url()}`);
    } else if (status >= 400) {
      logs.push(`[HTTP ${status}] ${resp.url()}`);
    }
  });

  // Navigation
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    logs.push(`[GOTO ERROR] ${e.message}`);
  }

  // Attente supplémentaire pour laisser les effets de bord s'exécuter
  await page.waitForTimeout(4000);

  // Capture du texte visible (premiers 500 chars)
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
  logs.push(`[BODY TEXT]\n${bodyText}`);

  await browser.close();

  // Affichage de tous les logs
  console.log(logs.join('\n'));
  console.log('');

  // Résumé final
  if (erreurs === 0) {
    console.log('RESULTAT: PROPRE');
    process.exit(0);
  } else {
    console.log(`RESULTAT: ${erreurs} erreur(s)`);
    process.exit(1);
  }
})();
