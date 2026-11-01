// Pondasi tangki timbun dasar datar (Wash Tank / Surge Tank): berat tangki, angin (SNI 1727:2020 Bab 29 + stabilitas API 650 §5.11.2),
// gempa API 650 Annex E (massa impulsif/konvektif, Mrw, Ms, rasio angkur J, geser, sloshing), lalu pondasi:
// - Ringwall (PIP STE03020): tekanan di bawah ringwall, tarik melingkar (hoop) dan tulangannya, telapak ringwall (opsional), pad kolom atap (pons).
// - Pelat penuh: pelat lingkaran kaku (tekanan tanpa tarik), lentur kantilever dan interior (Timoshenko: pelat lingkaran sendi), geser satu arah, pons kolom atap.
// Gaya API 650 Annex E bertaraf ASD; kasus E disimpan sebagai E = gaya API / 0,7 supaya kombinasi 0,7E mengembalikan nilai API.
import { L, chk, GAMMA_W, GAMMA_C, GAMMA_S, windOnBody, cfRound, qz, kdF, rad } from "./core.js"
import { asFlex, pickBars, phiMn, rhoTS, vcOne, vcTwo } from "./rc.js"
import { makeGeo, planPoly, pressure, contactChecks } from "./footing.js"
import { piledSlab } from "./deep.js"

export const PRESETS = {
  wash: { D: 10.0, Hs: 9.76, H: 8.5, SG: 1.0, Ht: 9.5, tShell: 7, tBot: 8, tRoof: 6, slope: 9.5, roof: "col", nCol: 1, colB: 0.45, colFrac: 0.45, Wacc: 60, Lr: 1.0 },
  surge: { D: 6.0, Hs: 7.32, H: 6.2, SG: 0.9, Ht: 7.0, tShell: 6, tBot: 6, tRoof: 5, slope: 9.5, roof: "self", nCol: 0, colB: 0.4, colFrac: 0, Wacc: 30, Lr: 1.0 },
}

export function tankLoads(I) {
  const A = Math.PI * I.D * I.D / 4
  const Ws = Math.PI * I.D * I.Hs * I.tShell / 1000 * GAMMA_S
  const Wb = A * I.tBot / 1000 * GAMMA_S
  const hr = I.D / 2 * Math.tan(rad(I.slope))
  const Wr = A / Math.cos(rad(I.slope)) * I.tRoof / 1000 * GAMMA_S * (I.roof === "col" ? 1.25 : 1.10)
  const LrT = I.Lr * A
  const cf = I.roof === "col" && I.nCol > 0 ? I.colFrac : 0
  const wD = (Ws + I.Wacc + Wr * (1 - cf)) / (Math.PI * I.D), wL = LrT * (1 - cf) / (Math.PI * I.D)
  const PcD = cf ? Wr * cf / I.nCol : 0, PcL = cf ? LrT * cf / I.nCol : 0
  const Wp = GAMMA_W * I.SG * A * I.H, Wt = GAMMA_W * A * I.Ht
  const pOp = GAMMA_W * I.SG * I.H, pTest = GAMMA_W * I.Ht
  // angin
  const w = I.wind
  const Cf = cfRound(I.Hs / I.D)
  const sh = windOnBody(w, I.D, I.z0, I.Hs, Cf)
  const qTop = qz(w.V, I.z0 + I.Hs + hr, w)
  const Fr = qTop * kdF(w) * (w.G ?? 0.85) * Cf * I.D * hr / 2
  const Fw = sh.F + Fr, Mw = sh.M + Fr * (I.Hs + hr / 3)
  const MDL = (Ws + I.Wacc) * I.D / 2, MDLR = Wr * (1 - cf) * I.D / 2
  const urWind = 0.6 * Mw / (MDL / 1.5 + MDLR)
  // gempa API 650 Annex E
  const s = seismicAPI(I, Ws, Wr, Wb, Wp, hr)
  return { A, Ws, Wb, Wr, hr, LrT, cf, wD, wL, PcD, PcL, Wp, Wt, pOp, pTest, Cf, Fw, Mw, MDL, MDLR, urWind, s }
}

