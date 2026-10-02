# Panduan Deployment: You Are Invited ke DomaiNesia Cloud VPS Lite (1GB RAM - Ubuntu 24.04)

Dokumen ini berisi panduan langkah demi langkah (*step-by-step*) untuk melakukan deployment platform **You Are Invited** ke **Cloud VPS Lite 1GB DomaiNesia** dengan OS **Ubuntu 24.04 LTS** dan **Docker**.

---

## 📌 Ringkasan Arsitektur Deployment

Aplikasi ini dibungkus menggunakan Docker Compose yang terdiri dari 2 container:
1. **Container `web` (Nginx Alpine):**
   - Melayani frontend Vite (landing page, katalog, admin dashboard).
   - Menyajikan template statis HTML 1:1 (`/i/:slug`).
   - Menyajikan file media & font lokal (`/template-assets/`).
   - Meneruskan (*reverse proxy*) request `/api/` ke container backend.
2. **Container `api` (Node 20 Alpine - Hono Backend):**
   - Menangani REST API untuk data undangan, submit RSVP/ucapan, dan autentikasi admin.
   - Database SQLite tersimpan di file `./storage/db/app.sqlite` (volume persistent pada VPS).
   - Mengisi data template dan demo otomatis saat pertama kali dijalankan (*auto-seeding*).

---

## ⚠️ PERHATIAN KHUSUS: VPS RAM 1GB (Wajib Setup SWAP)

> **PENTING:** Membangun image Docker (menjalankan `npm install` dan `npm run build` untuk Vite dan TypeScript) pada VPS dengan RAM 1GB **akan memicu Out Of Memory (OOM Killer / exit code 137)** jika tidak ada SWAP memory.
> 
> **Langkah 2 di bawah (Setup SWAP 2GB) TIDAK BOLEH DILEWATKAN.**

---

## Langkah 1: Akses VPS via SSH

Buka **PowerShell** atau **Terminal** di komputer lokal Anda, lalu hubungkan diri ke VPS menggunakan IP dan password root yang diberikan oleh DomaiNesia (bisa dilihat di email atau dashboard Client Area DomaiNesia):

```powershell
ssh root@<IP_VPS_ANDA>
```
*Contoh:*
```powershell
ssh root@103.123.45.67
```

Setelah berhasil masuk, lakukan update repositori paket Ubuntu:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Langkah 2: Setup SWAP Memory (Krusial untuk 1GB RAM)

Jalankan perintah berikut di terminal VPS untuk membuat virtual memory (SWAP) sebesar **2GB**:

```bash
# 1. Alokasikan file swap sebesar 2GB
sudo fallocate -l 2G /swapfile

# 2. Atur izin akses hanya untuk root
sudo chmod 600 /swapfile

# 3. Format file menjadi swap space
sudo mkswap /swapfile

# 4. Aktifkan swap
sudo swapon /swapfile

# 5. Pasang ke /etc/fstab agar otomatis aktif saat VPS reboot
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 6. Atur agresivitas swap (swappiness ideal untuk VPS: 20)
sudo sysctl vm.swappiness=20
echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
```

**Verifikasi SWAP:**
Jalankan perintah berikut:
```bash
free -h
```
Pastikan pada baris `Swap:` tertera kapasitas sekitar `2.0Gi`.

---

## Langkah 3: Verifikasi Docker & Docker Compose

Karena saat checkout Anda memilih template Docker di DomaiNesia, Docker sudah terpasang secara otomatis. Verifikasi versinya:

```bash
docker --version
docker compose version
```

Jika perintah `docker compose` belum dikenali, pasang plugin compose modern:
```bash
sudo apt install -y docker-compose-v2
```

---

## Langkah 4: Transfer Kode Proyek ke VPS

Pilih salah satu metode di bawah ini yang paling nyaman bagi Anda:

### Opsi A: Menggunakan Git (Sangat Direkomendasikan)
Jika proyek Anda sudah berada di repositori Git (misalnya GitHub / GitLab):

1. Di komputer lokal, pastikan seluruh perubahan sudah di-commit dan di-push:
   ```powershell
   git add .
   git commit -m "feat: setup project ready for vps deployment"
   git push origin master
   ```

2. Di terminal VPS, lakukan clone:
   ```bash
   mkdir -p /var/www
   cd /var/www
   git clone <URL_REPOSITORY_ANDA> you-are-invited
   cd you-are-invited
   ```

---

### Opsi B: Transfer Langsung dari Windows (via SCP)
Jika Anda belum menggunakan GitHub publik/privat, Anda bisa langsung mentransfer seluruh folder proyek dari Windows ke VPS menggunakan `scp`.

