// Data tanah proyek → parameter desain (korelasi N-SPT / CPT), daya dukung pondasi dangkal (N-SPT, CPT, Vesic/Skempton), kapasitas aksial tiang
// (α/β API RP 2GEO & FHWA, N-SPT Meyerhof, CPT LCPC), kelas situs SNI 1726:2019, serta penurunan pondasi dangkal dan kelompok tiang
// (memakai mesin js/penurunan.js). Fungsi murni. Satuan: kN, m, kPa; qc dalam MPa, fs (sleeve) dalam kPa, E internal dalam kPa (masukan E dalam MPa).
// Kedalaman z diukur dari muka tanah asli.
import { L, GAMMA_W, GAMMA_C, GAMMA_S, rad, clamp } from "./core.js"
import { apiSand, alphaClay } from "./pile.js"
import { analyze, overburden } from "../penurunan.js"

export const TYPES = { clay: ["Lempung", "Clay"], silt: ["Lanau", "Silt"], sand: ["Pasir", "Sand"], gravel: ["Kerikil", "Gravel"] }
export const typeName = (t) => L(...(TYPES[t] || TYPES.clay))
export const cohesive = (t) => t === "clay" || t === "silt"
const QC_N = { clay: 0.2, silt: 0.3, sand: 0.5, gravel: 0.8 }          // qc/N60 (MPa per pukulan), Robertson & Campanella (tipikal)
export const OVR = ["cu", "phi", "E", "nu", "e0", "Cc", "Cs", "OCR", "cv", "Ca"]

export function defaultSoil() {
  const ly = (h, type, g, gsat, N, qc, fs) => ({ h, type, g, gsat, N, qc, fs, ...Object.fromEntries(OVR.map((k) => [k, 0])) })
  return { name: "BH-01", test: "spt", gwt: 1.5, Er: 60, Nkt: 15, Gs: 2.7,
    layers: [ly(3, "clay", 17, 17.8, 10, 0.95, 35), ly(6, "sand", 18, 19.5, 18, 9, 70), ly(8, "clay", 17.5, 18.3, 15, 1.6, 60), ly(8, "sand", 19, 20.2, 35, 17.5, 140), ly(10, "clay", 18.5, 19.5, 40, 4.2, 180)] }
}

