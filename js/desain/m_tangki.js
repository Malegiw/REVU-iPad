// Modul halaman: Pondasi tangki Wash Tank / Surge Tank — pelat penuh atau ringwall (otomatis dari diameter), API 650 + SNI.
import { L, nf, toDisp, uName, expandCombos } from "./core.js"
import { PRESETS, tankLoads, tankCases, analyzeTank } from "./tank.js"
import { palette, tankDraw } from "./draw.js"
import { skTank, skTankFound } from "./sketch.js"
import { tankSteps } from "./steps.js"
import { DEEP0, fdSection, qaFor, qaNote, isDeep, settleOf, settleTable, deepTables, deepKv, pilePlan, pileSection } from "./deep.js"

export const id = "tangki"
export const icon = "🛢️"
export const title = () => L("Pondasi Tangki (Wash / Surge)", "Tank Foundation (Wash / Surge)")
export const blurb = () => L("Wash Tank atau Surge Tank, pelat penuh atau ringwall sesuai diameter: angin, gempa API 650 Annex E, daya dukung, tulangan, hoop, geser satu & dua arah (pons).", "Wash or Surge Tank, full slab or ringwall by diameter: wind, API 650 Annex E seismic, bearing, reinforcement, hoop, one- & two-way (punching) shear.")
export const codes = "API 650 (Annex B & E) · PIP STE03020 · SNI 1727:2020 · SNI 1726:2019 · SNI 2847:2019 · SNI 8460:2017"

