// ═══════════════════════════════════════════════════════════════
//  KEYWORD SCRAPER v4 — BULLETPROOF EDITION
//  ✅ Saves to GitHub Gist (survives Render restart)
//  ✅ Memory management (flushes after saving)
//  ✅ Smart rate limiting (60-90s delays, cooldowns)
//  ✅ Auto country switching (US → UK → CA → AU → DE)
//  ✅ Never repeats a keyword
//  ✅ Self-ping keeps Render alive
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const { chromium } = require('playwright-core');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ GITHUB GIST CONFIG (for data persistence) ═══
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
let GIST_ID = process.env.GIST_ID || ''; // Will create on first save

// ═══ STATE ═══
let allResults = [];        // Current batch (flushed after save)
let totalSaved = 0;         // Total saved across all batches
let searchedKeys = new Set();
let isRunning = false;
let autoRunning = false;
let lastRun = null;
let totalSearches = 0;
let consecutiveFails = 0;
let currentCountryIdx = 0;
let currentSeedIdx = 0;
let startTime = Date.now();
let stats = { ok: 0, noResults: 0, fails: 0, skipped: 0, saved: 0 };
let lastError = '';

// ═══ COUNTRIES + SEEDS (ordered by CPC) ═══
const COUNTRIES = [
  {
    code: 'US', name: 'United States', label: 'United States',
    seeds: [
      // LEGAL ($200-600)
      "car accident lawyer","truck accident lawyer","personal injury lawyer","wrongful death attorney",
      "slip and fall lawyer","dog bite lawyer","motorcycle accident lawyer","medical malpractice lawyer",
      "mesothelioma lawyer","work injury lawyer","premises liability lawyer","birth injury lawyer",
      "brain injury lawyer","spinal cord injury lawyer","burn injury lawyer","class action lawsuit",
      "workers compensation lawyer","disability lawyer","nursing home abuse lawyer","toxic tort lawyer",
      "product liability lawyer","construction accident lawyer","pedestrian accident lawyer",
      "bicycle accident lawyer","boating accident lawyer","aviation accident lawyer",
      "uber accident lawyer","drunk driving accident lawyer","hit and run lawyer",
      "whiplash injury lawyer","back injury lawyer","amputation lawyer",
      "electrocution lawyer","drowning accident lawyer","defective drug lawyer",
      
      // INSURANCE ($50-200)
      "auto insurance quote","car insurance quote","home insurance quote","life insurance quote",
      "health insurance quote","motorcycle insurance quote","renters insurance quote",
      "business insurance quote","commercial insurance quote","dental insurance cost",
      "pet insurance cost","travel insurance cost","umbrella insurance cost",
      "liability insurance cost","term life insurance rates","disability insurance cost",
      "long term care insurance","medicare supplement insurance","flood insurance cost",
      "earthquake insurance cost","boat insurance cost","rv insurance cost",
      "mobile home insurance","condo insurance cost","landlord insurance cost",
      "professional liability insurance","cyber insurance cost","wedding insurance cost",
      "sr22 insurance cost","gap insurance cost","final expense insurance",
      
      // FINANCE ($10-50)
      "loan comparison calculator","debt consolidation calculator","credit card payoff calculator",
      "student loan refinance calculator","business loan calculator","sba loan calculator",
      "commercial loan calculator","hard money loan calculator","bridge loan calculator",
      "merchant cash advance calculator","equipment financing calculator","factoring calculator",
      "heloc calculator","home equity loan calculator","fha loan calculator",
      "va loan calculator","jumbo loan calculator","construction loan calculator",
      "land loan calculator","personal loan calculator","payday loan calculator",
      
      // TAX ($8-20)
      "payroll tax calculator","salary calculator","tax estimator","federal tax calculator",
      "1099 tax calculator","self employment tax calculator","capital gains tax calculator",
      "estate tax calculator","gift tax calculator","property tax calculator",
      "sales tax calculator","tax bracket calculator","tax deduction calculator",
      "tax refund calculator","inheritance tax calculator","w2 calculator",
      "tax withholding calculator","income tax calculator","quarterly tax calculator",
      "depreciation calculator","bonus tax calculator","stock option tax calculator",
      "crypto tax calculator","rental income tax calculator","agi calculator",
      
      // INVESTMENT ($2-10)
      "investment calculator","stock calculator","roi calculator","dividend calculator",
      "bond yield calculator","mutual fund calculator","cd calculator","annuity calculator",
      "present value calculator","future value calculator","stock return calculator",
      "options profit calculator","forex calculator","etf calculator",
      "dollar cost averaging calculator","margin calculator","cryptocurrency calculator",
      
      // RETIREMENT ($3-13)
      "retirement calculator","401k calculator","roth ira calculator","pension calculator",
      "social security calculator","ira calculator","retirement savings calculator",
      "early retirement calculator","rmd calculator","sep ira calculator",
      "403b calculator","fire calculator","coast fire calculator",
      
      // AUTO ($1-10)
      "car payment calculator","auto loan calculator","car lease calculator",
      "car depreciation calculator","auto refinance calculator","gas mileage calculator",
      "car insurance calculator","vehicle trade in value calculator",
      "car affordability calculator","electric vehicle cost calculator",
      
      // SAVINGS ($1-6)
      "compound interest calculator","savings calculator","inflation calculator",
      "high yield savings calculator","savings goal calculator","emergency fund calculator",
      
      // HEALTH ($1-5)
      "calorie calculator","bmi calculator","tdee calculator","macro calculator",
      "body fat calculator","protein calculator","pregnancy due date calculator",
      "ideal weight calculator","ovulation calculator","blood alcohol calculator",
      
      // REAL ESTATE ($2-35)
      "rental property calculator","airbnb calculator","rent vs buy calculator",
      "real estate roi calculator","flip calculator","cash on cash return calculator",
      "mortgage affordability calculator","closing cost calculator",
      "cap rate calculator","gross rent multiplier calculator",
      
      // DEBT ($2-8)
      "debt payoff calculator","credit card interest calculator","balance transfer calculator",
      "debt avalanche calculator","debt snowball calculator","net worth calculator",
      
      // HOME
      "solar panel calculator","electricity cost calculator","pool cost calculator",
      "roofing calculator","fence calculator","flooring calculator","paint calculator",
      "square footage calculator","concrete calculator","gravel calculator",
      "deck cost calculator","bathroom remodel calculator","kitchen remodel calculator",
      
      // MISC
      "tip calculator","percentage calculator","discount calculator",
      "shipping cost calculator","import duty calculator","cost of living calculator",
      "moving cost calculator","wedding cost calculator","college cost calculator",
      "child support calculator","alimony calculator","workers comp settlement calculator"
    ]
  },
  {
    code: 'UK', name: 'United Kingdom', label: 'United Kingdom',
    seeds: [
      // UK LEGAL
      "personal injury claim calculator","car accident claim uk","road traffic accident solicitor",
      "whiplash claim calculator","workplace injury claim","slip trip fall compensation",
      "medical negligence solicitor","industrial disease claim","asbestos claim solicitor",
      "motorcycle accident claim uk","pedestrian accident claim","criminal injury compensation",
      "housing disrepair claim","flight delay compensation","no win no fee solicitor",
      
      // UK INSURANCE
      "car insurance comparison uk","home insurance comparison uk","life insurance uk",
      "health insurance uk","pet insurance comparison","travel insurance comparison",
      "van insurance quote","motorbike insurance uk","landlord insurance uk",
      "business insurance uk","public liability insurance","employers liability insurance",
      "income protection insurance","critical illness cover","buildings insurance cost",
      
      // UK FINANCE
      "mortgage calculator uk","stamp duty calculator","inheritance tax calculator uk",
      "pension calculator uk","salary calculator uk","tax calculator uk",
      "student loan calculator uk","isa calculator","help to buy calculator",
      "buy to let calculator","bridging loan calculator uk","equity release calculator",
      "capital gains tax calculator uk","vat calculator","self assessment calculator",
      "paye calculator","national insurance calculator","dividend tax calculator uk",
      "council tax calculator","benefit calculator uk","lisa calculator",
      
      // UK SAVINGS & INVEST
      "compound interest calculator uk","savings calculator uk","inflation calculator uk",
      "investment calculator uk","stocks and shares isa calculator",
      "premium bonds calculator","pension drawdown calculator",
      "annuity calculator uk","retirement calculator uk","sipp calculator",
      
      // UK PROPERTY
      "rental yield calculator uk","stamp duty calculator uk","property investment calculator",
      "buy to let mortgage calculator","house price calculator","shared ownership calculator",
      
      // UK HOME & ENERGY
      "solar panel calculator uk","energy cost calculator uk","boiler cost calculator",
      "loft conversion cost","extension cost calculator","double glazing cost calculator",
      "heat pump cost calculator","ev charging cost calculator"
    ]
  },
  {
    code: 'CA', name: 'Canada', label: 'Canada',
    seeds: [
      // CA LEGAL
      "personal injury lawyer canada","car accident lawyer toronto","slip and fall lawyer ontario",
      "medical malpractice lawyer canada","wrongful dismissal lawyer","disability lawyer canada",
      "workers compensation lawyer canada","motorcycle accident lawyer canada",
      "accident benefits calculator ontario","long term disability lawyer",
      
      // CA INSURANCE
      "car insurance ontario","home insurance canada","life insurance canada",
      "health insurance canada","travel insurance canada","business insurance canada",
      "motorcycle insurance ontario","tenant insurance canada","condo insurance canada",
      
      // CA FINANCE
      "mortgage calculator canada","rrsp calculator","tfsa calculator",
      "income tax calculator canada","gst hst calculator","cpp calculator",
      "student loan calculator canada","car loan calculator canada",
      "payroll calculator canada","salary calculator canada",
      "capital gains tax calculator canada","land transfer tax calculator",
      "ei calculator","maternity leave calculator canada","resp calculator",
      
      // CA PROPERTY
      "rental yield calculator canada","property tax calculator ontario",
      "cost of living calculator canada","mortgage affordability calculator canada",
      "first time home buyer calculator canada","cmhc insurance calculator",
      
      // CA HOME
      "solar panel calculator canada","hydro cost calculator",
      "home renovation calculator canada","furnace cost calculator"
    ]
  },
  {
    code: 'AU', name: 'Australia', label: 'Australia',
    seeds: [
      // AU LEGAL
      "personal injury lawyer australia","car accident lawyer sydney",
      "workers compensation lawyer nsw","medical negligence lawyer australia",
      "tpd claim calculator","slip and fall claim australia",
      
      // AU INSURANCE  
      "car insurance comparison australia","home insurance australia","life insurance australia",
      "health insurance comparison australia","income protection insurance australia",
      "business insurance australia","landlord insurance australia",
      
      // AU FINANCE
      "mortgage calculator australia","income tax calculator australia",
      "stamp duty calculator nsw","stamp duty calculator victoria",
      "superannuation calculator","hecs help calculator",
      "salary calculator australia","gst calculator australia",
      "capital gains tax calculator australia","car loan calculator australia",
      "investment property calculator","negative gearing calculator",
      
      // AU PROPERTY
      "rental yield calculator australia","lmi calculator",
      "first home buyer calculator","home loan affordability calculator",
      
      // AU HOME
      "solar panel calculator australia","electricity cost calculator australia"
    ]
  },
  {
    code: 'DE', name: 'Germany', label: 'Germany',
    seeds: [
      "tax calculator germany","income tax germany","salary calculator germany",
      "health insurance germany","car insurance germany","life insurance germany",
      "mortgage calculator germany","rent calculator germany",
      "pension calculator germany","investment calculator germany",
      "cost of living germany","expat tax calculator germany",
      "freelance tax germany","property tax germany","energy cost calculator germany",
      "solar panel calculator germany","retirement calculator germany",
      "salary comparison germany","church tax calculator germany"
    ]
  }
];