// ---------------------------------------------------------------- parameter turunan tiap lapis / baris
// Data bisa berupa lapis tebal atau baris per interval (mis. 0,5 m sampai 30 m; maks. MAX_ROWS baris). Sel kosong (null):
// - N-SPT (uji SPT) / qc (uji CPT) kosong → diinterpolasi linier terhadap kedalaman dari baris berdata terdekat (diutamakan
//   dalam lapis sejenis yang sama); di luar data → nilai terdekat. Ditandai est.N / est.qc. N = 0 tetap dianggap data (WOH).
// - γ / γsat kosong → sama dengan baris di atas bila jenisnya sama, selain itu nilai tipikal jenis tanah (TYPE_G). Ditandai est.g.
export const MAX_ROWS = 250
export const TYPE_G = { clay: [17, 18], silt: [17.5, 18.5], sand: [18, 20], gravel: [19, 21] }
const has = (v) => v != null && v !== "" && isFinite(v)
const pos = (v) => has(v) && v > 0
// interpolasi kolom: ok(r) = baris berdata, val(r) = nilainya; diutamakan tetangga berdata di strata (jenis sama, bersambung) yang sama
function interpCol(rows, ok, val) {
  const all = rows.map((r, i) => (ok(r) ? i : -1)).filter((i) => i >= 0)
  return rows.map((r, i) => {
    if (ok(r)) return [val(r), false]
    if (!all.length) return [0, false]
    const same = all.filter((j) => rows[j].grp === r.grp), idx = same.length ? same : all
    let a = -1, b = -1
    for (const j of idx) { if (j < i) a = j; else { b = j; break } }
    if (a < 0) return [val(rows[b]), true]
    if (b < 0) return [val(rows[a]), true]
    const ra = rows[a], rb = rows[b], t = (r.zm - ra.zm) / Math.max(rb.zm - ra.zm, 1e-9)
    return [val(ra) + t * (val(rb) - val(ra)), true]
  })
}
// Indeks perilaku tanah CPT (Robertson & Wride 1998; Robertson 2009), n = 1: Qt = (qt − σv)/σ'v, Fr = fs/(qt − σv)·100 %,
// Ic = √((3,47 − log Qt)² + (log Fr + 1,22)²). Ic < 1,31 kerikil; < 2,60 pasir (campuran); < 2,95 lanau (campuran); ≥ 2,95 lempung.
export function cptIc(qcMPa, fsKPa, sv, svp) {
  if (!(qcMPa > 0) || !(fsKPa > 0)) return null
  const net = qcMPa * 1000 - sv
  if (net <= 0) return null
  const Qt = net / Math.max(svp, 1), Fr = fsKPa / net * 100
  const Ic = Math.sqrt((3.47 - Math.log10(Math.max(Qt, 1e-3))) ** 2 + (Math.log10(Fr) + 1.22) ** 2)
  return { Ic, Qt, Fr, type: Ic < 1.31 ? "gravel" : Ic < 2.6 ? "sand" : Ic < 2.95 ? "silt" : "clay" }
}
export function deriveSoil(soil) {
  const out = [], gwt = soil.gwt ?? 99, cpt = soil.test === "cpt", Er = soil.Er ?? 60
  // geometri, strata (jenis sama bersambung), γ terisi
  let z = 0, gi = -1, prev = null
  const rows = soil.layers.map((ly) => {
    const h = Math.max(+ly.h || 0, 0.01), r = { ly, h, z0: z, z1: z + h, zm: z + h / 2 }
    if (!prev || prev.ly.type !== ly.type) gi++
    r.grp = gi
    const t = TYPE_G[ly.type] || TYPE_G.clay, inh = prev && prev.ly.type === ly.type
    r.g = pos(ly.g) ? +ly.g : inh ? prev.g : t[0]
    r.gsat = pos(ly.gsat) ? +ly.gsat : inh ? prev.gsat : t[1]
    r.gEst = !pos(ly.g) || !pos(ly.gsat)
    z = r.z1; prev = r
    return r
  })
  // nilai uji utama: SPT → N60 (dari N, atau dari qc opsional); CPT → qc dan fs
  // SPT: N kosong → interpolasi dari baris ber-N (qc opsional tidak dipakai untuk mengisi N); N = 0 dengan qc > 0 = data lama "kosong".
  // Hanya bila tidak ada satu pun N: N60 setara dari qc/N (Robertson).
  const hasN = (r) => has(r.ly.N) && !(+r.ly.N === 0 && pos(r.ly.qc))
  const anyN = rows.some(hasN)
  const fillN = cpt ? null : anyN ? interpCol(rows, hasN, (r) => r.ly.N * Er / 60) : rows.map((r) => [pos(r.ly.qc) ? r.ly.qc / QC_N[r.ly.type] : 0, false])
  const fillQ = cpt ? interpCol(rows, (r) => pos(r.ly.qc), (r) => +r.ly.qc) : null
  const fillF = cpt ? interpCol(rows, (r) => pos(r.ly.fs), (r) => +r.ly.fs) : null
  let sv = 0, svp = 0
  rows.forEach((r, i) => {
    const ly = r.ly, { h, z0, z1, zm } = r, g = r.g, gsat = r.gsat
    const inc = (zz) => { const dry = clamp(Math.min(zz, gwt) - z0, 0, h), wet = clamp(zz - Math.max(z0, gwt), 0, h); return [g * dry + gsat * wet, g * dry + (gsat - GAMMA_W) * wet] }
    const [tm, em] = inc(zm), [tb, eb] = inc(z1)
    const svm = sv + tm, svpm = Math.max(svp + em, 1)
    const coh = cohesive(ly.type)
    let N60, qc, fs = pos(ly.fs) ? +ly.fs : 0
    const est = { N: false, qc: false, fs: false, g: r.gEst }
    if (cpt) {
      ;[qc, est.qc] = fillQ[i]
      if (!pos(ly.fs)) [fs, est.fs] = fillF[i]
      N60 = pos(ly.N) ? ly.N * Er / 60 : qc / QC_N[ly.type]
    } else {
      ;[N60, est.N] = fillN[i]
      qc = pos(ly.qc) ? +ly.qc : 0
    }
    const useCpt = cpt && qc > 0
    if (!qc && N60) qc = QC_N[ly.type] * N60
    const N1 = N60 * Math.min(Math.sqrt(100 / svpm), 1.7)                                  // Liao & Whitman
    const d = { cu: 0, phi: 0, E: 0, nu: coh ? 0.45 : 0.3, e0: 0, Cc: 0, Cs: 0, OCR: 1, cv: coh ? 2 : 0, Ca: 0 }
    const src = {}
    if (coh) {
      d.cu = Math.max(5, useCpt ? (qc * 1000 - svm) / (soil.Nkt || 15) : (ly.type === "silt" ? 5 : 6) * N60)   // Lunne et al.; Stroud (1974)
      d.E = (ly.type === "silt" ? 250 : 300) * d.cu                                        // Duncan & Buchignani (Eu/cu, PI menengah)
      d.e0 = clamp(((soil.Gs || 2.7) * GAMMA_W - gsat) / Math.max(gsat - GAMMA_W, 0.5), 0.3, 3)
      d.Cc = Math.max(0.05, 0.30 * (d.e0 - 0.27))                                          // Hough (1957)
      d.Cs = 0.15 * d.Cc
      d.OCR = clamp(Math.pow(d.cu / svpm / 0.22, 1.25), 1, 10)                             // SHANSEP: cu/σ'v = 0,22·OCR^0,8
      d.Ca = (d.OCR < 2 ? 0.04 : 0.01) * d.Cc / (1 + d.e0)                                // Mesri: Cα/Cc ≈ 0,04 (NC), jauh lebih kecil bila OC
      Object.assign(src, { cu: useCpt ? "(qc − σv)/Nkt" : `${ly.type === "silt" ? 5 : 6}·N60`, E: `${ly.type === "silt" ? 250 : 300}·cu`, phi: "–" })
    } else {
      const qc1N = (qc * 1000 / 100) / Math.sqrt(svpm / 100)
      d.phi = clamp(useCpt ? 17.6 + 11 * Math.log10(Math.max(qc1N, 1)) : 27.1 + 0.3 * N1 - 0.00054 * N1 * N1, 25, 43) + (ly.type === "gravel" ? 2 : 0)
      d.E = useCpt ? (ly.type === "gravel" ? 3 : 2.5) * qc * 1000 : (ly.type === "gravel" ? 1200 * (N60 + 6) : 500 * (N60 + 15))   // Schmertmann; Bowles
      Object.assign(src, { phi: useCpt ? "Kulhawy–Mayne (qc1N)" : "Peck–Hanson–Thornburn (N1)", E: useCpt ? `${ly.type === "gravel" ? 3 : 2.5}·qc` : (ly.type === "gravel" ? "1200(N60 + 6)" : "500(N60 + 15)"), cu: "–" })
    }
    const auto = {}
    for (const k of OVR) {
      const v = ly[k]
      if (v > 0) { d[k] = k === "E" ? v * 1000 : v; auto[k] = false } else auto[k] = true
    }
    const ic = cpt ? cptIc(qc, fs, svm, svpm) : null
    // N lapangan (tanpa koreksi energi) untuk kelas situs SNI 1726 (§5.4.2: N tidak dikoreksi, maks. 100)
    const Nf = N60 * 60 / Er
    out.push({ ...ly, g, gsat, h, z0, z1, zm, sv: svm, svp: svpm, st0: sv, ef0: svp, N60, N1, Nf, qcE: qc, fsE: fs, coh, ...d, auto, src, est, grp: r.grp, Ic: ic ? ic.Ic : null, typeIc: ic ? ic.type : null })
    sv += tb; svp += eb
  })
  return { layers: out, gwt, depth: z, test: soil.test, name: soil.name, Er, Nkt: soil.Nkt, z1s: out.map((l) => l.z1) }
}
// lapis pada kedalaman z (pencarian biner; di bawah dasar bor → lapis terakhir)
export function layerIx(ds, z) {
  const a = ds.z1s || ds.layers.map((l) => l.z1)
  let lo = 0, hi = a.length - 1
  if (z >= a[hi]) return hi
  while (lo < hi) { const m = (lo + hi) >> 1; if (z < a[m]) hi = m; else lo = m + 1 }
  return lo
}
export const layerAt = (ds, z) => ds.layers[layerIx(ds, z)]
// tegangan vertikal total dan efektif pada kedalaman z (lapis terakhir diperpanjang)
export function stressAt(ds, z) {
  if (z <= 0) return [0, 0]
  const l = ds.layers[layerIx(ds, z)], last = ds.layers[ds.layers.length - 1]
  if (l.st0 == null) return stressAtSlow(ds, z)
  const b = l === last ? z : Math.min(z, l.z1), dry = clamp(Math.min(b, ds.gwt) - l.z0, 0, b - l.z0), wet = b - l.z0 - dry
  return [l.st0 + l.g * dry + l.gsat * wet, Math.max(l.ef0 + l.g * dry + (l.gsat - GAMMA_W) * wet, 0)]
}
function stressAtSlow(ds, z) {
  let tot = 0, eff = 0
  for (const l of ds.layers) {
    if (z <= l.z0) break
    const b = Math.min(z, l.z1), dry = clamp(Math.min(b, ds.gwt) - l.z0, 0, b - l.z0), wet = b - l.z0 - dry
    tot += l.g * dry + l.gsat * wet; eff += l.g * dry + (l.gsat - GAMMA_W) * wet
  }
  const last = ds.layers[ds.layers.length - 1]
  if (z > last.z1) { const dz = z - last.z1, dry = clamp(ds.gwt - last.z1, 0, dz); tot += last.g * dry + last.gsat * (dz - dry); eff += last.g * dry + (last.gsat - GAMMA_W) * (dz - dry) }
  return [tot, Math.max(eff, 0)]
}
// rata-rata berbobot tebal suatu besaran pada rentang kedalaman [a, b]
export function avgOver(ds, a, b, f) {
  let s = 0, w = 0
  for (const l of ds.layers) { const h = Math.max(0, Math.min(b, l.z1) - Math.max(a, l.z0)); if (h > 0) { s += f(l) * h; w += h } }
  if (b > ds.depth) { const l = ds.layers[ds.layers.length - 1], h = b - Math.max(a, ds.depth); s += f(l) * h; w += h }
  return w ? s / w : f(layerAt(ds, a))
}