export function seismicAPI(I, Ws, Wr, Wb, Wp, hr) {
  const D = I.D, H = I.H, DH = D / H, S = I.seis
  if (!(S.SDS > 0)) return null
  const Wi = DH >= 1.333 ? Math.tanh(0.866 * DH) / (0.866 * DH) * Wp : (1 - 0.218 * DH) * Wp
  const Wc = 0.230 * DH * Math.tanh(3.67 / DH) * Wp
  const Xi = DH >= 1.333 ? 0.375 * H : (0.5 - 0.094 * DH) * H
  const a = 3.67 / DH
  const Xc = (1 - (Math.cosh(a) - 1) / (a * Math.sinh(a))) * H
  const Xis = DH >= 1.333 ? 0.375 * (1 + 1.333 * (0.866 * DH / Math.tanh(0.866 * DH) - 1)) * H : (0.5 + 0.06 * DH) * H
  const Xcs = (1 - (Math.cosh(a) - 1.937) / (a * Math.sinh(a))) * H
  const Ks = 0.578 / Math.sqrt(Math.tanh(3.68 * H / D)), Tc = 1.8 * Ks * Math.sqrt(D)
  const Rwi = S.anchored ? 4.0 : 3.5, Rwc = 2.0, Ie = S.Ie, K = 1.5
  let Ai = Math.max(S.SDS * Ie / Rwi, 0.007)
  if (S.S1 >= 0.6) Ai = Math.max(Ai, 0.5 * S.S1 * Ie / Rwi)
  let Ac = Tc <= S.TL ? K * S.SD1 / Tc * Ie / Rwc : K * S.SD1 * S.TL / (Tc * Tc) * Ie / Rwc
  Ac = Math.min(Ac, Ai)
  const Xs = I.Hs / 2, Xr = I.Hs + hr / 3
  const Vi = Ai * (Ws + Wr + Wb + Wi), Vc = Ac * Wc, V = Math.hypot(Vi, Vc)
  const Mrw = Math.hypot(Ai * (Wi * Xi + Ws * Xs + Wr * Xr), Ac * Wc * Xc)
  const Ms = Math.hypot(Ai * (Wi * Xis + Ws * Xs + Wr * Xr), Ac * Wc * Xcs)
  const Av = 0.14 * S.SDS
  // rasio angkur J (§E.6.2.1.1): satuan N, m
  const Ge = I.SG * (1 - 0.4 * Av)
  const wa = Math.min(99 * I.tBot * Math.sqrt(250 * H * Ge), 201.1 * H * D * Ge)
  const wt = (Ws * 1000) / (Math.PI * D) + (Wr * 1000) / (Math.PI * D)
  const J = Mrw * 1000 / (D * D * (wt * (1 - 0.4 * Av) + wa))
  const slideR = 0.4 * (Ws + Wr + Wb + Wp) * (1 - 0.4 * Av)
  const Af = Tc <= 4 ? K * S.SD1 * Ie / Tc : K * S.SD1 * 4 * Ie / (Tc * Tc)
  const slosh = 0.42 * D * Af
  return { DH, Wi, Wc, Xi, Xc, Xis, Xcs, Ks, Tc, Rwi, Rwc, Ai, Ac, Vi, Vc, V, Mrw, Ms, Av, J, wa, wt, slideR, Af, slosh }
}

// Vektor kasus tangki: [w garis shell (kN/m), Mring (kN·m), Mslab (kN·m), V (kN), p cairan (kPa), P kolom atap (kN)]
export function tankCases(I, T) {
  const z = [0, 0, 0, 0, 0, 0]
  const c = { D: [T.wD, 0, 0, 0, 0, T.PcD], Do: [0, 0, 0, 0, T.pOp, 0], Dt: [0, 0, 0, 0, T.pTest, 0], L: [T.wL, 0, 0, 0, 0, T.PcL], Wx: [0, T.Mw, T.Mw, T.Fw, 0, 0], Wy: z }
  if (T.s) { c.Ex = [0, T.s.Mrw / 0.7, T.s.Ms / 0.7, T.s.V / 0.7, 0, 0]; c.Ey = z }
  return c
}

