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

// ---------------------------------------------------------------- parameter turunan tiap lapis
export function deriveSoil(soil) {
  const out = [], gwt = soil.gwt ?? 99
  let z = 0, sv = 0, svp = 0
  for (const ly of soil.layers) {
    const h = Math.max(ly.h, 0.01), z0 = z, z1 = z + h, zm = (z0 + z1) / 2
    const inc = (zz) => { const dry = clamp(Math.min(zz, gwt) - z0, 0, h), wet = clamp(zz - Math.max(z0, gwt), 0, h); return [ly.g * dry + ly.gsat * wet, ly.g * dry + (ly.gsat - GAMMA_W) * wet] }
    const [tm, em] = inc(zm), [tb, eb] = inc(z1)
    const svm = sv + tm, svpm = Math.max(svp + em, 1)
    const coh = cohesive(ly.type)
    let N60 = ly.N > 0 ? ly.N * (soil.Er ?? 60) / 60 : 0, qc = ly.qc > 0 ? ly.qc : 0
    const useCpt = soil.test === "cpt" && qc > 0
    if (!N60 && qc) N60 = qc / QC_N[ly.type]
    if (!qc && N60) qc = QC_N[ly.type] * N60
    const N1 = N60 * Math.min(Math.sqrt(100 / svpm), 1.7)                                  // Liao & Whitman
    const d = { cu: 0, phi: 0, E: 0, nu: coh ? 0.45 : 0.3, e0: 0, Cc: 0, Cs: 0, OCR: 1, cv: coh ? 2 : 0, Ca: 0 }
    const src = {}
    if (coh) {
      d.cu = Math.max(5, useCpt ? (qc * 1000 - svm) / (soil.Nkt || 15) : (ly.type === "silt" ? 5 : 6) * N60)   // Lunne et al.; Stroud (1974)
      d.E = (ly.type === "silt" ? 250 : 300) * d.cu                                        // Duncan & Buchignani (Eu/cu, PI menengah)
      d.e0 = clamp(((soil.Gs || 2.7) * GAMMA_W - ly.gsat) / Math.max(ly.gsat - GAMMA_W, 0.5), 0.3, 3)
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
    out.push({ ...ly, h, z0, z1, zm, sv: svm, svp: svpm, N60, N1, qcE: qc, coh, ...d, auto, src })
    sv += tb; svp += eb; z = z1
  }
  return { layers: out, gwt, depth: z, test: soil.test, name: soil.name, Er: soil.Er, Nkt: soil.Nkt }
}
export const layerAt = (ds, z) => ds.layers.find((l) => z < l.z1) || ds.layers[ds.layers.length - 1]
// tegangan vertikal total dan efektif pada kedalaman z (lapis terakhir diperpanjang)
export function stressAt(ds, z) {
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

// ---------------------------------------------------------------- kelas situs SNI 1726:2019 Tabel 5 (N̄ pada 30 m teratas)
export function siteClass(ds) {
  let sumD = 0, sumDN = 0, soft = 0
  for (const l of ds.layers) {
    const h = Math.max(0, Math.min(30, l.z1) - l.z0)
    if (h > 0) { sumD += h; sumDN += h / Math.max(l.N60, 1) }
    if (l.coh && l.cu < 25 && l.z0 < 30) soft += Math.min(l.z1, 30) - l.z0
  }
  const extra = Math.max(0, 30 - sumD)
  if (extra > 0) { sumDN += extra / Math.max(ds.layers[ds.layers.length - 1].N60, 1); sumD = 30 }
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
    const sq = 1 + r * tp, sg = Math.max(1 - 0.4 * r, 0.6), dq = 1 + 2 * tp * (1 - Math.sin(rad(phi))) ** 2 * Math.min(Df / b, 1)
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
  const zt = z0 + Lp, lt = layerAt(ds, zt - 1e-6), [, svT] = stressAt(ds, zt)
  let q
  if (method === "spt") q = lt.coh ? 9 * lt.cu : Math.min((bored ? 13 : 40) * lt.N60 * Lp / D, (bored ? 130 : 400) * lt.N60)
  else if (method === "cpt") q = (lt.coh ? (bored ? 0.375 : 0.55) : (bored ? 0.15 : 0.4)) * lt.qcE * 1000
  else if (bored) q = lt.coh ? Math.min(9 * lt.cu, 3800) : Math.min(57.5 * lt.N60, 2900)
  else q = lt.coh ? 9 * lt.cu : Math.min(apiSand(lt.phi).Nq * svT, apiSand(lt.phi).qlim)
  const Ag = Math.PI * D * D / 4, Aan = bored ? Ag : Math.PI * (D * D - Di * Di) / 4
  const plugQ = Qso + q * Ag, unplugQ = Qso + Qsi + q * Aan
  const Qc = open ? Math.min(plugQ, unplugQ) : plugQ
  const plugged = !open || plugQ <= unplugQ
  const wet = Math.max(0, Math.min(Lp, zt - Math.max(z0, ds.gwt)))
  const Wp = bored ? GAMMA_C * Ag * Lp - GAMMA_W * Ag * wet : GAMMA_S * Aan * Lp - GAMMA_W * Aan * wet
  const Qt = (bored ? 0.75 : 1) * Qso + Wp
  return { Qso, Qsi, q, Qb: plugged ? q * Ag : q * Aan, plugged, Qc, Qt, Wp, prof, tip: { type: lt.type, coh: lt.coh, z: zt, svp: svT }, method, Ag, Aan, D, Lp, z0, bored }
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
