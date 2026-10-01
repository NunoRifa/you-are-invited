const fs = require('fs');

const html = fs.readFileSync('D:/Nuno/you-are-invited-template/raden-motion/index.html', 'utf8');

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

scripts.forEach((s, idx) => {
  const content = s[2];
  if (content.includes('DOMContentLiteSpeedLoaded')) {
    console.log(`Script #${idx} LISTENS to or DISPATCHES DOMContentLiteSpeedLoaded`);
  }
});
