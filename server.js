// ═══════════════════════════════════════════════════════════════
//  KEYWORD SCRAPER v6 — DIRECT API + RECAPTCHA TOKEN
//  ✅ Calls WordStream backend API directly (no UI interaction!)
//  ✅ Uses Playwright ONLY to generate reCAPTCHA tokens
//  ✅ 25 keywords per API call in clean JSON
//  ✅ Browser rotation every 10 keywords
//  ✅ Saves to GitHub Gist
//  ✅ Multi-country (US → UK → CA → AU → DE)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const { chromium } = require('playwright-core');
const sparticuzChromium = require('@sparticuz/chromium');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ GITHUB GIST CONFIG ═══
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
let GIST_ID = process.env.GIST_ID || '';

// ═══ STATE ═══
let allResults = [];
let totalSaved = 0;
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
let searchesSinceBrowserRotation = 0;

// Browser session for reCAPTCHA tokens
let activeBrowser = null;
let activePage = null;
let tokenCount = 0;

// ═══ COUNTRY LOCATION IDS (Google Ads geo targets) ═══
const COUNTRY_LOCATIONS = {
  'US': [2840],
  'UK': [2826],
  'CA': [2124],
  'AU': [2036],
  'DE': [2276]
};

// ═══ COUNTRIES + SEEDS ═══
const COUNTRIES = [
  {
    code: 'US', name: 'United States',
    seeds: [
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
      "loan comparison calculator","debt consolidation calculator","credit card payoff calculator",
      "student loan refinance calculator","business loan calculator","sba loan calculator",
      "commercial loan calculator","hard money loan calculator","bridge loan calculator",
      "merchant cash advance calculator","equipment financing calculator","factoring calculator",
      "heloc calculator","home equity loan calculator","fha loan calculator",
      "va loan calculator","jumbo loan calculator","construction loan calculator",
      "land loan calculator","personal loan calculator","payday loan calculator",
      "payroll tax calculator","salary calculator","tax estimator","federal tax calculator",
      "1099 tax calculator","self employment tax calculator","capital gains tax calculator",
      "estate tax calculator","gift tax calculator","property tax calculator",
      "sales tax calculator","tax bracket calculator","tax deduction calculator",
      "tax refund calculator","inheritance tax calculator","w2 calculator",
      "tax withholding calculator","income tax calculator","quarterly tax calculator",
      "depreciation calculator","bonus tax calculator","stock option tax calculator",
      "crypto tax calculator","rental income tax calculator","agi calculator",
      "investment calculator","stock calculator","roi calculator","dividend calculator",
      "bond yield calculator","mutual fund calculator","cd calculator","annuity calculator",
      "present value calculator","future value calculator","stock return calculator",
      "options profit calculator","forex calculator","etf calculator",
      "dollar cost averaging calculator","margin calculator","cryptocurrency calculator",
      "retirement calculator","401k calculator","roth ira calculator","pension calculator",
      "social security calculator","ira calculator","retirement savings calculator",
      "early retirement calculator","rmd calculator","sep ira calculator",
      "403b calculator","fire calculator","coast fire calculator",
      "car payment calculator","auto loan calculator","car lease calculator",
      "car depreciation calculator","auto refinance calculator","gas mileage calculator",
      "car insurance calculator","vehicle trade in value calculator",
      "car affordability calculator","electric vehicle cost calculator",
      "compound interest calculator","savings calculator","inflation calculator",
      "high yield savings calculator","savings goal calculator","emergency fund calculator",
      "calorie calculator","bmi calculator","tdee calculator","macro calculator",
      "body fat calculator","protein calculator","pregnancy due date calculator",
      "ideal weight calculator","ovulation calculator","blood alcohol calculator",
      "rental property calculator","airbnb calculator","rent vs buy calculator",
      "real estate roi calculator","flip calculator","cash on cash return calculator",
      "mortgage affordability calculator","closing cost calculator",
      "cap rate calculator","gross rent multiplier calculator",
      "debt payoff calculator","credit card interest calculator","balance transfer calculator",
      "debt avalanche calculator","debt snowball calculator","net worth calculator",
      "solar panel calculator","electricity cost calculator","pool cost calculator",
      "roofing calculator","fence calculator","flooring calculator","paint calculator",
      "square footage calculator","concrete calculator","gravel calculator",
      "deck cost calculator","bathroom remodel calculator","kitchen remodel calculator",
      "tip calculator","percentage calculator","discount calculator",
      "shipping cost calculator","import duty calculator","cost of living calculator",
      "moving cost calculator","wedding cost calculator","college cost calculator",
      "child support calculator","alimony calculator","workers comp settlement calculator"
    ]
  },
  {
    code: 'UK', name: 'United Kingdom',
    seeds: [
      "personal injury claim calculator","car accident claim uk","road traffic accident solicitor",
      "whiplash claim calculator","workplace injury claim","slip trip fall compensation",
      "medical negligence solicitor","industrial disease claim","asbestos claim solicitor",
      "car insurance comparison uk","home insurance comparison uk","life insurance uk",
      "mortgage calculator uk","stamp duty calculator","inheritance tax calculator uk",
      "pension calculator uk","salary calculator uk","tax calculator uk",
      "compound interest calculator uk","savings calculator uk","investment calculator uk",
      "rental yield calculator uk","buy to let mortgage calculator",
      "solar panel calculator uk","energy cost calculator uk","boiler cost calculator"
    ]
  },
  {
    code: 'CA', name: 'Canada',
    seeds: [
      "personal injury lawyer canada","car accident lawyer toronto","slip and fall lawyer ontario",
      "car insurance ontario","home insurance canada","life insurance canada",
      "mortgage calculator canada","rrsp calculator","tfsa calculator",
      "income tax calculator canada","gst hst calculator","cpp calculator",
      "rental yield calculator canada","property tax calculator ontario",
      "solar panel calculator canada","hydro cost calculator"
    ]
  },
  {
    code: 'AU', name: 'Australia',
    seeds: [
      "personal injury lawyer australia","car accident lawyer sydney",
      "workers compensation lawyer nsw","medical negligence lawyer australia",
      "car insurance comparison australia","home insurance australia",
      "mortgage calculator australia","income tax calculator australia",
      "stamp duty calculator nsw","superannuation calculator",
      "rental yield calculator australia","lmi calculator",
      "solar panel calculator australia","electricity cost calculator australia"
    ]
  },
  {
    code: 'DE', name: 'Germany',
    seeds: [
      "tax calculator germany","income tax germany","salary calculator germany",
      "health insurance germany","car insurance germany","mortgage calculator germany",
      "pension calculator germany","investment calculator germany",
      "cost of living germany","solar panel calculator germany"
    ]
  }
];

