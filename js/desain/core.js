// Inti modul "Desain Pondasi": bahasa, satuan, angin (SNI 1727:2020 = ASCE 7-16 Bab 26–29), gempa (SNI 1726:2019 = ASCE 7-16 Bab 11–15),
// dan kombinasi beban (SNI 1727:2020 §2.3/§2.4 + beban proses PIP STC01015 + mesin ACI 351.3R). Fungsi murni tanpa DOM.
// Satuan internal: kN, m, kPa, kN·m; mutu bahan MPa; dimensi penampang mm.

export const G = 9.81
export const GAMMA_W = 9.81
export const GAMMA_C = 24.0
export const GAMMA_S = 77.0                 // berat isi baja (kN/m³)
export const TF = 9.80665                   // 1 tf = 9,80665 kN

// ---------------------------------------------------------------- bahasa: L(id, en)
export const lang = { cur: "id" }
export const L = (id, en) => (lang.cur === "en" ? (en ?? id) : id)

// ---------------------------------------------------------------- satuan tampilan (nilai internal selalu SI)
export const UNITS = {
  si: { F: ["kN", 1], M: ["kN·m", 1], Mm: ["kN·m/m", 1], Q: ["kPa", 1], W: ["kN/m", 1], G: ["kN/m³", 1] },
  t: { F: ["tf", TF], M: ["tf·m", TF], Mm: ["tf·m/m", TF], Q: ["t/m²", TF], W: ["tf/m", TF], G: ["t/m³", TF] },
}
export const units = { sys: "si" }
export const uName = (k) => (UNITS[units.sys][k] ? UNITS[units.sys][k][0] : k)
export const uFac = (k) => (UNITS[units.sys][k] ? UNITS[units.sys][k][1] : 1)
export const toDisp = (k, v) => v / uFac(k)
export const fromDisp = (k, v) => v * uFac(k)

// ---------------------------------------------------------------- angka
export function nf(x, d = 2) {
  if (x === Infinity) return "∞"
  if (x === -Infinity) return "−∞"
  if (x == null || Number.isNaN(x)) return "–"
  const s = (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d)
  return s === "-0" || /^-0\.0*$/.test(s) ? s.slice(1) : s
}
export const nd = (k, v, d = 2) => nf(toDisp(k, v), d)                  // angka dalam satuan tampilan
export const ndu = (k, v, d = 2) => `${nd(k, v, d)} ${uName(k)}`
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
export const deg = (r) => r * 180 / Math.PI
export const rad = (d) => d * Math.PI / 180
export function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0]
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1])
  return ys[ys.length - 1]
}

// ---------------------------------------------------------------- tulangan (SNI 2052 / ASTM A615M): diameter nominal (mm)
export const BARS = [10, 13, 16, 19, 22, 25, 29, 32, 36]
export const barA = (d) => Math.PI * d * d / 4

// ---------------------------------------------------------------- angin: SNI 1727:2020 / ASCE 7-16
const EXPO = { B: [7.0, 365.76], C: [9.5, 274.32], D: [11.5, 213.36] }
// Koefisien tekanan velositas Kz (Tabel 26.10-1, rumus catatan): z < 4,6 m memakai z = 4,6 m
export function kz(z, exp = "C") {
  const [a, zg] = EXPO[exp] || EXPO.C
  return 2.01 * Math.pow(clamp(Math.max(z, 4.6), 0, zg) / zg, 2 / a)
}
// qz (kPa) = 0,613·Kz·Kzt·Kd·Ke·V² (N/m²), V = kecepatan angin dasar 3 detik (m/s)
export const qz = (V, z, w) => 0.613 * kz(z, w.exp) * (w.Kzt ?? 1) * (w.Kd ?? 0.95) * (w.Ke ?? 1) * V * V / 1000
// Cf (Gambar 29.4-1) penampang bulat agak halus (D√qz > 2,5) dan persegi tegak lurus muka; h/D = 1, 7, 25
export const cfRound = (hD) => interp([1, 7, 25], [0.5, 0.6, 0.7], hD)
export const cfRoundRough = (hD) => interp([1, 7, 25], [0.7, 0.8, 0.9], hD)
export const cfSquare = (hD) => interp([1, 7, 25], [1.3, 1.4, 2.0], hD)
// Gaya angin pada benda tegak (lebar efektif b) dari elevasi z0 sampai z0 + H di atas tanah, diintegrasikan per pias (§29.4: qz pada titik berat pias).
// Hasil: F (kN), M terhadap dasar benda (kN·m), lengan, qh (kPa di puncak)
export function windOnBody(w, b, z0, H, Cf, n = 24) {
  let F = 0, M = 0
  const dz = H / n
  for (let i = 0; i < n; i++) {
    const zc = z0 + (i + 0.5) * dz
    const f = qz(w.V, zc, w) * (w.G ?? 0.85) * Cf * b * dz
    F += f; M += f * (i + 0.5) * dz
  }
  return { F, M, arm: F > 0 ? M / F : 0, qh: qz(w.V, z0 + H, w) }
}

