# Panduan Migrasi LABUKU One ke GitHub Pages (v2.1.0)

Tujuan migrasi: **fitur, data, dan tampilan tetap sama persis**. Yang berubah hanya tempat tampilan aplikasi dimuat.

| | Sebelum (v2.0.0) | Sesudah (v2.1.0) |
|---|---|---|
| Tampilan aplikasi | Dari Apps Script (HtmlService, di dalam iframe Google) | Dari GitHub Pages: `https://USERNAME.github.io/NAMA-REPO/` |
| Backend & data | Apps Script + Drive akun KUA | **Tetap sama**: Apps Script + Drive akun KUA |
| File di Apps Script | Kode.gs, Index, Stylesheet, JavaScript | **Kode.gs saja** |
| Cara frontend memanggil server | `google.script.run` | `fetch()` ke URL `/exec` |

Data di spreadsheet dan Drive tidak dipindahkan dan tidak diubah. Akun KUA, PIN, laporan, klaim, dan PDF tetap berlaku.

---

## Bagian A — Sebelum mulai (wajib)

1. **Finalisasi semua draft yang sudah berisi foto.** Foto draft disimpan di browser pada alamat lama. Begitu aplikasi pindah ke alamat GitHub, browser memperlakukannya sebagai situs lain, sehingga foto draft yang belum difinalisasi **tidak ikut terbawa**. Isian draft tanpa foto tetap aman karena sudah tersimpan di server.
2. Siapkan akun GitHub. Kalau belum punya, ikuti Bagian C langkah 1–3.

---

## Bagian B — Backend Apps Script (akun Google KUA)

Login dengan **akun Google KUA**, lalu buka project Apps Script LABUKU One yang sudah berjalan sekarang.

1. Buka file **Kode.gs**, hapus seluruh isinya, lalu tempel isi **Kode.gs v2.1.0**.
2. Simpan (Ctrl+S).
3. Klik **Terapkan → Deployment baru → Aplikasi web**, dengan pengaturan:
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
4. Klik **Terapkan**, lalu **salin URL `/exec` yang baru**.

> **Kenapa "Deployment baru", bukan "Kelola deployment"?** Deployment lama tetap menjalankan versi lama di URL lama. Selama situs GitHub belum siap, pegawai masih bisa bekerja seperti biasa. Keduanya memakai data yang sama, jadi tidak ada data yang terbelah.

5. **Uji backend.** Buka URL `/exec` baru di browser. Yang benar: muncul teks JSON seperti
   `{"success":true,"data":{"configured":true,"namaKua":"SAWOO","version":"2.1.0",...}}`.
   Kalau yang muncul halaman aplikasi atau halaman login Google, berarti deployment atau setelan aksesnya salah. Ulangi langkah 3.

File **Index**, **Stylesheet**, dan **JavaScript** di Apps Script tidak dipakai lagi. Hapus setelah migrasi selesai (Bagian D). Menghapusnya tidak memengaruhi deployment lama, karena setiap deployment menyimpan salinan versinya sendiri.

---

## Bagian C — Frontend ke GitHub Pages

### 1. Pasang Git (sekali saja)
- Windows: unduh dari https://git-scm.com/download/win, pasang dengan pengaturan bawaan, lalu buka **PowerShell**.
- Cek hasilnya: `git --version`

### 2. Identitas Git (sekali saja)
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```

### 3. Buat repository di GitHub
github.com → **+** → **New repository**:
- Nama: misalnya `labuku-one-sawoo`
- Pilih **Public**. GitHub Pages gratis hanya untuk repo publik.
- **Jangan** centang README, .gitignore, atau license.

> Aman dibuat publik: isi repo hanya tampilan dan alamat `/exec`. Alamat itu memang sudah publik sejak dulu, dan semua data tetap terkunci oleh login KUA + PIN.

### 4. Ekstrak ZIP dan isi alamat backend
1. Ekstrak `labuku-one-v2.1.0.zip`. Hasilnya folder **`labuku-one-v2.1.0`**.
2. Buka `labuku-one-v2.1.0\js\config.js` dengan Notepad. Ganti `TEMPEL_URL_EXEC_DI_SINI` dengan URL `/exec` dari Bagian B langkah 4:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/AKfy.../exec';
   ```
   Tanda kutipnya jangan sampai terhapus. Simpan.

