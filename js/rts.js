// Mesin pencari RTS (Rokan Technical Standard): fungsi murni tanpa DOM, diuji di tests/suite_rts.js.
// Dokumen → bagian (pasal) → indeks BM25 dengan sinonim Indonesia–Inggris istilah sipil/struktur; hasil berisi cuplikan bersorot
// dan nilai teknis yang terbaca (MPa, mm, %, ASTM …). Isi dokumen RTS tidak pernah ada di repo: diimpor & disimpan di perangkat.

// ---------------------------------------------------------------- teks
const DIA = /[̀-ͯ]/g
export const fold = (s) => String(s ?? "").normalize("NFKD").replace(DIA, "").toLowerCase()

// kata umum yang tidak membantu pencarian (pertanyaan bebas: "beton pondasi pakai mutu berapa?")
const STOP = new Set(("yang dan di ke dari untuk dengan pada adalah ini itu apa berapa bagaimana harus perlu pakai memakai menggunakan digunakan gunakan dipakai mau saya kita kami apakah atau juga ada dalam akan bisa dapat oleh sebagai tersebut para maka agar jika bila kalau tentang seperti setiap semua tiap boleh berupa sesuai mana kapan dimana gimana nya dong sih ya tidak bukan sudah belum masih lagi " +
  "the a an of to in for and or is are be been being shall should must will would can could may might what which how why when where who use used using with by on at as from that this these those it its all any each into than then there their such other not no also per do does did have has had if only").split(" "))

