// Pondasi vessel: vertikal (Gas Boot, Instrument Air Receiver) di atas pedestal oktagon/persegi + telapak, dan horizontal (Separator) di atas dua saddle
// (tetap & geser) dengan telapak gabungan atau terpisah. Angin SNI 1727:2020 Bab 29 (diintegrasikan per tinggi), gempa SNI 1726:2019 §15 (Cs),
// gesek termal saddle geser (PIP STE03350/03360), baut angkur ACI 318M-14 Bab 17. Desain telapak & pedestal memakai mesin footing.js.
import { L, chk, windOnBody, cfRound, seismicCoef, CODE } from "./core.js"
import { analyzeFooting } from "./footing.js"
import { pileLayout } from "./deep.js"
import { anchorCheck, ANCHOR } from "./steel.js"
import { barA } from "./core.js"

export const PRESETS = {
  gasboot: { kind: "v", D: 1.2, H: 10.0, Dadd: 0.6, We: 60, Wo: 45, Wt: 115, Lp: 5, hcg: 4.8, Tp: 4, Tm: 6, nb: 8, bd: 24, BCD: 1.40, pedShape: "oct", Dp: 2.0, hp: 0.6, fShape: "oct", B: 4.2, Lf: 4.2, t: 0.6, Df: 1.5, nBars: 32, dbP: 19 },
  iar: { kind: "v", D: 1.0, H: 3.2, Dadd: 0.3, We: 14, Wo: 2, Wt: 26, Lp: 0, hcg: 1.6, Tp: 1, Tm: 1, nb: 4, bd: 20, BCD: 0.90, pedShape: "rect", Dp: 1.3, hp: 0.4, fShape: "rect", B: 2.4, Lf: 2.4, t: 0.45, Df: 1.0, nBars: 16, dbP: 19 },
  sep: { kind: "h", D: 1.8, Ltt: 6.0, Ls: 3.6, hc: 1.4, Dadd: 0.3, We: 120, Wo: 150, Wt: 165, Lp: 4, mu: 0.4, nb: 4, bd: 24, sb: 1.2, bx: 0.5, by: 1.6, hp: 0.6, fType: "comb", B: 6.0, Lf: 2.6, t: 0.5, Df: 1.2, nBars: 12, dbP: 16 },
}

// Vektor per pedestal [P, Vx, Vy, Mx, My] di puncak pedestal
export function vesselCases(I) {
  const w = I.wind
  const z0 = I.hp + I.t - I.Df                                         // elevasi puncak pedestal dari muka tanah
  const cs = seismicCoef(I.seis).Cs
  if (I.kind === "v") {
    const De = I.D + I.Dadd, Cf = cfRound(I.H / De)
    const wf = windOnBody(w, De, Math.max(z0, 0), I.H, Cf)
    const Vs = cs * (I.We + I.Wo)
    return {
      meta: { De, Cf, wind: wf, cs, Vs, z0 },
      cases: { D: [I.We, 0, 0, 0, 0], Do: [I.Wo, 0, 0, 0, 0], Dt: [I.Wt, 0, 0, 0, 0], L: [I.Lp, 0, 0, 0, 0], T: [0, I.Tp, 0, 0, I.Tm],
        Wx: [0, wf.F, 0, 0, wf.M], Wy: [0, 0, wf.F, wf.M, 0], Ex: [0, Vs, 0, 0, Vs * I.hcg], Ey: [0, 0, Vs, Vs * I.hcg, 0] },
    }
  }
  // horizontal: sumbu vessel = x; pedestal 0 = saddle tetap (x = −Ls/2), 1 = saddle geser (x = +Ls/2)
  const De = I.D + I.Dadd, Ltot = I.Ltt + 0.5 * I.D
  const zc = Math.max(z0, 0) + I.hc
  const tr = windOnBody(w, Ltot, zc - De / 2, De, cfRound(Ltot / De))       // angin melintang (arah y) pada bidang proyeksi L × De
  const lo = windOnBody(w, De, zc - De / 2, De, 0.5)                        // angin memanjang (arah x) pada penampang ujung
  const Fl = lo.F * Math.PI / 4                                            // bidang ujung lingkaran ≈ π/4 dari bujur sangkar De × De
  const Vs = cs * (I.We + I.Wo)
  const dP = (F) => F * I.hc / I.Ls                                        // kopel vertikal antar saddle akibat gaya memanjang
  const Ff = I.mu * (I.We + I.Wo) / 2
  const half = (v) => [v, v]
  const mk = (a, b) => [...a, ...b]
  return {
    meta: { De, Ltot, wind: { F: tr.F, Fl }, cs, Vs, Ff, z0 },
    cases: {
      D: mk([I.We / 2, 0, 0, 0, 0], [I.We / 2, 0, 0, 0, 0]), Do: mk([I.Wo / 2, 0, 0, 0, 0], [I.Wo / 2, 0, 0, 0, 0]), Dt: mk([I.Wt / 2, 0, 0, 0, 0], [I.Wt / 2, 0, 0, 0, 0]),
      L: mk([I.Lp / 2, 0, 0, 0, 0], [I.Lp / 2, 0, 0, 0, 0]),
      T: mk([0, -Ff, 0, 0, 0], [0, Ff, 0, 0, 0]),
      Wx: mk([-dP(Fl), Fl, 0, 0, 0], [dP(Fl), 0, 0, 0, 0]), Wy: mk(...half([0, 0, tr.F / 2, tr.F / 2 * I.hc, 0])),
      Ex: mk([-dP(Vs), Vs, 0, 0, 0], [dP(Vs), 0, 0, 0, 0]), Ey: mk(...half([0, 0, Vs / 2, Vs / 2 * I.hc, 0])),
    },
  }
}

