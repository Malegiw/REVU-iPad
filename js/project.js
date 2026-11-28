// Data proyek bersama untuk alur Tanah → Gempa → Desain → Penurunan → Laporan: info proyek, data tanah (N-SPT/CPT), parameter gempa,
// metode daya dukung, dan kriteria penurunan. Disimpan di localStorage ("ymd.project.v1"); semua tab membaca dari sini.
// Bank data tanah: P.soils = semua titik penyelidikan proyek (BH-1…, S-1…), masing-masing { id, name, test, gwt, …, layers, fill, x, y, elev,
// date, note, tpl }. P.soilRef = titik acuan proyek ★ (kelas situs tab Gempa, modul bersumber "titik acuan", kasus manual penurunan);
// P.soilEdit = titik yang sedang dibuka di tab Tanah. P.soil = alias (objek yang sama) titik acuan — tidak ditulis ke penyimpanan.
import { L, AUTHOR, seismicParams, nf } from "./desain/core.js"
import { defaultSoil, deriveSoil, siteClass, SETTLE_OPT, OVR, FILL0 } from "./desain/soil.js"
import { ico } from "./icons.js"

const KEY = "ymd.project.v1"
export const RISK_IE = { I: 1.0, II: 1.0, III: 1.25, IV: 1.5 }
function baseDefaults() {
  return {
    info: { name: "Project A", client: "", loc: "", doc: "", rev: "0", eng: AUTHOR, chk: "" },
    soil: null, soils: [], soilRef: "", soilEdit: "",
    bear: { method: "spt", FS: 3, Df: 1.5, B: 2.5 },
    // tiang rencana proyek (acuan kapasitas tiang tunggal untuk semua modul Desain dengan pondasi dalam)
    pile: { kind: "pipe", D: 406.4, t: 12.7, open: true, Fy: 310, fc: 30, n: 8, db: 19, L: 18, method: "api", z0: 1.5, fsC: 2.5, fsT: 3.0, fsL: 2.5, yAllow: 12, Lmax: 30, sdz: "1.0" },
    seis: { Ss: 0.8, S1: 0.35, TL: 8, clsMode: "auto", cls: "SD", risk: "III" },
    settle: { ...SETTLE_OPT, manual: [], sel: "" },
    codes: { wind: "7-22", aci: "19" },
  }
}
export function projDefaults() {
  const d = baseDefaults(), so = { ...defaultSoil(), ...LOC0(), id: "bh01" }
  return { ...d, soil: so, soils: [so], soilRef: so.id, soilEdit: so.id }
}
const okNum = (v) => typeof v === "number" && isFinite(v)
// atribut lokasi titik (opsional): koordinat X/Timur, Y/Utara (m), elevasi muka tanah (m), tanggal uji, keterangan
export const LOC0 = () => ({ x: null, y: null, elev: null, date: "", note: "" })
export const MAX_PTS = 40
const isObj = (o) => !!(o && typeof o === "object" && !Array.isArray(o))
// normalisasi satu titik data tanah (lapisan lengkap, timbunan, atribut lokasi)
export function normSoil(x) {
  const d = defaultSoil(), src = isObj(x) ? x : {}
  const so = { ...d, ...LOC0(), ...src }
  if (!Array.isArray(so.layers) || !so.layers.length) so.layers = d.layers
  so.layers = so.layers.map((l) => ({ ...d.layers[0], ...Object.fromEntries(OVR.map((k) => [k, 0])), ...l }))
  so.fill = { ...FILL0, ...(isObj(src.fill) ? src.fill : {}) }
  for (const k of ["x", "y", "elev"]) if (!okNum(so[k])) so[k] = null
  so.name = String(so.name ?? "").trim() || "BH"
  return so
}
const slug = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "") || "pt"
// id unik baru untuk titik (dari nama; diberi akhiran bila sudah dipakai)
export function newSoilId(P, name) {
  const used = new Set((P.soils || []).map((x) => x.id)), b = slug(name)
  if (!used.has(b)) return b
  for (let i = 2; ; i++) if (!used.has(b + "_" + i)) return b + "_" + i
}
function withBank(P, s) {
  // bank titik: data baru (soils) atau migrasi dari satu titik lama (soil)
  const raw = s && Array.isArray(s.soils) && s.soils.some(isObj) ? s.soils.filter(isObj) : [s && isObj(s.soil) ? s.soil : null]
  const soils = []
  for (const r of raw.slice(0, MAX_PTS)) { const so = normSoil(r); const q = { soils }; so.id = typeof so.id === "string" && so.id && !soils.some((x) => x.id === so.id) ? so.id : newSoilId(q, so.name); soils.push(so) }
  const ref = soils.find((x) => x.id === (s && s.soilRef)) || soils[0]
  P.soils = soils; P.soil = ref; P.soilRef = ref.id
  P.soilEdit = soils.some((x) => x.id === (s && s.soilEdit)) ? s.soilEdit : ref.id
  return P
}
export function projLoad() {
  const d = baseDefaults()
  let s = null
  try { s = JSON.parse(localStorage.getItem(KEY) || "null") } catch (e) { s = null }
  if (!s || typeof s !== "object") {
    // migrasi sekali dari state Desain lama (proyek & data gempa)
    try {
      const o = JSON.parse(localStorage.getItem("ymd.desain.v1") || "null")
      if (o && o.project) Object.assign(d.info, Object.fromEntries(Object.entries(o.project).filter(([, v]) => v)))
      if (o && o.site) for (const k of ["Ss", "S1", "TL"]) if (okNum(o.site[k])) d.seis[k] = o.site[k]
      if (o && o.site && o.site.cls) { d.seis.cls = o.site.cls; if (o.site.cls !== "SD") d.seis.clsMode = "manual" }
    } catch (e) { /* abaikan */ }
    return withBank(d, { soils: [{ ...defaultSoil(), id: "bh01" }] })
  }
  return withBank({ info: { ...d.info, ...(s.info || {}) }, bear: { ...d.bear, ...(s.bear || {}) }, pile: { ...d.pile, ...(s.pile || {}) }, seis: { ...d.seis, ...(s.seis || {}) },
    settle: { ...d.settle, ...(s.settle || {}), manual: Array.isArray((s.settle || {}).manual) ? s.settle.manual : [] }, codes: { ...d.codes, ...(s.codes || {}) } }, s)
}
// serialisasi hemat: alias P.soil tidak ditulis; kolom parameter lanjutan bernilai 0 (= korelasi otomatis) dibuang (dikembalikan saat dimuat)
const OVRS = new Set(OVR)
export const projJSON = (P) => JSON.stringify(P, function (k, v) { if (k === "soil" && this === P) return undefined; if (v === 0 && OVRS.has(k) && this && "type" in this && "h" in this) return undefined; return v })
// mengembalikan false bila penyimpanan gagal (mis. kuota iPad penuh)
export const projSave = (P) => { try { localStorage.setItem(KEY, projJSON(P)); return true } catch (e) { return false } }

