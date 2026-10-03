const http = require('http');

http.get('http://localhost:5173/i/raden-motion?to=Budi+Santoso', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Content Length:', data.length);
    console.log('Contains fetchNextWishesPage:', data.includes('fetchNextWishesPage'));
    console.log('Contains cui-container-comment-62777:', data.includes('cui-container-comment-62777'));
    console.log('Contains renderComments:', data.includes('renderComments'));
    console.log('Contains updateWishesLoadMoreButton:', data.includes('updateWishesLoadMoreButton'));
    console.log('Contains copyTextToClipboard:', data.includes('copyTextToClipboard'));
    console.log('Contains formatMapsUrl:', data.includes('formatMapsUrl'));
    console.log('Contains Wedding Live Hydration:', data.includes('Wedding Live Hydration'));
    console.log('Contains setupMapsButton:', data.includes('setupMapsButton'));
    console.log('Contains raden-mobile-fixes:', data.includes('raden-mobile-fixes'));
    console.log('Contains pointer-events none on flower image:', data.includes('.elementor-element-2a22411 *'));
    console.log('Target blank count in HTML:', (data.match(/target="_blank"/g) || []).length);

    // Check where cui-container-comment-62777 is located relative to form
    const formIdx = data.indexOf('id="commentform-62777"');
    const ulIdx = data.indexOf('id="cui-container-comment-62777"');
    console.log('Form position in HTML:', formIdx);
    console.log('Comment list UL position in HTML:', ulIdx);
    console.log('Is comment list AFTER form in DOM?', ulIdx > formIdx);
    // Test Anggi & Ivan route
    http.get('http://localhost:5173/i/anggi-ivan?to=Keluarga+Budi', (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('\n=== TESTING ANGI-IVAN HTML ROUTE (/i/anggi-ivan) ===');
        console.log('HTTP Status:', res2.statusCode);
        console.log('Content Length:', data2.length);
        console.log('Contains raden-engine:', data2.includes('raden-engine'));
        console.log('Contains setupMapsButton:', data2.includes('setupMapsButton'));
      });
    });
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
