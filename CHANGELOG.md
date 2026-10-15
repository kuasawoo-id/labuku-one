# LABUKU One — Catatan Versi

by Ahzani Labs

## v2.2.0 — 15 Oktober 2026

### Tampilan & menu
- Tombol **Tambah** menjadi **Catat**.
- Menu **Laporan Saya** menjadi **Catatan Kerja**.
- Menu **Pengaturan KUA** menjadi **Pengaturan**, dan kini terbuka untuk semua pegawai.
  - Semua isi menu Akun pindah ke Pengaturan: profil, PIN, cadangan, dan tautan menu di HP.
  - Bagian khusus Kepala KUA tetap hanya tampil untuk Kepala KUA.
- **Mode gelap** dan **Keluar** sekarang ada di bawah nama (kiri bawah).
  - Di HP, keduanya ada di halaman Pengaturan.
- Fitur **Lupakan perangkat ini** dihapus.
- Fitur **Log Aktivitas** dihapus, baik menu maupun pencatatannya. Sheet `Log` lama dibiarkan, tidak ditulis lagi.

### Laporan SKP (isian e-Kinerja BKN)
- Empat isian e-Kinerja disalin cukup dengan **klik isiannya**:
  - **Edit Realisasi**
    - REALISASI: dihitung otomatis dari jumlah kegiatan final + satuan.
    - SUMBER DATA: gabungan isian sumber data kegiatan.
  - **Tambah Bukti Dukung**
    - NAMA BUKTI DUKUNG: nama butiran.
    - LINK: folder butiran untuk laporan tahunan, atau folder TW untuk laporan per TW.
- Pilihan periode: **Tahunan** atau **TW 1–4**.
- Folder butiran otomatis dibagikan "Siapa saja yang memiliki link (lihat)". Subfolder TW dan semua PDF di dalamnya ikut terbuka bagi penilai.
- Link Drive yang ditempel pengguna tampil sebagai bukti dukung tambahan.
- Mode gabungan menampilkan folder butiran staf yang hasil kerjanya diklaim.

### Template PDF
- Tersedia 3 slot **template KUA** (diatur Kepala KUA, berlaku untuk semua pegawai) dan 3 slot **template pribadi** per pegawai. Template bawaan tetap tersedia.
- Template diisi dengan dua cara:
  - unggah atau seret file **.docx**;
  - tempel **link Google Doc**. Dokumen harus dapat dibuka akun KUA.
- Template disimpan sebagai Google Doc di Drive KUA.
- Daftar **field `{{…}}`** bisa disalin dengan sekali klik di Pengaturan. Tersedia juga **contoh template** yang bisa disalin ke Google Docs atau diunduh sebagai .docx.
- Template dipilih per kegiatan di form **Catat**.
- `{{FOTO}}` diganti foto dokumentasi yang sudah dikompres.

### Cadangan (ZIP)
- Pilih **tahun** sebelum membuat cadangan.
- Isi ZIP sama persis dengan susunan folder di Drive: `Nama › DATABASE LPJ › Tahun › Butiran › TW n › PDF`.
- Tidak ada lagi file Excel/CSV di dalam ZIP.
- Cadangan yang besar otomatis dipecah menjadi beberapa bagian. Ekstrak semua bagian ke folder yang sama.

### Teknis
- Migrasi skema berjalan otomatis: kolom `TemplateID` di sheet Laporan dan sheet baru `Template`. Data lama tetap utuh.
- Memerlukan layanan lanjutan **Drive API** di Apps Script untuk mengubah .docx menjadi Google Doc.

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