// ---------------------------------------------------------------- bank titik penyelidikan
export const soilById = (P, id) => (id && P.soils ? P.soils.find((x) => x.id === id) : null) || null
export const editSoil = (P) => soilById(P, P.soilEdit) || P.soil
export function setRef(P, id) { const so = soilById(P, id); if (so) { P.soilRef = so.id; P.soil = so } return so }
// nama unik (BH-1, BH-1 (2), …)
export function uniqName(P, name) {
  const has = (n) => P.soils.some((x) => x.name.toLowerCase() === n.toLowerCase())
  const b = String(name || "").trim() || "BH"
  if (!has(b)) return b
  for (let i = 2; ; i++) if (!has(`${b} (${i})`)) return `${b} (${i})`
}
// titik baru: from = salinan titik lain (data lapisan, MAT, dst.) atau templat contoh; tpl = belum diisi data titik ini
export function addSoil(P, o = {}) {
  if (P.soils.length >= MAX_PTS) return null
  const base = o.from ? JSON.parse(JSON.stringify(o.from)) : { ...defaultSoil(), test: o.test || "spt" }
  const so = normSoil({ ...base, ...LOC0(), ...(o.keepLoc && o.from ? { x: o.from.x, y: o.from.y, elev: o.from.elev } : {}), name: uniqName(P, o.name || base.name), test: o.test || base.test, tpl: o.tpl ?? true })
  so.id = newSoilId(P, so.name)
  P.soils.push(so)
  return so
}
// hapus titik (minimal satu tersisa); acuan / titik terbuka pindah ke titik lain
export function delSoil(P, id) {
  if (P.soils.length <= 1) return false
  const i = P.soils.findIndex((x) => x.id === id)
  if (i < 0) return false
  P.soils.splice(i, 1)
  const nb = P.soils[Math.min(i, P.soils.length - 1)]
  if (P.soilRef === id) setRef(P, nb.id)
  if (P.soilEdit === id) P.soilEdit = nb.id
  return true
}
// buat banyak titik sekaligus: prefix + nomor a..b (pad digit), nama yang sudah ada dilewati
export function addSoilRange(P, o) {
  const a = Math.max(0, Math.round(o.from)), b = Math.max(a, Math.round(o.to)), made = [], skip = []
  for (let k = a; k <= b; k++) {
    const nm = `${o.prefix || ""}${String(k).padStart(o.pad || 1, "0")}`
    if (P.soils.some((x) => x.name.toLowerCase() === nm.toLowerCase())) { skip.push(nm); continue }
    const so = addSoil(P, { name: nm, test: o.test, from: o.from0 || null })
    if (!so) { skip.push(nm); break }
    made.push(so)
  }
  return { made, skip, full: P.soils.length >= MAX_PTS }
}
// urut nama alami: BH-2 sebelum BH-10; bor dulu lalu sondir bila awalan sama panjang
const natKey = (t) => String(t).toLowerCase().split(/(\d+)/).map((x, i) => (i % 2 ? x.padStart(8, "0") : x)).join("")
export const sortSoils = (P) => { P.soils.sort((p, q) => (natKey(p.name) < natKey(q.name) ? -1 : natKey(p.name) > natKey(q.name) ? 1 : 0)) }
// sumber data tanah modul Desain: soilSrc "project" = bank data tanah (soilPt = id titik, "" = titik acuan), "own" = data modul (st.soilOwn)
// → { kind: "ref" | "pt" | "own", so, lost (id titik yang sudah dihapus → kembali ke acuan) }
export function modSoil(st, P) {
  if (st && st.soilSrc === "own" && st.soilOwn && Array.isArray(st.soilOwn.layers) && st.soilOwn.layers.length) return { kind: "own", so: st.soilOwn }
  const id = st && typeof st.soilPt === "string" ? st.soilPt : ""
  if (id && id !== P.soilRef) { const so = soilById(P, id); if (so) return { kind: "pt", so }; return { kind: "ref", so: P.soil, lost: id } }
  return { kind: "ref", so: P.soil }
}
// label singkat titik untuk daftar pilihan & ringkasan
export const ptLabel = (so) => `${so.name} · ${so.test === "cpt" ? "CPT" : "N-SPT"} · ${nf(so.layers.reduce((a, l) => a + (+l.h || 0), 0), 1)} m${so.tpl ? " · " + L("contoh", "sample") : ""}`

