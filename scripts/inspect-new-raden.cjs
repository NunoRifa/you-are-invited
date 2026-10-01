const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

console.log('File size:', html.length);

// 1. External & inline scripts
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
console.log('\n--- Scripts count:', scripts.length, '---');
scripts.forEach((s, idx) => {
  const attr = s[1];
  const content = s[2].trim();
  const srcMatch = attr.match(/src=["']([^"']+)["']/i);
  const typeMatch = attr.match(/type=["']([^"']+)["']/i);
  const idMatch = attr.match(/id=["']([^"']+)["']/i);
  console.log(`#${idx}: id=${idMatch ? idMatch[1] : '-'} src=${srcMatch ? srcMatch[1] : 'INLINE'} type=${typeMatch ? typeMatch[1] : 'text/javascript'} len=${content.length}`);
  if (!srcMatch && content.length > 0) {
    console.log(`    preview: ${content.slice(0, 150).replace(/\s+/g, ' ')}`);
  }
});

// 2. Styles
const styles = [...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
console.log('\n--- Styles count:', styles.length, '---');
styles.forEach((s, idx) => {
  const attr = s[1];
  const idMatch = attr.match(/id=["']([^"']+)["']/i);
  console.log(`#${idx}: id=${idMatch ? idMatch[1] : '-'} len=${s[2].length}`);
});

// 3. Links (CSS, etc)
const links = [...html.matchAll(/<link\b([^>]*)>/gi)];
console.log('\n--- Links count:', links.length, '---');
links.forEach((l, idx) => {
  const rel = (l[1].match(/rel=["']([^"']+)["']/i) || [])[1];
  const href = (l[1].match(/href=["']([^"']+)["']/i) || [])[1];
  console.log(`#${idx}: rel=${rel} href=${href}`);
});

// 4. All URLs containing webinvite.id
const webinviteUrls = new Set();
for (const m of html.matchAll(/https?:\/\/webinvite\.id\/[^"')\s\\]+/gi)) {
  webinviteUrls.add(m[0].replace(/&amp;/g, '&'));
}
console.log('\n--- webinvite.id URLs count:', webinviteUrls.size, '---');
const sample = [...webinviteUrls].slice(0, 30);
sample.forEach(u => console.log('  ', u));
