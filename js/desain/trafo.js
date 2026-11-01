// Pondasi trafo daya (peralatan statis): plinth di atas telapak/mat, angin pada badan trafo (SNI 1727:2020 Bab 29, Cf penampang persegi),
// gempa peralatan kaku (SNI 1726:2019 §15.4.2, Ie = 1,5 untuk fasilitas penting), bak penampung oli dengan kerikil (IEEE 980-2020),
// beban dongkrak saat instalasi (tumpu & pons, SNI 2847 §22.8/§22.6), penahan geser trafo. Desain telapak & plinth memakai footing.js.
import { L, chk, windOnBody, cfSquare, seismicCoef } from "./core.js"
import { analyzeFooting } from "./footing.js"
import { pileLayout } from "./deep.js"
import { phiBearing, vcTwo } from "./rc.js"

export const PRESET = { mva: 30, W: 520, Voil: 14000, Lt: 5.2, Bt: 3.2, Ht: 4.0, hcg: 1.9, Bp: 4.2, Lp: 6.0, hp: 0.5, B: 7.0, Lf: 9.0, t: 0.6, Df: 1.0,
  Lpit: 9.5, Bpit: 7.5, hpit: 1.0, hg: 0.3, por: 0.35, rain: 100, fireW: 10, nJack: 4, jackB: 0.3, muT: 0.3 }

export function trafoCases(I) {
  const w = I.wind, z0 = Math.max(I.hp + I.t - I.Df, 0)
  const fx = windOnBody(w, I.Bt, z0, I.Ht, cfSquare(I.Ht / I.Bt))        // angin arah x mengenai muka Bt × Ht
  const fy = windOnBody(w, I.Lt, z0, I.Ht, cfSquare(I.Ht / I.Lt))
  const cs = seismicCoef(I.seis).Cs, Vs = cs * I.W
  return {
    meta: { fx, fy, cs, Vs },
    cases: { D: [I.W, 0, 0, 0, 0], L: [I.Lm || 0, 0, 0, 0, 0], Wx: [0, fx.F, 0, 0, fx.M], Wy: [0, 0, fy.F, fy.M, 0], Ex: [0, Vs, 0, 0, Vs * I.hcg], Ey: [0, 0, Vs, Vs * I.hcg, 0] },
  }
}

export const trafoModel = (I) => ({ shape: "rect", B: I.Lf, L: I.B, t: I.t, Df: I.Df, gs: I.gs, peds: [{ x: 0, y: 0, shape: "rect", bx: I.Lp, by: I.Bp, h: I.hp }], pedKind: "plinth" })
export function analyzeTrafo(I, combos, meta) {
  const m = I.autoModel ? { ...I.autoModel, grid: undefined } : trafoModel(I)
  if (I.fdType === "deep" && !I.autoModel) { m.piles = pileLayout("rect", m.B, m.L, I.psx, I.pce); m.pileD = I.pD / 1000 }
  const r = analyzeFooting(m, combos, { qa: I.qa, mu: I.muB }, I.crit, { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, { fc: I.fc, fy: I.fy, n: I.nBars, db: I.dbP, cover: 50, tie: 10 })
  const checks = [...r.checks]
  const gO = L("Bak oli & instalasi", "Oil pit & installation")
  // bak penampung oli: volume bebas di atas kerikil + pori kerikil, dikurangi plinth
  const Apit = I.Lpit * I.Bpit, Aplinth = I.Lp * I.Bp
  const Vavail = (Apit - Aplinth) * ((I.hpit - I.hg) + I.hg * I.por)
  const Vreq = 1.1 * I.Voil / 1000 + Apit * I.rain / 1000 + I.fireW
  checks.push(chk(gO, L("Volume bak oli ≥ 110% oli + hujan rencana + air pemadam", "Oil pit volume ≥ 110% oil + design rain + fire water"), "IEEE 980-2020 §5", Vavail, Vreq, "m³", { mode: "ge", d: 2 }))
  checks.push(chk(gO, L("Bak oli lebih lebar ≥ 1,5 m dari tepi trafo (ruang semburan)", "Pit extends ≥ 1.5 m beyond transformer (spray zone)"), "IEEE 980 (praktik)", Math.min((I.Lpit - I.Lt) / 2, (I.Bpit - I.Bt) / 2), 1.5, "m", { mode: "ge", d: 2 }))
  // dongkrak: 2 dongkrak mengangkat satu ujung → tiap titik W/2, terfaktor 1,4
  const Pj = 1.4 * I.W / 2, A1 = (I.jackB * 1000) ** 2
  checks.push(chk(gO, L("Tumpu beton di bawah pelat dongkrak (1,4·W/2)", "Concrete bearing under jacking plate (1.4·W/2)"), "SNI 2847 §22.8", Pj, phiBearing(I.fc, A1, 4 * A1) / 1000, "F", { d: 1 }))
  const d = I.hp * 1000 - 75, b0 = 3 * (I.jackB * 1000 + d)
  checks.push(chk(gO, L("Geser pons plinth di titik dongkrak (posisi tepi, αs = 30)", "Plinth punching at jacking point (edge, αs = 30)"), "SNI 2847 §22.6", Pj * 1000 / (b0 * d), 0.75 * vcTwo(I.fc, 1, 30, b0, d), "MPa", { d: 3 }))
  // penahan geser trafo di atas plinth (tanpa angkur: gesek baja–beton)
  const V = Math.max(meta.Vs, meta.fx.F, meta.fy.F)
  const Rf = I.muT * I.W * (1 - 0.2 * (I.seis.SDS || 0))
  checks.push(chk(gO, L("Gaya desain stopper/angkur gempa trafo (gesek saja tidak diandalkan)", "Design force for transformer seismic stoppers/anchors (friction not relied on)"), "IEEE 693 / SNI 1726 §13", V, Rf, "F", { d: 1, info: true,
    note: V > Rf ? L("gesek < V: wajib stopper/las ke pelat tanam", "friction < V: stoppers/welding to embeds required") : L("gesek ≥ V, stopper tetap disarankan", "friction ≥ V, stoppers still recommended") }))
  return { r, checks, Vavail, Vreq, m }
}
