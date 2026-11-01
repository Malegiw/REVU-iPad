// Modul halaman: Tiang pancang pipa baja & tiang helical (kapasitas, lateral, titik jepit, momen, kepala tiang & sambungan ke pile cap).
import { L, nf, toDisp, uName, expandCombos } from "./core.js"
import { analyzePile } from "./pile.js"
import { GRADES } from "./steel.js"
import { circlePoly, barsOnCircle, pmCurve } from "./rc.js"
import { barA } from "./core.js"
import { layersEditor, loadsEditor, addUserLoads, LOAD_LABEL } from "./ui.js"
import { palette, pileElevation, pileConnection, pmChart } from "./draw.js"
import { pileSteps } from "./steps.js"
import { skPileSection, skPileSoil, skPileGroup, skPileConn } from "./sketch.js"

export const id = "tiang"
export const icon = "📍"
export const title = () => L("Tiang Pipa Baja & Helical", "Steel Pipe & Helical Piles")
export const blurb = () => L("Kapasitas aksial tekan/tarik, lateral (Broms + Winkler), titik jepit, momen & AISC, pile cap, kepala tiang dan sambungan jepit/sendi dengan beton isi.", "Axial compression/tension, lateral (Broms + Winkler), fixity, moment & AISC, pile cap, pile head and fixed/pinned connection with infill concrete.")
export const codes = "SNI 8460:2017 · API RP 2GEO · ICC-ES AC358 · AISC 360-16 / SNI 1729:2020 · SNI 2847:2019 · IBC 1810"

export function defaults() {
  return {
    type: "pipe", D: 406.4, t: 12.7, grade: "A252_3", Fy: 310, ca: 2, open: true, L: 24, e: 0,
    ds: 141.3, ts: 9.5, helices: [300, 350, 400], zTip: 9, ratio: 3, Kt: 23, T: 0, plateCap: 0, shaft: false,
    layers: [{ h: 3, type: "clay", g: 17, cu: 30, phi: 0, nh: 0 }, { h: 7, type: "sand", g: 19, cu: 0, phi: 32, nh: 0 }, { h: 16, type: "clay", g: 18, cu: 110, phi: 0, nh: 0 }], gwt: 1.5,
    nx: 2, ny: 2, sx: 1.25, sy: 1.25, ce: 0.5, hc: 1.0, hs: 0.5, gs: 18, cx: 0.8, cy: 0.8, fcc: 30, fyc: 420, dbc: 19,
    fsC: 2.5, fsT: 3.0, fsL: 2.5, yAllow: 12, useEg: true, tempFac: 1,
    conn: "fixed", emb: 100, Lp: 1200, fcp: 30, nd: 8, dbd: 19, fyd: 420, hook: true, mu: 1.0,
    loads: [{ k: "D", P: 800 }, { k: "Do", P: 300 }, { k: "L", P: 100 }, { k: "Wx", Vx: 30, My: 60 }, { k: "Wy", Vy: 30, Mx: 60 }, { k: "Ex", Vx: 80, My: 200 }, { k: "Ey", Vy: 80, Mx: 200 }],
  }
}
const gradeOpts = () => ({ ...Object.fromEntries(Object.entries(GRADES).map(([k, g]) => [k, `${g.nm} (Fy ${g.fy})`])), custom: L("Lainnya (isi Fy)", "Other (enter Fy)") })