export function vesselModels(I) {
  if (I.kind === "v") return [{ label: "", shape: I.fShape, B: I.B, L: I.fShape === "rect" ? I.Lf : I.B, t: I.t, Df: I.Df, gs: I.gs, peds: [{ x: 0, y: 0, shape: I.pedShape, bx: I.Dp, by: I.Dp, h: I.hp }], map: [0] }]
  const ped = (x) => ({ x, y: 0, shape: "rect", bx: I.bx, by: I.by, h: I.hp })
  if (I.fType === "comb") return [{ label: "", shape: "rect", B: I.B, L: I.Lf, t: I.t, Df: I.Df, gs: I.gs, peds: [ped(-I.Ls / 2), ped(I.Ls / 2)], map: [0, 1] }]
  return [0, 1].map((k) => ({ label: k === 0 ? L("Saddle tetap", "Fixed saddle") : L("Saddle geser", "Sliding saddle"), shape: "rect", B: I.B, L: I.Lf, t: I.t, Df: I.Df, gs: I.gs, peds: [ped(0)], map: [k] }))
}
// ambil vektor pedestal sesuai peta model (telapak terpisah memakai satu pedestal saja)
export const pick = (vec, map) => map.flatMap((k) => vec.slice(5 * k, 5 * k + 5))

