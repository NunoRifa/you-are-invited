const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

// Find all text nodes that have readable Indonesian/English text
const textRegex = />([^<]{3,})</g;
const texts = [];
for (const m of html.matchAll(textRegex)) {
  const t = m[1].trim();
  if (t && !t.startsWith('{') && !t.startsWith('var ') && !t.startsWith('function') && !t.includes(';') && !t.includes('/*') && t.length > 2) {
    texts.push(t);
  }
}

console.log('Total text candidate nodes:', texts.length);
// Filter unique and print them
const uniq = [...new Set(texts)];
console.log('Unique text nodes:');
uniq.slice(0, 80).forEach((t, i) => console.log(`${i+1}. ${t}`));
