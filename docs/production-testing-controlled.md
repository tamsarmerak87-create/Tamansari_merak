# Controlled Production Testing

Dokumen ini adalah prosedur wajib sebelum aplikasi dibuka untuk warga. Pengujian
production hanya memakai akun dan data dummy. Tidak ada skrip di dokumen ini yang
boleh dijalankan otomatis oleh aplikasi.

## Run dan akun

Gunakan format `PRODTEST-YYYY-MM-DD-NNN` (contoh `PRODTEST-2026-08-31-001`).
Buat tiga akun khusus melalui prosedur administrasi yang berlaku, lalu catat UUID
(bukan password/token) di audit run:

- `WARGA TEST TAMANSARI` — role warga, NIK dummy valid, bukan NIK warga nyata.
- `PETUGAS TEST TAMANSARI` — role/permission petugas sesuai workflow.
- `ADMIN TEST TAMANSARI` — role admin dengan permission pengujian.

Nama, username, email, dan file test harus memuat run ID. Setiap payload pengajuan
harus mempertahankan `additional_data` existing dan menambahkan metadata internal:

```json
{"_test_mode":true,"_test_run_id":"PRODTEST-2026-08-31-001"}
```

Jangan menaruh token, password, NIK nyata, atau data rahasia pada audit.

## Urutan dan bukti

Jalankan berurutan, simpan timestamp, URL production, HTTP status, request ID,
submission ID, attachment ID, storage path, dan screenshot/video seperlunya.

1. Warga: login/logout/session/refresh; profil canonical dan read-only; daftar layanan,
   Pengantar Nikah, Domisili, Wali Nikah.
2. Pengantar Nikah: seluruh 8 step (pemohon, pernikahan, pasangan, orang tua/wali,
   dokumen, pernyataan/tanda tangan, review, ajukan). Hari akad harus read-only dan
   menghasilkan Minggu/Senin/Sabtu untuk `2026-08-09`, `2026-08-10`, `2026-08-15`.
3. Memory: draft pulih setelah refresh, submit menghapus draft, submitted memory muncul,
   memilih memory lalu mengubah field tidak tertimpa. Validasi juga Domisili/Wali Nikah.
4. Upload KTP/KK: foto 3 MB terkompresi <=1 MB; kamera bila tersedia; PDF >1 MB ditolak
   sesuai aturan existing (jangan fake-compress PDF). Simpan ukuran sebelum/sesudah.
5. Review/submit: semua field (termasuk hari akad, wali, dokumen, checklist, meterai)
   terbaca. Verifikasi `POST /api/surat-online/pengajuan` = 200/201 dan `ok=true`, ID
   baru, draft hilang, redirect `/dashboard/pengajuan`.
6. Petugas dan admin: dashboard, daftar, verifikasi, dokumen, proses, riwayat;
   admin juga layanan/pengguna/petugas/laporan/pengaturan. Warga tidak boleh masuk
   `/admin/*` atau `/petugas/*`; petugas tanpa permission admin = 403; admin berpermission allowed.
7. PDF/QR/dokumen: PDF 200 dan `application/pdf`, F4, footer, nomor, QR, signer sesuai
   workflow. Scan QR hanya membuka dokumen test; preview/download wajib ownership.
8. TTE/e-meterai hanya provider resmi dengan test transaction yang diizinkan. Jika tidak
   tersedia, tandai `BLOCKED/NOT AVAILABLE`, jangan memalsukan status/transaksi.
9. Notifikasi hanya alamat/akun test. Uji Android/iOS dengan internal/closed testing atau
   TestFlight. Catat load page/API/PDF/upload/preview; dilarang stress test agresif.

**STOP segera** bila data warga nyata terlihat/terubah, ownership atau role bypass, NIK/
QR/PDF salah, duplicate submit, memory bocor, atau dokumen pihak lain terlihat. Jangan
   cleanup otomatis sampai issue diperbaiki dan run diulang.

## Cleanup fail-closed

Sebelum cleanup, isi `cleanup/PRODTEST-...-ids.json` (file lokal ignored) dengan ID yang
benar-benar ditemukan dan path storage. Jalankan preview SQL di bawah pada transaction
read-only/console database production dan simpan hasil. `TEST_ROWS_FOUND` harus sama
persis dengan expected; bila lebih besar atau ada ID di luar allowlist: **STOP**.

```bash
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/production-test-preview.sql
```

Setelah seluruh checklist PASS, review dua orang, backup/audit tersimpan, dan preview
cocok, jalankan cleanup dengan `PRODTEST_CONFIRM=I_UNDERSTAND` serta allowlist IDs.

Urutan: notifications/tracking/audit/verifikasi, attachments, storage paths, pengajuan,
lalu akun test/profile. Jangan menghapus parent lebih dahulu. Jangan memakai `created_at`,
nama, `DELETE` tanpa filter marker/ID, `TRUNCATE`, atau broad delete.

## Audit dan final gate

Audit internal mencatat run ID, start/end, akun test, submission/attachment/notification/
storage IDs, hasil tiap test, preview count, deleted count, dan hasil after-check; jangan
catat credential. Setelah cleanup wajib: test user/submission/attachment/storage count = 0,
`REAL_PRODUCTION_DATA_UNCHANGED=true`, serta tidak ada `[DEBUG-*]`, `[TRACE-*]`, `[PRODTEST-*]`
atau credential test di release.

Jalankan sebelum release: `npm exec -- tsc --noEmit --pretty false`, `npm run test:regression`,
`npm run lint`, `npm run build`; semuanya exit 0.