export function defaults() {
  return {
    ...DEEP0, psx: 1.6, pce: 0.5, preset: "wash", ...PRESETS.wash, anchored: true, Ie: 1.25, z0: 0.3,
    found: "auto", dLim: 9, proj: 0.6, sh: 0.5, rb: 0.6, rh: 1.2, rbf: 1.4, rtf: 0.4, K0: 0.5, gpad: 19, hpad: 0.6, padB: 1.5, padT: 0.45,
    qa: 150, tempFac: 1, minContact: 0.5, muB: 0.5, sAllow: 300, fc: 30, fy: 420, cover: 75, db: 16, dbH: 19,
  }
}
const BAR = { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25", 29: "D29", 32: "D32" }
export function form(s) {
  const ring = (x) => !isDeep(x) && (x.found === "auto" ? x.D > x.dLim : x.found === "ring"), slab = (x) => !ring(x)
  return [
    { id: "tk", sketch: skTank, icon: "🛢️", t: L("Jenis & data tangki", "Tank type & data"), fields: [
      { k: "preset", type: "seg", lab: L("Jenis tangki", "Tank type"), opts: { wash: "Wash Tank (gun barrel)", surge: "Surge Tank" }, wide: true, on: (st, v) => Object.assign(st, PRESETS[v]) },
      { k: "D", lab: L("Diameter D", "Diameter D"), u: "m", lo: 2, hi: 60, struct: true }, { k: "Hs", lab: L("Tinggi shell Hs", "Shell height Hs"), u: "m", lo: 2, hi: 25 },
      { k: "H", lab: L("Tinggi cairan operasi H", "Operating liquid height H"), u: "m", lo: 0.5, hi: 25 }, { k: "SG", lab: L("Berat jenis cairan (SG)", "Liquid specific gravity (SG)"), u: "", lo: 0.5, hi: 1.5 },
      { k: "Ht", lab: L("Tinggi air uji hidrostatik Ht", "Hydrotest water height Ht"), u: "m", lo: 0.5, hi: 25 },
      { k: "tShell", lab: L("Tebal shell rata-rata", "Average shell thickness"), u: "mm", lo: 4, hi: 30 }, { k: "tBot", lab: L("Tebal pelat dasar/annular", "Bottom/annular plate thickness"), u: "mm", lo: 5, hi: 25 },
      { k: "tRoof", lab: L("Tebal pelat atap", "Roof plate thickness"), u: "mm", lo: 4, hi: 12 }, { k: "slope", lab: L("Kemiringan atap kerucut θ", "Cone roof slope θ"), u: "°", lo: 2, hi: 37 },
      { k: "roof", type: "seg", lab: L("Atap", "Roof"), opts: { self: L("Swa-dukung", "Self-supported"), col: L("Didukung kolom", "Column-supported") }, struct: true },
      { k: "nCol", lab: L("Jumlah kolom atap", "Number of roof columns"), u: "", lo: 1, hi: 12, show: (x) => x.roof === "col" }, { k: "colFrac", lab: L("Fraksi atap dipikul kolom", "Roof fraction carried by columns"), u: "", lo: 0, hi: 0.9, show: (x) => x.roof === "col" },
      { k: "colB", lab: L("Pelat dasar kolom (sisi)", "Column base plate (side)"), u: "m", lo: 0.15, hi: 1.5, show: (x) => x.roof === "col" },
      { k: "Wacc", lab: L("Berat aksesori (tangga, platform, nozzle)", "Accessories (stairs, platform, nozzles)"), u: "F", lo: 0, hi: 1e4 }, { k: "Lr", lab: L("Beban hidup atap", "Roof live load"), u: "Q", lo: 0, hi: 5, help: L("API 650: minimum 1,0 kPa.", "API 650: minimum 1.0 kPa.") },
      { k: "anchored", type: "chk", lab: L("Tangki diangkur mekanis (Rwi = 4)", "Mechanically anchored tank (Rwi = 4)") }, { k: "Ie", lab: L("Faktor keutamaan Ie (API E)", "Importance factor Ie (API E)"), u: "", lo: 1, hi: 1.5 },
      { k: "z0", lab: L("Elevasi dasar tangki di atas tanah z0", "Tank base above grade z0"), u: "m", lo: 0, hi: 3 },
    ] },
    fdSection(s, { tank: true }),
    { id: "fd", sketch: skTankFound, icon: "🏗️", t: L("Ringwall / pelat", "Ringwall / slab"), badge: isDeep(s) ? L("PELAT DI ATAS TIANG", "SLAB ON PILES") : ring(s) ? "RINGWALL" : L("PELAT PENUH", "FULL SLAB"), note: L(`Otomatis: D ≤ <b>${nf(s.dLim, 1)} m</b> → pelat penuh (mat); D > batas → ringwall beton (PIP STE03020 / API 650 Annex B).`, `Auto: D ≤ <b>${nf(s.dLim, 1)} m</b> → full slab (mat); D > limit → concrete ringwall (PIP STE03020 / API 650 Annex B).`), fields: [
      { k: "found", type: "seg", lab: L("Pilihan", "Choice"), opts: { auto: L("Otomatis dari D", "Auto from D"), slab: L("Pelat penuh", "Full slab"), ring: "Ringwall" }, wide: true, show: (x) => !isDeep(x) },
      { k: "dLim", lab: L("Batas D untuk pelat penuh", "D limit for full slab"), u: "m", lo: 4, hi: 30, struct: true, show: (x) => !isDeep(x) },
      { k: "proj", lab: L("Tonjolan pelat di luar shell a", "Slab projection beyond shell a"), u: "m", lo: 0.2, hi: 2, show: slab }, { k: "sh", lab: L("Tebal pelat h", "Slab thickness h"), u: "m", lo: 0.25, hi: 2, show: slab },
      { k: "rb", lab: L("Lebar ringwall b", "Ringwall width b"), u: "m", lo: 0.25, hi: 2, show: ring }, { k: "rh", lab: L("Tinggi ringwall h", "Ringwall height h"), u: "m", lo: 0.5, hi: 4, show: ring },
      { k: "rbf", lab: L("Lebar telapak ringwall bf (0 = tanpa)", "Ringwall footing width bf (0 = none)"), u: "m", lo: 0, hi: 4, show: ring }, { k: "rtf", lab: L("Tebal telapak ringwall tf", "Ringwall footing thickness tf"), u: "m", lo: 0.25, hi: 1.5, show: (x) => ring(x) && x.rbf > x.rb },
      { k: "K0", lab: L("Koef. tekanan lateral urugan K", "Fill lateral pressure coefficient K"), u: "", lo: 0.3, hi: 1, show: ring, help: L("PIP: 0,5 (diam) untuk ringwall.", "PIP: 0.5 (at-rest) for ringwalls.") },
      { k: "hpad", lab: L("Tebal urugan/pad hpad", "Pad/fill thickness hpad"), u: "m", lo: 0, hi: 3 }, { k: "gpad", lab: L("γ urugan", "Fill γ"), u: "G", lo: 15, hi: 23 },
      { k: "padB", lab: L("Pad kolom atap (sisi)", "Roof-column pad (side)"), u: "m", lo: 0.5, hi: 4, show: (x) => ring(x) && x.roof === "col" }, { k: "padT", lab: L("Tebal pad kolom", "Column pad thickness"), u: "m", lo: 0.25, hi: 1.5, show: (x) => ring(x) && x.roof === "col" },
      { k: "fc", lab: "fc'", u: "MPa", lo: 17, hi: 60 }, { k: "fy", lab: "fy", u: "MPa", lo: 280, hi: 550 }, { k: "cover", lab: L("Selimut", "Cover"), u: "mm", lo: 40, hi: 100 },
      { k: "db", type: "sel", lab: L("Tulangan pelat/telapak", "Slab/footing bars"), opts: BAR }, { k: "dbH", type: "sel", lab: L("Tulangan hoop", "Hoop bars"), opts: BAR, show: ring },
    ] },
    { id: "soil", icon: "✅", t: L("Kriteria", "Criteria"), fields: [
      { k: "tempFac", lab: L("Pengali qa beban sementara", "qa multiplier, temporary loads"), u: "", lo: 1, hi: 1.5, help: L("SNI 1727 ASD (0,6W; 0,7E) umumnya tanpa kenaikan (1,0).", "SNI 1727 ASD (0.6W; 0.7E) normally without increase (1.0).") },
      { k: "sAllow", lab: L("Batas penurunan izin (0 = ikut tab Penurunan)", "Allowable settlement (0 = use Settlement tab)"), u: "mm", lo: 0, hi: 1000, help: L("Tangki timbun umumnya 150–300 mm penurunan seragam; kemiringan & pusat–tepi dicek terpisah (API 653 Annex B).", "Storage tanks typically allow 150–300 mm uniform settlement; tilt & centre–edge checked separately (API 653 Annex B).") },
      { k: "muB", lab: L("μ gesek dasar–tanah", "Base–soil friction μ"), u: "", lo: 0.2, hi: 0.8 }, { k: "minContact", lab: L("Kontak minimum beban sementara", "Minimum contact, temporary loads"), u: "", lo: 0.3, hi: 1 },
    ] },
  ]
}

export function run(s, ctx) {
  const I = { ...s, wind: ctx.wind, seis: { ...ctx.seisBase, Ie: s.Ie, anchored: s.anchored }, nCol: Math.round(s.nCol), soilDS: ctx.soil, settleOpt: ctx.settle }
  const deep = isDeep(s) && !!ctx.soil
  if (!deep) I.fdType = "shallow"
  const ringS = !deep && (I.found === "auto" ? I.D > I.dLim : I.found === "ring")
  const qs = deep ? null : ringS ? qaFor(s, ctx, Math.max(I.rbf || 0, I.rb), Math.PI * I.D, Math.max(I.rh - I.z0, 0.3)) : qaFor(s, ctx, I.D + 2 * I.proj, I.D + 2 * I.proj, Math.max(I.sh, 0.3))
  if (qs) I.qa = qs.qa
  const T = tankLoads(I)
  const cases = tankCases(I, T)
  const combos = expandCombos(cases, 6, { ...ctx.cmbOpts, dirs: "x" })
  const out = analyzeTank(I, combos)
  const Rr = out.R, ring = out.type === "ring", piled = out.type === "piled"
  const uF = uName("F"), uM = uName("M"), uQ = uName("Q"), uW = uName("W")
  const s0 = T.s
  const metrics = [
    { lab: L("Pondasi", "Foundation"), val: ring ? "Ringwall" : piled ? `${L("Pelat + tiang", "Slab + piles")} ×${Rr.n}` : L("Pelat penuh", "Full slab") },
    piled ? { lab: L("P maks / Qa tiang", "Max P / Qa pile"), val: `${nf(toDisp("F", Rr.wC ? Rr.wC.a.pk.max : 0), 0)} / ${nf(toDisp("F", Rr.Qac), 0)} ${uF}` } : { lab: L("q maks (ASD)", "Max q (ASD)"), val: toDisp("Q", ring ? Rr.wq.q : Rr.wq.pr.qmax), d: 1, unit: uQ },
    { lab: L("Berat operasi total", "Total operating weight"), val: toDisp("F", T.Ws + T.Wr + T.Wb + I.Wacc + T.Wp), d: 0, unit: uF },
    { lab: "Mw " + L("angin", "wind"), val: toDisp("M", T.Mw), d: 0, unit: uM },
    { lab: "Mrw " + L("gempa (API)", "seismic (API)"), val: s0 ? toDisp("M", s0.Mrw) : "–", d: 0, unit: s0 ? uM : "" },
    { lab: L("Rasio angkur J", "Anchorage ratio J"), val: s0 ? s0.J : "–", d: 3 },
  ]
  const kv = [
    { title: L("Tangki", "Tank"), rows: [[L("Jenis", "Type"), I.preset === "wash" ? "Wash Tank" : "Surge Tank"], ["D × Hs", `${nf(I.D, 2)} × ${nf(I.Hs, 2)} m`], [L("Cairan operasi", "Operating liquid"), `H ${nf(I.H, 2)} m, SG ${nf(I.SG, 2)}`], [L("Uji hidrostatik", "Hydrotest"), `${nf(I.Ht, 2)} m`],
      [L("Berat shell", "Shell weight"), toDisp("F", T.Ws), uF, 1], [L("Berat atap", "Roof weight"), toDisp("F", T.Wr), uF, 1], [L("Berat pelat dasar", "Bottom weight"), toDisp("F", T.Wb), uF, 1], [L("Aksesori", "Accessories"), toDisp("F", I.Wacc), uF, 1],
      [L("Berat cairan operasi", "Operating liquid weight"), toDisp("F", T.Wp), uF, 0], [L("Berat air uji", "Test water weight"), toDisp("F", T.Wt), uF, 0], [L("Atap", "Roof"), I.roof === "col" ? `${L("kolom", "columns")} ×${I.nCol}, ${nf(I.colFrac * 100, 0)}%` : L("swa-dukung", "self-supported")]] },
    { title: L("Angin & gempa", "Wind & seismic"), rows: [["V", ctx.wind.V, "m/s", 1], [L("Eksposur", "Exposure"), ctx.wind.exp], ["Cf", T.Cf, "", 2], ["Fw", toDisp("F", T.Fw), uF, 1], ["Mw", toDisp("M", T.Mw), uM, 1], ["SDS / SD1", `${nf(ctx.sp.SDS, 3)} / ${nf(ctx.sp.SD1, 3)}`],
      ...(s0 ? [["Wi / Wc", `${nf(toDisp("F", s0.Wi), 0)} / ${nf(toDisp("F", s0.Wc), 0)} ${uF}`], ["Xi / Xc", `${nf(s0.Xi, 2)} / ${nf(s0.Xc, 2)} m`], ["Tc", s0.Tc, "s", 2], ["Ai / Ac", `${nf(s0.Ai, 3)} / ${nf(s0.Ac, 3)}`], ["V", toDisp("F", s0.V), uF, 1], ["Mrw / Ms", `${nf(toDisp("M", s0.Mrw), 0)} / ${nf(toDisp("M", s0.Ms), 0)} ${uM}`], ["Av", s0.Av, "g", 3], [L("Sloshing δs", "Sloshing δs"), s0.slosh, "m", 2]] : [])] },
    { title: L("Pondasi", "Foundation"), rows: ring ? [[L("Ringwall b × h", "Ringwall b × h"), `${nf(I.rb, 2)} × ${nf(I.rh, 2)} m`], [L("Telapak", "Footing"), I.rbf > I.rb ? `${nf(I.rbf, 2)} × ${nf(I.rtf, 2)} m` : "–"], ["K", I.K0, "", 2], [L("Tarik hoop T / Tu", "Hoop tension T / Tu"), `${nf(toDisp("F", Rr.Th), 1)} / ${nf(toDisp("F", Rr.Tu), 1)} ${uF}`], [L("Tulangan hoop", "Hoop steel"), `${Rr.nb} D${I.dbH} (${nf(Rr.AsP, 0)} mm²)`], ["fc' / fy", `${I.fc} / ${I.fy} MPa`]]
      : [[L("Pelat Ø × tebal", "Slab Ø × thickness"), `${nf(Rr.Ds, 2)} × ${nf(I.sh, 2)} m`], [L("Berat pelat", "Slab weight"), toDisp("F", Rr.Wsl), uF, 0], [L("Tulangan bawah", "Bottom bars"), `${Rr.bot.txt} ${L("dua arah", "both ways")}`], [L("Tulangan atas", "Top bars"), `${Rr.top.txt} ${L("dua arah", "both ways")}`], ["d", Rr.d, "mm", 0], ["fc' / fy", `${I.fc} / ${I.fy} MPa`]].concat(qs ? [["qa", toDisp("Q", I.qa), uQ, 1], [L("Sumber qa", "qa source"), qaNote(qs)]] : []) },
    ...(piled ? [deepKv(I, Rr)] : []),
  ]
  if (ring && qs) kv[2].rows.push(["qa", toDisp("Q", I.qa), uQ, 1], [L("Sumber qa", "qa source"), qaNote(qs)])
  const ab = (k) => (k ? cases[k] : null)
  const caseRows = [["D", ab("D")], ["Do", ab("Do")], ["Dt", ab("Dt")], ["L", ab("L")], ["Wx", ab("Wx")], ["Ex", ab("Ex")]].filter(([, v]) => v).map(([k, v]) => [k, toDisp("W", v[0]), toDisp("M", v[1]), toDisp("M", v[2]), toDisp("F", v[3]), toDisp("Q", v[4]), toDisp("F", v[5])])
  const tables = [
    { title: L("Kasus beban dasar tangki", "Basic tank load cases"), cols: [L("Kasus", "Case"), `w shell (${uW})`, `M ring (${uM})`, `M ${L("pelat", "slab")} (${uM})`, `V (${uF})`, `p ${L("cairan", "liquid")} (${uQ})`, `P ${L("kolom", "column")} (${uF})`], rows: caseRows, dec: [null, 2, 1, 1, 1, 1, 1], align: ["l", "r", "r", "r", "r", "r", "r"],
      note: L("E disimpan sebagai gaya API 650 Annex E / 0,7 (API bertaraf ASD), sehingga kombinasi 0,7E = nilai API.", "E stored as API 650 Annex E force / 0.7 (API is ASD-level), so the 0.7E combination equals the API value.") },
    ring ? { title: L("Kombinasi ASD — tekanan di bawah ringwall", "ASD combinations — pressure under ringwall"), cols: [L("Kode", "Code"), L("Rumus", "Formula"), `w ${L("maks", "max")} (${uW})`, `w ${L("min", "min")} (${uW})`, `q ring (${uQ})`, `q ${L("dalam", "interior")} (${uQ})`, `qa (${uQ})`, "Status"],
      rows: Rr.asd.map((r) => ({ cells: [r.c.id, r.c.formula, toDisp("W", r.lineMax), toDisp("W", r.lineMin), toDisp("Q", r.q), toDisp("Q", r.qin), toDisp("Q", r.qa), r.ok ? "OK" : "NOT OK"], cls: r.ok ? "" : "bad" })), dec: [null, null, 1, 1, 1, 1, 0, null], align: ["l", "l", "r", "r", "r", "r", "r", "l"] }
      : piled ? null : { title: L("Kombinasi ASD — tekanan tanah pelat penuh", "ASD combinations — full-slab soil pressure"), cols: [L("Kode", "Code"), L("Rumus", "Formula"), `P (${uF})`, `M (${uM})`, `q ${L("maks", "max")} (${uQ})`, L("Kontak", "Contact"), "FS " + L("guling", "OT"), "FS " + L("geser", "slide"), "Status"],
        rows: Rr.asd.map((r) => { const ok = r.pr.qmax <= r.qa && r.fsOT >= r.reqOT && r.fsSL >= r.reqSL && r.pr.contact >= r.reqC - 1e-6; return { cells: [r.c.id, r.c.formula, toDisp("F", r.P), toDisp("M", r.M), toDisp("Q", r.pr.qmax), `${nf(r.pr.contact * 100, 0)}%`, r.fsOT, r.fsSL, ok ? "OK" : "NOT OK"], cls: ok ? "" : "bad" } }), dec: [null, null, 0, 0, 1, null, 2, 2, null], align: ["l", "l", "r", "r", "r", "r", "r", "r", "l"] },
  ]
  if (piled) tables.push(...deepTables(I, Rr), { title: L("Desain pelat di atas tiang (LRFD)", "Slab-on-piles design (LRFD)"), cols: [L("Bagian", "Part"), `Mu (${uName("Mm")})`, L("Tulangan", "Bars")], rows: [[L("Negatif di atas tiang (atas)", "Negative over piles (top)"), toDisp("Mm", Rr.Mneg), Rr.top.txt], [L("Positif lapangan (bawah)", "Positive span (bottom)"), toDisp("Mm", Rr.Mpos), Rr.bot.txt]], dec: [null, 1, null], align: ["l", "r", "l"] })
  else if (!ring) tables.push({ title: L("Desain pelat (LRFD, pelat lingkaran kaku)", "Slab design (LRFD, rigid circular slab)"), cols: [L("Bagian", "Part"), `Mu (${uName("Mm")})`, `Vu (${uW})`, L("Tulangan", "Bars")], rows: [[L("Kantilever di luar shell (bawah)", "Cantilever outside shell (bottom)"), toDisp("Mm", Rr.Mc), toDisp("W", Rr.Vc), Rr.bot.txt], [L("Interior (bawah)", "Interior (bottom)"), toDisp("Mm", Rr.Mbi), toDisp("W", Rr.Vi), Rr.bot.txt], [L("Interior (atas)", "Interior (top)"), toDisp("Mm", Rr.Mt), "", Rr.top.txt]], dec: [null, 1, 1, null], align: ["l", "r", "r", "l"] })
  const nmT = I.preset === "wash" ? "Wash Tank" : "Surge Tank"
  const a1 = Rr.asd.find((r) => r.c.base === "A1") || Rr.asd[0]
  const settle = piled ? settleOf("deep", ctx, { st: Rr.st }, I.sAllow, nmT, "tangki")
    : settleOf("shallow", ctx, ring ? { shape: "lingkaran", B: I.D, L: I.D, Df: 0, q: a1.qin, mod: "tangki", label: nmT } : { shape: "lingkaran", B: Rr.Ds, L: Rr.Ds, Df: 0, q: a1.P / Rr.geo.A, mod: "tangki", label: nmT }, I.sAllow, nmT, "tangki")
  if (piled) settle.group = { D: Rr.D, Lp: I.pL, n: Rr.n, Bg: Rr.Bg, Lg: Rr.Lg, Q: Rr.a1 ? Rr.a1.R.P : 0, z0: I.sh, Qb: Rr.ax.Qb, Qu: Rr.ax.Qc, qb: Rr.ax.q, Ap: Rr.pp.ApSt, Ep: Rr.pp.bored ? Rr.pp.Ep : 2e8, driven: !Rr.pp.bored }
  out.checks.push(settle.check)
  const stT = settleTable(settle); if (stT) tables.push(stT)
  const notes = [
    L("Pemilihan pondasi otomatis dari diameter (dapat diganti). Ringwall: PIP STE03020 — tekanan di bawah ringwall, kesesuaian dengan tekanan area dalam, tarik melingkar Tu = 1,6·K(γh²/2 + p·h)·D/2.", "Foundation type is chosen from the diameter (can be overridden). Ringwall: PIP STE03020 — pressure under ringwall, compatibility with interior pressure, hoop tension Tu = 1.6·K(γh²/2 + p·h)·D/2."),
    L("Pelat penuh: pelat lingkaran kaku (tekanan linear tanpa tarik); momen kantilever di luar shell, momen interior dengan rumus pelat lingkaran tumpuan sederhana (beban merata + beban linear dari momen guling, Timoshenko).", "Full slab: rigid circular slab (linear no-tension pressure); cantilever moment outside the shell, interior moment from simply supported circular plate formulas (uniform + linearly varying load from overturning, Timoshenko)."),
    L("Gempa: API 650 Annex E (massa impulsif & konvektif, Mrw untuk ringwall, Ms untuk pelat), Ev = 0,14SDS (ASD) / 0,2SDS (LRFD). Angin: SNI 1727:2020 Bab 29 dengan Cf penampang bulat.", "Seismic: API 650 Annex E (impulsive & convective masses, Mrw for ringwall, Ms for slab), Ev = 0.14SDS (ASD) / 0.2SDS (LRFD). Wind: SNI 1727:2020 Ch. 29 with round-section Cf."),
    L("Penurunan tangki dihitung dengan profil tanah & kriteria dari tab Penurunan (pusat tangki, q = tekanan kontak operasi). Batas: tidak mencakup desain shell/annular plate, baut angkur tangki (bila J > 1,54), penurunan tepi/miring API 653 Annex B, dan pelat di atas tanah elastis (Winkler).", "Tank settlement uses the soil profile & criteria from the Settlement tab (tank centre, q = operating contact pressure). Limits: shell/annular plate design, tank anchor bolts (if J > 1.54), API 653 Annex B edge/tilt settlement and plate-on-elastic-foundation analysis are not covered."),
  ]
  notes.push(piled ? L("Pondasi dalam: pelat penuh kaku di atas kelompok tiang (reaksi Pi = P/n ± M·x/Σx²), lentur pelat datar terbalik (metode desain langsung, panel s × s), pons tiang; kapasitas dari tab Tanah.", "Deep foundation: rigid full slab on a pile group (Pi = P/n ± M·x/Σx²), inverted flat-plate flexure (direct design, s × s panels), pile punching; capacity from the Soil tab.") : qaNote(qs))
  const drawings = [{ make: (m) => tankDraw(I, out, palette(m)), cap: L("Gambar 1 — Tangki, pondasi, dan tekanan tanah", "Figure 1 — Tank, foundation and soil pressure") }]
  if (piled) drawings.push({ make: (m) => pilePlan(Rr.m, Rr, palette(m), L("Denah tiang di bawah pelat tangki", "Pile layout under tank slab")), cap: L("Gambar 2 — Denah tiang & reaksi (ASD penentu)", "Figure 2 — Pile layout & reactions (governing ASD)"), maxH: 320 },
    { make: (m) => pileSection(Rr.m, I, Rr, ctx.soil, palette(m)), cap: L("Gambar 3 — Potongan tiang & profil tanah", "Figure 3 — Pile section & soil profile"), maxH: 300 })
  return { file: I.preset === "wash" ? "Pondasi_WashTank" : "Pondasi_SurgeTank", title: `${L("Desain Pondasi", "Foundation Design")} ${I.preset === "wash" ? "Wash Tank" : "Surge Tank"} — ${ring ? "Ringwall" : piled ? L("Pelat di atas Tiang", "Slab on Piles") : L("Pelat Penuh", "Full Slab")}`,
    sub: `Ø${nf(I.D, 2)} × ${nf(I.Hs, 2)} m · SG ${nf(I.SG, 2)} · ${I.anchored ? L("diangkur", "anchored") : L("tanpa angkur", "unanchored")}`, refs: codes, metrics, checks: out.checks, kv, tables: tables.filter(Boolean), notes,
    drawings, cases, combos, out, settle, fdType: piled ? "deep" : "shallow", steps: [...tankSteps(I, T, out), ...(qs && qs.r ? [{ h: L("Daya dukung izin dari data tanah", "Allowable bearing from soil data"), rows: qs.r.rows }] : [])] }
}
