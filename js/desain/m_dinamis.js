// Modul halaman: Pondasi peralatan dinamis (WIP / WTP / kompresor udara / kompresor torak / lainnya).
import { L, nf, toDisp, uName, expandCombos, seismicCoef } from "./core.js"
import { PRESETS, dynamics, dynCases, analyzeDynamic } from "./dynamic.js"
import { palette, dynDraw, footingPlan } from "./draw.js"

export const id = "dinamis"
export const icon = "⚙️"
export const title = () => L("Pondasi Peralatan Dinamis", "Dynamic Equipment Foundation")
export const blurb = () => L("WIP, WTP, kompresor udara, kompresor torak: frekuensi alami 6 mode, resonansi, amplitudo & kecepatan getar, rasio massa, aturan proporsi, tekanan tanah dan tulangan blok.", "WIP, WTP, air & reciprocating compressors: 6 natural modes, resonance, vibration amplitude & velocity, mass ratio, proportion rules, soil pressure and block reinforcement.")
export const codes = "ACI 351.3R-18 · PIP STC01015 / REIE 686 · ISO 1940-1 · ISO 10816 · SNI 1726:2019 · SNI 2847:2019 · SNI 8460:2017"

export function defaults() {
  return { preset: "wip", Fo: 0, ...PRESETS.wip, exm: 0, eym: 0, Gmode: "Vs", Vs: 200, red: 0.8, Gsoil: 60000, nu: 0.35, gs: 18, sep: 20, vlim: 5, mrRot: 3, mrRec: 5, qa: 150, qRot: 0.75, qRec: 0.5, muB: 0.45,
    Pp: 0, Vpx: 2, Vpy: 1, Mpx: 0, Mpy: 0, scf: 5, Ie: 1.25, fc: 28, fy: 420, cover: 75, db: 16 }
}
const BAR = { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25" }
export function form(s) {
  return [
    { id: "mc", icon: "⚙️", t: L("Mesin", "Machine"), fields: [
      { k: "preset", type: "seg", lab: L("Peralatan", "Equipment"), opts: { wip: "WIP", wtp: "WTP", comp: L("Kompresor udara", "Air compressor"), rec: L("Kompresor torak", "Recip. compressor") }, wide: true, on: (st, k) => Object.assign(st, { Fo: 0 }, PRESETS[k]) },
      { k: "type", type: "seg", lab: L("Jenis eksitasi", "Excitation type"), opts: { rot: L("Berputar (1×)", "Rotating (1×)"), rec: L("Torak (1× & 2×)", "Reciprocating (1× & 2×)") } },
      { k: "Wm", lab: L("Berat mesin + penggerak + baseplate", "Machine + driver + baseplate weight"), u: "F", lo: 1, hi: 1e5 }, { k: "Wr", lab: L("Berat rotor", "Rotor weight"), u: "F", lo: 0.1, hi: 1e4 },
      { k: "rpm", lab: L("Kecepatan operasi", "Operating speed"), u: "rpm", lo: 60, hi: 20000 }, { k: "kW", lab: L("Daya penggerak", "Driver power"), u: "kW", lo: 0, hi: 1e5 },
      { k: "Gq", lab: L("Mutu balans ISO 1940 (G)", "ISO 1940 balance grade (G)"), u: "mm/s", lo: 0.4, hi: 40, help: L("Pompa G6,3; kompresor/turbin G2,5.", "Pumps G6.3; compressors/turbines G2.5.") },
      { k: "Fo", lab: L("Gaya tak seimbang vendor (0 = dari G)", "Vendor unbalanced force (0 = from G)"), u: "F", lo: 0, hi: 1e4 },
      { k: "hs", lab: L("Tinggi poros di atas blok", "Shaft height above block"), u: "m", lo: 0.1, hi: 4 }, { k: "hcg", lab: L("Tinggi pusat massa mesin di atas blok", "Machine CG above block"), u: "m", lo: 0.1, hi: 4 },
      { k: "Lb", lab: L("Panjang baseplate (sumbu poros)", "Baseplate length (shaft axis)"), u: "m", lo: 0.3, hi: 20 }, { k: "Bb", lab: L("Lebar baseplate", "Baseplate width"), u: "m", lo: 0.3, hi: 10 },
      { k: "exm", lab: L("Eksentrisitas mesin x", "Machine eccentricity x"), u: "m", lo: -3, hi: 3 }, { k: "eym", lab: L("Eksentrisitas mesin y", "Machine eccentricity y"), u: "m", lo: -3, hi: 3 },
      { k: "scf", lab: L("Faktor torsi hubung singkat motor", "Motor short-circuit torque factor"), u: "×Tn", lo: 0, hi: 12 },
      { k: "Vpx", lab: L("Gaya pipa Vx", "Pipe force Vx"), u: "F", lo: 0, hi: 1e4 }, { k: "Vpy", lab: L("Gaya pipa Vy", "Pipe force Vy"), u: "F", lo: 0, hi: 1e4 },
    ] },
    { id: "blk", icon: "🧊", t: L("Blok pondasi", "Foundation block"), fields: [
      { k: "Bx", lab: L("Panjang blok (sumbu poros)", "Block length (shaft axis)"), u: "m", lo: 0.8, hi: 30 }, { k: "By", lab: L("Lebar blok", "Block width"), u: "m", lo: 0.8, hi: 20 },
      { k: "H", lab: L("Tebal blok", "Block depth"), u: "m", lo: 0.4, hi: 5 }, { k: "emb", lab: L("Kedalaman tertanam", "Embedment depth"), u: "m", lo: 0, hi: 5 },
      { k: "fc", lab: "fc'", u: "MPa", lo: 17, hi: 50 }, { k: "fy", lab: "fy", u: "MPa", lo: 280, hi: 550 }, { k: "db", type: "sel", lab: L("Tulangan", "Bars"), opts: BAR },
    ] },
    { id: "soil", icon: "🧱", t: L("Tanah & kriteria", "Soil & criteria"), fields: [
      { k: "Gmode", type: "seg", lab: L("Kekakuan tanah dari", "Soil stiffness from"), opts: { Vs: "Vs", G: L("G langsung", "G direct") } },
      { k: "Vs", lab: L("Kecepatan gelombang geser Vs", "Shear-wave velocity Vs"), u: "m/s", lo: 50, hi: 1500, show: (x) => x.Gmode === "Vs" }, { k: "red", lab: L("Reduksi G (regangan)", "G reduction (strain)"), u: "", lo: 0.2, hi: 1, show: (x) => x.Gmode === "Vs" },
      { k: "Gsoil", lab: L("Modulus geser dinamis G", "Dynamic shear modulus G"), u: "Q", lo: 1000, hi: 2e6, show: (x) => x.Gmode === "G" },
      { k: "nu", lab: L("Poisson ν", "Poisson ν"), u: "", lo: 0.2, hi: 0.49 }, { k: "gs", lab: L("Berat isi tanah", "Soil unit weight"), u: "G", lo: 14, hi: 22 },
      { k: "qa", lab: L("Daya dukung izin statik qa", "Static allowable bearing qa"), u: "Q", lo: 20, hi: 2000 }, { k: "muB", lab: L("μ dasar–tanah", "Base–soil μ"), u: "", lo: 0.2, hi: 0.8 },
      { k: "sep", lab: L("Pemisahan frekuensi minimum", "Minimum frequency separation"), u: "%", lo: 5, hi: 50 }, { k: "vlim", lab: L("Batas kecepatan getar puncak", "Peak vibration velocity limit"), u: "mm/s", lo: 0.5, hi: 20 },
      { k: "mrRot", lab: L("Rasio massa min. (berputar)", "Min. mass ratio (rotating)"), u: "", lo: 1, hi: 10 }, { k: "mrRec", lab: L("Rasio massa min. (torak)", "Min. mass ratio (recip.)"), u: "", lo: 1, hi: 10 },
      { k: "qRot", lab: L("Reduksi qa (berputar)", "qa reduction (rotating)"), u: "", lo: 0.3, hi: 1 }, { k: "qRec", lab: L("Reduksi qa (torak)", "qa reduction (recip.)"), u: "", lo: 0.3, hi: 1 }, { k: "Ie", lab: L("Ie gempa", "Seismic Ie"), u: "", lo: 1, hi: 1.5 },
    ] },
  ]
}

export function run(s, ctx) {
  const I = { ...s, seis: { ...ctx.seisBase, R: 1, Ie: s.Ie, method: "rigid" }, crit: { fsOT: 1.5, fsSL: 1.5, fsOTs: 1, fsSLs: 1, tempFac: 1, minContact: 0.5 } }
  const Dy = dynamics(I)
  const { cases } = dynCases(I, Dy)
  const combos = expandCombos(cases, 5, { ...ctx.cmbOpts, labels: { Dyn1: "v", Dyn2: "h", Ex: "x", Ey: "y" } })
  const out = analyzeDynamic(I, combos)
  const pre = { wip: "Water Injection Pump", wtp: "Water Transfer Pump", comp: "Air Compressor", rec: "Reciprocating Compressor" }[I.preset] || L("Mesin", "Machine")
  out.pre = pre
  const uF = uName("F"), uQ = uName("Q")
  const vmax = Math.max(...Dy.resp.map((r) => Math.max(r.vz, r.vy)))
  const minSep = Math.min(...Dy.modes.flatMap((m) => Dy.harm.map((h) => Math.abs(m.f - h * Dy.fop) / (h * Dy.fop) * 100)))
  const metrics = [
    { lab: L("Frekuensi operasi", "Operating frequency"), val: Dy.fop, d: 2, unit: "Hz" }, { lab: L("Pemisahan frekuensi terkecil", "Smallest frequency separation"), val: minSep, d: 1, unit: "%" },
    { lab: L("Kecepatan getar puncak", "Peak vibration velocity"), val: vmax, d: 2, unit: "mm/s" }, { lab: L("Rasio massa blok/mesin", "Block/machine mass ratio"), val: Dy.mr, d: 2 },
    { lab: "Fo", val: toDisp("F", Dy.Fo), d: 2, unit: uF }, { lab: "G " + L("tanah", "soil"), val: toDisp("Q", Dy.Gs), d: 0, unit: uQ },
  ]
  const kv = [
    { title: L("Mesin", "Machine"), rows: [[L("Peralatan", "Equipment"), pre], [L("Jenis", "Type"), I.type === "rec" ? L("torak", "reciprocating") : L("berputar", "rotating")], [L("Berat mesin", "Machine weight"), toDisp("F", I.Wm), uF, 1], [L("Berat rotor", "Rotor weight"), toDisp("F", I.Wr), uF, 2], [L("Putaran", "Speed"), I.rpm, "rpm", 0], [L("Daya", "Power"), I.kW, "kW", 0], ["G (ISO 1940)", I.Gq, "mm/s", 1], ["Fo", toDisp("F", Dy.Fo), uF, 3], [L("Torsi nominal Tn", "Rated torque Tn"), toDisp("M", Dy.Tn), uName("M"), 2]] },
    { title: L("Blok & tanah", "Block & soil"), rows: [[L("Blok", "Block"), `${nf(I.Bx, 2)} × ${nf(I.By, 2)} × ${nf(I.H, 2)} m`], [L("Berat blok", "Block weight"), toDisp("F", Dy.Wb), uF, 1], [L("Tertanam", "Embedded"), I.emb, "m", 2], ["G", toDisp("Q", Dy.Gs), uQ, 0], ["ν", I.nu, "", 2], ["r0 (v/h)", Dy.r0, "m", 3], ["r0 rocking", Dy.r0p, "m", 3], ["r0 torsi", Dy.r0t, "m", 3], [L("Massa total", "Total mass"), Dy.m, "t", 2], [L("Pusat massa dari dasar", "CG above base"), Dy.zc, "m", 3]] },
  ]
  const tables = [
    { title: L("Mode getar (Richart–Whitman, lingkaran ekuivalen, faktor tanam)", "Vibration modes (Richart–Whitman, equivalent circle, embedment factors)"), cols: ["Mode", L("Kekakuan K", "Stiffness K"), "fn (Hz)", L("Redaman ξ", "Damping ξ"), ...Dy.harm.map((h) => `${L("Beda", "Sep.")} ${h}× (%)`)],
      rows: Dy.modes.map((m) => ({ cells: [m.nm, m.K ? (m.k === "r" || m.k === "t" ? `${nf(m.K, 0)} kN·m/rad` : `${nf(m.K, 0)} kN/m`) : L("tergandeng", "coupled"), m.f, m.xi, ...Dy.harm.map((h) => Math.abs(m.f - h * Dy.fop) / (h * Dy.fop) * 100)], cls: Dy.harm.some((h) => Math.abs(m.f - h * Dy.fop) / (h * Dy.fop) < I.sep / 100) ? "bad" : "" })),
      dec: [null, null, 2, 3, 1, 1], align: ["l", "r", "r", "r", "r", "r"] },
    { title: L("Respons getar (tak tergandeng)", "Vibration response (uncoupled)"), cols: [L("Eksitasi", "Excitation"), "f (Hz)", "Az (μm)", "Ay (μm)", "vz (mm/s)", "vy (mm/s)"], rows: Dy.resp.map((r) => [`${r.h}×`, r.fe, r.Az, r.Ay, r.vz, r.vy]), dec: [null, 2, 2, 2, 3, 3], align: ["l", "r", "r", "r", "r", "r"] },
    { title: L("Kombinasi ASD — tekanan statik (qa tereduksi)", "ASD combinations — static pressure (reduced qa)"), cols: [L("Kode", "Code"), L("Rumus", "Formula"), `P (${uF})`, `q ${L("maks", "max")} (${uQ})`, `qa·f (${uQ})`, L("Kontak", "Contact"), "FS OT", "FS SL", "Status"],
      rows: out.r.asd.map((a) => ({ cells: [a.c.id, a.c.formula, toDisp("F", a.R.P), toDisp("Q", a.pr.qmax), toDisp("Q", a.qa), `${nf(a.pr.contact * 100, 0)}%`, a.fsOT, a.fsSL, a.ok ? "OK" : "NOT OK"], cls: a.ok ? "" : "bad" })), dec: [null, null, 1, 1, 1, null, 2, 2, null], align: ["l", "l", "r", "r", "r", "r", "r", "r", "l"] },
    { title: L("Tulangan blok (LRFD)", "Block reinforcement (LRFD)"), cols: [L("Arah", "Direction"), L("Bawah", "Bottom"), L("Atas", "Top")], rows: ["x", "y"].map((ax) => [ax.toUpperCase(), out.r.reinf[ax].bot.txt, out.r.reinf[ax].top ? out.r.reinf[ax].top.txt : out.r.reinf[ax].bot.txt]), align: ["l", "l", "l"],
      note: L("ACI 351.3R: pasang tulangan di semua muka (atas, bawah, samping) minimal ρ susut 0,0018 dan ≥ D16 @ 300 mm.", "ACI 351.3R: provide steel on all faces (top, bottom, sides) at least 0.0018 shrinkage ratio and ≥ D16 @ 300 mm.") },
  ]
  const notes = [
    L("Kekakuan & redaman: Richart, Hall & Woods (1970) untuk lingkaran ekuivalen; faktor penanaman Arya/Novak pada kekakuan (redaman tanpa penambahan, konservatif). Mode sliding–rocking tergandeng dari persamaan karakteristik 2 derajat kebebasan.", "Stiffness & damping: Richart, Hall & Woods (1970) for the equivalent circle; Arya/Novak embedment factors on stiffness (damping not increased, conservative). Coupled sliding–rocking modes from the 2-DOF characteristic equation."),
    L("Gaya tak seimbang Fo = mr·(G/ω)·ω² (ISO 1940) bila data vendor tidak ada. Amplitudo memakai faktor pembesaran 1 DOF; kecepatan puncak v = ω·A dibandingkan dengan batas proyek (ISO 10816/ACI 351.3R).", "Unbalanced force Fo = mr·(G/ω)·ω² (ISO 1940) when vendor data is absent. Amplitudes use 1-DOF magnification; peak velocity v = ω·A compared with the project limit (ISO 10816/ACI 351.3R)."),
    L("Statik: kombinasi D + Dyn, gempa (kaku, 0,3·SDS·Ie, termasuk massa blok), hubung singkat motor sebagai beban aksidental; daya dukung izin direduksi untuk mesin dinamis.", "Static: D + Dyn combinations, seismic (rigid, 0.3·SDS·Ie, including block mass), motor short circuit as accidental; allowable bearing reduced for dynamic machinery."),
    L("Batas: tanpa analisis tergandeng 6 DOF penuh, tanpa efek tiang/kelompok dan lapisan tanah. Untuk mesin besar atau hasil mendekati batas gunakan analisis dinamis khusus dan data vendor. Kompresor torak (eksitasi 1× dan 2×) sering memerlukan blok besar/kaku atau pondasi tiang — gunakan gaya tak seimbang primer/sekunder dari vendor.", "Limits: no full 6-DOF coupled analysis, no pile/group or layering effects. For large machines or marginal results use a dedicated dynamic analysis and vendor data. Reciprocating compressors (1× and 2× excitation) often need a large/stiff block or piles — use vendor primary/secondary unbalanced forces."),
  ]
  return { file: "Pondasi_" + pre.replace(/\s+/g, ""), title: `${L("Desain Pondasi Dinamis", "Dynamic Foundation Design")} — ${pre}`, sub: `${nf(I.rpm, 0)} rpm · ${L("blok", "block")} ${nf(I.Bx, 2)} × ${nf(I.By, 2)} × ${nf(I.H, 2)} m`, refs: codes, metrics, checks: out.checks, kv, tables, notes,
    drawings: [{ make: (m) => dynDraw(I, { ...out, Dy, pre }, palette(m)), cap: L("Gambar 1 — Blok mesin, model pegas–peredam, dan peta frekuensi", "Figure 1 — Machine block, spring–dashpot model and frequency map") }, { make: (m) => footingPlan(out.r, out.m, palette(m)), cap: L("Gambar 2 — Denah blok dan tekanan tanah", "Figure 2 — Block plan and soil pressure"), maxH: 300 }], cases, combos, out: { ...out, Dy } }
}
