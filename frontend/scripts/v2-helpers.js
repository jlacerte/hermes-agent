// Helpers Playwright pour CopilotKit V2 (@copilotkitnext).
// Les classes BEM v1 (.copilotKit*) n'existent plus -> sélecteurs V2:
//   launcher  : button[aria-label="Open chat"]   (flottant bas-droite)
//   popup     : [role="dialog"]                   (scope chat, EXCLUT le panneau gauche statique)
//   input     : [role="dialog"] textarea
// Idle/streaming est détecté par la STABILITÉ du texte du chat (agnostique au protocole),
// pas par un marqueur "Running" (qui n'existe pas en V2).
const { chromium } = require('playwright');

const FORCE_CSS =
  `[role="dialog"]{opacity:1 !important;visibility:visible !important;}` +
  `.fixed.bottom-6.right-6{opacity:1 !important;visibility:visible !important;}`;

async function launch() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  return { browser, page };
}

const chatInput = (page) => page.locator('[role="dialog"] textarea').first();
const chatText = (page) => page.locator('[role="dialog"]').first().innerText().catch(() => '');
const bodyText = (page) => page.locator('body').innerText().catch(() => '');
const force = (page) => page.addStyleTag({ content: FORCE_CSS }).catch(() => {});

async function openChat(page) {
  await force(page);
  await page.waitForTimeout(1200);
  if (!(await chatInput(page).isVisible().catch(() => false))) {
    const l = page.locator('button[aria-label="Open chat"]').first();
    if (await l.count()) { await l.click().catch(() => {}); await page.waitForTimeout(1500); }
  }
  await chatInput(page).waitFor({ state: 'visible', timeout: 12000 });
  await force(page);
}

async function send(page, msg) {
  const i = chatInput(page);
  await i.fill(msg);
  await i.press('Enter');
}

// Attend qu'une réponse DÉMARRE (texte du chat dépasse `baseline`) PUIS se stabilise
// (`quiet` sondages consécutifs sans croissance). Retourne true si stabilisé.
async function waitReply(page, baseline, { quiet = 3, poll = 2500, max = 180000 } = {}) {
  let last = -1, stable = 0, started = false;
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    await page.waitForTimeout(poll);
    const len = (await chatText(page)).length;
    if (!started) {
      if (len > baseline + 3) started = true;
    } else if (len === last) {
      if (++stable >= quiet) return true;
    } else {
      stable = 0;
    }
    last = len;
  }
  return started;
}

module.exports = { launch, chatInput, chatText, bodyText, force, openChat, send, waitReply };