// ---------------------------------------------------------------- gempa: SNI 1726:2019 (Tabel 6 dan 7 = ASCE 7-16 Tabel 11.4-1/-2)
const SS_X = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5]
const S1_X = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
const FA = { SA: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], SB: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9], SC: [1.3, 1.3, 1.2, 1.2, 1.2, 1.2], SD: [1.6, 1.4, 1.2, 1.1, 1.0, 1.0], SE: [2.4, 1.7, 1.3, 1.1, 0.9, 0.8] }
const FV = { SA: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], SB: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], SC: [1.5, 1.5, 1.5, 1.5, 1.5, 1.4], SD: [2.4, 2.2, 2.0, 1.9, 1.8, 1.7], SE: [4.2, 3.3, 2.8, 2.4, 2.2, 2.0] }
export const SITES = ["SA", "SB", "SC", "SD", "SE"]
export function seismicParams(Ss, S1, site) {
  const Fa = interp(SS_X, FA[site] || FA.SD, Ss), Fv = interp(S1_X, FV[site] || FV.SD, S1)
  const SMS = Fa * Ss, SM1 = Fv * S1
  const SDS = 2 / 3 * SMS, SD1 = 2 / 3 * SM1
  const T0 = SDS > 0 ? 0.2 * SD1 / SDS : 0, Ts = SDS > 0 ? SD1 / SDS : 0
  return { Fa, Fv, SMS, SM1, SDS, SD1, T0, Ts }
}
// Koefisien geser dasar struktur nongedung. method "rigid": T < 0,06 dtk → 0,30·SDS·Ie (§15.4.2); "cs": Cs = SDS/(R/Ie) dengan batas §15.4.1(2)
export function seismicCoef(p) {
  const { SDS, SD1, S1, R, Ie, T, method } = p
  if (method === "rigid") return { Cs: 0.30 * SDS * Ie, rule: "0,30·SDS·Ie (T < 0,06 s)" }
  let Cs = SDS / (R / Ie), rule = "SDS/(R/Ie)"
  if (T > 0) { const cmax = SD1 / (T * (R / Ie)); if (Cs > cmax) { Cs = cmax; rule = "SD1/(T·R/Ie)" } }
  let cmin = Math.max(0.044 * SDS * Ie, 0.03)
  if (S1 >= 0.6) cmin = Math.max(cmin, 0.8 * S1 / (R / Ie))
  if (Cs < cmin) { Cs = cmin; rule = "Cs min (§15.4.1)" }
  return { Cs, rule }
}

