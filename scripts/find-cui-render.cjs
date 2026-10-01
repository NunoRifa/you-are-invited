const fs = require('fs');

const js = fs.readFileSync('D:/Nuno/you-are-invited/apps/web/public/template-assets/webinvite.id/wp-content/litespeed/js/e45d004d452844bc4d95553a190146fd.js', 'utf8');

const idx = js.indexOf('cui-container-comment');
console.log('cui-container-comment at index:', idx);
if (idx !== -1) {
  console.log(js.slice(Math.max(0, idx - 500), idx + 1500).replace(/\s+/g, ' '));
}

const idx2 = js.indexOf('cui-comment-text');
console.log('cui-comment-text at index:', idx2);
if (idx2 !== -1) {
  console.log(js.slice(Math.max(0, idx2 - 500), idx2 + 1500).replace(/\s+/g, ' '));
}