### 5. Masuk ke folder yang BENAR dan periksa isinya
**Folder kerja = `labuku-one-v2.1.0`** (folder hasil ekstrak, yang berisi `index.html`). `git init` dijalankan di folder ini, bukan di folder induknya.

Cara cepat: buka folder itu di File Explorer, klik address bar, ketik `powershell`, lalu Enter. Kemudian:
```powershell
dir
```
Yang harus terlihat: `index.html`, `README.md`, `PANDUAN-MIGRASI.md`, `CHANGELOG.md`, folder `css`, dan folder `js`.
Kalau yang terlihat justru satu folder lain, berarti Anda masih satu tingkat terlalu tinggi. Masuk dulu ke folder itu dengan `cd`, baru lanjut.

### 6. Kirim ke GitHub (jalankan satu per satu)
```bash
git init
git add .
git commit -m "LABUKU One v2.1.0"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
- Perhatikan **titik** di `git add .`.
- Saat diminta **Password**, yang dimasukkan adalah **Personal Access Token**, bukan password akun GitHub. Saat token ditempel, layar memang tidak menampilkan apa pun. Itu normal.
- Kalau belum punya token, buka https://github.com/settings/tokens → **Generate new token (classic)** → centang **repo** → **Generate**. Salin token `ghp_...`, karena token hanya tampil sekali.
- Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### 7. Aktifkan GitHub Pages
Di halaman repo: **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: **main** · **/ (root)** → **Save**
- Centang **Enforce HTTPS**

Tunggu 1–2 menit. Akan muncul tulisan *Your site is live at `https://USERNAME.github.io/NAMA-REPO/`*.

### 8. Uji
1. Buka alamat situs itu, lalu login dengan akun KUA dan PIN seperti biasa. **Semua pegawai perlu login ulang satu kali**, karena alamatnya baru.
2. Cek setidaknya: Beranda, Laporan Saya, finalisasi satu laporan dengan foto, Tim & Klaim, dan Laporan SKP.
3. Kalau tampil "Tidak dapat memuat", baca pesannya:
   - *GAS_URL … belum diisi* → periksa `js/config.js` (Bagian C langkah 4).
   - *Tidak dapat terhubung ke server* → periksa setelan deployment: Jalankan sebagai **Saya**, akses **Siapa saja**.
   - *Respons server tidak valid* → Kode.gs v2.1.0 belum di-deploy (Bagian B).

---

## Bagian D — Setelah situs GitHub terbukti berjalan

1. Bagikan alamat GitHub Pages ke semua pegawai.
2. Di Apps Script: **Terapkan → Kelola deployment → pilih deployment LAMA → Arsipkan**. Alamat lama berhenti, sehingga tidak ada lagi dua pintu masuk.
3. Hapus file **Index**, **Stylesheet**, dan **JavaScript** dari project Apps Script.

---

## Memperbarui di kemudian hari

**Tampilan (frontend):** edit file di folder `labuku-one-v2.1.0`, lalu jalankan dari folder itu:
```bash
git add .
git commit -m "Keterangan perubahan"
git push
```
Situs diperbarui dalam 1–2 menit. Kalau masih tampil versi lama, tekan **Ctrl+Shift+R**.

**Backend:** ganti isi Kode.gs, lalu **Kelola deployment → Edit (pensil) → Versi: Versi baru → Terapkan**. URL `/exec` tetap sama, jadi `config.js` tidak perlu diubah.

## Fungsi pemulihan (tetap sama)
Dijalankan dari editor Apps Script oleh pemilik akun KUA:
- `lihatAkun` — menampilkan username KUA serta daftar pegawai dan PIN di Log eksekusi.
- `resetPasswordKua` — membuat password KUA sementara.
- `bukaSetup` — hanya untuk KUA baru. Setelah menjalankannya, buka **situs GitHub** dalam 60 menit untuk mengisi wizard setup.

---
LABUKU One · by Ahzani Labs
