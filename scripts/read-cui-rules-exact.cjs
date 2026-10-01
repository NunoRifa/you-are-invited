const fs = require('fs');

const css = fs.readFileSync('D:/Nuno/you-are-invited/apps/web/public/template-assets/webinvite.id/wp-content/litespeed/css/c589d9794a40e358f1240a9ca156fe73.css', 'utf8');

// Find all CSS rules starting with .cui- or containing cui-comment
const rules = css.match(/[^{}]*cui-[^{}]*\{[^{}]*\}/g) || [];
console.log(`Found ${rules.length} cui rules:`);

// Filter rules relevant to comments list
rules.filter(r => /comment|author|date|avatar|content|item/i.test(r)).slice(0, 30).forEach(r => {
  console.log(r.replace(/\s+/g, ' '));
});