// stemer ringan: jamak Inggris dan akhiran -nya
export function stem(w) {
  if (w.length > 5 && w.endsWith("nya")) w = w.slice(0, -3)
  if (/^\d/.test(w)) return w
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y"
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is|[^e]as)$/.test(w)) return w.slice(0, -1)   // "kelas", "luas", "batas" tetap
  return w
}
// token: huruf/angka; angka desimal & tanda kutip f'c dipertahankan ("fc'" → "fc")
export function words(s) {
  return fold(s).replace(/(\d),(\d)/g, "$1.$2").replace(/f['’`]c|fc['’`]/g, "fc").match(/[a-z]+\d*[a-z]*|\d+(?:\.\d+)?/g) || []
}
export const tokens = (s) => words(s).filter((w) => !STOP.has(w)).map(stem)

// ---------------------------------------------------------------- sinonim (konsep → bentuk kata/frasa Indonesia & Inggris)
// Frasa ditulis dengan spasi; dicocokkan setelah tokens(). Konsep yang sama dipakai untuk memperluas kueri.
export const CONCEPTS = {
  concrete: ["beton", "concrete", "cor", "pengecoran", "casting", "mix design", "campuran beton"],
  strength: ["mutu", "kuat tekan", "compressive strength", "strength", "kekuatan", "grade", "kelas", "class", "fc", "f c", "karakteristik"],
  lean: ["lean concrete", "lantai kerja", "blinding", "mud mat", "mudmat", "working slab", "beton rabat"],
  rebar: ["tulangan", "besi beton", "rebar", "reinforcement", "reinforcing", "reinforcing bar", "deformed bar", "bjts", "bjtp", "a615", "a706", "baja tulangan"],
  yield: ["leleh", "yield", "fy", "tegangan leleh", "yield strength"],
  cover: ["selimut", "selimut beton", "cover", "concrete cover", "clear cover", "penutup beton"],
  steel: ["baja", "steel", "structural steel", "baja struktur", "profil", "a36", "a992", "a572", "wf", "h beam"],
  bolt: ["baut", "bolt", "baut angkur", "anchor bolt", "anchor", "angkur", "f1554", "a307", "a325", "a490"],
  grout: ["grout", "grouting", "non shrink", "nonshrink", "non shrink grout", "epoxy grout"],
  excavation: ["galian", "excavation", "gali", "excavate", "trench", "parit"],
  backfill: ["timbunan", "urugan", "urug", "backfill", "fill", "embankment", "pengurugan", "select fill"],
  compaction: ["pemadatan", "padat", "compaction", "compacted", "proctor", "mdd", "maximum dry density", "kepadatan"],
  formwork: ["bekisting", "formwork", "form", "cetakan"],
  curing: ["perawatan", "curing", "cure"],
  cement: ["semen", "cement", "portland", "opc", "pcc", "type v", "sulfate resistant"],
  aggregate: ["agregat", "aggregate", "kerikil", "pasir", "sand", "gravel", "split", "batu pecah", "crushed stone"],
  water: ["air", "water"],
  wc: ["w c", "water cement", "water cement ratio", "faktor air semen", "fas", "water binder"],
  slump: ["slump", "workability"],
  pile: ["tiang", "pancang", "tiang pancang", "pile", "piling", "spun pile", "bored pile", "tiang bor", "driven pile", "pipe pile", "sheet pile"],
  pdt: ["pda", "loading test", "load test", "uji beban", "static load", "dynamic load", "integrity test", "pit"],
  foundation: ["pondasi", "fondasi", "foundation", "footing", "telapak", "pile cap", "mat", "raft", "pedestal", "plinth", "ringwall"],
  soil: ["tanah", "soil", "geoteknik", "geotechnical", "boring", "sondir", "cpt", "spt", "n spt"],
  bearing: ["daya dukung", "bearing", "bearing capacity", "allowable bearing", "qa", "qall"],
  settlement: ["penurunan", "settlement", "settle", "differential settlement", "penurunan beda"],
  safety: ["faktor keamanan", "safety factor", "factor of safety", "fs", "sf", "keamanan"],
  coating: ["cat", "pengecatan", "painting", "paint", "coating", "pelapis", "lapisan", "primer", "epoxy", "dft", "dry film"],
  galv: ["galvanis", "galvanized", "galvanizing", "galvanised", "hot dip", "hdg", "a123", "a153", "seng", "zinc"],
  weld: ["las", "pengelasan", "weld", "welding", "e70xx", "aws", "d1 1"],
  thickness: ["tebal", "ketebalan", "thickness", "thick", "tebalnya"],
  depth: ["kedalaman", "dalam", "depth", "deep", "embedment", "penanaman"],
  width: ["lebar", "width", "wide"],
  minimum: ["minimum", "min", "minimal", "paling sedikit", "at least", "sekurang kurangnya", "tidak kurang"],
  maximum: ["maksimum", "max", "maximum", "maksimal", "paling banyak", "tidak lebih", "not exceed", "tidak melebihi"],
  wind: ["angin", "wind", "kecepatan angin", "wind speed", "basic wind"],
  seismic: ["gempa", "seismic", "earthquake", "sni 1726", "asce 7", "spektrum", "spectrum"],
  load: ["beban", "load", "loading", "pembebanan", "kombinasi", "combination"],
  elevation: ["elevasi", "elevation", "tinggi", "height", "top of concrete", "toc", "high point", "hpp", "finished grade", "grade level", "permukaan tanah", "above grade"],
  drainage: ["drainase", "drainage", "saluran", "ditch", "culvert", "gorong", "selokan"],
  road: ["jalan", "road", "pavement", "perkerasan", "aspal", "asphalt"],
  fence: ["pagar", "fence", "fencing"],
  slope: ["kemiringan", "slope", "lereng", "gradient", "fall"],
  spacing: ["jarak", "spacing", "spasi", "interval", "clearance", "spaced"],
  joint: ["sambungan", "joint", "construction joint", "expansion joint", "siar", "dilatasi", "waterstop"],
  test: ["uji", "pengujian", "test", "testing", "sampel", "sample", "silinder", "cylinder", "kubus", "cube", "core"],
  days: ["hari", "day", "days", "umur", "age", "28 hari", "28 day"],
  tank: ["tangki", "tank", "api 650", "storage tank"],
  vessel: ["vessel", "bejana", "separator", "scrubber", "drum", "gas boot"],
  pump: ["pompa", "pump", "compressor", "kompresor", "rotating", "dinamis", "machine", "mesin", "vibrating"],
  trafo: ["trafo", "transformer", "transformator"],
  pipe: ["pipa", "pipe", "piping", "pipe support", "sleeper", "pipe rack", "penyangga pipa"],
  building: ["gedung", "bangunan", "building", "shelter", "control room"],
  corrosion: ["korosi", "corrosion", "korosif", "corrosive", "sulfat", "sulfate", "chloride", "klorida", "agresif", "aggressive"],
  vibration: ["getaran", "vibration", "frekuensi", "frequency", "resonansi", "resonance", "amplitude", "amplitudo"],
}
// peta token/frasa → konsep
const PHRASE = new Map()   // "lean concrete" → ["lean"]
const WORD = new Map()     // "beton" → ["concrete"]
for (const [c, forms] of Object.entries(CONCEPTS)) for (const f of forms) {
  const t = tokens(f).join(" ")
  if (!t) continue
  const m = t.includes(" ") ? PHRASE : WORD
  if (!m.has(t)) m.set(t, [])
  if (!m.get(t).includes(c)) m.get(t).push(c)
}
// kata dalam frasa dikenali sebagai bentuk tunggalnya juga (agar "lean" saja tetap mengarah ke lean concrete)
export const conceptsOf = (tok) => WORD.get(tok) || []

// ---------------------------------------------------------------- nilai teknis (angka + satuan, mutu, standar)
const UNIT_RX = String.raw`(MPa|N\/mm2|N\/mm²|psi|ksi|kg\/cm2|kg\/cm²|kgf\/cm2|kN\/m2|kN\/m²|kN\/m3|kN\/m³|kPa|kN|ton\/m2|t\/m2|t\/m²|kg\/m3|kg\/m³|km\/h|m\/s|mm|cm|m2|m²|m3|m³|m|in\.|inch(?:es)?|ft|feet|µm|um|micron|mils?|%|°C|deg\s?C|hari|days?|jam|hours?|minutes?|menit|Hz|rpm)`
const NUM_RX = String.raw`(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to|s\/d|sampai)\s*(\d+(?:[.,]\d+)?))?`
const VAL_RX = new RegExp(NUM_RX + String.raw`\s*` + UNIT_RX + String.raw`(?![A-Za-z0-9²³])`, "gi")
const GRADE_RX = [
  /\bK\s?-\s?(\d{3})\b/g,                                   // K-300
  /\bf['’`]?c['’`]?\s*(?:=|:|of|sebesar)?\s*(\d{2}(?:[.,]\d)?)\s*(?:MPa|N\/mm2)?/gi, // fc' 28 MPa / f'c = 25
  /\bfc\s*(\d{2})\b/gi,
  /\b(BJT[SP])\s?-?\s?(\d{2,3})\b/g,                         // BJTS 420
  /\bASTM\s+([A-F]\s?\d{1,4}(?:\/[A-Z]?\d+[A-Z]?)?)(?:\s*,?\s*(?:Gr\.?|Grade)\s*(\d+[A-Z]?))?/g,
  /\b(?:Gr\.?|Grade)\s*(\d{2,3}[A-Z]?)\b/g,
  /\b(?:Class|Kelas)\s+([A-E]\d?|[IV]{1,3})\b/g,
  /\bType\s+(I{1,3}|IV|V)\b/g,
  /\bSNI\s+\d{2,4}(?:[-:]\d{2,4})*/g, /\bACI\s+\d{3}(?:\.\d+[RM]?)?(?:-\d{2})?/g, /\bAPI\s+(?:RP\s+)?\d{2,4}[A-Z]?/g, /\bAISC\s+\d{3}(?:-\d{2})?/g,
]
const normNum = (s) => Number(String(s).replace(",", "."))
const UNIT_KIND = (u) => {
  const x = u.toLowerCase().replace(/\s/g, "")
  if (/^(mpa|n\/mm2|n\/mm²|psi|ksi|kg\/cm2|kg\/cm²|kgf\/cm2)$/.test(x)) return "stress"
  if (/^(kpa|kn\/m2|kn\/m²|ton\/m2|t\/m2|t\/m²)$/.test(x)) return "pressure"
  if (/^(mm|cm|m|in\.?|inch|inches|ft|feet)$/.test(x)) return "length"
  if (/^(µm|um|micron|mil|mils)$/.test(x)) return "film"
  if (x === "%") return "percent"
  if (/^(hari|day|days|jam|hour|hours|minute|minutes|menit)$/.test(x)) return "time"
  if (/^(kn\/m3|kn\/m³|kg\/m3|kg\/m³)$/.test(x)) return "density"
  if (/^(°c|degc)$/.test(x)) return "temp"
  if (/^(km\/h|m\/s)$/.test(x)) return "speed"
  if (x === "kn") return "force"
  return "other"
}
// ke satuan dasar: tegangan MPa, tekanan kPa, panjang mm, kecepatan m/s
export function toBase(v, unit) {
  const x = unit.toLowerCase().replace(/\s/g, "")
  const f = { psi: 0.00689476, ksi: 6.89476, "kg/cm2": 0.0980665, "kg/cm²": 0.0980665, "kgf/cm2": 0.0980665, "n/mm2": 1, "n/mm²": 1, mpa: 1,
    kpa: 1, "kn/m2": 1, "kn/m²": 1, "ton/m2": 9.80665, "t/m2": 9.80665, "t/m²": 9.80665,
    mm: 1, cm: 10, m: 1000, in: 25.4, "in.": 25.4, inch: 25.4, inches: 25.4, ft: 304.8, feet: 304.8, "km/h": 1 / 3.6, "m/s": 1 }[x]
  return f ? v * f : v
}
// Nilai dari teks: [{ txt, v, v2, unit, kind, at }] dan mutu/standar: [{ txt, kind: "spec", at }]
export function extractValues(text, opts = {}) {
  const s = String(text ?? ""), out = []
  for (const m of s.matchAll(VAL_RX)) {
    const unit = m[3].replace(/\s+/g, "")
    // abaikan nomor pasal/halaman yang kebetulan diikuti "m" dsb.: angka harus berdiri sendiri
    const pre = s[m.index - 1]
    if (pre && /[A-Za-z0-9.]/.test(pre)) continue
    out.push({ txt: m[0].trim(), v: normNum(m[1]), v2: m[2] ? normNum(m[2]) : null, unit, kind: UNIT_KIND(unit), at: m.index })
  }
  for (const rx of GRADE_RX) {
    rx.lastIndex = 0
    for (const m of s.matchAll(rx)) {
      const txt = m[0].trim()
      if (out.some((o) => m.index < o.at + o.txt.length && o.at < m.index + txt.length)) continue
      const o = { txt, kind: "spec", at: m.index }
      if (/^K\s?-/.test(txt)) { o.v = Number(m[1]) * 0.083; o.unit = "MPa"; o.kind = "stress"; o.grade = txt }   // K-300 ≈ 300 kg/cm² kubus ≈ 0,83·300/10 MPa silinder
      else if (/^f/i.test(txt) && m[1] && Number(m[1]) >= 10 && Number(m[1]) <= 100) { o.v = normNum(m[1]); o.unit = "MPa"; o.kind = "stress"; o.grade = txt }
      else if (/^BJT/.test(txt)) { o.v = Number(m[2]); o.unit = "MPa"; o.kind = "stress"; o.grade = txt }
      else { const g = txt.match(/(?:Gr\.?|Grade)\s*(\d{2,3})/i); if (g) { const n = Number(g[1]); o.v = n < 150 ? n * 6.89476 : n; o.unit = "MPa"; o.grade = txt } }   // ASTM Grade 60 = 60 ksi ≈ 414 MPa; Grade 420 (metrik) = 420 MPa
      out.push(o)
    }
  }
  // angka tanpa satuan (FS 3,0 · w/c 0,45 · 10 %…) hanya bila diminta: terlalu ramai untuk sorotan umum
  if (opts.plain) for (const m of s.matchAll(/(^|[\s(=:≥≤<>])(\d{1,3}(?:[.,]\d{1,3})?)(?=[\s),;]|\.(?!\d)|$)/g)) {
    const at = m.index + m[1].length, txt = m[2]
    if (out.some((o) => at < o.at + o.txt.length && o.at < at + txt.length)) continue
    out.push({ txt, v: normNum(txt), v2: null, unit: "", kind: "num", at })
  }
  return out.sort((a, b) => a.at - b.at)
}

// ---------------------------------------------------------------- dokumen → bagian
// Baris judul pasal: "5.2.1 Concrete Strength", "5.2.1. Mutu Beton", "SECTION 3 – MATERIALS", "BAB 4 ...", "APPENDIX A ...", "LAMPIRAN B ..."
const HEAD_NUM = /^\s*((?:\d{1,2}\.){1,5}\d{1,3}\.?|\d{1,2}\.?)\s+([A-Z(][^\n]{1,110})$/
const HEAD_WORD = /^\s*((?:SECTION|BAB|PART|BAGIAN|APPENDIX|LAMPIRAN|ATTACHMENT|ANNEX)\s+[A-Z0-9IVX]{1,4})\.?\s*[-–:.]?\s*([^\n]{0,110})$/i
const TOC_LINE = /(\.{4,}|…{2,}|\s{2,}\.\s?\.\s?\.)\s*\d{1,4}\s*$/
const UNIT_START = /^(MPa|mm|cm|m|m2|m3|kN|kPa|psi|ksi|kg|ton|t|%|days?|hari|hours?|jam|in|inch|ft|N\/mm)\b/i
export function isHeading(line) {
  const l = line.trim()
  if (l.length < 3 || l.length > 130 || TOC_LINE.test(l)) return null
  let m = l.match(HEAD_WORD)
  if (m) return { no: m[1].replace(/\s+/g, " ").toUpperCase(), title: m[2].trim() }
  m = l.match(HEAD_NUM)
  if (!m) return null
  const title = m[2].trim(), no = m[1].replace(/\.$/, ""), nw = title.split(/\s+/).length
  if (UNIT_START.test(title) || /^[\d\s.,%-]+$/.test(title)) return null                 // "2.5 MPa minimum" bukan judul
  if (Number(no.split(".")[0]) > 40 || nw > 14 || /[;,:]$/.test(title)) return null
  const letters = title.replace(/[^A-Za-z]/g, ""), upper = letters.replace(/[^A-Z]/g, "").length / Math.max(1, letters.length)
  const caps = title.split(/\s+/).filter((w) => /^[A-Za-z]{4,}/.test(w)), capR = caps.length ? caps.filter((w) => /^[A-Z]/.test(w)).length / caps.length : 1
  const sentence = /[.]$/.test(title) || /\b(shall|harus|must|should|wajib|will|is|are|adalah)\b/i.test(title)
  if (!no.includes(".")) {
    // nomor satu tingkat ("1. The contractor shall …") sering berupa butir daftar: wajib huruf besar / judul pendek bergaya judul
    if (sentence || !(upper > 0.6 || (nw <= 6 && capR >= 0.99))) return null
  } else if (sentence && nw > 6) return null
  return { no, title }
}
// baris yang berulang di banyak halaman (kepala/kaki halaman, "Page 3 of 20", "CONFIDENTIAL") dibuang
export function stripRepeating(pages) {
  if (pages.length < 3) return pages.map((p) => p.filter((l) => !/^\s*(page|halaman|hal\.?)\s*\d+(\s*(of|dari)\s*\d+)?\s*$/i.test(l)))
  const key = (l) => fold(l).replace(/\d+/g, "#").replace(/\s+/g, " ").trim()
  const cnt = new Map()
  for (const p of pages) {
    const seen = new Set()
    for (const l of [...p.slice(0, 6), ...p.slice(-6)]) { const k = key(l); if (k && !seen.has(k)) { seen.add(k); cnt.set(k, (cnt.get(k) || 0) + 1) } }
  }
  const lim = Math.max(3, Math.ceil(pages.length * 0.5))
  return pages.map((p) => p.filter((l, i) => {
    if (/^\s*(page|halaman|hal\.?)\s*\d+(\s*(of|dari)\s*\d+)?\s*$/i.test(l)) return false
    if (/^\s*\d{1,4}\s*$/.test(l) && (i < 3 || i >= p.length - 3)) return false
    if (i >= 6 && i < p.length - 6) return true
    return (cnt.get(key(l)) || 0) < lim
  }))
}
// teks klasifikasi / penafian / tabel pengesahan / nama perusahaan di sampul & kop halaman — bukan judul dokumen
// (mis. "Intended for internal use PHR or other area as per guidance or permit", "CONFIDENTIAL", "PT PERTAMINA HULU ROKAN", "Prepared by")
const CO = new Set(["pt", "pertamina", "hulu", "rokan", "chevron", "pacific", "indonesia", "persero", "tbk", "regional", "ep", "phr", "cpi", "zona", "zone", "energi", "energy", "company", "limited", "ltd", "inc"])
export function isBoilerplate(l) {
  const t = String(l ?? "").trim()
  if (!t) return true
  if (/\b(intended for|internal use|for internal|confidential|proprietary|rahasia|terbatas|uncontrolled|controlled copy|printed cop|copyright|all rights reserved|hak cipta|property of|do not (copy|distribute)|as per guidance|for information only|disclaimer)\b/i.test(t)) return true
  if (/^(prepared|checked|reviewed|approved|endorsed|disetujui|diperiksa|dibuat|date|tanggal|signature|tanda tangan|name|nama|position|jabatan|issued for|revision (history|log|record|status)|record of revision|riwayat revisi|description|keterangan|table of contents|contents|daftar isi)\b/i.test(t)) return true
  const ws = fold(t).split(/[^a-z0-9]+/).filter(Boolean)
  return ws.length > 0 && ws.every((w) => CO.has(w) || w.length < 2)
}
// ---------------------------------------------------------------- jenis dokumen (Specification, Procedure, …)
// Pembagian pustaka RTS. Tambah jenis baru cukup menambah satu baris di CATS (id, label, kode pada nomor dokumen, kata pada judul/nama berkas);
// dokumen yang tidak cocok masuk "Lainnya" (CAT_OTHER) dan jenisnya bisa diatur manual di Pustaka.
export const CAT_OTHER = "other"
export const CATS = [
  { id: "spec", lab: ["Specification", "Specification"], sub: ["Spesifikasi teknis", "Technical specifications"], codes: ["sp", "spc", "spec", "specification", "spesifikasi"], words: /\b(specifications?|spec|spesifikasi)\b/ },
  { id: "proc", lab: ["Procedure", "Procedure"], sub: ["Prosedur kerja", "Work procedures"], codes: ["prc", "proc", "prd", "procedure", "prosedur"], words: /\b(procedures?|procs?|prosedur)\b/ },
]
export const catLab = (id) => (id === CAT_OTHER ? ["Lainnya", "Other"] : (CATS.find((c) => c.id === id) || { lab: ["Lainnya", "Other"] }).lab)
// jenis dari nomor dokumen (kode pada bagian bernomor, mis. PHR-CIV-PRC-104841 → PRC = Procedure, PHR-SP-CI-GG-002 → SP = Specification),
// lalu dari judul, lalu dari nama berkas; tidak cocok → "other"
export function detectCategory(docNo, title, fileName) {
  const toks = fold(docNo).split(/[^a-z0-9]+/).filter(Boolean)
  const byCode = CATS.map((c) => ({ id: c.id, at: toks.findIndex((t) => c.codes.includes(t)) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at)[0]
  if (byCode) return byCode.id
  for (const src of [title, String(fileName ?? "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")]) {
    const t = fold(src)
    const hit = CATS.map((c) => ({ id: c.id, at: t.search(c.words) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at)[0]
    if (hit) return hit.id
  }
  return CAT_OTHER
}
// Nomor dokumen: cari pola "RTS-…" dulu, lalu kode umum "ABC-DEF-123" di halaman awal; jika tidak ada pakai nama berkas
export function detectDocMeta(pages, fileName = "") {
  const head = pages.slice(0, 2).flat().slice(0, 80).join("\n")
  const base = String(fileName).replace(/\.[^.]+$/, "")
  const rts = head.match(/\bRTS[\s_-]*[A-Z0-9]{1,8}(?:[\s_-]+[A-Z0-9]{1,8}){0,4}\b/) || base.match(/RTS[\s_-]*[A-Z0-9]{1,8}(?:[\s_-]+[A-Z0-9]{1,8}){0,4}/i)
  const gen = head.match(/\b[A-Z]{2,6}(?:-[A-Z0-9]{1,8}){2,5}\b/)
  const docNo = (rts ? rts[0] : gen ? gen[0] : base).replace(/_/g, "-").replace(/\s+/g, " ").trim()
  const rev = (head.match(/\bRev(?:isi|ision)?\.?\s*[:#]?\s*([0-9A-Z]{1,3})\b/i) || [])[1] || ""
  // judul: baris huruf besar / Huruf Judul di 25 baris pertama yang bukan nomor dokumen, bukan kalimat, dan bukan teks klasifikasi/kop perusahaan
  // segmen baris (kolom kepala halaman dipisah ≥ 3 spasi) dari halaman pertama + kepala halaman kedua
  const segs = (p, n) => (p || []).slice(0, n).flatMap((l) => l.replace(/^\u00A7\u00A7[^\t]*\t/, "").split(/ {3,}|\t| \| /)).map((l) => l.trim())
  const p2 = new Set(segs(pages[1], 6).map((l) => fold(l)))
  const s1 = segs(pages[0], 25)
  const bonus = new Map()
  const LAB = /^(?:document\s+)?(?:title|judul)(?:\s+dokumen)?\s*[:：]?\s*/i
  s1.forEach((l, i) => {
    const m = l.match(LAB)
    if (!m) return
    const rest = l.slice(m[0].length).trim()
    if (rest.length >= 6) bonus.set(rest, 100)                               // "Title: Foundation Design Criteria"
    else if (s1[i + 1]) bonus.set(s1[i + 1], 60)                              // "TITLE" lalu judul di baris berikutnya
  })
  const ok = (l) => l.length >= 8 && l.length <= 120 && !/^(rev|page|halaman|date|tanggal|doc|no\.?|document)\b/i.test(l) && !l.includes(docNo) && /[A-Za-z]{4}/.test(l) && !isBoilerplate(l)
  const cand = [...s1, ...bonus.keys()].filter(ok)
  // sisa nama berkas setelah nomor dokumen ("PHR-CIV-PRC-104841 Foundation Design.pdf" → "Foundation Design")
  const fromFile = base.replace(docNo.replace(/ /g, "[-_ ]"), "").replace(/[_]+/g, " ").replace(/^[\s\-–·.]+|[\s\-–·.]+$/g, "").trim()
  if (fromFile.split(/\s+/).filter((w) => /[A-Za-z]{3}/.test(w)).length >= 2 && ok(fromFile)) { cand.push(fromFile); bonus.set(fromFile, (bonus.get(fromFile) || 0) + 20) }
  const score = (l) => {
    const lt = l.replace(/[^A-Za-z]/g, ""), up = lt.replace(/[^A-Z]/g, "").length / Math.max(1, lt.length)
    const ws = l.split(/\s+/).filter((w) => /^[A-Za-z]{4,}/.test(w)), capR = ws.length >= 2 ? ws.filter((w) => /^[A-Z]/.test(w)).length / ws.length : 0
    return up * 80 + capR * 30 + Math.min(l.length, 60) * 0.5 + (p2.has(fold(l)) ? 12 : 0) + (bonus.get(l) || 0) - (/[.;:]$/.test(l) ? 30 : 0) - (/\b(shall|harus|must|should)\b/i.test(l) ? 30 : 0) - (/\d{3,}/.test(l) ? 15 : 0) - (/^\d/.test(l) ? 25 : 0)
  }
  const title = cand.sort((a, b) => score(b) - score(a))[0] || base
  return { docNo, rev, title, cat: detectCategory(docNo, title, fileName) }
}
// baris PDF yang terpotong di tengah kalimat disambung lagi; butir daftar, baris tabel & baris kosong tetap baris baru
const LIST_START = /^(\(?[a-z]\)|\(?[ivx]{1,4}\)|\d{1,2}[.)]|[-•●▪◦–*])\s/i
export function reflow(lines) {
  const out = []
  for (const l of lines) {
    const prev = out[out.length - 1]
    if (prev != null && prev !== "" && l !== "" && !/[.:;!?]$/.test(prev) && !LIST_START.test(l) && !/ {3}| \| /.test(l) && !/ {3}| \| /.test(prev)) out[out.length - 1] = prev + " " + l
    else out.push(l)
  }
  return out.join("\n")
}
// pages: [[baris…], …] (halaman 1-based saat disimpan) → bagian { no, title, page, text }
export function splitSections(pages) {
  const clean = stripRepeating(pages)
  const secs = []
  let cur = { no: "", title: "", page: 1, lines: [] }
  const push = () => { const text = reflow(cur.lines).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); if (text || cur.title) secs.push({ no: cur.no, title: cur.title, page: cur.page, text }) }
  clean.forEach((lines, pi) => {
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "")
      if (!line.trim()) { cur.lines.push(""); continue }
      const fm = line.match(/^\u00A7\u00A7([^\t]*)\t(.*)$/)            // judul pasti (gaya Heading DOCX)
      const h = fm ? { no: fm[1], title: fm[2].trim() } : isHeading(line)
      if (h) { push(); cur = { no: h.no, title: h.title, page: pi + 1, lines: [] } } else cur.lines.push(line.trim())
    }
  })
  push()
  // gabungkan bagian kosong (judul berurutan, mis. "5 MATERIALS" lalu "5.1 Concrete") ke bagian berikutnya sebagai induk
  const out = []
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i]
    if (!s.text && secs[i + 1]) { secs[i + 1].parent = [s.no, s.title].filter(Boolean).join(" "); continue }
    // bagian sangat panjang dipecah per ±1800 karakter agar cuplikan & skor tetap tajam
    if (s.text.length > 2400) {
      const paras = s.text.split(/\n(?=\S)/)
      let buf = "", part = 1
      for (const p of paras) {
        if (buf && buf.length + p.length > 1800) { out.push({ ...s, text: buf.trim(), part: part++ }); buf = "" }
        buf += p + "\n"
      }
      if (buf.trim()) out.push({ ...s, text: buf.trim(), part: part > 1 ? part : undefined })
    } else out.push(s)
  }
  return out
}
// teks polos (TXT/MD/DOCX) → halaman tunggal atau dipecah pada form feed
export const textToPages = (txt) => String(txt ?? "").replace(/\r\n?/g, "\n").split("\f").map((p) => p.split("\n"))

// baris dari item teks PDF (pdf.js getTextContent): kelompokkan per y, urutkan per x
export function pdfItemsToLines(items) {
  const rows = []
  for (const it of items) {
    if (!it || typeof it.str !== "string") continue
    const y = it.transform ? it.transform[5] : 0, x = it.transform ? it.transform[4] : 0, h = Math.abs(it.height || (it.transform ? it.transform[3] : 10)) || 10
    if (!it.str.trim() && !it.hasEOL) continue
    let r = rows.find((q) => Math.abs(q.y - y) <= Math.max(2, h * 0.45))
    if (!r) { r = { y, h, parts: [] }; rows.push(r) }
    r.parts.push({ x, w: it.width || it.str.length * h * 0.5, s: it.str, h })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x)
    let line = "", end = null
    for (const p of r.parts) {
      if (end != null) { const gap = p.x - end; if (gap > p.h * 1.5) line += "   "; else if (gap > p.h * 0.15 && !line.endsWith(" ") && !p.s.startsWith(" ")) line += " " }
      line += p.s; end = p.x + p.w
    }
    return line.replace(/\s+$/, "")
  }).filter((l) => l.trim())
}

// ---------------------------------------------------------------- indeks & pencarian (BM25)
const K1 = 1.2, B = 0.72
// dokumen: [{ id, docNo, title, rev, secs: [{ no, title, page, text, parent }] }]
export function buildIndex(docs) {
  const items = [], df = new Map()
  let totLen = 0
  for (const d of docs) (d.secs || []).forEach((s, si) => {
    const head = `${s.no} ${s.title} ${s.parent || ""}`
    const body = tokens(s.text)
    const ht = tokens(head)
    const tf = new Map()
    for (const t of body) tf.set(t, (tf.get(t) || 0) + 1)
    for (const t of ht) tf.set(t, (tf.get(t) || 0) + 3)        // judul pasal berbobot 3
    for (const t of tokens(d.title + " " + d.docNo)) tf.set(t, (tf.get(t) || 0) + 0.5)
    // frasa (bigram) untuk mencocokkan konsep berbentuk frasa
    const all = [...ht, ...body]
    for (let i = 0; i + 1 < all.length; i++) { const bg = all[i] + " " + all[i + 1]; if (PHRASE.has(bg)) tf.set("§" + bg, (tf.get("§" + bg) || 0) + 1) }
    for (let i = 0; i + 2 < all.length; i++) { const tg = all[i] + " " + all[i + 1] + " " + all[i + 2]; if (PHRASE.has(tg)) tf.set("§" + tg, (tf.get("§" + tg) || 0) + 1) }
    const len = body.length + ht.length * 3
    totLen += len
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1)
    items.push({ doc: d, sec: s, si, tf, len })
  })
  return { items, df, N: items.length, avg: items.length ? totLen / items.length : 1 }
}
const idf = (ix, t) => { const n = ix.df.get(t) || 0; return Math.log(1 + (ix.N - n + 0.5) / (n + 0.5)) }
const bm = (ix, it, t) => { const f = it.tf.get(t) || 0; if (!f) return 0; return idf(ix, t) * (f * (K1 + 1)) / (f + K1 * (1 - B + B * it.len / ix.avg)) }

