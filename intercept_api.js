// Intercept WordStream's internal API calls — find the real endpoint
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Intercepting WordStream API calls...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log ALL network requests
  const apiCalls = [];
  page.on('request', req => {
    const url = req.url();
    const method = req.method();
    // Skip static assets
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.css') || 
        url.includes('.woff') || url.includes('google') || url.includes('facebook') ||
        url.includes('analytics') || url.includes('gtm') || url.includes('onetrust')) return;
    
    if (method === 'POST' || url.includes('api') || url.includes('keyword') || url.includes('fkt')) {
      const postData = req.postData();
      console.log(`📡 ${method} ${url}`);
      if (postData) console.log(`   BODY: ${postData.substring(0, 500)}`);
      apiCalls.push({ method, url, body: postData });
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api') || url.includes('keyword') || url.includes('fkt') || url.includes('search')) {
      const status = res.status();
      try {
        const body = await res.text();
        if (body.length > 50 && body.length < 50000 && !body.includes('<!DOCTYPE')) {
          console.log(`\n📥 RESPONSE ${status} ${url}`);
          console.log(`   SIZE: ${body.length} chars`);
          console.log(`   DATA: ${body.substring(0, 1000)}`);
          console.log('');
        }
      } catch(e) {}
    }
  });

  // Navigate
  await page.goto('https://www.wordstream.com/keywords', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Accept cookies
  try {
    const cookieBtn = page.locator('#onetrust-accept-btn-handler');
    if (await cookieBtn.isVisible({ timeout: 3000 })) await cookieBtn.click();
  } catch(e) {}
  await page.waitForTimeout(1000);

  // Type keyword
  const input = page.locator('input[type="text"]').first();
  await input.fill('car insurance quote');
  await page.waitForTimeout(1000);

  // Click search
  console.log('\n--- CLICKING SEARCH ---\n');
  try {
    const submit = page.locator('input[type="submit"]').first();
    if (await submit.isVisible({ timeout: 2000 })) await submit.click();
    else await page.locator('button:has-text("Search")').first().click();
  } catch(e) { console.log('Search click failed:', e.message); }
  
  await page.waitForTimeout(8000);

  // Click Continue in modal
  console.log('\n--- CLICKING CONTINUE ---\n');
  try {
    const continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.isVisible({ timeout: 5000 })) {
      await continueBtn.click();
      console.log('✅ Continue clicked!');
    }
  } catch(e) { console.log('Continue not found, trying JS click...'); }
  
  // Try JS click as fallback
  await page.evaluate(() => {
    const all = document.querySelectorAll('button, a, div');
    for (const el of all) {
      if (el.offsetWidth > 0 && el.textContent.trim() === 'Continue') {
        el.click();
        return 'clicked';
      }
    }
  });

  // Wait for results
  await page.waitForTimeout(15000);
  
  console.log('\n═══ ALL API CALLS CAPTURED ═══');
  apiCalls.forEach((c, i) => console.log(`${i+1}. ${c.method} ${c.url}`));
  
  console.log('\n⏳ Keeping browser open 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
})();
