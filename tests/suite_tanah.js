// Kelompok uji data tanah & pondasi dalam (js/desain/soil.js, deep.js, footing.js dengan tiang): korelasi, kelas situs SNI 1726, faktor daya dukung,
// Meyerhof N-SPT/CPT, Skempton, kapasitas tiang (API vs pile.js, N-SPT Meyerhof, CPT LCPC), penurunan (konsistensi dengan penurunan.js),
// tata letak & reaksi tiang, pelat tangki di atas tiang, dan spektrum SNI 1726.
import * as S from "../js/desain/soil.js"
import * as pl from "../js/desain/pile.js"
import * as ft from "../js/desain/footing.js"
import { pileLayout, singlePile, effPile, pileSprings } from "../js/desain/deep.js"
import { TV90, uOfTv } from "../js/penurunan.js"
import { analyze, overburden } from "../js/penurunan.js"
import { projDefaults, soilDSOf, soilDS, projLoad, projJSON, addSoil, addSoilRange, delSoil, setRef, sortSoils, modSoil, soilCopy, editSoil, MAX_PTS } from "../js/project.js"
import { usage, bankTable, planDraw, overlayDraw, hasPlan } from "../js/bank_ui.js"
import { palette } from "../js/desain/draw.js"
import { collectCases, computeCase } from "../js/penurunan_ui.js"
import { designCtx, runMod, ownSoil } from "../js/desain_ui.js"
import * as mVessel from "../js/desain/m_vessel.js"
import * as mTiang from "../js/desain/m_tiang.js"
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

  // ---- data per interval (mis. 0,5 m s.d. 30 m): banyak baris, sel kosong, alat bantu input
  const base5 = S.defaultSoil(), fine = S.resampleSoil(base5, 0.5, 35)
  truthy("bagi per interval 0,5 m s.d. 35 m → 70 baris setebal 0,5 m", fine.layers.length === 70 && fine.layers.every((l) => Math.abs(l.h - 0.5) < 1e-9))
  truthy("gabung baris yang sama → kembali 5 lapis bawaan", S.mergeRows(fine).layers.length === 5 && S.mergeRows(fine).layers.map((l) => l.h).join() === "3,6,8,8,10")
  truthy("batas baris: lebih dari MAX_ROWS ditolak", (() => { try { S.resampleSoil(base5, 0.1, 30); return false } catch (e) { return true } })())
  const dA = S.deriveSoil(base5), dB = S.deriveSoil(fine)
  near("kelas situs sama untuk 5 lapis vs 70 baris", S.siteClass(dB).Nbar, S.siteClass(dA).Nbar, 1e-9)
  for (const m of ["spt", "cpt", "vesic"]) near(`qa ${m} sama untuk 5 lapis vs 70 baris`, S.shallowQa(dB, 2.5, 2.5, 1.5, m, 3).qa, S.shallowQa(dA, 2.5, 2.5, 1.5, m, 3).qa, 1e-9)
  const sA = S.settleShallow(dA, { shape: "persegi", B: 3, L: 3, Df: 1.5, q: 200 }, { life: 20 }).res, sB = S.settleShallow(dB, { shape: "persegi", B: 3, L: 3, Df: 1.5, q: 200 }, { life: 20 }).res
  near("konsolidasi: baris lempung tipis bersambung = satu strata (s 20 th sama)", sB.s_life, sA.s_life, 0.01)
  near("konsolidasi: t90 tidak dipercepat oleh baris tipis", sB.t90, sA.t90, 0.03)
  truthy("konsolidasi: Hdr tiap baris = ½ tebal strata lempungnya (1,5 m → 0,75; 8 m → 4)", Math.abs(sB.cons[0].Hdr - 0.75) < 1e-9 && Math.abs(sB.cons[3].Hdr - 4) < 1e-9 && sB.cons[0].grp !== sB.cons[3].grp)
  const gA = S.settleGroup(dA, { D: 0.4064, Lp: 18, Ap: 0.0157, Ep: 2e8, n: 4, Bg: 2.2, Lg: 2.2, Q: 1600, Qb: 300, Qu: 2000, qb: 5000, z0: 1.5, driven: true })
  const gB = S.settleGroup(dB, { D: 0.4064, Lp: 18, Ap: 0.0157, Ep: 2e8, n: 4, Bg: 2.2, Lg: 2.2, Q: 1600, Qb: 300, Qu: 2000, qb: 5000, z0: 1.5, driven: true })
  near("penurunan kelompok tiang sama untuk 5 lapis vs 70 baris", gB.total, gA.total, 0.01)
  // interpolasi N kosong & γ
  const holes = fine.layers.map((l, i) => (i % 4 === 0 ? { ...l, N: 8 + i, qc: null } : { ...l, N: null, qc: null }))
  const dH = S.deriveSoil({ ...fine, layers: holes })
  truthy("N kosong diinterpolasi linier: 8 → 9 → 10 → 11 → 12 (z 0,25…2,25 m)", [0, 1, 2, 3, 4].every((i) => Math.abs(dH.layers[i].N60 - (8 + i)) < 1e-9) && dH.layers[1].est.N && !dH.layers[0].est.N)
  truthy("interpolasi diutamakan di lapis sejenis (tidak melintas batas lempung–pasir)", Math.abs(dH.layers[5].N60 - 12) < 1e-9 && Math.abs(dH.layers[6].N60 - 16) < 1e-9)
  truthy("N = 0 tetap data (WOH), bukan kosong", S.deriveSoil({ ...base5, layers: [{ ...base5.layers[0], N: 0, qc: null }, base5.layers[1]] }).layers[0].N60 === 0)
  const dG = S.deriveSoil({ ...base5, layers: [{ ...base5.layers[0], g: null, gsat: null }, { ...base5.layers[0], g: null, gsat: null, h: 1 }, { ...base5.layers[1], g: null, gsat: null }] })
  truthy("γ kosong: baris pertama nilai tipikal, sejenis ikut atas, jenis lain nilai tipikal", dG.layers[0].g === 17 && dG.layers[1].gsat === 18 && dG.layers[2].g === 18 && dG.layers[2].gsat === 20 && dG.layers[0].est.g)
  // tempel dari Excel
  const p1 = S.parseSoilPaste("Kedalaman (m)\tJenis\tN-SPT\n0,5\tLempung\t4\n1,0\tLempung\t\n1,5\tPasir lanauan\t14\n", { test: "spt", base: base5 })
  truthy("tempel: kolom dari judul, koma desimal, sel kosong → null, 'pasir lanauan' → pasir", p1.mapped && p1.n === 3 && p1.layers[1].N === null && p1.layers[0].N === 4 && p1.layers[2].type === "sand" && Math.abs(p1.layers[2].h - 0.5) < 1e-12)
  const p2 = S.parseSoilPaste("2 12\n4 18 pasir\n6 25\n", { test: "spt", base: base5 })
  truthy("tempel tanpa judul: kedalaman N [jenis]; jenis kosong dari profil saat ini", !p2.mapped && p2.layers.map((l) => `${l.h}/${l.type}/${l.N}`).join() === "2/clay/12,2/sand/18,2/sand/25")
  const p3 = S.parseSoilPaste("z;qc;fs\n0,2;100;1\n0,4;50;0,5\n", { test: "cpt", base: base5, qcUnit: "kgcm2", fsUnit: "kgcm2" })
  near("tempel sondir: qc kg/cm² → MPa (×0,0980665)", p3.layers[0].qc, 9.80665, 1e-12); near("tempel sondir: fs kg/cm² → kPa (×98,0665)", p3.layers[1].fs, 49.03325, 1e-12)
  const p4 = S.parseSoilPaste("0.0–3.0\tLempung\t17\t17.8\t10\t0.95\t35\n3.0–9.0\tPasir\t18\t19.5\t18\t–\t70\n", { test: "spt", base: base5 })
  truthy("tempel tabel ekspor app (rentang z, jenis, γ, γsat, N, qc, fs)", p4.layers.map((l) => `${l.h}/${l.type}/${l.g}/${l.N}/${l.qc}`).join() === "3/clay/17/10/0.95,6/sand/18/18/null")
  truthy("jenis dari teks: pasir lanauan → pasir, silty sand → pasir, lanau kepasiran → lanau, sandy clay → lempung", ["pasir lanauan", "Silty sand", "lanau kepasiran", "Sandy CLAY", "kerikil"].map(S.typeFromText).join() === "sand,sand,silt,clay,gravel")
  // kelas situs: N lapangan tanpa koreksi energi, maks. 100
  truthy("kelas situs memakai N lapangan (Er tidak mengubah N̄)", Math.abs(S.siteClass(soil([ly(30, "sand", 30)], { Er: 90 })).Nbar - 30) < 1e-9)
  near("kelas situs: N tiap lapis dibatasi 100", S.siteClass(soil([ly(15, "sand", 150), ly(15, "sand", 50)])).Nbar, 30 / (15 / 100 + 15 / 50), 1e-12)
  // ujung tiang N-SPT (Meyerhof): N̄ 10D di atas s.d. 4D di bawah, Lb = penetrasi ke lapis pasir
  const lay2 = soil([ly(12, "clay", 8), ly(18, "sand", 30)])
  const sp2 = S.pileAxial(lay2, { D: 0.5, t: 0.0127, Lp: 14, open: false, method: "spt", kind: "pipe", z0: 0 })
  near("Meyerhof: Lb = ujung − puncak lapis pasir (14 − 12 = 2 m)", sp2.tip.Lb, 2, 1e-12)
  near("Meyerhof: N̄ ujung rata-rata 10D di atas s.d. 4D di bawah", sp2.tip.Nb, (3 * 8 + 4 * 30) / 7, 1e-9)
  near("Meyerhof: q = min(40·N̄·Lb/D, 400·N̄)", sp2.q, Math.min(40 * sp2.tip.Nb * 2 / 0.5, 400 * sp2.tip.Nb), 1e-12)
  // LCPC: qca ±1,5D dibatasi 0,7–1,3 qca'
  const cpL = S.deriveSoil({ name: "C", test: "cpt", gwt: 99, Er: 60, Nkt: 15, Gs: 2.7, layers: [{ ...ly(9.75, "sand", 0), qc: 10 }, { ...ly(0.5, "sand", 0), qc: 40 }, { ...ly(20, "sand", 0), qc: 10 }] })
  const cL = S.pileAxial(cpL, { D: 0.5, t: 0.0127, Lp: 10, open: false, method: "cpt", kind: "pipe", z0: 0 })
  near("LCPC: qca' = rata-rata qc pada ±1,5D (⅓ zona berisi lonjakan 40 MPa)", cL.tip.qca1, 10 + 30 * 0.5 / 1.5, 0.02)
  truthy("LCPC: qc dipangkas 0,7–1,3·qca' (lonjakan turun, nilai rendah naik) → qca < qca'", cL.tip.qca < cL.tip.qca1 && Math.abs(cL.tip.qca - (2 * 0.7 * cL.tip.qca1 + 1.3 * cL.tip.qca1) / 3) < 0.4)
  // Ic CPT (Robertson): pasir bersih vs lempung
  const icS = S.cptIc(15, 75, 100, 60), icC = S.cptIc(0.8, 40, 100, 60)
  near("Ic = √((3,47 − log Qt)² + (log Fr + 1,22)²)", icS.Ic, Math.sqrt((3.47 - Math.log10((15000 - 100) / 60)) ** 2 + (Math.log10(75 / (15000 - 100) * 100) + 1.22) ** 2), 1e-12)
  truthy("Ic: qc 15 MPa, fs 75 kPa → pasir; qc 0,8 MPa, fs 40 kPa → lempung", icS.type === "sand" && icC.type === "clay")
  const cls = S.classifyCpt({ ...base5, test: "cpt", layers: [{ ...base5.layers[0], type: "sand", qc: 0.4, fs: 30 }, { ...base5.layers[1], type: "clay", qc: 15, fs: 75 }] })
  truthy("jenis dari Ic mengganti jenis baris", cls.n === 2 && cls.soil.layers[0].type === "clay" && cls.soil.layers[1].type === "sand")
  // Vesic dq untuk Df/B > 1 memakai arctan
  const vs = S.shallowQa(soil([ly(30, "sand", 25)]), 1, 1, 2, "vesic", 3), phiV = vs.rows.find((r) => String(r[0]).startsWith("φ"))
  truthy("Vesic dq (Df/B = 2) = 1 + 2tanφ(1 − sinφ)²·arctan(2)", String(vs.rows.find((r) => String(r[0]).startsWith("qult"))[2]).includes(`dq ${(1 + 2 * Math.tan(parseFloat(phiV[3]) * Math.PI / 180) * (1 - Math.sin(parseFloat(phiV[3]) * Math.PI / 180)) ** 2 * Math.atan(2)).toFixed(2)}`))
  // lateral: tanah atas = jenis dominan 5D, bukan baris pertama
  const tz = pl.topZone([{ h: 0.5, type: "sand", phi: 30, cu: 0 }, { h: 3, type: "clay", cu: 40, phi: 0 }], 0.4)
  truthy("lateral: zona atas 5D (2 m) didominasi lempung meski baris pertama pasir", tz.type === "clay" && Math.abs(tz.cu - 40) < 1e-12)
  // pencarian cepat = penjumlahan langsung
  const lays = S.pileLayers(dB, 1.5), P0 = pl.profile(lays, 3), naive = (zz) => { let s2 = 0, z = 0; for (let i = 0; i < lays.length && z < zz; i++) { const a = z, b = Math.min(zz, i === lays.length - 1 ? zz : z + lays[i].h), g = lays[i].g, dry = Math.max(0, Math.min(b, 3) - a), wet = Math.max(0, b - Math.max(a, 3)); s2 += g * dry + (g - 9.81) * wet; z += lays[i].h } return s2 }
  truthy("profil tiang: σ'v pencarian biner = penjumlahan langsung (60 kedalaman)", Array.from({ length: 60 }, (_, i) => i * 0.613).every((zz) => Math.abs(P0.sv(zz) - naive(zz)) < 1e-9))
  truthy("stressAt cepat = lambat (100 kedalaman, termasuk di bawah dasar bor)", Array.from({ length: 100 }, (_, i) => i * 0.47).every((zz) => { const [a, b] = S.stressAt(dB, zz), ds0 = { ...dB, layers: dB.layers.map(({ st0, ...l }) => l) }, [c, d] = S.stressAt(ds0, zz); return Math.abs(a - c) < 1e-9 && Math.abs(b - d) < 1e-9 }))
  near("TV90 = 0,848", TV90, 0.848, 2e-3)

  // ---- timbunan baru, penurunan tanah, gesekan negatif & bidang netral, koefisien pegas
  const FL = (o) => ({ ...S.FILL0, on: true, ...o })
  const prof = [ly(4, "clay", 4, { OCR: 1, Cc: 0.3, Cs: 0.05, e0: 1.0 }), ly(10, "sand", 30)]
  const d0 = soil(prof), dF = soil(prof, { fill: FL({ H: 2, g: 20, type: "sand", N: 12 }) })
  truthy("tanpa timbunan (on = false / H = 0 & Δh = 0) → profil identik, ds.fill = null", soil(prof, { fill: { ...S.FILL0 } }).fill === null && soil(prof, { fill: FL({ H: 0, dGwt: 0 }) }).fill === null && JSON.stringify(soil(prof, { fill: FL({ on: false, H: 3 }) }).layers) === JSON.stringify(d0.layers))
  truthy("timbunan: baris timbunan di atas, z = 0 puncak timbunan, kedalaman & MAT + H", dF.layers.length === 3 && dF.layers[0].fill && dF.layers[0].z1 === 2 && Math.abs(dF.depth - d0.depth - 2) < 1e-12 && Math.abs(dF.gwt - d0.gwt - 2) < 1e-12 && Math.abs(dF.layers[1].z0 - 2) < 1e-12)
  truthy("timbunan: korelasi tanah asli memakai σ'v sebelum timbunan (cu, φ, N1 tidak berubah)", dF.layers[1].cu === d0.layers[0].cu && dF.layers[2].phi === d0.layers[1].phi && dF.layers[2].N1 === d0.layers[1].N1)
  near("timbunan: σ'v desain = σ'v asli + γf·H", S.stressAt(dF, 2 + 7.3)[1], S.stressAt(d0, 7.3)[1] + 40, 1e-12)
  near("timbunan: σ'v di dalam timbunan = γf·z", S.stressAt(dF, 1.5)[1], 20 * 1.5, 1e-12)
  const l1 = dF.layers[1]
  near("OCR desain sesudah timbunan = maks(OCR·σ'0; σ'0 + Δσ)/(σ'0 + Δσ)", l1.OCRd, Math.max(l1.OCR * l1.svp0, l1.svp0 + 40) / (l1.svp0 + 40), 1e-12)
  // penurunan tanah akibat timbunan: lempung NC 4 m (8 sub-lapis) + pasir elastis 10 m
  const fsl = S.fillSettle(dF, 20), Msand = (() => { const l = dF.layers[2], nu = l.nu; return l.E * (1 - nu) / ((1 + nu) * (1 - 2 * nu)) })()
  let scl = 0
  for (let i = 0; i < 8; i++) { const z = 0.25 + 0.5 * i, s0 = 18 * z; scl += 0.5 / 2 * 0.3 * Math.log10((s0 + 40) / s0) }
  near("konsolidasi akibat timbunan = Σ h/(1+e0)·Cc·log((σ'0 + Δσ)/σ'0) + pasir Δσ·H/M", fsl.fin, scl + 40 * 10 / Msand, 1e-9)
  near("sebelum konstruksi (tPre = 0) = pemampatan pasir seketika", fsl.s1, 40 * 10 / Msand, 1e-9)
  near("sisa sesudah konstruksi = sc·U(cv·t2/Hdr²), Hdr = ½·4 m", fsl.rem, scl * uOfTv(2 * 20 / 4), 1e-9)
  truthy("profil penurunan: di dalam timbunan = muka tanah asli, di bawah lempung = 0 (pasir seketika)", Math.abs(fsl.remAt(0.7) - fsl.rem) < 1e-12 && fsl.remAt(6.01) === 0 && fsl.remAt(4) > 0 && fsl.remAt(4) < fsl.rem)
  const fsW = S.fillSettle(soil(prof, { fill: FL({ H: 2, g: 20, tPre: 1 }) }), 20)
  near("masa tunggu 1 th: sisa = sc·[U(t1 + umur) − U(t1)]", fsW.rem, scl * (uOfTv(2 * 21 / 4) - uOfTv(2 * 1 / 4)), 1e-9)
  // penurunan MAT saja (pasir): Δσ' = γw·min(maks(z − MAT, 0), Δh), sesudah konstruksi
  const dW = soil([ly(10, "sand", 20)], { gwt: 1, fill: FL({ H: 0, dGwt: 2 }) }), lw = dW.layers[0], Mw = lw.E * (1 - lw.nu) / ((1 + lw.nu) * (1 - 2 * lw.nu))
  let sw = 0
  for (let i = 0; i < 20; i++) sw += 9.81 * Math.min(Math.max(0.25 + 0.5 * i - 1, 0), 2) * 0.5 / Mw
  near("penurunan MAT Δh = 2 m pada pasir: Σ γw·Δh(z)·h/M (seluruhnya sesudah konstruksi)", S.fillSettle(dW, 20).rem, sw, 1e-9)
  // gesekan negatif: lempung lunak 10 m + pasir padat, timbunan 2 m
  const dN = soil([ly(10, "clay", 3, { OCR: 1, Cc: 0.4, Cs: 0.06, e0: 1.2 }), ly(25, "sand", 40)], { gwt: 1, fill: FL({ H: 2, g: 19 }) })
  const axN = S.pileAxial(dN, { D: 0.5, t: 0.0127, Lp: 16, open: false, method: "api", kind: "pipe", z0: 1 }), EA = 2e8 * Math.PI / 4 * (0.5 ** 2 - (0.5 - 0.0254) ** 2)
  near("pileAxial: Σ fs·πD·Δz per segmen = Qs luar", Array.from(axN.seg.f).reduce((a, f) => a + f * Math.PI * 0.5 * axN.seg.dz, 0), axN.Qso, 1e-9)
  const rs = [0, 400, 900].map((Qd) => S.negSkin(dN, axN, { Qd, EA, life: 20 }))
  truthy("bidang netral: keseimbangan gaya Qd + Qn = Rs(bawah NP) + Rt", rs.every((r) => Math.abs(r.Qmax - r.RsBelow - r.Rt) < 1e-6 * Math.max(r.Qmax, 1)))
  truthy("bidang netral: kesesuaian penurunan — penurunan tiang = tanah di NP; δ ujung sesuai kurva q–z", rs.every((r) => r.none || Math.abs(r.Rt - r.Rtu * Math.sqrt(Math.min(Math.max(r.dT, 0) / r.du, 1))) < 1e-3 * Math.max(r.Rtu, 1)))
  truthy("bidang netral naik & gaya maks bertambah bila beban tetap Qd naik", rs[0].zn > rs[1].zn && rs[1].zn > rs[2].zn && rs[0].Qmax < rs[1].Qmax && rs[1].Qmax < rs[2].Qmax)
  truthy("NP di antara batas keseimbangan gaya Rt = 0 dan Rt = Rt,u", rs.every((r) => r.zn0 - 1e-6 <= r.zn && r.zn <= r.znU + 1e-6))
  let qnI = 0
  const zn1 = rs[1].zn, nI = 4000
  for (let i = 0; i < nI; i++) { const z = 1 + (zn1 - 1) * (i + 0.5) / nI, l = S.layerAt(dN, z); qnI += (l.coh ? 0.25 : 0.35) * S.stressAt(dN, z)[1] * Math.PI * 0.5 * (zn1 - 1) / nI }
  near("gaya seret Qn = Σ β·σ'v·πD·Δz (kepala → NP)", rs[1].Qn, qnI, 2e-3)
  truthy("beban sangat besar → tiang turun melebihi tanah, tanpa gesekan negatif", S.negSkin(dN, axN, { Qd: 50000, EA, life: 20 }).none)
  near("downdrag kepala = s_tanah(NP) + pemendekan di atas NP", rs[1].sHead, rs[1].sN + rs[1].ca, 1e-12)
  const g0 = { D: 0.5, Lp: 16, Ap: EA / 2e8, Ep: 2e8, n: 4, Bg: 2, Lg: 2, Q: 1600, Qb: axN.Qb, Qu: axN.Qc, qb: axN.q, z0: 1, driven: true, ax: axN }
  const sgN = S.settleGroup(dN, g0, { life: 20 }), sg0 = S.settleGroup(soil([ly(10, "clay", 3, { OCR: 1, Cc: 0.4, Cs: 0.06, e0: 1.2 }), ly(25, "sand", 40)], { gwt: 1 }), { ...g0, z0: 1, ax: S.pileAxial(soil([ly(10, "clay", 3, { OCR: 1, Cc: 0.4, Cs: 0.06, e0: 1.2 }), ly(25, "sand", 40)], { gwt: 1 }), { D: 0.5, t: 0.0127, Lp: 16, open: false, method: "api", kind: "pipe", z0: 1 }) }, { life: 20 })
  truthy("penurunan kelompok + downdrag di NP (analisis terpadu); tanpa timbunan tidak ada downdrag", sgN.dd && sgN.dd.how === "np" && Math.abs(sgN.sdd - S.negSkin(dN, axN, { Qd: 400, EA, life: 20 }).sN) < 1e-9 && sg0.dd === null && sg0.sdd === 0)
  const shF = S.settleShallow(dN, { shape: "persegi", B: 2, L: 2, Df: 1.5, q: 120 }, { life: 20 })
  near("pondasi dangkal + sisa penurunan tanah akibat timbunan di Df", shF.sf, S.fillSettle(dN, 20).remAt(1.5), 1e-12)
  // desain tiang: terpadu vs konvensional
  const pile0 = { ...projDefaults().pile, kind: "pipe", D: 508, t: 12.7, open: false, L: 22, method: "api", z0: 1 }
  const spU = singlePile(effPile({ pSrc: "proj" }, { pile: pile0 }), dN, 1), nsU = spU.ns
  truthy("Qa terpadu: ≤ min(Qu/FS; Pa) dan Qd + Qn ≤ Pa di NP", nsU.uni.Qa <= Math.min(spU.Qac, spU.Pstr) + 1e-6 && nsU.uni.r.Qmax <= spU.Pstr * (1 + 1e-6))
  const rC = nsU.conv.r
  truthy("Qa konvensional = (Qu − Rs,atas NP)/FS − Qn ≤ Pa − Qn dan < Qa terpadu", nsU.conv.Qa > 0 && Math.abs(nsU.conv.Qa - Math.min((spU.ax.Qc - rC.RsAbove) / pile0.fsC - rC.Qn, spU.Pstr - rC.Qn)) < 1 && nsU.conv.Qa < nsU.uni.Qa)
  const spC = singlePile(effPile({ pSrc: "proj" }, { pile: pile0 }), soil([ly(10, "clay", 3, { OCR: 1, Cc: 0.4, Cs: 0.06, e0: 1.2 }), ly(25, "sand", 40)], { gwt: 1, fill: FL({ H: 2, g: 19, meth: "conv" }) }), 1)
  truthy("metode konvensional dipakai untuk Qa desain bila dipilih; tanpa timbunan Qa = min(Qu/FS; Pa)", Math.abs(spC.Qad - spC.ns.conv.Qa) < 1e-6 && singlePile(effPile({ pSrc: "proj" }, { pile: pile0 }), d0, 1).ns === null)
  // koefisien pegas
  const ksD = soil([ly(30, "sand", 20)], { gwt: 5 }), qaK = S.shallowQa(ksD, 2, 2, 1, "spt", 3).qa, kS = S.shallowSprings(ksD, { B: 2, L: 2, Df: 1, qa: qaK, FS: 3, settle: S.SETTLE_OPT })
  near("ks Bowles = 40·FS·qa", kS.bow, 40 * 3 * qaK, 1e-12)
  near("ks Vesic = Es/(B(1 − ν²))", kS.ves, ksD.layers[0].E / (2 * (1 - 0.3 ** 2)), 1e-12)
  const stK = S.settleShallow(ksD, { shape: "persegi", B: 2, L: 2, Df: 1, q: qaK }, S.SETTLE_OPT)
  near("ks dari penurunan segera = q_net/si", kS.kI, stK.res.q_net / stK.res.si, 1e-12)
  const clayP = soil([ly(30, "clay", 10)], { gwt: 0 }), pileK = { ...projDefaults().pile, kind: "pipe", D: 406.4, t: 12.7, L: 15, z0: 0 }
  const psK = pileSprings(effPile({ pSrc: "proj" }, { pile: pileK }), clayP, 0, { Q: 300, dz: 1, settle: S.SETTLE_OPT })
  const KF = [0, 1].map((i) => [0, 1].map((j) => psK.K[i][0] * psK.F[0][j] + psK.K[i][1] * psK.F[1][j]))
  truthy("matriks kekakuan kepala bebas = invers fleksibilitas (K·F = I)", Math.abs(KF[0][0] - 1) < 1e-9 && Math.abs(KF[1][1] - 1) < 1e-9 && Math.abs(KF[0][1]) < 1e-9 && Math.abs(KF[1][0]) < 1e-9)
  near("Kyy kepala bebas = kekakuan kepala jepit H/y (θ = 0)", psK.K[0][0], psK.KhFix, 1e-6)
  near("pegas lateral lempung: k titik tengah = 67·cu·Δz, kh = 67·cu/D", psK.nodes[5].k, 67 * 60 * 1, 1e-9)
  truthy("pegas titik ujung = ½Δz; kh lempung = 67cu/D", Math.abs(psK.nodes[0].k - 67 * 60 * 0.5) < 1e-9 && Math.abs(psK.nodes[3].kh - 67 * 60 / 0.4064) < 1e-9 && psK.nodes.length === 16)
  near("pegas vertikal kv = Q/s1 (Vesic)", psK.kv, 300 / psK.s1, 1e-12)

  // ---- sumber data tanah per modul Desain: tab Tanah (proyek) atau diisi di modul
  const PJ = projDefaults(), SD = { site: { V: 32, exp: "C", Kzt: 1, Kd: 0.95, TL: 8 } }, CM = { en: {}, fx: {}, ortho: false, wp: 0.5 }
  const soft = JSON.parse(JSON.stringify(PJ.soil)); soft.name = "BH-MOD"; soft.layers = soft.layers.map((l) => ({ ...l, N: Math.min(l.N, 4) }))
  const stP = { ...mVessel.defaults() }, stO = { ...mVessel.defaults(), soilSrc: "own", soilOwn: soft }
  truthy("ownSoil: hanya bila dipilih 'Isi di modul ini' dan ada lapisan", !ownSoil(stP) && ownSoil(stO) && !ownSoil({ soilSrc: "own", soilOwn: { layers: [] } }) && !ownSoil(undefined))
  const cP = designCtx(SD, PJ, CM, stP), cO = designCtx(SD, PJ, CM, stO)
  truthy("konteks: tab Tanah → data proyek; modul → data modul", cP.soil === soilDS(PJ) && !cP.soilOwn && cO.soilOwn && cO.soil.name === "BH-MOD" && cO.soil.layers[0].N60 <= 4)
  truthy("kelas situs otomatis dari data tanah modul (tanah lunak → SE)", cP.ss.cls === "SD" && cO.ss.cls === "SE" && cO.ss.sp.SDS !== cP.ss.sp.SDS)
  truthy("soilDSOf: memo untuk data sama, hitung ulang bila data berubah", soilDSOf(soft, PJ) === soilDSOf(JSON.parse(JSON.stringify(soft)), PJ) && soilDSOf({ ...soft, gwt: 3 }, PJ).gwt === 3)
  const oP = runMod(mVessel, stP, cP), oO = runMod(mVessel, stO, cO)
  truthy("modul memakai data tanahnya: qa lebih kecil & telapak lebih besar pada tanah lunak modul", parseFloat(oO.flow[0].v.replace(/[^0-9.]/g, "")) < parseFloat(oP.flow[0].v.replace(/[^0-9.]/g, "")) && oO.settle.s > oP.settle.s)
  truthy("ringkasan masukan mencatat sumber data tanah", oO.kv[0].rows[0][1].includes("modul") && oP.kv[0].rows[0][1].includes("Tanah"))
  const tO = runMod(mTiang, { ...mTiang.defaults(), soilSrc: "own", soilOwn: soft }, designCtx(SD, PJ, CM, { soilSrc: "own", soilOwn: soft })), tP = runMod(mTiang, mTiang.defaults(), cP)
  truthy("modul tiang: opsi data modul memakai profil N-SPT/CPT modul (Qa lebih kecil)", tO.R.Qac < tP.R.Qac)

  // ---- bank data tanah: banyak titik bor / sondir per proyek, modul memilih titik
  const KP = "ymd.project.v1", KD = "ymd.desain.v1", keep = [KP, KD].map((k) => [k, localStorage.getItem(k)])
  try {
    const P0 = projDefaults()
    truthy("bawaan: satu titik, P.soil = titik acuan (objek yang sama)", P0.soils.length === 1 && P0.soil === P0.soils[0] && P0.soilRef === P0.soil.id && P0.soilEdit === P0.soil.id)
    // migrasi data lama (satu titik di P.soil) → bank berisi titik itu
    const old = JSON.parse(JSON.stringify(P0)); delete old.soils; delete old.soilRef; delete old.soilEdit; old.soil.name = "BH-LAMA"; delete old.soil.id; old.soil.layers[0].N = 7
    localStorage.setItem(KP, JSON.stringify(old))
    const Pm = projLoad()
    truthy("migrasi: data tanah lama menjadi titik pertama & acuan", Pm.soils.length === 1 && Pm.soil === Pm.soils[0] && Pm.soil.name === "BH-LAMA" && Pm.soil.layers[0].N === 7 && Pm.soil.id === "bhlama" && Pm.soilRef === "bhlama")
    // buat BH-1…BH-10 dan S-1…S-10 sekaligus
    const P = projLoad()
    const r1 = addSoilRange(P, { prefix: "BH-", from: 1, to: 10, pad: 1, test: "spt" }), r2 = addSoilRange(P, { prefix: "S-", from: 1, to: 10, pad: 1, test: "cpt" })
    truthy("buat banyak titik: BH-1…BH-10 (N-SPT) + S-1…S-10 (CPT), ditandai data contoh", r1.made.length === 10 && r2.made.length === 10 && P.soils.length === 21 && r2.made.every((x) => x.test === "cpt" && x.tpl) && r1.made[9].name === "BH-10" && r1.made.every((x) => x.test === "spt"))
    const r3 = addSoilRange(P, { prefix: "bh-", from: 9, to: 12, pad: 1, test: "spt" })
    truthy("nama yang sudah ada dilewati (tanpa beda huruf besar/kecil)", r3.made.map((x) => x.name).join() === "bh-11,bh-12" && r3.skip.join() === "bh-9,bh-10" && new Set(P.soils.map((x) => x.id)).size === P.soils.length)
    sortSoils(P)
    truthy("urut nama alami: BH-2 sebelum BH-10", P.soils.findIndex((x) => x.name === "BH-2") < P.soils.findIndex((x) => x.name === "BH-10") && P.soils.findIndex((x) => x.name === "BH-10") < P.soils.findIndex((x) => x.name === "S-1"))
    // titik lunak BH-3 dan titik keras BH-7
    const bh3 = P.soils.find((x) => x.name === "BH-3"), bh7 = P.soils.find((x) => x.name === "BH-7")
    bh3.layers = bh3.layers.map((l) => ({ ...l, N: Math.min(l.N, 4) })); delete bh3.tpl; bh3.x = 100; bh3.y = 50; bh3.elev = 2.5
    bh7.layers = bh7.layers.map((l) => ({ ...l, N: Math.max(l.N, 45) })); delete bh7.tpl; bh7.x = 160; bh7.y = 90
    // simpan hemat & muat ulang
    const js = projJSON(P), back = JSON.parse(js)
    truthy("penyimpanan: alias P.soil tidak ditulis, kolom lanjutan bernilai 0 dibuang", !("soil" in back) && back.soils.length === P.soils.length && !("cu" in back.soils[0].layers[0]) && js.length < JSON.stringify(P).length * 0.7)
    localStorage.setItem(KP, js)
    const P2 = projLoad(), b3 = P2.soils.find((x) => x.name === "BH-3")
    truthy("muat ulang: semua titik, urutan, lokasi & kolom lanjutan (0 = otomatis) kembali", P2.soils.length === P.soils.length && P2.soils.map((x) => x.name).join() === P.soils.map((x) => x.name).join() && b3.x === 100 && b3.elev === 2.5 && b3.layers[0].cu === 0 && b3.layers[0].N <= 4 && P2.soil === P2.soils.find((x) => x.id === P2.soilRef))
    // pemilihan titik per modul
    truthy("modSoil: '' = titik acuan, id = titik itu, id terhapus → acuan, 'own' = data modul",
      modSoil({ soilSrc: "project", soilPt: "" }, P).kind === "ref" && modSoil({ soilSrc: "project", soilPt: bh3.id }, P).so === bh3 && modSoil({ soilSrc: "project", soilPt: "hilang" }, P).lost === "hilang" && modSoil({ soilSrc: "own", soilOwn: soilCopy(P, bh3.id) }, P).kind === "own" && modSoil({ soilSrc: "project", soilPt: P.soilRef }, P).kind === "ref")
    const cp = soilCopy(P, bh3.id)
    truthy("salin titik ke data modul: isi titik terpilih tanpa id / tanda contoh", cp.name === "BH-3" && !("id" in cp) && !("tpl" in cp) && cp.layers !== bh3.layers && cp.layers[0].N === bh3.layers[0].N)
    const st3 = { ...mVessel.defaults(), soilPt: bh3.id }, st7 = { ...mVessel.defaults(), soilPt: bh7.id }, stR = { ...mVessel.defaults() }
    const c3 = designCtx(SD, P, CM, st3), c7 = designCtx(SD, P, CM, st7), cR = designCtx(SD, P, CM, stR)
    truthy("konteks modul memakai titik terpilih; kelas situs otomatis dari titik itu", c3.soil.name === "BH-3" && c7.soil.name === "BH-7" && cR.soil === soilDS(P) && c3.ss.cls === "SE" && c7.ss.cls !== "SE" && c3.soilPt.kind === "pt")
    const o3 = runMod(mVessel, st3, c3), o7 = runMod(mVessel, st7, c7), qa = (o) => parseFloat(o.flow[0].v.replace(/[^0-9.]/g, ""))
    truthy("Gas Boot di BH-3 (lunak) → qa lebih kecil & penurunan lebih besar daripada di BH-7 (keras)", qa(o3) < qa(o7) && o3.settle.s > o7.settle.s)
    truthy("ringkasan masukan mencatat titik & lokasinya", o3.kv[0].rows[0][1].includes("BH-3") && o3.kv[0].rows.some((r) => String(r[1]).includes("X 100")) && runMod(mVessel, stR, cR).kv[0].rows[0][1].includes("★"))
    // titik acuan diganti → modul bersumber acuan ikut; modul yang memilih titik tetap
    setRef(P, bh7.id)
    truthy("ganti titik acuan: P.soil & modul 'titik acuan' ikut, modul dengan titik tertentu tetap", P.soil === bh7 && designCtx(SD, P, CM, stR).soil.name === "BH-7" && designCtx(SD, P, CM, st3).soil.name === "BH-3")
    // hapus titik
    const n0 = P.soils.length
    truthy("hapus titik acuan → acuan pindah ke titik lain; titik terakhir tidak bisa dihapus", delSoil(P, bh7.id) && P.soils.length === n0 - 1 && P.soil !== bh7 && P.soilRef === P.soil.id && !delSoil({ soils: [P.soil] }, P.soil.id))
    truthy("modul yang memilih titik terhapus kembali ke titik acuan (ditandai)", designCtx(SD, P, CM, st7).soilPt.lost === bh7.id && designCtx(SD, P, CM, st7).soil === soilDS(P))
    // batas jumlah titik
    const Pf = projDefaults(); addSoilRange(Pf, { prefix: "X", from: 1, to: 99, pad: 1, test: "spt" })
    truthy(`bank dibatasi ${MAX_PTS} titik`, Pf.soils.length === MAX_PTS && addSoil(Pf, { name: "Z" }) === null)
    // pemakaian titik oleh modul & kasus manual penurunan
    localStorage.setItem(KD, JSON.stringify({ m: { vessel: { preset: "gasboot", soilSrc: "project", soilPt: bh3.id }, trafo: { soilSrc: "own", soilOwn: cp }, tiang: { soilSrc: "manual" } } }))
    P.settle.manual = [{ kind: "shallow", label: "TK-1", shape: "persegi", B: 3, L: 3, Df: 1.5, q: 150, pt: bh3.id }]
    const u = usage(P)
    truthy("pemakaian: Gas Boot & kasus manual di BH-3; modul data sendiri / manual tidak dihitung", u.get(bh3.id).join() === "Gas Boot,Penurunan: TK-1" && u.get(P.soilRef).includes("Tangki") && !u.get(P.soilRef).includes("Trafo") && !u.get(P.soilRef).includes("Tiang"))
    const bt = bankTable(P)
    truthy("tabel ringkasan: satu baris per titik, data contoh ditandai ⚠", bt.rows.length === P.soils.length && bt.rows.find((r) => r.cells[0].startsWith("BH-3")).cells[11].includes("Gas Boot") && bt.rows.filter((r) => r.cells[0].includes("⚠")).length === P.soils.filter((x) => x.tpl).length)
    localStorage.setItem(KP, projJSON(P))
    const cases = await collectCases(P, "id"), man = cases.find((c) => c.src === "man"), gb = cases.find((c) => c.id === "mod:vessel")
    const rMan = computeCase(P, soilDS(P), man), rRef = computeCase(P, soilDS(P), { ...man, ds: null })
    truthy("penurunan: kasus manual & modul memakai titik terpilih (BH-3 lunak → penurunan lebih besar)", man.ds && man.ds.name === "BH-3" && gb.ds && gb.ds.name === "BH-3" && rMan.s > rRef.s && man.sub.includes("BH-3"))
    truthy("denah & grafik perbandingan: simbol per titik berkoordinat & garis per titik", hasPlan(P) === false && (() => { const bx = P.soils.find((x) => x.name === "BH-4"); bx.x = 120; bx.y = 70; const sv = planDraw(P, palette("print"), bh3.id); return hasPlan(P) && sv.querySelectorAll("circle").length >= 2 })() && (() => { const ov = overlayDraw(P, palette("print"), bh3.id), nReal = P.soils.filter((x) => !x.tpl).length; return ov.querySelectorAll("path").length >= nReal && ov.textContent.includes(`${P.soils.length - nReal} titik data contoh tidak digambar`) })())
  } finally { keep.forEach(([k, v]) => (v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v))) }
}
