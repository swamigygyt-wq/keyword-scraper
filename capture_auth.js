// Capture the FULL request to the API — including Authorization header
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Capturing WordStream API auth token...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Intercept the specific API call
  page.on('request', req => {
    const url = req.url();
    if (url.includes('tools-backend.wordstream.com')) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📡 ${req.method()} ${url}`);
      console.log(`HEADERS:`);
      const headers = req.headers();
      Object.entries(headers).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
      const body = req.postData();
      if (body) console.log(`BODY: ${body}`);
      console.log(`${'═'.repeat(60)}\n`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('tools-backend.wordstream.com/api/free-tools/google/keywords')) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📥 RESPONSE ${res.status()}`);
      try {
        const body = await res.text();
        console.log(`FULL BODY:\n${body}`);
      } catch(e) {}
      console.log(`${'═'.repeat(60)}\n`);
    }
  });

  await page.goto('https://www.wordstream.com/keywords', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Accept cookies
  try { await page.locator('#onetrust-accept-btn-handler').click({ timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Type and search
  const input = page.locator('input[type="text"]').first();
  await input.fill('mortgage calculator');
  await page.waitForTimeout(500);
  
  try {
    const submit = page.locator('input[type="submit"]').first();
    if (await submit.isVisible({ timeout: 2000 })) await submit.click();
  } catch(e) {}
  
  console.log('Waiting for redirect to tools.wordstream.com...');
  await page.waitForTimeout(8000);

  // Click Continue
  console.log('Clicking Continue...');
  try {
    const btn = page.locator('button:has-text("Continue")').first();
    if (await btn.isVisible({ timeout: 5000 })) await btn.click();
  } catch(e) {
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => {
        if (b.textContent.trim() === 'Continue') b.click();
      });
    });
  }

  await page.waitForTimeout(20000);
  console.log('\nDone! Closing in 5s...');
  await page.waitForTimeout(5000);
  await browser.close();
})();
