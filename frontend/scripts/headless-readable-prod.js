// Preuve E2E PROD du multi-tour readable (LE fix #3470), version V2.
// Tour 1: ouvrir FAC-2301 -> le PANNEAU "FACTURE OUVERTE" se peuple (state facture != null).
// Tour 2: demander le statut/client de "la facture actuellement ouverte dans le panneau"
//   SANS redonner le numéro. Texte SCOPÉ AU CHAT ([role="dialog"]) -> exclut le panneau
//   statique gauche. Philippe ne peut nommer la bonne facture que via le contexte
//   (useAgentContext -> ephemeral_system_prompt). En v1 ce 2e tour n'atteignait jamais Philippe.
const { launch, openChat, send, chatText, bodyText, waitReply, force } = require('./v2-helpers');
const fs = require('fs');
const URL = process.argv[2] || 'http://10.0.0.1:8083/';
const DIR = '/tmp/copilot-debug';
const out = []; const L = (s) => out.push(s);

(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', e => L(`[PAGEERROR] ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => L(`[GOTO] ${e.message}`));
  await openChat(page);

  const res = {};

  // Tour 1: ouvrir la facture -> panneau peuplé (state facture != null).
  await send(page, 'Ouvre la facture FAC-2301.');
  L('\n→ Ouvre la facture FAC-2301.');
  // Succès tour1 = le panneau ne dit PLUS "Aucune facture ouverte". Polling
  // dédié (ouvrir_facture peut être appelé APRÈS le texte -> waitReply seul
  // raterait la popul. du state). Tolère un lookup Zoho lent.
  res.open = false; const tOpen = Date.now();
  while (Date.now() - tOpen < 200000) {
    await page.waitForTimeout(2500);
    if (!/Aucune facture ouverte/i.test(await bodyText(page))) { res.open = true; break; }
  }
  await force(page); await page.screenshot({ path: `${DIR}/prod-readable-1-open.png` }).catch(() => {});
  L(`   panneau peuplé: ${res.open} (${Math.round((Date.now() - tOpen) / 1000)}s)`);

  // Tour 2: question contextuelle SANS le numéro. La phrase exacte
  // "actuellement ouverte dans le panneau" doit atteindre Philippe (grep agent.log).
  const chatBefore = (await chatText(page)).length;
  await send(page, "Sans redemander son numéro: pour la facture actuellement ouverte dans le panneau, quel est son statut et à quel client est-elle?");
  L('→ (tour2) statut + client de la facture ouverte ?');
  await waitReply(page, chatBefore, { quiet: 3, max: 180000 });
  const after = await chatText(page);
  const newText = after.slice(chatBefore);
  res.ctx = /Ramada|Manoir|Casino|souffrance/i.test(newText);
  await force(page); await page.screenshot({ path: `${DIR}/prod-readable-2-context.png` }).catch(() => {});
  L(`   Philippe nomme la facture via contexte: ${res.ctx}`);

  fs.writeFileSync(`${DIR}/prod-readable-chat.txt`, after);
  await browser.close();

  L('\n========== RESULTAT READABLE PROD (V2) ==========');
  L(`Tour1 panneau FACTURE peuplé: ${res.open}`);
  L(`Tour2 contexte readable:      ${res.ctx}`);
  console.log(out.join('\n'));
  process.exit(res.open && res.ctx ? 0 : 1);
})();
