# You Are Invited — Standalone Digital Wedding Platform

Platform undangan pernikahan digital multi-template, mandiri (*self-hosted*), dan multi-tenant. Dibangun menggantikan stack lama berbasis WordPress, Elementor, dan plugin komersial `weddingpress`.

> ## ⚠️ Aturan Baku: Zero Visual Modification
> Seluruh template undangan adalah **HTML asli dari vendor** yang hanya di-*rewrite* URL asetnya ke mirror lokal dan disuntik lapisan hidrasi data. **Markup, CSS, font, ornamen, animasi, dan layout tidak boleh diubah sama sekali.** Lihat `CLAUDE.md`.

## Arsitektur Monorepo

```
you-are-invited/
├── apps/
│   ├── web/                              # React + TypeScript + Vite + TailwindCSS
│   │   ├── public/
│   │   │   ├── templates/{slug}/         # HTML ASLI per template (jangan diedit manual)
│   │   │   └── template-assets/          # Mirror 419 aset (font, ornamen, audio, video)
│   │   ├── scripts/                      # Pipeline konversi & verifikasi (lihat di bawah)
│   │   ├── vite-plugin-invitation.ts     # Serve /i/:slug dari HTML asli
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── admin/                # Dashboard pengelola
│   │       │   └── landing/              # Halaman showcase & katalog
│   │       └── lib/api-client.ts
│   └── api/                              # Backend Hono + Drizzle ORM + SQLite
│       └── src/
│           ├── db/                       # Skema 12 entitas Drizzle + seeder
│           └── routes/                   # Endpoint REST /api/invitations, /api/templates, dll.
├── packages/
│   └── shared-types/                     # Kontrak tipe TypeScript (Invitation, Template, dll.)
├── storage/
│   ├── db/app.sqlite                     # Database SQLite lokal (WAL mode)
│   └── uploads/                          # Direktori penyimpanan media (foto/musik)
├── scripts/                              # Pipeline aset & konversi template
├── docker/                               # Dockerfile API & Web + konfigurasi Nginx
└── docker-compose.yml
```

## Cara Kerja Konversi Template (1:1)

Template **tidak** ditulis ulang menjadi komponen React. Sebaliknya:

1. **Mirror aset** (`scripts/download-assets-v2.cjs`) mengunduh seluruh aset dari `webinvite.id`
   (font, gambar ornamen, audio, video) plus aset yang dirujuk dari dalam file CSS,
   ke `apps/web/public/template-assets/webinvite.id/...` — **419 file, ~193 MB**.
2. **Konversi** (`scripts/convert-templates.cjs`) melakukan **hanya 4 hal** pada HTML asli:
   - Rewrite URL aset absolut → `/template-assets/<host>/...`
   - Ubah `type="litespeed/javascript"` → `<script>` agar JS ikut jalan tanpa LiteSpeed
   - Cegah form komentar POST ke `wp-comments-post.php` asal
   - Suntik `<script id="wdp-hydrate">` yang menarik data dari REST API dan mengisi
     `.namatamu`, `data-clipboard-text`, dan `window.__WDP_DATA__`
3. **Verifikasi** (`scripts/verify-fidelity.cjs`) membandingkan jumlah section & widget
   antara sumber asli dan hasil konversi — harus **MATCH** persis.

### Hasil Verifikasi Fidelity

| Template | Section | Widget | Body Class |
|---|---|---|---|
| raden-motion | 30 / 30 ✅ | 224 / 224 ✅ | IDENTICAL |
| betawi-motion | 32 / 32 ✅ | 240 / 240 ✅ | IDENTICAL |
| arjuna-tema-foto | 34 / 34 ✅ | 232 / 232 ✅ | IDENTICAL |

### Scripts Pipeline

```bash
node scripts/download-template-assets.cjs   # unduh aset dasar dari HTML
node scripts/download-assets-v2.cjs         # unduh rekursif termasuk aset dari CSS
node scripts/convert-templates.cjs          # konversi HTML asli → public/templates/
node scripts/verify-fidelity.cjs            # buktikan tidak ada perubahan struktur
```

## Template Source & Mapping

