# Review by YMD · Kalkulator (iPad offline)

Kalkulator dan referensi teknik sipil untuk reviewer dokumen, yang berjalan **sepenuhnya di iPad tanpa internet**. Ini versi ringan dari aplikasi Review by YMD: hanya alat yang tidak membutuhkan AI atau dokumen proyek.

> Pembanding untuk review, bukan pengganti perhitungan geoteknik atau struktur. Angka bawaan hanya contoh umum. Ikuti Design Basis dan kode yang dipakai dokumen.

## Isi

| Alat | Keterangan |
|---|---|
| **Desain Pondasi** (paket lengkap, baru) | Lima kalkulator desain dengan **input beban per kasus** (D, Do, Dt, L, T, Wx/Wy, Ex/Ey) dan **kombinasi beban otomatis** SNI 1727:2020 / ASCE 7-16 (ASD & LRFD) + beban proses PIP STC01015 (operasi, uji hidrostatik, kosong, termal, mesin, hubung singkat), faktor dapat diubah, Ev = 0,2·SDS·D, opsi gempa ortogonal 100–30. Angin SNI 1727 Bab 29 dan gempa SNI 1726:2019 (Fa, Fv, SDS, SD1, Cs) dari data lokasi bersama. Satuan kN·kPa atau ton·t/m². Ekspor **Excel (.xlsx)** dan **PDF** lembar hitungan dengan hak cipta *© Yan Malegi Diardi (DD/MM/YYYY - HH:MM)*. Semua gambar SVG bergerak (beban, angin, cairan, rotor, kurva defleksi/momen, peta tekanan). |
| ↳ Tiang pipa baja & helical | Kapasitas aksial tekan/tarik (API RP 2GEO α/β, cek plug; helical individual bearing + korelasi torsi AC358), efisiensi kelompok, lateral Broms umum (tanah berlapis) + balok di atas pegas Winkler (elemen hingga), titik jepit Davisson–Robinson, AISC 360-16 (lentur, tekan, geser, H1-1 + B1), pile cap (lentur, geser satu arah §13.4.2.5, pons), **perlakuan kepala tiang & sambungan jepit/sendi dengan beton isi** (tumpu, pons tiang, dowel tarik + friksi geser, penjangkaran, lekatan AISC I6.3c, P–M beton isi untuk jepit). |
| ↳ Tangki Wash / Surge | Pelat penuh atau ringwall **otomatis dari diameter**: berat tangki, angin + stabilitas API 650 §5.11, gempa API 650 Annex E (Wi, Wc, Mrw, Ms, rasio angkur J, geser, sloshing), tekanan ringwall, tarik hoop & tulangan, telapak ringwall, pelat lingkaran (kantilever + interior), geser satu arah, pons kolom atap. |
| ↳ Gas Boot, Separator, IA Receiver | Vessel vertikal (pedestal & telapak oktagon/persegi) dan horizontal dua saddle (telapak gabungan/terpisah, gesek termal, kopel memanjang): tekanan tanah dua arah tanpa tarik (solver numerik), guling, geser, lentur, geser satu/dua arah dengan transfer momen, pedestal P–M serat, baut angkur ACI 318 Bab 17. |
| ↳ Peralatan dinamis | WIP, WTP, kompresor udara/torak: Richart–Whitman (vertikal, horizontal, rocking, torsi, sliding–rocking tergandeng), faktor tanam, redaman, Fo ISO 1940, amplitudo & kecepatan getar, aturan proporsi ACI 351.3R, tekanan tanah & tulangan blok. |
| ↳ Trafo (statis) | Plinth + telapak, angin badan trafo, gempa peralatan kaku (Ie 1,5), bak penampung oli IEEE 980 (oli + hujan + air pemadam), dongkrak (tumpu & pons), gaya stopper gempa. |
| **Penurunan Pondasi** | Penurunan segera (Steinbrenner, tanah berlapis), konsolidasi primer lempung (Terzaghi, sublapis, muka air tanah), kecepatan konsolidasi, kompresi sekunder opsional, cek batas izin dan distorsi sudut, perbandingan dengan nilai di dokumen, unduh .md / .csv, cetak ke PDF. |
| **Pondasi Tangki & Peralatan** | Tiga pemeriksaan: pondasi dangkal peralatan (footing + pedestal, banyak kasus beban, tekanan dasar dengan eksentrisitas dua arah, daya dukung Meyerhof/Vesic, guling, geser, denah), pondasi mesin berputar (indikatif: frekuensi alami vertikal dan geser, pemisahan terhadap frekuensi operasi, rasio massa), dan pondasi tangki silindris (API 650 disederhanakan: ringwall, daya dukung, penurunan pusat–tepi, stabilitas angin). Perbandingan dengan nilai di dokumen, unduh .md / .csv, cetak ke PDF. |
| **Alur Produksi Migas** | Alur minyak dan gas dari sumur sampai gathering station: PFD dan dua P&ID bergerak, gambar bernomor, 12 animasi detail alat, cerita, komponen, dan catatan sipil/struktur. |

