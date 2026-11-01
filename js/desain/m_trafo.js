// Modul halaman: Pondasi trafo daya (peralatan statis) — plinth, telapak, bak oli, dongkrak, penahan gempa.
import { L, nf, toDisp, uName, expandCombos } from "./core.js"
import { PRESET, trafoCases, analyzeTrafo } from "./trafo.js"
import { loadsEditor, addUserLoads } from "./ui.js"
import { palette, trafoDraw, footingPlan } from "./draw.js"
import { skTrafo } from "./sketch.js"
import { trafoSteps } from "./steps.js"
import { settleBlock, footFrom } from "./settle.js"

export const id = "trafo"
export const icon = "⚡"
export const title = () => L("Pondasi Trafo (Statis)", "Transformer Foundation (Static)")
export const blurb = () => L("Trafo daya di atas plinth & telapak: angin, gempa peralatan kaku, stabilitas, tulangan, geser, bak penampung oli (IEEE 980), beban dongkrak, penahan gempa.", "Power transformer on plinth & footing: wind, rigid-equipment seismic, stability, reinforcement, shear, oil containment pit (IEEE 980), jacking, seismic restraint.")
export const codes = "IEEE 980-2020 · IEEE 693 · PIP STC01015 · SNI 1727:2020 · SNI 1726:2019 · SNI 2847:2019 · SNI 8460:2017"

