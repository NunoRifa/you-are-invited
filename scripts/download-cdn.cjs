const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve('D:/Nuno/you-are-invited/apps/web/public/template-assets');

const CDN = [
  'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js',
];

function localFor(url) {
  const u = new URL(url);
  return path.join(PUBLIC_DIR, u.hostname, decodeURIComponent(u.pathname));
}

async function go() {
  for (const url of CDN) {
    const out = localFor(url);
    if (fs.existsSync(out) && fs.statSync(out).size > 0) {
      console.log(`cached  ${url}`);
      continue;
    }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) { console.log(`HTTP ${res.status}  ${url}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      console.log(`ok ${(buf.length / 1024).toFixed(1)} KB  ${url}`);
    } catch (e) {
      console.log(`err ${e.message}  ${url}`);
    }
  }
}
go();
