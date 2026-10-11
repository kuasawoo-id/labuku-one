# LABUKU One — Catatan Versi

by Ahzani Labs

## v2.1.0 — 11 Oktober 2026

**Migrasi arsitektur saja. Tidak ada fitur yang ditambah, diubah, atau dihapus.** Data v2.0.0 tetap dipakai tanpa konversi.

### Arsitektur
- Frontend pindah dari HtmlService Apps Script ke **GitHub Pages**.
  - `index.html`, `css/style.css`, `js/config.js`, `js/app.js`
- Backend (`Kode.gs`) kini murni **REST API JSON**:
  - `doGet` mengembalikan info awal aplikasi.
  - `doPost` menerima `{fn, args}` untuk 6 fungsi publik:
    - `apiBoot`, `apiSetup`, `apiLoginKua`, `apiPegawaiList`, `apiLoginPin`, `api`
  - Fungsi lain tidak dapat dipanggil dari luar.
- Pemanggilan server dari frontend:
  - Sebelumnya `google.script.run`, kini `fetch()` dengan `Content-Type: text/plain`, tanpa CORS preflight.
- Info awal sebelumnya disuntikkan ke HTML.
  - Kini diambil lewat `apiBoot`, lalu disimpan di perangkat sehingga pembukaan berikutnya tetap instan.
- File `Index`, `Stylesheet`, `JavaScript` di Apps Script tidak dipakai lagi.

### Dampak bagi pengguna
- Alamat aplikasi berubah ke GitHub Pages, sehingga semua pegawai perlu login ulang satu kali.
- Foto pada draft yang belum difinalisasi di alamat lama tidak terbawa. Finalisasi dulu sebelum pindah.
- Iframe Google dan bilah "Aplikasi ini dibuat oleh pengguna Google Apps Script" hilang.
- [Kemungkinan Besar] Masalah "tidak dapat membuka file" pada HP yang login lebih dari satu akun Google ikut hilang, karena frontend tidak lagi dimuat dari domain Google.

## v2.0.0 — 10 Oktober 2026

Rombak total dari v1:
- Login dengan akun KUA + PIN.
- Penyimpanan di Drive akun KUA.
- Fitur klaim oleh Kepala KUA.
- Tiga cara menambah hasil kerja.
- Backup ZIP.
- Desain mobile-first.

Perbaikan setelah rilis:
- Kode `/*` dan `//` di dalam string dipotong oleh HtmlService sehingga layar macet di logo. Ini sudah diperbaiki, dan masalah ini tidak ada lagi di v2.1.0 karena frontend tidak lagi melewati HtmlService.
