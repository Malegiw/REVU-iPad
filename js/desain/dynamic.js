// Pondasi blok peralatan dinamis (WIP, WTP, kompresor udara, dll.): ACI 351.3R-18 + PIP STC01015/REIE 686.
// Dinamika: parameter terpusat Richart–Whitman (lingkaran ekuivalen) untuk vertikal, horizontal, rocking, torsi + mode sliding–rocking tergandeng,
// faktor penanaman (Arya/Novak), redaman geometrik, gaya tak seimbang dari mutu balans ISO 1940 (G) atau data vendor, amplitudo dan kecepatan.
// Statik: mesin footing.js (blok = telapak tebal, mesin = beban di atas blok). Sumbu poros mesin = x.
import { L, chk, G, GAMMA_C, seismicCoef, interp } from "./core.js"
import { analyzeFooting } from "./footing.js"
import { pileLayout } from "./deep.js"

export const PRESETS = {
  wip: { nm: "Water Injection Pump", type: "rot", Wm: 120, Wr: 9, rpm: 2980, kW: 450, Gq: 2.5, hs: 0.9, hcg: 0.7, Lb: 4.2, Bb: 1.3, Bx: 5.0, By: 3.3, H: 1.2, emb: 1.0 },
  wtp: { nm: "Water Transfer Pump", type: "rot", Wm: 35, Wr: 2.2, rpm: 2960, kW: 90, Gq: 6.3, hs: 0.6, hcg: 0.5, Lb: 2.4, Bb: 0.9, Bx: 4.0, By: 3.4, H: 1.5, emb: 1.0 },
  comp: { nm: "Air Compressor", type: "rot", Wm: 60, Wr: 3.5, rpm: 2950, kW: 160, Gq: 2.5, hs: 0.8, hcg: 0.8, Lb: 3.2, Bb: 1.6, Bx: 4.4, By: 3.4, H: 1.4, emb: 1.2 },
  rec: { nm: "Reciprocating Compressor", type: "rec", Wm: 180, Wr: 20, rpm: 740, kW: 600, Gq: 6.3, hs: 0.9, hcg: 0.8, Lb: 5.0, Bb: 2.4, Bx: 6.4, By: 4.2, H: 1.8, emb: 1.2, Fo: 25 },
}
const NPSI_B = [0.2, 0.5, 0.8, 1, 2, 3, 5], NPSI = [1.6, 1.378, 1.251, 1.219, 1.143, 1.11, 1.079]