// kueri → kelompok istilah: tiap kata/frasa pengguna menjadi satu kelompok berisi dirinya (bobot 1) + bentuk sinonim (bobot 0,7)
export function parseQuery(q) {
  const tk = tokens(q), groups = [], used = new Set()
  // frasa dulu (3 lalu 2 kata)
  for (const n of [3, 2]) for (let i = 0; i + n <= tk.length; i++) {
    if ([...Array(n).keys()].some((k) => used.has(i + k))) continue
    const ph = tk.slice(i, i + n).join(" ")
    if (PHRASE.has(ph)) { groups.push(group(ph, PHRASE.get(ph))); for (let k = 0; k < n; k++) used.add(i + k) }
  }
  tk.forEach((t, i) => { if (!used.has(i)) groups.push(group(t, WORD.get(t) || [])) })
  // gabungkan kelompok dengan konsep yang sama ("beton concrete")
  const out = []
  for (const g of groups) { const same = g.concepts.length && out.find((o) => o.concepts.some((c) => g.concepts.includes(c))); if (same) { for (const [k, w] of g.terms) if (!same.terms.has(k)) same.terms.set(k, w) } else out.push(g) }
  return out
  function group(t, concepts) {
    const terms = new Map([[t.includes(" ") ? "§" + t : t, 1]])
    if (/^\d/.test(t)) return { raw: t, concepts: [], terms, num: true }
    for (const c of concepts) for (const f of CONCEPTS[c]) {
      const ft = tokens(f).join(" ")
      if (!ft) continue
      const key = ft.includes(" ") ? "§" + ft : ft
      if (!terms.has(key)) terms.set(key, 0.7)
    }
    return { raw: t, concepts, terms }
  }
}
// opsi: { docId, limit, kinds: ["stress", …] (nilai yang dicari), boost: { termKey: w } }
export function search(ix, q, opts = {}) {
  const groups = parseQuery(q)
  if (!groups.length) return []
  const res = []
  for (const it of ix.items) {
    if (opts.docId && it.doc.id !== opts.docId) continue
    let s = 0, hit = 0
    for (const g of groups) {
      let best = 0
      for (const [t, w] of g.terms) { const v = bm(ix, it, t) * w; if (v > best) best = v }
      if (best > 0) { s += best; hit++ }
    }
    if (!hit) continue
    // utamakan bagian yang memuat semua kelompok kueri
    s *= Math.pow(hit / groups.length, 1.6)
    let vals = null
    if (opts.kinds && opts.kinds.length) {
      const plain = opts.kinds.includes("num"), ck = plain ? "valsP" : "vals"
      if (!it[ck]) it[ck] = extractValues(it.sec.text, { plain })
      vals = it[ck].filter((v) => opts.kinds.includes(v.kind))
      if (vals.length) s *= 1.25; else s *= 0.8
    }
    res.push({ it, score: s, hit, of: groups.length, vals })
  }
  res.sort((a, b) => b.score - a.score)
  const lim = opts.limit ?? 30
  return res.slice(0, lim).map((r) => {
    const sn = snippet(r.it.sec.text, groups, opts.kinds)
    return { doc: r.it.doc, sec: r.it.sec, si: r.it.si, score: r.score, hit: r.hit, of: r.of, snippet: sn.text, pre: sn.pre, post: sn.post, marks: sn.marks, vmarks: sn.vmarks, best: sn.best, values: sn.values, groups }
  })
}
// cocokkan kata pada teks asli: rentang [awal, akhir, kunci] untuk sorotan (kunci = token atau "§frasa")
export function termSpans(text, groups) {
  const keys = new Set()
  for (const g of groups) for (const k of g.terms.keys()) keys.add(k)
  const spans = [], rx = /[A-Za-z\u00C0-\u024F]+\d*[A-Za-z]*|\d+(?:[.,]\d+)?/g
  const toks = []
  let m
  const s = String(text)
  while ((m = rx.exec(s))) { const w = fold(m[0]).replace(",", "."); toks.push({ a: m.index, b: m.index + m[0].length, t: STOP.has(w) ? "" : stem(w) }) }
  // frasa dicocokkan tanpa kata umum ("factor of safety" = "factor safety"), sama seperti indeks
  const ns = toks.filter((x) => x.t)
  for (let i = 0; i < ns.length; i++) {
    for (const n of [3, 2]) {
      if (i + n > ns.length) continue
      const k = "§" + ns.slice(i, i + n).map((x) => x.t).join(" ")
      if (keys.has(k)) { spans.push([ns[i].a, ns[i + n - 1].b, k]); break }
    }
    if (keys.has(ns[i].t)) spans.push([ns[i].a, ns[i].b, ns[i].t])
  }
  return spans.sort((a, b) => a[0] - b[0] || b[1] - a[1])
}
const mergeSpans = (spans) => { const out = []; for (const sp of spans) { const l = out[out.length - 1]; if (l && sp[0] <= l[1]) l[1] = Math.max(l[1], sp[1]); else out.push([sp[0], sp[1]]) } return out }
// cuplikan: kalimat terbaik (paling banyak kelompok kueri + nilai yang dicari) dengan konteks
export function snippet(text, groups, kinds, max = 300) {
  const s = String(text ?? "")
  const sents = []
  const rx = /(?:[^.!?\n]|\.(?=\d))+(?:[.!?](?!\d)|\n|$)/g          // titik desimal (3.0) bukan akhir kalimat
  let m
  while ((m = rx.exec(s))) { if (m[0].trim()) sents.push({ a: m.index, b: m.index + m[0].length }); if (rx.lastIndex === m.index) rx.lastIndex++ }
  const spans = termSpans(s, groups)
  const vals = extractValues(s, { plain: !!(kinds && kinds.includes("num")) })
  let best = null
  for (const se of sents) {
    const sp = spans.filter((x) => x[0] >= se.a && x[1] <= se.b)
    const ks = new Set(sp.map((x) => x[2]))
    const cover = groups.filter((g) => [...g.terms.keys()].some((k) => ks.has(k))).length
    const vv = vals.filter((v) => v.at >= se.a && v.at < se.b && (!kinds || !kinds.length || kinds.includes(v.kind)))
    const sc = cover * 3 + Math.min(sp.length, 6) * 0.4 + (vv.length ? 2.5 : 0) - (se.b - se.a > 400 ? 1 : 0)
    if (!best || sc > best.sc) best = { ...se, sc, vals: vv }
  }
  if (!best) best = { a: 0, b: Math.min(s.length, max), vals: [] }
  let a = best.a, b = best.b
  if (b - a > max) { const v0 = best.vals[0]; if (v0 && v0.at > a + max * 0.6) a = Math.max(a, v0.at - Math.round(max * 0.5)); b = Math.min(best.b, a + max) }
  while (b - a < max * 0.7 && (a > 0 || b < s.length)) { if (a > 0) a = Math.max(0, a - 40); if (b < s.length) b = Math.min(s.length, b + 60) }
  if (a > 0) { const sp = s.lastIndexOf(" ", a); if (sp >= 0 && sp > a - 20) a = sp + 1 }
  if (b < s.length) { const sp = s.indexOf(" ", b); if (sp >= 0 && sp < b + 20) b = sp }
  const raw = s.slice(a, b)
  const marks = mergeSpans(spans.filter((x) => x[0] >= a && x[1] <= b)).map(([x, y]) => [x - a, y - a])
  const vmarks = vals.filter((v) => v.at >= a && v.at + v.txt.length <= b).map((v) => ({ ...v, at: v.at - a }))
  return { text: raw, pre: a > 0, post: b < s.length, marks, vmarks, best: s.slice(best.a, best.b).replace(/\s+/g, " ").trim(), values: best.vals }
}

