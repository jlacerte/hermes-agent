// Preuve vision: le header de la popup affiche "Philippe" (label modalHeaderTitle).
const { launch, openChat, force } = require('./v2-helpers');

(async () => {
  const { browser, page } = await launch();
  try {
    await page.goto('http://10.0.0.1:8083/', { waitUntil: 'networkidle', timeout: 30000 });
    await openChat(page);
    await force(page);
    await page.waitForTimeout(800);
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.screenshot({ path: '/tmp/header-proof.png' });
    const txt = await dialog.innerText().catch(() => '');
    console.log('HEADER_HAS_PHILIPPE=' + txt.includes('Philippe'));
    console.log('HAS_COPILOTKIT_CHAT=' + txt.includes('CopilotKit Chat'));
    process.exit(0);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