export function dynamics(I) {
  const g = I.gs, rho = g / G, Gs = I.Gmode === "G" ? I.Gsoil : rho * I.Vs * I.Vs * I.red, nu = I.nu
  const Wb = I.Bx * I.By * I.H * GAMMA_C, mb = Wb / G, mm = I.Wm / G, m = mb + mm
  const h = Math.min(I.emb, I.H)
  // pusat massa gabungan (dari dasar) dan inersia massa
  const zc = (mb * I.H / 2 + mm * (I.H + I.hcg)) / m
  const Ixb = mb * (I.By ** 2 + I.H ** 2) / 12 + mb * (I.H / 2) ** 2 + mm * (I.H + I.hcg) ** 2      // rocking terhadap sumbu x di dasar
  const Io = Ixb - m * zc * zc
  const Iz = mb * (I.Bx ** 2 + I.By ** 2) / 12 + mm * (I.Lb ** 2 + I.Bb ** 2) / 12 + mm * (I.exm ** 2 + I.eym ** 2)
  const r0 = Math.sqrt(I.Bx * I.By / Math.PI)
  const r0p = Math.pow(I.Bx * I.By ** 3 / (3 * Math.PI), 0.25)
  const r0t = Math.pow(I.Bx * I.By * (I.Bx ** 2 + I.By ** 2) / (6 * Math.PI), 0.25)
  const ez = 1 + 0.6 * (1 - nu) * h / r0, ex = 1 + 0.55 * (2 - nu) * h / r0, ep = 1 + 1.2 * (1 - nu) * h / r0p + 0.2 * (2 - nu) * (h / r0p) ** 3
  const pk = I.pkS                                                                   // kekakuan kelompok tiang (pondasi dalam), bila ada
  const kz = pk ? pk.kz : 4 * Gs * r0 / (1 - nu) * ez
  const kx = pk ? pk.kx : 32 * (1 - nu) * Gs * r0 / (7 - 8 * nu) * ex
  const kp = pk ? pk.kp : 8 * Gs * r0p ** 3 / (3 * (1 - nu)) * ep
  const kt = pk ? pk.kt : 16 * Gs * r0t ** 3 / 3
  const Bz = (1 - nu) / 4 * m / (rho * r0 ** 3), Bx = (7 - 8 * nu) / (32 * (1 - nu)) * m / (rho * r0 ** 3)
  const Bp = 3 * (1 - nu) / 8 * Ixb / (rho * r0p ** 5), np = interp(NPSI_B, NPSI, Bp), Bt = Iz / (rho * r0t ** 5)
  const xP = pk ? (I.xiP ?? 0.05) : null
  const xz = xP ?? 0.425 / Math.sqrt(Bz), xx = xP ?? 0.2875 / Math.sqrt(Bx), xp = xP ?? 0.15 / ((1 + np * Bp) * Math.sqrt(np * Bp)), xt = xP ?? 0.5 / (1 + 2 * Bt)
  const f = (k, M) => Math.sqrt(k / M) / (2 * Math.PI)
  const wx2 = kx / m, wp2 = kp / Ixb, gam = Io / Ixb
  const disc = Math.sqrt(Math.max(((wx2 + wp2) / gam) ** 2 - 4 * wx2 * wp2 / gam, 0))
  const w1 = Math.sqrt(((wx2 + wp2) / gam - disc) / 2), w2 = Math.sqrt(((wx2 + wp2) / gam + disc) / 2)
  const modes = [
    { k: "v", nm: L("Vertikal", "Vertical"), K: kz, f: f(kz, m), xi: xz },
    { k: "h", nm: L("Horizontal (⊥ poros)", "Horizontal (⊥ shaft)"), K: kx, f: f(kx, m), xi: xx },
    { k: "r", nm: L("Rocking (terhadap poros)", "Rocking (about shaft)"), K: kp, f: f(kp, Ixb), xi: Math.min(xp, 0.5) },
    { k: "t", nm: L("Torsi (vertikal)", "Torsion (vertical)"), K: kt, f: f(kt, Iz), xi: xt },
    { k: "c1", nm: L("Sliding–rocking tergandeng 1", "Coupled sliding–rocking 1"), f: w1 / (2 * Math.PI), xi: Math.min(xx, xp) },
    { k: "c2", nm: L("Sliding–rocking tergandeng 2", "Coupled sliding–rocking 2"), f: w2 / (2 * Math.PI), xi: Math.min(xx, xp) },
  ]
  // eksitasi: gaya tak seimbang Fo = mr·e·ω², e = G/ω (ISO 1940)
  const fop = I.rpm / 60, om = 2 * Math.PI * fop
  const FoAuto = (I.Wr / G) * (I.Gq / 1000) * om
  const Fo = I.Fo > 0 ? I.Fo : FoAuto
  const mag = (fn, xi, fe) => { const r = fe / fn; return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * xi * r) ** 2) }
  const harm = I.type === "rec" ? [1, 2] : [1]
  const resp = harm.map((hh) => {
    const fe = hh * fop, w = 2 * Math.PI * fe
    const Az = Fo / kz * mag(modes[0].f, modes[0].xi, fe)
    const th = Fo * (I.H + I.hs) / kp * mag(modes[2].f, modes[2].xi, fe)
    const Ay = Fo / kx * mag(modes[1].f, modes[1].xi, fe) + th * (I.H + I.hs)
    return { h: hh, fe, Az: Az * 1e6, Ay: Ay * 1e6, vz: Az * w * 1000, vy: Ay * w * 1000 }       // μm dan mm/s
  })
  const Tn = I.kW > 0 ? 9.549 * I.kW / I.rpm : 0                                                // torsi nominal (kN·m)
  return { Gs, rho, Wb, mb, mm, m, zc, Ixb, Io, Iz, r0, r0p, r0t, ez, ex, ep, Bz, Bx, Bp, Bt, modes, fop, FoAuto, Fo, resp, Tn, harm, mr: Wb / I.Wm }
}

export function dynCases(I, Dy) {
  const cs = seismicCoef(I.seis).Cs
  const Wb = Dy.Wb, H = I.H
  const z = [0, 0, 0, 0, 0]
  return {
    meta: { cs },
    cases: {
      D: [I.Wm, 0, 0, 0, 0], Do: [0, 0, 0, Dy.Tn, 0], T: [I.Pp, I.Vpx, I.Vpy, I.Mpx, I.Mpy],
      Dyn1: [Dy.Fo, 0, 0, 0, 0], Dyn2: [0, 0, Dy.Fo, Dy.Fo * I.hs, 0],
      SC: [0, 0, 0, I.scf * Dy.Tn, 0],
      Ex: [0, cs * (I.Wm + Wb), 0, 0, cs * I.Wm * I.hcg - cs * Wb * H / 2], Ey: [0, 0, cs * (I.Wm + Wb), cs * I.Wm * I.hcg - cs * Wb * H / 2, 0],
      Wx: z, Wy: z,
    },
  }
}