// ═══ ALREADY DONE ═══
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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

// ═══════════════════════════════════════════════════════════════
//  GITHUB GIST STORAGE
// ═══════════════════════════════════════════════════════════════
function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.github.com', path, method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'KeywordScraper',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(body); } });
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
    const csv = 'Keyword,Volume,CPC_Low,CPC_High,Competition,CompetitionIndex,Seed,Country\n' +
      allResults.map(r =>
        `"${(r.keyword||'').replace(/"/g,"'")}","${r.volume}","${r.cpcLow}","${r.cpcHigh}","${r.competition}","${r.competitionIndex}","${(r.seed||'').replace(/"/g,"'")}","${r.country}"`
      ).join('\n');
    
    const stateData = JSON.stringify({
      searchedKeys: [...searchedKeys], currentCountryIdx, currentSeedIdx,
      totalSearches, stats, totalSaved: totalSaved + allResults.length,
      lastRun, timestamp: new Date().toISOString()
    });
    
    const files = {};
    files[`batch_${String(batch).padStart(3,'0')}.csv`] = { content: csv };
    files['state.json'] = { content: stateData };
    
    if (!GIST_ID) {
      const gist = await githubRequest('POST', '/gists', {
        description: `Keyword Scraper Data — ${new Date().toISOString()}`,
        public: false, files
      });
      if (gist.id) { GIST_ID = gist.id; console.log(`  💾 Gist created: ${GIST_ID}`); }
      else { console.log(`  ❌ Gist create failed`); return; }
    } else {
      await githubRequest('PATCH', `/gists/${GIST_ID}`, { files });
      console.log(`  💾 Gist updated: batch ${batch} (${allResults.length} kw)`);
    }
    totalSaved += allResults.length;
    stats.saved++;
    allResults = [];
  } catch(err) { console.log(`  ❌ Gist error: ${err.message}`); lastError = `Gist: ${err.message}`; }
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
      console.log(`  📂 Loaded: ${searchedKeys.size} searched, ${totalSaved} saved`);
    }
  } catch(err) { console.log(`  ⚠️ Load state failed: ${err.message}`); }
}

