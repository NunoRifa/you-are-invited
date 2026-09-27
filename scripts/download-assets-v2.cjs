const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = 'D:/Nuno/you-are-invited/apps/web/public/template-assets';
const ASSET_RE = /\.(ttf|otf|woff2?|eot|png|jpe?g|gif|svg|webp|avif|mp3|mp4|mov|css|js|ico|cur|bmp)(\?|#|$)/i;

const pending = new Set();
const done = new Set();
const failed = [];

function localFor(url) {
  const u = new URL(url);
  let p = decodeURIComponent(u.pathname);
  return path.join(PUBLIC_DIR, u.hostname, p);
}

function enqueue(url) {
  const clean = url.split('#')[0];
  if (!/^https?:\/\//i.test(clean)) return;
  if (!ASSET_RE.test(clean)) return;
  if (done.has(clean) || pending.has(clean)) return;
  pending.add(clean);
}

async function fetchOne(url, outPath, referer) {
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return { url, status: 'cached', size: 0 };
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Accept: '*/*',
        Referer: referer || 'https://webinvite.id/',
      },
    });
    if (!res.ok) return { url, status: `http-${res.status}`, size: 0 };
    const buf = Buffer.from(await res.arrayBuffer());
    // Guard: a directory may already exist at this path
    if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
      return { url, status: 'path-is-directory', size: 0 };
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buf);
    return { url, status: 'ok', size: buf.length };
  } catch (e) {
    return { url, status: `err:${e.message}`, size: 0 };
  }
}

// Extract url() references from CSS text, resolving to absolute URLs
function extractCssUrls(cssText, cssUrl) {
  const out = [];
  for (const m of cssText.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    let raw = m[1].trim();
    if (!raw || raw.startsWith('data:')) continue;
    if (raw.startsWith('//')) raw = 'https:' + raw;
    else if (raw.startsWith('/')) raw = 'https://webinvite.id' + raw;
    else if (!/^https?:\/\//i.test(raw)) raw = new URL(raw, cssUrl).href;
    out.push(raw.split('#')[0]);
  }
  return out;
}

async function main() {
  // Seed from HTML files
  for (const slug of ['raden-motion', 'betawi-motion', 'arjuna-tema-foto']) {
    const html = fs.readFileSync(`D:/Nuno/you-are-invited-template/${slug}/index.html`, 'utf8');
    for (const m of html.matchAll(/https?:\/\/webinvite\.id\/[^"')\s\\]+/gi)) enqueue(m[0]);
  }
  console.log(`Seeded ${pending.size} URLs from HTML`);

  // BFS: download, and if a CSS file, mine it for more refs
  let round = 0;
  while (pending.size > 0) {
    round++;
    const batch = [...pending].filter((u) => !done.has(u));
    console.log(`\n-- Round ${round}: ${batch.length} URLs --`);

    let idx = 0;
    const results = [];
    const workers = Array.from({ length: 8 }, async () => {
      while (idx < batch.length) {
        const url = batch[idx++];
        const outPath = localFor(url);
        const r = await fetchOne(url, outPath);
        results.push({ ...r, outPath });
        done.add(url);
        pending.delete(url);
        if (!r.status.startsWith('ok') && r.status !== 'cached') failed.push(r);
      }
    });
    await Promise.all(workers);

    // Mine CSS files for further refs
    let newRefs = 0;
    for (const r of results) {
      if (!r.status.startsWith('ok') && r.status !== 'cached') continue;
      if (!r.outPath.toLowerCase().endsWith('.css')) continue;
      if (!fs.existsSync(r.outPath)) continue;
      const css = fs.readFileSync(r.outPath, 'utf8');
      for (const u of extractCssUrls(css, r.url)) {
        const before = pending.size;
        enqueue(u);
        if (pending.size > before) newRefs++;
      }
    }
    console.log(`   new refs discovered from CSS: ${newRefs}`);
    if (newRefs === 0) break;
  }

  const ok = done.size - failed.length;
  console.log(`\n=== DONE ===`);
  console.log(`Total processed : ${done.size}`);
  console.log(`Failed          : ${failed.length}`);
  if (failed.length) {
    fs.writeFileSync('D:/Nuno/you-are-invited/download-failures-v2.json', JSON.stringify(failed, null, 2));
    failed.slice(0, 40).forEach((f) => console.log(`  ${f.status}  ${f.url}`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
