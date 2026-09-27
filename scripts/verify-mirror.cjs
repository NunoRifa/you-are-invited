const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve('D:/Nuno/you-are-invited/apps/web/public/template-assets');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(PUBLIC_DIR);
let total = 0;
const byExt = {};
for (const f of files) {
  const size = fs.statSync(f).size;
  total += size;
  const ext = path.extname(f).toLowerCase() || '(none)';
  byExt[ext] = byExt[ext] || { count: 0, size: 0 };
  byExt[ext].count++;
  byExt[ext].size += size;
}

console.log(`Total files: ${files.length}`);
console.log(`Total size : ${(total / 1024 / 1024).toFixed(2)} MB\n`);
console.log('By extension:');
Object.entries(byExt)
  .sort((a, b) => b[1].size - a[1].size)
  .forEach(([ext, v]) => console.log(`  ${ext.padEnd(8)} ${String(v.count).padStart(4)} files  ${(v.size / 1024 / 1024).toFixed(2).padStart(8)} MB`));

// Verify the 6 previously-failed fonts now exist
console.log('\n=== Font files previously failing ===');
const checks = [
  'webinvite.id/wp-content/plugins/weddingpress/addons/comment-kit2/css/fonts/cuifont.ttf',
  'webinvite.id/wp-content/plugins/weddingpress/addons/comment-kit2/css/fonts/cuifont.woff',
  'webinvite.id/wp-content/plugins/weddingpress/assets/font/font.woff',
  'webinvite.id/wp-content/plugins/weddingpress/assets/font/font-v2.woff',
];
for (const c of checks) {
  const full = path.join(PUBLIC_DIR, c);
  console.log(`  ${fs.existsSync(full) ? 'OK  ' : 'MISS'} ${c}`);
}

// Key template assets present?
console.log('\n=== Key visuals ===');
const key = [
  'webinvite.id/wp-content/uploads/2025/10/Raden-cpw.png',
  'webinvite.id/wp-content/uploads/2025/10/Wayang-Raden.png',
  'webinvite.id/wp-content/uploads/2025/06/bismillah.png',
  'webinvite.id/wp-content/uploads/2025/11/raden-02-vid-motion-1.mp4',
  'webinvite.id/wp-content/uploads/2025/11/BETAWI-VID-2.mp4',
  'webinvite.id/wp-content/uploads/2025/07/Kabagyan-Sadewok-Official-Music-Video-mp3cut.net_.mp3',
];
for (const c of key) {
  const full = path.join(PUBLIC_DIR, c);
  const ok = fs.existsSync(full);
  console.log(`  ${ok ? 'OK  ' : 'MISS'} ${(ok ? (fs.statSync(full).size / 1024).toFixed(0) + ' KB' : '').padEnd(9)} ${c.split('/uploads/')[1] || c}`);
}
