<p align="center"><img src="icons/icon-192.png" width="96" alt="YMD-CAL"></p>

# YMD-CAL · Kalkulator Desain Pondasi & Sipil Migas (iPad offline)

Kalkulator desain pondasi dan sipil untuk fasilitas migas yang berjalan **sepenuhnya di iPad tanpa internet**. Satu proyek mengalir dalam satu alur: **data tanah → parameter gempa → desain pondasi (dangkal atau dalam) → penurunan → laporan** Excel & PDF.

**Buka di iPad: <https://malegiw.github.io/REVU-iPad/>**

> Alat bantu desain dan pembanding. Angka bawaan hanya contoh umum; hasil tetap perlu diverifikasi engineer yang berwenang terhadap Design Basis, data tanah, data vendor, dan kode yang berlaku.

## Alur proyek (contoh "Project A")

1. **Tanah** — isi lapisan hasil bor (N-SPT) atau sondir (CPT). Parameter desain dihitung otomatis dan bisa ditimpa.
2. **Gempa** — isi Ss, S1, TL, kategori risiko. Kelas situs diambil otomatis dari data tanah (atau manual).
3. **Desain** — pilih kalkulator; tiap pondasi peralatan bisa **dangkal** (telapak/mat) atau **dalam** (tiang). Data tanah dan gempa terpakai otomatis.
4. **Penurunan** — penurunan segera, konsolidasi, dan total untuk semua pondasi dari tab Desain (dangkal & tiang), plus kasus manual.
5. **Laporan** — satu PDF/Excel berisi semua bab di atas, dengan hak cipta *© Yan Malegi Diardi (DD/MM/YYYY - HH:MM)*.

Alur ini tampil sebagai langkah 1–5 di atas setiap tab dan di Beranda.

## Isi

| Menu | Keterangan |
|---|---|
| **Beranda** | Alur proyek, dashboard status semua kalkulator (OK/NOT OK, rasio UR penentu, tipe pondasi dangkal/dalam), penurunan terbesar, dan pintu masuk ke Alur Produksi Migas. |
| **Tanah** | Lapisan tanah dengan N-SPT (efisiensi hammer → N60) atau CPT (qc, fs). Korelasi: cu (Stroud / (qc − σv)/Nkt), φ (Peck–Hanson–Thornburn / Kulhawy–Mayne), E, ν, e0, Cc (Hough), Cs, OCR (SHANSEP), cv, Cα; semua bisa ditimpa di *Parameter lanjutan*. Grafik profil (N60, qc, cu/φ, MAT), **kelas situs SNI 1726:2019 Tabel 5** dari N̄, **daya dukung pondasi dangkal** dengan pilihan metode **N-SPT** (Meyerhof, 25 mm), **CPT** (Meyerhof) atau **Vesic/Skempton**, dan pratinjau **kapasitas aksial tiang** (α/β API RP 2GEO & FHWA, N-SPT Meyerhof, CPT LCPC). |
| **Gempa** | Fa, Fv, SMS, SM1, SDS, SD1, T0, Ts, Ie dari kategori risiko, kategori desain seismik (Tabel 8 & 9), spektrum respons desain. Dipakai semua modul Desain. |
| **Desain** | Lima kalkulator dengan input beban per kasus dan kombinasi otomatis SNI 1727:2020 / ASCE 7-16 (ASD & LRFD) + PIP STC01015, angin SNI 1727 Bab 29, sketsa parameter, lembar perhitungan langkah demi langkah, ekspor Excel & PDF. |
| ↳ Pilihan **dangkal / dalam** | Tangki, vessel, peralatan dinamis, dan trafo punya bagian *Tipe pondasi*. **Dangkal:** qa dihitung dari tab Tanah memakai B, L, Df pondasi itu (atau manual). **Dalam:** telapak menjadi **pile cap**, tiang pipa baja atau bor beton ditata otomatis (jarak s, tepi ce); kapasitas aksial dari tab Tanah, efisiensi kelompok Converse–Labarre, reaksi tiang cap kaku, lateral Broms + Winkler kepala jepit, struktur tiang (AISC 360 / SNI 2847 P–M), pons tiang pada cap, desain cap dengan reaksi tiang (§13.4.2.5), dan penurunan kelompok. Tangki di atas tiang memakai pelat datar terbalik (metode desain langsung); pondasi mesin di atas tiang memakai kekakuan kelompok tiang (indikatif). |
| ↳ Tiang pipa baja & helical | Profil tanah dari tab Tanah (atau manual), metode aksial α/β, N-SPT atau CPT, lateral, titik jepit, AISC 360-16, pile cap, kepala tiang & sambungan jepit/sendi beton isi, penurunan kelompok. |
| ↳ Tangki Wash / Surge | Pelat penuh, ringwall (otomatis dari diameter), atau pelat di atas tiang; API 650 §5.11 & Annex E. |
| ↳ Gas Boot, Separator, IA Receiver | Vessel vertikal & horizontal: tekanan tanah dua arah atau reaksi tiang, telapak/pile cap & pedestal, baut angkur ACI 318 Bab 17. |
| ↳ Peralatan dinamis | Richart–Whitman (Vs dari N-SPT Imai bila memakai data tanah) atau kekakuan kelompok tiang, ACI 351.3R. |
| ↳ Trafo (statis) | Plinth + telapak/pile cap, bak oli IEEE 980, dongkrak, stopper gempa. |
| **Penurunan** | Dibangun ulang: **pondasi dangkal** — penurunan segera (Steinbrenner, tanah berlapis), konsolidasi primer (Terzaghi, NC/OC) + sekunder, total terhadap umur rencana, kurva waktu, Δσ vs σ'v0; **pondasi dalam** — pemendekan elastis tiang + rakit ekuivalen (2L/3, sebaran 1H:4V; di ujung untuk tiang dukung ujung), pembanding Vesic. Daftar pondasi otomatis dari semua modul Desain + kasus manual. Kriteria (umur, batas dangkal/tiang, Boussinesq/2:1, kekakuan) berlaku untuk modul Desain. |
| **Laporan** | Data proyek (kepala laporan), status alur, pilihan isi (lengkap/ringkas, gambar, modul), lalu **laporan proyek gabungan** PDF (bab A Tanah, B Gempa, C Ringkasan desain, D… tiap modul, terakhir Penurunan) dan Excel. |
| **Alur Migas** | (Menu kedua, di samping Beranda.) Alur minyak dan gas dari sumur sampai gathering station, dengan tombol ke kalkulator desain tiap peralatan. **Narasi suara** tiap tahap: tombol Putar/Jeda/Berhenti, sorotan kalimat yang sedang dibacakan, lanjut otomatis ke tahap berikutnya, pilihan kecepatan & suara. Bahasa Indonesia memakai **suara wanita** (mis. *Damayanti* di iPad), bahasa Inggris memakai **suara pria** (mis. *Daniel*/*Aaron*/*Arthur*). Memakai suara bawaan perangkat (Web Speech API), jadi jalan offline; bila suaranya belum terpasang, tambahkan di Pengaturan → Aksesibilitas → Konten Lisan → Suara. |

