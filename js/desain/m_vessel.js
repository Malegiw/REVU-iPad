// Modul halaman: Pondasi vessel — Gas Boot, Separator (horizontal), Instrument Air Receiver.
import { L, nf, toDisp, uName, expandCombos, seismicCoef } from "./core.js"
import { PRESETS, vesselCases, analyzeVessel, vesselModels, pick } from "./vessel.js"
import { ANCHOR, ANCHOR_D } from "./steel.js"
import { pmCurve } from "./rc.js"
import { loadsEditor, addUserLoads } from "./ui.js"
import { footFrom } from "./settle.js"
import { DEEP0, fdSection, qaFor, qaNote, isDeep, deepBundle, shallowSettle, effPile, autoCap, autoFoot, singlePile, flowDeep, flowShallow, flowStep, maxLoad } from "./deep.js"
import { palette, vesselDraw, footingPlan, pmChart } from "./draw.js"
import { skVessel, skVesselFound } from "./sketch.js"
import { vesselSteps } from "./steps.js"

export const id = "vessel"
export const icon = "⚗️"
export const title = () => L("Pondasi Gas Boot, Separator & IA Receiver", "Gas Boot, Separator & IA Receiver Foundation")
export const blurb = () => L("Vessel vertikal (oktagon/persegi) dan horizontal dua saddle: angin & gempa otomatis, stabilitas, tulangan telapak, geser satu/dua arah, pedestal P–M, baut angkur.", "Vertical (octagon/square) and two-saddle horizontal vessels: automatic wind & seismic, stability, footing steel, one-/two-way shear, pedestal P–M, anchor bolts.")
export const codes = "PIP STE03350 / STE03360 · PIP STC01015 · SNI 1727:2020 · SNI 1726:2019 · SNI 2847:2019 (ACI 318M-14 Bab 17) · SNI 8460:2017"