File HTML snapshot referensi template tersimpan pada:
`D:\Nuno\you-are-invited-template\`
- `raden-motion/index.html` → `apps/web/public/templates/raden-motion/index.html`
- `betawi-motion/index.html` → `apps/web/public/templates/betawi-motion/index.html`
- `arjuna-tema-foto/index.html` → `apps/web/public/templates/arjuna-tema-foto/index.html`

Perbedaan antar template (dari `manifest.json` masing-masing):

| Template | Pantun | Hero Video | Posisi Quote | Gallery Video |
|---|---|---|---|---|
| raden-motion | ❌ | ❌ | `hero` | `none` |
| betawi-motion | ✅ | ✅ | `closing` | `youtube` |
| arjuna-tema-foto | ❌ | ❌ | `none` | `hosted` |

## Cara Menjalankan

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Jalankan Backend (API)
```bash
npm run dev:api
```
Backend berjalan di `http://localhost:3000`. Database SQLite dan data seeder otomatis terisi saat startup.

### 3. Jalankan Frontend (Web)
```bash
npm run dev:web
```
Frontend berjalan di `http://localhost:5173`.

### 4. Mengakses Undangan
- Beranda / Katalog: `http://localhost:5173/`
- Demo Raden Motion: `http://localhost:5173/i/raden-motion?to=Budi+Santoso`
- Demo Betawi Motion: `http://localhost:5173/i/betawi-motion?to=Siti+Aminah`
- Demo Arjuna Tema Foto: `http://localhost:5173/i/arjuna-tema-foto?to=Jessica+Mila`
- Dashboard Admin: `http://localhost:5173/admin`

## Menambahkan Template Baru (Checklist)

1. Taruh snapshot HTML baru di `D:\Nuno\you-are-invited-template\{slug-baru}\index.html`.
2. Jalankan `node scripts/download-assets-v2.cjs` untuk memirror asetnya.
3. Jalankan `node scripts/convert-templates.cjs` — tambahkan slug baru ke array `SLUGS`.
4. Jalankan `node scripts/verify-fidelity.cjs` — pastikan section/widget **MATCH**.
5. Tambahkan `manifest.json` + record seed di `apps/api/src/db/seed/templates.ts`.

> **Jangan** mengedit file di `public/templates/{slug}/` secara manual — file itu akan
> ditimpa oleh `convert-templates.cjs` pada konversi berikutnya.

---

## ⚙️ Lokasi Pengaturan Fitur & Konten Undangan

### 1. Pengaturan Link "Wedding Live"
Link siaran virtual (YouTube Live, Instagram Live, Zoom, dll.) disimpan di tabel database `livestream_info`. Anda dapat mengaturnya melalui:
- **File Seeder Database:** `apps/api/src/db/seed/templates.ts` pada baris `schema.livestreamInfo`:
  ```typescript
  streamUrl: 'https://instagram.com/raden.bagus', // atau https://youtube.com/live/xxx
  date: '2026-12-20',
  timeLabel: 'Start 08.00 WIB'
  ```
- **API Endpoint Admin:**
  `PATCH /api/admin/invitations/:id/livestream`
  Payload JSON:
  ```json
  {
    "streamUrl": "https://youtube.com/live/kode-live-anda",
    "date": "2026-12-20",
    "timeLabel": "Start 08.00 WIB"
  }
  ```
- Tombol "Wedding Live" otomatis terhubung ke link tersebut dan membuka tab baru (`target="_blank" rel="noopener noreferrer"`).

### 2. Pengaturan Link "Lihat Lokasi" (Google Maps)
Link rute lokasi acara tersimpan di tabel `events` kolom `maps_url`.
- **Format Rekomendasi:** Gunakan Google Maps Universal Link agar otomatis memicu aplikasi Google Maps di smartphone (Android/iOS):
  `https://www.google.com/maps/search/?api=1&query=NAMA_TEMPAT+ALAMAT`
- Tombol "Lihat Lokasi" otomatis dipasangi atribut `target="_blank"` dan `rel="noopener noreferrer"`.

### 3. Pengaturan Rekening Kado (Wedding Gift)
Disimpan di tabel `gift_accounts` pada database. Tombol "Salin Nomor" secara otomatis menyalin nomor rekening ke clipboard pada seluruh perangkat (desktop, Android, iOS Safari).

### 4. Pengaturan Wedding Hashtag
Disimpan di tabel `invitations` kolom `hashtag`. Tombol hashtag secara otomatis menyalin teks hashtag ke clipboard saat diklik.
