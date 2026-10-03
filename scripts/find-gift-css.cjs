const fs = require('fs');
const css = fs.readFileSync('D:/Nuno/you-are-invited/apps/web/public/template-assets/webinvite.id/wp-content/litespeed/css/c589d9794a40e358f1240a9ca156fe73.css', 'utf8');

const targets = ['4e4e2e4', 'e235bc9', '988d142', 'f3ae310', 'amplop'];
targets.forEach(t => {
  const re = new RegExp(`[^{}]*${t}[^{}]*\\{[^{}]*\\}`, 'g');
  const matches = css.match(re) || [];
  console.log(`=== Matches for ${t} (${matches.length}) ===`);
  matches.forEach(m => console.log(m.replace(/\s+/g, ' ')));
});