Dua bahasa (Indonesia dan Inggris), tema terang, gelap, atau otomatis. Ikon antarmuka berupa SVG garis yang seragam (`js/icons.js`).

## Edisi kode desain

Dipilih di Desain → *Data proyek, edisi kode…* (berlaku untuk semua kalkulator dan laporan):

| Bidang | Terbaru (bawaan) | Alternatif |
|---|---|---|
| Angin & kombinasi beban | **ASCE 7-22**: Kz = 2,41(z/zg)^(2/α) dengan α/zg baru (B 7,5/1000 m; C 9,8/750 m; D 11,5/590 m), qz = 0,613·Kz·Kzt·Ke·V², Kd pada gaya F = qz·Kd·G·Cf·Af (§29.4) | SNI 1727:2020 / ASCE 7-16 (Kz = 2,01…, Kd di qz) |
| Beton | **ACI 318-19**: geser satu arah telapak/pelat 0,66·λs·λ·ρw^(1/3)·√fc' (Tabel 22.5.5.1c, λs = √(2/(1+0,004d))), λs pada geser dua arah, kait ldh baru (§25.4.3.1), nomor pasal Bab 17 baru | SNI 2847:2019 / ACI 318-14 |
| Baja | **AISC 360-22** (rumus pipa bulat sama dengan SNI 1729:2020 / AISC 360-16) | — |
| Mesin | ISO 21940-11 (mutu balans, pengganti ISO 1940-1), ISO 20816 (getaran, pengganti ISO 10816), ACI 351.3R-18 | — |
| Gempa | SNI 1726:2019 (edisi Indonesia terbaru; dasar ASCE 7-16) | — |

Catatan: ACI 318-19 membuat kapasitas geser satu arah telapak tebal dengan tulangan sedikit jauh lebih kecil daripada ACI 318-14 — itu perilaku kode yang benar, bukan kesalahan.

## Memasang di iPad

1. Buka **<https://malegiw.github.io/REVU-iPad/>** di **Safari** (sekali saja, dengan internet).
2. Ketuk **Bagikan → Tambah ke Layar Utama**. Ikonnya bernama **YMD-CAL**.
3. Sejak itu app terbuka dari ikonnya, layar penuh, dan jalan tanpa internet. Setelah ada versi baru, buka sekali saat online lalu ketuk **Muat ulang**.