// ═══ ALREADY DONE (from existing 5500+ local data) ═══
const ALREADY_DONE_US = new Set([
  "car accident lawyer","truck accident lawyer","personal injury lawyer","wrongful death attorney",
  "slip and fall lawyer","dog bite lawyer","work injury lawyer","premises liability lawyer",
  "burn injury lawyer","motorcycle accident lawyer","medical malpractice lawyer","mesothelioma lawyer",
  "auto insurance quote","car insurance quote","home insurance quote","life insurance quote",
  "health insurance quote","motorcycle insurance quote","liability insurance cost",
  "term life insurance rates","dental insurance cost",
  "payroll tax calculator","salary calculator","tax estimator","federal tax calculator",
  "1099 tax calculator","self employment tax calculator","capital gains tax calculator",
  "estate tax calculator","gift tax calculator","property tax calculator","sales tax calculator",
  "tax bracket calculator","tax deduction calculator","tax refund calculator",
  "inheritance tax calculator","w2 calculator","income tax calculator",
  "home office deduction calculator","mileage deduction calculator","charitable donation calculator",
  "import duty calculator","customs duty calculator","minimum wage calculator",
  "living wage calculator","raise calculator",
  "investment calculator","stock calculator","roi calculator","dividend calculator",
  "compound interest calculator","cd calculator","present value calculator","stock return calculator",
  "retirement calculator","401k calculator","roth ira calculator","pension calculator",
  "social security calculator","ira calculator","retirement savings calculator",
  "car payment calculator","auto loan calculator","car lease calculator",
  "car depreciation calculator","auto refinance calculator","gas mileage calculator",
  "savings calculator","inflation calculator","high yield savings calculator",
  "calorie calculator","bmi calculator","tdee calculator","macro calculator",
  "body fat calculator","protein calculator","pregnancy due date calculator",
  "debt payoff calculator","credit card payoff calculator","balance transfer calculator",
  "tip calculator","percentage calculator","discount calculator","cost of living calculator",
  "solar panel calculator","concrete calculator","square footage calculator",
  "shipping cost calculator","rental property calculator","mortgage affordability calculator",
  "loan comparison calculator","hard money loan calculator","student loan refinance calculator",
  "extra payment mortgage calculator","first time home buyer calculator",
  "solo 401k calculator","backdoor roth ira calculator",
  "mobile home insurance","nursing home abuse lawyer","brain injury lawyer",
  "spinal cord injury lawyer","toxic tort lawyer"
]);