// ---------------------------------------------------------------- kombinasi beban
// Tipe beban dasar: D (mati: struktur + peralatan kosong + pondasi), Do (isi operasi), Dt (isi uji hidrostatik), L (hidup/platform), T (termal/gesek pipa),
// W (angin; kasus Wx & Wy), Wp (angin parsial saat uji = fraksi W), E (gempa horizontal; kasus Ex & Ey; Ev = koef·SDS·D otomatis), Dyn (mesin), SC (hubung singkat)
export const LOAD_KEYS = ["D", "Do", "Dt", "L", "T", "W", "E", "Wp", "Dyn", "SC"]
const C = (id, kind, nm, f, o = {}) => ({ id, kind, nm, f, ev: o.ev || 0, stab: !!o.stab, temp: !!o.temp, acc: !!o.acc, need: o.need || [], ref: o.ref || "" })
export const COMBOS = [
  C("A1", "ASD", ["Operasi", "Operating"], { D: 1, Do: 1 }, { ref: "SNI 1727:2020 §2.4.1 (1)" }),
  C("A2", "ASD", ["Operasi + hidup", "Operating + live"], { D: 1, Do: 1, L: 1 }, { need: ["L"], ref: "§2.4.1 (2)" }),
  C("A3", "ASD", ["Operasi + termal/pipa", "Operating + thermal/pipe"], { D: 1, Do: 1, T: 1 }, { need: ["T"], ref: "PIP STC01015" }),
  C("A4", "ASD", ["Operasi + angin", "Operating + wind"], { D: 1, Do: 1, W: 0.6 }, { temp: true, need: ["W"], ref: "§2.4.1 (5)" }),
  C("A5", "ASD", ["Operasi + hidup + angin", "Operating + live + wind"], { D: 1, Do: 1, L: 0.75, W: 0.45 }, { temp: true, need: ["W", "L"], ref: "§2.4.1 (6a)" }),
  C("A6", "ASD", ["Operasi + gempa", "Operating + seismic"], { D: 1, Do: 1, E: 0.7 }, { ev: 0.14, temp: true, need: ["E"], ref: "§2.4.5 (8)" }),
  C("A7", "ASD", ["Operasi + hidup + gempa", "Operating + live + seismic"], { D: 1, Do: 1, L: 0.75, E: 0.525 }, { ev: 0.105, temp: true, need: ["E", "L"], ref: "§2.4.5 (9)" }),
  C("A8", "ASD", ["Kosong + angin (stabilitas)", "Empty + wind (stability)"], { D: 0.6, W: 0.6 }, { stab: true, temp: true, need: ["W"], ref: "§2.4.1 (7)" }),
  C("A9", "ASD", ["Operasi + gempa (stabilitas)", "Operating + seismic (stability)"], { D: 0.6, Do: 0.6, E: 0.7 }, { ev: -0.14, stab: true, temp: true, need: ["E"], ref: "§2.4.5 (10)" }),
  C("A10", "ASD", ["Uji hidrostatik + angin parsial", "Hydrotest + partial wind"], { D: 1, Dt: 1, Wp: 0.6 }, { temp: true, need: ["Dt"], ref: "PIP STC01015" }),
  C("A11", "ASD", ["Operasi + dinamis", "Operating + dynamic"], { D: 1, Do: 1, Dyn: 1 }, { need: ["Dyn"], ref: "ACI 351.3R" }),
  C("A12", "ASD", ["Operasi + dinamis + gempa", "Operating + dynamic + seismic"], { D: 1, Do: 1, Dyn: 1, E: 0.7 }, { ev: 0.14, temp: true, need: ["Dyn", "E"], ref: "ACI 351.3R" }),
  C("A13", "ASD", ["Hubung singkat (aksidental)", "Short circuit (accidental)"], { D: 1, Do: 1, SC: 1 }, { temp: true, acc: true, need: ["SC"], ref: "ACI 351.3R" }),
  C("U1", "LRFD", ["1,4D", "1.4D"], { D: 1.4, Do: 1.4 }, { ref: "SNI 1727:2020 §2.3.1 (1)" }),
  C("U2", "LRFD", ["1,2D + 1,6L", "1.2D + 1.6L"], { D: 1.2, Do: 1.2, L: 1.6 }, { need: ["L"], ref: "§2.3.1 (2)" }),
  C("U3", "LRFD", ["1,2D + 1,2T + 0,5L", "1.2D + 1.2T + 0.5L"], { D: 1.2, Do: 1.2, T: 1.2, L: 0.5 }, { need: ["T"], ref: "§2.3.4 / PIP" }),
  C("U4", "LRFD", ["1,2D + 1,0W + L", "1.2D + 1.0W + L"], { D: 1.2, Do: 1.2, W: 1.0, L: 1.0 }, { temp: true, need: ["W"], ref: "§2.3.1 (4)" }),
  C("U5", "LRFD", ["1,2D + Ev + Eh + L", "1.2D + Ev + Eh + L"], { D: 1.2, Do: 1.2, E: 1.0, L: 1.0 }, { ev: 0.2, temp: true, need: ["E"], ref: "§2.3.6 (6)" }),
  C("U6", "LRFD", ["0,9D + 1,0W (kosong)", "0.9D + 1.0W (empty)"], { D: 0.9, W: 1.0 }, { stab: true, temp: true, need: ["W"], ref: "§2.3.1 (5)" }),
  C("U7", "LRFD", ["0,9D − Ev + Eh", "0.9D − Ev + Eh"], { D: 0.9, Do: 0.9, E: 1.0 }, { ev: -0.2, stab: true, temp: true, need: ["E"], ref: "§2.3.6 (7)" }),
  C("U8", "LRFD", ["1,4(D + Dt) uji", "1.4(D + Dt) test"], { D: 1.4, Dt: 1.4 }, { need: ["Dt"], ref: "PIP STC01015" }),
  C("U9", "LRFD", ["1,2(D + Dt) + 1,0Wp uji", "1.2(D + Dt) + 1.0Wp test"], { D: 1.2, Dt: 1.2, Wp: 1.0 }, { temp: true, need: ["Dt"], ref: "PIP STC01015" }),
  C("U10", "LRFD", ["1,2D + 1,6Dyn", "1.2D + 1.6Dyn"], { D: 1.2, Do: 1.2, Dyn: 1.6 }, { need: ["Dyn"], ref: "ACI 351.3R" }),
  C("U11", "LRFD", ["1,2D + 1,0Dyn + Ev + Eh", "1.2D + 1.0Dyn + Ev + Eh"], { D: 1.2, Do: 1.2, Dyn: 1.0, E: 1.0 }, { ev: 0.2, temp: true, need: ["Dyn", "E"], ref: "ACI 351.3R" }),
  C("U12", "LRFD", ["1,2D + 1,0SC (aksidental)", "1.2D + 1.0SC (accidental)"], { D: 1.2, Do: 1.2, SC: 1.0 }, { temp: true, acc: true, need: ["SC"], ref: "ACI 351.3R" }),
]
export const comboName = (c) => L(c.nm[0], c.nm[1])
export function comboFormula(f, ev) {
  const parts = []
  const s = (x) => (Math.abs(x - 1) < 1e-12 ? "" : nf(x, Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? (Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2) : 3))
  for (const k of LOAD_KEYS) if (f[k]) parts.push(`${s(f[k])}${k}`)
  let txt = parts.join(" + ")
  if (ev) txt += ` ${ev > 0 ? "+" : "−"} ${nf(Math.abs(ev), 3)}·SDS·D`
  return txt
}