// ═══════════════════════════════════════════════════════════════
//  BROWSER SESSION — Only for reCAPTCHA tokens
// ═══════════════════════════════════════════════════════════════
async function createBrowserSession() {
  console.log('  🌐 Creating browser session for reCAPTCHA...');
  
  if (activeBrowser) {
    try { await activeBrowser.close(); } catch(e) {}
    activeBrowser = null;
    activePage = null;
  }
  
  const execPath = await sparticuzChromium.executablePath();
  const ua = UAS[Math.floor(Math.random() * UAS.length)];
  
  activeBrowser = await chromium.launch({
    executablePath: execPath,
    headless: true,
    args: [...sparticuzChromium.args, '--disable-blink-features=AutomationControlled']
  });
  
  const ctx = await activeBrowser.newContext({
    userAgent: ua,
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    bypassCSP: true
  });
  
  activePage = await ctx.newPage();
  
  // Stealth
  await activePage.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  
  // Navigate to WordStream tools page to load reCAPTCHA
  await activePage.goto('https://tools.wordstream.com/fkt?website=test', {
    waitUntil: 'networkidle', timeout: 45000
  });
  await activePage.waitForTimeout(3000);
  
  // Accept cookies
  await activePage.evaluate(() => {
    const btn = document.getElementById('onetrust-accept-btn-handler');
    if (btn) btn.click();
  });
  await activePage.waitForTimeout(1000);
  
  tokenCount = 0;
  console.log('  🌐 ✅ Browser session ready');
}

