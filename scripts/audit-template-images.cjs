const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../apps/web/public/templates/raden-motion/index.html');
const html = fs.readFileSync(filePath, 'utf8');

const imgRegex = /<img[^>]+>/gi;
let m;
let i = 1;
while ((m = imgRegex.exec(html)) !== null) {
  const tag = m[0];
  const dataSrcMatch = tag.match(/data-src=["']([^"']+)["']/i);
  const srcMatch = tag.match(/\ssrc=["']([^"']+)["']/i);
  let src = '';
  if (dataSrcMatch && !dataSrcMatch[1].startsWith('data:')) {
    src = dataSrcMatch[1];
  } else if (srcMatch && !srcMatch[1].startsWith('data:')) {
    src = srcMatch[1];
  }

  if (src) {
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    const chunkBefore = html.slice(Math.max(0, m.index - 500), m.index);
    const dataIds = chunkBefore.match(/data-id=["']([a-f0-9]+)["']/gi) || [];
    const parentId = dataIds.pop();
    console.log(`[${i++}] ${parentId} | alt="${alt}" | ${src}`);
  }
}