// ---------------------------------------------------------------- parameter kunci desain sipil (pertanyaan siap pakai)
// kinds: jenis nilai yang dicari; cmp: pembanding ke masukan Desain ("min" = masukan ≥ RTS, "max" = masukan ≤ RTS, "spec" = teks)
export const PARAMS = [
  { id: "fc", grp: "concrete", q: "concrete compressive strength fc 28 days structural mutu beton", kinds: ["stress"], unit: "MPa", cmp: "min", lab: ["Mutu beton struktural fc'", "Structural concrete strength fc'"] },
  { id: "lean", grp: "concrete", q: "lean concrete blinding lantai kerja thickness strength", kinds: ["stress", "length"], unit: "mm", cmp: "info", lab: ["Lantai kerja / lean concrete", "Lean concrete / blinding"] },
  { id: "cover", grp: "concrete", q: "concrete cover selimut beton reinforcement minimum", kinds: ["length"], unit: "mm", cmp: "min", lab: ["Selimut beton", "Concrete cover"] },
  { id: "fy", grp: "concrete", q: "reinforcing steel bar grade yield strength tulangan fy", kinds: ["stress", "spec"], unit: "MPa", cmp: "min", lab: ["Mutu tulangan fy", "Reinforcement grade fy"] },
  { id: "cement", grp: "concrete", q: "cement type portland sulfate semen", kinds: ["spec"], cmp: "info", lab: ["Jenis semen", "Cement type"] },
  { id: "wc", grp: "concrete", q: "water cement ratio maximum faktor air semen", kinds: ["num"], cmp: "info", lab: ["Faktor air-semen maks.", "Max. water–cement ratio"] },
  { id: "agg", grp: "concrete", q: "maximum aggregate size agregat maksimum", kinds: ["length"], unit: "mm", cmp: "info", lab: ["Ukuran agregat maks.", "Max. aggregate size"] },
  { id: "slump", grp: "concrete", q: "slump concrete", kinds: ["length"], unit: "mm", cmp: "info", lab: ["Slump", "Slump"] },
  { id: "curing", grp: "concrete", q: "curing concrete days perawatan beton", kinds: ["time"], cmp: "info", lab: ["Perawatan (curing)", "Curing"] },
  { id: "grout", grp: "equip", q: "non shrink grout compressive strength thickness", kinds: ["stress", "length"], unit: "MPa", cmp: "info", lab: ["Grout non-susut", "Non-shrink grout"] },
  { id: "bolt", grp: "equip", q: "anchor bolt material ASTM F1554 grade baut angkur", kinds: ["spec", "stress"], cmp: "spec", lab: ["Baut angkur", "Anchor bolts"] },
  { id: "toc", grp: "equip", q: "top of concrete foundation above grade elevation pedestal", kinds: ["length"], unit: "mm", cmp: "info", lab: ["Elevasi atas pondasi di atas tanah", "Top of concrete above grade"] },
  { id: "steel", grp: "steel", q: "structural steel material ASTM A36 A992 grade baja struktur", kinds: ["spec", "stress"], cmp: "info", lab: ["Mutu baja struktur", "Structural steel grade"] },
  { id: "galv", grp: "steel", q: "hot dip galvanizing thickness coating galvanis", kinds: ["film", "spec"], cmp: "info", lab: ["Galvanis", "Galvanizing"] },
  { id: "paint", grp: "steel", q: "painting coating system dry film thickness cat", kinds: ["film"], cmp: "info", lab: ["Sistem cat (DFT)", "Paint system (DFT)"] },
  { id: "pile", grp: "found", q: "pile steel pipe grade wall thickness tiang pancang", kinds: ["spec", "length", "stress"], cmp: "info", lab: ["Tiang pancang", "Piles"] },
  { id: "piletest", grp: "found", q: "pile load test PDA loading test number percentage", kinds: ["percent", "num"], cmp: "info", lab: ["Uji tiang (PDA / loading test)", "Pile testing (PDA / load test)"] },
  { id: "fs", grp: "found", q: "factor of safety bearing capacity foundation faktor keamanan", kinds: ["num"], cmp: "min", lab: ["Faktor keamanan daya dukung", "Bearing capacity safety factor"] },
  { id: "settle", grp: "found", q: "allowable settlement foundation total differential penurunan izin", kinds: ["length"], unit: "mm", cmp: "max", lab: ["Penurunan izin", "Allowable settlement"] },
  { id: "depth", grp: "found", q: "minimum foundation depth below grade kedalaman pondasi", kinds: ["length"], unit: "mm", cmp: "info", lab: ["Kedalaman pondasi min.", "Min. foundation depth"] },
  { id: "compact", grp: "earth", q: "compaction percent maximum dry density proctor backfill pemadatan", kinds: ["percent"], unit: "%", cmp: "info", lab: ["Pemadatan timbunan", "Backfill compaction"] },
  { id: "wind", grp: "load", q: "basic wind speed design kecepatan angin", kinds: ["speed"], unit: "m/s", cmp: "min", lab: ["Kecepatan angin desain", "Design wind speed"] },
  { id: "seis", grp: "load", q: "seismic design SNI 1726 importance factor risk category gempa", kinds: ["spec", "num"], cmp: "info", lab: ["Gempa (kode & kategori)", "Seismic (code & category)"] },
]
export const PARAM_GROUPS = { concrete: ["Beton & tulangan", "Concrete & rebar"], equip: ["Pondasi peralatan", "Equipment foundations"], steel: ["Baja & pelapis", "Steel & coating"], found: ["Pondasi & tiang", "Foundations & piles"], earth: ["Tanah & galian", "Earthworks"], load: ["Beban", "Loads"] }