Buka tab **PowerShell baru** di komputer lokal Anda (pastikan berada di folder induk `D:\Nuno`):

```powershell
# Jalankan di PowerShell Windows:
scp -r D:\Nuno\you-are-invited root@<IP_VPS_ANDA>:/var/www/you-are-invited
```
*(Catatan: Jangan mentransfer folder `node_modules` jika terlalu besar; cukup hapus `node_modules` lokal terlebih dahulu atau biarkan Docker yang meng-install di VPS).*

Setelah transfer selesai, kembali ke terminal SSH VPS dan masuk ke folder proyek:
```bash
cd /var/www/you-are-invited
```

---

## Langkah 5: Konfigurasi Environment & Hak Akses Storage

1. Buat file `.env` produksi dari `.env.example`:
   ```bash
   cp .env.example .env
   nano .env
   ```

2. Sesuaikan nilai-nilai berikut di dalam `.env`:
   ```env
   # Server configuration
   PORT=3000
   NODE_ENV=production

   # Database configuration (SQLite di dalam container)
   DATABASE_URL=/app/storage/db/app.sqlite

   # Ganti dengan secret acak minimal 32 karakter
   SESSION_SECRET=kombinasi_acak_panjang_rahasia_anda_minimal_32_karakter_12345

   # Direktori Upload
   UPLOAD_DIR=storage/uploads

   # URL Domain atau IP VPS Anda
   CLIENT_URL=http://<IP_VPS_ANDA>
   ```
   *Simpan file dengan menekan `Ctrl + O`, lalu `Enter`, dan keluar dengan `Ctrl + X`.*

3. Pastikan direktori volume storage sudah ada dan memiliki izin tulis:
   ```bash
   mkdir -p storage/db storage/uploads
   chmod -R 777 storage
   ```

---

## Langkah 6: Build & Jalankan Container

Jalankan perintah berikut di dalam direktori `/var/www/you-are-invited`:

```bash
docker compose up -d --build
```

> **Catatan Proses Build:** Proses ini akan memakan waktu 3–6 menit pada VPS 1GB RAM karena Node.js akan meng-compile TypeScript, mem-build Vite, dan mengemas 400+ aset template. Berkat SWAP 2GB yang sudah dibuat di Langkah 2, proses build dijamin berjalan aman tanpa terhenti (OOM).

Setelah proses selesai, periksa status container:
```bash
docker compose ps
```

Output yang benar akan menampilkan kedua container dengan status **Up**:
```text
NAME                     IMAGE                  COMMAND                  SERVICE   CREATED         STATUS         PORTS
you-are-invited-api-1    you-are-invited-api    "node apps/api/dist/…"   api       1 minute ago    Up 1 minute    0.0.0.0:3000->3000/tcp
you-are-invited-web-1    you-are-invited-web    "nginx -g 'daemon of…"   web       1 minute ago    Up 1 minute    0.0.0.0:80->80/tcp
```

Periksa log backend untuk memastikan database SQLite terisi (*seeded*):
```bash
docker compose logs api
```
Output log akan menampilkan:
```text
Seeding templates...
- Inserted template: raden-motion
- Inserted template: betawi-motion
- Inserted template: arjuna-tema-foto
Seeding demo invitations...
- Seeded invitation: raden-motion
- Seeded invitation: betawi-motion
- Seeded invitation: arjuna-tema-foto
Seeding complete.
Backend server running on http://localhost:3000
```

---

## Langkah 7: Verifikasi Akses Web

Buka browser di komputer atau HP Anda dan akses alamat IP VPS Anda:

1. **Halaman Katalog / Landing Page:**
   `http://<IP_VPS_ANDA>/`
2. **Template Raden Motion:**
   `http://<IP_VPS_ANDA>/i/raden-motion?to=Budi+Santoso`
3. **Template Betawi Motion:**
   `http://<IP_VPS_ANDA>/i/betawi-motion?to=Siti+Aminah`
4. **Template Arjuna Tema Foto:**
   `http://<IP_VPS_ANDA>/i/arjuna-tema-foto?to=Jessica+Mila`
5. **Dashboard Admin:**
   `http://<IP_VPS_ANDA>/admin`

Coba isi form ucapan / RSVP untuk memastikan data tersimpan langsung ke SQLite pada VPS.

---

## Langkah 8: Menghubungkan Domain & Mengaktifkan HTTPS (SSL)

Agar undangan pernikahan terlihat profesional (menggunakan nama domain sendiri dan protokol aman `https://`), ada 2 metode terbaik:

### Metode A: Menggunakan Cloudflare Tunnel (Sangat Direkomendasikan)
*Metode ini paling hemat RAM dan paling aman untuk VPS 1GB karena tidak memerlukan Certbot di VPS, tidak perlu membuka port firewall publik, dan SSL dikelola penuh oleh Cloudflare.*

1. Daftarkan domain Anda di Cloudflare (Free Plan).
2. Masuk ke dashboard **Cloudflare Zero Trust** → **Networks** → **Tunnels**.
3. Buat Tunnel baru, beri nama (misal: `wedding-vps`).
4. Pilih environment **Debian 64-bit** dan salin perintah instalasi konektor yang disediakan Cloudflare, contoh:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb && sudo cloudflared service install <TOKEN_CLOUDFLARE_ANDA>
   ```
5. Pada tab **Public Hostname**:
   - Subdomain/Domain: `undangan.domainanda.com` (atau root domain).
   - Service Type: `HTTP`
   - URL: `localhost:80`
6. Selesai! Undangan Anda langsung aktif dengan HTTPS otomatis.

---

### Metode B: Mengarahkan DNS (A Record) + Let's Encrypt Certbot + Cloudflare Full SSL

1. Di panel DNS Cloudflare atau DomaiNesia, arahkan **A Record** `@` dan `www` ke `<IP_VPS_ANDA>`.
2. Pasang Certbot di Ubuntu VPS:
   ```bash
   sudo apt install -y certbot
   ```
3. Hentikan sementara container web agar port 80 bebas untuk verifikasi sertifikat:
   ```bash
   cd /var/www/you-are-invited
   docker compose stop web
   ```
4. Dapatkan sertifikat SSL menggunakan mode standalone:
   ```bash
   sudo certbot certonly --standalone -d you-are-invited.my.id -d www.you-are-invited.my.id
   ```
   *(Sertifikat akan tersimpan di `/etc/letsencrypt/live/you-are-invited.my.id/`)*.
5. Konfigurasi `docker-compose.yml` telah dipasang volume mount `/etc/letsencrypt:/etc/letsencrypt:ro` dan port `443:443`.
6. Konfigurasi `docker/nginx.conf` telah disetel untuk `listen 80;` dan `listen 443 ssl;` dengan SSL Let's Encrypt.
7. Di dashboard Cloudflare: Buka menu **SSL/TLS** -> pilih mode **Full** atau **Full (Strict)**.
8. Buka port 443 di firewall UFW VPS jika aktif:
   ```bash
   sudo ufw allow 443/tcp
   sudo ufw allow 80/tcp
   ```
9. Jalankan kembali container dengan konfigurasi baru:
   ```bash
   docker compose up -d --build
   ```

---

## Langkah 9: Pemeliharaan & Backup Database

Database Anda tersimpan pada file lokal host di:
`/var/www/you-are-invited/storage/db/app.sqlite`

### 1. Cara Backup Manual:
```bash
# Salin database ke folder backup bertanggal
cp /var/www/you-are-invited/storage/db/app.sqlite /var/backups/wedding-db-$(date +%Y%m%d).sqlite
```

### 2. Cara Otomatis Backup Harian (Cron Job):
Jalankan `crontab -e` dan tambahkan baris berikut di baris paling bawah (backup setiap jam 02:00 pagi):
```bash
0 2 * * * cp /var/www/you-are-invited/storage/db/app.sqlite /var/backups/wedding-db-$(date +\%Y\%m\%d).sqlite
```

---

## Langkah 10: Cara Memperbarui Kode di Kemudian Hari (*Update Deployment*)

Jika di masa mendatang Anda menambahkan template baru atau memperbarui kode:

```bash
cd /var/www/you-are-invited

# 1. Tarik perubahan terbaru dari Git
git pull origin master

# 2. Rebuild dan restart container tanpa mematikan database
docker compose up -d --build
```
*Database SQLite dan file upload yang ada di dalam folder `storage/` akan tetap aman dan tidak akan terhapus.*

---

## 🛠️ Panduan Troubleshooting

| Gejala Masalah | Penyebab | Solusi |
|---|---|---|
| **Build error: exit code 137** | Kehabisan RAM saat build Docker | Pastikan SWAP sudah aktif (`free -h`). Ikuti kembali Langkah 2. |
| **Tidak bisa diakses via browser** | Firewall VPS belum membuka Port 80 | Jalankan: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw reload` |
| **Komentar tidak tersimpan** | Folder storage tidak memiliki izin tulis | Jalankan di VPS: `chmod -R 777 /var/www/you-are-invited/storage` |
| **Port 80 already in use** | Ada webserver Apache/Nginx bawaan host yang berjalan | Matikan webserver host: `sudo systemctl stop apache2 && sudo systemctl disable apache2` |