async function getRecaptchaToken() {
  if (!activePage) await createBrowserSession();
  
  try {
    // Execute reCAPTCHA v3 to get a fresh token
    const token = await activePage.evaluate(() => {
      return new Promise((resolve, reject) => {
        if (typeof grecaptcha === 'undefined') {
          reject(new Error('grecaptcha not loaded'));
          return;
        }
        grecaptcha.ready(() => {
          // Find the site key from the page
          const siteKey = document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') 
            || document.querySelector('.g-recaptcha')?.getAttribute('data-sitekey')
            || '6LdKVRcqAAAAAOiLRWz_1OkX5S3QA-M8uFfNnksp'; // fallback
          
          grecaptcha.execute(siteKey, { action: 'fkt_search' })
            .then(token => resolve(token))
            .catch(err => reject(err));
        });
      });
    });
    
    tokenCount++;
    return token;
  } catch(err) {
    console.log(`  ⚠️ reCAPTCHA failed: ${err.message} — recreating session`);
    await createBrowserSession();
    
    // Retry once
    try {
      const token = await activePage.evaluate(() => {
        return new Promise((resolve, reject) => {
          if (typeof grecaptcha === 'undefined') {
            reject(new Error('grecaptcha not loaded'));
            return;
          }
          grecaptcha.ready(() => {
            grecaptcha.execute(document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') || '6LdKVRcqAAAAAOiLRWz_1OkX5S3QA-M8uFfNnksp', { action: 'fkt_search' })
              .then(resolve)
              .catch(reject);
          });
        });
      });
      tokenCount++;
      return token;
    } catch(e) {
      throw new Error(`reCAPTCHA failed after retry: ${e.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  DIRECT API CALL — No UI interaction!
// ═══════════════════════════════════════════════════════════════
function callWordStreamAPI(keyword, locationIds, recaptchaToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ keyword, locationIds });
    
    const req = https.request('https://tools-backend.wordstream.com/api/free-tools/google/keywords', {
      method: 'POST',
      headers: {
        'User-Agent': UAS[Math.floor(Math.random() * UAS.length)],
        'Origin': 'https://tools.wordstream.com',
        'Referer': 'https://tools.wordstream.com/',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'recaptcha': recaptchaToken,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch(e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
//  CORE SCRAPER — Token + API call
// ═══════════════════════════════════════════════════════════════
async function scrapeKeyword(keyword, country) {
  const t0 = Date.now();
  
  try {
    // Step 1: Get reCAPTCHA token
    console.log(`    [1/3] Get reCAPTCHA token...`);
    const token = await getRecaptchaToken();
    console.log(`    [1/3] ✅ Token (${token.substring(0, 20)}...)`);
    
    // Step 2: Call API directly
    console.log(`    [2/3] Call API...`);
    const locationIds = COUNTRY_LOCATIONS[country.code] || [2840];
    const result = await callWordStreamAPI(keyword, locationIds, token);
    
    if (result.status !== 200) {
      console.log(`    [2/3] ❌ API ${result.status}: ${JSON.stringify(result.data).substring(0, 200)}`);
      return { status: 'error', keyword, country: country.code, data: [],
               error: `API ${result.status}`, ms: Date.now() - t0 };
    }
    
    // Step 3: Parse results
    console.log(`    [3/3] Parse results...`);
    const keywords = result.data.keywords || [];
    const data = keywords.map(kw => ({
      keyword: kw.keywordText,
      volume: kw.searchVolume,
      cpcLow: kw.lowTopPageBid,
      cpcHigh: kw.highTopPageBid,
      competition: kw.competition,
      competitionIndex: kw.competitionIndex,
      seed: keyword,
      country: country.code
    }));
    
    console.log(`    [3/3] ✅ ${data.length} keywords (${Math.round((Date.now()-t0)/1000)}s)`);
    return { status: data.length > 0 ? 'ok' : 'no_results', keyword, country: country.code, 
             data, ms: Date.now() - t0 };
    
  } catch(err) {
    return { status: 'error', keyword, country: country.code, data: [],
             error: err.message.substring(0, 150), ms: Date.now() - t0 };
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
        searchedKeys.add(key); stats.skipped++; continue;
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
  if (isRunning) return { msg: 'Already running' };
  
  const next = getNextKeyword();
  if (!next) {
    autoRunning = false;
    return { msg: '🏁 ALL DONE!', stats, totalKeywords: totalSaved + allResults.length };
  }
  
  isRunning = true;
  const { keyword, country } = next;
  const key = `${keyword.toLowerCase()}|${country.code}`;
  totalSearches++;
  searchesSinceBrowserRotation++;
  
  console.log(`\n[${totalSearches}] 🌍${country.code} "${keyword}"`);
  
  const result = await scrapeKeyword(keyword, country);
  lastRun = new Date().toISOString();
  
  if (result.status === 'ok') {
    allResults.push(...result.data);
    searchedKeys.add(key);
    stats.ok++;
    consecutiveFails = 0;
    console.log(`  ✅ ${result.data.length} kw (${Math.round(result.ms/1000)}s) | Batch: ${allResults.length} | Total: ${totalSaved + allResults.length}`);
  } else if (result.status === 'no_results') {
    searchedKeys.add(key);
    stats.noResults++;
    consecutiveFails = 0;
    console.log(`  📭 no results (${Math.round(result.ms/1000)}s)`);
  } else {
    stats.fails++;
    consecutiveFails++;
    lastError = result.error || result.status;
    console.log(`  ⚠️ ${result.status}: ${result.error || ''} (${Math.round(result.ms/1000)}s)`);
  }
  
  // Auto-save every 25 keywords
  if (allResults.length >= 25) {
    console.log(`\n  💾 Saving ${allResults.length} keywords...`);
    await saveToGist();
  }
  
  // Browser rotation every 10 keywords
  if (searchesSinceBrowserRotation >= 10) {
    console.log(`  🔄 Rotating browser session...`);
    await createBrowserSession();
    searchesSinceBrowserRotation = 0;
  }
  
  isRunning = false;
  return {
    keyword, country: country.code, status: result.status,
    extracted: result.data.length, batchKeywords: allResults.length,
    totalKeywords: totalSaved + allResults.length, search: totalSearches
  };
}

// ═══ AUTO SCRAPE LOOP ═══
async function autoScrapeLoop() {
  console.log('\n🟢 Auto-scrape loop started\n');
  
  // Create initial browser session
  try {
    await createBrowserSession();
  } catch(err) {
    console.log(`  ❌ Initial browser failed: ${err.message}`);
    lastError = err.message;
  }
  
  while (autoRunning) {
    if (!isRunning) {
      const result = await scrapeNext();
      
      if (result.msg && result.msg.includes('DONE')) {
        if (allResults.length > 0) await saveToGist();
        console.log('\n🏁 ALL COMPLETE!\n');
        break;
      }
      
      // Smart delay — API calls are fast, so shorter delays
      let delay;
      if (consecutiveFails >= 5) {
        delay = 180000; // 3 min cooldown
        console.log(`  🔴 5+ fails — cooling 3min`);
      } else if (consecutiveFails >= 3) {
        delay = 90000; // 1.5 min
        console.log(`  🟡 3+ fails — cooling 90s`);
      } else {
        // Normal: 20-40 seconds between calls (much faster than before!)
        delay = 20000 + Math.random() * 20000;
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
    status: autoRunning ? '🟢 AUTO-SCRAPING (v6 API MODE)' : '🔴 STOPPED',
    mode: 'DIRECT API — No UI interaction!',
    uptime: `${uptime} min (${(uptime/60).toFixed(1)} hrs)`,
    currentCountry: `${c.name} (${c.code})`,
    seedProgress: `${currentSeedIdx}/${c.seeds.length}`,
    countryProgress: `${currentCountryIdx + 1}/${COUNTRIES.length}`,
    totalSeeds,
    batchKeywords: allResults.length,
    totalKeywords: totalSaved + allResults.length,
    totalSearches,
    searchedSeeds: searchedKeys.size,
    browserSession: `tokens: ${tokenCount}, rotation in: ${10 - searchesSinceBrowserRotation}`,
    gistId: GIST_ID || 'not created yet',
    stats, isRunning, lastRun, consecutiveFails, lastError,
    eta: `~${Math.round((totalSeeds - totalSearches - stats.skipped) * 30 / 3600)} hours`
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
  let csv = 'Keyword,Volume,CPC_Low,CPC_High,Competition,CompetitionIndex,Seed,Country\n';
  allResults.forEach(r => {
    csv += `"${(r.keyword||'').replace(/"/g,"'")}","${r.volume}","${r.cpcLow}","${r.cpcHigh}","${r.competition}","${r.competitionIndex}","${(r.seed||'').replace(/"/g,"'")}","${r.country}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=keywords.csv');
  res.send(csv);
});

app.get('/top', (req, res) => {
  const sorted = [...allResults]
    .filter(r => r.cpcHigh > 0)
    .sort((a, b) => b.cpcHigh - a.cpcHigh)
    .slice(0, 100);
  res.json({ top100: sorted });
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
  console.log(`  🚀 KEYWORD SCRAPER v6 — DIRECT API MODE`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Mode:       DIRECT API (no UI clicks!)`);
  console.log(`  Seeds:      ${totalSeeds} across ${COUNTRIES.length} countries`);
  console.log(`  Max KW:     ${totalSeeds * 25} (${totalSeeds} × 25 per search)`);
  console.log(`  Rotation:   New browser every 10 keywords`);
  console.log(`  Speed:      ~2 keywords/minute (3x faster!)`);
  console.log(`  ETA:        ~${Math.round(totalSeeds * 30 / 3600)} hours`);
  console.log(`  Storage:    GitHub Gist`);
  console.log(`${'═'.repeat(55)}\n`);
  
  await loadFromGist();
  
  setTimeout(() => {
    autoRunning = true;
    autoScrapeLoop();
  }, 10000);
});
