// Test calling WordStream's backend API directly — NO BROWSER!
const https = require('https');

// We need to find the exact request format. Let's try calling it directly.
function callWordStreamAPI(keyword, country = '2840') {
  return new Promise((resolve, reject) => {
    // The API might need specific params. Let's try different combinations.
    const params = new URLSearchParams({
      keyword: keyword,
      country: country, // 2840 = US
      industry: '',
      url: keyword
    });
    
    const url = `https://tools-backend.wordstream.com/api/free-tools/google/keywords?${params}`;
    
    console.log(`\n🔍 Trying: ${url}\n`);
    
    const req = https.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin': 'https://tools.wordstream.com',
        'Referer': 'https://tools.wordstream.com/',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers: ${JSON.stringify(res.headers).substring(0, 300)}`);
        console.log(`Body: ${data.substring(0, 2000)}`);
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Also try POST
function callWordStreamPOST(keyword) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ keyword, country: '2840', industry: '' });
    
    const req = https.request('https://tools-backend.wordstream.com/api/free-tools/google/keywords', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin': 'https://tools.wordstream.com',
        'Referer': 'https://tools.wordstream.com/',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`\nPOST Status: ${res.statusCode}`);
        console.log(`POST Body: ${data.substring(0, 2000)}`);
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('═══ TEST 1: GET with query params ═══');
  await callWordStreamAPI('car insurance quote');
  
  console.log('\n═══ TEST 2: POST with JSON body ═══');
  await callWordStreamPOST('car insurance quote');
  
  console.log('\n═══ TEST 3: GET different param names ═══');
  // Try website= (like the main page uses)
  const url2 = 'https://tools-backend.wordstream.com/api/free-tools/google/keywords?website=car+insurance+quote';
  const res = await new Promise((resolve, reject) => {
    https.get(url2, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://tools.wordstream.com',
        'Referer': 'https://tools.wordstream.com/',
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { console.log(`Status: ${r.statusCode}\nBody: ${d.substring(0, 1000)}`); resolve(d); });
    }).on('error', reject);
  });
})();