const base = { ...DEEP0, R: 2, Ie: 1.25, method: "cs", gs: 18, qa: 150, muB: 0.45, fsOT: 1.5, fsSL: 1.5, tempFac: 1, minContact: 0.5, fc: 30, fy: 420, cover: 75, db: 16, bg: "F1554_36", hef: 600, extra: [] }
export function defaults() { return { preset: "gasboot", ...base, ...PRESETS.gasboot } }
const BAR = { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25", 29: "D29", 32: "D32" }
export function form(s) {
  const v = (x) => x.kind === "v", h = (x) => x.kind === "h"
  return [
    { id: "eq", sketch: skVessel, icon: "⚗️", t: L("Peralatan", "Equipment"), fields: [
      { k: "preset", type: "seg", lab: L("Jenis", "Type"), opts: { gasboot: "Gas Boot", sep: L("Separator (horizontal)", "Separator (horizontal)"), iar: "Instrument Air Receiver" }, wide: true,
        on: (st, k) => { Object.assign(st, PRESETS[k]); st.R = k === "sep" ? 3 : 2 } },
      { k: "D", lab: L("Diameter vessel D", "Vessel diameter D"), u: "m", lo: 0.3, hi: 6 },
      { k: "H", lab: L("Tinggi vessel H di atas base plate", "Vessel height H above base plate"), u: "m", lo: 1, hi: 60, show: v },
      { k: "Ltt", lab: L("Panjang tangen–tangen L T/T", "Tangent-to-tangent length L T/T"), u: "m", lo: 1, hi: 40, show: h }, { k: "Ls", lab: L("Jarak saddle Ls", "Saddle spacing Ls"), u: "m", lo: 0.5, hi: 30, show: h },
      { k: "hc", lab: L("Tinggi sumbu hc dari puncak pedestal", "Centreline height hc above pedestal top"), u: "m", lo: 0.3, hi: 6, show: h },
      { k: "Dadd", lab: L("Tambahan diameter angin ΔD (isolasi, tangga, pipa)", "Wind diameter allowance ΔD (insulation, ladders, pipes)"), u: "m", lo: 0, hi: 2 },
      { k: "We", lab: L("Berat kosong We", "Empty weight We"), u: "F", lo: 1, hi: 1e5 }, { k: "Wo", lab: L("Berat isi operasi Wo", "Operating contents Wo"), u: "F", lo: 0, hi: 1e5 }, { k: "Wt", lab: L("Berat air uji Wt", "Test water Wt"), u: "F", lo: 0, hi: 1e5 },
      { k: "Lp", lab: L("Beban hidup platform", "Platform live load"), u: "F", lo: 0, hi: 1e4 }, { k: "hcg", lab: L("Tinggi pusat massa hcg (operasi)", "CG height hcg (operating)"), u: "m", lo: 0.2, hi: 40, show: v },
      { k: "Tp", lab: L("Gaya pipa/termal horizontal", "Pipe/thermal horizontal force"), u: "F", lo: 0, hi: 1e4, show: v }, { k: "Tm", lab: L("Momen pipa/termal", "Pipe/thermal moment"), u: "M", lo: 0, hi: 1e4, show: v },
      { k: "mu", lab: L("μ saddle geser (termal)", "Sliding saddle μ (thermal)"), u: "", lo: 0.05, hi: 0.6, show: h, help: L("0,4 baja–baja; 0,1 pelat PTFE.", "0.4 steel–steel; 0.1 PTFE slide plate.") },
    ] },
    { id: "fd", sketch: skVesselFound, icon: "🏗️", t: L("Pedestal & telapak", "Pedestal & footing"), fields: [
      { k: "pedShape", type: "seg", lab: L("Bentuk pedestal", "Pedestal shape"), opts: { oct: L("Oktagon", "Octagon"), rect: L("Persegi", "Square"), circle: L("Lingkaran", "Circle") }, show: v },
      { k: "Dp", lab: L("Ukuran pedestal Dp (lintas sisi)", "Pedestal size Dp (across flats)"), u: "m", lo: 0.4, hi: 10, show: v },
      { k: "bx", lab: L("Pedestal saddle bx (searah sumbu)", "Saddle pedestal bx (along axis)"), u: "m", lo: 0.2, hi: 3, show: h }, { k: "by", lab: L("Pedestal saddle by (melintang)", "Saddle pedestal by (transverse)"), u: "m", lo: 0.3, hi: 6, show: h },
      { k: "hp", lab: L("Tinggi pedestal hp di atas telapak", "Pedestal height hp above footing"), u: "m", lo: 0.15, hi: 3 },
      { k: "fShape", type: "seg", lab: L("Bentuk telapak", "Footing shape"), opts: { oct: L("Oktagon", "Octagon"), rect: L("Persegi/panjang", "Rectangular") }, show: v },
      { k: "fType", type: "seg", lab: L("Telapak", "Footing"), opts: { comb: L("Gabungan (satu telapak)", "Combined (one footing)"), iso: L("Terpisah per saddle", "Isolated per saddle") }, show: h },
      { k: "B", lab: v(s) && s.fShape === "oct" ? L("Telapak B (lintas sisi)", "Footing B (across flats)") : L("Telapak arah X, B", "Footing X, B"), u: "m", lo: 0.8, hi: 30 },
      { k: "Lf", lab: L("Telapak arah Y, L", "Footing Y, L"), u: "m", lo: 0.8, hi: 30, show: (x) => h(x) || x.fShape === "rect" },
      { k: "t", lab: L("Tebal telapak t", "Footing thickness t"), u: "m", lo: 0.25, hi: 3 }, { k: "Df", lab: L("Kedalaman dasar Df dari tanah", "Base depth Df below grade"), u: "m", lo: 0.3, hi: 5 },
      { k: "fc", lab: "fc'", u: "MPa", lo: 17, hi: 60 }, { k: "fy", lab: "fy", u: "MPa", lo: 280, hi: 550 }, { k: "cover", lab: L("Selimut bawah", "Bottom cover"), u: "mm", lo: 50, hi: 100 },
      { k: "db", type: "sel", lab: L("Tulangan telapak", "Footing bars"), opts: BAR }, { k: "nBars", lab: L("Jumlah tulangan pedestal", "Pedestal bar count"), u: "", lo: 4, hi: 80 }, { k: "dbP", type: "sel", lab: L("Diameter tulangan pedestal", "Pedestal bar size"), opts: BAR },
    ] },
    fdSection(s, { autoShallow: true }),
    { id: "anc", icon: "🔩", t: L("Baut angkur", "Anchor bolts"), fields: [
      { k: "nb", lab: v(s) ? L("Jumlah baut", "Number of bolts") : L("Baut per saddle", "Bolts per saddle"), u: "", lo: 2, hi: 48 },
      { k: "bd", type: "sel", lab: L("Diameter baut", "Bolt diameter"), opts: Object.fromEntries(ANCHOR_D.map((d) => [d, "M" + d])) },
      { k: "bg", type: "sel", lab: L("Mutu baut", "Bolt grade"), opts: Object.fromEntries(Object.entries(ANCHOR).map(([k, g]) => [k, g.nm])) },
      { k: "BCD", lab: L("Diameter lingkar baut BCD", "Bolt circle diameter BCD"), u: "m", lo: 0.2, hi: 8, show: v }, { k: "sb", lab: L("Jarak baris baut sb (melintang)", "Bolt row spacing sb (transverse)"), u: "m", lo: 0.2, hi: 5, show: h },
      { k: "hef", lab: L("Panjang tanam hef", "Embedment hef"), u: "mm", lo: 100, hi: 3000 },
    ] },
    { id: "soil", icon: "✅", t: L("Gempa & kriteria stabilitas", "Seismic & stability criteria"), fields: [
      { k: "sAllow", lab: L("Batas penurunan izin (0 = ikut tab Penurunan)", "Allowable settlement (0 = use Settlement tab)"), u: "mm", lo: 0, hi: 1000 },
      { k: "muB", lab: L("μ dasar–tanah", "Base–soil μ"), u: "", lo: 0.2, hi: 0.8 }, { k: "gs", lab: L("γ tanah urug", "Backfill γ"), u: "G", lo: 12, hi: 23 },
      { k: "R", lab: L("Koef. modifikasi respons R", "Response modification R"), u: "", lo: 1, hi: 8, help: L("SNI 1726 Tabel 15.4-2: vessel skirt R = 2; saddle horizontal R = 3.", "SNI 1726 Table 15.4-2: skirt vessel R = 2; horizontal saddle R = 3.") },
      { k: "Ie", lab: L("Faktor keutamaan Ie", "Importance factor Ie"), u: "", lo: 1, hi: 1.5 }, { k: "method", type: "seg", lab: L("Metode gempa", "Seismic method"), opts: { cs: "Cs = SDS/(R/Ie)", rigid: L("Kaku 0,3·SDS·Ie", "Rigid 0.3·SDS·Ie") } },
      { k: "fsOT", lab: L("FS guling (beban penuh)", "FS overturning (full D)"), u: "", lo: 1, hi: 3 }, { k: "fsSL", lab: L("FS geser (beban penuh)", "FS sliding (full D)"), u: "", lo: 1, hi: 3 },
      { k: "tempFac", lab: L("Pengali qa beban sementara", "qa multiplier, temporary"), u: "", lo: 1, hi: 1.5 }, { k: "minContact", lab: L("Kontak min. beban sementara", "Min. contact, temporary"), u: "", lo: 0.3, hi: 1 },
    ] },
    { id: "loads", icon: "⬇️", t: L("Beban tambahan pengguna (opsional)", "Additional user loads (optional)"), open: false, note: L("Beban otomatis (berat, isi, uji, angin, gempa, termal) sudah dihitung. Tambahkan beban lain di puncak pedestal di sini.", "Automatic loads (weights, contents, test, wind, seismic, thermal) are already computed. Add other loads at pedestal top here."), fields: [
      { type: "loads", render: (st, oc) => loadsEditor(st, "extra", st.kind === "h" ? [L("Saddle tetap", "Fixed saddle"), L("Saddle geser", "Sliding saddle")] : ["Pedestal"], oc, { defKey: "L" }) },
    ] },
  ]
}

export function run(s, ctx) {
  let I = { ...s, wind: ctx.wind, seis: { ...ctx.seisBase, R: s.R, Ie: s.Ie, method: s.method }, crit: { fsOT: s.fsOT, fsSL: s.fsSL, fsOTs: 1.0, fsSLs: 1.0, tempFac: s.tempFac, minContact: s.minContact }, nb: Math.round(s.nb), nBars: Math.round(s.nBars) }
  const deep = isDeep(s) && !!ctx.soil
  if (deep) I = effPile(I, ctx)
  else I.fdType = "shallow"
  const { cases, meta } = vesselCases(I)
  const nP = I.kind === "v" ? 1 : 2
  addUserLoads(cases, s.extra, nP)
  const combos = expandCombos(cases, 5 * nP, ctx.cmbOpts)
  // ---- alur desain: kapasitas → beban → ukuran pondasi (otomatis) → tebal & tulangan
  const rc = { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, prc = { fc: I.fc, fy: I.fy, n: I.nBars, db: I.dbP, cover: 50, tie: 10 }
  const mins = () => (I.kind === "v" ? [I.Dp + 0.6, I.Dp + 0.6] : I.fType === "comb" ? [I.Ls + I.bx + 0.6, I.by + 0.6] : [I.bx + 0.6, I.by + 0.6])
  const cbOf = (m) => combos.map((c) => ({ ...c, vec: pick(c.vec, m.map) }))
  let auto = null, sizing = null
  if (deep && I.pLay !== "grid") {
    const ms = vesselModels(I)
    auto = ms.map((m) => { const [minB, minL] = mins(); return autoCap({ m0: { ...m, t: I.t }, combos: cbOf(m), I, ctx, crit: I.crit, rc, prc, minB, minL, tAuto: I.tAuto !== false }) })
    I.autoModels = ms.map((m, k) => ({ ...auto[k].m, label: m.label, map: m.map, grid: undefined }))
    const a0 = auto.reduce((a, b) => (b.n > a.n ? b : a))
    Object.assign(I, { B: a0.m.B, Lf: a0.m.L, t: a0.m.t, Df: a0.m.Df, fShape: "rect", psx: a0.smin, pce: a0.ce })
  } else if (!deep && I.fSize !== "manual") {
    const ms = vesselModels(I)
    sizing = ms.map((m) => { const [minB, minL] = mins(); return autoFoot({ minTxt: L("ukuran minimum pedestal + 300 mm", "minimum pedestal + 300 mm"), m0: m, combos: cbOf(m), qaFn: (B, Lx, Df) => qaFor(s, ctx, B, Lx, Df).qa, mu: I.muB, crit: I.crit, rc, prc, minB, minL, tAuto: true }) })
    const big = sizing.reduce((a, b) => (b.B * b.L > a.B * a.L ? b : a))
    Object.assign(I, { B: big.B, Lf: big.L, t: big.t, Df: big.m.Df })
  }
  const m00 = vesselModels(I)[0]
  const qs = deep ? null : qaFor(s, ctx, m00.B, m00.L, m00.Df)
  if (qs) I.qa = qs.qa
  const out = analyzeVessel(I, combos)
  const uF = uName("F"), uM = uName("M"), uQ = uName("Q")
  const r0 = out.res[0].r, gq = r0.asd.reduce((a, b) => (b.pr.qmax / b.qa > a.pr.qmax / a.qa ? b : a), r0.asd[0])
  const nm = I.preset === "gasboot" ? "Gas Boot" : I.preset === "iar" ? "Instrument Air Receiver" : "Separator"
  const a1 = r0.asd.find((a) => a.c.base === "A1") || r0.asd[0], m0 = out.res[0].m
  let DB = null, settle, stTable = null
  if (deep) { DB = deepBundle(I, ctx, out.res, I.crit, "vessel", nm, I.sAllow || 0); out.checks.push(...DB.checks); settle = DB.settle; out.deep = DB.draw }
  else { const sh = shallowSettle(ctx, footFrom(m0.shape, m0.B, m0.L, r0.geo.A, m0.Df, a1.R.P / r0.geo.A, "vessel", nm), I.sAllow || 0); settle = sh.settle; stTable = sh.table; out.checks.push(settle.check) }
  const metrics = deep ? [...DB.metrics, { lab: L("Gaya angin", "Wind force"), val: toDisp("F", meta.wind.F), d: 1, unit: uF }, { lab: L("Tulangan cap X", "Cap bars X"), val: r0.reinf.x.bot.txt }] : [
    { lab: L("q maks (ASD)", "Max q (ASD)"), val: toDisp("Q", gq.pr.qmax), d: 1, unit: uQ },
    { lab: L("FS guling min", "Min FS overturning"), val: Math.min(...r0.asd.map((a) => a.fsOT)), d: 2 },
    { lab: L("Gaya angin", "Wind force"), val: toDisp("F", meta.wind.F), d: 1, unit: uF },
    { lab: "Cs · V " + L("gempa", "seismic"), val: `${nf(meta.cs, 3)} · ${nf(toDisp("F", meta.Vs), 1)} ${uF}` },
    { lab: L("Berat pondasi", "Foundation weight"), val: toDisp("F", out.res.reduce((a, x) => a + x.r.W.total, 0)), d: 0, unit: uF },
    { lab: L("Tulangan bawah X", "Bottom bars X"), val: r0.reinf.x.bot.txt },
  ]
  const kv = [
    { title: L("Peralatan", "Equipment"), rows: [[L("Jenis", "Type"), nm], ["D", I.D, "m", 2], ...(I.kind === "v" ? [["H", I.H, "m", 2], [L("Pusat massa", "CG"), I.hcg, "m", 2]] : [["L T/T", I.Ltt, "m", 2], ["Ls", I.Ls, "m", 2], ["hc", I.hc, "m", 2]]),
      ["We / Wo / Wt", `${nf(toDisp("F", I.We), 1)} / ${nf(toDisp("F", I.Wo), 1)} / ${nf(toDisp("F", I.Wt), 1)} ${uF}`], [L("Diameter angin efektif", "Effective wind diameter"), meta.De, "m", 2]] },
    { title: L("Angin & gempa", "Wind & seismic"), rows: [["V", ctx.wind.V, "m/s", 1], [L("Eksposur", "Exposure"), ctx.wind.exp], [L("Gaya angin", "Wind force"), toDisp("F", meta.wind.F), uF, 2], ...(I.kind === "h" ? [[L("Angin memanjang", "Longitudinal wind"), toDisp("F", meta.wind.Fl), uF, 2], [L("Gesek termal Ff", "Thermal friction Ff"), toDisp("F", meta.Ff), uF, 2]] : []),
      ["SDS / SD1", `${nf(ctx.sp.SDS, 3)} / ${nf(ctx.sp.SD1, 3)}`], ["R / Ie", `${I.R} / ${I.Ie}`], ["Cs", meta.cs, "", 4], [L("Geser dasar V", "Base shear V"), toDisp("F", meta.Vs), uF, 2]] },
    { title: L("Pondasi", "Foundation"), rows: [[L("Telapak", "Footing"), I.kind === "v" && I.fShape === "oct" ? `${L("oktagon", "octagon")} ${nf(I.B, 2)} m` : `${nf(I.B, 2)} × ${nf(I.Lf, 2)} m${I.kind === "h" && I.fType === "iso" ? " ×2" : ""}`], [L("Tebal / kedalaman", "Thickness / depth"), `${nf(I.t, 2)} / ${nf(I.Df, 2)} m`],
      ["Pedestal", I.kind === "v" ? `${I.pedShape} ${nf(I.Dp, 2)} m × ${nf(I.hp, 2)} m` : `${nf(I.bx, 2)} × ${nf(I.by, 2)} × ${nf(I.hp, 2)} m`], [L("Tulangan pedestal", "Pedestal bars"), `${I.nBars} D${I.dbP}`], [L("Baut", "Bolts"), `${I.nb} × M${I.bd} ${ANCHOR[I.bg].nm}, hef ${I.hef} mm`],
      ...(deep ? [] : [["qa", toDisp("Q", I.qa), uQ, 1], [L("Sumber qa", "qa source"), qaNote(qs)]]), ["fc' / fy", `${I.fc} / ${I.fy} MPa`]] },
    ...(deep ? [DB.kv] : []),
  ]
  const caseRows = []
  for (const [k, v] of Object.entries(cases)) if (v && v.some((x) => Math.abs(x) > 1e-12)) for (let p = 0; p < nP; p++) caseRows.push([k + (nP > 1 ? (p === 0 ? " · " + L("tetap", "fixed") : " · " + L("geser", "sliding")) : ""), toDisp("F", v[5 * p]), toDisp("F", v[5 * p + 1]), toDisp("F", v[5 * p + 2]), toDisp("M", v[5 * p + 3]), toDisp("M", v[5 * p + 4])])
  const tables = [
    { title: L("Kasus beban dasar di puncak pedestal", "Basic load cases at pedestal top"), cols: [L("Kasus", "Case"), `P (${uF})`, `Vx (${uF})`, `Vy (${uF})`, `Mx (${uM})`, `My (${uM})`], rows: caseRows, dec: [null, 2, 2, 2, 2, 2], align: ["l", "r", "r", "r", "r", "r"] },
  ]
  out.res.forEach(({ m, r }) => {
    if (!deep) tables.push({ title: `${L("Kombinasi ASD — tekanan & stabilitas", "ASD combinations — pressure & stability")}${m.label ? " · " + m.label : ""}`, cols: [L("Kode", "Code"), L("Rumus", "Formula"), `P (${uF})`, "ex (m)", "ey (m)", `q ${L("maks", "max")} (${uQ})`, L("Kontak", "Contact"), "FS OT", "FS SL", "Status"],
      rows: r.asd.map((a) => ({ cells: [a.c.id, a.c.formula, toDisp("F", a.R.P), a.pr.ex, a.pr.ey, isFinite(a.pr.qmax) ? toDisp("Q", a.pr.qmax) : "∞", `${nf(a.pr.contact * 100, 0)}%`, a.fsOT, a.fsSL, a.ok ? "OK" : "NOT OK"], cls: a.ok ? "" : "bad" })), dec: [null, null, 1, 3, 3, 1, null, 2, 2, null], align: ["l", "l", "r", "r", "r", "r", "r", "r", "r", "l"] })
    tables.push({ title: `${deep ? L("Desain pile cap (LRFD)", "Pile cap design (LRFD)") : L("Desain telapak (LRFD)", "Footing design (LRFD)")}${m.label ? " · " + m.label : ""}`, cols: [L("Arah", "Direction"), `Mu+ (${uName("Mm")})`, `Mu− (${uName("Mm")})`, L("Bawah", "Bottom"), L("Atas", "Top"), `Vu (${uName("W")})`, `φVc (${uName("W")})`],
      rows: ["x", "y"].map((ax) => { const q = r.reinf[ax]; return [ax.toUpperCase(), toDisp("Mm", q.Mpos), toDisp("Mm", q.Mneg), q.bot.txt, q.top ? q.top.txt : "–", toDisp("W", q.Vu), toDisp("W", q.phiVc)] }), dec: [null, 1, 1, null, null, 1, 1], align: ["l", "r", "r", "l", "l", "r", "r"] })
  })
  if (deep) tables.push(...DB.tables)
  else if (stTable) tables.push(stTable)
  const drawings = [{ make: (md) => vesselDraw(I, out, palette(md)), cap: deep ? L("Gambar 1 — Tampak peralatan, pile cap, dan tiang", "Figure 1 — Equipment elevation, pile cap and piles") : L("Gambar 1 — Tampak peralatan, pondasi, dan tekanan tanah", "Figure 1 — Equipment elevation, foundation and soil pressure") }]
  if (deep) DB.drawings.forEach((d, i) => drawings.push({ ...d, cap: `${L("Gambar", "Figure")} ${i + 2} — ${d.cap}` }))
  else out.res.forEach(({ m, r }, i) => drawings.push({ make: (md) => footingPlan(r, m, palette(md), `${L("Denah tekanan tanah", "Soil pressure plan")}${m.label ? " · " + m.label : ""}`), cap: `${L("Gambar", "Figure")} ${i + 2} — ${L("Denah telapak, pedestal, dan peta tekanan (ASD penentu)", "Footing plan, pedestals and pressure map (governing ASD)")}`, maxH: 300 }))
  const p0 = r0.pedRes[0]
  if (p0 && p0.worst) {
    const curve = pmCurve(p0.poly, p0.bars, I.fc, I.fy, 0, false, 32)
    const pts = r0.lrfd.map((x) => { const q = x.c.vec; const Pu = q[0] + x.c.fD * r0.W.peds[0], Mx = q[3] + q[2] * out.res[0].m.peds[0].h, My = q[4] + q[1] * out.res[0].m.peds[0].h; return [Math.hypot(Mx, My), Pu, true] })
    drawings.push({ make: (md) => pmChart(curve, pts, palette(md), L("Interaksi P–M pedestal (kombinasi LRFD)", "Pedestal P–M interaction (LRFD combinations)")), cap: L("Gambar — Diagram interaksi pedestal", "Figure — Pedestal interaction diagram"), maxH: 260, small: true })
  }
  const notes = [
    L("Angin: SNI 1727:2020 Bab 29 (qz per pias tinggi, G = 0,85, Cf penampang bulat, diameter efektif termasuk isolasi/tangga). Gempa: SNI 1726:2019 §15.4 (Cs struktur nongedung atau 0,3·SDS·Ie untuk peralatan kaku) di pusat massa operasi.", "Wind: SNI 1727:2020 Ch. 29 (qz per height strip, G = 0.85, round-section Cf, effective diameter incl. insulation/ladders). Seismic: SNI 1726:2019 §15.4 (nonbuilding Cs or 0.3·SDS·Ie for rigid equipment) at the operating CG."),
    L("Separator: gaya memanjang (angin/gempa) dipikul saddle tetap dan menimbulkan kopel vertikal F·hc/Ls antar saddle; gesek termal μ·W/2 bekerja berlawanan pada kedua saddle (PIP STE03360).", "Separator: longitudinal forces (wind/seismic) go to the fixed saddle and create a vertical couple F·hc/Ls between saddles; thermal friction μ·W/2 acts in opposite directions on both saddles (PIP STE03360)."),
    L("Telapak: tekanan tanah tanpa tarik dengan eksentrisitas dua arah (solver numerik), FS guling 1,5 / 1,0 (kombinasi 0,6D), lentur & geser di muka pedestal, pons dengan transfer momen (§8.4.4.2). Pedestal: interaksi P–M serat (Bresler α = 1,15 untuk persegi).", "Footing: no-tension soil pressure with biaxial eccentricity (numerical solver), FS overturning 1.5 / 1.0 (0.6D combinations), flexure & shear at pedestal face, punching with moment transfer (§8.4.4.2). Pedestal: fibre P–M interaction (Bresler α = 1.15 for rectangles)."),
    L("Baut angkur: tarik = 4M/(n·BCD) − P/n (vertikal), tarik baja, cabut, geser baja dengan grout, interaksi 5/3, tulangan angkur §17.4.2.9. Breakout beton diasumsikan dipikul tulangan angkur.", "Anchor bolts: tension = 4M/(n·BCD) − P/n (vertical), steel tension, pull-out, steel shear with grout, 5/3 interaction, anchor reinforcement §17.4.2.9. Concrete breakout assumed taken by anchor reinforcement."),
  ]
  // ---- alur perhitungan (ringkas)
  const ml = maxLoad(out.res.flatMap((x) => x.r.asd)), Wf = out.res.reduce((a, x) => a + x.r.W.total, 0)
  const loadSub = `We ${nf(toDisp("F", I.We), 0)} + Wo ${nf(toDisp("F", I.Wo), 0)} + ${L("pondasi", "foundation")} ${nf(toDisp("F", Wf), 0)} ${uF} · ${L("angin", "wind")} ${nf(toDisp("F", meta.wind.F), 1)} · ${L("gempa", "seismic")} ${nf(toDisp("F", meta.Vs), 1)} ${uF}`
  const flow = deep ? flowDeep({ sp1: auto ? auto[0].sp1 : singlePile(I, ctx.soil, I.Df), I, P: ml.P, M: ml.M, cP: ml.cP, loadSub, n: DB.gs.reduce((a, g) => a + g.n, 0), nAx: auto ? Math.max(...auto.map((a) => a.nAx)) : ml.P / singlePile(I, ctx.soil, I.Df).Qad,
      layout: auto ? auto.map((a) => `${a.nx} × ${a.ny}`).join(" + ") + ` ${L("tiang", "piles")}` : `${DB.g0.nx} × ${DB.g0.ny} grid`, auto: !!auto, gov: auto ? auto[0].gov : "",
      cap: `${nf(I.B, 2)} × ${nf(I.Lf, 2)} × ${nf(I.t, 2)} m${out.res.length > 1 ? " ×2" : ""}`, capSub: `s = ${nf(I.psx, 2)} m · ce = ${nf(I.pce, 2)} m${auto && I.tAuto !== false ? " · " + L("tebal otomatis", "automatic depth") : ""}`,
      rebar: `X ${r0.reinf.x.bot.txt} · Y ${r0.reinf.y.bot.txt}`, rebarSub: L("tulangan bawah pile cap", "pile cap bottom bars"), checks: out.checks, settle })
    : flowShallow({ q: qs, P: ml.P, M: ml.M, cP: ml.cP, loadSub, A: r0.geo.A * out.res.length, gov: sizing ? sizing[0].gov : "", size: I.kind === "v" && I.fShape === "oct" ? `${L("oktagon", "octagon")} ${nf(I.B, 2)} m × t ${nf(I.t, 2)} m` : `${nf(I.B, 2)} × ${nf(I.Lf, 2)} × ${nf(I.t, 2)} m${out.res.length > 1 ? " ×2" : ""}`, auto: !!sizing,
      rebar: `X ${r0.reinf.x.bot.txt} · Y ${r0.reinf.y.bot.txt}`, rebarSub: `d = ${nf(r0.d, 0)} mm`, checks: out.checks, settle })
  return { file: "Pondasi_" + nm.replace(/\s+/g, ""), title: `${L("Desain Pondasi", "Foundation Design")} ${nm}`, sub: (deep ? `${L("Pondasi tiang", "Piled")} · ` : "") + (I.kind === "v" ? `Ø${nf(I.D, 2)} × ${nf(I.H, 2)} m · ${L("pedestal", "pedestal")} ${I.pedShape} · ${L("telapak", "footing")} ${I.fShape}` : `Ø${nf(I.D, 2)} × ${nf(I.Ltt, 2)} m T/T · Ls ${nf(I.Ls, 2)} m · ${I.fType === "comb" ? L("telapak gabungan", "combined footing") : L("telapak terpisah", "isolated footings")}`),
    refs: codes, metrics, checks: out.checks, kv, tables, notes: [...notes, deep ? L("Pondasi dalam: telapak menjadi pile cap kaku; reaksi tiang Pi = P/n ± M·x/Σx²; kapasitas dari tab Tanah; cap didesain dengan reaksi tiang sebagai beban titik (§13.4.2.5).", "Deep foundation: the footing acts as a rigid pile cap; pile reactions Pi = P/n ± M·x/Σx²; capacity from the Soil tab; cap designed with pile reactions as point loads (§13.4.2.5).") : qaNote(qs)],
    drawings, cases, combos, out, settle, fdType: deep ? "deep" : "shallow", flow, steps: [flowStep(flow), ...(deep ? [] : qs && qs.r ? [{ h: L("Daya dukung izin dari data tanah", "Allowable bearing from soil data"), rows: qs.r.rows }] : []), ...vesselSteps(I, meta, out), ...(deep ? DB.steps : [])] }
}
