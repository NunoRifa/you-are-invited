const fs = require('fs');
const path = require('path');

const TM = 'D:/Nuno/you-are-invited-template';
const CONV = 'D:/Nuno/you-are-invited/apps/web/public/templates';

console.log('=== VERIFIKASI KONVERSI 1:1 ===\n');

for (const slug of ['raden-motion', 'betawi-motion', 'arjuna-tema-foto']) {
  const orig = fs.readFileSync(`${TM}/${slug}/index.html`, 'utf8');
  const conv = fs.readFileSync(`${CONV}/${slug}/index.html`, 'utf8');

  // Extract just the body region for structural comparison
  const origBody = orig.slice(orig.indexOf('<body'), orig.indexOf('</body>'));
  const convBody = conv.slice(conv.indexOf('<body'), conv.indexOf('</body>'));

  // Count structural elements
  const count = (html, re) => (html.match(re) || []).length;

  const origSections = count(origBody, /class="[^"]*elementor-section[^"]*"/g);
  const convSections = count(convBody, /class="[^"]*elementor-section[^"]*"/g);

  const origWidgets = count(origBody, /class="[^"]*elementor-widget[^"]*"/g);
  const convWidgets = count(convBody, /class="[^"]*elementor-widget[^"]*"/g);

  // Body class must be preserved
  const origBodyTag = orig.match(/<body[^>]*>/)[0];
  const convBodyTag = conv.match(/<body[^>]*>/)[0];

  console.log(`--- ${slug} ---`);
  console.log(`  sections   : orig=${origSections}  conv=${convSections}  ${origSections === convSections ? 'MATCH' : 'DIFF'}`);
  console.log(`  widgets    : orig=${origWidgets}  conv=${convWidgets}  ${origWidgets === convWidgets ? 'MATCH' : 'DIFF'}`);
  console.log(`  body tag   : ${origBodyTag === convBodyTag ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`  body class : ${(origBodyTag.match(/class="([^"]*)"/) || [])[1] === (convBodyTag.match(/class="([^"]*)"/) || [])[1] ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log('');
}