// kandidat nilai untuk satu parameter: hasil teratas yang memuat nilai berjenis cocok
export function findParam(ix, p, limit = 5) {
  const rs = search(ix, p.q, { kinds: p.kinds, limit: 40 })
  const out = []
  for (const r of rs) {
    const vals = extractValues(r.best || r.snippet, { plain: p.kinds.includes("num") }).filter((v) => p.kinds.includes(v.kind))
    if (!vals.length) continue
    out.push({ ...r, vals })
    if (out.length >= limit) break
  }
  return out
}
// nilai tersemat → angka dalam satuan parameter (MPa, mm, m/s, %, tanpa satuan)
export function pinNumber(pin, p) {
  if (!pin) return null
  if (typeof pin.num === "number" && isFinite(pin.num)) return pin.num
  const v = extractValues(pin.txt || "")[0]
  if (!v || v.v == null) { const n = parseFloat(String(pin.txt || "").replace(",", ".")); return isFinite(n) ? n : null }
  if (p.unit === "MPa" && v.kind === "stress") return toBase(v.v, v.unit)
  if (p.unit === "mm" && v.kind === "length") return toBase(v.v, v.unit)
  if (p.unit === "m/s" && v.kind === "speed") return toBase(v.v, v.unit)
  return v.v
}
// cek masukan Desain terhadap nilai RTS: [{ param, where, val, rts, ok }]
export function complianceRows(pins, sources) {
  const rows = []
  for (const p of PARAMS) {
    const pin = pins[p.id]
    if (!pin || p.cmp === "info") continue
    const lim = pinNumber(pin, p)
    for (const s of sources.filter((x) => x.param === p.id)) {
      if (p.cmp === "spec") { const ok = s.val == null ? null : fold(pin.txt).replace(/\W/g, "").includes(fold(s.val).replace(/\W/g, "").slice(0, 6)); rows.push({ p, s, lim: pin.txt, ok }); continue }
      if (lim == null || s.val == null || !isFinite(s.val)) { rows.push({ p, s, lim, ok: null }); continue }
      const ok = p.cmp === "min" ? s.val >= lim - 1e-9 : s.val <= lim + 1e-9
      rows.push({ p, s, lim, ok })
    }
  }
  return rows
}
