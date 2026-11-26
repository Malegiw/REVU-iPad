// Tab "Data Tanah": input penyelidikan tanah (N-SPT atau CPT/sondir) per lapis, korelasi parameter desain (cu, φ, E, e0, Cc, OCR, cv) yang bisa
// ditimpa manual, grafik profil, kelas situs SNI 1726 (diteruskan ke tab Gempa), daya dukung pondasi dangkal (N-SPT / CPT / Vesic) dan
// kapasitas aksial tiang (α/β, N-SPT, CPT). Semua tersimpan di data proyek dan dipakai tab Desain & Penurunan.
import { L, lang, nf, toDisp, uName, uFac } from "./desain/core.js"
import { el, sv, field, exportBar, reveal, tableView, isConv, uLab } from "./desain/ui.js"
import { palette, root, T, R as Rect } from "./desain/draw.js"
import { lineChart } from "./desain/chart.js"
import { projLoad, projSave, soilDS, seisSite, stepper } from "./project.js"
import { TYPES, typeName, siteClass, shallowQa, pileAxial, QA_METHOD, AXIAL_METHOD, OVR, MAX_ROWS, resampleSoil, mergeRows, classifyCpt, parseSoilPaste, FILL0, fillOn, fillName, fillSettle, shallowSprings, SETTLE_OPT } from "./desain/soil.js"
import { singlePile, effPile, pileSprings } from "./desain/deep.js"
import { initUnits, hero, card, footer, nextBtn } from "./pj_ui.js"

const parseNum = (s) => { const v = parseFloat(String(s).trim().replace(",", ".")); return isFinite(v) ? v : NaN }
const fmtIn = (v) => (isFinite(v) ? String(+(+v).toPrecision(6)) : "")
let showAdv = false

export function mountTanah(box, ctx) {
  lang.cur = ctx.lang
  initUnits()
  const P = projLoad()
  box.textContent = ""
  const inBox = el("div"), resBox = el("div"), expBox = el("div", "dz-expbox dz-in")
  box.append(stepper("tanah", P), hero(L("Langkah 1 · data proyek", "Step 1 · project data"), L("Data Tanah", "Soil Data"),
    L("Masukkan hasil penyelidikan tanah per lapis (N-SPT bor atau CPT/sondir). Parameter desain dikorelasikan otomatis dan bisa ditimpa. Profil ini dipakai untuk daya dukung pondasi dangkal, kapasitas tiang, kelas situs gempa, dan penurunan.",
      "Enter the site investigation per layer (SPT borehole or CPT). Design parameters are correlated automatically and can be overridden. This profile drives shallow bearing capacity, pile capacity, seismic site class and settlement."),
    ["SNI 8460:2017", "SNI 1726:2019 Tabel 5", "N-SPT · CPT", "Meyerhof · Vesic · LCPC"]), inBox, resBox, expBox, nextBtn("#/gempa", L("Lanjut: parameter gempa", "Next: seismic parameters"), L("kelas situs dari data tanah ini", "site class from this soil data")), footer())
  let timer = 0, last = null
  const changed = (structural) => { projSave(P); if (structural) drawInputs(); clearTimeout(timer); timer = setTimeout(drawResults, structural ? 0 : 160) }
  function drawInputs() {
    inBox.textContent = ""
    const so = P.soil, g = el("div", "dz-grid")
    g.append(field({ k: "name", type: "txt", lab: L("Nama titik bor / sondir", "Borehole / CPT name"), obj: so }, so, () => changed(false)),
      field({ k: "test", type: "seg", lab: L("Jenis uji utama", "Primary test"), opts: { spt: "N-SPT", cpt: L("CPT / sondir", "CPT") }, obj: so }, so, changed),
      field({ k: "gwt", lab: L("Muka air tanah dari muka tanah", "Groundwater below grade"), u: "m", lo: 0, hi: 99, obj: so }, so, changed),
      field({ k: "Er", lab: L("Efisiensi hammer Er (N60 = N·Er/60)", "Hammer efficiency Er (N60 = N·Er/60)"), u: "%", lo: 30, hi: 100, obj: so, help: L("Donut ±45%, safety ±60%, otomatis ±80%.", "Donut ≈45%, safety ≈60%, automatic ≈80%.") }, so, changed),
      field({ k: "Nkt", lab: L("Faktor konus Nkt (cu = (qc − σv)/Nkt)", "Cone factor Nkt (cu = (qc − σv)/Nkt)"), u: "", lo: 8, hi: 30, obj: so }, so, changed),
      field({ k: "Gs", lab: L("Berat jenis butir Gs (untuk e0)", "Specific gravity Gs (for e0)"), u: "", lo: 2.4, hi: 2.9, obj: so }, so, changed))
    inBox.append(card("t-inv", "🔎", L("Penyelidikan tanah", "Site investigation"), so.test === "cpt" ? "CPT" : "N-SPT", g))
    inBox.append(card("t-lay", "🧱", L("Lapisan tanah / data per kedalaman (dari muka tanah ke bawah)", "Soil layers / data by depth (from grade down)"), `${so.layers.length} ${L("baris", "rows")} · ${nf(so.layers.reduce((a, l) => a + (+l.h || 0), 0), 1)} m`, layersTable(P, changed)))
    if (!so.fill) so.fill = { ...FILL0 }
    inBox.append(card("t-fill", "📉", L("Timbunan & penurunan muka air tanah (gesekan negatif)", "Fill & groundwater lowering (negative skin friction)"),
      fillOn(so.fill) ? [so.fill.H > 0 ? `${L("timbunan", "fill")} ${nf(so.fill.H, 1)} m` : "", so.fill.dGwt > 0 ? `ΔMAT ${nf(so.fill.dGwt, 1)} m` : ""].filter(Boolean).join(" · ") : L("tidak ada", "none"), fillInputs(so.fill, changed), fillOn(so.fill)))
  }
  function drawResults() {
    const ds = soilDS(P), sc = siteClass(ds), out = buildOut(P, ds, sc)
    last = out
    resBox.textContent = ""
    // parameter turunan
    resBox.append(card("t-der", "🧮", L("Parameter desain turunan (otomatis / ✎ manual)", "Derived design parameters (auto / ✎ manual)"), null, [tableView(out.tables[1]), el("p", "dz-note", L("Korelasi: N60 = N·Er/60; N1(60) = N60·√(100/σ'v); lempung cu = 6·N60 (Stroud) atau (qc − σv)/Nkt, Eu = 300cu, e0 dari γsat & Gs, Cc = 0,30(e0 − 0,27) (Hough), OCR dari cu/σ'v = 0,22·OCR^0,8 (SHANSEP), Cα/Cc = 0,04 (NC); pasir φ = 27,1 + 0,3N1 − 0,00054N1² (Peck–Hanson–Thornburn) atau 17,6 + 11·log(qc1N) (Kulhawy–Mayne), E = 500(N60 + 15) kPa atau 2,5qc.", "Correlations: N60 = N·Er/60; N1(60) = N60·√(100/σ'v); clay cu = 6·N60 (Stroud) or (qc − σv)/Nkt, Eu = 300cu, e0 from γsat & Gs, Cc = 0.30(e0 − 0.27) (Hough), OCR from cu/σ'v = 0.22·OCR^0.8 (SHANSEP), Cα/Cc = 0.04 (NC); sand φ = 27.1 + 0.3N1 − 0.00054N1² (Peck–Hanson–Thornburn) or 17.6 + 11·log(qc1N) (Kulhawy–Mayne), E = 500(N60 + 15) kPa or 2.5qc."))]))
    // grafik profil
    const fig = el("figure", "dz-fig pj-fig"); fig.append(profileChart(ds, palette("screen")))
    resBox.append(card("t-prof", "📈", L("Profil tanah", "Soil profile"), `${nf(ds.depth, 1)} m`, fig))
    // kelas situs
    const sk = el("div", "pj-site")
    sk.append(el("div", "pj-site-cls", sc.cls), (() => { const d = el("div"); d.append(el("b", null, L(`Kelas situs ${sc.cls} — ${sc.cls === "SE" ? "tanah lunak" : sc.cls === "SD" ? "tanah sedang" : "tanah keras/sangat padat"}`, `Site class ${sc.cls} — ${sc.cls === "SE" ? "soft soil" : sc.cls === "SD" ? "stiff soil" : "very dense soil"}`)), el("span", null, sc.why), el("small", null, L("N̄ = Σdi / Σ(di/Ni) pada 30 m teratas (SNI 1726:2019 §5.4.2). Bila bor < 30 m, lapis terakhir diperpanjang. Dipakai tab Gempa bila mode otomatis.", "N̄ = Σdi / Σ(di/Ni) over the top 30 m (SNI 1726:2019 §5.4.2). If the boring is < 30 m the last layer is extended. Used by the Seismic tab in auto mode."))); return d })())
    resBox.append(card("t-site", "🌐", L("Kelas situs (SNI 1726:2019 Tabel 5)", "Site class (SNI 1726:2019 Table 5)"), sc.cls, sk))
    // daya dukung dangkal
    const bg = el("div", "dz-grid")
    bg.append(field({ k: "method", type: "seg", lab: L("Metode daya dukung (dipakai modul Desain)", "Bearing method (used by Design modules)"), opts: QA_METHOD(), obj: P.bear, wide: true }, P.bear, changed),
      field({ k: "FS", lab: L("Faktor aman FS (geser)", "Safety factor FS (shear)"), u: "", lo: 2, hi: 4, obj: P.bear }, P.bear, changed),
      field({ k: "Df", lab: L("Pratinjau: kedalaman Df", "Preview: depth Df"), u: "m", lo: 0, hi: 6, obj: P.bear }, P.bear, changed),
      field({ k: "B", lab: L("Pratinjau: lebar B (bujur sangkar)", "Preview: width B (square)"), u: "m", lo: 0.5, hi: 20, obj: P.bear }, P.bear, changed))
    const qf = el("figure", "dz-fig pj-fig"); qf.append(out.drawings[1].make("screen"))
    resBox.append(card("t-qa", "🏗️", L("Daya dukung pondasi dangkal", "Shallow foundation bearing capacity"), `qa ${nf(toDisp("Q", out.qa0.qa), 0)} ${uName("Q")}`, [bg, tableView(out.tables[2]), qf, stepsTable(out.steps[0])]))
    // tiang rencana: acuan kapasitas tiang tunggal untuk semua modul Desain (pondasi dalam)
    const pg = el("div", "dz-grid"), pl = P.pile
    pg.append(field({ k: "kind", type: "seg", lab: L("Jenis tiang", "Pile type"), opts: { pipe: L("Pipa baja (pancang)", "Steel pipe (driven)"), bored: L("Bor beton", "Bored concrete") }, obj: pl, wide: true }, pl, changed),
      field({ k: "method", type: "seg", lab: L("Metode kapasitas aksial", "Axial capacity method"), opts: { api: "α/β", spt: "N-SPT", cpt: "CPT" }, obj: pl }, pl, changed),
      field({ k: "D", lab: L("Diameter D", "Diameter D"), u: "mm", lo: 150, hi: 2000, obj: pl }, pl, changed),
      ...(pl.kind === "pipe" ? [field({ k: "t", lab: L("Tebal t", "Wall t"), u: "mm", lo: 4, hi: 50, obj: pl }, pl, changed), field({ k: "Fy", lab: "Fy", u: "MPa", lo: 200, hi: 600, obj: pl }, pl, changed),
        field({ k: "open", type: "seg", lab: L("Ujung", "Tip"), opts: { true: L("Terbuka", "Open"), false: L("Tertutup", "Closed") }, obj: pl, on: (st, v) => { st.open = v === "true" } }, pl, changed)]
        : [field({ k: "fc", lab: "fc'", u: "MPa", lo: 20, hi: 50, obj: pl }, pl, changed), field({ k: "n", lab: L("Jumlah tulangan", "Number of bars"), u: "", lo: 6, hi: 40, obj: pl }, pl, changed),
          field({ k: "db", type: "sel", lab: L("Diameter tulangan", "Bar size"), opts: { 16: "D16", 19: "D19", 22: "D22", 25: "D25", 29: "D29" }, obj: pl }, pl, changed)]),
      field({ k: "L", lab: L("Panjang tiang rencana L (di bawah cap)", "Design pile length L (below cap)"), u: "m", lo: 3, hi: 80, obj: pl }, pl, changed),
      field({ k: "z0", lab: L("Kepala tiang z0 (dasar cap)", "Pile head z0 (cap base)"), u: "m", lo: 0, hi: 10, obj: pl }, pl, changed),
      field({ k: "fsC", lab: L("FS tekan", "FS compression"), u: "", lo: 1.5, hi: 4, obj: pl }, pl, changed), field({ k: "fsT", lab: L("FS tarik", "FS tension"), u: "", lo: 1.5, hi: 5, obj: pl }, pl, changed),
      field({ k: "fsL", lab: L("FS lateral", "FS lateral"), u: "", lo: 1.5, hi: 4, obj: pl }, pl, changed), field({ k: "yAllow", lab: L("Defleksi izin kepala", "Allowable head deflection"), u: "mm", lo: 3, hi: 100, obj: pl }, pl, changed),
      field({ k: "Lmax", lab: L("Panjang maks tabel", "Max table length"), u: "m", lo: 6, hi: 80, obj: pl }, pl, changed))
    const sp = out.pile, k = el("div", "pj-kpis")
    ;[[L("Qu tekan", "Qu comp."), sp.ax.Qc], [`Qa ${L("geoteknik", "geotech.")}`, sp.Qac], [`Pa ${L("struktur", "structural")}`, sp.Pstr], [L("Qa DESAIN tekan", "DESIGN Qa comp."), sp.Qad, true], [L("Qa tarik", "Qa tension"), sp.Qat], [L("Ha lateral", "Ha lateral"), sp.Ha]]
      .forEach(([lab, v, hi], i2) => { const c = el("div", "pj-kpi dz-in" + (hi ? " hi" : "")); c.style.setProperty("--i", i2); c.append(el("span", null, lab), el("b", null, `${nf(toDisp("F", v), lab.includes("Ha") ? 1 : 0)} ${uName("F")}`)); k.append(c) })
    const pf = el("figure", "dz-fig pj-fig"); pf.append(out.drawings[2].make("screen"))
    resBox.append(card("t-pile", "📍", L("Tiang rencana — kapasitas tiang tunggal (acuan desain)", "Design pile — single pile capacity (design reference)"), `Qa ${nf(toDisp("F", sp.Qad), 0)} ${uName("F")}`, [
      el("p", "dz-note", L("Alur pondasi dalam: kapasitas tiang tunggal di sini → modul Desain menghitung beban, jumlah tiang n ≥ P/(Qa·Eg), ukuran & tebal pile cap, lalu tulangan. Semua modul dengan pondasi dalam memakai tiang rencana ini (kecuali diatur sendiri di modul).", "Deep foundation flow: single pile capacity here → Design modules compute loads, number of piles n ≥ P/(Qa·Eg), pile cap size & depth, then reinforcement. Every module with deep foundations uses this design pile (unless overridden in the module).")),
      pg, k, stepsTable(out.steps[1]), tableView(out.tables[3]), pf,
      el("p", "dz-note", L("Qa desain = min(Qu/FS; Pa struktur). Ha = min(Hu Broms kepala jepit/FS; H pada defleksi izin). Efisiensi kelompok Eg dan p-multiplier diterapkan di modul sesuai susunan tiang.", "Design Qa = min(Qu/FS; structural Pa). Ha = min(fixed-head Broms Hu/FS; H at allowable deflection). Group efficiency Eg and p-multipliers are applied in the modules for the actual layout."))]))
    // gesekan negatif & bidang netral
    if (out.nsf) {
      const N = out.nsf, k2 = el("div", "pj-kpis")
      N.kpis.forEach(([lab, v, hi], i2) => { const c = el("div", "pj-kpi dz-in" + (hi ? " hi" : "")); c.style.setProperty("--i", i2); c.append(el("span", null, lab), el("b", null, v)); k2.append(c) })
      const nf2 = el("figure", "dz-fig pj-fig"); nf2.append(N.chart("screen"))
      resBox.append(card("t-nsf", "📉", L("Timbunan: penurunan tanah, gesekan negatif & bidang netral", "Fill: ground settlement, negative skin friction & neutral plane"), N.badge, [
        el("p", "dz-note", N.lead), k2, ...(N.warn ? [el("p", "dz-note pj-warn", N.warn)] : []), nf2, tableView(N.tStrata), ...(N.tNsf ? [tableView(N.tNsf)] : []), ...(N.steps ? [stepsTable(N.steps)] : []),
        el("p", "dz-note", N.note)]))
    }
    // koefisien pegas
    const S2 = out.spr, sg = el("div", "dz-grid")
    if (typeof pl.sdz !== "string") pl.sdz = (+pl.sdz || 1).toFixed(1)
    sg.append(field({ k: "sdz", type: "seg", lab: L("Jarak titik pegas lateral tiang Δz", "Pile lateral spring spacing Δz"), opts: { "0.5": "0,5 m", "1.0": "1 m", "2.0": "2 m" }, obj: pl, on: (st, v) => { st.sdz = v } }, pl, changed))
    resBox.append(card("t-spr", "🔩", L("Koefisien pegas tanah & tiang (untuk model struktur)", "Soil & pile spring coefficients (for structural models)"), `ks ${nf(toDisp("G", S2.pv.kI ?? S2.pv.bow), 0)} ${uLab("G")}`, [
      el("p", "dz-note", S2.lead), tableView(S2.tKs), tableView(S2.tFoot), stepsTable(S2.stepsS), sg, tableView(S2.tPile), tableView(S2.tNodes), el("p", "dz-note", S2.note)]))
    exportBar(expBox, () => last, { project: P.info })
    reveal(box)
  }
  drawInputs(); drawResults()
}

