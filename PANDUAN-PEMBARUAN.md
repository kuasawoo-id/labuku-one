# Panduan Pembaruan LABUKU One v2.1.0 → v2.2.0

Data, akun KUA, PIN, dan URL tidak berubah. Pegawai tidak perlu login ulang.

## Bagian A — Backend Apps Script (akun Google KUA)

1. Buka project Apps Script LABUKU One.
2. **Aktifkan Drive API.** Di panel kiri, klik **Layanan (+)**, pilih **Drive API** (versi v3), lalu **Tambahkan**.
   Layanan ini dipakai untuk mengubah file Word (.docx) menjadi template Google Doc.
3. Buka **Kode.gs**, hapus seluruh isinya, lalu tempel isi **Kode.gs v2.2.0**. Simpan dengan Ctrl+S.
4. Pilih fungsi **lihatAkun** di dropdown, lalu klik **▶ Jalankan**.
   - Kalau muncul permintaan izin, klik **Tinjau izin** lalu **Izinkan**.
   - Langkah ini juga menjalankan migrasi database otomatis: menambah kolom `TemplateID` dan sheet `Template`.
5. Klik **Terapkan → Kelola deployment → Edit (ikon pensil) → Versi: Versi baru → Terapkan**.
   URL `/exec` tetap sama, jadi `js/config.js` tidak perlu diubah.

> Jangan pilih "Deployment baru", karena URL-nya akan berubah.

## Bagian B — Frontend GitHub Pages

1. Ekstrak `labuku-one-v2.2.0.zip`.
2. Salin seluruh isinya ke folder repo yang dulu dipakai untuk `git push`, yaitu folder yang berisi `index.html`. Timpa semua file lama.
   - `js/config.js` di paket ini **sudah berisi URL backend KUA Sawoo**, jadi aman ditimpa.
3. Buka PowerShell di folder itu, lalu jalankan:
   ```bash
   git add .
   git commit -m "LABUKU One v2.2.0"
   git push
   ```
4. Tunggu 1–2 menit, buka situs, lalu tekan **Ctrl+Shift+R**.

## Bagian C — Uji singkat

- [ ] Menu kiri menampilkan **Catat**, **Catatan Kerja**, dan **Pengaturan**. Mode gelap dan Keluar ada di bawah nama.
- [ ] **Laporan SKP → TW 4**: klik REALISASI lalu tempel di e-Kinerja, dan lakukan hal yang sama untuk SUMBER DATA, NAMA BUKTI DUKUNG, dan LINK.
- [ ] Buka LINK tersebut di jendela Incognito. Folder harus bisa dibuka tanpa login.
- [ ] **Pengaturan → Template PDF**: buka **Contoh template**, buat salinannya, lalu unduh sebagai .docx dan unggah ke **Template pribadi slot 1**. Hasilnya harus menampilkan "… field terdeteksi".
- [ ] **Catat → Laporan kegiatan**: pilih template tersebut, finalisasi dengan foto, lalu buka PDF-nya.
- [ ] **Pengaturan → Cadangkan data saya → 2026**: unduh ZIP, ekstrak, lalu cocokkan susunan foldernya dengan Drive.

Kalau ada pesan error, salin teksnya beserta langkah yang dilakukan.

---
LABUKU One · by Ahzani Labs