// ═══ USER AGENTS ═══
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
];
const TZS = ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
             'Europe/London','Europe/Berlin','Australia/Sydney','America/Toronto'];

// ═══════════════════════════════════════════════════════════════
//  GITHUB GIST — PERSISTENT STORAGE (survives Render restarts)
// ═══════════════════════════════════════════════════════════════
function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'KeywordScraper',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function saveToGist() {
  if (allResults.length === 0) return;
  
  try {
    const batch = stats.saved + 1;
    const csv = 'Keyword,Volume,CPC_Low,CPC_High,Competition,Seed,Country\n' +
      allResults.map(r => 
        `"${(r.keyword||'').replace(/"/g,"'")}","${r.volume}","${r.bidLow}","${r.bidHigh}","${r.competition}","${(r.seed||'').replace(/"/g,"'")}","${r.country}"`
      ).join('\n');
    
    const stateData = JSON.stringify({
      searchedKeys: [...searchedKeys],
      currentCountryIdx,
      currentSeedIdx,
      totalSearches,
      stats,
      totalSaved: totalSaved + allResults.length,
      lastRun,
      timestamp: new Date().toISOString()
    });
    
    const files = {};
    files[`batch_${String(batch).padStart(3,'0')}.csv`] = { content: csv };
    files['state.json'] = { content: stateData };
    
    if (!GIST_ID) {
      // Create new gist
      const gist = await githubRequest('POST', '/gists', {
        description: `Keyword Scraper Data — ${new Date().toISOString()}`,
        public: false,
        files
      });
      if (gist.id) {
        GIST_ID = gist.id;
        console.log(`  💾 Gist created: ${GIST_ID}`);
      } else {
        console.log(`  ❌ Gist create failed:`, JSON.stringify(gist).substring(0, 200));
        return;
      }
    } else {
      // Update existing gist
      await githubRequest('PATCH', `/gists/${GIST_ID}`, { files });
      console.log(`  💾 Gist updated: batch ${batch} (${allResults.length} keywords)`);
    }
    
    totalSaved += allResults.length;
    stats.saved++;
    allResults = []; // FREE MEMORY
    
  } catch(err) {
    console.log(`  ❌ Gist save error: ${err.message}`);
    lastError = `Gist save: ${err.message}`;
  }
}

