# Panduan Instalasi DharmaImpact

Aplikasi terdiri dari dua bagian yang dipasang terpisah:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** | `Kode.gs`, `Setup.gs`, `SroiEngine.gs`, `appsscript.json` | Google Apps Script (akun Google kantor) |
| **Frontend** | Folder `DharmaImpact` (hasil ekstrak ZIP: `index.html`, `css/`, `js/`) | GitHub Pages |

Kerjakan berurutan: **Bagian A → B → C → D**.

---

## A. Pasang Backend (Google Apps Script)

### A1. Buat proyek
1. Buka **https://script.google.com** → klik **Proyek baru**.
2. Klik judul "Proyek tanpa judul" di kiri atas → ganti menjadi **DharmaImpact API**.

### A2. Tempel 3 file kode
1. Di panel kiri ada file `Code.gs`. Klik ikon titik tiga di sebelahnya → **Ganti nama** → `Kode`.
2. Hapus seluruh isinya, lalu tempel **seluruh isi `Kode.gs`**.
3. Klik ikon **+** di samping "File" → **Skrip** → beri nama `Setup` → tempel isi **`Setup.gs`**.
4. Klik **+** → **Skrip** → beri nama `SroiEngine` → tempel isi **`SroiEngine.gs`**.
5. Tekan **Ctrl+S** untuk menyimpan.

### A3. Atur manifest (`appsscript.json`)
1. Klik ikon roda gigi **Setelan proyek** di kiri.
2. Centang **Tampilkan file manifes "appsscript.json" di editor**.
3. Kembali ke **Editor**, buka `appsscript.json`, ganti seluruh isinya dengan isi file **`appsscript.json`**, lalu **Ctrl+S**.

### A4. Jalankan `setup()` — HANYA SEKALI
1. Buka file `Setup`.
2. Di toolbar atas, pilih fungsi **`setup`** pada menu dropdown → klik **▶ Jalankan**.
3. Muncul "Perlu otorisasi" → **Tinjau izin** → pilih akun Google → **Lanjutan** → **Buka DharmaImpact API (tidak aman)** → **Izinkan**.
4. Tunggu sampai Log eksekusi menampilkan **✅ SETUP SELESAI**.
5. Cek Google Drive Anda: sudah ada folder **DharmaImpact** berisi spreadsheet **DharmaImpact_DB** dan folder **Berkas**.

> ⚠️ Jangan menjalankan `setup()` dua kali. Kalau dijalankan lagi, sistem hanya menampilkan peringatan dan tidak membuat database ganda.

### A5. Deploy sebagai Web App
1. Klik tombol biru **Terapkan (Deploy)** → **Deployment baru**.
2. Klik ikon roda gigi di samping "Pilih jenis" → pilih **Aplikasi web**.
3. Isi:
   - **Deskripsi:** `v1`
   - **Jalankan sebagai:** **Saya** (akun Anda)
   - **Siapa yang memiliki akses:** **Siapa saja**
4. Klik **Terapkan** → **salin URL Aplikasi web** (berakhiran `/exec`). Simpan di Notepad.
5. Uji: tempel URL itu di tab browser baru. Harus tampil teks seperti `{"success":true,"app":"DharmaImpact","pong":true,...}`.

---

## B. Siapkan Frontend

1. Ekstrak **DharmaImpact.zip**. Hasilnya folder **`DharmaImpact`** yang langsung berisi `index.html`, `css`, `js`, `README.md`, dan panduan ini.
2. Buka **`DharmaImpact\js\config.js`** dengan Notepad.
3. Ganti baris:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT/exec',
   ```
   dengan URL `/exec` dari langkah A5 (tetap di dalam tanda kutip). Simpan.

---

## C. Unggah ke GitHub Pages

Folder kerja untuk semua perintah di bawah adalah **folder `DharmaImpact` hasil ekstrak** — folder yang langsung berisi `index.html`. Jangan menjalankan perintah dari folder di atasnya.

### C1. Buat repository di GitHub
1. Login ke **https://github.com** (akun `edigital-hermanto`).
2. Klik **+** → **New repository**.
3. **Repository name:** `dharmaimpact` • pilih **Public** • **jangan** centang README/.gitignore/license → **Create repository**.

### C2. Buka terminal di folder yang benar
1. Buka folder `DharmaImpact` di File Explorer.
2. Klik address bar, ketik `powershell`, tekan Enter.
3. Jalankan:
   ```powershell
   dir
   ```
   Pastikan baris yang tampil berisi **`index.html`**, folder **`css`**, dan folder **`js`**. Jika yang tampil malah folder `DharmaImpact`, masuk dulu: `cd DharmaImpact`.

### C3. Kirim file (jalankan satu per satu)
```powershell
git init
git add .
git commit -m "Upload pertama DharmaImpact"
git branch -M main
git remote add origin https://github.com/edigital-hermanto/dharmaimpact.git
git push -u origin main
```
- Saat diminta **Username**: `edigital-hermanto`.
- Saat diminta **Password**: tempel **Personal Access Token** (bukan password akun). Layar memang tidak menampilkan apa pun saat token ditempel — tekan Enter saja.
- Belum punya token: buka **https://github.com/settings/tokens** → **Generate new token (classic)** → centang **repo** → **Generate token** → salin token `ghp_…`.
- Jika muncul `remote origin already exists`, lewati perintah `git remote add` dan lanjutkan `git push -u origin main`.
- Jika sebelumnya komputer memakai akun GitHub lain dan push ditolak (`Permission denied` / 403): buka **Credential Manager** Windows → **Windows Credentials** → hapus entri `git:https://github.com`, lalu jalankan `git push -u origin main` lagi.

Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### C4. Aktifkan GitHub Pages
1. Di halaman repository → **Settings** → **Pages** (menu kiri).
2. **Source:** Deploy from a branch • **Branch:** `main` • folder **/ (root)** → **Save**.
3. Tunggu 1–2 menit, muat ulang halaman. Muncul alamat: **https://edigital-hermanto.github.io/dharmaimpact/**
4. Centang **Enforce HTTPS** bila tersedia.

