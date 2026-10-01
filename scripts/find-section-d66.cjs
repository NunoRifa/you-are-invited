const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

const idx = html.indexOf('data-id="d66c9db"');
if (idx !== -1) {
  console.log('Section d66c9db content:');
  console.log(html.slice(idx, idx + 3500).replace(/\s+/g, ' '));
}