async function loadFromGist() {
  if (!GIST_ID) return;
  
  try {
    const gist = await githubRequest('GET', `/gists/${GIST_ID}`, null);
    if (gist.files && gist.files['state.json']) {
      const state = JSON.parse(gist.files['state.json'].content);
      state.searchedKeys.forEach(k => searchedKeys.add(k));
      currentCountryIdx = state.currentCountryIdx || 0;
      currentSeedIdx = state.currentSeedIdx || 0;
      totalSearches = state.totalSearches || 0;
      totalSaved = state.totalSaved || 0;
      stats = { ...stats, ...state.stats };
      console.log(`  📂 Loaded state: ${searchedKeys.size} searched, ${totalSaved} saved`);
    }
  } catch(err) {
    console.log(`  ⚠️ Could not load state: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CORE SCRAPER
// ═══════════════════════════════════════════════════════════════
async function scrapeKeyword(keyword, country) {
  let browser = null;
  const t0 = Date.now();
  
  try {
    // Launch fresh browser each time (different fingerprint)
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
             '--disable-blink-features=AutomationControlled']
    });
    
    const ua = UAS[Math.floor(Math.random() * UAS.length)];
    const tz = TZS[Math.floor(Math.random() * TZS.length)];
    const w = 1200 + Math.floor(Math.random() * 400);
    const h = 700 + Math.floor(Math.random() * 200);
    
    const ctx = await browser.newContext({
      userAgent: ua,
      viewport: { width: w, height: h },
      locale: 'en-US',
      timezoneId: tz
    });
    
    const page = await ctx.newPage();
    
    // Anti-detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // Set reasonable timeouts
    page.setDefaultTimeout(20000);

    // 1. Navigate
    await page.goto('https://www.wordstream.com/keywords', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    await page.waitForTimeout(3000 + Math.random() * 3000);

    // 2. Dismiss popups (try all common ones)
    const popups = ['#onetrust-accept-btn-handler', 'button:has-text("Accept All")',
                    'button:has-text("Accept")', '[aria-label="close"]', 
                    'button:has-text("Close")', '.modal-close'];
    for (const sel of popups) {
      try {
        const el = page.locator(sel);
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          await page.waitForTimeout(800);
        }
      } catch(e) {}
    }

    // 3. Type keyword (human-like)
    const input = page.locator('input[placeholder*="keyword"], input[placeholder*="Keyword"], input[type="text"]').first();
    if (!await input.isVisible({ timeout: 5000 })) {
      throw new Error('Input field not found');
    }
    await input.click();
    await input.fill('');
    await page.waitForTimeout(500);
    for (const ch of keyword) {
      await input.type(ch, { delay: 50 + Math.random() * 80 });
    }
    await page.waitForTimeout(1000 + Math.random() * 1000);

    // 4. Select country if not US
    if (country.code !== 'US') {
      try {
        const selects = page.locator('select');
        const count = await selects.count();
        for (let i = 0; i < count; i++) {
          const sel = selects.nth(i);
          const options = await sel.locator('option').allTextContents();
          if (options.some(o => o.includes(country.label) || o.includes(country.name))) {
            await sel.selectOption({ label: country.label });
            await page.waitForTimeout(1000);
            break;
          }
        }
      } catch(e) {}
    }

    // 5. Click search
    const searchBtn = page.locator('input[type="submit"], button:has-text("Search")').first();
    if (!await searchBtn.isVisible({ timeout: 3000 })) {
      throw new Error('Search button not found');
    }
    await searchBtn.click();
    await page.waitForTimeout(5000 + Math.random() * 2000);

    // 6. Handle Refine/Continue modal
    const continueBtns = [
      'button:has-text("Continue")',
      'button:has-text("Get Keywords")',
      'button:has-text("Show Keywords")',
      'button:has-text("View Results")'
    ];
    for (const sel of continueBtns) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          await page.waitForTimeout(8000 + Math.random() * 4000);
          break;
        }
      } catch(e) {}
    }

    // 7. Extra wait for data to load
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // 8. Check "No Results"
    let noRes = false;
    try { noRes = await page.locator('text=No Results').isVisible({ timeout: 2000 }); } catch(e) {}
    if (noRes) {
      return { status: 'no_results', keyword, country: country.code, data: [], ms: Date.now() - t0 };
    }

    // 9. Wait for table rows
    try {
      await page.waitForSelector('table tbody tr th[scope="row"]', { timeout: 8000 });
    } catch(e) {}

    // 10. Extract data
    const data = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return Array.from(rows).map(row => {
        const th = row.querySelector('th[scope="row"]');
        const tds = row.querySelectorAll('td');
        if (!th || tds.length < 4) return null;
        return {
          keyword: th.textContent.trim(),
          volume: tds[0]?.textContent?.trim() || '-',
          bidLow: tds[1]?.textContent?.trim() || '-',
          bidHigh: tds[2]?.textContent?.trim() || '-',
          competition: tds[3]?.textContent?.trim() || '-'
        };
      }).filter(Boolean);
    });

    return { status: data.length > 0 ? 'ok' : 'empty', keyword, country: country.code, data, ms: Date.now() - t0 };

  } catch(err) {
    return { status: 'error', keyword, country: country.code, data: [], 
             error: err.message.substring(0, 100), ms: Date.now() - t0 };
  } finally {
    // ALWAYS close browser (prevent memory leaks)
    if (browser) {
      try { await browser.close(); } catch(e) {}
    }
  }
}

// ═══ KEYWORD PICKER ═══
function getNextKeyword() {
  while (currentCountryIdx < COUNTRIES.length) {
    const country = COUNTRIES[currentCountryIdx];
    
    while (currentSeedIdx < country.seeds.length) {
      const seed = country.seeds[currentSeedIdx];
      const key = `${seed.toLowerCase()}|${country.code}`;
      currentSeedIdx++;
      
      if (searchedKeys.has(key)) { stats.skipped++; continue; }
      if (country.code === 'US' && ALREADY_DONE_US.has(seed.toLowerCase())) {
        searchedKeys.add(key);
        stats.skipped++;
        continue;
      }
      
      return { keyword: seed, country };
    }
    
    currentCountryIdx++;
    currentSeedIdx = 0;
    if (currentCountryIdx < COUNTRIES.length) {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`  🌍 SWITCHING TO: ${COUNTRIES[currentCountryIdx].name.toUpperCase()}`);
      console.log(`${'═'.repeat(50)}\n`);
    }
  }
  return null;
}

// ═══ MAIN SCRAPE ═══
async function scrapeNext() {
  if (isRunning) return { msg: 'Already running, please wait' };
  
  const next = getNextKeyword();
  if (!next) {
    autoRunning = false;
    return { msg: '🏁 ALL COUNTRIES COMPLETE!', stats, totalKeywords: totalSaved + allResults.length };
  }
  
  isRunning = true;
  const { keyword, country } = next;
  const key = `${keyword.toLowerCase()}|${country.code}`;
  totalSearches++;
  
  console.log(`[${totalSearches}] 🌍${country.code} "${keyword}"`);
  
  const result = await scrapeKeyword(keyword, country);
  lastRun = new Date().toISOString();
  
  if (result.status === 'ok') {
    result.data.forEach(d => { d.seed = keyword; d.country = country.code; });
    allResults.push(...result.data);
    searchedKeys.add(key);
    stats.ok++;
    consecutiveFails = 0;
    console.log(`  ✅ ${result.data.length} kw (${Math.round(result.ms/1000)}s) | Batch: ${allResults.length} | Total: ${totalSaved + allResults.length}`);
  } else if (result.status === 'no_results') {
    searchedKeys.add(key);
    stats.noResults++;
    consecutiveFails = 0; // NOT a rate limit
    console.log(`  📭 No Results (${Math.round(result.ms/1000)}s)`);
  } else {
    stats.fails++;
    consecutiveFails++;
    lastError = result.error || result.status;
    console.log(`  ⚠️ ${result.status} (${Math.round(result.ms/1000)}s)${result.error ? ': ' + result.error : ''}`);
  }
  
  // Auto-save every 25 successful extractions
  if (allResults.length >= 25) {
    console.log(`\n  💾 Auto-saving ${allResults.length} keywords to Gist...`);
    await saveToGist();
  }
  
  isRunning = false;
  return {
    keyword, country: country.code, status: result.status,
    extracted: result.data.length,
    batchKeywords: allResults.length,
    totalKeywords: totalSaved + allResults.length,
    search: totalSearches
  };
}

// ═══ AUTO SCRAPE LOOP ═══
async function autoScrapeLoop() {
  console.log('\n🟢 Auto-scrape loop started\n');
  
  while (autoRunning) {
    if (!isRunning) {
      const result = await scrapeNext();
      
      if (result.msg && result.msg.includes('COMPLETE')) {
        // Save final batch
        if (allResults.length > 0) await saveToGist();
        console.log('\n🏁 ALL DONE!\n');
        break;
      }
      
      // Smart delay
      let delay;
      if (consecutiveFails >= 5) {
        delay = 180000; // 3 min
        console.log(`  🔴 5+ fails — cooling 3min`);
      } else if (consecutiveFails >= 3) {
        delay = 90000; // 1.5 min
        console.log(`  🟡 3+ fails — cooling 90s`);
      } else {
        delay = 50000 + Math.random() * 30000; // 50-80s
      }
      
      await new Promise(r => setTimeout(r, delay));
    } else {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ═══ SELF-PING ═══
setInterval(() => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  fetch(`${url}/ping`).catch(() => {});
}, 4 * 60 * 1000);

// ═══ ROUTES ═══
app.get('/', (req, res) => {
  const c = COUNTRIES[currentCountryIdx] || { name: 'ALL DONE', code: 'X', seeds: [] };
  const totalSeeds = COUNTRIES.reduce((s, co) => s + co.seeds.length, 0);
  const uptime = Math.round((Date.now() - startTime) / 60000);
  
  res.json({
    status: autoRunning ? '🟢 AUTO-SCRAPING' : '🔴 STOPPED',
    uptime: `${uptime} min (${(uptime/60).toFixed(1)} hrs)`,
    currentCountry: `${c.name} (${c.code})`,
    seedProgress: `${currentSeedIdx}/${c.seeds.length}`,
    countryProgress: `${currentCountryIdx + 1}/${COUNTRIES.length}`,
    totalSeeds,
    batchKeywords: allResults.length,
    totalKeywords: totalSaved + allResults.length,
    totalSearches,
    searchedSeeds: searchedKeys.size,
    gistId: GIST_ID || 'not created yet',
    stats, isRunning, lastRun, consecutiveFails, lastError,
    eta: `~${Math.round((totalSeeds - totalSearches - stats.skipped) * 65 / 3600)} hours`
  });
});

app.get('/ping', (req, res) => res.send('pong'));
app.get('/scrape', async (req, res) => { res.json(await scrapeNext()); });

app.get('/results', (req, res) => {
  const c = req.query.country?.toUpperCase();
  const filtered = c ? allResults.filter(r => r.country === c) : allResults;
  res.json({ batchTotal: filtered.length, totalSaved, keywords: filtered });
});

app.get('/csv', (req, res) => {
  let csv = 'Keyword,Volume,CPC_Low,CPC_High,Competition,Seed,Country\n';
  allResults.forEach(r => {
    csv += `"${(r.keyword||'').replace(/"/g,"'")}","${r.volume}","${r.bidLow}","${r.bidHigh}","${r.competition}","${(r.seed||'').replace(/"/g,"'")}","${r.country}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=keywords.csv');
  res.send(csv);
});