export function analyzeTank(I, combos) {
  const T = tankLoads(I)
  const checks = []
  const gT = L("Tangki (API 650)", "Tank (API 650)"), gG = L("Geoteknik & stabilitas (ASD)", "Geotechnical & stability (ASD)"), gR = L("Beton pondasi (LRFD)", "Foundation concrete (LRFD)")
  const type = I.fdType === "deep" && I.soilDS ? "piled" : I.found === "auto" ? (I.D <= I.dLim ? "slab" : "ring") : I.found
  checks.push(chk(gT, L("Stabilitas angin tangki kosong tanpa angkur: 0,6Mw ≤ MDL/1,5 + MDLR", "Wind stability, unanchored empty tank: 0.6Mw ≤ MDL/1.5 + MDLR"), "API 650 §5.11.2 (a)", T.urWind, 1, "", { d: 3 }))
  if (T.s) {
    const s = T.s
    checks.push(chk(gT, L(`Rasio angkur J (${s.J <= 0.785 ? "tanpa angkat" : s.J <= 1.54 ? "angkat, swa-angkur boleh" : "perlu angkur"})`, `Anchorage ratio J (${s.J <= 0.785 ? "no uplift" : s.J <= 1.54 ? "uplift, self-anchored OK" : "anchors required"})`), "API 650 §E.6.2.1.1", s.J, I.seis.anchored ? 99 : 1.54, "", { d: 3 }))
    checks.push(chk(gT, L("Geser dasar gempa ≤ tahanan gesek (μ = 0,4)", "Seismic base shear ≤ friction resistance (μ = 0.4)"), "API 650 §E.7.6", s.V, s.slideR, "F", { d: 1 }))
    checks.push(chk(gT, L("Tinggi gelombang sloshing ≤ ruang bebas (Hs − H)", "Sloshing wave height ≤ freeboard (Hs − H)"), "API 650 §E.7.2", s.slosh, I.Hs - I.H, "m", { d: 2 }))
  }
  const R = type === "piled" ? piledTank(I, T, combos) : type === "ring" ? ringwall(I, T, combos) : slab(I, T, combos)
  for (const c of R.checks) checks.push({ ...c, grp: c.grp === "G" ? gG : c.grp === "S" ? gR : c.grp })
  return { T, type, R, checks }
}

const asdOf = (combos) => combos.filter((c) => c.kind === "ASD")
const lrfdOf = (combos) => combos.filter((c) => c.kind === "LRFD")