Masukan tersimpan di perangkat (localStorage: `ymd.project.v1` untuk data proyek/tanah/gempa/penurunan, `ymd.desain.v1` untuk modul Desain), tidak dikirim ke mana pun. Tidak ada server, akun, atau pelacakan.

## Keakuratan

`tests/run.html` menjalankan tiga kelompok uji (`tests/suite_*.js`):

- **penurunan**: `js/penurunan.js` dibandingkan dengan hasil versi Python di aplikasi utama (`tests/penurunan_cases.json`, toleransi relatif 1e-9), ditambah nilai acuan teori.
- **desain**: `js/desain/*.js` terhadap 83 nilai acuan teori/rumus tertutup (Matlock–Reese, Hetenyi, Broms, API RP 2GEO, AC358, API 650 Annex E, SNI 1726/1727 & ASCE 7-22, ACI 318-14 & 318-19, AISC 360, Richart–Whitman, XLSX/PDF).
- **tanah**: 44 uji untuk data tanah & pondasi dalam — korelasi (N60, φ, cu, e0, Cc), kelas situs SNI 1726, Nc/Nq/Nγ, Meyerhof N-SPT/CPT, Skempton, kapasitas tiang (α/β sama dengan `pile.js`, N-SPT Meyerhof, CPT LCPC), penurunan dangkal = `analyze()` langsung, rakit ekuivalen, keseimbangan reaksi tiang, momen pile cap dari reaksi titik, KDS & spektrum.

```bash
python3 -m http.server 8610
# lalu buka http://127.0.0.1:8610/tests/run.html  (judul tab: "LOLOS 188/188")
```

## Struktur

- `index.html`, `css/app.css`, `js/app.js`: kerangka (menu, bahasa, tema, offline). `js/home.js` + `css/home.css`: beranda & dashboard. `icons/logo.svg`: logo YMD-CAL. `js/icons.js`: set ikon SVG. `js/voice.js`: narasi suara Alur Migas.
- `js/project.js`: data proyek bersama (info, tanah, gempa, metode daya dukung, kriteria penurunan), kelas situs → parameter gempa, KDS, spektrum, dan komponen alur proyek. `js/pj_ui.js` + `css/proyek.css`: komponen tab proyek.
- `js/tanah_ui.js` (Tanah), `js/gempa_ui.js` (Gempa), `js/penurunan_ui.js` (Penurunan, memakai mesin `js/penurunan.js`), `js/laporan_ui.js` (Laporan gabungan).
- `js/desain_ui.js` + `css/desain.css`: halaman Desain. Di `js/desain/`: `core.js` (satuan, angin, gempa, kombinasi beban), `soil.js` (korelasi tanah, daya dukung, kapasitas tiang, kelas situs, penurunan dangkal & kelompok), `deep.js` (pilihan dangkal/dalam: tata letak tiang, kelompok tiang di bawah cap, pelat tangki di atas tiang, kekakuan tiang, tabel & gambar), `rc.js`, `steel.js`, `footing.js` (tekanan tanah atau reaksi tiang + desain telapak/pile cap & pedestal), `pile.js`, `tank.js`, `vessel.js`, `dynamic.js`, `trafo.js`, `settle.js`, `m_*.js` (formulir & laporan tiap modul), `ui.js` (formulir, hasil, ekspor; laporan berbab), `draw.js`, `chart.js` (grafik garis), `sketch.js`, `steps.js`, `xlsx.js`, `pdf.js`.
- `data/` (teks Alur Migas), `assets/` (gambar SVG), `icons/`, `manifest.webmanifest`.
- `sw.js`: service worker yang menyimpan semua berkas untuk offline (daftar berkas dan `VERSION`).

`data/`, `assets/`, `js/flow.js`, `css/flow.css`, dan `sw.js` semula dibuat oleh skrip `ipad_build.py` di aplikasi utama (privat). Daftar berkas dan `VERSION` di `sw.js` kini diperbarui manual (semua `assets/*`, `css/*.css`, `data/*.json`, `icons/*`, `js/*.js`, `js/desain/*.js`, `index.html`, manifest; VERSION = 10 karakter awal SHA-1 isi berkas), jadi sesuaikan skrip itu sebelum membuat ulang `sw.js`. Teks dua bahasa tab baru ditulis langsung di kode (`L(id, en)`); `data/en_penurunan.json` lama tidak dipakai lagi dan dihapus. Tombol kalkulator di Alur Migas dipetakan ke modul Desain di `js/app.js` (`FLOW_CALC`).

Untuk mencoba tanpa penyimpanan offline: tambahkan `?nosw=1` pada alamat saat pengembangan.