app.get('/top', (req, res) => {
  const sorted = [...allResults]
    .map(r => ({ ...r, cpc: parseFloat((r.bidHigh || '0').replace(/[^0-9.]/g, '')) || 0 }))
    .filter(r => r.cpc > 0)
    .sort((a, b) => b.cpc - a.cpc)
    .slice(0, 100);
  res.json({ top100: sorted });
});

app.get('/stats', (req, res) => {
  const byCountry = {};
  allResults.forEach(r => {
    if (!byCountry[r.country]) byCountry[r.country] = { count: 0, uniqueSeeds: new Set() };
    byCountry[r.country].count++;
    byCountry[r.country].uniqueSeeds.add(r.seed);
  });
  Object.keys(byCountry).forEach(k => { byCountry[k].uniqueSeeds = byCountry[k].uniqueSeeds.size; });
  res.json({ byCountry, batchTotal: allResults.length, totalSaved, totalSearches, stats });
});

app.get('/save', async (req, res) => {
  await saveToGist();
  res.json({ msg: 'Saved', gistId: GIST_ID, totalSaved });
});

app.get('/pause', (req, res) => { autoRunning = false; res.json({ msg: '⏸️ Paused' }); });
app.get('/resume', (req, res) => {
  if (!autoRunning) { autoRunning = true; autoScrapeLoop(); }
  res.json({ msg: '▶️ Resumed' });
});