// Blok tampilan: baris bersambung sejenis digabung (nilai = rata-rata tebal) — untuk gambar agar label tidak bertumpuk
export function soilBlocks(ds) {
  const out = []
  for (const l of ds.layers) {
    let b = out[out.length - 1]
    if (!b || b.type !== l.type) { b = { type: l.type, coh: l.coh, z0: l.z0, z1: l.z0, n: 0, h: 0, cu: 0, phi: 0, N60: 0, E: 0, Cc: 0 }; out.push(b) }
    const h = l.z1 - l.z0
    b.z1 = l.z1; b.n++; b.h += h
    for (const k of ["cu", "phi", "N60", "E", "Cc"]) b[k] += (l[k] || 0) * h
  }
  for (const b of out) for (const k of ["cu", "phi", "N60", "E", "Cc"]) b[k] /= Math.max(b.h, 1e-9)
  return out
}
// ---------------------------------------------------------------- alat bantu input per interval
const blankRow = (src) => ({ h: 1, type: "clay", g: null, gsat: null, N: null, qc: null, fs: null, ...Object.fromEntries(OVR.map((k) => [k, 0])), ...src })
// Pecah profil menjadi baris setebal dz sampai kedalaman zmax (sifat diambil dari lapis asal di tengah baris; di bawah dasar bor = lapis
// terakhir). blank: kosongkan N/qc/fs agar diisi per baris (sel kosong diinterpolasi). Maks. MAX_ROWS baris.
export function resampleSoil(soil, dz, zmax, blank = false) {
  dz = clamp(+dz || 0.5, 0.1, 10); zmax = clamp(+zmax || 30, dz, 150)
  const n = Math.ceil(zmax / dz - 1e-9)
  if (n > MAX_ROWS) throw new Error(L(`Terlalu banyak baris (${n}); maks. ${MAX_ROWS}. Perbesar interval atau kurangi kedalaman.`, `Too many rows (${n}); max. ${MAX_ROWS}. Increase the interval or reduce the depth.`))
  const tops = []; let z = 0
  for (const l of soil.layers) { tops.push([z, z + (+l.h || 0), l]); z += +l.h || 0 }
  const at = (zz) => (tops.find(([, b]) => zz < b) || tops[tops.length - 1])[2]
  const rows = []
  for (let i = 0; i < n; i++) {
    const a = i * dz, b = Math.min((i + 1) * dz, zmax), src = at((a + b) / 2)
    rows.push(blankRow({ ...src, h: +(b - a).toFixed(4), ...(blank ? { N: null, qc: null, fs: null } : {}) }))
  }
  return { ...soil, layers: rows }
}
// Gabungkan baris bersambung yang isinya sama (jenis, γ, N, qc, fs, parameter lanjutan) → lapis lebih tebal
export function mergeRows(soil) {
  const keys = ["type", "g", "gsat", "N", "qc", "fs", ...OVR], same = (a, b) => keys.every((k) => (a[k] ?? null) === (b[k] ?? null))
  const out = []
  for (const l of soil.layers) { const p = out[out.length - 1]; if (p && same(p, l)) p.h = +(p.h + l.h).toFixed(4); else out.push({ ...l }) }
  return { ...soil, layers: out }
}
// Jenis tanah tiap baris dari indeks perilaku CPT Ic (Robertson); baris tanpa qc/fs tidak diubah. Hasil: { soil, n (baris berubah) }
export function classifyCpt(soil) {
  const ds = deriveSoil(soil)
  let n = 0
  const layers = soil.layers.map((l, i) => { const t = ds.layers[i].typeIc; if (t && t !== l.type) { n++; return { ...l, type: t } } return l })
  return { soil: { ...soil, layers }, n }
}
const TYPE_WORDS = [["clay", ["lempung", "clay", "lemp"]], ["silt", ["lanau", "silt"]], ["gravel", ["kerikil", "gravel", "batu"]], ["sand", ["pasir", "sand"]]]
export function typeFromText(t) {
  // kata sifat Inggris (silty sand = pasir) diabaikan; bahasa Indonesia kata pertama = jenis utama (pasir lanauan = pasir)
  let x = String(t || "").toLowerCase(); const y = x.replace(/\b(clayey|silty|sandy|gravelly)\b/g, " ")
  if (/clay|silt|sand|gravel|lemp|lanau|pasir|kerikil|batu/.test(y)) x = y
  let best = null, bi = Infinity
  for (const [k, ws] of TYPE_WORDS) for (const w of ws) { const i = x.indexOf(w); if (i >= 0 && i < bi) { bi = i; best = k } }
  return best
}
const KGCM2 = { qc: 0.0980665, fs: 98.0665 }                                                // kg/cm² → MPa (qc) / kPa (fs)
// Tempel tabel dari Excel / CSV / teks. Kolom dikenali dari baris judul (kedalaman, jenis, γ, γsat, N-SPT, qc, fs); tanpa judul:
// N-SPT → "kedalaman  N  [qc]  [jenis]", CPT → "kedalaman  qc  [fs]  [jenis]". Kedalaman = dasar baris (baris i = kedalaman sebelumnya
// s.d. kedalaman ini); rentang "0–0,5" juga diterima. Jenis/γ yang tidak diisi diambil dari profil base pada kedalaman itu.
// o: { test, qcUnit: "mpa" | "kgcm2", fsUnit: "kpa" | "kgcm2", base (soil) }
export function parseSoilPaste(text, o = {}) {
  const cpt = o.test === "cpt", warn = []
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((x) => x.trim()).filter(Boolean)
  const split = (ln) => (ln.includes("\t") ? ln.split("\t") : ln.includes(";") ? ln.split(";") : ln.split(/\s+/)).map((c) => c.trim())
  const csv = (ln) => !ln.includes("\t") && !ln.includes(";") && !ln.includes(" ") && (ln.match(/,/g) || []).length >= 1 && /\./.test(ln)
  const num = (c, dotOnly) => { const t = String(c).replace(/\s/g, ""); if (!t || /^[-–—]+$/.test(t)) return null; const v = Number(dotOnly ? t : t.replace(",", ".")); return isFinite(v) ? v : NaN }
  const rng = (c) => { const m = String(c).replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)[–—-](\d+(?:[.,]\d+)?)$/); return m ? Number(m[2].replace(",", ".")) : null }
  let map = null
  const head = (cells) => {
    const m = {}
    cells.forEach((c, i) => {
      const x = c.toLowerCase()
      if (m.z == null && (/kedalaman|depth|^z\b|^z\s*\(|elev/.test(x))) m.z = i
      else if (m.type == null && /jenis|type|tanah|soil|deskrip|descr|lapis/.test(x)) m.type = i
      else if (m.gsat == null && /sat/.test(x)) m.gsat = i
      else if (m.g == null && /^γ|gamma|berat|unit w|^bv/.test(x)) m.g = i
      else if (m.N == null && /spt|^n\b|^n\s*\(|^n60|pukulan|blow/.test(x)) m.N = i
      else if (m.qc == null && /qc|konus|cone|ujung/.test(x)) m.qc = i
      else if (m.fs == null && /fs|gesek|friction|sleeve|lekat|selimut/.test(x)) m.fs = i
    })
    return m.z != null && (m.N != null || m.qc != null) ? m : null
  }
  const recs = []
  for (const ln of lines) {
    const dotOnly = csv(ln), cells = dotOnly ? ln.split(",").map((c) => c.trim()) : split(ln)
    const nums = cells.map((c) => rng(c) ?? num(c, dotOnly))
    if (!map && !recs.length && nums.every((v) => v == null || isNaN(v))) { map = head(cells); continue }
    let z, v = {}, type = null
    if (map) {
      z = nums[map.z]
      for (const k of ["g", "gsat", "N", "qc", "fs"]) if (map[k] != null) v[k] = nums[map[k]]
      if (map.type != null) type = typeFromText(cells[map.type])
    } else if (cells.length >= 6 && isNaN(nums[1]) && nums[1] !== null) {
      // urutan tabel app ini: z | jenis | γ | γsat | N-SPT | qc | fs (sel "–" = kosong)
      z = nums[0]; type = typeFromText(cells[1])
      Object.assign(v, { g: nums[2], gsat: nums[3], N: nums[4], qc: nums[5], fs: nums[6] ?? null })
    } else {
      const words = cells.filter((c, i) => isNaN(nums[i]) && nums[i] !== null)
      const ns = nums.filter((x) => x != null && !isNaN(x))
      type = typeFromText(words.join(" "))
      z = ns[0]
      if (cpt) { v.qc = ns[1]; v.fs = ns[2] } else { v.N = ns[1]; v.qc = ns[2] }
    }
    if (!(z > 0)) { if (lines.length) warn.push(L(`Baris dilewati: "${ln.slice(0, 40)}"`, `Line skipped: "${ln.slice(0, 40)}"`)); continue }
    for (const k of Object.keys(v)) if (v[k] != null && (isNaN(v[k]) || v[k] < 0)) v[k] = null
    if (v.qc != null && o.qcUnit === "kgcm2") v.qc *= KGCM2.qc
    if (v.fs != null && o.fsUnit === "kgcm2") v.fs *= KGCM2.fs
    recs.push({ z, type, ...v })
  }
  recs.sort((a, b) => a.z - b.z)
  const uniq = recs.filter((r, i) => i === 0 || r.z > recs[i - 1].z + 1e-9)
  if (uniq.length < recs.length) warn.push(L(`${recs.length - uniq.length} kedalaman ganda diabaikan.`, `${recs.length - uniq.length} duplicate depths ignored.`))
  if (uniq.length > MAX_ROWS) throw new Error(L(`Terlalu banyak baris (${uniq.length}); maks. ${MAX_ROWS}.`, `Too many rows (${uniq.length}); max. ${MAX_ROWS}.`))
  if (!uniq.length) throw new Error(L("Tidak ada baris data yang dikenali. Contoh: 0,5 ⇥ 12 (kedalaman, N-SPT).", "No data rows recognised. Example: 0.5 ⇥ 12 (depth, SPT N)."))
  const base = o.base && o.base.layers && o.base.layers.length ? o.base : null, bt = []
  if (base) { let zz = 0; for (const l of base.layers) { bt.push([zz + (+l.h || 0), l]); zz += +l.h || 0 } }
  const baseAt = (zz) => (base ? (bt.find(([b]) => zz < b) || bt[bt.length - 1])[1] : null)
  let z0 = 0
  const layers = uniq.map((r) => {
    const b = baseAt((z0 + r.z) / 2), row = blankRow({ ...(b || {}), h: +(r.z - z0).toFixed(4), N: null, qc: null, fs: null })
    if (r.type) row.type = r.type
    else if (!b) row.type = "clay"
    if (r.type && b && r.type !== b.type) { row.g = null; row.gsat = null }
    for (const k of ["g", "gsat", "N", "qc", "fs"]) if (r[k] != null) row[k] = r[k]
    z0 = r.z
    return row
  })
  return { layers, warn, n: layers.length, depth: z0, mapped: !!map }
}

// ---------------------------------------------------------------- kelas situs SNI 1726:2019 Tabel 5 (N̄ pada 30 m teratas)
// N = tahanan penetrasi standar LAPANGAN (tanpa koreksi energi), tiap nilai dibatasi 100 (SNI 1726:2019 §5.4.2 / ASCE 7 §20.4.2).
const Nsite = (l) => clamp(l.Nf ?? l.N60, 1, 100)
export function siteClass(ds) {
  let sumD = 0, sumDN = 0, soft = 0
  for (const l of ds.layers) {
    const h = Math.max(0, Math.min(30, l.z1) - l.z0)
    if (h > 0) { sumD += h; sumDN += h / Nsite(l) }
    if (l.coh && l.cu < 25 && l.z0 < 30) soft += Math.min(l.z1, 30) - l.z0
  }
  const extra = Math.max(0, 30 - sumD)
  if (extra > 0) { sumDN += extra / Nsite(ds.layers[ds.layers.length - 1]); sumD = 30 }
  const Nbar = sumD / sumDN
  let cls = Nbar > 50 ? "SC" : Nbar >= 15 ? "SD" : "SE", why = `N̄ = ${Nbar.toFixed(1)} → ${Nbar > 50 ? "> 50" : Nbar >= 15 ? "15–50" : "< 15"}`
  if (soft >= 3 && cls !== "SE") { cls = "SE"; why += L(`; lempung lunak cu < 25 kPa setebal ${soft.toFixed(1)} m (≥ 3 m)`, `; soft clay cu < 25 kPa, ${soft.toFixed(1)} m thick (≥ 3 m)`) }
  return { Nbar, cls, why, soft, extended: extra > 0 ? extra : 0 }
}

// ---------------------------------------------------------------- daya dukung pondasi dangkal
export function bearingFactors(phi) {
  if (phi < 0.1) return [5.14, 1, 0]
  const p = rad(phi), Nq = Math.exp(Math.PI * Math.tan(p)) * Math.tan(Math.PI / 4 + p / 2) ** 2
  return [(Nq - 1) / Math.tan(p), Nq, 2 * (Nq + 1) * Math.tan(p)]
}
export const QA_METHOD = () => ({ spt: L("N-SPT (Meyerhof)", "N-SPT (Meyerhof)"), cpt: L("CPT / sondir (Meyerhof)", "CPT / sondir (Meyerhof)"), vesic: L("Vesic / Skempton (c–φ)", "Vesic / Skempton (c–φ)") })
// Daya dukung izin BRUTO qa (kPa, dibandingkan dengan tekanan kontak termasuk berat pondasi & urugan). method: "spt" | "cpt" | "vesic".
// Tanah kohesif (mayoritas zona B di bawah dasar): Skempton φ = 0 dengan cu dari N-SPT/CPT. Granular: SPT/CPT memakai kriteria penurunan 25 mm
// (Meyerhof 1956/1965 dalam Das) dan dibatasi Vesic/FS.
export function shallowQa(ds, B, Lf, Df, method, FS = 3) {
  const b = Math.max(Math.min(B, Lf), 0.1), l = Math.max(B, Lf, 0.1), za = Df, zb = Df + b
  const [sv, svp] = stressAt(ds, Df)
  const cohB = avgOver(ds, za, zb, (x) => (x.coh ? 1 : 0)) >= 0.5
  const base = layerAt(ds, Df + 0.01)
  const rows = [[L("Zona pengaruh", "Influence zone"), `z = Df … Df + B = ${Df.toFixed(2)} … ${zb.toFixed(2)} m`, `${L("lapis di dasar", "base layer")}: ${typeName(base.type)}`, cohB ? L("kohesif", "cohesive") : L("granular", "granular")],
    ["σv, σ'v (Df)", "Σγ·h", "", `${sv.toFixed(1)}, ${svp.toFixed(1)} kPa`]]
  let qa, qult = null, txt, gov = ""
  // Vesic (granular) — juga dipakai sebagai batas keruntuhan untuk SPT/CPT
  const vesic = () => {
    const phi = avgOver(ds, za, zb, (x) => (x.coh ? 25 : x.phi)), [, Nq, Ng] = bearingFactors(phi)
    const gam = avgOver(ds, za, zb, (x) => (x.zm > ds.gwt ? x.gsat - GAMMA_W : x.g)), r = b / l, tp = Math.tan(rad(phi))
    const kd = Df / b <= 1 ? Df / b : Math.atan(Df / b)                                      // Hansen/Vesic: Df/B > 1 → arctan(Df/B) (rad)
    const sq = 1 + r * tp, sg = Math.max(1 - 0.4 * r, 0.6), dq = 1 + 2 * tp * (1 - Math.sin(rad(phi))) ** 2 * kd
    const qu = svp * Nq * sq * dq + 0.5 * gam * b * Ng * sg
    return { phi, Nq, Ng, gam, sq, sg, dq, qu }
  }
  if (cohB) {
    const cu = avgOver(ds, za, zb, (x) => (x.coh ? x.cu : 75))
    qult = 5.14 * cu * (1 + 0.2 * b / l) * (1 + 0.2 * Math.min(Df / b, 2.5)) + sv
    qa = (qult - sv) / FS + sv
    txt = "Skempton (φ = 0)"; gov = L("keruntuhan geser", "shear failure")
    rows.push(["cu " + L("rata-rata", "average"), method === "cpt" ? "cu = (qc − σv)/Nkt" : method === "spt" ? "cu = 6·N60 (Stroud)" : "cu", L("rata-rata tebal di zona B", "thickness-weighted over B"), `${cu.toFixed(1)} kPa`],
      ["qult", "5,14·cu·(1 + 0,2B/L)(1 + 0,2Df/B) + σv", `cu ${cu.toFixed(1)}; B ${b.toFixed(2)}; L ${l.toFixed(2)}; Df ${Df.toFixed(2)}`, `${qult.toFixed(1)} kPa`],
      ["qa " + L("(bruto)", "(gross)"), "(qult − σv)/FS + σv", `FS ${FS}`, `${qa.toFixed(1)} kPa`])
  } else {
    const v = vesic(), qaV = v.qu / FS
    rows.push(["φ " + L("rata-rata", "average"), "", "", `${v.phi.toFixed(1)}°`], ["Nq, Nγ", "e^(π tanφ)·tan²(45 + φ/2); 2(Nq + 1)tanφ", "", `${v.Nq.toFixed(2)}, ${v.Ng.toFixed(2)}`],
      ["qult (Vesic)", "σ'v·Nq·sq·dq + ½·γ'·B·Nγ·sγ", `sq ${v.sq.toFixed(2)}, dq ${v.dq.toFixed(2)}, sγ ${v.sg.toFixed(2)}, γ' ${v.gam.toFixed(2)}`, `${v.qu.toFixed(1)} kPa`], ["qa,geser", "qult/FS", `FS ${FS}`, `${qaV.toFixed(1)} kPa`])
    qult = v.qu
    if (method === "vesic") { qa = qaV; txt = "Vesic (c = 0, φ)"; gov = L("keruntuhan geser", "shear failure") }
    else {
      let qn
      if (method === "spt") {
        const N = avgOver(ds, za, zb, (x) => x.N60), Fd = Math.min(1 + 0.33 * Df / b, 1.33)
        qn = b <= 1.22 ? 19.16 * N * Fd : 11.98 * N * ((3.28 * b + 1) / (3.28 * b)) ** 2 * Fd
        txt = "Meyerhof (N-SPT, s = 25 mm)"
        rows.push(["N60 " + L("rata-rata", "average"), "N60 = N·Er/60", `Er ${ds.Er ?? 60}%`, N.toFixed(1)], ["Fd", "1 + 0,33·Df/B ≤ 1,33", "", Fd.toFixed(3)],
          ["qnet,izin", b <= 1.22 ? "19,16·N60·Fd" : "11,98·N60·((3,28B + 1)/(3,28B))²·Fd", `B ${b.toFixed(2)} m`, `${qn.toFixed(1)} kPa`])
      } else {
        const qc = avgOver(ds, za, zb, (x) => x.qcE) * 1000
        qn = b <= 1.22 ? qc / 15 : qc / 25 * ((b + 0.3) / b) ** 2
        txt = "Meyerhof (CPT, s = 25 mm)"
        rows.push(["qc " + L("rata-rata", "average"), "", "", `${(qc / 1000).toFixed(2)} MPa`], ["qnet,izin", b <= 1.22 ? "qc/15" : "qc/25·((B + 0,3)/B)²", `B ${b.toFixed(2)} m`, `${qn.toFixed(1)} kPa`])
      }
      const qaS = qn + sv
      rows.push(["qa,25mm " + L("(bruto)", "(gross)"), "qnet,izin + σv", "", `${qaS.toFixed(1)} kPa`])
      qa = Math.min(qaS, qaV); gov = qaS <= qaV ? L("penurunan 25 mm", "25 mm settlement") : L("keruntuhan geser", "shear failure")
      rows.push(["qa " + L("(bruto)", "(gross)"), "min(qa,25mm; qa,geser)", gov, `${qa.toFixed(1)} kPa`])
    }
  }
  return { qa, qult, txt, gov, rows, cohesive: cohB, sv, B: b, L: l, Df, method, FS }
}

// ---------------------------------------------------------------- kapasitas aksial tiang (kedalaman absolut: kepala pada z0, ujung pada z0 + Lp)
const lcpc = (coh, qc) => (coh ? (qc < 1 ? [30, 15] : qc < 5 ? [40, 35] : [60, 80]) : (qc < 5 ? [60, 35] : qc < 12 ? [100, 80] : [150, 120]))   // [α, fs maks kPa]
export const AXIAL_METHOD = () => ({ api: L("α/β (API RP 2GEO; FHWA untuk bor)", "α/β (API RP 2GEO; FHWA for bored)"), spt: "N-SPT (Meyerhof 1976)", cpt: "CPT (LCPC, Bustamante–Gianeselli)" })
// o: { D, t (m), Lp, open, method: api|spt|cpt, kind: pipe|bored, z0 }
export function pileAxial(ds, o) {
  const { D, Lp, method } = o, z0 = o.z0 || 0, bored = o.kind === "bored", open = !bored && !!o.open
  const t = bored ? D / 2 : o.t, Di = Math.max(D - 2 * t, 0), K = open ? 0.8 : 1.0
  const n = Math.max(40, Math.ceil(Lp / 0.05)), dz = Lp / n
  let Qso = 0, Qsi = 0
  const prof = [], step = Math.max(1, Math.round(n / 60))
  const fOf = (l, z, svp) => {
    if (method === "spt") return l.coh ? alphaClay(l.cu, svp) * l.cu * (bored ? 0.8 : 1) : Math.min((bored ? 1 : 2) * l.N60, bored ? 70 : 100)
    if (method === "cpt") { const [a, fmax] = lcpc(l.coh, l.qcE); return Math.min(l.qcE * 1000 / (bored ? a * 1.25 : a), fmax) }
    if (bored) return l.coh ? 0.55 * l.cu : Math.min(clamp(1.5 - 0.245 * Math.sqrt(z), 0.25, 1.2) * svp, 200)            // FHWA GEC 10
    if (l.coh) return alphaClay(l.cu, svp) * l.cu
    const a = apiSand(l.phi); return Math.min(K * svp * Math.tan(rad(a.d)), a.flim)
  }
  for (let i = 0; i < n; i++) {
    const z = z0 + (i + 0.5) * dz, l = layerAt(ds, z), [, svp] = stressAt(ds, z), f = fOf(l, z, svp)
    Qso += f * Math.PI * D * dz
    if (open) Qsi += f * Math.PI * Di * dz
    if (i % step === 0) prof.push({ z, svp, f, Qs: Qso, type: l.type })
  }
  const zt = z0 + Lp, it = layerIx(ds, zt - 1e-6), lt = ds.layers[it], [, svT] = stressAt(ds, zt)
  let q, tipx = {}
  if (method === "spt") {
    if (lt.coh) q = 9 * lt.cu
    else {
      // Meyerhof (1976), Das: N60 rata-rata dekat ujung (10D di atas s.d. 4D di bawah ujung); Lb = penetrasi ke dalam lapis pendukung
      // granular yang bersambung di atas ujung (bukan panjang tiang total), qp = 40·N̄·Lb/D ≤ 400·N̄ (pancang) / 13·N̄·Lb/D ≤ 130·N̄ (bor).
      const za = Math.max(zt - 10 * D, 0), zb = zt + 4 * D, Nb = avgOver(ds, za, zb, (x) => x.N60)
      let k = it; while (k > 0 && !ds.layers[k - 1].coh) k--
      const Lb = Math.max(zt - ds.layers[k].z0, 0)
      q = Math.min((bored ? 13 : 40) * Nb * Lb / D, (bored ? 130 : 400) * Nb)
      tipx = { Nb, Lb, za, zb }
    }
  } else if (method === "cpt") {
    // LCPC (Bustamante & Gianeselli 1982): qca = rata-rata qc pada ujung ± 1,5D, tiap qc dibatasi 0,7–1,3·qca' lalu dirata-rata ulang
    const za = Math.max(zt - 1.5 * D, 0), zb = zt + 1.5 * D, m = 30, smp = []
    for (let j = 0; j <= m; j++) smp.push(layerAt(ds, za + (zb - za) * j / m).qcE)
    const q1 = smp.reduce((a, b) => a + b, 0) / smp.length, qca = smp.reduce((a, b) => a + clamp(b, 0.7 * q1, 1.3 * q1), 0) / smp.length
    q = (lt.coh ? (bored ? 0.375 : 0.55) : (bored ? 0.15 : 0.4)) * qca * 1000
    tipx = { qca, qca1: q1, za, zb }
  }
  else if (bored) q = lt.coh ? Math.min(9 * lt.cu, 3800) : Math.min(57.5 * lt.N60, 2900)
  else q = lt.coh ? 9 * lt.cu : Math.min(apiSand(lt.phi).Nq * svT, apiSand(lt.phi).qlim)
  const Ag = Math.PI * D * D / 4, Aan = bored ? Ag : Math.PI * (D * D - Di * Di) / 4
  const plugQ = Qso + q * Ag, unplugQ = Qso + Qsi + q * Aan
  const Qc = open ? Math.min(plugQ, unplugQ) : plugQ
  const plugged = !open || plugQ <= unplugQ
  const wet = Math.max(0, Math.min(Lp, zt - Math.max(z0, ds.gwt)))
  const Wp = bored ? GAMMA_C * Ag * Lp - GAMMA_W * Ag * wet : GAMMA_S * Aan * Lp - GAMMA_W * Aan * wet
  const Qt = (bored ? 0.75 : 1) * Qso + Wp
  return { Qso, Qsi, q, Qb: plugged ? q * Ag : q * Aan, plugged, Qc, Qt, Wp, prof, tip: { type: lt.type, coh: lt.coh, z: zt, svp: svT, ...tipx }, method, Ag, Aan, D, Lp, z0, bored }
}
// Lapisan format pile.js (untuk lateral Broms/Winkler), kedalaman relatif kepala tiang pada z0
export function pileLayers(ds, z0 = 0) {
  const out = []
  for (const l of ds.layers) {
    const a = Math.max(l.z0, z0), h = l.z1 - a
    if (h > 1e-6) out.push({ h, type: l.coh ? "clay" : "sand", g: l.zm > ds.gwt ? l.gsat : l.g, cu: l.coh ? l.cu : 0, phi: l.coh ? 0 : l.phi, nh: 0 })
  }
  if (!out.length) { const l = ds.layers[ds.layers.length - 1]; out.push({ h: 10, type: l.coh ? "clay" : "sand", g: l.gsat, cu: l.cu, phi: l.phi, nh: 0 }) }
  out[out.length - 1] = { ...out[out.length - 1], h: out[out.length - 1].h + 50 }           // perpanjang lapis terakhir untuk tiang yang lebih panjang dari bor
  return out
}

// ---------------------------------------------------------------- penurunan (mesin js/penurunan.js)
function settleSoil(ds, zb) {
  const layers = []
  let gu = 0, gs = 0, w = 0
  const mk = (l, H) => ({ name: typeName(l.type), H, gamma: l.g, gsat: l.gsat, E: l.E, nu: l.nu, clay: l.coh, e0: l.e0, Cc: l.Cc, Cs: l.Cs, OCR: l.OCR, cv: l.cv, double: true, Ca: l.Ca })
  for (const l of ds.layers) {
    const h0 = Math.max(0, Math.min(zb, l.z1) - l.z0)
    if (h0 > 0) { gu += l.g * h0; gs += l.gsat * h0; w += h0 }
    const H = l.z1 - Math.max(l.z0, zb)
    if (H > 1e-6) layers.push(mk(l, H))
  }
  const last = ds.layers[ds.layers.length - 1]
  if (zb >= ds.depth) { gu += last.g * (zb - ds.depth); gs += last.gsat * (zb - ds.depth); w += zb - ds.depth }
  if (!layers.length || layers.reduce((a, x) => a + x.H, 0) < 3) layers.push(mk(last, 5))
  // Strata konsolidasi: baris kohesif yang bersambung = satu lapisan lempung (drainase dua arah di batas atas & bawahnya),
  // jadi Hdr = ½·tebal strata, bukan ½·tebal baris. Tanpa ini data per 0,5 m membuat konsolidasi (t90) jauh terlalu cepat.
  let z = zb, i = 0
  while (i < layers.length) {
    if (!layers[i].clay) { z += layers[i].H; i++; continue }
    let j = i, H = 0
    while (j < layers.length && layers[j].clay) { H += layers[j].H; j++ }
    const nm = `${L("Lempung/lanau", "Clay/silt")} ${z.toFixed(1)}–${(z + H).toFixed(1)} m`
    for (let k = i; k < j; k++) Object.assign(layers[k], { Hdr: H / 2, grp: nm, name: j - i > 1 ? `${nm} · ${layers[k].name}` : layers[k].name })
    z += H; i = j
  }
  return { Df: zb, gamma_up: w ? gu / w : 18, gsat_up: w ? gs / w : 19, Dw: ds.gwt, layers }
}
export const SETTLE_OPT = { life: 20, allow: 50, allowDeep: 25, method: "boussinesq", rig: "kaku", dz: 0.5 }
// foot: { shape: persegi|lingkaran|lajur, B, L, Df, q (bruto) atau qNet }
export function settleShallow(ds, foot, opt = {}) {
  const o = { ...SETTLE_OPT, ...opt }
  const soil = settleSoil(ds, foot.Df)
  const qg = foot.qNet != null ? foot.qNet + (foot.Df > 0 ? overburden(foot.Df, soil)[0] : 0) : foot.q
  try {
    const res = analyze({ shape: foot.shape, B: foot.B, L: foot.L ?? foot.B }, soil, qg, { method: o.method, rigidity: o.rig, dz: o.dz, lifeYears: o.life, allowMm: o.allow })
    return { res, soil, qg }
  } catch (e) { return { error: e.message, soil, qg } }
}
// Kelompok tiang (Das/Tomlinson): pemendekan elastis se = (Qp + ξQs)·L/(Ap·Ep), ξ = 0,5; tiang tunggal Vesic (se + sp + ss) dan kelompok
// sg = s1·√(Bg/D) sebagai pembanding; penurunan utama = se + rakit ekuivalen (Terzaghi–Peck): 2L/3 untuk tiang gesek dengan sebaran 1H:4V,
// ujung tiang untuk tiang dukung ujung (Qb/Qu ≥ 0,6).
// g: { D, Lp, Ap, Ep, n, Bg, Lg, Q (kN layan pada dasar cap), Qb, Qu, qb (kPa ujung satuan), z0 (kedalaman kepala), driven }
export function settleGroup(ds, g, opt = {}) {
  const o = { ...SETTLE_OPT, ...opt }
  const ratioB = g.Qu > 0 ? clamp(g.Qb / g.Qu, 0, 1) : 0.3
  const Qpile = g.Q / g.n, Qp = Qpile * ratioB, Qs = Qpile - Qp
  const se = (Qp + 0.5 * Qs) * g.Lp / (g.Ap * g.Ep)
  const Es = Math.max(avgOver(ds, g.z0, g.z0 + g.Lp, (l) => l.E), 1000)
  const Cp = g.driven ? 0.03 : 0.09
  const sp = Cp * Qp / (g.D * Math.max(g.qb || 1000, 100))
  const ss = Qs / (Math.PI * g.D * g.Lp) * g.D / Es * (1 - 0.3 ** 2) * (2 + 0.35 * Math.sqrt(g.Lp / g.D))
  const s1 = se + sp + ss, sgV = s1 * Math.sqrt(Math.max(g.Bg, g.D) / g.D)
  const endB = ratioB >= 0.6
  const dr = endB ? g.Lp : 2 * g.Lp / 3, zr = g.z0 + dr
  const spread = endB ? 0 : dr / 4
  const Br = Math.min(g.Bg, g.Lg) + 2 * spread, Lr = Math.max(g.Bg, g.Lg) + 2 * spread
  const qnet = g.Q / (Br * Lr)
  const r = settleShallow(ds, { shape: "persegi", B: Br, L: Lr, Df: zr, qNet: qnet }, o)
  const raft = r.res || null
  const total = raft ? se + raft.s_life : se + sgV
  return { kind: "deep", se, sp, ss, s1, sgV, zr, dr, Br, Lr, qnet, endB, ratioB, Qpile, Qp, Qs, raft, raftSoil: r.soil, error: r.error, total, Es, si: raft ? raft.si : 0, sc: raft ? raft.sc : 0,
    allow: o.allowDeep, life: o.life }
}