export function defaults() {
  return { ...PRESET, Ie: 1.5, method: "rigid", R: 2, gs: 18, qa: 150, muB: 0.45, fsOT: 1.5, fsSL: 1.5, tempFac: 1, minContact: 0.5, fc: 30, fy: 420, cover: 75, db: 16, nBars: 40, dbP: 16, Lm: 0, extra: [] }
}
const BAR = { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25" }
export function form() {
  return [
    { id: "tr", icon: "⚡", t: L("Trafo", "Transformer"), fields: [
      { k: "mva", lab: L("Kapasitas", "Rating"), u: "MVA", lo: 0.1, hi: 1000 }, { k: "W", lab: L("Berat total (termasuk oli)", "Total weight (incl. oil)"), u: "F", lo: 5, hi: 1e5 },
      { k: "Voil", lab: L("Volume oli", "Oil volume"), u: "L", lo: 0, hi: 2e5 }, { k: "Lt", lab: L("Panjang badan Lt (X)", "Body length Lt (X)"), u: "m", lo: 0.5, hi: 20 },
      { k: "Bt", lab: L("Lebar badan Bt (Y)", "Body width Bt (Y)"), u: "m", lo: 0.5, hi: 12 }, { k: "Ht", lab: L("Tinggi total Ht", "Overall height Ht"), u: "m", lo: 0.5, hi: 15 },
      { k: "hcg", lab: L("Tinggi pusat massa hcg di atas plinth", "CG hcg above plinth"), u: "m", lo: 0.2, hi: 8 }, { k: "Lm", lab: L("Beban hidup perawatan", "Maintenance live load"), u: "F", lo: 0, hi: 1e4 },
    ] },
    { id: "fd", sketch: skTrafo, icon: "🏗️", t: L("Plinth & telapak", "Plinth & footing"), fields: [
      { k: "Lp", lab: L("Plinth arah X, Lp", "Plinth X, Lp"), u: "m", lo: 0.5, hi: 20 }, { k: "Bp", lab: L("Plinth arah Y, Bp", "Plinth Y, Bp"), u: "m", lo: 0.5, hi: 15 }, { k: "hp", lab: L("Tinggi plinth hp", "Plinth height hp"), u: "m", lo: 0.2, hi: 3 },
      { k: "Lf", lab: L("Telapak arah X, Lf", "Footing X, Lf"), u: "m", lo: 1, hi: 30 }, { k: "B", lab: L("Telapak arah Y, B", "Footing Y, B"), u: "m", lo: 1, hi: 30 }, { k: "t", lab: L("Tebal telapak t", "Footing thickness t"), u: "m", lo: 0.25, hi: 3 },
      { k: "Df", lab: L("Kedalaman dasar Df", "Base depth Df"), u: "m", lo: 0.3, hi: 5 }, { k: "fc", lab: "fc'", u: "MPa", lo: 17, hi: 60 }, { k: "fy", lab: "fy", u: "MPa", lo: 280, hi: 550 },
      { k: "db", type: "sel", lab: L("Tulangan telapak", "Footing bars"), opts: BAR },
    ] },
    { id: "pit", icon: "🛢", t: L("Bak penampung oli & instalasi", "Oil pit & installation"), fields: [
      { k: "Lpit", lab: L("Bak oli dalam Lpit (X)", "Pit inside Lpit (X)"), u: "m", lo: 1, hi: 40 }, { k: "Bpit", lab: L("Bak oli dalam Bpit (Y)", "Pit inside Bpit (Y)"), u: "m", lo: 1, hi: 40 }, { k: "hpit", lab: L("Kedalaman bak hpit", "Pit depth hpit"), u: "m", lo: 0.2, hi: 3 },
      { k: "hg", lab: L("Tebal kerikil hg", "Gravel layer hg"), u: "m", lo: 0, hi: 1 }, { k: "por", lab: L("Porositas kerikil", "Gravel porosity"), u: "", lo: 0.2, hi: 0.45 },
      { k: "rain", lab: L("Hujan rencana", "Design rainfall"), u: "mm", lo: 0, hi: 500 }, { k: "fireW", lab: L("Air pemadam", "Fire water"), u: "m³", lo: 0, hi: 500 },
      { k: "nJack", lab: L("Titik dongkrak", "Jacking points"), u: "", lo: 2, hi: 8 }, { k: "jackB", lab: L("Pelat dongkrak (sisi)", "Jacking plate (side)"), u: "m", lo: 0.1, hi: 1 },
      { k: "muT", lab: L("μ trafo–plinth", "Transformer–plinth μ"), u: "", lo: 0.1, hi: 0.7 },
    ] },
    { id: "soil", icon: "🧱", t: L("Tanah, gempa & kriteria", "Soil, seismic & criteria"), fields: [
      { k: "qa", lab: L("Daya dukung izin qa", "Allowable bearing qa"), u: "Q", lo: 20, hi: 2000 }, { k: "sAllow", lab: L("Batas penurunan izin (0 = ikut tab Penurunan)", "Allowable settlement (0 = use Settlement tab)"), u: "mm", lo: 0, hi: 1000 },
      { k: "muB", lab: L("μ dasar–tanah", "Base–soil μ"), u: "", lo: 0.2, hi: 0.8 }, { k: "gs", lab: L("γ tanah urug", "Backfill γ"), u: "G", lo: 12, hi: 23 },
      { k: "method", type: "seg", lab: L("Metode gempa", "Seismic method"), opts: { rigid: L("Kaku 0,3·SDS·Ie", "Rigid 0.3·SDS·Ie"), cs: "Cs = SDS/(R/Ie)" } }, { k: "R", lab: "R", u: "", lo: 1, hi: 8, show: (x) => x.method === "cs" },
      { k: "Ie", lab: L("Faktor keutamaan Ie", "Importance factor Ie"), u: "", lo: 1, hi: 1.5, help: L("Gardu/peralatan listrik esensial: 1,5.", "Essential substation equipment: 1.5.") },
      { k: "fsOT", lab: L("FS guling", "FS overturning"), u: "", lo: 1, hi: 3 }, { k: "fsSL", lab: L("FS geser", "FS sliding"), u: "", lo: 1, hi: 3 },
    ] },
    { id: "loads", icon: "⬇️", t: L("Beban tambahan pengguna (opsional)", "Additional user loads (optional)"), open: false, fields: [
      { type: "loads", render: (st, oc) => loadsEditor(st, "extra", ["Plinth"], oc, { defKey: "L" }) },
    ] },
  ]
}

export function run(s, ctx) {
  const I = { ...s, wind: ctx.wind, seis: { ...ctx.seisBase, R: s.R, Ie: s.Ie, method: s.method }, crit: { fsOT: s.fsOT, fsSL: s.fsSL, fsOTs: 1, fsSLs: 1, tempFac: s.tempFac, minContact: s.minContact } }
  const { cases, meta } = trafoCases(I)
  addUserLoads(cases, s.extra, 1)
  const combos = expandCombos(cases, 5, ctx.cmbOpts)
  const out = analyzeTrafo(I, combos, meta)
  const r = out.r, uF = uName("F"), uQ = uName("Q")
  const gq = r.asd.reduce((a, b) => (b.pr.qmax / b.qa > a.pr.qmax / a.qa ? b : a), r.asd[0])
  const metrics = [
    { lab: L("q maks (ASD)", "Max q (ASD)"), val: toDisp("Q", gq.pr.qmax), d: 1, unit: uQ }, { lab: L("Gaya gempa V", "Seismic force V"), val: toDisp("F", meta.Vs), d: 1, unit: uF },
    { lab: L("Volume bak tersedia", "Available pit volume"), val: out.Vavail, d: 1, unit: "m³" }, { lab: L("Volume perlu", "Required volume"), val: out.Vreq, d: 1, unit: "m³" },
    { lab: L("FS guling min", "Min FS overturning"), val: Math.min(...r.asd.map((a) => a.fsOT)), d: 2 }, { lab: L("Tulangan bawah X", "Bottom bars X"), val: r.reinf.x.bot.txt },
  ]
  const kv = [
    { title: L("Trafo", "Transformer"), rows: [[L("Kapasitas", "Rating"), I.mva, "MVA", 0], [L("Berat total", "Total weight"), toDisp("F", I.W), uF, 1], [L("Oli", "Oil"), I.Voil, "L", 0], [L("Badan L × B × H", "Body L × B × H"), `${nf(I.Lt, 2)} × ${nf(I.Bt, 2)} × ${nf(I.Ht, 2)} m`], [L("Pusat massa", "CG"), I.hcg, "m", 2]] },
    { title: L("Angin & gempa", "Wind & seismic"), rows: [["V", ctx.wind.V, "m/s", 1], ["Fx / Fy", `${nf(toDisp("F", meta.fx.F), 1)} / ${nf(toDisp("F", meta.fy.F), 1)} ${uF}`], ["SDS", ctx.sp.SDS, "", 3], ["Cs", meta.cs, "", 4], ["V", toDisp("F", meta.Vs), uF, 1]] },
    { title: L("Pondasi & bak oli", "Foundation & pit"), rows: [["Plinth", `${nf(I.Lp, 2)} × ${nf(I.Bp, 2)} × ${nf(I.hp, 2)} m`], [L("Telapak", "Footing"), `${nf(I.Lf, 2)} × ${nf(I.B, 2)} × ${nf(I.t, 2)} m`], [L("Bak oli", "Oil pit"), `${nf(I.Lpit, 2)} × ${nf(I.Bpit, 2)} × ${nf(I.hpit, 2)} m`], [L("Kerikil", "Gravel"), `${nf(I.hg, 2)} m, n = ${nf(I.por, 2)}`], [L("Volume tersedia / perlu", "Volume available / required"), `${nf(out.Vavail, 2)} / ${nf(out.Vreq, 2)} m³`]] },
  ]
  const tables = [
    { title: L("Kombinasi ASD — tekanan & stabilitas", "ASD combinations — pressure & stability"), cols: [L("Kode", "Code"), L("Rumus", "Formula"), `P (${uF})`, "ex (m)", "ey (m)", `q ${L("maks", "max")} (${uQ})`, L("Kontak", "Contact"), "FS OT", "FS SL", "Status"],
      rows: r.asd.map((a) => ({ cells: [a.c.id, a.c.formula, toDisp("F", a.R.P), a.pr.ex, a.pr.ey, toDisp("Q", a.pr.qmax), `${nf(a.pr.contact * 100, 0)}%`, a.fsOT, a.fsSL, a.ok ? "OK" : "NOT OK"], cls: a.ok ? "" : "bad" })), dec: [null, null, 1, 3, 3, 1, null, 2, 2, null], align: ["l", "l", "r", "r", "r", "r", "r", "r", "r", "l"] },
    { title: L("Desain telapak (LRFD)", "Footing design (LRFD)"), cols: [L("Arah", "Direction"), `Mu+ (${uName("Mm")})`, `Mu− (${uName("Mm")})`, L("Bawah", "Bottom"), L("Atas", "Top"), `Vu (${uName("W")})`, `φVc (${uName("W")})`],
      rows: ["x", "y"].map((ax) => { const q = r.reinf[ax]; return [ax.toUpperCase(), toDisp("Mm", q.Mpos), toDisp("Mm", q.Mneg), q.bot.txt, q.top ? q.top.txt : "–", toDisp("W", q.Vu), toDisp("W", q.phiVc)] }), dec: [null, 1, 1, null, null, 1, 1], align: ["l", "r", "r", "l", "l", "r", "r"] },
  ]
  const a1 = r.asd.find((a) => a.c.base === "A1") || r.asd[0]
  const settle = settleBlock(footFrom("rect", I.Lf, I.B, r.geo.A, I.Df, a1.R.P / r.geo.A, "trafo", L("Trafo", "Transformer") + ` ${nf(I.mva, 0)} MVA`), I.sAllow || 0)
  out.checks.push(settle.check)
  if (settle.table) tables.push(settle.table)
  const notes = [
    L("Bak oli: volume bebas di atas kerikil + pori kerikil dikurangi plinth ≥ 110% volume oli + hujan rencana + air pemadam (IEEE 980). Pertimbangkan saluran ke oil–water separator.", "Oil pit: free volume above gravel + gravel voids minus plinth ≥ 110% oil + design rain + fire water (IEEE 980). Consider drainage to an oil–water separator."),
    L("Gempa: peralatan kaku 0,3·SDS·Ie (SNI 1726 §15.4.2), Ie = 1,5 untuk gardu esensial; trafo harus diikat ke pelat tanam/stopper (IEEE 693) — gesek tidak diandalkan.", "Seismic: rigid equipment 0.3·SDS·Ie (SNI 1726 §15.4.2), Ie = 1.5 for essential substations; the transformer must be tied to embeds/stoppers (IEEE 693) — friction is not relied on."),
    L("Dongkrak: dua dongkrak mengangkat satu ujung (W/2 per titik, faktor 1,4) — cek tumpu & pons di plinth; tempatkan titik dongkrak sesuai gambar vendor.", "Jacking: two jacks lift one end (W/2 per point, factor 1.4) — bearing & punching on the plinth; locate jacking points per vendor drawing."),
  ]
  return { file: "Pondasi_Trafo", title: L("Desain Pondasi Trafo Daya", "Power Transformer Foundation Design"), sub: `${nf(I.mva, 0)} MVA · ${nf(toDisp("F", I.W), 0)} ${uF} · plinth ${nf(I.Lp, 2)} × ${nf(I.Bp, 2)} m · ${L("telapak", "footing")} ${nf(I.Lf, 2)} × ${nf(I.B, 2)} m`, refs: codes, metrics, checks: out.checks, kv, tables, notes,
    drawings: [{ make: (m) => trafoDraw(I, out, palette(m)), cap: L("Gambar 1 — Trafo, plinth, bak oli, dan telapak", "Figure 1 — Transformer, plinth, oil pit and footing") }, { make: (m) => footingPlan(r, out.m, palette(m)), cap: L("Gambar 2 — Denah telapak dan tekanan tanah", "Figure 2 — Footing plan and soil pressure"), maxH: 300 }], cases, combos, out, settle, steps: trafoSteps(I, meta, out) }
}