// ═══ START ═══
const totalSeeds = COUNTRIES.reduce((s, c) => s + c.seeds.length, 0);

app.listen(PORT, async () => {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  🚀 KEYWORD SCRAPER v4 — BULLETPROOF EDITION`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Seeds:     ${totalSeeds} across ${COUNTRIES.length} countries`);
  console.log(`  Countries: ${COUNTRIES.map(c => `${c.code}(${c.seeds.length})`).join(' → ')}`);
  console.log(`  Max KW:    ${totalSeeds * 25} (${totalSeeds} × 25 per search)`);
  console.log(`  Schedule:  1 keyword every ~60s`);
  console.log(`  ETA:       ~${Math.round(totalSeeds * 65 / 3600)} hours`);
  console.log(`  Storage:   GitHub Gist (persistent)`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Dashboard: /`);
  console.log(`  Trigger:   /scrape`);
  console.log(`  Results:   /results  |  /csv  |  /top  |  /stats`);
  console.log(`  Control:   /pause  |  /resume  |  /save`);
  console.log(`${'═'.repeat(55)}\n`);
  
  // Load previous state if exists
  await loadFromGist();
  
  // Start auto-scraping after 10 seconds
  setTimeout(() => {
    autoRunning = true;
    autoScrapeLoop();
  }, 10000);
});
