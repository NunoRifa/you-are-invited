const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

const idx = html.indexOf('class="modalx"');
const secIdx = html.lastIndexOf('<section', idx);
console.log('Section containing modalx:');
console.log(html.slice(secIdx, secIdx + 300).replace(/\s+/g, ' '));

const closeSecIdx = html.indexOf('</section>', idx);
console.log('End of section containing modalx:');
console.log(html.slice(closeSecIdx - 100, closeSecIdx + 20).replace(/\s+/g, ' '));