// ---------------------------------------------------------------- input timbunan / penurunan MAT
function fillInputs(f, changed) {
  const g = el("div", "dz-grid")
  g.append(field({ k: "on", type: "seg", lab: L("Ada timbunan baru atau penurunan MAT?", "New fill or groundwater lowering?"), opts: { false: L("Tidak", "No"), true: L("Ya", "Yes") }, obj: f, wide: true, on: (st, v) => { f.on = v === "true" } }, f, changed))
  if (!f.on) return [g, el("p", "dz-note", L("Aktifkan bila lokasi akan ditimbun (urugan / peninggian elevasi) di atas tanah lunak, atau MAT akan turun. Timbunan memicu konsolidasi tanah asli → tanah turun lebih besar daripada tiang → gesekan negatif (downdrag) di atas bidang netral, dan menambah penurunan pondasi dangkal.", "Enable when the site will be filled (raised grade) over soft soil, or the groundwater table will drop. Fill consolidates the original soil → the soil settles more than the piles → negative skin friction (downdrag) above the neutral plane, and extra settlement of shallow foundations."))]
  g.append(
    field({ k: "H", lab: L("Tebal timbunan H (di atas muka tanah asli)", "Fill thickness H (above original grade)"), u: "m", lo: 0, hi: 20, obj: f, struct: true }, f, changed),
    field({ k: "g", lab: L("Berat isi timbunan γf", "Fill unit weight γf"), u: "G", lo: 12, hi: 23, obj: f }, f, changed),
    field({ k: "type", type: "seg", lab: L("Material timbunan", "Fill material"), opts: { sand: L("Granular (sirtu/pasir)", "Granular (sand/gravel)"), clay: L("Kohesif (urugan tanah)", "Cohesive (earth fill)") }, obj: f }, f, changed),
    field({ k: "N", lab: L("N-SPT ekuivalen timbunan dipadatkan", "Equivalent SPT N of compacted fill"), u: "", lo: 1, hi: 60, obj: f }, f, changed),
    field({ k: "tPre", lab: L("Jeda penimbunan → konstruksi tiang/pondasi", "Time from filling to pile/footing construction"), u: L("tahun", "years"), lo: 0, hi: 50, obj: f,
      help: L("0 = dibangun segera sesudah penimbunan. Masa tunggu / preloading mengurangi sisa penurunan yang menimbulkan gesekan negatif.", "0 = built right after filling. A waiting period / preloading reduces the remaining settlement that causes downdrag.") }, f, changed),
    field({ k: "dGwt", lab: L("Penurunan MAT di masa layan Δh", "Groundwater lowering during service Δh"), u: "m", lo: 0, hi: 30, obj: f, help: L("Dewatering / pengambilan air tanah. 0 = tidak ada.", "Dewatering / groundwater extraction. 0 = none.") }, f, changed),
    field({ k: "meth", type: "seg", lab: L("Metode desain gesekan negatif", "Negative skin friction design method"), opts: { unified: L("Terpadu Fellenius (bidang netral) — disarankan", "Fellenius unified (neutral plane) — recommended"), conv: L("Konvensional (Qn sebagai beban)", "Conventional (Qn as a load)") }, obj: f, wide: true }, f, changed),
    field({ k: "bC", lab: L("β gesek negatif lempung/lanau", "β negative friction, clay/silt"), u: "", lo: 0.05, hi: 1.5, obj: f, help: L("Fellenius: 0,15–0,35 (lempung lunak ±0,25)", "Fellenius: 0.15–0.35 (soft clay ≈0.25)") }, f, changed),
    field({ k: "bS", lab: L("β gesek negatif pasir/kerikil & timbunan granular", "β negative friction, sand/gravel & granular fill"), u: "", lo: 0.05, hi: 2, obj: f, help: L("Fellenius: 0,25–0,50", "Fellenius: 0.25–0.50") }, f, changed),
    field({ k: "qd", lab: L("Beban tetap pada tiang Qd / Qa", "Sustained pile load Qd / Qa"), u: "", lo: 0.2, hi: 1, obj: f, help: L("Beban mati + hidup tetap (tanpa angin/gempa). Menentukan letak bidang netral.", "Dead + sustained live (no wind/seismic). Sets the neutral plane.") }, f, changed))
  return [g, el("p", "dz-note", L("Data penyelidikan di atas tetap diisi dari muka tanah ASLI. Dengan timbunan, semua hasil memakai puncak timbunan (muka tanah rencana) sebagai z = 0: lapis asli bergeser + H, MAT = MAT asli + H, dan kepala tiang z0 serta Df pondasi dangkal diukur dari muka timbunan. Panjang tiang L tetap di bawah cap — periksa ujung tiang masih di lapis pendukung.", "The investigation data above are still entered from ORIGINAL grade. With fill, all results use the top of fill (finished grade) as z = 0: original layers shift + H, groundwater = original + H, and the pile head z0 and shallow Df are measured from the top of fill. Pile length L stays below the cap — check the tip still reaches the bearing layer."))]
}

