# HASIL DIAGNOSIS & PERBAIKAN: Gallery `anggi-ivan` Tidak Tampil

Dokumen hasil penelusuran akar masalah (*root cause analysis*) dan perbaikan teknis untuk gallery undangan klien **`anggi-ivan`**.

---

## 1. Ringkasan Masalah

Klien telah mengunggah 6 foto galeri melalui Dashboard Admin, namun foto tidak tampak pada section gallery website undangan.

---

## 2. Temuan Akar Masalah (Root Causes)

### A. Root Cause 1: Kolaps Dimensi CSS (Height: 0px x 0px)
- **Fakta**: Pada template Elementor asli WordPress, widget galeri `gallery_layout: "justified"` dikendalikan oleh script dinamis Elementor Pro (`e-gallery.js`). Script tersebut menghitung rasio gambar dan menginjeksikan CSS custom properties (`--item-width`, `--item-height`, dsb.).
- **Masalah**: Pada template mandiri yang dikonversi (tanpa WordPress/Elementor runtime), `.elementor-gallery__container` hanya memiliki `min-height: 1px` tanpa display grid/flex. Elemen `<a>` memiliki browser default `display: inline` tanpa lebar dan tinggi. Elemen gambar `<div class="e-gallery-image">` di dalamnya memiliki `height: 100%`.
- **Dampak**: 100% dari tinggi 0px adalah **0px**. Foto-foto galeri sebenarnya ada di DOM, tetapi terlipat (*collapsed*) hingga tinggi 0px sehingga tampak tak kasat mata (kosong).

### B. Root Cause 2: Inkonsistensi Resolusi Path Storage (`process.cwd()`)
- **Fakta**: File yang diunggah dari server tersimpan di `apps/api/storage/uploads/inv-anggi-ivan/` ketika backend dijalankan dari direktori `apps/api`.
- **Masalah**: `assetsRouter` pada `apps/api/src/routes/assets.ts` hanya mencari file relatif terhadap `process.cwd()`. Jika server dijalankan dari root project, `assets.ts` mencari di `storage/uploads/...` dan gagal menemukan file di `apps/api/storage/uploads/...`, menghasilkan error HTTP 404.

### C. Root Cause 3: Tidak Ada Lightbox Interaktif
- **Masalah**: Sebelumnya elemen link `<a>` foto galeri tidak memiliki handler popup; saat diklik, halaman akan berpindah langsung ke raw URL `/api/assets/...`, merusak alur undangan pernikahan.

---

## 3. Tindakan Perbaikan yang Telah Dilakukan

### 1. Perbaikan CSS Grid & Aspek Rasio (File: `apps/web/public/production/anggi-ivan/index.html` dan dist)
Menambahkan styling layout galeri murni pada `<style id="raden-mobile-fixes">`:
- Container galeri: CSS Grid responsif (2 kolom di mobile, 3 kolom di tablet/desktop).
- Item galeri: `aspect-ratio: 1 / 1` (kotak simetris), `overflow: hidden`, `border-radius: 8px`, bayangan halus, dan efek *zoom-on-hover* (`scale: 1.08`).
- Overlay gradient elegan saat hover/tap.

### 2. Standalone Lightweight Lightbox Modal
Menambahkan komponen modal Lightbox mandiri (vanilla JS, zero dependency):
- Tampilan fullscreen dengan latar gelap transparan (`rgba(0,0,0,0.94)`).
- Tombol navigasi Previous (`❮`) dan Next (`❯`).
- Indikator counter foto (contoh: `1 / 6`).
- Caption teks judul foto di bagian bawah.
- Dukungan tombol keyboard (`Escape`, `ArrowLeft`, `ArrowRight`) dan touch swipe pada layar HP.

### 3. Multi-Path Storage Resolver (`apps/api/src/routes/assets.ts`)
Memperbarui router aset agar mencari file di seluruh kemungkinan direktori kerja (`storage/uploads`, `apps/api/storage/uploads`, dsb.) sehingga aset foto dan audio selalu ditemukan dengan status HTTP 200 tanpa peduli dari mana server dijalankan.

### 4. Dual-Write Upload Storage (`apps/api/src/routes/admin/invitations.ts`)
Memperbarui handler upload aset agar otomatis menulis ke kedua folder storage (root dan `apps/api`) untuk mencegah desinkronisasi file baru.

### 5. Sinkronisasi Salinan Dist
Menyelaraskan perubahan HTML ke seluruh entrypoint:
- `apps/web/public/production/anggi-ivan/index.html`
- `apps/web/dist/i/anggi-ivan/index.html`
- `apps/web/dist/production/anggi-ivan/index.html`

---

## 4. Status Pengujian & Validasi

1. **Aset Gambar**: 6 foto JPEG (`ast-8f5e855f...`, `ast-698135fd...`, `ast-7770e36f...`, `ast-20379e15...`, `ast-cbb42af1...`, `ast-ef314f94...`) terverifikasi utuh di disk storage.
2. **Audio Kustom**: File audio MP3 `ast-a0f4584f...` (4.1MB) terverifikasi utuh di disk storage.
3. **Layout Tampil**: Item galeri memiliki dimensi `1 / 1` responsif dan tidak lagi 0px x 0px.
4. **Interaksi Lightbox**: Klik pada foto membuka popup lightbox tanpa meninggalkan halaman undangan.
