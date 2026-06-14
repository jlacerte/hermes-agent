// Preuve E2E PROD du pilier P1 useCopilotReadable (contexte de page).
// Tour 1: ouvrir FAC-2301 -> le PANNEAU "FACTURE OUVERTE" se peuple (state facture != null)
//   => succès = "Aucune facture ouverte" DISPARAÎT du panneau (et donc readable a une valeur).
// Tour 2: demander le statut de "la facture ouverte" SANS redonner le numéro.
//   Marqueur SCOPÉ AU CHAT (.copilotKitMessages) pour éviter le texte statique du panneau gauche
//   (qui contient "Ramada"/"FAC-2301" en placeholder). Philippe ne peut nommer la bonne facture
//   que via le readable (il n'a plus le numéro pour re-interroger Zoho).
// Usage: NODE_PATH=/tmp/copilot-debug/node_modules node scripts/headless-readable-prod.js
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

  const force = () => page.addStyleTag({ content: `.copilotKitWindow,.copilotKitPopup{opacity:1 !important;visibility:visible !important;}` }).catch(()=>{});
  const chatInput = () => page.locator('.copilotKitInput textarea, .copilotKitWindow textarea').first();
  const bodyText = () => page.locator('body').innerText().catch(()=> '');
  const chatText = () => page.locator('.copilotKitMessages').innerText().catch(()=> '');

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await force();
  await page.waitForTimeout(1500);

  const launcher = page.locator('.copilotKitButton').first();
  if (!(await chatInput().isVisible().catch(() => false)) && await launcher.count()) {
    await launcher.click(); await page.waitForTimeout(1500);
  }
  await chatInput().waitFor({ state: 'visible', timeout: 10000 });

  // Envoie msg, attend que predicate(txtSource) soit vrai (txtSource = fn qui retourne le texte courant).
  async function tour(msg, predicate, txtSource, shot, maxMs = 150000) {
    const inp = chatInput();
    await inp.fill(msg); await inp.press('Enter');
    L(`\n→ ${msg}`);
    const start = Date.now();
    let ok = false, txt = '';
    while (Date.now() - start < maxMs) {
      await page.waitForTimeout(2500);
      txt = await txtSource();
      if (predicate(txt)) { ok = true; break; }
    }
    await force();
    await page.waitForTimeout(400);
    try { await page.screenshot({ path: `${DIR}/${shot}` }); } catch (e) {}
    L(`   predicate -> ${ok}  (${Math.round((Date.now()-start)/1000)}s)`);
    return { ok, txt };
  }

  const res = {};

  // Tour 1: succès = le panneau ne dit PLUS "Aucune facture ouverte" (state facture peuplé).
  res.open = await tour(
    'Ouvre la facture FAC-2301.',
    (t) => !/Aucune facture ouverte/i.test(t),
    bodyText,
    'prod-readable-1-open.png'
  );

  // CRUCIAL: attendre que Philippe ait FINI le tour1 (plus aucun indicateur "Running"
  // d'outil en cours) avant d'envoyer le tour2 — sinon on l'interrompt en plein tour
  // et le tour2 reste sans réponse. On exige 3 sondages consécutifs sans "Running".
  let calmes = 0;
  const idleStart = Date.now();
  while (Date.now() - idleStart < 120000) {
    await page.waitForTimeout(2500);
    const t = await chatText();
    if (/Running/i.test(t)) { calmes = 0; } else { calmes++; }
    if (calmes >= 3) break;
  }
  L(`   tour1 idle après ${Math.round((Date.now()-idleStart)/1000)}s (calmes=${calmes})`);
  const chatBefore = await chatText();

  // Tour 2: succès = un NOUVEAU contenu de chat nomme la bonne facture (client réel),
  // alors qu'on n'a PAS redonné le numéro. Scopé au chat -> pas de texte statique du panneau.
  res.ctx = await tour(
    "Sans redemander son numéro: pour la facture actuellement ouverte dans le panneau, quel est son statut et à quel client est-elle?",
    (t) => t.length > chatBefore.length && /Ramada|Manoir|Casino|souffrance/i.test(t.slice(chatBefore.length)),
    chatText,
    'prod-readable-2-context.png'
  );

  fs.writeFileSync(`${DIR}/prod-readable-dom.txt`, await bodyText());
  fs.writeFileSync(`${DIR}/prod-readable-chat.txt`, await chatText());
  await browser.close();

  L('\n========== RESULTAT READABLE PROD ==========');
  L(`Tour1 panneau FACTURE peuplé (state != null): ${res.open.ok}`);
  L(`Tour2 Philippe nomme la facture via contexte:  ${res.ctx.ok}`);
  console.log(out.join('\n'));
  process.exit(res.open.ok && res.ctx.ok ? 0 : 1);
})();
