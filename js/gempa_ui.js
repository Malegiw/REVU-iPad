// Tab "Gempa": parameter gempa proyek SNI 1726:2019 — Ss, S1, TL, kelas situs (otomatis dari tab Tanah atau manual), kategori risiko → Ie,
// Fa/Fv, SMS/SM1, SDS/SD1, T0/Ts, kategori desain seismik, dan spektrum respons desain. Dipakai semua modul Desain.
import { L, lang, nf, SITES } from "./desain/core.js"
import { el, field, exportBar, reveal, tableView } from "./desain/ui.js"
import { palette } from "./desain/draw.js"
import { lineChart } from "./desain/chart.js"
import { projLoad, projSave, seisSite, spectrum, stepper, RISK_IE } from "./project.js"
import { initUnits, hero, card, footer, nextBtn } from "./pj_ui.js"

export function mountGempa(box, ctx) {
  lang.cur = ctx.lang
  initUnits()
  const P = projLoad(), se = P.seis
  box.textContent = ""
  const inBox = el("div"), resBox = el("div"), expBox = el("div", "dz-expbox dz-in")
  box.append(stepper("gempa", P), hero(L("Langkah 2 · data proyek", "Step 2 · project data"), L("Parameter Gempa", "Seismic Parameters"),
    L("Isi Ss dan S1 dari peta gempa (SNI 1726:2019 / RSA Puskim). Kelas situs diambil otomatis dari N̄ data tanah atau dipilih manual. Hasil SDS, SD1 dan spektrum dipakai seluruh modul Desain (gempa peralatan, API 650 Annex E, kombinasi Ev).",
      "Enter Ss and S1 from the hazard map (SNI 1726:2019 / Puskim RSA). Site class comes automatically from the soil N̄ or is chosen manually. SDS, SD1 and the spectrum feed every Design module (equipment seismic, API 650 Annex E, Ev combinations)."),
    ["SNI 1726:2019", "ASCE 7-16", L("Spektrum desain", "Design spectrum"), "KDS / SDC"]), inBox, resBox, expBox, nextBtn("#/desain", L("Lanjut: desain pondasi", "Next: foundation design"), L("dangkal atau dalam, data tanah & gempa terpakai otomatis", "shallow or deep, soil & seismic data applied automatically")), footer())
  let timer = 0, last = null
  const changed = (structural) => { projSave(P); if (structural) drawInputs(); clearTimeout(timer); timer = setTimeout(drawResults, structural ? 0 : 140) }
  function drawInputs() {
    inBox.textContent = ""
    const g = el("div", "dz-grid")
    g.append(field({ k: "Ss", lab: L("Ss — percepatan batuan dasar perioda pendek (g)", "Ss — short-period bedrock acceleration (g)"), u: "", lo: 0, hi: 3, obj: se, help: L("Peta MCER SNI 1726:2019 Gambar 15 / rsa.ciptakarya.pu.go.id.", "SNI 1726:2019 MCER map Fig. 15 / rsa.ciptakarya.pu.go.id.") }, se, changed),
      field({ k: "S1", lab: L("S1 — percepatan batuan dasar perioda 1 detik (g)", "S1 — 1-second bedrock acceleration (g)"), u: "", lo: 0, hi: 1.5, obj: se }, se, changed),
      field({ k: "TL", lab: L("TL — perioda transisi panjang", "TL — long-period transition"), u: "s", lo: 2, hi: 20, obj: se, help: L("SNI 1726:2019 Gambar 20 (umumnya 6–20 s).", "SNI 1726:2019 Fig. 20 (typically 6–20 s).") }, se, changed),
      field({ k: "risk", type: "seg", lab: L("Kategori risiko (SNI 1726 Tabel 3)", "Risk category (SNI 1726 Table 3)"), opts: { I: "I", II: "II", III: "III", IV: "IV" }, obj: se, help: L("Fasilitas migas berbahaya/beracun umumnya III–IV.", "Hazardous O&G facilities are typically III–IV.") }, se, changed),
      field({ k: "clsMode", type: "seg", lab: L("Kelas situs", "Site class"), opts: { auto: L("Otomatis dari tab Tanah", "Auto from Soil tab"), manual: L("Manual", "Manual") }, obj: se, wide: true }, se, changed))
    if (se.clsMode === "manual") g.append(field({ k: "cls", type: "seg", lab: L("Kelas situs manual", "Manual site class"), opts: Object.fromEntries(SITES.map((x) => [x, x])), obj: se }, se, changed))
    inBox.append(card("g-in", "🌐", L("Masukan gempa", "Seismic input"), `Ss ${nf(se.Ss, 2)} · S1 ${nf(se.S1, 2)}`, g))
  }
  function drawResults() {
    const ss = seisSite(P), sp = ss.sp, out = buildOut(P, ss)
    last = out
    resBox.textContent = ""
    const chips = el("div", "pj-kpis")
    ;[["Fa", sp.Fa, 3], ["Fv", sp.Fv, 3], ["SMS", sp.SMS, 3], ["SM1", sp.SM1, 3], ["SDS", sp.SDS, 3], ["SD1", sp.SD1, 3], ["T0 (s)", sp.T0, 3], ["Ts (s)", sp.Ts, 3], ["Ie", ss.Ie, 2], [L("KDS", "SDC"), ss.SDC]].forEach(([k, v, d], i) => {
      const c = el("div", "pj-kpi dz-in" + (k === "SDS" || k === "SD1" ? " hi" : "")); c.style.setProperty("--i", i); c.append(el("span", null, k), el("b", null, typeof v === "number" ? nf(v, d) : v)); chips.append(c)
    })
    const sc = ss.sc, note = el("p", "dz-note")
    note.innerHTML = ss.auto ? L(`Kelas situs <b>${ss.cls}</b> otomatis dari tab Tanah: ${sc.why}.`, `Site class <b>${ss.cls}</b> automatic from the Soil tab: ${sc.why}.`) : L(`Kelas situs manual <b>${ss.cls}</b> (dari data tanah: ${sc.cls}, ${sc.why}).`, `Manual site class <b>${ss.cls}</b> (soil data gives ${sc.cls}, ${sc.why}).`)
    if (ss.cls === "SE" && ss.Ss >= 1) note.innerHTML += " " + L("⚠️ SE dengan Ss ≥ 1,0: SNI 1726 §6.10.1 mensyaratkan analisis respons spesifik situs, kecuali pengecualian berlaku.", "⚠️ SE with Ss ≥ 1.0: SNI 1726 §6.10.1 requires a site-specific response analysis unless exceptions apply.")
    const stt = tableView({ title: out.steps[0].h, cols: [L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")], rows: out.steps[0].rows, align: ["l", "l", "l", "r"] }); stt.classList.add("dz-steptbl")
    resBox.append(card("g-res", "📊", L("Parameter respons desain", "Design response parameters"), `${L("Kelas", "Class")} ${ss.cls} · KDS ${ss.SDC}`, [chips, note, stt]))
    const fig = el("figure", "dz-fig pj-fig"); fig.append(out.drawings[0].make("screen"))
    resBox.append(card("g-sp", "📈", L("Spektrum respons desain (SNI 1726:2019 §6.4)", "Design response spectrum (SNI 1726:2019 §6.4)"), null, [fig, tableView(out.tables[0])]))
    exportBar(expBox, () => last, { project: P.info })
    reveal(box)
  }
  drawInputs(); drawResults()
}

export function seisReport(P) { return buildOut(P, seisSite(P)) }
function buildOut(P, ss) {
  const sp = ss.sp, pts = spectrum(sp, ss.TL, 4, 160)
  const Ts = [0, sp.T0, 0.2, sp.Ts, 0.5, 0.75, 1, 1.5, 2, 3, 4].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
  const SaAt = (T) => (T < sp.T0 ? sp.SDS * (0.4 + 0.6 * T / Math.max(sp.T0, 1e-9)) : T <= sp.Ts ? sp.SDS : T <= ss.TL ? sp.SD1 / T : sp.SD1 * ss.TL / (T * T))
  const steps = [
    [L("Kelas situs", "Site class"), ss.auto ? "N̄ = Σdi/Σ(di/Ni) (30 m)" : L("dipilih manual", "chosen manually"), ss.auto ? `N̄ = ${nf(ss.sc.Nbar, 1)}` : "", ss.cls],
    ["Fa", L("SNI 1726 Tabel 6 (interpolasi Ss)", "SNI 1726 Table 6 (interpolate Ss)"), `Ss = ${nf(ss.Ss, 3)}`, nf(sp.Fa, 3)],
    ["Fv", L("SNI 1726 Tabel 7 (interpolasi S1)", "SNI 1726 Table 7 (interpolate S1)"), `S1 = ${nf(ss.S1, 3)}`, nf(sp.Fv, 3)],
    ["SMS ; SM1", "Fa·Ss ; Fv·S1", `${nf(sp.Fa, 3)} × ${nf(ss.Ss, 3)} ; ${nf(sp.Fv, 3)} × ${nf(ss.S1, 3)}`, `${nf(sp.SMS, 3)} ; ${nf(sp.SM1, 3)}`],
    ["SDS ; SD1", "2/3·SMS ; 2/3·SM1", "", `${nf(sp.SDS, 3)} ; ${nf(sp.SD1, 3)}`],
    ["T0 ; Ts", "0,2·SD1/SDS ; SD1/SDS", "", `${nf(sp.T0, 3)} ; ${nf(sp.Ts, 3)} s`],
    [L("Kategori desain seismik", "Seismic design category"), L("Tabel 8 & 9 (kategori risiko " + ss.risk + ")", "Tables 8 & 9 (risk category " + ss.risk + ")"), `SDS ${nf(sp.SDS, 3)}, SD1 ${nf(sp.SD1, 3)}`, ss.SDC],
    [L("Faktor keutamaan", "Importance factor"), L("Tabel 4", "Table 4"), `${L("kategori", "category")} ${ss.risk}`, nf(ss.Ie, 2)],
  ]
  const chart = (m) => { const Pp = palette(m); return lineChart(Pp, { title: `${L("Spektrum respons desain", "Design response spectrum")} · ${L("kelas", "class")} ${ss.cls}`, xLab: L("Perioda T (detik)", "Period T (s)"), yLab: "Sa (g)", xMin: 0, xMax: 4, yMin: 0,
    series: [{ c: Pp.acc, pts, fill: true, w: 3 }], vlines: [{ x: sp.T0, label: "T0" }, { x: sp.Ts, label: "Ts" }], hlines: [{ y: sp.SDS, label: `SDS = ${nf(sp.SDS, 3)}`, c: Pp.bad }], marks: [{ x: 1, y: sp.SD1, label: `SD1 = ${nf(sp.SD1, 3)}`, c: Pp.steel }] }) }
  return {
    file: "Parameter_Gempa", suite: L("PARAMETER GEMPA", "SEISMIC PARAMETERS"), title: L("Parameter Gempa SNI 1726:2019", "Seismic Parameters SNI 1726:2019"), sub: `Ss ${nf(ss.Ss, 3)} g · S1 ${nf(ss.S1, 3)} g · ${L("kelas situs", "site class")} ${ss.cls} · ${L("kategori risiko", "risk category")} ${ss.risk} · KDS ${ss.SDC}`, refs: "SNI 1726:2019 §5–§6 · ASCE 7-16 Ch. 11 & 20",
    metrics: [{ lab: "SDS", val: sp.SDS, d: 3, unit: "g" }, { lab: "SD1", val: sp.SD1, d: 3, unit: "g" }, { lab: L("Kelas situs", "Site class"), val: ss.cls }, { lab: L("KDS", "SDC"), val: ss.SDC }, { lab: "Ie", val: ss.Ie, d: 2 }],
    checks: [], kv: [{ title: L("Masukan", "Input"), rows: [["Ss", ss.Ss, "g", 3], ["S1", ss.S1, "g", 3], ["TL", ss.TL, "s", 1], [L("Kategori risiko", "Risk category"), ss.risk], [L("Kelas situs", "Site class"), `${ss.cls}${ss.auto ? " (" + L("otomatis dari tab Tanah", "auto from Soil tab") + ")" : ""}`]] }],
    tables: [{ title: L("Ordinat spektrum desain", "Design spectrum ordinates"), cols: ["T (s)", "Sa (g)", L("Cabang", "Branch")], rows: Ts.map((T) => [T, SaAt(T), T < sp.T0 ? "0,4 + 0,6T/T0" : T <= sp.Ts ? "SDS" : T <= ss.TL ? "SD1/T" : "SD1·TL/T²"]), dec: [3, 3, null], align: ["r", "r", "l"] }],
    notes: [L("Ev = 0,2·SDS·D (kombinasi LRFD) dan Cs struktur nongedung/peralatan dihitung di tiap modul Desain dari SDS/SD1 ini dengan R & Ie peralatan.", "Ev = 0.2·SDS·D (LRFD combinations) and nonbuilding/equipment Cs are computed in each Design module from these SDS/SD1 with the equipment R & Ie."),
      L("Ie di tab ini (dari kategori risiko) adalah acuan; modul peralatan memakai Ie masing-masing (mis. API 650 Annex E, IEEE 693).", "Ie here (from the risk category) is a reference; equipment modules use their own Ie (e.g. API 650 Annex E, IEEE 693).")],
    drawings: [{ make: chart, cap: L("Gambar 1 — Spektrum respons desain", "Figure 1 — Design response spectrum"), maxH: 300 }], steps: [{ h: L("Parameter respons desain", "Design response parameters"), rows: steps }], combos: [], cases: {},
  }
}
export { RISK_IE }