---

## D. Pengaturan Awal Aplikasi (Super Admin)

1. Buka alamat aplikasi → login **username `admin`**, **password `Admin12345`**.
2. Menu **Profil** → ganti password admin (minimal 8 karakter).
3. Menu **Data Induk & Parameter**:
   - **Cabang**: tambah ke-14 cabang (Cakung & Site Tanjung sudah ada sebagai contoh), isi PIC koordinator.
   - **UMK & Budget**: pilih tahun, isi UMK dan budget program tiap cabang → **Simpan** per baris. Cabang tidak bisa membuat perhitungan sebelum ini terisi.
   - **KPI & Bobot**: KPI tahun berjalan dan tahun lalu sudah diisi contoh. **Sesuaikan bobotnya dengan file standar organisasi** — total wajib 100%.
   - **Parameter Baku**: periksa discount rate (5%), hari kerja (26), rumus KLASIK, batas bintang.
4. Menu **Pengguna**: buat 1 akun **Cabang** per cabang (pilih cabangnya) dan maksimal 3 akun **Stakeholder**.

---

## E. Uji Cepat Setelah Online

| Uji | Cara | Hasil yang benar |
|---|---|---|
| Koneksi | Login admin | Dashboard tampil; titik hijau di kanan atas |
| Alur cabang | Login akun cabang → **Hitung Baru** → isi 8 langkah | Panel kanan berubah seketika saat angka diketik; tulisan "Tersimpan ✓" muncul |
| Validasi | Di Impact Map buat 2 outcome yang sama-sama memakai "Semua KPI" porsi 100% | Kartu sumber proksi merah 200%; tombol **Kirim ke Pusat** nonaktif |
| Persetujuan | Admin → **Persetujuan** → Periksa → **Setujui & Kunci** | Status Disetujui; masuk Dashboard Akumulasi |
| Hak akses | Akun cabang A membuka tautan perhitungan cabang B | Ditolak "Akses ditolak (403)" |
| Berkas | Unggah PDF < 10 MB lalu file > 10 MB | Yang kecil tersimpan di Drive; yang besar ditolak dengan pesan jelas |
| Ekspor | Langkah 8 → PDF & Excel; menu Laporan → Rekap | File terunduh (butuh koneksi internet untuk memuat pustaka ekspor) |
| HP | Buka alamat di HP | Menu bawah tampil, panel rasio menempel di bawah layar wizard |

---

## F. Cara Memperbarui di Kemudian Hari

**Backend (file `.gs` berubah):** tempel kode baru → **Ctrl+S** → **Terapkan → Kelola deployment** → ikon pensil ✏️ → **Versi: Versi baru** → **Terapkan**. URL `/exec` tetap sama, jadi `config.js` tidak perlu diubah. (Jangan memilih "Deployment baru" — itu membuat URL baru.)

**Frontend (file di folder `DharmaImpact` berubah):** dari folder `DharmaImpact` jalankan:
```powershell
git add .
git commit -m "Pembaruan"
git push
```
Tunggu 1–2 menit, lalu tekan **Ctrl+Shift+R** di browser.

**Data di Sheets diubah manual:** di editor Apps Script jalankan fungsi `clearServerCache` agar aplikasi membaca data terbaru.

---

## G. Masalah Umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| "URL backend belum diisi" saat login | `config.js` belum diisi | Isi `GAS_URL`, lalu push ulang |
| "Server membalas HTTP … (bukan JSON)" | Akses deployment bukan "Siapa saja", atau URL salah | Ulangi A5; pastikan URL berakhiran `/exec` |
| Situs GitHub 404 | `git init` dijalankan di folder yang salah | Pastikan `dir` menampilkan `index.html` sebelum push |
| Login admin lupa password | — | Di editor Apps Script jalankan fungsi `resetAdminPassword` (password kembali ke `Admin12345`) |
| "UMK & budget belum diatur" saat Hitung Baru | Data induk tahun tsb kosong | Admin mengisi menu Data Induk → UMK & Budget |
| Tampilan versi lama setelah update | Cache browser | **Ctrl+Shift+R** atau jendela Incognito |
