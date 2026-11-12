<p align="center"><img src="icons/icon-192.png" width="96" alt="YMD-CAL"></p>

# YMD-CAL · Kalkulator Desain Pondasi & Sipil Migas (iPad offline)

Kalkulator desain pondasi dan sipil untuk fasilitas migas yang berjalan **sepenuhnya di iPad tanpa internet**. Satu proyek mengalir dalam satu alur: **data tanah → parameter gempa → desain pondasi (dangkal atau dalam) → penurunan → laporan** Excel & PDF.

**Buka di iPad: <https://malegiw.github.io/REVU-iPad/>**

> Alat bantu desain dan pembanding. Angka bawaan hanya contoh umum; hasil tetap perlu diverifikasi engineer yang berwenang terhadap Design Basis, data tanah, data vendor, dan kode yang berlaku.

## Alur proyek (contoh "Project A")

1. **Tanah** — isi lapisan hasil bor (N-SPT) atau sondir (CPT). Parameter desain dihitung otomatis dan bisa ditimpa. Di sini juga ditetapkan **tiang rencana** (jenis, D, L, FS): **kapasitas tiang tunggal** Qa tekan/tarik/lateral menjadi acuan semua pondasi dalam.
2. **Gempa** — isi Ss, S1, TL, kategori risiko. Kelas situs diambil otomatis dari data tanah (atau manual).
3. **Desain** — pilih kalkulator; tiap pondasi peralatan bisa **dangkal** (telapak/mat) atau **dalam** (tiang). Data tanah, tiang rencana, dan gempa terpakai otomatis. Urutan hitungan ditampilkan di panel **Alur perhitungan**:
   - **dalam:** kapasitas tiang tunggal → beban struktur atas (berat peralatan, isi, angin, gempa, berat cap) → **jumlah tiang** n ≥ P/(Qa·Eg) dan cek momen Pi = P/n ± M·x/Σx² → **ukuran pile cap** B = (n−1)s + 2ce (≥ denah peralatan) → **tebal cap** dari geser satu arah & pons → tulangan → pemeriksaan → penurunan;
   - **dangkal:** qa dari data tanah → beban → **ukuran telapak** A ≥ P/qa lalu cek tekanan, guling, geser → tebal → tulangan → pemeriksaan → penurunan.
4. **Penurunan** — penurunan segera, konsolidasi, dan total untuk semua pondasi dari tab Desain (dangkal & tiang), plus kasus manual.
5. **Laporan** — satu PDF/Excel berisi semua bab di atas, dengan hak cipta *© Yan Malegi Diardi (DD/MM/YYYY - HH:MM)*.

Alur ini tampil sebagai langkah 1–5 di atas setiap tab dan di Beranda.

## Isi