let memo = { k: "", v: null }
export function soilDS(P) {
  const life = (P.settle && P.settle.life) ?? 20, k = JSON.stringify(P.soil) + "|" + life
  if (memo.k !== k) { const v = deriveSoil(P.soil); if (v.fill) v.fill.life = life; memo = { k, v } }
  return memo.v
}
// data tanah milik modul Desain ("Isi di modul ini"): diturunkan sama seperti data proyek, memo per isi data
const memoOwn = new Map()
export function soilDSOf(so, P) {
  const life = (P && P.settle && P.settle.life) ?? 20, k = JSON.stringify(so) + "|" + life
  let v = memoOwn.get(k)
  if (!v) {
    const d = defaultSoil(), src = so && typeof so === "object" ? so : d
    const layers = Array.isArray(src.layers) && src.layers.length ? src.layers.map((l) => ({ ...d.layers[0], ...Object.fromEntries(OVR.map((x) => [x, 0])), ...l })) : d.layers
    v = deriveSoil({ ...d, ...src, layers, fill: { ...FILL0, ...(src.fill || {}) } })
    if (v.fill) v.fill.life = life
    if (memoOwn.size > 96) memoOwn.clear()
    memoOwn.set(k, v)
  }
  return v
}
// salinan data tanah titik (bawaan: titik acuan) untuk mulai mengisi data tanah modul
export function soilCopy(P, id) { const Q = P || projLoad(), so = soilById(Q, id) || Q.soil, c = JSON.parse(JSON.stringify(so)); delete c.id; delete c.tpl; return c }
// SNI 1726:2019 Tabel 8 & 9 (+ §6.5 S1 ≥ 0,75)
export function sdc(SDS, SD1, S1, risk) {
  const iv = risk === "IV", ord = "ABCDEF"
  const a = SDS < 0.167 ? "A" : SDS < 0.33 ? (iv ? "C" : "B") : SDS < 0.5 ? (iv ? "D" : "C") : "D"
  const b = SD1 < 0.067 ? "A" : SD1 < 0.133 ? (iv ? "C" : "B") : SD1 < 0.2 ? (iv ? "D" : "C") : "D"
  let c = ord.indexOf(a) > ord.indexOf(b) ? a : b
  if (S1 >= 0.75) c = iv ? "F" : "E"
  return c
}
// ds: data tanah lain (mis. data tanah modul) untuk kelas situs otomatis; bawaan = data tanah proyek
export function seisSite(P, ds) {
  const s = P.seis, sc = siteClass(ds || soilDS(P))
  const cls = s.clsMode === "auto" ? sc.cls : s.cls
  const sp = seismicParams(s.Ss, s.S1, cls)
  const Ie = RISK_IE[s.risk] ?? 1.0
  return { Ss: s.Ss, S1: s.S1, TL: s.TL, cls, auto: s.clsMode === "auto", sc, sp, Ie, risk: s.risk, SDC: sdc(sp.SDS, sp.SD1, s.S1, s.risk) }
}
// Spektrum respons desain SNI 1726:2019 §6.4
export function spectrum(sp, TL, Tmax = 4, n = 120) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const T = Tmax * i / n
    let Sa
    if (T < sp.T0) Sa = sp.SDS * (0.4 + 0.6 * T / Math.max(sp.T0, 1e-9))
    else if (T <= sp.Ts) Sa = sp.SDS
    else if (T <= TL) Sa = sp.SD1 / T
    else Sa = sp.SD1 * TL / (T * T)
    pts.push([T, Sa])
  }
  return pts
}

