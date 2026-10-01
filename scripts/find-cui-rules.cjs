const fs = require('fs');

const css = fs.readFileSync('D:/Nuno/you-are-invited/apps/web/public/template-assets/webinvite.id/wp-content/litespeed/css/c589d9794a40e358f1240a9ca156fe73.css', 'utf8');

const matches = [...css.matchAll(/([^{}]*cui[^{}]*)\{([^{}]+)\}/gi)];
console.log(`Found ${matches.length} cui rules:`);
matches.slice(0, 40).forEach(m => {
  const sel = m[1].replace(/\s+/g, ' ').trim();
  if (sel.includes('comment') || sel.includes('list') || sel.includes('item') || sel.includes('author') || sel.includes('text') || sel.includes('date') || sel.includes('badge')) {
    console.log(`${sel} { ${m[2].replace(/\s+/g, ' ').trim()} }`);
  }
});