| Menu | Keterangan |
|---|---|
| **Beranda** | Alur proyek, dashboard status semua kalkulator (OK/NOT OK, rasio UR penentu, tipe pondasi dangkal/dalam), penurunan terbesar, dan pintu masuk ke Alur Produksi Migas. |
| **Tanah** | Lapisan tanah dengan N-SPT (efisiensi hammer → N60) atau CPT (qc, fs). Korelasi: cu (Stroud / (qc − σv)/Nkt), φ (Peck–Hanson–Thornburn / Kulhawy–Mayne), E, ν, e0, Cc (Hough), Cs, OCR (SHANSEP), cv, Cα; semua bisa ditimpa di *Parameter lanjutan*. Grafik profil (N60, qc, cu/φ, MAT), **kelas situs SNI 1726:2019 Tabel 5** dari N̄, **daya dukung pondasi dangkal** dengan pilihan metode **N-SPT** (Meyerhof, 25 mm), **CPT** (Meyerhof) atau **Vesic/Skempton**, dan **tiang rencana — kapasitas tiang tunggal (acuan desain)**: pipa baja pancang atau bor beton, metode α/β (API RP 2GEO & FHWA), N-SPT (Meyerhof) atau CPT (LCPC); Qa desain = min(Qu/FS; Pa struktur), Qa tarik, Ha lateral = min(Broms kepala jepit/FS; H pada defleksi izin), tabel & grafik kapasitas vs panjang. |
| **Gempa** | Fa, Fv, SMS, SM1, SDS, SD1, T0, Ts, Ie dari kategori risiko, kategori desain seismik (Tabel 8 & 9), spektrum respons desain. Dipakai semua modul Desain. |
| **Desain** | Lima kalkulator dengan input beban per kasus dan kombinasi otomatis SNI 1727:2020 / ASCE 7-16 (ASD & LRFD) + PIP STC01015, angin SNI 1727 Bab 29, sketsa parameter, lembar perhitungan langkah demi langkah, ekspor Excel & PDF. |
| ↳ Pilihan **dangkal / dalam** | Tangki, vessel, peralatan dinamis, dan trafo punya bagian *Tipe pondasi*. **Dangkal:** qa dihitung dari tab Tanah memakai B, L, Df pondasi itu (atau manual). Ukuran telapak bisa **otomatis dari beban & qa** (A ≥ P/qa, lalu tekanan, kontak, guling, geser; tebal dari geser & pons) atau manual. **Dalam:** tiang memakai **tiang rencana tab Tanah** (atau diatur di modul); **jumlah tiang, ukuran & tebal pile cap dihitung otomatis** dari beban (minimal 2 × 2, jarak s ≥ 2,5D, jarak maks dapat diatur, bawaan maks(8D; 3 m)); untuk **tangki, tiang disusun radial** (cincin konsentris dari tepi pelat ke pusat, bukan grid). Mode manual (grid s, ce) tetap tersedia. Kapasitas aksial dari tab Tanah, efisiensi kelompok Converse–Labarre, reaksi tiang cap kaku, lateral Broms + Winkler kepala jepit, struktur tiang (AISC 360 / SNI 2847 P–M), pons tiang pada cap, desain cap dengan reaksi tiang (§13.4.2.5), dan penurunan kelompok. Tangki di atas tiang memakai pelat datar terbalik (metode desain langsung); pondasi mesin di atas tiang memakai kekakuan kelompok tiang (indikatif). |
| ↳ Tiang pipa baja & helical | Profil tanah dari tab Tanah (atau manual), metode aksial α/β, N-SPT atau CPT, lateral, titik jepit, AISC 360-16, pile cap, kepala tiang & sambungan jepit/sendi beton isi, penurunan kelompok. |
| ↳ Tangki Wash / Surge | Pelat penuh, ringwall (otomatis dari diameter), atau pelat di atas tiang; API 650 §5.11 & Annex E. |
| ↳ Gas Boot, Separator, IA Receiver | Vessel vertikal & horizontal: tekanan tanah dua arah atau reaksi tiang, telapak/pile cap & pedestal, baut angkur ACI 318 Bab 17. |
| ↳ Peralatan dinamis | Richart–Whitman (Vs dari N-SPT Imai bila memakai data tanah) atau kekakuan kelompok tiang, ACI 351.3R. |
| ↳ Trafo (statis) | Plinth + telapak/pile cap, bak oli IEEE 980, dongkrak, stopper gempa. |
| **Penurunan** | Dibangun ulang: **pondasi dangkal** — penurunan segera (Steinbrenner, tanah berlapis), konsolidasi primer (Terzaghi, NC/OC) + sekunder, total terhadap umur rencana, kurva waktu, Δσ vs σ'v0; **pondasi dalam** — pemendekan elastis tiang + rakit ekuivalen (2L/3, sebaran 1H:4V; di ujung untuk tiang dukung ujung), pembanding Vesic. Daftar pondasi otomatis dari semua modul Desain + kasus manual. Kriteria (umur, batas dangkal/tiang, Boussinesq/2:1, kekakuan) berlaku untuk modul Desain. |
| **Laporan** | Data proyek (kepala laporan), status alur, pilihan isi (lengkap/ringkas, gambar, modul), lalu **laporan proyek gabungan** PDF (bab A Tanah, B Gempa, C Ringkasan desain, D… tiap modul, terakhir Penurunan) dan Excel. |
| **RTS** | Pencarian **Rokan Technical Standard** di iPad. Dokumen RTS (PDF, DOCX, XLSX, TXT, atau paket .json) **diimpor langsung di iPad** lalu dibaca & diindeks tanpa internet; disimpan hanya di perangkat (IndexedDB), tidak pernah masuk repo/server. Tanya bebas dalam bahasa Indonesia atau Inggris ("beton pondasi pakai mutu berapa?", "selimut beton", "baut angkur") — sinonim istilah sipil ID ↔ EN (beton = concrete, selimut = cover, lantai kerja = lean concrete/blinding, pemadatan = compaction …). Tampilan rapi: **ringkasan bento** (dokumen, parameter ditetapkan dengan cincin kemajuan, saran otomatis, status kepatuhan) lalu **tab Cari · Parameter · Kepatuhan · Pustaka** (satu bagian tampil sekaligus; pintasan `/` atau ⌘K untuk mencari, ↑/↓ pindah hasil, Esc tutup). Hasil: **jawaban cepat** (kalimat terbaik + nilai + **nomor & judul dokumen RTS sumber**), saring per dokumen dengan jumlah hasil, tampilan **Relevansi** atau **Per dokumen** (pasal dikelompokkan di bawah judul dokumennya), daftar pasal (nomor & judul dokumen, §pasal, halaman, cuplikan bersorot, nilai MPa/mm/%/ASTM/K-xxx/BJTS bergaris), panel pasal lengkap (salin kutipan + referensi, buka PDF asli di halamannya, pasal sebelumnya/berikutnya). **Parameter kunci desain** (fc', lean concrete, selimut, fy, semen, w/c, agregat, slump, curing, grout, baut angkur, elevasi atas pondasi, baja, galvanis, cat, tiang, uji tiang, FS daya dukung, penurunan izin, kedalaman, pemadatan, angin, gempa) dicari otomatis dan tampil sebagai daftar ringkas per kelompok (saring: semua / ditetapkan / ada saran / tidak ditemukan); ketuk **nilai saran** untuk langsung menetapkannya (bisa *Urungkan*), atau buka barisnya untuk melihat semua kandidat, pasal sumber, dan isi manual. **Cek kepatuhan**: fc', fy, selimut, baut angkur, FS, penurunan izin, dan kecepatan angin di modul Desain/Tanah/Penurunan dibandingkan dengan nilai RTS (OK / tidak sesuai). Ekspor Excel/PDF parameter & kepatuhan. |
| **Alur Migas** | (Menu kedua, di samping Beranda.) Alur minyak dan gas dari sumur sampai gathering station, dengan tombol ke kalkulator desain tiap peralatan. **Narasi suara** tiap tahap: tombol Putar/Jeda/Berhenti, sorotan kalimat yang sedang dibacakan, lanjut otomatis ke tahap berikutnya, pilihan kecepatan & suara. Bahasa Indonesia memakai **suara wanita** (mis. *Damayanti* di iPad), bahasa Inggris memakai **suara pria** (mis. *Daniel*/*Aaron*/*Arthur*). Sumber suara: **rekaman alami ElevenLabs** (bila sudah dibuat, lihat *Suara alami* di bawah; tombol *Simpan untuk offline*) atau **suara perangkat** (Web Speech API, offline). Suara perangkat dipilih otomatis yang paling natural (Premium/Enhanced/Natural) dan menghindari suara robotik; untuk hasil terbaik unduh *Damayanti (Enhanced)* / *Daniel (Enhanced)* di Pengaturan → Aksesibilitas → Konten Lisan → Suara. |

Dua bahasa (Indonesia dan Inggris), tema terang, gelap, atau otomatis. Ikon antarmuka berupa SVG garis yang seragam (`js/icons.js`).

## RTS (Rokan Technical Standard)

1. Simpan berkas RTS (PDF/DOCX/XLSX) ke app **Files** / iCloud Drive di iPad.
2. Buka tab **RTS** → tab **Pustaka** (atau kotak impor di keadaan kosong) → **Impor dokumen RTS**, pilih semua berkas sekaligus. Teks dibaca di iPad (PDF memakai pdf.js di `js/vendor/`), kepala/kaki halaman berulang dan baris daftar isi dibuang, pasal dikenali dari penomoran ("5.2.1 Concrete Strength", "SECTION 3", gaya *Heading* DOCX), nomor dokumen dari pola `RTS-…`.
3. Ketik pertanyaan di tab **Cari** (tiap hasil menunjukkan nomor & judul dokumen RTS-nya; pilih *Per dokumen* untuk mengelompokkan), atau buka tab **Parameter** dan ketuk nilai saran / nilai bergaris (mis. **28 MPa**) untuk menetapkannya. Tab **Kepatuhan** langsung membandingkan masukan Desain dengan nilai itu.
4. Pindah perangkat tanpa impor ulang: *Ekspor paket (.json)* lalu impor paket itu di perangkat lain.

Catatan: PDF hasil pindai (gambar tanpa teks) perlu OCR dulu di komputer. Konversi yang dipakai pada cek kepatuhan: K-xxx → fc' ≈ 0,083·K MPa; ASTM Grade N (ksi) ≈ 6,895·N MPa; psi, kg/cm², inci ke MPa/mm. Nilai hasil pencarian adalah **kandidat** — selalu baca pasal sumbernya. Repo ini publik, jadi **jangan commit isi dokumen RTS** ke repo; impor saja di perangkat.

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

## Suara alami (ElevenLabs)

Narasi Alur Migas bisa memakai rekaman suara manusia-sintetis ElevenLabs yang jauh lebih natural daripada suara bawaan perangkat. Rekaman dibuat **sekali** (≈ 131 kalimat per bahasa, ± 14.600 karakter Indonesia + 14.800 karakter Inggris ≈ 29.400 karakter, muat di paket *Starter* 30k karakter/bulan), disimpan di repo sebagai MP3 per kalimat (`assets/voice/<bahasa>/<hash>.mp3` + `manifest.json`), lalu diputar offline. Kalimat yang belum punya rekaman (mis. teks baru diubah) otomatis dibacakan suara perangkat.

**Cara termudah (bisa dari iPad, lewat github.com):**

1. Di repo: *Settings → Secrets and variables → Actions*:
   - *Secrets* → **`ELEVENLABS_API_KEY`** = kunci API ElevenLabs.
   - *Variables* (opsional) → **`ELEVENLABS_VOICE_ID_ID`** = voice ID **wanita** Bahasa Indonesia (pilih penutur asli Indonesia di Voice Library ElevenLabs agar logatnya natural) dan **`ELEVENLABS_VOICE_ID_EN`** = voice ID **pria** English. Tanpa variabel, dipakai suara premade *Sarah* (ID) dan *George* (EN).
2. Tab **Actions → "Suara alami (ElevenLabs)" → Run workflow** (pilih branch `main`). Workflow membuat MP3, memperbarui `sw.js`, meng-commit, dan meminta GitHub Pages membangun ulang.
3. Buka app saat online → Alur Migas → *Sumber suara: Rekaman alami* → **Simpan untuk offline**.

Lewat komputer: `ELEVENLABS_API_KEY=… node tools/tts_elevenlabs.mjs` (opsi `--dry-run` untuk menghitung karakter tanpa API, `--list-voices`, `--lang id|en`, `--force` setelah ganti suara, `--prune` hapus rekaman lama), lalu `python3 tools/build_sw.py`. Jangan pernah menulis kunci API di kode atau commit.

## Memasang di iPad

1. Buka **<https://malegiw.github.io/REVU-iPad/>** di **Safari** (sekali saja, dengan internet).
2. Ketuk **Bagikan → Tambah ke Layar Utama**. Ikonnya bernama **YMD-CAL**.
3. Sejak itu app terbuka dari ikonnya, layar penuh, dan jalan tanpa internet. Setelah ada versi baru, buka sekali saat online lalu ketuk **Muat ulang**.

Masukan tersimpan di perangkat (localStorage: `ymd.project.v1` untuk data proyek/tanah/gempa/penurunan, `ymd.desain.v1` untuk modul Desain, `ymd.rts.v1` untuk nilai RTS; IndexedDB `ymd-rts` untuk dokumen RTS yang diimpor), tidak dikirim ke mana pun. Tidak ada server, akun, atau pelacakan.

## Keakuratan

`tests/run.html` menjalankan empat kelompok uji (`tests/suite_*.js`):

- **penurunan**: `js/penurunan.js` dibandingkan dengan hasil versi Python di aplikasi utama (`tests/penurunan_cases.json`, toleransi relatif 1e-9), ditambah nilai acuan teori.
- **desain**: `js/desain/*.js` terhadap nilai acuan teori/rumus tertutup (Matlock–Reese, Hetenyi, Broms, API RP 2GEO, AC358, API 650 Annex E, SNI 1726/1727 & ASCE 7-22, ACI 318-14 & 318-19, AISC 360, Richart–Whitman, XLSX/PDF), ditambah alur desain baru (tiang tunggal Qa = min(Qu/FS; Pa), grid & susunan radial tangki, jumlah tiang/pile cap/telapak otomatis dengan semua pemeriksaan OK di keempat modul) dan hash rekaman suara (FNV-1a).
- **tanah**: 44 uji untuk data tanah & pondasi dalam — korelasi (N60, φ, cu, e0, Cc), kelas situs SNI 1726, Nc/Nq/Nγ, Meyerhof N-SPT/CPT, Skempton, kapasitas tiang (α/β sama dengan `pile.js`, N-SPT Meyerhof, CPT LCPC), penurunan dangkal = `analyze()` langsung, rakit ekuivalen, keseimbangan reaksi tiang, momen pile cap dari reaksi titik, KDS & spektrum.

- **rts**: 52 uji mesin pencari RTS dengan dokumen fiktif — token & sinonim ID ↔ EN, nilai teknis & konversi (psi, inci, K-xxx, ASTM Grade, BJTS), judul pasal vs butir daftar, kepala/kaki halaman, penyambungan baris PDF, nomor dokumen, peringkat BM25, cuplikan, parameter kunci, cek kepatuhan, item teks PDF, DOCX/XLSX/ZIP deflate, paket JSON.

```bash
python3 -m http.server 8610
# lalu buka http://127.0.0.1:8610/tests/run.html  (judul tab: "LOLOS 274/274")
```

## Struktur

- `index.html`, `css/app.css`, `js/app.js`: kerangka (menu, bahasa, tema, offline). `js/home.js` + `css/home.css`: beranda & dashboard. `icons/logo.svg`: logo YMD-CAL. `js/icons.js`: set ikon SVG. `js/voice.js`: narasi suara Alur Migas (rekaman alami + suara perangkat).
- `js/project.js`: data proyek bersama (info, tanah, gempa, metode daya dukung, kriteria penurunan), kelas situs → parameter gempa, KDS, spektrum, dan komponen alur proyek. `js/pj_ui.js` + `css/proyek.css`: komponen tab proyek.
- `js/tanah_ui.js` (Tanah), `js/gempa_ui.js` (Gempa), `js/penurunan_ui.js` (Penurunan, memakai mesin `js/penurunan.js`), `js/laporan_ui.js` (Laporan gabungan).
- `js/rts_ui.js` + `css/rts.css` (tab RTS), `js/rts.js` (mesin: sinonim, nilai teknis, pemecah pasal, indeks BM25, parameter kunci, kepatuhan; fungsi murni), `js/rts_store.js` (IndexedDB `ymd-rts`, impor PDF/DOCX/XLSX/TXT/paket JSON), `js/vendor/pdf*.mjs` (pdf.js 4.10.38 legacy, Apache-2.0, `LICENSE-pdfjs.txt`). Nilai RTS yang ditetapkan disimpan di localStorage `ymd.rts.v1`.
- `js/desain_ui.js` + `css/desain.css`: halaman Desain. Di `js/desain/`: `core.js` (satuan, angin, gempa, kombinasi beban), `soil.js` (korelasi tanah, daya dukung, kapasitas tiang, kelas situs, penurunan dangkal & kelompok), `deep.js` (pilihan dangkal/dalam: tiang tunggal acuan, jumlah tiang & ukuran/tebal cap otomatis, telapak otomatis, susunan grid & radial, panel alur perhitungan, tata letak tiang, kelompok tiang di bawah cap, pelat tangki di atas tiang, kekakuan tiang, tabel & gambar), `rc.js`, `steel.js`, `footing.js` (tekanan tanah atau reaksi tiang + desain telapak/pile cap & pedestal), `pile.js`, `tank.js`, `vessel.js`, `dynamic.js`, `trafo.js`, `settle.js`, `m_*.js` (formulir & laporan tiap modul), `ui.js` (formulir, hasil, ekspor; laporan berbab), `draw.js`, `chart.js` (grafik garis), `sketch.js`, `steps.js`, `xlsx.js`, `pdf.js`.
- `data/` (teks Alur Migas), `assets/` (gambar SVG), `icons/`, `manifest.webmanifest`.
- `sw.js`: service worker yang menyimpan semua berkas untuk offline (daftar berkas dan `VERSION`); rekaman suara `assets/voice/` disimpan di cache terpisah saat diputar.
- `tools/build_sw.py`: memperbarui daftar berkas & `VERSION` di `sw.js` (`python3 tools/build_sw.py`). `tools/tts_elevenlabs.mjs` + `.github/workflows/voice.yml`: pembuat rekaman suara alami.

`data/`, `assets/`, `js/flow.js`, `css/flow.css`, dan `sw.js` semula dibuat oleh skrip `ipad_build.py` di aplikasi utama (privat). Daftar berkas dan `VERSION` di `sw.js` kini dibuat oleh `tools/build_sw.py` (semua `assets/*` tanpa subfolder, `css/*.css`, `data/*.json`, `icons/*`, `js/*.js`, `js/desain/*.js`, `js/vendor/*.mjs`, `index.html`, manifest; VERSION = 10 karakter awal SHA-1 isi berkas + kode `sw.js`), jadi sesuaikan skrip lama itu sebelum membuat ulang `sw.js`. Teks dua bahasa tab baru ditulis langsung di kode (`L(id, en)`); `data/en_penurunan.json` lama tidak dipakai lagi dan dihapus. Tombol kalkulator di Alur Migas dipetakan ke modul Desain di `js/app.js` (`FLOW_CALC`).

Untuk mencoba tanpa penyimpanan offline: tambahkan `?nosw=1` pada alamat saat pengembangan.
