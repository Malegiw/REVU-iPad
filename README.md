<p align="center"><img src="icons/icon-192.png" width="96" alt="YMD-CAL"></p>

# YMD-CAL · Kalkulator Desain Pondasi & Sipil Migas (iPad offline)

Kalkulator desain pondasi dan sipil untuk fasilitas migas yang berjalan **sepenuhnya di iPad tanpa internet**: tiang, tangki, vessel, peralatan dinamis, trafo, dan penurunan pondasi, lengkap dengan kombinasi beban, sketsa parameter, lembar perhitungan langkah demi langkah, serta laporan Excel & PDF.

**Buka di iPad: <https://malegiw.github.io/REVU-iPad/>**

> Alat bantu desain dan pembanding. Angka bawaan hanya contoh umum; hasil tetap perlu diverifikasi engineer yang berwenang terhadap Design Basis, data tanah, data vendor, dan kode yang berlaku.

## Isi

| Menu | Keterangan |
|---|---|
| **Beranda** | Dashboard proyek: status langsung kelima kalkulator desain dan tab Penurunan (OK/NOT OK, cincin rasio UR, pemeriksaan penentu, penurunan terbesar), data proyek & lokasi, serta pintu masuk ke Alur Produksi Migas. |
| **Desain** | Lima kalkulator dengan **input beban per kasus** (D, Do, Dt, L, T, Wx/Wy, Ex/Ey) dan **kombinasi beban otomatis** SNI 1727:2020 / ASCE 7-16 (ASD & LRFD) + beban proses PIP STC01015, faktor dapat diubah, Ev = 0,2·SDS·D, opsi gempa ortogonal 100–30. Angin SNI 1727 Bab 29 dan gempa SNI 1726:2019 dari data lokasi bersama. Satuan kN·kPa atau ton·t/m². Setiap bagian formulir punya **sketsa parameter** (arti D, H, hp, t, Df, BCD, … beserta nilainya), hasil dilengkapi **lembar perhitungan langkah demi langkah** (rumus → substitusi → hasil), dan diekspor ke **Excel (.xlsx)** dan **PDF** dengan hak cipta *© Yan Malegi Diardi (DD/MM/YYYY - HH:MM)*. |
| ↳ Tiang pipa baja & helical | Kapasitas aksial tekan/tarik (API RP 2GEO α/β, cek plug; helical individual bearing + torsi AC358), efisiensi kelompok, lateral Broms umum + balok Winkler (elemen hingga), titik jepit Davisson–Robinson, AISC 360-16, pile cap, **kepala tiang & sambungan jepit/sendi dengan beton isi**. |
| ↳ Tangki Wash / Surge | Pelat penuh atau ringwall **otomatis dari diameter**, API 650 §5.11 & Annex E (Mrw, Ms, J, sloshing), hoop, lentur, geser satu/dua arah, pons kolom atap, penurunan tangki. |
| ↳ Gas Boot, Separator, IA Receiver | Vessel vertikal (oktagon/persegi) dan horizontal dua saddle: tekanan tanah dua arah tanpa tarik, stabilitas, desain telapak & pedestal (P–M), baut angkur ACI 318 Bab 17, penurunan. |
| ↳ Peralatan dinamis | WIP, WTP, kompresor: Richart–Whitman 6 mode, Fo ISO 1940, amplitudo & kecepatan getar, aturan ACI 351.3R, tekanan tanah, tulangan, penurunan. |
| ↳ Trafo (statis) | Plinth + telapak, angin, gempa peralatan kaku, bak oli IEEE 980, dongkrak, stopper gempa, penurunan. |
| **Penurunan** | Penurunan segera (Steinbrenner, tanah berlapis), konsolidasi primer (Terzaghi), kecepatan konsolidasi, kompresi sekunder. **Terhubung dengan Desain:** profil tanah & kriteria di tab ini dipakai modul Desain untuk menghitung penurunan pondasinya (pemeriksaan *penurunan ≤ izin* ikut di laporan), dan tombol *Buka di tab Penurunan* mengirim B, L, Df, q dari desain ke sini (dengan tautan kembali). |
| **Alur Migas** | Alur minyak dan gas dari sumur sampai gathering station: PFD, dua P&ID bergerak, 12 animasi alat, catatan sipil/struktur, dan tombol langsung ke kalkulator desain tiap peralatan. |

