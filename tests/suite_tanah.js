// Kelompok uji data tanah & pondasi dalam (js/desain/soil.js, deep.js, footing.js dengan tiang): korelasi, kelas situs SNI 1726, faktor daya dukung,
// Meyerhof N-SPT/CPT, Skempton, kapasitas tiang (API vs pile.js, N-SPT Meyerhof, CPT LCPC), penurunan (konsistensi dengan penurunan.js),
// tata letak & reaksi tiang, pelat tangki di atas tiang, dan spektrum SNI 1726.
import * as S from "../js/desain/soil.js"
import * as pl from "../js/desain/pile.js"
import * as ft from "../js/desain/footing.js"
import { pileLayout } from "../js/desain/deep.js"
import { analyze, overburden } from "../js/penurunan.js"
import { sdc, spectrum } from "../js/project.js"
import { seismicParams } from "../js/desain/core.js"

export async function run({ check }) {
  const near = (name, got, want, rel = 1e-6, abs = 1e-9) => check(name, Math.abs(got - want) <= Math.max(abs, rel * Math.abs(want)) ? [] : [`${got} ≠ ${want} (toleransi ${rel})`])
  const truthy = (name, cond, msg) => check(name, cond ? [] : [msg || "gagal"])
  const ly = (h, type, N, extra = {}) => ({ h, type, g: 18, gsat: 19, N, qc: 0, fs: 0, ...Object.fromEntries(S.OVR.map((k) => [k, 0])), ...extra })
  const soil = (layers, o = {}) => S.deriveSoil({ name: "T", test: "spt", gwt: 99, Er: 60, Nkt: 15, Gs: 2.7, layers, ...o })

  // ---- korelasi
  const d1 = soil([ly(10, "sand", 20)], { Er: 80 })
  near("N60 = N·Er/60", d1.layers[0].N60, 20 * 80 / 60, 1e-12)
  near("σ'v tengah lapis (kering) = γ·z", d1.layers[0].svp, 18 * 5, 1e-12)
  const N1 = d1.layers[0].N60 * Math.min(Math.sqrt(100 / 90), 1.7)
  near("φ Peck–Hanson–Thornburn: 27,1 + 0,3N1 − 0,00054N1²", d1.layers[0].phi, 27.1 + 0.3 * N1 - 0.00054 * N1 * N1, 1e-12)
  const dc = soil([ly(6, "clay", 10)])
  near("lempung: cu = 6·N60 (Stroud)", dc.layers[0].cu, 60, 1e-12)
  const e0 = (2.7 * 9.81 - 19) / (19 - 9.81)
  near("e0 = (Gs·γw − γsat)/(γsat − γw)", dc.layers[0].e0, e0, 1e-12)
  near("Cc = 0,30(e0 − 0,27) (Hough)", dc.layers[0].Cc, 0.3 * (e0 - 0.27), 1e-12)
  const dov = soil([ly(6, "clay", 10, { cu: 33, E: 12 })])
  truthy("nilai manual menimpa korelasi (cu, E dalam MPa)", dov.layers[0].cu === 33 && dov.layers[0].E === 12000 && dov.layers[0].auto.cu === false)

  // ---- kelas situs SNI 1726:2019 Tabel 5
  truthy("N̄ = 10 → SE", S.siteClass(soil([ly(30, "sand", 10)])).cls === "SE")
  truthy("N̄ = 30 → SD", S.siteClass(soil([ly(30, "sand", 30)])).cls === "SD")
  truthy("N̄ = 60 → SC", S.siteClass(soil([ly(30, "sand", 60)])).cls === "SC")
  const sm = S.siteClass(soil([ly(5, "sand", 20), ly(5, "sand", 40), ly(20, "sand", 30)]))
  near("N̄ = Σd/Σ(d/N)", sm.Nbar, 30 / (5 / 20 + 5 / 40 + 20 / 30), 1e-12)
  truthy("lempung lunak cu < 25 kPa ≥ 3 m → SE", S.siteClass(soil([ly(4, "clay", 3), ly(26, "sand", 40)])).cls === "SE")

  // ---- daya dukung dangkal
  const [Nc, Nq, Ng] = S.bearingFactors(30)
  near("Nq(30°) = 18,401", Nq, 18.401, 1e-4)
  near("Nc(30°) = 30,140", Nc, 30.14, 1e-4)
  near("Nγ Vesic (30°) = 22,402", Ng, 22.402, 1e-4)
  near("φ = 0: Nc = 5,14", S.bearingFactors(0)[0], 5.14, 1e-12)
  const sand = soil([ly(20, "sand", 20)])
  const qS = S.shallowQa(sand, 3, 3, 1, "spt", 3)
  const qn = 11.98 * 20 * ((3.28 * 3 + 1) / (3.28 * 3)) ** 2 * Math.min(1 + 0.33 / 3, 1.33)
  near("Meyerhof N-SPT B > 1,22: qa = min(11,98N((3,28B+1)/3,28B)²Fd + σv; Vesic/FS)", qS.qa, Math.min(qn + 18, qS.qult / 3), 1e-9)
  const sandC = S.deriveSoil({ name: "C", test: "cpt", gwt: 99, Er: 60, Nkt: 15, Gs: 2.7, layers: [{ ...ly(20, "sand", 0), qc: 12 }] })
  const qC = S.shallowQa(sandC, 1, 1, 0.5, "cpt", 3)
  near("Meyerhof CPT B ≤ 1,22: qnet = qc/15", qC.rows.find((r) => r[0] === "qnet,izin")[3].startsWith(String((12000 / 15).toFixed(1))) ? 1 : 0, 1)
  const clay = soil([ly(20, "clay", 10, { cu: 50 })])
  const qK = S.shallowQa(clay, 2, 2, 1, "spt", 3)
  near("Skempton: qa = 5,14cu(1+0,2B/L)(1+0,2Df/B)/FS + σv", qK.qa, 5.14 * 50 * 1.2 * 1.1 / 3 + 18, 1e-12)

  // ---- kapasitas tiang
  const mixed = soil([ly(4, "clay", 8, { cu: 40 }), ly(10, "sand", 25), ly(10, "clay", 20, { cu: 120 })])
  const apiN = S.pileAxial(mixed, { D: 0.508, t: 0.0127, Lp: 20, open: true, method: "api", kind: "pipe", z0: 0 })
  const apiP = pl.axialPipe(0.508, 0.0127, 20, true, S.pileLayers(mixed, 0), 99)
  near("α/β data tanah = API RP 2GEO pile.js (gesek luar)", apiN.Qso, apiP.Qso, 1e-9)
  near("α/β data tanah = API RP 2GEO pile.js (Qu)", apiN.Qc, apiP.Qc, 1e-9)
  const sd = soil([ly(30, "sand", 20)])
  const sp = S.pileAxial(sd, { D: 0.5, t: 0.0127, Lp: 10, open: false, method: "spt", kind: "pipe", z0: 0 })
  near("N-SPT Meyerhof: Qs = 2N60·πD·L", sp.Qso, 40 * Math.PI * 0.5 * 10, 1e-9)
  near("N-SPT Meyerhof: q = min(40N·L/D, 400N)", sp.q, 8000, 1e-12)
  const cp = S.deriveSoil({ name: "C", test: "cpt", gwt: 99, Er: 60, Nkt: 15, Gs: 2.7, layers: [{ ...ly(30, "sand", 0), qc: 10 }] })
  const cq = S.pileAxial(cp, { D: 0.5, t: 0.0127, Lp: 10, open: false, method: "cpt", kind: "pipe", z0: 0 })
  near("LCPC pasir qc 10 MPa: fs = min(qc/100, 80 kPa)", cq.Qso, 80 * Math.PI * 0.5 * 10, 1e-9)
  near("LCPC pancang pasir: q = 0,4·qc", cq.q, 4000, 1e-12)
  const z5 = S.pileAxial(sd, { D: 0.5, t: 0.0127, Lp: 10, open: false, method: "spt", kind: "pipe", z0: 5 })
  truthy("kepala tiang pada z0: ujung di z0 + L", Math.abs(z5.tip.z - 15) < 1e-12)

  // ---- penurunan: konsistensi dengan mesin penurunan.js
  const ds2 = S.deriveSoil(S.defaultSoil())
  const r1 = S.settleShallow(ds2, { shape: "persegi", B: 3, L: 3, Df: 1.5, q: 150 }, { life: 20, allow: 50 })
  truthy("settleShallow memakai analyze() (q bruto sama)", r1.res && Math.abs(r1.res.q_gross - 150) < 1e-12)
  const ref = analyze({ shape: "persegi", B: 3, L: 3 }, r1.soil, 150, { method: "boussinesq", rigidity: "kaku", dz: 0.5, lifeYears: 20, allowMm: 50 })
  near("settleShallow = analyze() langsung", r1.res.s_life, ref.s_life, 1e-12)
  const rN = S.settleShallow(ds2, { shape: "persegi", B: 4, L: 4, Df: 8, qNet: 60 })
  near("qNet → q bruto = qNet + σv(Df) (rakit ekuivalen)", rN.res.q_net, 60, 1e-9)
  const g = { D: 0.5, Lp: 15, Ap: 0.02, Ep: 2e8, n: 9, Bg: 3.5, Lg: 3.5, Q: 4500, Qb: 500, Qu: 2000, qb: 5000, z0: 1.5, driven: true }
  const sg = S.settleGroup(ds2, g)
  near("pemendekan elastis se = (Qp + 0,5Qs)L/(ApEp)", sg.se, (500 * 0.25 + 0.5 * 500 * 0.75) * 15 / (0.02 * 2e8), 1e-12)
  near("rakit ekuivalen tiang gesek pada z0 + 2L/3", sg.zr, 1.5 + 10, 1e-12)
  near("sebaran 1H:4V: B' = Bg + L/3", sg.Br, 3.5 + 2 * 10 / 4, 1e-12)

  // ---- tata letak & reaksi tiang (cap kaku)
  truthy("grid persegi 4,2 × 4,2 m, s 1,25, ce 0,5 → 3 × 3", pileLayout("rect", 4.2, 4.2, 1.25, 0.5).length === 9)
  const lay = pileLayout("rect", 6, 4, 1.5, 0.5), gp = ft.pileGroup(lay)
  const Rr = ft.pileReact(gp, { P: 1200, Mx: 150, My: 300, H: 60 })
  near("ΣPi = P", Rr.Pi.reduce((a, b) => a + b, 0), 1200, 1e-12)
  near("ΣPi·xi = My", Rr.Pi.reduce((a, p, i) => a + p * lay[i].x, 0), 300, 1e-9)
  near("ΣPi·yi = Mx", Rr.Pi.reduce((a, p, i) => a + p * lay[i].y, 0), 150, 1e-9)
  const circ = pileLayout("circle", 11.2, 11.2, 1.6, 0.5)
  truthy("tata letak lingkaran: semua tiang di dalam Ø − 2ce", circ.every((p) => Math.hypot(p.x, p.y) <= 5.1 + 1e-9) && circ.length > 20)
  // pile cap: lentur di muka pedestal dari reaksi titik (2 tiang simetris, tanpa berat sendiri)
  const m = { shape: "rect", B: 3, L: 1, t: 0.8, Df: 0.8, gs: 0, gc: 0, peds: [{ x: 0, y: 0, shape: "rect", bx: 0.6, by: 0.6, h: 0 }], piles: [{ x: -1, y: 0 }, { x: 1, y: 0 }], pileD: 0.4 }
  const cb = [{ id: "U", kind: "LRFD", fD: 1.2, vec: [1000, 0, 0, 0, 0] }, { id: "A", kind: "ASD", fD: 1, vec: [1000, 0, 0, 0, 0] }]
  const rf = ft.analyzeFooting(m, cb, { qa: 1, mu: 0.5 }, { fsOT: 1.5, fsSL: 1.5 }, { fc: 30, fy: 420, cover: 75, db: 16 }, { fc: 30, fy: 420, n: 8, db: 16, cover: 50 })
  near("pile cap: Mu muka pedestal = R·(x − c/2)/L", rf.reinf.x.Mpos, 500 * (1 - 0.3) / 1, 1e-6)
  truthy("pile cap: tanpa pemeriksaan tekanan tanah", !rf.checks.some((c) => /Tekanan tanah maks|soil pressure/.test(c.item)))

  // ---- gempa
  const spx = seismicParams(0.8, 0.35, "SD")
  truthy("KDS: SDS ≥ 0,5 → D", sdc(spx.SDS, spx.SD1, 0.35, "II") === "D")
  truthy("KDS: S1 ≥ 0,75 & kategori IV → F", sdc(1.2, 0.8, 0.8, "IV") === "F")
  truthy("KDS: SDS 0,2, SD1 0,1, kat. II → B", sdc(0.2, 0.1, 0.1, "II") === "B")
  const spc = spectrum(spx, 8, 4, 400)
  near("spektrum: Sa(0) = 0,4·SDS", spc[0][1], 0.4 * spx.SDS, 1e-12)
  near("spektrum: Sa(1 s) = SD1", spc[100][1], spx.SD1, 1e-12)
}
