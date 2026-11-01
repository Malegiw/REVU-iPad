// Data proyek bersama untuk alur Tanah → Gempa → Desain → Penurunan → Laporan: info proyek, data tanah (N-SPT/CPT), parameter gempa,
// metode daya dukung, dan kriteria penurunan. Disimpan di localStorage ("ymd.project.v1"); semua tab membaca dari sini.
import { L, AUTHOR, seismicParams, nf } from "./desain/core.js"
import { defaultSoil, deriveSoil, siteClass, SETTLE_OPT, OVR } from "./desain/soil.js"

const KEY = "ymd.project.v1"
export const RISK_IE = { I: 1.0, II: 1.0, III: 1.25, IV: 1.5 }
export function projDefaults() {
  return {
    info: { name: "Project A", client: "", loc: "", doc: "", rev: "0", eng: AUTHOR, chk: "" },
    soil: defaultSoil(),
    bear: { method: "spt", FS: 3, Df: 1.5, B: 2.5 },
    pile: { kind: "pipe", D: 406.4, t: 12.7, method: "api", z0: 1.5, Lmax: 30 },
    seis: { Ss: 0.8, S1: 0.35, TL: 8, clsMode: "auto", cls: "SD", risk: "III" },
    settle: { ...SETTLE_OPT, manual: [], sel: "" },
  }
}
const okNum = (v) => typeof v === "number" && isFinite(v)
export function projLoad() {
  const d = projDefaults()
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
    return d
  }
  const soil = { ...d.soil, ...(s.soil || {}) }
  if (!Array.isArray(soil.layers) || !soil.layers.length) soil.layers = d.soil.layers
  soil.layers = soil.layers.map((l) => ({ ...d.soil.layers[0], ...Object.fromEntries(OVR.map((k) => [k, 0])), ...l }))
  return { info: { ...d.info, ...(s.info || {}) }, soil, bear: { ...d.bear, ...(s.bear || {}) }, pile: { ...d.pile, ...(s.pile || {}) }, seis: { ...d.seis, ...(s.seis || {}) },
    settle: { ...d.settle, ...(s.settle || {}), manual: Array.isArray((s.settle || {}).manual) ? s.settle.manual : [] } }
}
export const projSave = (P) => { try { localStorage.setItem(KEY, JSON.stringify(P)) } catch (e) { /* tanpa penyimpanan */ } }

let memo = { k: "", v: null }
export function soilDS(P) {
  const k = JSON.stringify(P.soil)
  if (memo.k !== k) memo = { k, v: deriveSoil(P.soil) }
  return memo.v
}
// SNI 1726:2019 Tabel 8 & 9 (+ §6.5 S1 ≥ 0,75)
export function sdc(SDS, SD1, S1, risk) {
  const iv = risk === "IV", ord = "ABCDEF"
  const a = SDS < 0.167 ? "A" : SDS < 0.33 ? (iv ? "C" : "B") : SDS < 0.5 ? (iv ? "D" : "C") : "D"
  const b = SD1 < 0.067 ? "A" : SD1 < 0.133 ? (iv ? "C" : "B") : SD1 < 0.2 ? (iv ? "D" : "C") : "D"
  let c = ord.indexOf(a) > ord.indexOf(b) ? a : b
  if (S1 >= 0.75) c = iv ? "F" : "E"
  return c
}
export function seisSite(P) {
  const s = P.seis, sc = siteClass(soilDS(P))
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
  { r: "tanah", ic: "🧱", t: L("Data Tanah", "Soil Data") },
  { r: "gempa", ic: "🌐", t: L("Gempa", "Seismic") },
  { r: "desain", ic: "🏗️", t: L("Desain", "Design") },
  { r: "penurunan", ic: "📉", t: L("Penurunan", "Settlement") },
  { r: "laporan", ic: "📑", t: L("Laporan", "Report") },
]
export function stepSubs(P) {
  const ds = soilDS(P), ss = seisSite(P)
  return {
    tanah: `${P.soil.name || "BH"} · ${P.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${ds.layers.length} ${L("lapis", "layers")}`,
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
    a.append(el("span", "pj-n", String(i + 1)), el("span", "pj-ic", s.ic))
    const tx = el("span", "pj-tx"); tx.append(el("b", null, s.t)); if (subs[s.r]) tx.append(el("small", null, subs[s.r]))
    a.append(tx)
    nav.append(a)
  })
  return nav
}