// Vektor beban generik (larik angka). cases: { kunci: larik }. Famili lateral: W → [Wx, Wy], E → [Ex, Ey], Dyn → [Dyn1, Dyn2]; Wp memakai W × wpFrac.
const FAM = { W: ["Wx", "Wy"], Wp: ["Wx", "Wy"], E: ["Ex", "Ey"], Dyn: ["Dyn1", "Dyn2"] }
const isZero = (v) => !v || v.every((x) => Math.abs(x) < 1e-12)
const addTo = (acc, v, f) => { if (v && f) for (let i = 0; i < acc.length; i++) acc[i] += f * (v[i] || 0) }
export function caseActive(cases, key) {
  if (FAM[key]) return FAM[key].some((k) => !isZero(cases[k]))
  return !isZero(cases[key])
}
// opts: SDS, wpFrac, ortho (100–30 untuk gempa), dirs ("pm" = ±x, ±y; "plus" = +x, +y; "x" = +x saja), labels: {Wx:"X", ...}, enabled: {id: bool}, factors: {id: {k: f}}
export function expandCombos(cases, n, opts = {}) {
  const out = []
  const dirs = opts.dirs || "pm"
  for (const tpl of COMBOS) {
    if (opts.enabled && opts.enabled[tpl.id] === false) continue
    if (opts.only && !opts.only.includes(tpl.kind)) continue
    const f = { ...tpl.f, ...((opts.factors || {})[tpl.id] || {}) }
    if (tpl.need.some((k) => !caseActive(cases, k))) continue
    const fams = ["E", "W", "Wp", "Dyn"].filter((k) => f[k] && caseActive(cases, k))
    const prim = fams[0]
    let variants = [{ tag: "", m: {} }]
    if (prim) {
      const [a, b] = FAM[prim]
      const lab = (k) => (opts.labels && opts.labels[k]) || k.replace(/^(W|E|Dyn)/, "")
      const za = isZero(cases[a]), zb = isZero(cases[b])
      variants = []
      const push = (tag, ca, cb) => variants.push({ tag, ca, cb })
      if (!za) { push(`+${lab(a)}`, 1, 0); if (dirs === "pm") push(`−${lab(a)}`, -1, 0) }
      if (!zb && dirs !== "x") { push(`+${lab(b)}`, 0, 1); if (dirs === "pm") push(`−${lab(b)}`, 0, -1) }
      if (prim === "E" && opts.ortho && !za && !zb && dirs !== "x") {
        const sg = dirs === "pm" ? [1, -1] : [1]
        for (const s1 of sg) for (const s2 of [1, -1]) {
          push(`${s1 > 0 ? "+" : "−"}${lab(a)}${s2 > 0 ? "+" : "−"}0,3${lab(b)}`, s1, 0.3 * s2)
          push(`${s1 > 0 ? "+" : "−"}${lab(b)}${s2 > 0 ? "+" : "−"}0,3${lab(a)}`, 0.3 * s2, s1)
        }
      }
      if (!variants.length) continue
    }
    variants.forEach((vr, vi) => {
      const v = new Array(n).fill(0)
      const evc = tpl.ev * (opts.SDS || 0)
      const fD = (f.D || 0) ? f.D + evc : 0
      const fac = { D: fD, Do: (f.Do || 0) ? f.Do + evc : 0, Dt: (f.Dt || 0) ? f.Dt + evc : 0, L: f.L || 0, T: f.T || 0, SC: f.SC || 0 }
      for (const k of ["D", "Do", "Dt", "L", "T", "SC"]) addTo(v, cases[k], fac[k])
      for (const fam of fams) {
        const [a, b] = FAM[fam]
        const scale = (f[fam] || 0) * (fam === "Wp" ? (opts.wpFrac ?? 0.5) : 1)
        let ca = vr.ca ?? 0, cb = vr.cb ?? 0
        if (fam !== prim) {                                        // famili kedua (mis. Dyn bersama E): kasus pertamanya yang tidak nol, tanda sama dengan varian utama
          const sgn = (vr.ca || 0) + (vr.cb || 0) >= 0 ? 1 : -1
          if (!isZero(cases[a])) { ca = sgn; cb = 0 } else { ca = 0; cb = sgn }
        }
        addTo(v, cases[a], scale * ca); addTo(v, cases[b], scale * cb)
      }
      out.push({ id: tpl.id + (vr.tag ? " " + vr.tag : ""), base: tpl.id, kind: tpl.kind, name: comboName(tpl), tag: vr.tag, ref: tpl.ref, temp: tpl.temp, stab: tpl.stab, acc: tpl.acc,
        fD, ev: evc, f, formula: comboFormula(f, tpl.ev), vec: v })
    })
  }
  return out
}