// ---------------------------------------------------------------- ringwall
function ringwall(I, T, combos) {
  const out = [], D = I.D, b = I.rb, hr = I.rh, bf = Math.max(I.rbf || 0, b), tf = bf > b ? I.rtf : 0
  const wrw = b * hr * GAMMA_C + (bf - b) * tf * GAMMA_C
  const q4 = (M) => 4 * M / (Math.PI * D * D)
  const asd = asdOf(combos).map((c) => {
    const [w, Mr, , V, p] = c.vec
    const lineMax = w + q4(Mr), lineMin = w - q4(Mr)
    const q = (lineMax + p * b / 2 + c.fD * wrw) / bf
    const qa = I.qa * (c.temp ? (I.tempFac ?? 1) : 1)
    const qin = p + c.fD * T.Wb / T.A + I.hpad * I.gpad
    return { c, q, qa, lineMax, lineMin, qin, V, ok: q <= qa + 1e-9 }
  })
  const wq = asd.reduce((a, r) => (r.q / r.qa > a.q / a.qa ? r : a), asd[0])
  out.push(chk("G", L("Tekanan di bawah ringwall ≤ daya dukung izin", "Pressure under ringwall ≤ allowable bearing"), "PIP STE03020 / SNI 8460", wq.q, wq.qa, "Q", { note: wq.c.id, d: 1 }))
  const op = asd.find((r) => r.c.base === "A1") || asd[0]
  const ratio = op.q / Math.max(op.qin, 1e-6)
  out.push(chk("G", L("Keserasian tekanan ringwall/area dalam (operasi) ≈ 1 (beda penurunan)", "Ringwall/interior pressure compatibility (operating) ≈ 1 (differential settlement)"), "PIP STE03020 §4", Math.abs(ratio - 1), 0.5, "", { d: 2, info: true, note: `q_rw/q_in = ${ratio.toFixed(2)}` }))
  const noE = asd.filter((r) => !r.c.f.E)
  const upl = noE.reduce((a, r) => (r.lineMin < a.lineMin ? r : a), noE[0])
  out.push(chk("G", L("Beban garis shell minimum (non-gempa) ≥ 0 — gempa dicek dengan rasio J", "Minimum shell line load (non-seismic) ≥ 0 — seismic checked by ratio J"), "API 650 §5.12", upl.lineMin, 0, "W", { mode: "ge", note: upl.c.id, d: 2 }))
  out.push(chk("G", L("Lebar ringwall ≥ 300 mm", "Ringwall width ≥ 300 mm"), "PIP STE03020", b * 1000, 300, "mm", { mode: "ge", d: 0 }))
  // tarik melingkar: T = K(γ h²/2 + p h)·D/2, Tu = 1,6 T
  const pMax = Math.max(T.pOp, T.pTest)
  const Th = I.K0 * (I.gpad * hr * hr / 2 + pMax * hr) * D / 2
  const Tu = 1.6 * Th
  const AsH = Tu * 1000 / (0.9 * I.fy), AsHmin = 0.0025 * b * hr * 1e6
  const AsUse = Math.max(AsH, AsHmin)
  const nb = Math.max(2, Math.ceil(AsUse / (2 * Math.PI * I.dbH ** 2 / 4))) * 2
  const AsP = nb * Math.PI * I.dbH ** 2 / 4
  out.push(chk("S", L(`Tulangan hoop: As perlu ≤ As pasang (${nb} D${I.dbH}, separuh tiap muka)`, `Hoop steel: As req. ≤ As provided (${nb} D${I.dbH}, half per face)`), "PIP STE03020 / SNI 2847 §22.4", AsUse, AsP, "mm²", { d: 0, note: `Tu = ${Tu.toFixed(1)} kN` }))
  const fsServ = Th * 1000 / AsP
  out.push(chk("S", L("Tegangan baja hoop layan ≤ 0,4fy (kendali retak)", "Service hoop steel stress ≤ 0.4fy (crack control)"), "ACI 350 (praktik)", fsServ, 0.4 * I.fy, "MPa", { d: 0 }))
  // telapak ringwall (T terbalik)
  let foot = null
  if (bf > b) {
    const d = tf * 1000 - I.cover - I.db, proj = (bf - b) / 2
    let Mu = 0, Vu = 0, cm = ""
    for (const c of lrfdOf(combos)) {
      const [w, Mr, , , p] = c.vec
      const qu = (w + q4(Mr) + p * b / 2 + c.fD * wrw) / bf - c.fD * tf * GAMMA_C
      const m = qu * proj * proj / 2, v = qu * Math.max(proj - d / 1000, 0)
      if (m > Mu) { Mu = m; Vu = v; cm = c.id }
    }
    const f = asFlex(Mu, 1000, d, I.fc, I.fy), bars = pickBars(Math.max(f.As || 0, rhoTS(I.fy) * 1000 * tf * 1000), Math.min(3 * tf * 1000, 450), I.db)
    foot = { d, proj, Mu, Vu, bars }
    out.push(chk("S", L(`Lentur telapak ringwall (${bars.txt})`, `Ringwall footing flexure (${bars.txt})`), "SNI 2847 §13.2.7", Mu, phiMn(bars.As, 1000, d, I.fc, I.fy), "Mm", { note: cm, d: 1 }))
    out.push(chk("S", L("Geser satu arah telapak ringwall", "Ringwall footing one-way shear"), "SNI 2847 §22.5", Vu, 0.75 * vcOne(I.fc, 1, bars.As / (1000 * d), d) * d, "W", { note: cm, d: 1 }))
  } else out.push(chk("S", L("Geser satu arah: ringwall persegi tanpa telapak (tidak menentukan)", "One-way shear: rectangular ringwall without footing (not governing)"), "—", 0, 1, "", { info: true }))
  // tulangan vertikal/sengkang minimum
  const AsV = rhoTS(I.fy) * b * 1000 * 1000
  out.push(chk("S", L(`Sengkang/vertikal min ρ = ${rhoTS(I.fy)} (per meter keliling)`, `Min. vertical/stirrups ρ = ${rhoTS(I.fy)} (per metre)`), "SNI 2847 §24.4", AsV, AsV, "mm²", { info: true, d: 0, note: pickBars(AsV / 2, 300, 13).txt + " " + L("tiap muka", "each face") }))
  // pad kolom atap (pons)
  const pad = T.PcD > 0 ? columnPad(I, T, combos, out) : null
  return { checks: out, kind: "ring", asd, wq, Th, Tu, AsH, AsHmin, nb, AsP, foot, pad, wrw, bf }
}
function columnPad(I, T, combos, out) {
  const B = I.padB, t = I.padT, c = I.colB, d = t * 1000 - I.cover - I.db
  let qs = 0, cq = "", Pu = 0, cp = ""
  for (const k of asdOf(combos)) { const q = k.vec[5] / (B * B) + t * GAMMA_C + k.vec[4]; if (q > qs) { qs = q; cq = k.id } }
  for (const k of lrfdOf(combos)) if (k.vec[5] > Pu) { Pu = k.vec[5]; cp = k.id }
  out.push(chk("G", L("Tekanan di bawah pad kolom atap ≤ izin", "Pressure under roof-column pad ≤ allowable"), "SNI 8460", qs, I.qa, "Q", { note: cq, d: 1 }))
  const qu = Pu / (B * B), b0 = 4 * (c * 1000 + d)
  const Vp = Pu - qu * (c + d / 1000) ** 2
  out.push(chk("S", L("Geser dua arah (pons) pad kolom atap", "Two-way (punching) shear of roof-column pad"), "SNI 2847 §22.6", Vp * 1000 / (b0 * d), 0.75 * vcTwo(I.fc, 1, 40, b0, d), "MPa", { note: cp, d: 3 }))
  const proj = (B - c) / 2, Mu = qu * proj * proj / 2 / 1, Vu = qu * Math.max(proj - d / 1000, 0)
  const bars = pickBars(Math.max(asFlex(Mu, 1000, d, I.fc, I.fy).As || 0, rhoTS(I.fy) * 1000 * t * 1000), Math.min(3 * t * 1000, 450), I.db)
  out.push(chk("S", L(`Lentur pad kolom (${bars.txt})`, `Column pad flexure (${bars.txt})`), "SNI 2847 §13.2.7", Mu, phiMn(bars.As, 1000, d, I.fc, I.fy), "Mm", { note: cp, d: 1 }))
  out.push(chk("S", L("Geser satu arah pad kolom", "Column pad one-way shear"), "SNI 2847 §22.5", Vu, 0.75 * vcOne(I.fc, 1, bars.As / (1000 * d), d) * d, "W", { note: cp, d: 1 }))
  return { B, t, d, Pu, bars }
}