Dua bahasa (Indonesia dan Inggris), tema terang, gelap, atau otomatis.

## Memasang di iPad

1. Buka **<https://malegiw.github.io/REVU-iPad/>** di **Safari** (sekali saja, dengan internet).
2. Ketuk **Bagikan → Tambah ke Layar Utama**. Ikonnya bernama **YMD-CAL**.
3. Sejak itu app terbuka dari ikonnya, layar penuh, dan jalan tanpa internet. Setelah ada versi baru, buka sekali saat online lalu ketuk **Muat ulang**.

Masukan terakhir tersimpan di perangkat (localStorage), tidak dikirim ke mana pun. Tidak ada server, akun, atau pelacakan.

## Keakuratan

`tests/run.html` menjalankan dua kelompok uji (`tests/suite_*.js`):

- **penurunan**: `js/penurunan.js` dibandingkan dengan hasil versi Python di aplikasi utama (`tests/penurunan_cases.json`, toleransi relatif 1e-9), ditambah nilai acuan teori (Tv50 = 0,197, Tv90 = 0,848, Is Steinbrenner, faktor sudut Newmark).
- **desain**: `js/desain/*.js` terhadap 70 nilai acuan teori/rumus tertutup: Matlock–Reese & Hetenyi (FE Winkler), Broms, API RP 2GEO, AC358, API 650 Annex E, SNI 1726/1727, ACI 318, AISC 360, Richart–Whitman, tekanan tanah di batas kern dan distribusi segitiga, penautan ke tab Penurunan, CRC32 serta struktur XLSX/PDF.

```bash
python3 -m http.server 8610
# lalu buka http://127.0.0.1:8610/tests/run.html  (judul tab: "LOLOS 131/131")
```

## Struktur

- `index.html`, `css/app.css`, `js/app.js`: kerangka (menu, bahasa, tema, offline). `js/home.js` + `css/home.css`: beranda & dashboard. `icons/logo.svg`: logo YMD-CAL (ikon PNG dirender dari logo ini).
- `js/penurunan.js` (rumus) dan `js/penurunan_ui.js` (halaman + `settleFor`/`settleSend` untuk modul Desain), `js/flow.js` + `css/flow.css` (Alur Produksi Migas), `js/fmt.js` (format angka seperti Python).
- `js/desain_ui.js` + `css/desain.css`: halaman Desain (hub, modul, dashboard). Di `js/desain/`: `core.js` (satuan, angin, gempa, kombinasi beban), `rc.js` (SNI 2847/ACI 318), `steel.js` (AISC 360 pipa, baut angkur ACI 17), `footing.js` (solver tekanan tanah + desain telapak & pedestal), `pile.js`, `tank.js`, `vessel.js`, `dynamic.js`, `trafo.js` (mesin hitung, fungsi murni), `settle.js` (penautan ke tab Penurunan), `m_*.js` (formulir & laporan tiap modul), `ui.js` (formulir, editor beban & kombinasi, hasil, ekspor), `draw.js` (gambar hasil), `sketch.js` (sketsa parameter), `steps.js` (lembar perhitungan), `xlsx.js` dan `pdf.js` (penulis Excel & PDF tanpa pustaka luar).
- `data/` (teks dua bahasa Penurunan & Alur), `assets/` (gambar SVG), `icons/`, `manifest.webmanifest`.
- `sw.js`: service worker yang menyimpan semua berkas untuk offline (daftar berkas dan `VERSION`).

`data/`, `assets/`, `js/flow.js`, `css/flow.css`, dan `sw.js` semula dibuat oleh skrip `ipad_build.py` di aplikasi utama (privat). Daftar berkas dan `VERSION` di `sw.js` saat ini diperbarui manual (berkas Desain, beranda, logo; berkas Pondasi lama dihapus), jadi sesuaikan skrip itu sebelum membuat ulang `sw.js`. Teks dua bahasa modul Desain dan beranda ditulis langsung di kode (`L(id, en)`), tidak lewat `data/en_*.json`. Tombol kalkulator di Alur Migas dipetakan ke modul Desain di `js/app.js` (`FLOW_CALC`).

Untuk mencoba tanpa penyimpanan offline: tambahkan `?nosw=1` pada alamat saat pengembangan.