export function analyzeDynamic(I, combos) {
  const Dy = dynamics(I)
  const checks = []
  const gD = L("Dinamis (ACI 351.3R)", "Dynamic (ACI 351.3R)"), gR = L("Proporsi blok (aturan praktis)", "Block proportions (rules of thumb)")
  const sep = I.sep / 100
  for (const md of Dy.modes) for (const hh of Dy.harm) {
    const fe = hh * Dy.fop, dlt = Math.abs(md.f - fe) / fe
    checks.push(chk(gD, L(`${md.nm}: |fn − ${hh}×f| / f ≥ ${I.sep}%`, `${md.nm}: |fn − ${hh}×f| / f ≥ ${I.sep}%`), "ACI 351.3R §6.2", dlt * 100, I.sep, "%", { mode: "ge", d: 1, note: `fn = ${md.f.toFixed(2)} Hz` }))
  }
  for (const r of Dy.resp) {
    const v = Math.max(r.vz, r.vy)
    checks.push(chk(gD, L(`Kecepatan getar puncak (${r.h}×) ≤ batas`, `Peak vibration velocity (${r.h}×) ≤ limit`), "ACI 351.3R §6.3 / ISO 10816", v, I.vlim, "mm/s", { d: 2, note: `Az ${r.Az.toFixed(1)} μm · Ay ${r.Ay.toFixed(1)} μm` }))
  }
  const mrMin = I.type === "rec" ? I.mrRec : I.mrRot
  checks.push(chk(gR, L(`Rasio massa blok/mesin ≥ ${mrMin}`, `Block/machine mass ratio ≥ ${mrMin}`), "ACI 351.3R §4.1", Dy.mr, mrMin, "", { mode: "ge", d: 2 }))
  checks.push(chk(gR, L("Lebar blok ≥ 1,5 × (tinggi poros dari dasar blok)", "Block width ≥ 1.5 × (shaft height above block base)"), "ACI 351.3R §4.1", I.By, 1.5 * (I.H + I.hs), "m", { mode: "ge", d: 2 }))
  checks.push(chk(gR, L("Tebal blok ≥ max(0,6 m; 1/5 dimensi terkecil)", "Block depth ≥ max(0.6 m; 1/5 least dimension)"), "ACI 351.3R §4.1", I.H, Math.max(0.6, Math.min(I.Bx, I.By) / 5), "m", { mode: "ge", d: 2 }))
  checks.push(chk(gR, L("Tepi blok ≥ 0,3 m di luar baseplate", "Block edge ≥ 0.3 m beyond baseplate"), L("praktik PIP", "PIP practice"), Math.min((I.Bx - I.Lb) / 2, (I.By - I.Bb) / 2), 0.3, "m", { mode: "ge", d: 2 }))
  const ecg = Math.max(Math.abs(Dy.mm * I.exm / Dy.m) / I.Bx, Math.abs(Dy.mm * I.eym / Dy.m) / I.By) * 100
  checks.push(chk(gR, L("Eksentrisitas pusat massa gabungan ≤ 5% dimensi", "Combined CG eccentricity ≤ 5% of dimension"), "ACI 351.3R §4.1", ecg, 5, "%", { d: 2 }))
  checks.push(chk(gR, L("Pusat massa gabungan di bawah muka atas blok", "Combined CG below top of block"), "ACI 351.3R §4.1", Dy.zc, I.H, "m", { d: 2 }))
  // statik
  const qfac = I.type === "rec" ? I.qRec : I.qRot
  const m = { shape: "rect", B: I.Bx, L: I.By, t: I.H, Df: I.emb, gs: I.gs, peds: [{ x: I.exm, y: I.eym, shape: "rect", bx: I.Lb, by: I.Bb, h: 0 }] }
  if (I.fdType === "deep") { m.piles = pileLayout("rect", m.B, m.L, I.psx, I.pce); m.pileD = I.pD / 1000 }
  const r = analyzeFooting(m, combos, { qa: I.qa * qfac, mu: I.muB }, I.crit, { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, { fc: I.fc, fy: I.fy, n: 8, db: 16, cover: 50 })
  r.checks.filter((c) => !/pedestal/i.test(c.item) || /pons|punching/i.test(c.item)).forEach((c) => checks.push(c))
  return { Dy, r, checks, qfac, m }
}