export function analyzeVessel(I, combos) {
  const models = I.autoModels || vesselModels(I)
  if (I.fdType === "deep" && !I.autoModels) models.forEach((m) => { m.piles = pileLayout(m.shape, m.B, m.L, I.psx, I.pce); m.pileD = I.pD / 1000 })
  const res = models.map((m) => {
    const cb = combos.map((c) => ({ ...c, vec: pick(c.vec, m.map) }))
    const r = analyzeFooting(m, cb, { qa: I.qa, mu: I.muB }, I.crit, { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, { fc: I.fc, fy: I.fy, n: I.nBars, db: I.dbP, cover: 50, tie: 10 })
    return { m, r }
  })
  const checks = []
  res.forEach(({ m, r }) => r.checks.forEach((c) => checks.push(m.label ? { ...c, grp: `${c.grp} · ${m.label}` } : c)))
  const anc = anchors(I, combos)
  checks.push(...anc.checks)
  return { res, anc, checks }
}

// nomor pasal Bab 17: ACI 318-14 (SNI 2847:2019) → ACI 318-19
const A17 = (s14, s19) => (CODE.aci === "14" ? "SNI 2847 " + s14 : "ACI 318-19 " + s19)
function anchors(I, combos) {
  const out = [], g = L("Baut angkur (LRFD)", "Anchor bolts (LRFD)")
  const n = I.nb, d = I.bd
  const lr = combos.filter((c) => c.kind === "LRFD")
  let w = null
  const sad = I.kind === "h" ? [0, 1] : [0]
  for (const c of lr) for (const k of sad) {
    const v = c.vec.slice(5 * k, 5 * k + 5)
    const P = v[0], Vx = v[1], Vy = v[2], Mx = v[3], My = v[4]
    let Tu, Vu
    if (I.kind === "v") { Tu = 4 * Math.hypot(Mx, My) / (n * I.BCD) - P / n; Vu = Math.hypot(Vx, Vy) / n }
    else { Tu = Math.abs(Mx) / I.sb / (n / 2) - P / n; Vu = (k === 0 ? Math.hypot(Vx, Vy) : Math.abs(Vy)) / n }
    const ac = anchorCheck(d, I.bg, Math.max(Tu, 0), Vu, I.fc)
    if (!w || ac.inter > w.ac.inter) w = { ac, Tu, Vu, c: c.id, k }
  }
  if (!w) return { checks: out }
  const ac = w.ac, sfx = I.kind === "h" ? ` (${w.k === 0 ? L("saddle tetap", "fixed saddle") : L("saddle geser", "sliding saddle")})` : ""
  out.push(chk(g, L(`Tarik baja baut ${n}×M${d} ${ANCHOR[I.bg].nm}${sfx}`, `Bolt steel tension ${n}×M${d} ${ANCHOR[I.bg].nm}${sfx}`), A17("§17.4.1", "§17.6.1"), Math.max(w.Tu, 0), ac.phiNsa, "F", { note: w.c, d: 2 }))
  out.push(chk(g, L("Cabut (pullout) kepala/mur baut", "Head/nut pull-out"), A17("§17.4.3", "§17.6.3"), Math.max(w.Tu, 0), ac.phiNpn, "F", { note: w.c, d: 2 }))
  out.push(chk(g, L("Geser baja baut (dengan grout, ×0,8)", "Bolt steel shear (with grout, ×0.8)"), A17("§17.5.1", "§17.7.1"), w.Vu, ac.phiVsa, "F", { note: w.c, d: 2 }))
  out.push(chk(g, L("Interaksi tarik–geser (ζ = 5/3)", "Tension–shear interaction (ζ = 5/3)"), A17("R17.6", "R17.8"), ac.inter, 1, "", { note: w.c, d: 3 }))
  // tulangan angkur (§17.4.2.9): tulangan pedestal di sisi tarik memikul gaya tarik angkur, φ = 0,75
  const nt = I.kind === "v" ? Math.max(1, Math.floor(n / 2)) : n / 2
  const Treq = Math.max(w.Tu, 0) * nt
  const AsReq = Treq * 1000 / (0.75 * I.fy), AsTie = Math.floor(I.nBars / 2) * barA(I.dbP)
  out.push(chk(g, L("Tulangan angkur (vertikal pedestal sisi tarik) memikul tarik baut", "Anchor reinforcement (tension-side pedestal bars) carries bolt tension"), A17("§17.4.2.9", "§17.5.2"), AsReq, AsTie, "mm²", { note: w.c, d: 0 }))
  const edge = I.kind === "v" ? (I.Dp - I.BCD) / 2 * 1000 : (I.by - I.sb) / 2 * 1000
  out.push(chk(g, L("Jarak tepi baut ke sisi pedestal ≥ max(4d, 100 mm)", "Bolt edge distance to pedestal face ≥ max(4d, 100 mm)"), "PIP STE05121 / " + A17("§17.7", "§17.9"), edge, Math.max(4 * d, 100), "mm", { mode: "ge", d: 0 }))
  out.push(chk(g, L("Panjang tanam hef ≥ 12d dan ≤ hp + t − 75 mm", "Embedment hef ≥ 12d and ≤ hp + t − 75 mm"), L("praktik PIP", "PIP practice"), I.hef, 12 * d, "mm", { mode: "ge", d: 0, ok: I.hef >= 12 * d && I.hef <= (I.hp + I.t) * 1000 - 75 }))
  return { checks: out, w }
}
