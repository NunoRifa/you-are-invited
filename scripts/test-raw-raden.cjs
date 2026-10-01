const fs = require('fs');
const path = require('path');

const src = 'D:/Nuno/you-are-invited-template/raden-motion/index.html';
const dest = 'D:/Nuno/you-are-invited/apps/web/public/templates/raden-motion/index.html';

let html = fs.readFileSync(src, 'utf8');

// Only rewrite asset URLs to local mirror
html = html.replace(/https?:\/\/webinvite\.id\//g, '/template-assets/webinvite.id/');
html = html.replace(/https?:\/\/unpkg\.com\//g, '/template-assets/unpkg.com/');
html = html.replace(/https?:\/\/cdnjs\.cloudflare\.com\//g, '/template-assets/cdnjs.cloudflare.com/');

// Write to public/templates/raden-motion/index.html
fs.writeFileSync(dest, html, 'utf8');

console.log('Written raw raden-motion with asset URLs rewritten. Length:', html.length);
