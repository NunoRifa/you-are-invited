const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

// Find all elements with classes muncul, muncul-kiri, muncul-kanan, zoom, animated
const classRe = /class="([^"]*)"/gi;
const animClassSet = new Set();
const elementsWithAnim = [];

for (const m of html.matchAll(/<([a-z0-9]+)\b([^>]*class="[^"]*(muncul|zoom|animated|fade|slide|bounce)[^"]*"[^>]*)>/gi)) {
  const tag = m[1];
  const attrs = m[2];
  const cls = (attrs.match(/class="([^"]*)"/i) || [])[1] || '';
  const dataId = (attrs.match(/data-id="([^"]*)"/i) || [])[1] || '';
  elementsWithAnim.push({ tag, dataId, cls });
}

console.log(`Total elements with animation classes: ${elementsWithAnim.length}`);
console.log('\nFirst 20 elements:');
elementsWithAnim.slice(0, 20).forEach((e, i) => {
  console.log(`[${i}] <${e.tag}> data-id="${e.dataId}" class="${e.cls.split(' ').filter(c => /muncul|zoom|animated|invisible|fade|slide/.test(c)).join(' ')}"`);
});
