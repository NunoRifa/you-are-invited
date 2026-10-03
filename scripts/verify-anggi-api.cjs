const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('=== TESTING /api/invitations/anggi-ivan ===');
  const res = await get('http://localhost:5173/api/invitations/anggi-ivan');
  console.log('Status via Vite Proxy (5173):', res.status);
  if (res.status === 200) {
    const p = res.data;
    console.log('Invitation Title:', p.invitation?.title);
    console.log('Template Key:', p.invitation?.templateKey);
    console.log('Opening Text:', p.invitation?.openingGreetingText);
    console.log('Quote:', p.invitation?.quoteText);
    console.log('Quote Source:', p.invitation?.quoteSource);
    console.log('\nCouples:');
    p.couples?.forEach(c => {
      console.log(`  [${c.role}] ${c.fullName} (${c.displayName}) - ${c.birthOrderLabel} dari ${c.fatherName} & ${c.motherName}`);
    });
    console.log('\nEvents:');
    p.events?.forEach(e => {
      console.log(`  [${e.label}] ${e.date} (${e.startTime} - ${e.endTimeLabel}) at ${e.venueName}`);
      console.log(`    Maps: ${e.mapsUrl}`);
    });
    console.log('\nGallery count:', p.gallery?.length);
    console.log('Story count:', p.story?.length);
    console.log('Gift accounts count:', p.giftAccounts?.length);
    console.log('Livestream:', p.livestream);
    console.log('Wishes count:', p.wishes?.length);
  } else {
    console.log('Error:', res);
  }
}

test().catch(console.error);