Dua bahasa (Indonesia dan Inggris), tema terang, gelap, atau otomatis. Kalkulator lain (saluran & gorong-gorong, stabilitas lereng, dinding penahan tanah) menyusul.

> Desain Pondasi adalah alat bantu desain/pembanding dengan metode yang dinyatakan di tiap laporan (bagian *Dasar perhitungan & batasan*). Hasil tetap perlu diverifikasi engineer yang berwenang terhadap Design Basis, data tanah, dan data vendor proyek.

## Memasang di iPad

1. Buka alamat situs ini di **Safari** (sekali saja, dengan internet).
2. Ketuk **Bagikan → Tambah ke Layar Utama**.
3. Sejak itu app terbuka dari ikonnya, layar penuh, dan jalan tanpa internet. Setelah ada versi baru, muncul tombol **Muat ulang**.

Masukan terakhir tersimpan di perangkat (localStorage), tidak dikirim ke mana pun. Tidak ada server, akun, atau pelacakan.

## Keakuratan

Rumus di `js/penurunan.js` dan `js/fondasi.js` adalah padanan satu-satu dari versi Python di aplikasi utama. `tests/run.html` memuat berkas `tests/*_cases.json` (kasus acak dan galat beserta hasil Python: 54 kasus penurunan, 64 kasus pondasi peralatan, 40 mesin berputar, 40 tangki, dan 160 pemeriksaan fungsi dasar), menjalankan JavaScript pada masukan yang sama, lalu membandingkan semua angka dan teks pengecekan (toleransi relatif 1e-9). Modul Desain (`js/desain/*.js`) diuji di `tests/suite_desain.js` terhadap 67 nilai acuan teori/rumus tertutup: Matlock–Reese & Hetenyi (FE Winkler), Broms, API RP 2GEO, API 650 Annex E, SNI 1726/1727, ACI 318, AISC 360, Richart–Whitman, tekanan tanah di batas kern dan distribusi segitiga, CRC32 serta struktur XLSX/PDF. Tiap kelompok uji ada di `tests/suite_*.js`. Buka lewat server lokal:

```bash
python3 -m http.server 8610
# lalu buka http://127.0.0.1:8610/tests/run.html  (judul tab: "LOLOS 449/449")
```

Nilai acuan teori ikut diuji (Tv50 = 0,197, Tv90 = 0,848, Is Steinbrenner, faktor sudut Newmark, pembulatan seperti Python).

## Struktur

- `index.html`, `css/app.css`, `js/app.js`: kerangka (menu, bahasa, tema, offline).
- `js/penurunan.js` dan `js/fondasi.js` (rumus), `js/penurunan_ui.js` dan `js/fondasi_ui.js` (halaman), `js/flow.js` + `css/flow.css` (halaman Alur Produksi Migas).
- `js/fmt.js` (pembulatan dan format angka seperti Python), `js/kit.js` (kolom masukan, tabel, unduhan bersama untuk halaman alat).
- `js/desain_ui.js` + `css/desain.css`: halaman Desain Pondasi (hub, halaman modul, gerak). Di `js/desain/`: `core.js` (satuan, angin, gempa, kombinasi beban), `rc.js` (SNI 2847/ACI 318: lentur, geser, pons, penyaluran, P–M serat), `steel.js` (AISC 360 pipa, baut angkur ACI 17), `footing.js` (solver tekanan tanah umum + desain telapak & pedestal), `pile.js`, `tank.js`, `vessel.js`, `dynamic.js`, `trafo.js` (mesin hitung, fungsi murni), `m_*.js` (formulir & laporan tiap modul), `ui.js` (formulir, editor beban & kombinasi, tampilan hasil, ekspor), `draw.js` (gambar SVG), `xlsx.js` dan `pdf.js` (penulis Excel & PDF tanpa pustaka luar).
- `data/` (teks dua bahasa), `assets/` (gambar SVG), `icons/`, `manifest.webmanifest`.
- `sw.js`: service worker yang menyimpan semua berkas untuk offline. **Dibuat otomatis** (daftar berkas dan versi), jangan diedit tangan.

`data/`, `assets/`, `js/flow.js`, `css/flow.css`, dan `sw.js` dibuat oleh skrip `ipad_build.py` di aplikasi utama (privat). Perubahan kecil pada berkas tulisan tangan di atas bisa diedit langsung, tetapi `sw.js` harus dibuat ulang agar iPad mengambil versi baru. Catatan: daftar berkas dan `VERSION` di `sw.js` saat ini diperbarui manual untuk modul Desain (`css/desain.css`, `js/desain_ui.js`, `js/desain/*.js`); pastikan `ipad_build.py` ikut menyertakan berkas tersebut. Teks modul Desain dua bahasa ditulis langsung di kode (`L(id, en)`), tidak lewat `data/en_*.json`.

Untuk mencoba tanpa penyimpanan offline: tambahkan `?nosw=1` pada alamat saat pengembangan.
