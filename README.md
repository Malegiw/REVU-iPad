# Review by YMD · Kalkulator (iPad offline)

Kalkulator dan referensi teknik sipil untuk reviewer dokumen, yang berjalan **sepenuhnya di iPad tanpa internet**. Ini versi ringan dari aplikasi Review by YMD: hanya alat yang tidak membutuhkan AI atau dokumen proyek.

> Pembanding untuk review, bukan pengganti perhitungan geoteknik atau struktur. Angka bawaan hanya contoh umum. Ikuti Design Basis dan kode yang dipakai dokumen.

## Isi

| Alat | Keterangan |
|---|---|
| **Penurunan Pondasi** | Penurunan segera (Steinbrenner, tanah berlapis), konsolidasi primer lempung (Terzaghi, sublapis, muka air tanah), kecepatan konsolidasi, kompresi sekunder opsional, cek batas izin dan distorsi sudut, perbandingan dengan nilai di dokumen, unduh .md / .csv, cetak ke PDF. |
| **Pondasi Tangki & Peralatan** | Tiga pemeriksaan: pondasi dangkal peralatan (footing + pedestal, banyak kasus beban, tekanan dasar dengan eksentrisitas dua arah, daya dukung Meyerhof/Vesic, guling, geser, denah), pondasi mesin berputar (indikatif: frekuensi alami vertikal dan geser, pemisahan terhadap frekuensi operasi, rasio massa), dan pondasi tangki silindris (API 650 disederhanakan: ringwall, daya dukung, penurunan pusat–tepi, stabilitas angin). Perbandingan dengan nilai di dokumen, unduh .md / .csv, cetak ke PDF. |
| **Alur Produksi Migas** | Alur minyak dan gas dari sumur sampai gathering station: PFD dan dua P&ID bergerak, gambar bernomor, 12 animasi detail alat, cerita, komponen, dan catatan sipil/struktur. |

Dua bahasa (Indonesia dan Inggris), tema terang, gelap, atau otomatis. Kalkulator lain (saluran & gorong-gorong, stabilitas lereng, dinding penahan tanah) menyusul.

## Memasang di iPad

1. Buka alamat situs ini di **Safari** (sekali saja, dengan internet).
2. Ketuk **Bagikan → Tambah ke Layar Utama**.
3. Sejak itu app terbuka dari ikonnya, layar penuh, dan jalan tanpa internet. Setelah ada versi baru, muncul tombol **Muat ulang**.

Masukan terakhir tersimpan di perangkat (localStorage), tidak dikirim ke mana pun. Tidak ada server, akun, atau pelacakan.

## Keakuratan

Rumus di `js/penurunan.js` dan `js/fondasi.js` adalah padanan satu-satu dari versi Python di aplikasi utama. `tests/run.html` memuat berkas `tests/*_cases.json` (kasus acak dan galat beserta hasil Python: 54 kasus penurunan, 64 kasus pondasi peralatan, 40 mesin berputar, 40 tangki, dan 160 pemeriksaan fungsi dasar), menjalankan JavaScript pada masukan yang sama, lalu membandingkan semua angka dan teks pengecekan (toleransi relatif 1e-9). Tiap kelompok uji ada di `tests/suite_*.js`. Buka lewat server lokal:

```bash
python3 -m http.server 8610
# lalu buka http://127.0.0.1:8610/tests/run.html  (judul tab: "LOLOS 382/382")
```

Nilai acuan teori ikut diuji (Tv50 = 0,197, Tv90 = 0,848, Is Steinbrenner, faktor sudut Newmark, pembulatan seperti Python).

## Struktur

- `index.html`, `css/app.css`, `js/app.js`: kerangka (menu, bahasa, tema, offline).
- `js/penurunan.js` dan `js/fondasi.js` (rumus), `js/penurunan_ui.js` dan `js/fondasi_ui.js` (halaman), `js/flow.js` + `css/flow.css` (halaman Alur Produksi Migas).
- `js/fmt.js` (pembulatan dan format angka seperti Python), `js/kit.js` (kolom masukan, tabel, unduhan bersama untuk halaman alat).
- `data/` (teks dua bahasa), `assets/` (gambar SVG), `icons/`, `manifest.webmanifest`.
- `sw.js`: service worker yang menyimpan semua berkas untuk offline. **Dibuat otomatis** (daftar berkas dan versi), jangan diedit tangan.

`data/`, `assets/`, `js/flow.js`, `css/flow.css`, dan `sw.js` dibuat oleh skrip `ipad_build.py` di aplikasi utama (privat). Perubahan kecil pada berkas tulisan tangan di atas bisa diedit langsung, tetapi `sw.js` harus dibuat ulang agar iPad mengambil versi baru.

Untuk mencoba tanpa penyimpanan offline: tambahkan `?nosw=1` pada alamat saat pengembangan.
