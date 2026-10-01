const fs = require('fs');

const raw = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

// Let's find all script tags in raw
const scripts = [...raw.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

console.log('Total scripts in raw:', scripts.length);

// Let's find every occurrence of animation or scroll or observer
scripts.forEach((s, i) => {
  const code = s[2];
  if (code.includes('IntersectionObserver') || code.includes('muncul') || code.includes('animation') || code.includes('animate') || code.includes('openInvi') || code.includes('modalx')) {
    console.log(`\n=== Script #${i} ===`);
    console.log(code.trim());
  }
});