// ---------------------------------------------------------------- pemeriksaan: [kelompok, butir, referensi, demand, kapasitas, satuan, rasio, ok, catatan]
export function chk(grp, item, ref, dem, cap, unit, opts = {}) {
  // opts.mode: "le" (dem ≤ cap, rasio = dem/cap), "ge" (dem ≥ cap: nilai ≥ syarat, rasio = cap/dem), "bool"
  const mode = opts.mode || "le"
  let ur, ok
  if (mode === "bool") { ok = !!dem; ur = ok ? 0 : 1.5 }
  else if (mode === "ge") { ur = dem > 0 ? cap / dem : (cap > 0 ? Infinity : 0); ok = dem >= cap - 1e-9 }
  else { ur = cap > 0 ? Math.abs(dem) / cap : (Math.abs(dem) > 1e-9 ? Infinity : 0); ok = Math.abs(dem) <= cap + 1e-9 * Math.max(1, Math.abs(cap)) }
  if (opts.ok !== undefined) ok = opts.ok
  return { grp, item, ref, dem, cap, unit, ur, ok, mode, note: opts.note || "", d: opts.d ?? 2, info: !!opts.info }
}
export const govern = (checks) => checks.filter((c) => !c.info).reduce((g, c) => (!g || (isFinite(c.ur) ? c.ur : 99) > (isFinite(g.ur) ? g.ur : 99) ? c : g), null)

// Tanggal dan jam untuk hak cipta laporan: DD/MM/YYYY - HH:MM
export function stamp(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0")
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} - ${p(d.getHours())}:${p(d.getMinutes())}`
}
export const AUTHOR = "Yan Malegi Diardi"
export const copyright = (d) => `© ${AUTHOR} (${stamp(d)})`
