// Harnais Playwright — teste les 5 PILIERS AG-UI en une session, parle a Philippe.
// Usage: NODE_PATH=/tmp/copilot-debug/node_modules node scripts/headless-piliers.js [url]
// Capture une PREUVE par pilier + screenshot. Continue meme si un pilier echoue.

const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://10.0.0.1:8083/demo';
const SHOT = '/tmp/copilot-debug/piliers.png';

const out = [];
const L = (s) => { out.push(s); };
const api = []; // requetes /api/copilotkit avec phase

const R = { readable: '?', action: '?', hitl: '?', textarea: '?', genui: '?' };
let phase = 'init';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const autosug = []; // P4: appels reels d'autosuggestion (route dediee /api/autosuggest)
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));
  page.on('response', async r => {
    if (r.url().includes('/api/copilotkit')) api.push({ phase, status: r.status() });
    if (r.url().includes('/api/autosuggest')) {
      let sugLen = -1;
      try { sugLen = ((await r.json()).suggestion || '').length; } catch (e) {}
      autosug.push({ status: r.status(), sugLen });
      L(`  [P4 autosuggest] status=${r.status()} sugLen=${sugLen}`);
    }
  });
  // diagnostic: toute requete POST pendant la phase textarea
  page.on('request', req => {
    if (phase === 'textarea' && req.method() === 'POST') {
      L(`  [P4 POST] ${req.url().replace('http://10.0.0.1:8083', '')}`);
    }
  });

  // helpers ---------------------------------------------------------------
  const chatInput = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();

  async function assistantTexts() {
    let t = await page.locator('.copilotKitAssistantMessage').allInnerTexts().catch(() => []);
    if (!t.length) t = await page.locator('.copilotKitMessages').allInnerTexts().catch(() => []);
    return t;
  }

  async function ask(msg, waitMs = 60000, predicate = null) {
    const inp = chatInput();
    await inp.waitFor({ state: 'visible', timeout: 8000 });
    const avant = (await assistantTexts()).length; // nb de messages assistant AVANT
    await inp.fill(msg);
    await inp.press('Enter');
    L(`  → demande: "${msg}"`);
    const start = Date.now();
    let last = '';
    while (Date.now() - start < waitMs) {
      await page.waitForTimeout(1500);
      const txts = await assistantTexts();
      // la VRAIE reponse = un nouveau message assistant apparu apres l'envoi
      last = txts.length > avant ? txts[txts.length - 1] : '';
      const body = await page.locator('body').innerText().catch(() => '');
      if (predicate && predicate(last, body, txts)) return { ok: true, reply: last };
    }
    return { ok: false, reply: last };
  }

  // navigation ------------------------------------------------------------
  L(`=== NAVIGATION ${URL} ===`);
  try { await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); }
  catch (e) { L(`[GOTO] ${e.message}`); }
  await page.waitForTimeout(2500);

  // ouvrir le chat
  const launcher = page.locator('.copilotKitButton').first();
  if (!(await chatInput().isVisible().catch(() => false))) {
    if (await launcher.count()) { await launcher.click(); await page.waitForTimeout(1500); }
  }
  L(`Chat input visible: ${await chatInput().isVisible().catch(() => false)}`);

  // ===== PILIER 1 — useCopilotReadable ==================================
  phase = 'readable';
  L('\n=== PILIER 1 — useCopilotReadable ===');
  try {
    // bouton Deslauriers DANS la section readable (1er de la page)
    const btn = page.getByRole('button', { name: 'Deslauriers' }).first();
    await btn.click();
    await page.waitForTimeout(600);
    // l'etat expose doit afficher Deslauriers dans la statusCard
    const exposeOK = await page.locator('text=Contexte exposé à Hermes').isVisible().catch(() => false);
    L(`  Bouton Deslauriers clique (section readable). Etat expose visible: ${exposeOK}`);
    const r = await ask(
      'Quel client est actuellement sélectionné dans la page ? Réponds uniquement par le nom du client.',
      45000,
      (reply) => /deslauriers/i.test(reply)
    );
    L(`  Reponse Philippe: "${(r.reply || '').slice(0, 160)}"`);
    R.readable = r.ok ? 'PASS' : 'FAIL';
  } catch (e) { L(`  [ERR] ${e.message}`); R.readable = 'FAIL'; }

  // ===== PILIER 2 — Frontend Action (ouvrir_facture) ===================
  phase = 'action';
  L('\n=== PILIER 2 — Frontend Action ===');
  try {
    const pred = (reply, body) =>
      body.includes('AG-UI·MECG') ||
      (body.includes('Deslauriers') && !body.includes('Aucune facture ouverte'));
    let r = await ask('Ouvre la facture FAC-1042 dans le panneau.', 50000, pred);
    if (!r.ok) {
      L('  (retry P2 — relance explicite de l\'outil frontend)');
      r = await ask('Appelle l\'outil ouvrir_facture pour la facture FAC-1042.', 50000, pred);
    }
    const carte = (await page.locator('body').innerText().catch(() => '')).includes('AG-UI·MECG');
    const panneau = !(await page.locator('text=Aucune facture ouverte').isVisible().catch(() => true));
    L(`  Carte rendue: ${carte} | Panneau rempli: ${panneau}`);
    L(`  Reponse Philippe: "${(r.reply || '').slice(0, 160)}"`);
    R.action = (r.ok || panneau || carte) ? 'PASS' : 'FAIL';
    R.genui = (carte || panneau) ? 'PASS' : R.genui; // render de l'action = generative UI
  } catch (e) { L(`  [ERR] ${e.message}`); R.action = 'FAIL'; }

  // ===== PILIER 3 — Human-in-the-Loop (confirmer_relance) =============
  phase = 'hitl';
  L('\n=== PILIER 3 — Human-in-the-Loop ===');
  const approuver = page.getByRole('button', { name: 'Approuver' }).first();
  const carteVue = async () => approuver.isVisible().catch(() => false);
  try {
    const msgs = [
      'Je veux envoyer une relance de paiement à Deslauriers pour 3 480,00 $. Demande-moi d\'approuver avant d\'envoyer quoi que ce soit.',
      'Appelle l\'outil confirmer_relance pour Deslauriers, montant 3 480,00 $.',
      'Utilise l\'outil frontend confirmer_relance maintenant (client Deslauriers, 3 480,00 $).',
    ];
    let carteHITL = false;
    for (const m of msgs) {
      await ask(m, 35000, (reply, body) => body.includes('Approuver'));
      carteHITL = await carteVue();
      if (carteHITL) break;
      L('  (retry P3 — outil non appele, relance explicite)');
    }
    L(`  Carte HITL (boutons Approuver/Refuser) visible: ${carteHITL}`);
    if (carteHITL) {
      // clic DOM direct sur le bouton React (bypass overlay section / z-index)
      await approuver.evaluate(el => el.click());
      await page.waitForTimeout(3500);
      const body = await page.locator('body').innerText().catch(() => '');
      const journalOK = body.includes('Approuvé'); // entree journal
      const traite = body.includes('Traité') || body.includes('Décision soumise'); // carte a recu respond()
      L(`  Apres clic Approuver — journal "Approuvé": ${journalOK} | carte "Traité": ${traite}`);
      R.hitl = (journalOK || traite) ? 'PASS' : 'PARTIEL (carte OK, respond non confirme)';
    } else {
      L(`  Reponse Philippe (pas de carte): "${(r.reply || '').slice(0, 160)}"`);
      R.hitl = 'FAIL';
    }
  } catch (e) { L(`  [ERR] ${e.message}`); R.hitl = 'FAIL'; }

  // ===== PILIER 4 — CopilotTextarea ===================================
  phase = 'textarea';
  L('\n=== PILIER 4 — CopilotTextarea ===');
  try {
    // Fermer la popup chat pour qu'elle ne couvre pas la textarea (bas-droite).
    const closeBtn = page.locator('.copilotKitHeader button, button[aria-label*="lose"]').first();
    if (await closeBtn.count()) { await closeBtn.click({ force: true }).catch(() => {}); }
    else { await launcher.click({ force: true }).catch(() => {}); }
    await page.waitForTimeout(800);

    // CopilotTextarea = editeur Slate avec data-testid stable.
    let ta = page.locator('[data-testid="copilot-textarea-editable"]').first();
    if (!(await ta.count())) ta = page.locator('[contenteditable="true"]').first();
    const taN = await ta.count();
    L(`  Editeur CopilotTextarea trouve: ${taN}`);
    await ta.scrollIntoViewIfNeeded();
    await ta.click({ force: true });
    await page.waitForTimeout(400);
    const apiAvant = api.filter(a => a.phase === 'textarea').length;

    // CLE P4: CDP Input.insertText passe par le pipeline beforeinput natif du
    // navigateur -> Slate met a jour sa selection (curseur collapsed reel) ->
    // getTextAroundCollapsedCursor() retourne une valeur -> le debounce d'autosuggestion
    // tire un fetch. page.keyboard.type ne suffit pas (selection Slate non etablie).
    const cdp = await page.context().newCDPSession(page);
    const phrase = 'Bonjour, suite a notre suivi je vous ecris au sujet de la facture impayee afin';
    for (const ch of phrase) {
      await cdp.send('Input.insertText', { text: ch });
      await page.waitForTimeout(45);
    }
    // pause finale SANS autre frappe -> laisse le debounce d'autosuggestion expirer
    const landed = await ta.innerText().catch(() => '');
    const compteur = (await page.locator('text=/\\d+ mots/').first().innerText().catch(() => '')) || 'absent';
    L(`  Texte saisi (len): ${(landed || '').length} | compteur React: ${compteur}`);
    await page.waitForTimeout(10000);
    let apiApres = api.filter(a => a.phase === 'textarea').length;
    let sugg = await page.locator('.copilotKitAutosuggestion, [class*="uggestion"]').count().catch(() => 0);
    // retry: une insertion supplementaire (nouveau input event) puis attente debounce
    if (apiApres - apiAvant === 0 && sugg === 0) {
      L('  (P4 retry — insertText additionnel)');
      for (const ch of ' de relance') {
        await cdp.send('Input.insertText', { text: ch });
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(9000);
      apiApres = api.filter(a => a.phase === 'textarea').length;
      sugg = await page.locator('.copilotKitAutosuggestion, [class*="uggestion"]').count().catch(() => 0);
    }
    const autosugOK = autosug.filter(a => a.status === 200 && a.sugLen > 0).length;
    L(`  Autosuggestions reelles (200 + texte): ${autosugOK} | elements suggestion DOM: ${sugg}`);
    R.textarea = (autosugOK > 0 || sugg > 0) ? 'PASS' : 'FAIL';
  } catch (e) { L(`  [ERR] ${e.message}`); R.textarea = 'FAIL'; }

  // capture finale
  try { await page.screenshot({ path: SHOT, fullPage: true }); L(`\nScreenshot: ${SHOT}`); } catch (e) {}

  await browser.close();

  L('\n========== VERDICT PAR PILIER ==========');
  L(`P1 useCopilotReadable : ${R.readable}`);
  L(`P2 Frontend Action    : ${R.action}`);
  L(`P3 Human-in-the-Loop  : ${R.hitl}`);
  L(`P4 CopilotTextarea    : ${R.textarea}`);
  L(`P5 Generative UI      : ${R.genui}`);
  L(`Appels API /api/copilotkit total: ${api.length} (${api.filter(a => a.status >= 500).length} en 5xx)`);

  // ===== RÈGLE D'OR — voir avec les yeux =====
  // Un status 200 ne prouve PAS le rendu navigateur. Le verdict ci-dessus est une
  // preuve MACHINE. La preuve VISUELLE exige d'OUVRIR le PNG avec l'outil Read.
  L('\n=====================================================');
  L('PREUVE VISUELLE OBLIGATOIRE — NE PAS CONCLURE SUR LES 200 SEULS');
  L("OUVRE CE SCREENSHOT AVEC L'OUTIL Read ET REGARDE-LE :");
  L(`    ${SHOT}`);
  L("Un 200 serveur ne garantit pas que le panneau/carte/suggestion s'affiche.");
  L('=====================================================');

  console.log(out.join('\n'));
  const allPass = Object.values(R).every(v => v === 'PASS');
  process.exit(allPass ? 0 : 1);
})();
