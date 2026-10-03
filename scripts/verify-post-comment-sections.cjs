const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    }).on('error', reject);
  });
}

async function test() {
  console.log('=== VERIFYING SECTION AFTER COMMENTS ===');

  // 1. Check raden-motion (Master template with hashtag #RadenAyuForever)
  const raden = await get('http://localhost:5173/i/raden-motion?to=Budi+Santoso');
  console.log('Raden Motion HTTP:', raden.status);
  console.log('Has topHashtagSection toggle:', raden.html.includes('topHashtagSection.style.display'));
  console.log('Has renderVisualMedia:', raden.html.includes('renderVisualMedia'));
  console.log('Has animation_mobile check:', raden.html.includes('parsed.animation_mobile'));

  // 2. Check anggi-ivan (Client invitation without hashtag)
  const anggi = await get('http://localhost:5173/i/anggi-ivan?to=Budi+Santoso');
  console.log('\nAnggi & Ivan HTTP:', anggi.status);
  console.log('Has client topHashtagSection auto-hide:', anggi.html.includes('var topHashtagSection = document.querySelector(\'[data-id="70f3774"]\');'));
  console.log('Has client topLiveGiftSection auto-hide:', anggi.html.includes('var topLiveGiftSection = document.querySelector(\'[data-id="4e4e2e4"]\');'));
}

test().catch(console.error);