// ---------------------------------------------------------------- alur proyek (stepper) untuk semua tab
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
export const STEPS = () => [
  { r: "tanah", ic: "soil", t: L("Data Tanah", "Soil Data") },
  { r: "gempa", ic: "seismic", t: L("Gempa", "Seismic") },
  { r: "desain", ic: "design", t: L("Desain", "Design") },
  { r: "penurunan", ic: "settle", t: L("Penurunan", "Settlement") },
  { r: "laporan", ic: "report", t: L("Laporan", "Report") },
]
export function stepSubs(P) {
  const ds = soilDS(P), ss = seisSite(P)
  return {
    tanah: P.soils.length > 1 ? `${P.soils.length} ${L("titik", "points")} · ★ ${P.soil.name || "BH"}` : `${P.soil.name || "BH"} · ${P.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${ds.layers.length} ${L("lapis", "layers")}`,
    gempa: `${L("Kelas", "Class")} ${ss.cls} · SDS ${nf(ss.sp.SDS, 3)}`,
    desain: L("5 kalkulator", "5 calculators"),
    penurunan: `${L("izin", "allow.")} ${nf(P.settle.allow, 0)} / ${nf(P.settle.allowDeep, 0)} mm`,
    laporan: "PDF · Excel",
  }
}
export function stepper(active, P) {
  const nav = el("nav", "pj-steps dz-in"), subs = P ? stepSubs(P) : {}
  nav.setAttribute("aria-label", L("Alur proyek", "Project workflow"))
  const steps = STEPS(), ai = steps.findIndex((s) => s.r === active)
  steps.forEach((s, i) => {
    const a = el("a", "pj-step" + (s.r === active ? " on" : "") + (ai >= 0 && i < ai ? " done" : ""))
    a.href = "#/" + s.r
    a.style.setProperty("--i", i)
    const icw = el("span", "pj-ic"); icw.append(ico(s.ic))
    a.append(el("span", "pj-n", String(i + 1)), icw)
    const tx = el("span", "pj-tx"); tx.append(el("b", null, s.t)); if (subs[s.r]) tx.append(el("small", null, subs[s.r]))
    a.append(tx)
    nav.append(a)
  })
  return nav
}
