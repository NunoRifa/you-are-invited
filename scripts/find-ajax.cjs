const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

// Find all occurrences of admin-ajax.php
console.log('--- admin-ajax.php contexts ---');
let i = 0;
while ((i = html.indexOf('admin-ajax.php', i)) !== -1) {
  console.log(html.slice(Math.max(0, i - 100), i + 200).replace(/\s+/g, ' '));
  console.log('------------------');
  i += 15;
}
