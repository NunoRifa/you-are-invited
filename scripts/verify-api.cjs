const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('=== TESTING API ENDPOINTS ===');
  try {
    const wishesRes = await get('http://localhost:3000/api/invitations/raden-motion/wishes?limit=10');
    console.log('GET /api/invitations/raden-motion/wishes?limit=10 status:', wishesRes.status);
    console.log('Returned wishes count:', wishesRes.body?.data?.length);
    console.log('Next cursor:', wishesRes.body?.nextCursor);
    console.log('Wishes data:', JSON.stringify(wishesRes.body?.data, null, 2));

    const invRes = await get('http://localhost:3000/api/invitations/raden-motion');
    console.log('\nGET /api/invitations/raden-motion status:', invRes.status);
    console.log('Wish summary in payload:', JSON.stringify(invRes.body?.wishSummary, null, 2));
    console.log('Wishes in payload:', invRes.body?.wishes?.length);
    console.log('Livestream in payload:', JSON.stringify(invRes.body?.livestream, null, 2));
  } catch (err) {
    console.error('API check error:', err.message);
  }

  console.log('\n=== TESTING VITE PROXY (PORT 5173) ===');
  try {
    const viteRes = await get('http://localhost:5173/api/invitations/raden-motion/wishes?limit=10');
    console.log('Via Vite proxy status:', viteRes.status);
    console.log('Via Vite proxy count:', viteRes.body?.data?.length);
  } catch(err) {
    console.error('Vite proxy check error:', err.message);
  }
}

test();
