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
    console.log('Target blank count in HTML:', (data.match(/target="_blank"/g) || []).length);

    // Check where cui-container-comment-62777 is located relative to form
    const formIdx = data.indexOf('id="commentform-62777"');
    const ulIdx = data.indexOf('id="cui-container-comment-62777"');
    console.log('Form position in HTML:', formIdx);
    console.log('Comment list UL position in HTML:', ulIdx);
    console.log('Is comment list AFTER form in DOM?', ulIdx > formIdx);
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