// ---------------------------------------------------------------- grafik penurunan tanah & gaya aksial terhadap kedalaman (bidang netral)
function nsfChart(r, fsl, ds, P, uF, Pa) {
  const W = 760, H = 500, s = root(W, H, P, L("Gesekan negatif dan bidang netral", "Negative skin friction and neutral plane"))
  const zMax = Math.max(r.zt + 1, (ds.fill ? ds.fill.H : 0) + 3), top = 64, bot = H - 36, Y = (z) => top + z / zMax * (bot - top)
  T(s, 16, 26, `${L("Bidang netral", "Neutral plane")} NP = ${nf(r.zn, 2)} m · Qn = ${nf(toDisp("F", r.Qn), 0)} ${uF} · ${L("downdrag kepala", "head downdrag")} ${nf(r.sHead * 1000, 1)} mm`, { c: P.ink, fs: 14, b: true })
  const x0a = 70, wa = 270, x0b = 420, wb = 320
  const axis = (x0, w, max, title, d) => {
    s.append(sv("rect", { x: x0, y: top, width: w, height: bot - top, fill: "none", stroke: P.line }))
    T(s, x0 + w / 2, top - 10, title, { c: P.ink, fs: 12, a: "middle", b: true })
    for (let k = 0; k <= 4; k++) { const xv = x0 + w * k / 4; s.append(sv("line", { x1: xv, x2: xv, y1: top, y2: bot, stroke: P.grid })); T(s, xv, bot + 14, nf(max * k / 4, d), { c: P.mut, fs: 10, a: k === 0 ? "start" : k === 4 ? "end" : "middle" }) }
  }
  for (let z = 0; z <= zMax + 1e-9; z += zMax > 30 ? 10 : 5) { T(s, x0a - 8, Y(z) + 4, nf(z, 0), { c: P.mut, fs: 10.5, a: "end" }); s.append(sv("line", { x1: x0a, x2: x0a + wa, y1: Y(z), y2: Y(z), stroke: P.grid })); s.append(sv("line", { x1: x0b, x2: x0b + wb, y1: Y(z), y2: Y(z), stroke: P.grid })) }
  T(s, 18, (top + bot) / 2, "z (m)", { c: P.ink, fs: 11 })
  // penurunan (mm)
  const sMax = Math.max(fsl.remAt(0), r.sHead, 0.001) * 1000 * 1.1
  axis(x0a, wa, sMax, L("Penurunan sesudah konstruksi (mm)", "Settlement after construction (mm)"), sMax >= 20 ? 0 : 1)
  const XA = (v) => x0a + Math.min(v * 1000, sMax) / sMax * wa
  let dS = ""
  for (let k = 0; k <= 80; k++) { const z = zMax * k / 80; dS += `${k ? "L" : "M"}${XA(fsl.remAt(z)).toFixed(1)},${Y(z).toFixed(1)} ` }
  s.append(sv("path", { d: dS, fill: "none", stroke: P.clay === "#C9A586" ? "#8A5A2B" : P.acc, "stroke-width": 2.6, class: "dz-draw", pathLength: 1 }))
  s.append(sv("path", { d: r.prof.map((p, i) => `${i ? "L" : "M"}${XA(p.sp).toFixed(1)},${Y(p.z).toFixed(1)}`).join(" "), fill: "none", stroke: P.steel, "stroke-width": 2.6, "stroke-dasharray": "7 4" }))
  // gaya aksial
  const qMax = Math.max(r.Qmax, r.prof[0].Qup, Pa || 0, 1) * 1.08
  axis(x0b, wb, toDisp("F", qMax), `${L("Gaya aksial tiang", "Pile axial force")} (${uF})`, 0)
  const XB = (v) => x0b + Math.min(Math.max(v, 0), qMax) / qMax * wb
  const line = (pts, c, w, dash) => s.append(sv("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${XB(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), fill: "none", stroke: c, "stroke-width": w, ...(dash ? { "stroke-dasharray": dash } : {}) }))
  line(r.prof.map((p) => [p.Qdn, p.z]), P.bad, 1.6, "6 4"); line(r.prof.map((p) => [p.Qup, p.z]), P.ok, 1.6, "6 4"); line(r.prof.map((p) => [p.Q, p.z]), P.ink, 3)
  if (Pa) { s.append(sv("line", { x1: XB(Pa), x2: XB(Pa), y1: top, y2: bot, stroke: P.bad, "stroke-width": 1.4, "stroke-dasharray": "2 3" })); T(s, XB(Pa) - 4, bot - 6, "Pa", { c: P.bad, fs: 11, a: "end", b: true }) }
  // muka tanah asli, kepala, NP, ujung
  if (ds.fill && ds.fill.H > 0) { s.append(sv("line", { x1: x0a, x2: x0b + wb, y1: Y(ds.fill.H), y2: Y(ds.fill.H), stroke: P.mut, "stroke-width": 1, "stroke-dasharray": "3 3" })); T(s, x0a + wa + 6, Y(ds.fill.H) + 4, L("tanah asli", "orig. grade"), { c: P.mut, fs: 10 }) }
  s.append(sv("line", { x1: x0a, x2: x0b + wb, y1: Y(r.zn), y2: Y(r.zn), stroke: P.acc, "stroke-width": 2 }))
  T(s, x0b + 6, Y(r.zn) - 6, `NP ${nf(r.zn, 2)} m · Qmax ${nf(toDisp("F", r.Qmax), 0)}`, { c: P.acc, fs: 11.5, b: true })
  T(s, x0a + wa + 6, Y(r.zt) + 4, L("ujung", "toe"), { c: P.mut, fs: 10 })
  s.append(sv("line", { x1: x0a, x2: x0b + wb, y1: Y(r.zt), y2: Y(r.zt), stroke: P.line, "stroke-width": 1 }))
  // legenda
  const lg = [[P.clay === "#C9A586" ? "#8A5A2B" : P.acc, L("tanah", "soil"), ""], [P.steel, L("tiang", "pile"), "7 4"], [P.bad, "Qd + Qn", "6 4"], [P.ok, "Rt + Rs", "6 4"], [P.ink, "Q(z)", ""]]
  lg.forEach(([c, t, d], i) => { const x = 70 + i * 132; s.append(sv("line", { x1: x, x2: x + 26, y1: H - 10, y2: H - 10, stroke: c, "stroke-width": 2.6, ...(d ? { "stroke-dasharray": d } : {}) })); T(s, x + 32, H - 6, t, { c: P.ink, fs: 11 }) })
  return s
}

function stepsTable(st) {
  const t = { title: st.h, cols: [L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")], rows: st.rows, align: ["l", "l", "l", "r"] }
  const w = tableView(t); w.classList.add("dz-steptbl"); return w
}

// ---------------------------------------------------------------- editor lapisan / baris per interval
const hasV = (v) => v != null && v !== "" && isFinite(v)
let tool = "", undo = null
const intSt = { dz: 0.5, zmax: 30, blank: false }, pasteSt = { qcUnit: "mpa", fsUnit: "kpa", text: "" }
function layersTable(P, changed) {
  const box = el("div")
  const draw = () => {
    box.textContent = ""
    const so = P.soil, cpt = so.test === "cpt", n = so.layers.length
    const depth = so.layers.reduce((s2, l) => s2 + (+l.h || 0), 0)
    // ---- bilah alat
    const bar = el("div", "pj-row pj-soilbar")
    const btn = (txt, cls, on, dis) => { const x = el("button", cls || "dz-add ghost", txt); x.type = "button"; x.disabled = !!dis; x.onclick = on; return x }
    const apply = (soil, msg) => { undo = { layers: so.layers.map((l) => ({ ...l })), msg }; so.layers = soil.layers; tool = ""; changed(true) }
    bar.append(btn(L("＋ Tambah baris", "＋ Add row"), "dz-add", () => { const last = so.layers[so.layers.length - 1]; so.layers.push({ ...last }); changed(true) }, n >= MAX_ROWS),
      btn(L("⇅ Bagi per interval…", "⇅ Split by interval…"), "dz-add ghost" + (tool === "int" ? " on" : ""), () => { tool = tool === "int" ? "" : "int"; draw() }),
      btn(L("📋 Tempel dari Excel…", "📋 Paste from Excel…"), "dz-add ghost" + (tool === "paste" ? " on" : ""), () => { tool = tool === "paste" ? "" : "paste"; draw() }),
      btn(L("⊟ Gabung baris yang sama", "⊟ Merge identical rows"), "dz-add ghost", () => { const m = mergeRows(so); if (m.layers.length < n) apply(m, L(`${n} → ${m.layers.length} baris`, `${n} → ${m.layers.length} rows`)) }, n < 2),
      ...(cpt ? [btn(L("◎ Jenis dari CPT (Ic)", "◎ Type from CPT (Ic)"), "dz-add ghost", () => { const r = classifyCpt(so); if (r.n) apply(r.soil, L(`jenis ${r.n} baris diubah dari Ic`, `${r.n} row types set from Ic`)); else { info.textContent = L("Tidak ada jenis yang berubah (perlu qc dan fs).", "No type changed (needs qc and fs).") } })] : []),
      btn(showAdv ? L("Sembunyikan parameter lanjutan", "Hide advanced parameters") : L("Parameter lanjutan ▸", "Advanced parameters ▸"), "dz-add ghost", () => { showAdv = !showAdv; draw() }))
    if (undo) bar.append(btn(L(`↶ Urungkan (${undo.msg})`, `↶ Undo (${undo.msg})`), "dz-add ghost warn", () => { so.layers = undo.layers; undo = null; changed(true) }))
    const info = el("span", "hint pj-soilinfo", L(`${n} baris · kedalaman ${nf(depth, 2)} m · maks. ${MAX_ROWS} baris`, `${n} rows · depth ${nf(depth, 2)} m · max. ${MAX_ROWS} rows`))
    bar.append(info)
    box.append(bar)
    if (tool === "int") box.append(intervalPanel(so, apply))
    if (tool === "paste") box.append(pastePanel(so, apply))
    // ---- tabel
    const tw = el("div", "dz-tbl-wrap pj-soilwrap"), tb = el("table", "dz-edit pj-edit")
    const cols = ["#", L("Kedalaman (m)", "Depth (m)"), L("Tebal (m)", "Thick. (m)"), L("Jenis", "Type"), `γ (${uName("G")})`, `γsat (${uName("G")})`, cpt ? "qc (MPa)" : "N-SPT", cpt ? "fs (kPa)" : L("qc (MPa, opsional)", "qc (MPa, optional)")]
    const adv = [["cu", `cu (${uName("Q")})`, "Q", 0, 2000], ["phi", "φ (°)", "", 0, 50], ["E", "E (MPa)", "", 0, 5000], ["nu", "ν", "", 0, 0.5], ["e0", "e0", "", 0, 5], ["Cc", "Cc", "", 0, 3], ["Cs", "Cs", "", 0, 1], ["OCR", "OCR", "", 0, 20], ["cv", "cv (m²/th)", "", 0, 500], ["Ca", "Cα/(1+e0)", "", 0, 0.2]]
    const th = el("thead"), hd = el("tr"); cols.forEach((c) => hd.append(el("th", null, c))); if (showAdv) adv.forEach((x) => hd.append(el("th", "adv", x[1]))); hd.append(el("th")); th.append(hd); tb.append(th)
    const tbody = el("tbody")
    let z = 0
    so.layers.forEach((ly, i) => {
      const tr = el("tr")
      tr.append(el("td", "dz-zn", String(i + 1)), el("td", "dz-zz", `${nf(z, 2)}–${nf(z + (+ly.h || 0), 2)}`)); z += +ly.h || 0
      // kind: "" | Q | G; opt: "null" = kosong disimpan null (diinterpolasi / ikut atas), "auto" = kosong → 0 (korelasi otomatis)
      const num = (k, kind, lo, hi, opt, cls, ph) => {
        const td = el("td", cls || ""), inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"
        const fac = isConv(kind) ? uFac(kind) : 1, v = ly[k]
        inp.value = opt === "auto" ? (v > 0 ? fmtIn(v / fac) : "") : hasV(v) && (k === "N" || v > 0 || k === "h") ? fmtIn(v / fac) : ""
        if (ph) inp.placeholder = ph
        inp.oninput = () => {
          const t = inp.value.trim()
          if (t === "" && opt) { inp.classList.remove("bad"); ly[k] = opt === "auto" ? 0 : null; changed(false); return }
          const x = parseNum(t), ok = !isNaN(x) && x >= lo / fac && x <= hi / fac
          inp.classList.toggle("bad", !ok); if (ok) { ly[k] = x * fac; changed(false) }
        }
        inp.onchange = () => { if (k === "h") draw() }
        td.append(inp); return td
      }
      tr.append(num("h", "", 0.05, 80))
      const tdT = el("td"), sel = el("select")
      Object.keys(TYPES).forEach((k) => { const o = el("option", null, typeName(k)); o.value = k; if (ly.type === k) o.selected = true; sel.append(o) })
      sel.onchange = () => { ly.type = sel.value; changed(false) }
      tdT.append(sel); tr.append(tdT)
      const up = L("= atas", "= above")
      tr.append(num("g", "G", 10, 24, "null", "", up), num("gsat", "G", 10, 25, "null", "", up))
      if (cpt) tr.append(num("qc", "", 0.01, 100, "null", "", "≈"), num("fs", "", 0, 2000, "null", "", "≈"))
      else tr.append(num("N", "", 0, 200, "null", "", "≈"), num("qc", "", 0.01, 100, "null"))
      if (showAdv) adv.forEach(([k, , kind, lo, hi]) => tr.append(num(k, kind, lo, hi, "auto", "adv", L("auto", "auto"))))
      const del = el("button", "dz-x", "✕"); del.type = "button"; del.title = L("Hapus baris", "Remove row"); del.disabled = so.layers.length <= 1
      del.onclick = () => { so.layers.splice(i, 1); changed(true) }
      const td = el("td"); td.append(del); tr.append(td)
      tbody.append(tr)
    })
    tb.append(tbody); tw.append(tb); box.append(tw)
    box.append(el("p", "dz-note", L("Isi per lapis atau per interval (mis. tiap 0,5 m sampai 30 m). Sel N-SPT / qc / fs yang kosong (≈) diinterpolasi dari baris berdata terdekat dalam lapis sejenis; γ kosong (= atas) sama dengan baris di atasnya bila jenisnya sama, selain itu nilai tipikal. Kolom lanjutan kosong = korelasi otomatis. Bila uji CPT, N60 setara dihitung dari qc/N (Robertson) untuk kelas situs.",
      "Enter per layer or per interval (e.g. every 0.5 m down to 30 m). Empty SPT N / qc / fs cells (≈) are interpolated from the nearest rows with data within the same soil type; empty γ (= above) takes the row above when the type matches, otherwise a typical value. Empty advanced columns = automatic correlation. With CPT, an equivalent N60 is derived from qc/N (Robertson) for site class.")))
  }
  // ---- panel: bagi per interval
  function intervalPanel(so, apply) {
    const st = intSt
    if (!st.touched) st.zmax = Math.max(30, Math.ceil(so.layers.reduce((s2, l) => s2 + (+l.h || 0), 0)))
    const w = el("div", "pj-tool dz-in on"), g = el("div", "dz-grid")
    g.append(field({ k: "dz", type: "seg", lab: L("Interval Δz", "Interval Δz"), opts: { 0.2: "0,2 m", 0.25: "0,25 m", 0.5: "0,5 m", 1: "1 m", 1.5: "1,5 m", 2: "2 m" }, obj: st }, st, () => draw()),
      field({ k: "zmax", lab: L("Sampai kedalaman", "Down to depth"), u: "m", lo: 1, hi: 150, obj: st }, st, () => { st.touched = true }),
      field({ k: "blank", type: "chk", lab: L("Kosongkan N/qc/fs (isi sendiri per baris; yang kosong diinterpolasi)", "Clear N/qc/fs (fill per row; empty cells are interpolated)"), obj: st }, st, () => {}))
    const go = el("button", "pj-apply", L("Terapkan", "Apply")); go.type = "button"
    const msg = el("p", "dz-note")
    go.onclick = () => {
      try { const r = resampleSoil(so, st.dz, st.zmax, st.blank); apply(r, L(`${so.layers.length} → ${r.layers.length} baris`, `${so.layers.length} → ${r.layers.length} rows`)) }
      catch (e) { msg.textContent = e.message; msg.classList.add("bad") }
    }
    msg.textContent = L("Jenis, γ, dan parameter diambil dari lapis saat ini pada kedalaman tiap baris (di bawah dasar bor: lapis terakhir).", "Type, γ and parameters are taken from the current layer at each row depth (below the boring: last layer).")
    w.append(g, go, msg)
    return w
  }
  // ---- panel: tempel dari Excel / CSV
  function pastePanel(so, apply) {
    const cpt = so.test === "cpt", st = pasteSt
    const w = el("div", "pj-tool dz-in on"), ta = el("textarea", "pj-paste")
    ta.rows = 7; ta.spellcheck = false; ta.value = st.text
    ta.placeholder = cpt ? L("Kedalaman ⇥ qc ⇥ fs ⇥ jenis\n0,2 ⇥ 8,5 ⇥ 25\n0,4 ⇥ 9,1 ⇥ 31 ⇥ pasir", "Depth ⇥ qc ⇥ fs ⇥ type\n0.2 ⇥ 8.5 ⇥ 25\n0.4 ⇥ 9.1 ⇥ 31 ⇥ sand") : L("Kedalaman ⇥ N-SPT ⇥ jenis\n0,5 ⇥ 4 ⇥ lempung\n1,0 ⇥ ⇥ lempung\n1,5 ⇥ 6", "Depth ⇥ SPT N ⇥ type\n0.5 ⇥ 4 ⇥ clay\n1.0 ⇥ ⇥ clay\n1.5 ⇥ 6")
    const g = el("div", "dz-grid")
    if (cpt) g.append(field({ k: "qcUnit", type: "seg", lab: L("Satuan qc", "qc unit"), opts: { mpa: "MPa", kgcm2: "kg/cm²" }, obj: st }, st, () => draw()), field({ k: "fsUnit", type: "seg", lab: L("Satuan fs", "fs unit"), opts: { kpa: "kPa", kgcm2: "kg/cm²" }, obj: st }, st, () => draw()))
    const msg = el("div", "pj-pastemsg"), go = el("button", "pj-apply", L("Ganti data tanah dengan tabel ini", "Replace soil data with this table")); go.type = "button"; go.disabled = true
    let res = null
    const prev = () => {
      st.text = ta.value
      msg.textContent = ""; res = null; go.disabled = true
      if (!ta.value.trim()) return
      try {
        res = parseSoilPaste(ta.value, { test: so.test, base: so, qcUnit: st.qcUnit, fsUnit: st.fsUnit })
        const zz = res.layers.reduce((s2, l) => s2 + l.h, 0)
        msg.append(el("b", null, L(`${res.n} baris terbaca · kedalaman 0–${nf(zz, 2)} m`, `${res.n} rows read · depth 0–${nf(zz, 2)} m`)), el("span", "hint", res.mapped ? L(" · kolom dari baris judul", " · columns from header row") : L(" · tanpa judul: kolom urut kedalaman, nilai uji, …", " · no header: columns in order depth, test value, …")))
        res.warn.slice(0, 4).forEach((x) => msg.append(el("small", null, x)))
        go.disabled = false
      } catch (e) { msg.append(el("span", "bad", e.message)) }
    }
    ta.oninput = () => { clearTimeout(ta._t); ta._t = setTimeout(prev, 200) }
    go.onclick = () => { if (res) { st.text = ""; apply({ layers: res.layers }, L(`tempel ${res.n} baris`, `paste ${res.n} rows`)) } }
    w.append(ta, g, msg, go, el("p", "dz-note", L("Salin kolom dari Excel / log bor lalu tempel. Kolom dikenali dari judul (kedalaman, jenis, γ, γsat, N-SPT, qc, fs); tanpa judul urutannya kedalaman, nilai uji, nilai kedua, jenis. Kedalaman = dasar baris (baris = dari kedalaman sebelumnya sampai kedalaman ini). Jenis dan γ yang tidak ada diambil dari profil saat ini.",
      "Copy columns from Excel / a boring log and paste. Columns are recognised from the header (depth, type, γ, γsat, SPT N, qc, fs); without a header the order is depth, test value, second value, type. Depth = row bottom (row = from the previous depth to this depth). Missing type and γ come from the current profile.")))
    if (st.text) setTimeout(prev, 0)
    return w
  }
  draw()
  return box
}

// ---------------------------------------------------------------- gambar profil (kolom tanah + N60 + qc + cu/φ)
export function profileChart(ds, P) {
  const W = 760, H = 520, s = root(W, H, P, L("Profil tanah", "Soil profile"))
  const top = 54, bot = H - 30, depth = Math.ceil(ds.depth / 5) * 5, Y = (z) => top + z / depth * (bot - top)
  const many = ds.layers.length > 30
  T(s, 16, 28, `${L("Profil tanah", "Soil profile")} · ${ds.name || ""} · ${ds.test === "cpt" ? "CPT" : "N-SPT"} · ${ds.layers.length} ${L("baris", "rows")}`, { c: P.ink, fs: 14, b: true })
  const cx0 = 56, cw = 110
  for (let z = 0; z <= depth; z += 5) { T(s, cx0 - 8, Y(z) + 4, nf(z, 0), { c: P.mut, fs: 10.5, a: "end" }); s.append(sv("line", { x1: cx0, x2: W - 16, y1: Y(z), y2: Y(z), stroke: P.grid, "stroke-width": 1 })) }
  T(s, 18, Y(depth / 2), "z (m)", { c: P.ink, fs: 11 })
  // kolom tanah: baris bersambung sejenis digabung menjadi satu blok
  const blocks = []
  ds.layers.forEach((l) => { const b = blocks[blocks.length - 1]; if (b && b.type === l.type && !!b.fill === !!l.fill) b.z1 = l.z1; else blocks.push({ type: l.type, coh: l.coh, fill: !!l.fill, z0: l.z0, z1: l.z1 }) })
  blocks.forEach((l, i) => {
    const r = Rect(s, cx0, Y(l.z0), cw, Y(l.z1) - Y(l.z0), l.fill ? P.fillS : l.coh ? P.clay : P.sand, P.ink, { sw: 1, cls: "dz-fade" }); r.style.setProperty("--i", Math.min(i, 12))
    if (Y(l.z1) - Y(l.z0) > 16) T(s, cx0 + cw / 2, (Y(l.z0) + Y(l.z1)) / 2 + 4, l.fill ? L("Timbunan", "Fill") : typeName(l.type), { c: P.ink, fs: 11, a: "middle", b: true })
  })
  if (ds.fill && ds.fill.H > 0) { s.append(sv("line", { x1: cx0 - 6, x2: W - 16, y1: Y(ds.fill.H), y2: Y(ds.fill.H), stroke: P.ink, "stroke-width": 1.2, "stroke-dasharray": "3 3" })); T(s, W - 18, Y(ds.fill.H) - 5, L(`muka tanah asli (z = ${nf(ds.fill.H, 1)} m)`, `original grade (z = ${nf(ds.fill.H, 1)} m)`), { c: P.mut, fs: 10.5, a: "end" }) }
  if (ds.gwt < depth) { s.append(sv("line", { x1: cx0 - 6, x2: W - 16, y1: Y(ds.gwt), y2: Y(ds.gwt), stroke: P.water, "stroke-width": 2, "stroke-dasharray": "8 5" })); T(s, cx0 + cw + 6, Y(ds.gwt) - 5, `▽ MAT ${nf(ds.gwt, 1)} m`, { c: P.water, fs: 11, b: true }) }
  const panel = (x0, w, title, val, max, c, estK) => {
    T(s, x0 + w / 2, top - 12, title, { c: P.ink, fs: 11.5, a: "middle", b: true })
    s.append(sv("rect", { x: x0, y: top, width: w, height: bot - top, fill: "none", stroke: P.line }))
    const m = Math.max(max, 1e-6)
    for (let k = 0; k <= 4; k++) { const xv = x0 + w * k / 4; T(s, xv, bot + 14, nf(m * k / 4, m >= 20 ? 0 : 1), { c: P.mut, fs: 9.5, a: k === 0 ? "start" : k === 4 ? "end" : "middle" }) }
    let d = ""
    ds.layers.forEach((l, i) => { const x = x0 + Math.min(val(l), m) / m * w; d += `${i ? "L" : "M"}${x.toFixed(1)},${Y(l.z0).toFixed(1)} L${x.toFixed(1)},${Y(l.z1).toFixed(1)} ` })
    const p = sv("path", { d, fill: "none", stroke: c, "stroke-width": many ? 2 : 2.6, "stroke-linejoin": "round", class: "dz-draw", pathLength: 1 }); s.append(p)
    // titik: data terukur (penuh) vs interpolasi (kosong); label hanya bila tidak berhimpit
    let lastY = -99, lastV = NaN
    ds.layers.forEach((l) => {
      const v = val(l), cy = (Y(l.z0) + Y(l.z1)) / 2, est = estK && l.est && l.est[estK]
      if (!(v > 0)) return
      const cx = x0 + Math.min(v, m) / m * w
      if (!many || est) s.append(sv("circle", { cx, cy, r: many ? 2.4 : 3.5, fill: est ? P.bg || "#fff" : c, stroke: c, "stroke-width": 1.3 }))
      if (cy - lastY >= 13 && !est && Math.abs(v - lastV) > 1e-6 * Math.max(1, v)) { T(s, cx + 6, cy - 4, nf(v, v >= 10 ? 0 : 1), { c, fs: 10 }); lastY = cy; lastV = v }
    })
  }
  const pw = (W - cx0 - cw - 80) / 3
  panel(cx0 + cw + 20, pw, "N60", (l) => l.N60, Math.max(...ds.layers.map((l) => l.N60)) * 1.15, P.acc, "N")
  panel(cx0 + cw + 40 + pw, pw, "qc (MPa)", (l) => l.qcE, Math.max(...ds.layers.map((l) => l.qcE)) * 1.15, P.steel, "qc")
  panel(cx0 + cw + 60 + 2 * pw, pw, `cu (${uName("Q")}) · φ (°)`, (l) => (l.coh ? toDisp("Q", l.cu) : l.phi), Math.max(...ds.layers.map((l) => (l.coh ? toDisp("Q", l.cu) : l.phi))) * 1.15, P.bad)
  if (ds.layers.some((l) => l.est && (l.est.N || l.est.qc))) T(s, W - 16, H - 8, L("○ = interpolasi", "○ = interpolated"), { c: P.mut, fs: 10, a: "end" })
  return s
}

// ---------------------------------------------------------------- laporan (hasil untuk tampilan & ekspor)
export function soilReport(P) { const ds = soilDS(P); return buildOut(P, ds, siteClass(ds)) }

// ---------------------------------------------------------------- hasil timbunan: penurunan tanah, gesekan negatif, bidang netral
function nsfOut(P, ds, sp, uF) {
  const f = ds.fill, life = (P.settle && P.settle.life) ?? 20, fsl = fillSettle(ds, life)
  const F1 = (v, d = 0) => `${nf(toDisp("F", v), d)} ${uF}`, mm = (v) => `${nf(v * 1000, 1)} mm`
  const tStrata = { title: L("Penurunan tanah asli akibat timbunan / penurunan MAT (per strata)", "Original ground settlement from fill / groundwater lowering (per stratum)"),
    cols: [L("Strata (kedalaman dari muka tanah asli)", "Stratum (depth below original grade)"), "Hdr (m)", L("cv (m²/th)", "cv (m²/yr)"), L("t90 (th)", "t90 (yr)"), L("s akhir (mm)", "final s (mm)"), "U(t1)", "U(t2)", L("sebelum konstruksi (mm)", "before construction (mm)"), L("sisa sesudah konstruksi (mm)", "after construction (mm)")],
    rows: fsl.strata.map((st) => [st.name, st.coh ? st.Hdr : "–", st.coh ? st.cv : "–", st.coh && st.t90 != null ? st.t90 : "–", st.fin * 1000, st.coh ? st.U1 : "–", st.coh ? st.U2 : "–", st.s1 * 1000, st.rem * 1000]),
    dec: [null, 2, 1, 2, 1, 2, 2, 1, 1], align: ["l", "r", "r", "r", "r", "r", "r", "r", "r"],
    note: L(`Δσ = γf·H = ${nf(toDisp("Q", f.q), 1)} ${uName("Q")} (timbunan luas)${f.dGwt ? `, penurunan MAT ${nf(f.dGwt, 1)} m → Δσ' = γw·Δh` : ""}. t1 = ${nf(fsl.t1, 1)} th (penimbunan → konstruksi), t2 = t1 + umur rencana ${nf(life, 0)} th (tab Penurunan). Lempung: konsolidasi primer dengan σ'p = OCR·σ'0, strata bersambung berdrainase dua arah. Pasir/kerikil: seketika (sebelum konstruksi untuk timbunan, sesudah konstruksi untuk penurunan MAT).`,
      `Δσ = γf·H = ${nf(toDisp("Q", f.q), 1)} ${uName("Q")} (wide fill)${f.dGwt ? `, groundwater lowering ${nf(f.dGwt, 1)} m → Δσ' = γw·Δh` : ""}. t1 = ${nf(fsl.t1, 1)} yr (filling → construction), t2 = t1 + design life ${nf(life, 0)} yr (Settlement tab). Clay: primary consolidation with σ'p = OCR·σ'0, continuous strata double-drained. Sand/gravel: immediate (before construction for fill, after construction for groundwater lowering).`) }
  const ns = sp.ns, r = ns ? ns.r : null
  const kpis = [[L("Penurunan muka tanah akhir", "Final ground settlement"), mm(fsl.fin)], [L("Terjadi sebelum konstruksi", "Before construction"), mm(fsl.s1)], [L(`Sisa sesudah konstruksi (${nf(life, 0)} th)`, `After construction (${nf(life, 0)} yr)`), mm(fsl.rem), true]]
  if (r) kpis.push([L("Bidang netral NP", "Neutral plane NP"), `${nf(r.zn, 2)} m`, true], [L("Gaya seret Qn", "Drag force Qn"), F1(r.Qn)], [L("Gaya maks di NP", "Max force at NP"), F1(r.Qmax)], [L("Downdrag kepala tiang", "Pile-head downdrag"), mm(r.sHead)], [L("Qa desain", "Design Qa"), F1(sp.Qad), true])
  let tNsf = null, steps = null, chart = null, warn = ""
  if (r) {
    const cv = ns.meth === "conv", allow = (P.settle && P.settle.allowDeep) ?? 25
    tNsf = { title: L("Gesekan negatif tiang rencana — ringkasan", "Design pile negative skin friction — summary"), cols: [L("Besaran", "Quantity"), L("Nilai", "Value"), L("Keterangan", "Remarks")], align: ["l", "r", "l"], rows: [
      [L("Metode desain", "Design method"), cv ? L("Konvensional", "Conventional") : L("Terpadu Fellenius", "Fellenius unified"), cv ? L("Qn sebagai beban; gesek di atas NP tidak dihitung", "Qn as load; friction above NP ignored") : L("Qn tidak mengurangi kapasitas geoteknik; dicek pada struktur & penurunan", "Qn does not reduce geotechnical capacity; checked on structure & settlement")],
      [L("β kohesif / granular", "β cohesive / granular"), `${nf(ns.beta[0], 2)} / ${nf(ns.beta[1], 2)}`, "qn = β·σ'v"],
      [L("Beban tetap Qd", "Sustained load Qd"), F1(r.Qd), `${nf(ns.qd, 2)} × Qa`],
      [L("Bidang netral NP (dari muka timbunan)", "Neutral plane NP (from top of fill)"), `${nf(r.zn, 2)} m`, L(`keseimbangan gaya: Rt = 0 → ${nf(r.zn0, 2)} m; Rt = Rt,u → ${nf(r.znU, 2)} m`, `force equilibrium: Rt = 0 → ${nf(r.zn0, 2)} m; Rt = Rt,u → ${nf(r.znU, 2)} m`)],
      [L("Gaya seret Qn (kepala → NP)", "Drag force Qn (head → NP)"), F1(r.Qn), L(`total bila NP di ujung: ${F1(r.QnTot)}`, `total if NP at toe: ${F1(r.QnTot)}`)],
      [L("Gaya aksial maks di NP", "Max axial force at NP"), F1(r.Qmax), `Pa ${F1(ns.Pstr)} → UR ${nf(r.Qmax / ns.Pstr, 2)}`],
      [L("Tahanan ujung termobilisasi Rt", "Mobilised toe resistance Rt"), F1(r.Rt), `Rt,u ${F1(r.Rtu)} · δ ${nf(r.dT * 1000, 1)} mm (δu ${nf(r.du * 1000, 0)} mm)`],
      [L("Gesek positif di bawah NP", "Positive friction below NP"), F1(r.RsBelow), L(`di atas NP ${F1(r.RsAbove)}`, `above NP ${F1(r.RsAbove)}`)],
      [L("Penurunan tanah di NP", "Soil settlement at NP"), mm(r.sN), L("= penurunan tiang di NP", "= pile settlement at NP")],
      [L("Downdrag kepala tiang", "Pile-head downdrag"), mm(r.sHead), `${L("izin tiang", "pile allowable")} ${nf(allow, 0)} mm`],
      [L("Qa terpadu (Fellenius)", "Unified Qa (Fellenius)"), F1(ns.uni.Qa), ns.uni.gov === "str" ? L("dibatasi struktur: qd·Qa + Qn ≤ Pa", "limited by structure: qd·Qa + Qn ≤ Pa") : "min(Qu/FS; Pa)"],
      [L("Qa konvensional", "Conventional Qa"), F1(ns.conv.Qa), "(Qu − Rs,atas NP)/FS − Qn ≤ Pa − Qn"],
      [L("Qa desain (dipakai modul)", "Design Qa (used by modules)"), F1(sp.Qad), cv ? L("konvensional", "conventional") : L("terpadu", "unified")]] }
    steps = { h: L("Gesekan negatif & bidang netral — langkah perhitungan", "Negative skin friction & neutral plane — calculation steps"), rows: [
      [L("Tegangan akibat timbunan", "Fill stress"), "Δσ = γf·H", `${nf(toDisp("G", f.g), 1)} × ${nf(f.H, 2)}`, `${nf(toDisp("Q", f.q), 1)} ${uName("Q")}`],
      [L("Konsolidasi tanah asli", "Original ground consolidation"), "s = Σ h/(1 + e0)·[Cs·log(σ'p/σ'0) + Cc·log(σ'1/σ'p)]", "σ'1 = σ'0 + Δσ (+ γw·Δh)", mm(fsl.fin)],
      [L("Sisa sesudah konstruksi", "Remaining after construction"), "Σ s_i·[U(t2) − U(t1)] + s(Δh)", `t1 ${nf(fsl.t1, 1)}; t2 ${nf(fsl.t2, 1)} ${L("th", "yr")}`, mm(fsl.rem)],
      [L("Gesek negatif satuan", "Unit negative friction"), "qn = β·σ'v (σ'v jangka panjang)", `β ${nf(ns.beta[0], 2)} / ${nf(ns.beta[1], 2)}`, ""],
      [L("Bidang netral", "Neutral plane"), L("Qd + Qn(zn) = Rs(zn→ujung) + Rt dan s_tiang(zn) = s_tanah(zn)", "Qd + Qn(zn) = Rs(zn→toe) + Rt and s_pile(zn) = s_soil(zn)"), `Qd ${F1(r.Qd)}`, `${nf(r.zn, 2)} m`],
      [L("Mobilisasi ujung (q–z)", "Toe mobilisation (q–z)"), "Rt = Rt,u·(δ/δu)^0,5 ≤ Rt,u ; δu = 0,1D", `δ = s_tanah(zn) − Δ(zn→L) − s_tanah(L) = ${nf(r.dT * 1000, 1)} mm`, F1(r.Rt)],
      [L("Gaya seret", "Drag force"), "Qn = Σ qn·πD·Δz (z0 → zn)", "", F1(r.Qn)],
      [L("Gaya aksial maks", "Max axial force"), "Qmax = Qd + Qn ≤ Pa", `Pa ${F1(ns.Pstr)}`, F1(r.Qmax)],
      [L("Downdrag kepala tiang", "Pile-head downdrag"), "s = s_tanah(zn) + Σ Q·Δz/(E·A) (z0 → zn)", `s_tanah(NP) ${mm(r.sN)}; EA ${nf(r.EA / 1000, 0)} MN`, mm(r.sHead)],
      [L("Qa terpadu", "Unified Qa"), "min(Qu/FS; Pa) ; qd·Qa + Qn ≤ Pa", `Qu ${F1(sp.ax.Qc)}; FS ${nf(sp.pp && P.pile.fsC, 1)}`, F1(ns.uni.Qa)],
      [L("Qa konvensional", "Conventional Qa"), "(Qu − Rs,atas NP)/FS − Qn ≤ Pa − Qn", `Rs,atas ${F1(ns.conv.r.RsAbove)}; Qn ${F1(ns.conv.r.Qn)}`, F1(ns.conv.Qa)]] }
    chart = (m) => nsfChart(r, fsl, ds, palette(m), uF, ns.Pstr)
    const w = []
    if (r.none) w.push(L("Tiang turun lebih besar daripada tanah di seluruh panjangnya → tidak ada gesekan negatif pada beban ini.", "The pile settles more than the soil along its full length → no negative skin friction at this load."))
    if (sp.Qad < 0.6 * Math.min(sp.Qac, sp.Pstr)) w.push(L("Gesekan negatif mengurangi Qa tiang cukup besar. Pertimbangkan: perpanjang tiang ke lapis keras, masa tunggu / preloading (+ PVD) sebelum pemasangan tiang, lapisan bitumen (slip coating) pada zona di atas NP, atau metode terpadu.", "Negative skin friction reduces the pile Qa significantly. Consider: longer piles into a firm layer, a waiting period / preloading (+ PVD) before piling, bitumen slip coating above the NP, or the unified method."))
    if (r.sHead * 1000 > allow) w.push(L(`Downdrag kepala tiang ${nf(r.sHead * 1000, 1)} mm > izin ${nf(allow, 0)} mm — bidang netral perlu lebih dalam (tiang lebih panjang / ujung di lapis tak termampatkan) atau kurangi sisa penurunan tanah.`, `Pile-head downdrag ${nf(r.sHead * 1000, 1)} mm > allowable ${nf(allow, 0)} mm — the neutral plane must be deeper (longer pile / toe in incompressible layer) or reduce the remaining ground settlement.`))
    warn = w.join(" ")
  }
  return { fsl, tStrata, tNsf, steps, chart, kpis, warn, badge: r ? `NP ${nf(r.zn, 1)} m · Qn ${F1(r.Qn)}` : `s ${mm(fsl.rem)}`,
    lead: L("Timbunan baru (dan penurunan MAT) memampatkan tanah asli. Bagian penurunan yang terjadi SESUDAH tiang/pondasi dibangun membuat tanah turun lebih besar daripada tiang di bagian atas → gesekan negatif menyeret tiang ke bawah sampai bidang netral (NP), tempat penurunan tiang = penurunan tanah dan gaya aksial tiang maksimum. Di bawah NP gesek kembali positif.",
      "New fill (and groundwater lowering) compresses the original soil. The part of the settlement that occurs AFTER the piles/footings are built makes the soil settle more than the pile near the top → negative skin friction drags the pile down to the neutral plane (NP), where pile settlement = soil settlement and the pile axial force is maximum. Below the NP the friction is positive again."),
    note: L("Acuan: Fellenius (1984, 2004) metode terpadu & Basics of Foundation Design; AASHTO LRFD §3.11.8 & §10.7.3.7 (downdrag); FHWA GEC 12 (2016); Bjerrum dkk. (1969) β = 0,20–0,25 lempung lunak. Penurunan pondasi dangkal di tab Desain/Penurunan sudah ditambah sisa penurunan tanah ini; penurunan kelompok tiang ditambah downdrag di NP. Verifikasi dengan uji beban tiang ber-instrumen bila memungkinkan.",
      "References: Fellenius (1984, 2004) unified method & Basics of Foundation Design; AASHTO LRFD §3.11.8 & §10.7.3.7 (downdrag); FHWA GEC 12 (2016); Bjerrum et al. (1969) β = 0.20–0.25 soft clay. Shallow foundation settlement in the Design/Settlement tabs already includes this remaining ground settlement; pile group settlement includes the downdrag at the NP. Verify with instrumented pile load tests where possible.") }
}

// ---------------------------------------------------------------- koefisien pegas tanah (ks) & tiang (kv, kh, matriks kepala, pegas per titik)
function sprOut(P, ds, sp, b) {
  const uG = uLab("G"), uW = uLab("W"), uM = uLab("M"), uF = uLab("F"), uQ = uName("Q"), G_ = (v) => (v == null ? "–" : toDisp("G", v))
  const so = { ...SETTLE_OPT, ...(P.settle || {}) }
  const Bs = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]
  const rows = Bs.map((B) => { const qa = shallowQa(ds, B, B, b.Df, b.method, b.FS).qa; return { B, qa, k: shallowSprings(ds, { B, L: B, Df: b.Df, qa, FS: b.FS, settle: so }) } })
  const qa0 = shallowQa(ds, b.B, b.B, b.Df, b.method, b.FS).qa, pv = shallowSprings(ds, { B: b.B, L: b.B, Df: b.Df, qa: qa0, FS: b.FS, settle: so })
  const tKs = { title: `${L("Koefisien reaksi tanah dasar ks pondasi bujur sangkar", "Subgrade modulus ks, square footing")} (Df ${nf(b.Df, 2)} m, ${QA_METHOD()[b.method]})`,
    cols: ["B (m)", `qa (${uQ})`, `Bowles 40·FS·qa (${uG})`, `Vesic Es/B(1−ν²) (${uG})`, `${L("dari penurunan segera", "from immediate settlement")} (${uG})`, `${L("dari penurunan jangka panjang", "from long-term settlement")} (${uG})`],
    rows: rows.map(({ B, qa, k }) => ({ cells: [B, toDisp("Q", qa), G_(k.bow), G_(k.ves), G_(k.kI), G_(k.kL)], cls: Math.abs(B - b.B) < 1e-9 ? "hi" : "" })), dec: [1, 0, 0, 0, 0, 0], align: ["r", "r", "r", "r", "r", "r"],
    note: L("ks bergantung ukuran & beban (bukan sifat tanah). Pakai nilai dari penurunan sesuai ukuran pondasi: segera untuk beban sementara (angin/gempa/dinamis), jangka panjang untuk beban tetap. Bowles cenderung kaku (kriteria 25 mm), Vesic sebagai pembanding elastis.", "ks depends on size & load (not a soil property). Use the settlement-based value for the actual footing size: immediate for transient loads (wind/seismic/dynamic), long-term for sustained loads. Bowles tends to be stiff (25 mm criterion); Vesic is an elastic comparison.") }
  const ksI = pv.kI ?? pv.bow, ksL = pv.kL ?? pv.bow
  const tFoot = { title: `${L("Pegas titik telapak (pratinjau)", "Footing point springs (preview)")} ${nf(pv.B, 2)} × ${nf(pv.L, 2)} m, Df ${nf(b.Df, 2)} m`, cols: [L("Pegas", "Spring"), L("Rumus", "Formula"), L("Segera", "Immediate"), L("Jangka panjang", "Long-term"), L("Satuan", "Unit")], align: ["l", "l", "r", "r", "l"], dec: [null, null, 0, 0, null],
    rows: [["ks", "q_net/s", toDisp("G", ksI), toDisp("G", ksL), uG], [L("Vertikal Kv", "Vertical Kv"), "ks·B·L", toDisp("W", ksI * pv.A), toDisp("W", ksL * pv.A), uW],
      [L("Rotasi Kθ (sumbu sejajar B)", "Rotation Kθ (axis parallel to B)"), "ks·B·L³/12", toDisp("M", ksI * pv.Ix), toDisp("M", ksL * pv.Ix), `${uM}/rad`], [L("Rotasi Kθ (sumbu sejajar L)", "Rotation Kθ (axis parallel to L)"), "ks·L·B³/12", toDisp("M", ksI * pv.Iy), toDisp("M", ksL * pv.Iy), `${uM}/rad`]] }
  const stepsS = { h: L("Koefisien reaksi tanah ks — langkah (pratinjau)", "Subgrade modulus ks — steps (preview)"), rows: [
    [L("Daya dukung izin", "Allowable bearing"), "qa", `B ${nf(pv.B, 2)} m; Df ${nf(b.Df, 2)} m`, `${nf(toDisp("Q", qa0), 1)} ${uQ}`],
    ["Bowles (1996)", "ks = 40·FS·qa", `40 × ${nf(b.FS, 1)} × ${nf(qa0, 1)}`, `${nf(toDisp("G", pv.bow), 0)} ${uG}`],
    [L("Vesic (1961), disederhanakan", "Vesic (1961), simplified"), "ks = Es/(B·(1 − ν²))", `Es ${nf(pv.Es / 1000, 1)} MPa; ν ${nf(pv.nu, 2)} (Df … Df + 2B)`, `${nf(toDisp("G", pv.ves), 0)} ${uG}`],
    [L("Dari penurunan segera", "From immediate settlement"), "ks = q_net/si", pv.si != null ? `${nf(pv.qn, 1)} kPa / ${nf(pv.si * 1000, 2)} mm` : pv.err || "", pv.kI != null ? `${nf(toDisp("G", pv.kI), 0)} ${uG}` : "–"],
    [L("Dari penurunan jangka panjang", "From long-term settlement"), "ks = q_net/s(t)", pv.sl != null ? `${nf(pv.qn, 1)} kPa / ${nf(pv.sl * 1000, 2)} mm (${nf(so.life, 0)} ${L("th", "yr")})` : "", pv.kL != null ? `${nf(toDisp("G", pv.kL), 0)} ${uG}` : "–"]] }
  const pl = P.pile, ps = pileSprings(effPile({ pSrc: "proj" }, { pile: pl }), ds, pl.z0, { Q: sp.Qad, dz: +pl.sdz || 1, settle: so })
  const tPile = { title: `${L("Pegas tiang tunggal (tiang rencana)", "Single pile springs (design pile)")} — ${pl.kind === "bored" ? L("bor", "bored") : L("pipa", "pipe")} Ø${nf(pl.D, 0)} mm, L ${nf(pl.L, 1)} m`, cols: [L("Pegas", "Spring"), L("Rumus / dasar", "Formula / basis"), L("Nilai", "Value"), L("Satuan", "Unit")], align: ["l", "l", "r", "l"], dec: [null, null, 0, null],
    rows: [[L("Vertikal kv (disarankan)", "Vertical kv (recommended)"), `Q/s1, s1 = se + sp + ss (Vesic) ${L("pada", "at")} Q = ${nf(toDisp("F", ps.Q), 0)} ${uF}; s1 = ${nf(ps.s1 * 1000, 2)} mm`, toDisp("W", ps.kv), uW],
      [L("Vertikal batas atas", "Vertical upper bound"), L("EA/L (pemendekan elastis saja, dukung ujung kaku)", "EA/L (elastic shortening only, rigid end bearing)"), toDisp("W", ps.kEA), uW],
      [L("Lateral kepala jepit Kh", "Fixed-head lateral Kh"), L("H/y, θ kepala = 0 (Winkler)", "H/y, head θ = 0 (Winkler)"), toDisp("W", ps.KhFix), uW],
      [L("Momen kepala jepit per H", "Fixed-head moment per H"), L("|M0|/H (momen jepit = H × nilai)", "|M0|/H (fixed-end moment = H × value)"), nf(Math.abs(ps.MfixH), 2), "m"],
      [L("Lateral kepala bebas Kh", "Free-head lateral Kh"), L("H/y, M = 0", "H/y, M = 0"), toDisp("W", ps.KhFree), uW],
      [L("Rotasi kepala bebas Kθ", "Free-head rotational Kθ"), L("M/θ, H = 0", "M/θ, H = 0"), toDisp("M", ps.KthFree), `${uM}/rad`],
      [L("Matriks kepala Kyy", "Head matrix Kyy"), "[K] = [F]⁻¹", toDisp("W", ps.K[0][0]), uW], [L("Matriks kepala Kyθ = Kθy", "Head matrix Kyθ = Kθy"), L("kopel (tanda: y searah H, θ = dy/dz, z ke bawah)", "coupling (sign: y along H, θ = dy/dz, z down)"), toDisp("F", ps.K[0][1]), `${uF}/rad`],
      [L("Matriks kepala Kθθ", "Head matrix Kθθ"), "", toDisp("M", ps.K[1][1]), `${uM}/rad`]],
    note: L("Untuk kelompok tiang: kv per tiang ≈ kv/√(Bg/D) dan pegas lateral dikali p-multiplier (keduanya dihitung otomatis di modul Desain). Verifikasi kv dengan uji beban (PDA/statik): kv = Q/δ.", "For pile groups: kv per pile ≈ kv/√(Bg/D) and lateral springs × p-multiplier (both computed automatically in the Design modules). Verify kv with load tests (PDA/static): kv = Q/δ.") }
  const tNodes = { title: `${L("Pegas lateral sepanjang tiang (model batang SAP2000/ETABS/STAAD)", "Lateral springs along the pile (SAP2000/ETABS/STAAD member model)")} — Δz ${nf(ps.dz, 2)} m`, cols: [L("Titik", "Node"), L("z dari kepala (m)", "z below head (m)"), L("z dari muka tanah (m)", "z below grade (m)"), L("Tanah", "Soil"), `kh (${uG})`, L("Δz pengaruh (m)", "tributary Δz (m)"), `k ${L("pegas", "spring")} (${uW})`],
    rows: ps.nodes.map((n, i) => [i + 1, n.z, n.zAbs, n.name, toDisp("G", n.kh), n.trib, toDisp("W", n.k)]), dec: [0, 2, 2, null, 0, 2, 0], align: ["r", "r", "r", "l", "r", "r", "r"],
    note: L("k_i = ∫ kD dz pada daerah pengaruh titik; kD = 67·cu (lempung, Davisson) atau nh·z (pasir, Terzaghi), kh = kD/D. Pegas linear (layan); untuk beban ultimit gunakan kurva p-y nonlinear.", "k_i = ∫ kD dz over the node's tributary length; kD = 67·cu (clay, Davisson) or nh·z (sand, Terzaghi), kh = kD/D. Linear (service) springs; use nonlinear p-y curves for ultimate loads.") }
  return { tKs, tFoot, stepsS, tPile, tNodes, pv, ps,
    lead: L("Koefisien pegas untuk memodelkan tanah di program struktur: ks (pegas area pelat/telapak, SAFE/ETABS) dan pegas titik telapak; tiang: pegas vertikal kv, kekakuan kepala, dan pegas lateral per titik sepanjang tiang.", "Spring coefficients to model the soil in structural software: ks (area springs for slabs/footings, SAFE/ETABS) and footing point springs; piles: vertical spring kv, head stiffness, and lateral springs per node along the pile."),
    note: L("Satuan mengikuti pilihan SI / tf. Pegas tanah bersifat linear-elastis pada tingkat beban layan; nilai sebaiknya diberi batas atas/bawah (mis. 0,5× dan 2×) untuk studi sensitivitas.", "Units follow the SI / tf toggle. Soil springs are linear-elastic at service load level; bracket values (e.g. 0.5× and 2×) for a sensitivity study.") }
}
function buildOut(P, ds, sc) {
  const uQ = uName("Q"), uF = uName("F"), uG = uName("G")
  const b = P.bear, qa0 = shallowQa(ds, b.B, b.B, b.Df, b.method, b.FS)
  const Bs = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]
  const qaRows = Bs.map((B) => { const r = { spt: shallowQa(ds, B, B, b.Df, "spt", b.FS), cpt: shallowQa(ds, B, B, b.Df, "cpt", b.FS), vesic: shallowQa(ds, B, B, b.Df, "vesic", b.FS) }; return [B, toDisp("Q", r.spt.qa), toDisp("Q", r.cpt.qa), toDisp("Q", r.vesic.qa), r[b.method].gov] })
  const pl = P.pile, Ls = []
  for (let Lp = 6; Lp <= pl.Lmax + 1e-9; Lp += 3) Ls.push(Lp)
  const pRows = Ls.map((Lp) => { const a = pileAxial(ds, { D: pl.D / 1000, t: pl.t / 1000, Lp, open: pl.open !== false, method: pl.method, kind: pl.kind, z0: pl.z0 }); return { Lp, a } })
  const sp = singlePile(effPile({ pSrc: "proj" }, { pile: pl }), ds, pl.z0), F1 = (v, d = 0) => `${nf(toDisp("F", v), d)} ${uF}`
  const pSteps = { h: `${L("Tiang rencana", "Design pile")} — ${pl.kind === "bored" ? L("bor", "bored") : L("pipa", "pipe")} Ø${nf(pl.D, 0)} mm, L = ${nf(pl.L, 1)} m (${AXIAL_METHOD()[pl.method].split(" (")[0]})`, rows: [
    [L("Kepala / ujung tiang", "Pile head / tip"), "z0 ; z0 + L", "", `${nf(pl.z0, 2)} ; ${nf(sp.ax.tip.z, 2)} m (${typeName(sp.ax.tip.type)})`],
    [L("Gesek selimut Qs", "Shaft friction Qs"), pl.method === "spt" ? "Σ fs·πD·Δz ; fs = 2N60 (pasir) / α·cu" : pl.method === "cpt" ? "Σ (qc/αLCPC)·πD·Δz" : "Σ fs·πD·Δz ; α·cu / K·σ'v·tanδ", "", F1(sp.ax.Qc - sp.ax.Qb)],
    ...(sp.ax.tip.Nb != null ? [[L("N60 rata-rata ujung N̄b", "Average tip N60 N̄b"), L("rata-rata 10D di atas s.d. 4D di bawah ujung", "average 10D above to 4D below tip"), `z ${nf(sp.ax.tip.za, 2)}–${nf(sp.ax.tip.zb, 2)} m`, nf(sp.ax.tip.Nb, 1)],
      [L("Penetrasi ke lapis pendukung Lb", "Embedment into bearing stratum Lb"), L("ujung − puncak lapis granular bersambung", "tip − top of continuous granular stratum"), "", `${nf(sp.ax.tip.Lb, 2)} m (Lb/D ${nf(sp.ax.tip.Lb / sp.ax.D, 1)})`]] : []),
    ...(sp.ax.tip.qca != null ? [[L("qc ekuivalen ujung qca", "Equivalent tip qc, qca"), L("rata-rata ±1,5D, dibatasi 0,7–1,3·qca'", "average ±1.5D, clipped to 0.7–1.3·qca'"), `qca' ${nf(sp.ax.tip.qca1, 2)} MPa`, `${nf(sp.ax.tip.qca, 2)} MPa`]] : []),
    [L("Tahanan ujung Qb", "End bearing Qb"), pl.method === "spt" && !sp.ax.tip.coh ? (pl.kind === "bored" ? "q = 13·N̄b·Lb/D ≤ 130·N̄b; Qb = q·Ap" : "q = 40·N̄b·Lb/D ≤ 400·N̄b; Qb = q·Ap") : pl.method === "cpt" ? "q = kc·qca; Qb = q·Ap" : "q·Ap", `q = ${nf(toDisp("Q", sp.ax.q), 0)} ${uName("Q")}`, F1(sp.ax.Qb)],
    [L("Kapasitas ultimit Qu", "Ultimate capacity Qu"), "Qs + Qb", "", F1(sp.ax.Qc)],
    [L("Qa geoteknik", "Geotechnical Qa"), "Qu / FS", `FS ${nf(pl.fsC, 1)}`, F1(sp.Qac)],
    [L("Pa struktur", "Structural Pa"), sp.strTxt, "", F1(sp.Pstr)],
    [L("Qa desain tekan", "Design Qa (comp.)"), "min(Qa geoteknik; Pa struktur)", sp.govStr ? L("struktur menentukan", "structure governs") : L("geoteknik menentukan", "geotechnics governs"), F1(sp.Qad)],
    [L("Qa tarik", "Qa tension"), "(Qs·k + W tiang)/FS", `FS ${nf(pl.fsT, 1)}`, F1(sp.Qat)],
    [L("Ha lateral", "Ha lateral"), "min(Hu,Broms jepit/FS; H(y izin))", `${F1(sp.Hal, 1)} ; ${F1(sp.Hd, 1)} (y ${nf(pl.yAllow, 0)} mm)`, F1(sp.Ha, 1)]] }
  const auto = (l, k) => (l.auto[k] ? "" : " ✎")
  const cptT = P.soil.test === "cpt"
  const derived = { note: [ds.layers.some((l) => l.est.N || l.est.qc || l.est.g) ? L("≈ = nilai uji diinterpolasi dari baris berdata terdekat; γ kosong mengikuti baris di atas / nilai tipikal.", "≈ = test value interpolated from the nearest rows with data; empty γ follows the row above / a typical value.") : "",
    ds.fill && ds.fill.H > 0 ? L(`Kedalaman dari puncak timbunan (muka tanah asli = ${nf(ds.fill.H, 2)} m). σ'v = sesudah timbunan; korelasi memakai σ'v sebelum timbunan.`, `Depth from top of fill (original grade = ${nf(ds.fill.H, 2)} m). σ'v = after fill; correlations use σ'v before fill.`) : ""].filter(Boolean).join(" ") || undefined,
    title: L("Parameter desain turunan", "Derived design parameters"), cols: ["z (m)", L("Jenis", "Type"), "N60", "N1(60)", cptT ? "qc (MPa) · Ic" : "qc (MPa)", `σ'v (${uQ})`, `cu (${uQ})`, "φ (°)", "E (MPa)", "ν", "e0", "Cc", "OCR", "cv"],
    rows: ds.layers.map((l) => [`${nf(l.z0, 2)}–${nf(l.z1, 2)}`, fillName(l) + (cptT && l.typeIc && l.typeIc !== l.type ? ` (Ic: ${typeName(l.typeIc)})` : ""), (l.est.N ? "≈" : "") + nf(l.N60, 1), nf(l.N1, 1), (l.est.qc ? "≈" : "") + nf(l.qcE, 2) + (cptT ? ` · Ic ${l.Ic != null ? nf(l.Ic, 2) : "–"}` : ""), nf(toDisp("Q", l.svp), 1), l.coh ? nf(toDisp("Q", l.cu), 1) + auto(l, "cu") : "–", l.coh ? "–" : nf(l.phi, 1) + auto(l, "phi"), nf(l.E / 1000, 1) + auto(l, "E"), nf(l.nu, 2) + auto(l, "nu"),
      l.coh ? nf(l.e0, 2) + auto(l, "e0") : "–", l.coh ? nf(l.Cc, 3) + auto(l, "Cc") : "–", l.coh ? nf(l.OCR, 2) + auto(l, "OCR") : "–", l.coh ? nf(l.cv, 1) + auto(l, "cv") : "–"]), align: ["l", "l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r"] }
  const input = { title: L("Data penyelidikan per lapis", "Investigation data per layer"), cols: ["z (m)", L("Jenis", "Type"), `γ (${uG})`, `γsat (${uG})`, "N-SPT", "qc (MPa)", "fs (kPa)"],
    rows: ds.layers.map((l) => [`${nf(l.z0, 2)}–${nf(l.z1, 2)}`, fillName(l), toDisp("G", l.g), toDisp("G", l.gsat), hasV(l.N) ? l.N : "–", l.qc > 0 ? l.qc : "–", l.fs > 0 ? l.fs : "–"]), dec: [null, null, 2, 2, 0, 2, 0], align: ["l", "l", "r", "r", "r", "r", "r"] }
  const qaT = { title: `${L("Daya dukung izin bruto qa (pondasi bujur sangkar, Df", "Gross allowable bearing qa (square footing, Df")} = ${nf(b.Df, 2)} m, FS ${nf(b.FS, 1)})`, cols: ["B (m)", `N-SPT (${uQ})`, `CPT (${uQ})`, `Vesic/Skempton (${uQ})`, L("Penentu (metode aktif)", "Governing (active method)")],
    rows: qaRows, dec: [1, 0, 0, 0, null], align: ["r", "r", "r", "r", "l"], note: L(`Metode aktif: ${QA_METHOD()[b.method]}. Granular: min(qa penurunan 25 mm, qult/FS). Kohesif: Skempton (φ = 0) dengan cu dari korelasi.`, `Active method: ${QA_METHOD()[b.method]}. Granular: min(25 mm settlement qa, qult/FS). Cohesive: Skempton (φ = 0) with correlated cu.`) }
  const pT = { note: L("Qs = gesek yang terpakai (ujung terbuka: luar saja bila tersumbat, luar + dalam bila tidak).", "Qs = friction used (open end: outer only when plugged, outer + inner when unplugged)."), title: `${L("Kapasitas aksial tiang", "Pile axial capacity")} — ${pl.kind === "bored" ? L("bor", "bored") : L("pipa", "pipe")} Ø${nf(pl.D, 0)} mm, ${AXIAL_METHOD()[pl.method]}, z0 = ${nf(pl.z0, 2)} m`, cols: ["L (m)", `Qs (${uF})`, `Qb (${uF})`, `Qu (${uF})`, `Qa = Qu/${nf(pl.fsC, 1)} (${uF})`, `Qu,tarik (${uF})`, L("Lapis ujung", "Tip layer")],
    rows: pRows.map(({ Lp, a }) => [Lp, toDisp("F", a.Qc - a.Qb), toDisp("F", a.Qb), toDisp("F", a.Qc), toDisp("F", a.Qc / pl.fsC), toDisp("F", a.Qt), typeName(a.tip.type)]), dec: [1, 0, 0, 0, 0, 0, null], align: ["r", "r", "r", "r", "r", "r", "l"] }
  const qaChart = (m) => { const Pp = palette(m); return lineChart(Pp, { title: `${L("qa vs lebar B", "qa vs width B")} (Df ${nf(b.Df, 2)} m)`, xLab: "B (m)", yLab: `qa (${uQ})`, legendRight: true,
    series: [["spt", "N-SPT", Pp.acc], ["cpt", "CPT", Pp.steel], ["vesic", "Vesic", Pp.bad]].map(([k, n, c], i) => ({ name: n + (k === b.method ? " ●" : ""), c, w: k === b.method ? 3.4 : 2, dash: k === b.method ? null : "6 4", pts: qaRows.map((r) => [r[0], r[1 + i]]), dots: k === b.method })),
    marks: [{ x: b.B, y: toDisp("Q", qa0.qa), label: `${nf(toDisp("Q", qa0.qa), 0)}`, c: Pp.bad }] }) }
  const pChart = (m) => { const Pp = palette(m); return lineChart(Pp, { title: L("Kapasitas tiang vs panjang", "Pile capacity vs length"), xLab: "L (m)", yLab: uF, legendRight: true,
    series: [{ name: "Qu", c: Pp.bad, pts: pRows.map(({ Lp, a }) => [Lp, toDisp("F", a.Qc)]), dots: true }, { name: "Qs", c: Pp.steel, dash: "6 4", pts: pRows.map(({ Lp, a }) => [Lp, toDisp("F", a.Qc - a.Qb)]) }, { name: "Qb", c: Pp.acc, dash: "6 4", pts: pRows.map(({ Lp, a }) => [Lp, toDisp("F", a.Qb)]) }, { name: "Qa", c: Pp.ok, w: 2, pts: pRows.map(({ Lp, a }) => [Lp, toDisp("F", a.Qc / pl.fsC)]) }], vlines: [{ x: pl.L, label: `L ${nf(pl.L, 1)} m` }], marks: [{ x: pl.L, y: toDisp("F", sp.ax.Qc), label: `Qu ${nf(toDisp("F", sp.ax.Qc), 0)}`, c: Pp.bad }] }) }
  const ss = seisSite(P)
  const nsf = ds.fill ? nsfOut(P, ds, sp, uF) : null, spr = sprOut(P, ds, sp, b)
  const fillNote = ds.fill ? ` · ${L("timbunan", "fill")} ${nf(ds.fill.H, 1)} m${ds.fill.dGwt ? ` · ΔMAT ${nf(ds.fill.dGwt, 1)} m` : ""}` : ""
  return {
    nsf, spr,
    file: "Data_Tanah", suite: L("DATA TANAH", "SOIL DATA"), title: `${L("Data Tanah", "Soil Data")} — ${P.soil.name || "BH"}`, sub: `${P.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${ds.layers.length} ${L("lapis", "layers")} · MAT ${nf(ds.gwt, 2)} m · ${L("kelas situs", "site class")} ${sc.cls} (N̄ ${nf(sc.Nbar, 1)})${fillNote}`,
    refs: "SNI 8460:2017 · SNI 1726:2019 · SNI 4153 (SPT) · SNI 2827 (sondir) · Das · Bowles · FHWA GEC 10 · API RP 2GEO · LCPC",
    metrics: [{ lab: L("Kedalaman penyelidikan", "Investigation depth"), val: ds.depth, d: 1, unit: "m" }, { lab: "N̄ (30 m)", val: sc.Nbar, d: 1 }, { lab: L("Kelas situs", "Site class"), val: sc.cls }, { lab: `qa (B ${nf(b.B, 1)} m)`, val: toDisp("Q", qa0.qa), d: 0, unit: uQ }, { lab: L("SDS (tab Gempa)", "SDS (Seismic tab)"), val: ss.sp.SDS, d: 3 }],
    checks: [], kv: [{ title: L("Penyelidikan", "Investigation"), rows: [[L("Titik", "Point"), P.soil.name || "–"], [L("Uji", "Test"), P.soil.test === "cpt" ? "CPT" : "N-SPT"], [L("Muka air tanah", "Groundwater"), ds.gwt, "m", 2], ["Er", P.soil.Er, "%", 0], ["Nkt", P.soil.Nkt, "", 0], [L("Kelas situs", "Site class"), `${sc.cls} — ${sc.why}`], [L("Metode daya dukung", "Bearing method"), QA_METHOD()[b.method]], ["FS", b.FS, "", 1],
      ...(ds.fill ? [[L("Timbunan baru", "New fill"), `H ${nf(ds.fill.H, 2)} m · γf ${nf(toDisp("G", ds.fill.g), 1)} ${uG} · q ${nf(toDisp("Q", ds.fill.q), 1)} ${uQ}`], [L("Penurunan MAT Δh", "Groundwater lowering Δh"), ds.fill.dGwt, "m", 1], [L("Jeda penimbunan → konstruksi", "Filling → construction"), ds.fill.tPre, L("tahun", "years"), 1]] : [])] }],
    tables: [input, derived, qaT, pT, ...(nsf ? [nsf.tStrata, ...(nsf.tNsf ? [nsf.tNsf] : [])] : []), spr.tKs, spr.tFoot, spr.tPile, spr.tNodes], qa0, pile: sp,
    notes: [L("Korelasi bersifat empiris; verifikasi dengan uji laboratorium (UU/CU, oedometer) dan uji beban tiang. Parameter yang ditimpa manual ditandai ✎.", "Correlations are empirical; verify with laboratory tests (UU/CU, oedometer) and pile load tests. Manually overridden parameters are marked ✎."),
      L("Daya dukung pasir N-SPT/CPT memakai kriteria penurunan 25 mm (Meyerhof) dibatasi keruntuhan geser Vesic; lempung memakai Skempton φ = 0. Kapasitas tiang α/β mengikuti API RP 2GEO (pancang) / FHWA GEC 10 (bor).", "Sand bearing by N-SPT/CPT uses the 25 mm settlement criterion (Meyerhof) capped by Vesic shear failure; clay uses Skempton φ = 0. α/β pile capacity follows API RP 2GEO (driven) / FHWA GEC 10 (bored).")],
    drawings: [{ make: (m) => profileChart(ds, palette(m)), cap: L("Gambar 1 — Profil tanah, N60, qc, cu/φ", "Figure 1 — Soil profile, N60, qc, cu/φ") }, { make: qaChart, cap: L("Gambar 2 — Daya dukung izin vs lebar pondasi", "Figure 2 — Allowable bearing vs footing width"), maxH: 300 }, { make: pChart, cap: L("Gambar 3 — Kapasitas aksial tiang vs panjang", "Figure 3 — Pile axial capacity vs length"), maxH: 300 },
      ...(nsf && nsf.chart ? [{ make: nsf.chart, cap: L("Gambar 4 — Penurunan tanah & tiang, distribusi gaya aksial, bidang netral", "Figure 4 — Soil & pile settlement, axial force distribution, neutral plane"), maxH: 320 }] : [])],
    steps: [{ h: `${L("Daya dukung", "Bearing capacity")} — ${qa0.txt} (B = ${nf(b.B, 2)} m, Df = ${nf(b.Df, 2)} m)`, rows: qa0.rows }, pSteps, ...(nsf && nsf.steps ? [nsf.steps] : []), spr.stepsS],
    combos: [], cases: {},
  }
}