// ---------------------------------------------------------------- pelat penuh di atas tiang (pondasi dalam)
function piledTank(I, T, combos) {
  const Ds = I.D + 2 * I.proj, h = I.sh, Wsl = Math.PI * Ds * Ds / 4 * h * GAMMA_C
  const tot = (c) => {
    const [w, , Ms, V, p, Pc] = c.vec
    return { P: w * Math.PI * I.D + p * T.A + c.fD * (Wsl + T.Wb) + Pc * (I.nCol || 0), M: Ms + V * h, V }
  }
  const R = piledSlab(I, T, combos, tot, { soil: I.soilDS, settle: I.settleOpt })
  R.checks = R.checks.map((c) => ({ ...c, grp: /LRFD/.test(c.grp) && !/Tiang|Piles/.test(c.grp) ? "S" : c.grp }))
  R.wq = null
  return R
}

// ---------------------------------------------------------------- pelat penuh
function slab(I, T, combos) {
  const out = [], a = I.D / 2, Ds = I.D + 2 * I.proj, R = Ds / 2, h = I.sh, nu = 0.2
  const geo = makeGeo(planPoly("circle", Ds), 64)
  const As_ = geo.A, Wsl = As_ * h * GAMMA_C
  const tot = (c) => {
    const [w, , Ms, V, p, Pc] = c.vec
    const P = w * Math.PI * I.D + p * T.A + c.fD * (Wsl + T.Wb) + Pc * (I.nCol || 0)
    return { P, M: Ms + V * h, V }
  }
  const asd = asdOf(combos).map((c) => {
    const t = tot(c), pr = pressure(geo, t.P, 0, t.M)
    const qa = I.qa * (c.temp ? (I.tempFac ?? 1) : 1)
    const e = t.M / t.P, fsOT = e > 1e-9 ? R / e : Infinity, fsSL = t.V > 1e-9 ? I.muB * t.P / t.V : Infinity
    return { c, ...t, pr, qa, fsOT, fsSL, reqOT: c.stab ? 1.0 : 1.5, reqSL: c.stab ? 1.0 : 1.5, reqC: c.temp ? (I.minContact ?? 0.5) : 1 }
  })
  const W = (arr, f) => arr.reduce((x, y) => (f(y) > f(x) ? y : x), arr[0])
  const wq = W(asd, (r) => r.pr.qmax / r.qa)
  out.push(chk("G", L("Tekanan tanah maks ≤ daya dukung izin", "Max soil pressure ≤ allowable bearing"), "SNI 8460:2017", wq.pr.qmax, wq.qa, "Q", { note: wq.c.id, d: 1 }))
  out.push(...contactChecks(asd, "G", { minContact: I.minContact }))
  const wo = W(asd, (r) => r.reqOT / Math.max(r.fsOT, 1e-9))
  out.push(chk("G", L("Faktor aman guling", "Overturning safety factor"), "PIP STC01015", wo.fsOT, wo.reqOT, "", { mode: "ge", note: wo.c.id }))
  const ws = W(asd, (r) => r.reqSL / Math.max(r.fsSL, 1e-9))
  out.push(chk("G", L("Faktor aman geser", "Sliding safety factor"), "PIP STC01015", ws.fsSL, ws.reqSL, "", { mode: "ge", note: ws.c.id }))
  out.push(chk("G", L("Tonjolan pelat di luar shell ≥ 300 mm", "Slab projection beyond shell ≥ 300 mm"), "PIP STE03020", I.proj * 1000, 300, "mm", { mode: "ge", d: 0 }))
  // LRFD: pelat kaku → q = q0 + g·x
  const d = h * 1000 - I.cover - I.db, dm = d / 1000
  let Mc = 0, Mbi = 0, Mt = 0, Vc = 0, Vi = 0, cMc = "", cMt = "", cVc = "", cVi = "", Pcu = 0, cPc = ""
  for (const c of lrfdOf(combos)) {
    const t = tot(c), pr = pressure(geo, t.P, 0, t.M)
    if (!(pr.mode === "full" || pr.mode === "partial")) continue
    const wu = c.fD * (h * GAMMA_C + T.Wb / T.A)
    const qEdge = pr.q0 + Math.abs(pr.gx) * R, q0 = t.P / As_
    const mc = (qEdge - wu) * I.proj * I.proj / 2, vc = (qEdge - wu) * Math.max(I.proj - dm, 0)
    const win = q0 - c.vec[4] - wu
    const q1 = Math.abs(pr.gx) * a
    const mCenter = (3 + nu) * win * a * a / 16, mLin = (5 + nu) * q1 * a * a * 0.3849 / 48
    const mt = Math.max(0, mCenter) + mLin, mb = Math.max(0, -mCenter) + mLin
    const vi = Math.abs(win) * Math.max(a - dm, 0) / 2 + q1 * a / 3
    if (Math.max(mc, mb) > Math.max(Mc, Mbi)) { Mc = mc; Mbi = mb; cMc = c.id }
    if (mt > Mt) { Mt = mt; cMt = c.id }
    if (vc > Vc) { Vc = vc; cVc = c.id }
    if (vi > Vi) { Vi = vi; cVi = c.id }
    if (c.vec[5] > Pcu) { Pcu = c.vec[5]; cPc = c.id }
  }
  const smax = Math.min(3 * h * 1000, 450), half = 0.5 * rhoTS(I.fy) * 1000 * h * 1000
  const Mb = Math.max(Mc, Mbi)
  const bot = pickBars(Math.max(asFlex(Mb, 1000, d, I.fc, I.fy).As || 0, half), smax, I.db)
  const top = pickBars(Math.max(asFlex(Mt, 1000, d, I.fc, I.fy).As || 0, half), smax, I.db)
  out.push(chk("S", L(`Lentur bawah (kantilever di luar shell & interior) (${bot.txt} dua arah)`, `Bottom flexure (cantilever outside shell & interior) (${bot.txt} both ways)`), "SNI 2847 §22.3; Timoshenko", Mb, phiMn(bot.As, 1000, d, I.fc, I.fy), "Mm", { note: cMc, d: 1 }))
  out.push(chk("S", L(`Lentur atas interior (${top.txt} dua arah)`, `Top flexure, interior (${top.txt} both ways)`), "SNI 2847 §22.3; Timoshenko", Mt, phiMn(top.As, 1000, d, I.fc, I.fy), "Mm", { note: cMt, d: 1 }))
  out.push(chk("S", L("Geser satu arah pada d di luar shell (kantilever)", "One-way shear at d outside shell (cantilever)"), "SNI 2847 §22.5", Vc, 0.75 * vcOne(I.fc, 1, bot.As / (1000 * d), d) * d, "W", { note: cVc, d: 1 }))
  out.push(chk("S", L("Geser satu arah pada d di dalam shell", "One-way shear at d inside shell"), "SNI 2847 §22.5", Vi, 0.75 * vcOne(I.fc, 1, Math.min(bot.As, top.As) / (1000 * d), d) * d, "W", { note: cVi, d: 1 }))
  if (Pcu > 0) {
    const c = I.colB, b0 = 4 * (c * 1000 + d)
    out.push(chk("S", L("Geser dua arah (pons) kolom atap pada pelat", "Two-way (punching) shear of roof column on slab"), "SNI 2847 §22.6", Pcu * 1000 / (b0 * d), 0.75 * vcTwo(I.fc, 1, 40, b0, d), "MPa", { note: cPc, d: 3 }))
  } else out.push(chk("S", L("Geser dua arah: atap swa-dukung, tanpa beban terpusat kolom", "Two-way shear: self-supported roof, no column point load"), "—", 0, 1, "", { info: true }))
  out.push(chk("S", L("Tebal pelat ≥ 150 mm di atas tulangan bawah", "Slab depth ≥ 150 mm above bottom bars"), "SNI 2847 §13.3.1.2", d, 150, "mm", { mode: "ge", d: 0 }))
  return { checks: out, kind: "slab", asd, wq, geo, Ds, d, Mc, Mbi, Mt, Vc, Vi, bot, top, Wsl }
}