export function form(s, onChange) {
  const pipe = (x) => x.type === "pipe", hel = (x) => x.type === "helical"
  const setGrade = (st, v) => { if (GRADES[v]) st.Fy = GRADES[v].fy }
  return [
    { id: "sec", sketch: skPileSection, icon: "🔩", t: L("Jenis & penampang tiang", "Pile type & section"), fields: [
      { k: "type", type: "seg", lab: L("Jenis tiang", "Pile type"), opts: { pipe: L("Pipa baja (pancang)", "Steel pipe (driven)"), helical: L("Helical (ulir)", "Helical (screw)") }, wide: true,
        on: (st, v) => { if (v === "helical") Object.assign(st, { fsC: 2, fsT: 2, nd: 4, dbd: 16, Lp: 700, conn: "pinned", sx: 1.0, sy: 1.0, ce: 0.4, hc: 0.6, cx: 0.5, cy: 0.5 }); else Object.assign(st, { fsC: 2.5, fsT: 3, Lp: 1200, dbd: 19, nd: 8, conn: "fixed", sx: 1.25, sy: 1.25, ce: 0.5, hc: 1.0, cx: 0.8, cy: 0.8 }) } },
      { k: "D", lab: L("Diameter luar D", "Outer diameter D"), u: "mm", lo: 100, hi: 2500, show: pipe },
      { k: "t", lab: L("Tebal dinding t", "Wall thickness t"), u: "mm", lo: 4, hi: 60, show: pipe },
      { k: "open", type: "seg", lab: L("Ujung tiang", "Pile tip"), opts: { true: L("Terbuka (cek plug)", "Open (plug check)"), false: L("Tertutup", "Closed") }, show: pipe, on: (st, v) => { st.open = v === "true" } },
      { k: "ds", lab: L("Diameter shaft ds", "Shaft diameter ds"), u: "mm", lo: 60, hi: 400, show: hel },
      { k: "ts", lab: L("Tebal shaft t", "Shaft wall t"), u: "mm", lo: 3, hi: 25, show: hel },
      { k: "grade", type: "sel", lab: L("Mutu baja", "Steel grade"), opts: gradeOpts(), on: setGrade },
      { k: "Fy", lab: "Fy", u: "MPa", lo: 200, hi: 700, struct: true },
      { k: "ca", lab: L("Korosi (dikurangi dari t)", "Corrosion (deducted from t)"), u: "mm", lo: 0, hi: 10, help: L("Contoh: 0,05 mm/tahun × 40 tahun = 2 mm (muka luar).", "e.g. 0.05 mm/yr × 40 yr = 2 mm (outer face).") },
      { k: "helices", type: "list", lab: L("Diameter helix Dh1, Dh2, … dari bawah (mm, pisah koma)", "Helix diameters Dh1, Dh2, … from bottom (mm, comma-separated)"), show: hel, wide: true },
      { k: "zTip", lab: L("Kedalaman helix terbawah zTip", "Lead helix depth zTip"), u: "m", lo: 1, hi: 40, show: hel },
      { k: "ratio", lab: L("Jarak helix s / Dh bawah", "Helix spacing s / lower Dh"), u: "×D", lo: 1, hi: 6, show: hel },
      { k: "Kt", lab: L("Faktor torsi Kt", "Torque factor Kt"), u: "1/m", lo: 5, hi: 60, show: hel, help: L("AC358: 33 (Ø73), 30 (Ø89), 23 (Ø114) m⁻¹.", "AC358: 33 (Ø73), 30 (Ø89), 23 (Ø114) m⁻¹.") },
      { k: "T", lab: L("Torsi instalasi (0 = abaikan)", "Installation torque (0 = ignore)"), u: "M", lo: 0, hi: 500, show: hel },
      { k: "plateCap", lab: L("Kapasitas pelat helix pabrikan (0 = abaikan)", "Manufacturer helix plate capacity (0 = ignore)"), u: "F", lo: 0, hi: 5000, show: hel },
      { k: "shaft", type: "chk", lab: L("Hitung gesek shaft di atas helix teratas", "Include shaft friction above top helix"), show: hel },
    ] },
    { id: "soil", sketch: skPileSoil, icon: "🧱", t: L("Panjang tiang & profil tanah", "Pile length & soil profile"), note: L("Kedalaman diukur dari <b>kepala tiang (dasar pile cap)</b>. Lempung: metode α (API), Davisson k = 67cu. Pasir: metode β (API, δ = φ − 5°), nh Terzaghi otomatis bila 0.", "Depths are measured from the <b>pile head (pile-cap soffit)</b>. Clay: α-method (API), Davisson k = 67cu. Sand: β-method (API, δ = φ − 5°), Terzaghi nh automatic when 0."), fields: [
      { k: "L", lab: L("Panjang tertanam L", "Embedded length L"), u: "m", lo: 3, hi: 80, show: pipe },
      { k: "e", lab: L("Panjang bebas di atas tanah e", "Free length above ground e"), u: "m", lo: 0, hi: 20, help: L("0 bila dasar pile cap di muka tanah.", "0 when the cap soffit is at ground level.") },
      { k: "gwt", lab: L("Muka air tanah zw dari kepala tiang", "Groundwater zw below pile head"), u: "m", lo: 0, hi: 99 },
      { type: "layers", render: (st, oc) => layersEditor(st, "layers", oc) },
    ] },
    { id: "grp", sketch: skPileGroup, icon: "🧩", t: L("Kelompok tiang & pile cap", "Pile group & pile cap"), fields: [
      { k: "nx", lab: L("Jumlah tiang arah X", "Piles in X"), u: "", lo: 1, hi: 8, struct: true }, { k: "ny", lab: L("Jumlah tiang arah Y", "Piles in Y"), u: "", lo: 1, hi: 8, struct: true },
      { k: "sx", lab: L("Jarak tiang sx", "Spacing sx"), u: "m", lo: 0.3, hi: 10 }, { k: "sy", lab: L("Jarak tiang sy", "Spacing sy"), u: "m", lo: 0.3, hi: 10 },
      { k: "ce", lab: L("Pusat tiang ke tepi cap ce", "Pile centre to cap edge ce"), u: "m", lo: 0.15, hi: 3 }, { k: "hc", lab: L("Tebal pile cap hc", "Cap thickness hc"), u: "m", lo: 0.3, hi: 4 },
      { k: "cx", lab: L("Kolom/pedestal cx", "Column/pedestal cx"), u: "m", lo: 0.2, hi: 6 }, { k: "cy", lab: L("Kolom/pedestal cy", "Column/pedestal cy"), u: "m", lo: 0.2, hi: 6 },
      { k: "hs", lab: L("Tanah urug di atas cap hs", "Backfill above cap hs"), u: "m", lo: 0, hi: 5 }, { k: "gs", lab: L("γ tanah urug", "Backfill γ"), u: "G", lo: 10, hi: 25 },
      { k: "fcc", lab: "fc' cap", u: "MPa", lo: 17, hi: 60 }, { k: "fyc", lab: "fy", u: "MPa", lo: 280, hi: 550 }, { k: "dbc", type: "sel", lab: L("Tulangan cap", "Cap bars"), opts: { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25", 29: "D29", 32: "D32" } },
    ] },
    { id: "conn", sketch: skPileConn, icon: "🔗", t: L("Kepala tiang & sambungan ke pile cap", "Pile head & cap connection"), note: L("Perlakuan kepala tiang: potong rata pada elevasi cut-off, bersihkan bagian dalam, pasang penyumbat dasar, cor <b>beton isi</b> bersama dowel (rangkaian tulangan) yang diteruskan ke pile cap.", "Pile head treatment: cut square at cut-off level, clean the inside, fit a base plug, cast <b>infill concrete</b> with a dowel cage extended into the cap."), fields: [
      { k: "conn", type: "seg", lab: L("Jenis sambungan", "Connection type"), opts: { fixed: L("Jepit (fixed)", "Fixed"), pinned: L("Sendi (pinned)", "Pinned") }, wide: true },
      { k: "emb", lab: L("Penanaman tiang ke cap emb", "Pile embedment into cap emb"), u: "mm", lo: 50, hi: 3000 },
      { k: "Lp", lab: L("Panjang beton isi Lp", "Infill length Lp"), u: "mm", lo: 200, hi: 6000 },
      { k: "fcp", lab: L("fc' beton isi", "Infill fc'"), u: "MPa", lo: 17, hi: 60 },
      { k: "nd", lab: L("Jumlah dowel", "Number of dowels"), u: "", lo: 3, hi: 40 },
      { k: "dbd", type: "sel", lab: L("Diameter dowel", "Dowel size"), opts: { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25", 29: "D29", 32: "D32" } },
      { k: "fyd", lab: L("fy dowel", "Dowel fy"), u: "MPa", lo: 280, hi: 550 },
      { k: "mu", lab: L("μ geser friksi", "Shear-friction μ"), u: "", lo: 0.6, hi: 1.4, help: L("1,4 monolit; 1,0 dikasarkan; 0,6 tidak dikasarkan.", "1.4 monolithic; 1.0 roughened; 0.6 not roughened.") },
      { k: "hook", type: "chk", lab: L("Dowel berkait 90° di dalam cap", "Dowels with 90° hooks in cap") },
    ] },
    { id: "crit", icon: "✅", t: L("Kriteria keamanan", "Safety criteria"), open: false, fields: [
      { k: "fsC", lab: L("FS tekan", "FS compression"), u: "", lo: 1.5, hi: 4 }, { k: "fsT", lab: L("FS tarik", "FS tension"), u: "", lo: 1.5, hi: 5 }, { k: "fsL", lab: L("FS lateral (Broms)", "FS lateral (Broms)"), u: "", lo: 1.5, hi: 4 },
      { k: "yAllow", lab: L("Defleksi izin kepala", "Allowable head deflection"), u: "mm", lo: 3, hi: 100 }, { k: "tempFac", lab: L("Pengali kapasitas untuk beban sementara", "Capacity multiplier for temporary loads"), u: "", lo: 1, hi: 1.5 },
      { k: "useEg", type: "chk", lab: L("Terapkan efisiensi kelompok Converse–Labarre", "Apply Converse–Labarre group efficiency") },
    ] },
    { id: "loads", icon: "⬇️", t: L("Beban di puncak pile cap (kerja/tak terfaktor)", "Loads at top of pile cap (service/unfactored)"), note: L("Isi per kasus beban dasar; kombinasi SNI 1727/PIP dibentuk otomatis. Berat pile cap & urugan dihitung app (kasus D).", "Enter per basic load case; SNI 1727/PIP combinations are generated automatically. Cap & backfill weight are added by the app (case D)."), fields: [
      { type: "loads", render: (st, oc) => loadsEditor(st, "loads", ["Pile cap"], oc, { defKey: "L" }) },
    ] },
  ]
}

export function run(s, ctx) {
  const cases = addUserLoads({}, s.loads, 1)
  const combos = expandCombos(cases, 5, ctx.cmbOpts)
  const I = { ...s, nx: Math.max(1, Math.round(s.nx)), ny: Math.max(1, Math.round(s.ny)), nd: Math.max(3, Math.round(s.nd)) }
  const R = analyzePile(I, combos)
  // profil untuk gambar
  const gS = R.asd.reduce((a, b) => (b.r.H > a.r.H ? b : a), R.asd[0]), gU = R.lrfd.reduce((a, b) => (b.r.H > a.r.H ? b : a), R.lrfd[0])
  const Hs = gS ? gS.r.H : 0, Hu = gU ? gU.r.H : 0
  R.prof = { z: R.uH.z, y: R.uH.y.map((v) => v * Hs * 1000), M: R.uH.M.map((v) => toDisp("M", v * Hu)) }
  R.govC = R.asd.reduce((a, b) => (Math.abs(b.r.max) > Math.abs(a.r.max) ? b : a), R.asd[0])
  const F = (v, d = 1) => nf(toDisp("F", v), d), uF = uName("F"), uM = uName("M"), uQ = uName("Q")
  const sec = R.sec
  const metrics = [
    { lab: L("Qa tekan / tiang", "Qa compression / pile"), val: toDisp("F", R.Qac), d: 0, unit: uF },
    { lab: L("Qa tarik / tiang", "Qa tension / pile"), val: toDisp("F", R.Qat), d: 0, unit: uF },
    { lab: L("Ha lateral / tiang", "Ha lateral / pile"), val: toDisp("F", R.Hal), d: 1, unit: uF },
    { lab: L("Titik jepit Lf (D&R)", "Fixity depth Lf (D&R)"), val: R.Lf, d: 2, unit: "m" },
    { lab: L("P maks / tiang (ASD)", "Max P / pile (ASD)"), val: toDisp("F", R.govC ? R.govC.r.max : 0), d: 0, unit: uF },
    { lab: "φMn " + L("tiang", "pile"), val: toDisp("M", sec.phiMn), d: 0, unit: uM },
  ]
  const pileTxt = R.isH ? `Helical Ø${nf(I.ds, 1)} × ${nf(I.ts, 1)} mm, helix ${I.helices.join("/")} mm` : `${L("Pipa baja", "Steel pipe")} Ø${nf(I.D, 1)} × ${nf(I.t, 1)} mm, L = ${nf(I.L, 1)} m, ${I.open ? L("ujung terbuka", "open end") : L("ujung tertutup", "closed end")}`
  const kv = [
    { title: L("Tiang & bahan", "Pile & materials"), rows: [[L("Jenis", "Type"), pileTxt], ["Fy", I.Fy, "MPa", 0], [L("Korosi", "Corrosion"), I.ca, "mm", 1], [L("Tebal efektif", "Effective thickness"), R.tmm, "mm", 2],
      ["A", sec.A, "mm²", 0], ["I", sec.I / 1e6, "×10⁶ mm⁴", 1], ["Z", sec.Z / 1e3, "×10³ mm³", 1], ["D/t", sec.lam, "", 1], [L("Kelas lentur", "Flexural class"), sec.fclass], ["EI", R.EI, "kN·m²", 0]] },
    { title: L("Tanah", "Soil"), rows: I.layers.map((l, i) => [`${L("Lapis", "Layer")} ${i + 1} (${nf(l.h, 1)} m)`, l.type === "clay" ? `${L("lempung", "clay")} cu ${nf(toDisp("Q", l.cu), 0)} ${uQ}, γ ${nf(toDisp("G", l.g), 1)}` : `${L("pasir", "sand")} φ ${nf(l.phi, 0)}°, γ ${nf(toDisp("G", l.g), 1)}`]).concat([[L("Muka air tanah", "Groundwater"), I.gwt, "m", 1], [L("Panjang bebas e", "Free length e"), I.e, "m", 2]]) },
    { title: L("Kelompok & pile cap", "Group & cap"), rows: [[L("Susunan", "Layout"), `${I.nx} × ${I.ny} = ${R.n}`], [L("Jarak", "Spacing"), `${nf(I.sx, 2)} × ${nf(I.sy, 2)} m`], [L("Pile cap", "Pile cap"), `${nf(R.Bc, 2)} × ${nf(R.Lc, 2)} × ${nf(I.hc, 2)} m`], [L("Berat cap + urugan", "Cap + backfill weight"), toDisp("F", R.Wcap), uF, 1], ["fc' / fy", `${I.fcc} / ${I.fyc} MPa`]] },
    { title: L("Sambungan kepala tiang", "Pile-head connection"), rows: [[L("Jenis", "Type"), I.conn === "fixed" ? L("Jepit dengan beton isi bertulang", "Fixed, reinforced infill") : L("Sendi (tanam pendek + dowel)", "Pinned (short embed + dowels)")], [L("Penanaman", "Embedment"), I.emb, "mm", 0], [L("Panjang beton isi", "Infill length"), I.Lp, "mm", 0], ["Dowel", `${I.nd} D${I.dbd} (fy ${I.fyd} MPa)${I.hook ? ", " + L("berkait", "hooked") : ""}`], [L("Lingkar dowel", "Dowel circle"), R.conn.Dc, "mm", 0]] },
  ]
  const caseRows = Object.entries(cases).filter(([, v]) => v.some((x) => Math.abs(x) > 1e-12)).map(([k, v]) => [k, toDisp("F", v[0]), toDisp("F", v[1]), toDisp("F", v[2]), toDisp("M", v[3]), toDisp("M", v[4])])
  const tables = [
    { title: L("Kasus beban dasar di puncak pile cap", "Basic load cases at top of pile cap"), cols: [L("Kasus", "Case"), `P (${uF})`, `Vx (${uF})`, `Vy (${uF})`, `Mx (${uM})`, `My (${uM})`], rows: caseRows, dec: [null, 1, 1, 1, 1, 1], align: ["l", "r", "r", "r", "r", "r"],
      note: L(`Ditambah berat pile cap + urugan ${F(R.Wcap)} ${uF} sebagai beban mati (dikalikan faktor D kombinasi).`, `Plus pile cap + backfill weight ${F(R.Wcap)} ${uF} as dead load (scaled by the combination D factor).`) },
    { title: L("Kombinasi ASD — reaksi per tiang (geoteknik)", "ASD combinations — pile reactions (geotechnical)"), cols: [L("Kode", "Code"), L("Kombinasi", "Combination"), L("Rumus", "Formula"), `P ${L("total", "total")} (${uF})`, `P ${L("maks", "max")} (${uF})`, `P ${L("min", "min")} (${uF})`, `H/${L("tiang", "pile")} (${uF})`, "y (mm)", "Status"],
      rows: R.asd.map((a) => ({ cells: [a.c.id, a.c.name, a.c.formula, toDisp("F", a.r.P), toDisp("F", a.r.max), toDisp("F", a.r.min), toDisp("F", a.r.H), a.y, a.okC && a.okT && a.okH ? "OK" : "NOT OK"], cls: a.okC && a.okT && a.okH ? "" : "bad" })),
      dec: [null, null, null, 1, 1, 1, 2, 2, null], align: ["l", "l", "l", "r", "r", "r", "r", "r", "l"] },
    { title: L("Kombinasi LRFD — gaya desain tiang (struktur)", "LRFD combinations — pile design forces (structural)"), cols: [L("Kode", "Code"), L("Rumus", "Formula"), `Pu ${L("maks", "max")} (${uF})`, `Pu ${L("min", "min")} (${uF})`, `Hu/${L("tiang", "pile")} (${uF})`, `Mu ${L("tiang", "pile")} (${uM})`, `Mu ${L("kepala", "head")} (${uM})`],
      rows: R.lrfd.map((a) => [a.c.id, a.c.formula, toDisp("F", a.r.max), toDisp("F", a.r.min), toDisp("F", a.r.H), toDisp("M", a.r.H * R.uH.Mmax), toDisp("M", Math.abs(a.r.H * R.uH.Mhead))]), dec: [null, null, 1, 1, 2, 2, 2], align: ["l", "l", "r", "r", "r", "r", "r"] },
  ]
  if (R.isH) tables.push({ title: L("Kapasitas helical (individual bearing, AC358)", "Helical capacity (individual bearing, AC358)"), cols: ["Helix", L("Kedalaman (m)", "Depth (m)"), L("Tanah", "Soil"), `q (${uQ})`, `Q (${uF})`],
    rows: R.ax.hel.map((h, i) => [`${i + 1}: Ø${nf(h.Dh * 1000, 0)}`, h.z, h.type === "clay" ? "9·cu" : "σ'v·Nq", toDisp("Q", h.q), toDisp("F", h.Q)]).concat([[L("Gesek shaft", "Shaft friction"), "", "", "", toDisp("F", R.ax.Qs)], [L("Total bearing", "Total bearing"), "", "", "", toDisp("F", R.ax.Qbear)], [L("Korelasi torsi Kt·T", "Torque correlation Kt·T"), "", "", "", isFinite(R.ax.Qtq) ? toDisp("F", R.ax.Qtq) : "–"]]),
    dec: [null, 2, null, 0, 1], align: ["l", "r", "l", "r", "r"] })
  else tables.push({ title: L("Kapasitas aksial pipa (API RP 2GEO)", "Pipe axial capacity (API RP 2GEO)"), cols: [L("Komponen", "Component"), L("Nilai", "Value"), L("Satuan", "Unit")],
    rows: [[L("Gesek selimut luar Qs,out", "Outer shaft friction Qs,out"), toDisp("F", R.ax.Qso), uF], [L("Gesek dalam Qs,in (ujung terbuka)", "Inner friction Qs,in (open end)"), toDisp("F", R.ax.Qsi), uF], [L("Tahanan ujung satuan q", "Unit end bearing q"), toDisp("Q", R.ax.q), uQ],
      [L("Ujung tiang", "Tip condition"), R.ax.plugged ? L("tersumbat (plug)", "plugged") : L("tidak tersumbat", "unplugged"), ""], [L("Qu tekan", "Qu compression"), toDisp("F", R.ax.Qc), uF], [L("Qu tarik (+ berat tiang)", "Qu tension (+ pile weight)"), toDisp("F", R.ax.Qt), uF],
      [L("Efisiensi kelompok Eg", "Group efficiency Eg"), R.Eg, "–"], [`Qa = Qu·Eg/FS (FS ${nf(I.fsC, 1)} / ${nf(I.fsT, 1)})`, `${F(R.Qac, 0)} / ${F(R.Qat, 0)}`, uF]], dec: [null, 2, null], align: ["l", "r", "l"] })
  tables.push({ title: L("Lateral, titik jepit & kapasitas struktur", "Lateral, fixity & structural capacity"), cols: [L("Besaran", "Quantity"), L("Nilai", "Value"), L("Keterangan", "Note")], rows: [
    [R.Tch ? "T = (EI/nh)^(1/5)" : "R = (EI/k)^(1/4)", `${nf(R.Tch || R.Rch, 3)} m`, L("panjang karakteristik (lapis atas)", "characteristic length (top layer)")],
    [L("Titik jepit Davisson–Robinson", "Davisson–Robinson fixity"), `${nf(R.Lf, 2)} m`, R.Tch ? "1,8T" : "1,4R"], [L("Titik jepit setara (Winkler)", "Equivalent fixity (Winkler)"), `${nf(R.LfFE, 2)} m`, L("defleksi kepala sama", "same head deflection")],
    [L("Panjang tekuk K·(e + Lf)", "Buckling length K·(e + Lf)"), `${nf(R.Kf, 1)} × ${nf(R.Le, 2)} m`, R.head === "fixed" ? L("jepit–goyang K = 1,2", "fixed–sway K = 1.2") : L("bebas–goyang K = 2,1", "free–sway K = 2.1")],
    [L("p-multiplier kelompok", "Group p-multiplier"), nf(R.pmF, 2), "AASHTO 10.7.2.4"], [`Hu Broms (${L("kepala bebas", "free head")})`, `${F(R.br.free)} ${uF}`, R.br.modeFree], [`Hu Broms (${L("kepala jepit", "fixed head")})`, `${F(R.br.fixed)} ${uF}`, R.br.modeFix],
    [L("Defleksi kepala per 1 kN", "Head deflection per 1 kN"), `${nf(R.uH.y0 * 1000, 4)} mm`, R.head === "fixed" ? L("kepala jepit", "fixed head") : L("kepala bebas", "free head")], [L("Momen maks per 1 kN", "Max moment per 1 kN"), `${nf(R.uH.Mmax, 3)} kN·m`, `z = ${nf(R.uH.zMmax, 2)} m`],
    ["φPn / φPt", `${F(sec.phiPn, 0)} / ${F(sec.phiPt, 0)} ${uF}`, "AISC E3/E7, D2"], ["φMn", `${nf(toDisp("M", sec.phiMn), 1)} ${uM}`, `AISC F8 (${sec.fclass})`], ["φVn", `${F(sec.phiVn, 0)} ${uF}`, "AISC G5"], ["Pe", `${F(R.Pe, 0)} ${uF}`, "π²EI/(KLe)²"],
  ], align: ["l", "r", "l"] })
  tables.push({ title: L("Pile cap — tulangan", "Pile cap — reinforcement"), cols: [L("Arah", "Direction"), `Mu (${uName("Mm")})`, L("Tulangan bawah", "Bottom bars"), "d (mm)"], rows: [["X", toDisp("Mm", R.capd.Mx), R.capd.bx.txt, R.capd.d], ["Y", toDisp("Mm", R.capd.My), R.capd.by.txt, R.capd.d]], dec: [null, 1, null, 0], align: ["l", "r", "l", "r"] })
  const drawings = [
    { make: (m) => pileElevation(I, R, palette(m)), cap: L("Gambar 1 — Potongan kelompok tiang, profil tanah, titik jepit, serta defleksi & momen tiang", "Figure 1 — Pile group section, soil profile, fixity, pile deflection & moment") },
    { make: (m) => pileConnection(I, R, palette(m)), cap: L("Gambar 2 — Detail kepala tiang/sambungan dan denah reaksi tiang", "Figure 2 — Pile head/connection detail and pile reaction plan") },
  ]
  if (R.head === "fixed" && R.conn.pm) {
    const curve = pmCurve(R.conn.pm.poly, R.conn.pm.bars, I.fcp, I.fyd, 0, false, 36)
    drawings.push({ make: (m) => pmChart(curve, [[R.conn.Mu, -R.conn.Tu, R.conn.Mu <= R.conn.pm.phiMn]], palette(m), L("Interaksi P–M beton isi (sambungan jepit)", "P–M interaction of infill (fixed connection)")), cap: L("Gambar 3 — Diagram interaksi penampang beton isi bertulang", "Figure 3 — Interaction diagram of the reinforced infill section"), maxH: 260, small: true })
  }
  const notes = [
    L("Kapasitas aksial: API RP 2GEO (α untuk lempung, β untuk pasir dengan batas fs dan q), ujung terbuka dicek tersumbat/tidak; helical: individual bearing (AC358, Nq = 1 + 0,56(12φ)^(φ/54)) dan korelasi torsi bila diisi.", "Axial capacity: API RP 2GEO (α for clay, β for sand with fs and q limits), open-end plugged/unplugged; helical: individual bearing (AC358, Nq = 1 + 0.56(12φ)^(φ/54)) and torque correlation when given."),
    L("Lateral: Broms umum (pu = 3Kp·σ'v·D pasir; 9cu·D di bawah 1,5D lempung) sebagai kapasitas ultimit, Winkler/elemen hingga linear (nh Terzaghi, k = 67cu Davisson) untuk defleksi & momen layan/terfaktor.", "Lateral: generalised Broms (pu = 3Kp·σ'v·D sand; 9cu·D below 1.5D clay) for ultimate capacity, linear Winkler/finite elements (Terzaghi nh, Davisson k = 67cu) for service/factored deflection & moment."),
    L("Struktur: AISC 360-16 (SNI 1729:2020) dengan penampang setelah korosi; interaksi H1-1 memakai amplifikasi B1 = 1/(1 − Pr/Pe).", "Structure: AISC 360-16 (SNI 1729:2020) on the corroded section; H1-1 interaction with B1 = 1/(1 − Pr/Pe)."),
    L("Batas: tanpa analisis p-y nonlinear, penurunan kelompok, gesek negatif, pancang (driveability), dan likuefaksi. Verifikasi dengan uji beban (PDA/statik) sesuai SNI 8460:2017.", "Limits: no nonlinear p-y, group settlement, downdrag, driveability or liquefaction. Verify with load tests (PDA/static) per SNI 8460:2017."),
    ...R.warn,
  ]
  return { file: R.isH ? "Tiang_Helical" : "Tiang_Pipa", title: R.isH ? L("Desain Tiang Helical & Sambungan Pile Cap", "Helical Pile & Pile-Cap Connection Design") : L("Desain Tiang Pipa Baja & Sambungan Pile Cap", "Steel Pipe Pile & Pile-Cap Connection Design"),
    sub: `${pileTxt} · ${I.nx}×${I.ny} · ${I.conn === "fixed" ? L("kepala jepit, beton isi bertulang", "fixed head, reinforced infill") : L("kepala sendi", "pinned head")}`, refs: codes + " · SNI 1727:2020 · SNI 1726:2019",
    metrics, checks: R.checks, kv, tables, notes, drawings, cases, combos, R, steps: pileSteps(I, R) }
}
