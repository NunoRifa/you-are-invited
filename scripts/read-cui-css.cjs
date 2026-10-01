const fs = require('fs');

const css = fs.readFileSync('D:/Nuno/you-are-invited/apps/web/public/template-assets/webinvite.id/wp-content/litespeed/css/c589d9794a40e358f1240a9ca156fe73.css', 'utf8');

const idx = css.indexOf('.cui-comment-text');
if (idx !== -1) {
  console.log(css.slice(Math.max(0, idx - 400), idx + 800));
}
