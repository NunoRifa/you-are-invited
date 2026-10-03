const fs = require('fs');
const path = require('path');

/**
 * Script untuk membuat subfolder produksi undangan khusus klien.
 * Menggandakan master template yang bersih, lalu mengonfigurasikannya
 * secara terisolasi ke apps/web/public/production/<slug>/index.html
 * tanpa mengubah master template aslinya.
 *
 * Penggunaan:
 *   node scripts/create-client-invitation.cjs <slug-klien> [nama-template]
 * Contoh:
 *   node scripts/create-client-invitation.cjs anggi-ivan raden-motion
 */

const slug = process.argv[2] || 'anggi-ivan';
const template = process.argv[3] || 'raden-motion';

const TEMPLATES_DIR = path.resolve(__dirname, '../apps/web/public/templates');
const PRODUCTION_DIR = path.resolve(__dirname, '../apps/web/public/production');
const DIST_I_DIR = path.resolve(__dirname, '../apps/web/dist/i');
const DIST_PROD_DIR = path.resolve(__dirname, '../apps/web/dist/production');

const templateHtmlPath = path.join(TEMPLATES_DIR, template, 'index.html');
if (!fs.existsSync(templateHtmlPath)) {
  console.error(`Error: Template "${template}" tidak ditemukan di ${templateHtmlPath}`);
  process.exit(1);
}

let html = fs.readFileSync(templateHtmlPath, 'utf8');

// 1. Kunci slug khusus untuk klien ini di dalam hydration script
html = html.replace(
  /var currentSlug\s*=\s*[^;]+;/g,
  `var currentSlug = ${JSON.stringify(slug)};`
);

// 2. Tambahkan logika penyesuaian otomatis untuk klien di subfolder produksi:
//    Menyembunyikan bagian yang datanya tidak diisi oleh klien (Galeri, Kisah Cinta, Hadiah, Live, Hashtag, dsb.)
const clientCustomizer = `
      // --- Client Production Customizer (Auto-hide empty client sections) ---
      // 1. Galeri
      var gallerySection = document.querySelector('[data-id="05364ca"]');
      if (gallerySection && (!payload.gallery || payload.gallery.length === 0)) {
        gallerySection.style.display = 'none';
      }

      // 2. Cerita Cinta
      var storySection = document.querySelector('[data-id="633fe11"]');
      if (storySection && (!storyList || storyList.length === 0)) {
        storySection.style.display = 'none';
      }

      // 3. Wedding Gift (Sembunyikan kartu kedua jika klien hanya punya 1 rekening)
      var giftSection = document.querySelector('[data-id="e235bc9"]');
      var hasGift = gifts && gifts.length > 0;
      if (giftSection && !hasGift) {
        giftSection.style.display = 'none';
      }
      if (giftSection && gifts && gifts.length === 1) {
        var secondCard = giftSection.querySelector('[data-id="743f3b6"]');
        if (secondCard) secondCard.style.display = 'none';
      }

      // 4. Wedding Live
      var liveSection = document.querySelector('[data-id="988d142"]');
      var hasLive = liveInfo && liveInfo.streamUrl && liveInfo.streamUrl.trim() !== '' && liveInfo.streamUrl !== '#';
      if (liveSection && !hasLive) {
        liveSection.style.display = 'none';
      }

      // If both Gift and Live are empty, hide the top section 4e4e2e4 so no empty gap is left
      var topLiveGiftSection = document.querySelector('[data-id="4e4e2e4"]');
      if (topLiveGiftSection && !hasGift && !hasLive) {
        topLiveGiftSection.style.display = 'none';
      }

      // 5. Wedding Hashtag (hide the entire top section 70f3774 so no 90vh empty gap is left)
      var topHashtagSection = document.querySelector('[data-id="70f3774"]');
      if (topHashtagSection && (!inv.hashtag || inv.hashtag.trim() === '')) {
        topHashtagSection.style.display = 'none';
      }

      // 6. Ikon Media Sosial
      var brideIg = document.querySelector('[data-id="8624cff"]');
      if (brideIg && (!bride.instagramHandle || bride.instagramHandle.trim() === '')) {
        brideIg.style.display = 'none';
      }
      var groomIg = document.querySelector('[data-id="46113a6"]');
      if (groomIg && (!groom.instagramHandle || groom.instagramHandle.trim() === '')) {
        groomIg.style.display = 'none';
      }
`;

// Sisipkan penyesuaian sebelum Countdown Timer Engine
html = html.replace('// Countdown Timer Engine', clientCustomizer + '\n      // Countdown Timer Engine');

// 3. Tulis ke folder produksi klien
const clientDir = path.join(PRODUCTION_DIR, slug);
fs.mkdirSync(clientDir, { recursive: true });
const targetFile = path.join(clientDir, 'index.html');
fs.writeFileSync(targetFile, html, 'utf8');
console.log(`[OK] Subfolder produksi klien berhasil dibuat: ${targetFile}`);

// 4. Sinkronkan ke dist jika dist sudah ada (untuk akses produksi langsung)
if (fs.existsSync(path.resolve(__dirname, '../apps/web/dist'))) {
  const distI = path.join(DIST_I_DIR, slug);
  fs.mkdirSync(distI, { recursive: true });
  fs.copyFileSync(targetFile, path.join(distI, 'index.html'));

  const distProd = path.join(DIST_PROD_DIR, slug);
  fs.mkdirSync(distProd, { recursive: true });
  fs.copyFileSync(targetFile, path.join(distProd, 'index.html'));
  console.log(`[OK] Disinkronkan ke build dist: /i/${slug} dan /production/${slug}`);
}

console.log(`\nUndangan klien "${slug}" siap diakses di:`);
console.log(`- Dev: http://localhost:5173/i/${slug}`);
console.log(`- Dev (direct subfolder): http://localhost:5173/production/${slug}/`);
console.log(`- Prod: https://you-are-invited.my.id/i/${slug}`);
console.log(`- Prod (direct subfolder): https://you-are-invited.my.id/production/${slug}/`);
