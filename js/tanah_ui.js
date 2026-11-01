// Tab "Data Tanah": input penyelidikan tanah (N-SPT atau CPT/sondir) per lapis, korelasi parameter desain (cu, φ, E, e0, Cc, OCR, cv) yang bisa
// ditimpa manual, grafik profil, kelas situs SNI 1726 (diteruskan ke tab Gempa), daya dukung pondasi dangkal (N-SPT / CPT / Vesic) dan
// kapasitas aksial tiang (α/β, N-SPT, CPT). Semua tersimpan di data proyek dan dipakai tab Desain & Penurunan.
import { L, lang, nf, toDisp, uName, uFac } from "./desain/core.js"
import { el, sv, field, exportBar, reveal, tableView, isConv } from "./desain/ui.js"
import { palette, root, T, R as Rect } from "./desain/draw.js"
import { lineChart } from "./desain/chart.js"
import { projLoad, projSave, soilDS, seisSite, stepper } from "./project.js"
import { TYPES, typeName, siteClass, shallowQa, pileAxial, QA_METHOD, AXIAL_METHOD, OVR } from "./desain/soil.js"
import { singlePile, effPile } from "./desain/deep.js"
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
    inBox.append(card("t-lay", "🧱", L("Lapisan tanah (dari muka tanah ke bawah)", "Soil layers (from grade down)"), `${so.layers.length} ${L("lapis", "layers")}`, layersTable(P, changed)))
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
    exportBar(expBox, () => last, { project: P.info })
    reveal(box)
  }
  drawInputs(); drawResults()
}

function stepsTable(st) {
  const t = { title: st.h, cols: [L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")], rows: st.rows, align: ["l", "l", "l", "r"] }
  const w = tableView(t); w.classList.add("dz-steptbl"); return w
}

// ---------------------------------------------------------------- editor lapisan
function layersTable(P, changed) {
  const box = el("div")
  const draw = () => {
    box.textContent = ""
    const so = P.soil, cpt = so.test === "cpt"
    const tw = el("div", "dz-tbl-wrap"), tb = el("table", "dz-edit pj-edit")
    const cols = [L("Kedalaman", "Depth"), L("Tebal (m)", "Thick. (m)"), L("Jenis", "Type"), `γ (${uName("G")})`, `γsat (${uName("G")})`, cpt ? "qc (MPa)" : "N-SPT", cpt ? "fs (kPa)" : L("qc (MPa, opsional)", "qc (MPa, optional)")]
    const adv = [["cu", `cu (${uName("Q")})`, "Q", 0, 2000], ["phi", "φ (°)", "", 0, 50], ["E", "E (MPa)", "", 0, 5000], ["nu", "ν", "", 0, 0.5], ["e0", "e0", "", 0, 5], ["Cc", "Cc", "", 0, 3], ["Cs", "Cs", "", 0, 1], ["OCR", "OCR", "", 0, 20], ["cv", "cv (m²/th)", "", 0, 500], ["Ca", "Cα/(1+e0)", "", 0, 0.2]]
    const hd = el("tr"); cols.forEach((c) => hd.append(el("th", null, c))); if (showAdv) adv.forEach((a) => hd.append(el("th", "adv", a[1]))); hd.append(el("th")); tb.append(hd)
    let z = 0
    so.layers.forEach((ly, i) => {
      const tr = el("tr")
      tr.append(el("td", "dz-zz", `${nf(z, 1)}–${nf(z + ly.h, 1)} m`)); z += ly.h
      const num = (k, kind, lo, hi, cls) => {
        const td = el("td", cls || ""), inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"
        const fac = isConv(kind) ? uFac(kind) : 1
        inp.value = ly[k] > 0 || k === "h" || k === "g" || k === "gsat" || k === "N" ? fmtIn(ly[k] / fac) : ""
        if (cls === "adv") inp.placeholder = L("auto", "auto")
        inp.oninput = () => { const v = inp.value.trim() === "" ? 0 : parseNum(inp.value); const ok = !isNaN(v) && v >= lo / fac && v <= hi / fac; inp.classList.toggle("bad", !ok); if (ok) { ly[k] = v * fac; changed(false) } }
        inp.onchange = () => { if (k === "h") draw() }
        td.append(inp); return td
      }
      tr.append(num("h", "", 0.1, 80))
      const tdT = el("td"), sel = el("select")
      Object.keys(TYPES).forEach((k) => { const o = el("option", null, typeName(k)); o.value = k; if (ly.type === k) o.selected = true; sel.append(o) })
      sel.onchange = () => { ly.type = sel.value; changed(false) }
      tdT.append(sel); tr.append(tdT)
      tr.append(num("g", "G", 10, 24), num("gsat", "G", 10, 25))
      if (cpt) tr.append(num("qc", "", 0, 100), num("fs", "", 0, 2000))
      else tr.append(num("N", "", 0, 200), num("qc", "", 0, 100))
      if (showAdv) adv.forEach(([k, , kind, lo, hi]) => tr.append(num(k, kind, lo, hi, "adv")))
      const del = el("button", "dz-x", "✕"); del.type = "button"; del.title = L("Hapus lapis", "Remove layer"); del.disabled = so.layers.length <= 1
      del.onclick = () => { so.layers.splice(i, 1); draw(); changed(false) }
      const td = el("td"); td.append(del); tr.append(td)
      tb.append(tr)
    })
    tw.append(tb); box.append(tw)
    const bar = el("div", "pj-row")
    const add = el("button", "dz-add", L("＋ Tambah lapis", "＋ Add layer")); add.type = "button"; add.disabled = so.layers.length >= 15
    add.onclick = () => { const last = so.layers[so.layers.length - 1]; so.layers.push({ ...last }); draw(); changed(false) }
    const tg = el("button", "dz-add ghost", showAdv ? L("Sembunyikan parameter lanjutan", "Hide advanced parameters") : L("Parameter lanjutan (timpa korelasi) ▸", "Advanced parameters (override correlations) ▸")); tg.type = "button"
    tg.onclick = () => { showAdv = !showAdv; draw() }
    bar.append(add, tg); box.append(bar)
    box.append(el("p", "dz-note", L("Kosongkan kolom lanjutan (atau 0) untuk memakai korelasi otomatis. Bila uji CPT, N60 setara dihitung dari qc/N (Robertson) untuk kelas situs.", "Leave advanced columns empty (or 0) to use automatic correlations. With CPT, an equivalent N60 is derived from qc/N (Robertson) for site class.")))
  }
  draw()
  return box
}

// ---------------------------------------------------------------- gambar profil (kolom tanah + N60 + qc + cu/φ)
export function profileChart(ds, P) {
  const W = 760, H = 520, s = root(W, H, P, L("Profil tanah", "Soil profile"))
  const top = 54, bot = H - 30, depth = Math.ceil(ds.depth / 5) * 5, Y = (z) => top + z / depth * (bot - top)
  T(s, 16, 28, `${L("Profil tanah", "Soil profile")} · ${ds.name || ""} · ${ds.test === "cpt" ? "CPT" : "N-SPT"}`, { c: P.ink, fs: 14, b: true })
  const cx0 = 56, cw = 110
  for (let z = 0; z <= depth; z += 5) { T(s, cx0 - 8, Y(z) + 4, nf(z, 0), { c: P.mut, fs: 10.5, a: "end" }); s.append(sv("line", { x1: cx0, x2: W - 16, y1: Y(z), y2: Y(z), stroke: P.grid, "stroke-width": 1 })) }
  T(s, 18, Y(depth / 2), "z (m)", { c: P.ink, fs: 11 })
  ds.layers.forEach((l, i) => {
    const r = Rect(s, cx0, Y(l.z0), cw, Y(l.z1) - Y(l.z0), l.coh ? P.clay : P.sand, P.ink, { sw: 1, cls: "dz-fade" }); r.style.setProperty("--i", i)
    if (Y(l.z1) - Y(l.z0) > 16) T(s, cx0 + cw / 2, (Y(l.z0) + Y(l.z1)) / 2 + 4, typeName(l.type), { c: P.ink, fs: 11, a: "middle", b: true })
  })
  if (ds.gwt < depth) { s.append(sv("line", { x1: cx0 - 6, x2: W - 16, y1: Y(ds.gwt), y2: Y(ds.gwt), stroke: P.water, "stroke-width": 2, "stroke-dasharray": "8 5" })); T(s, cx0 + cw + 6, Y(ds.gwt) - 5, `▽ MAT ${nf(ds.gwt, 1)} m`, { c: P.water, fs: 11, b: true }) }
  const panel = (x0, w, title, val, max, c) => {
    T(s, x0 + w / 2, top - 12, title, { c: P.ink, fs: 11.5, a: "middle", b: true })
    s.append(sv("rect", { x: x0, y: top, width: w, height: bot - top, fill: "none", stroke: P.line }))
    const m = Math.max(max, 1e-6)
    for (let k = 0; k <= 4; k++) { const xv = x0 + w * k / 4; T(s, xv, bot + 14, nf(m * k / 4, m >= 20 ? 0 : 1), { c: P.mut, fs: 9.5, a: k === 0 ? "start" : k === 4 ? "end" : "middle" }) }
    let d = ""
    ds.layers.forEach((l, i) => { const x = x0 + Math.min(val(l), m) / m * w; d += `${i ? "L" : "M"}${x.toFixed(1)},${Y(l.z0).toFixed(1)} L${x.toFixed(1)},${Y(l.z1).toFixed(1)} ` })
    const p = sv("path", { d, fill: "none", stroke: c, "stroke-width": 2.6, class: "dz-draw", pathLength: 1 }); s.append(p)
    ds.layers.forEach((l) => { const v = val(l); if (v > 0) { s.append(sv("circle", { cx: x0 + Math.min(v, m) / m * w, cy: (Y(l.z0) + Y(l.z1)) / 2, r: 3.5, fill: c })); T(s, x0 + Math.min(v, m) / m * w + 6, (Y(l.z0) + Y(l.z1)) / 2 - 4, nf(v, v >= 10 ? 0 : 1), { c, fs: 10 }) } })
  }
  const pw = (W - cx0 - cw - 80) / 3
  panel(cx0 + cw + 20, pw, "N60", (l) => l.N60, Math.max(...ds.layers.map((l) => l.N60)) * 1.15, P.acc)
  panel(cx0 + cw + 40 + pw, pw, "qc (MPa)", (l) => l.qcE, Math.max(...ds.layers.map((l) => l.qcE)) * 1.15, P.steel)
  panel(cx0 + cw + 60 + 2 * pw, pw, `cu (${uName("Q")}) · φ (°)`, (l) => (l.coh ? toDisp("Q", l.cu) : l.phi), Math.max(...ds.layers.map((l) => (l.coh ? toDisp("Q", l.cu) : l.phi))) * 1.15, P.bad)
  return s
}

// ---------------------------------------------------------------- laporan (hasil untuk tampilan & ekspor)
export function soilReport(P) { const ds = soilDS(P); return buildOut(P, ds, siteClass(ds)) }
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
    [L("Tahanan ujung Qb", "End bearing Qb"), "q·Ap", `q = ${nf(toDisp("Q", sp.ax.q), 0)} ${uName("Q")}`, F1(sp.ax.Qb)],
    [L("Kapasitas ultimit Qu", "Ultimate capacity Qu"), "Qs + Qb", "", F1(sp.ax.Qc)],
    [L("Qa geoteknik", "Geotechnical Qa"), "Qu / FS", `FS ${nf(pl.fsC, 1)}`, F1(sp.Qac)],
    [L("Pa struktur", "Structural Pa"), sp.strTxt, "", F1(sp.Pstr)],
    [L("Qa desain tekan", "Design Qa (comp.)"), "min(Qa geoteknik; Pa struktur)", sp.govStr ? L("struktur menentukan", "structure governs") : L("geoteknik menentukan", "geotechnics governs"), F1(sp.Qad)],
    [L("Qa tarik", "Qa tension"), "(Qs·k + W tiang)/FS", `FS ${nf(pl.fsT, 1)}`, F1(sp.Qat)],
    [L("Ha lateral", "Ha lateral"), "min(Hu,Broms jepit/FS; H(y izin))", `${F1(sp.Hal, 1)} ; ${F1(sp.Hd, 1)} (y ${nf(pl.yAllow, 0)} mm)`, F1(sp.Ha, 1)]] }
  const auto = (l, k) => (l.auto[k] ? "" : " ✎")
  const derived = { title: L("Parameter desain turunan", "Derived design parameters"), cols: ["z (m)", L("Jenis", "Type"), "N60", "N1(60)", "qc (MPa)", `σ'v (${uQ})`, `cu (${uQ})`, "φ (°)", "E (MPa)", "ν", "e0", "Cc", "OCR", "cv"],
    rows: ds.layers.map((l) => [`${nf(l.z0, 1)}–${nf(l.z1, 1)}`, typeName(l.type), nf(l.N60, 1), nf(l.N1, 1), nf(l.qcE, 2), nf(toDisp("Q", l.svp), 1), l.coh ? nf(toDisp("Q", l.cu), 1) + auto(l, "cu") : "–", l.coh ? "–" : nf(l.phi, 1) + auto(l, "phi"), nf(l.E / 1000, 1) + auto(l, "E"), nf(l.nu, 2) + auto(l, "nu"),
      l.coh ? nf(l.e0, 2) + auto(l, "e0") : "–", l.coh ? nf(l.Cc, 3) + auto(l, "Cc") : "–", l.coh ? nf(l.OCR, 2) + auto(l, "OCR") : "–", l.coh ? nf(l.cv, 1) + auto(l, "cv") : "–"]), align: ["l", "l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r"] }
  const input = { title: L("Data penyelidikan per lapis", "Investigation data per layer"), cols: ["z (m)", L("Jenis", "Type"), `γ (${uG})`, `γsat (${uG})`, "N-SPT", "qc (MPa)", "fs (kPa)"],
    rows: ds.layers.map((l) => [`${nf(l.z0, 1)}–${nf(l.z1, 1)}`, typeName(l.type), toDisp("G", l.g), toDisp("G", l.gsat), l.N || "–", l.qc || "–", l.fs || "–"]), dec: [null, null, 2, 2, 0, 2, 0], align: ["l", "l", "r", "r", "r", "r", "r"] }
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
  return {
    file: "Data_Tanah", suite: L("DATA TANAH", "SOIL DATA"), title: `${L("Data Tanah", "Soil Data")} — ${P.soil.name || "BH"}`, sub: `${P.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${ds.layers.length} ${L("lapis", "layers")} · MAT ${nf(ds.gwt, 2)} m · ${L("kelas situs", "site class")} ${sc.cls} (N̄ ${nf(sc.Nbar, 1)})`,
    refs: "SNI 8460:2017 · SNI 1726:2019 · SNI 4153 (SPT) · SNI 2827 (sondir) · Das · Bowles · FHWA GEC 10 · API RP 2GEO · LCPC",
    metrics: [{ lab: L("Kedalaman penyelidikan", "Investigation depth"), val: ds.depth, d: 1, unit: "m" }, { lab: "N̄ (30 m)", val: sc.Nbar, d: 1 }, { lab: L("Kelas situs", "Site class"), val: sc.cls }, { lab: `qa (B ${nf(b.B, 1)} m)`, val: toDisp("Q", qa0.qa), d: 0, unit: uQ }, { lab: L("SDS (tab Gempa)", "SDS (Seismic tab)"), val: ss.sp.SDS, d: 3 }],
    checks: [], kv: [{ title: L("Penyelidikan", "Investigation"), rows: [[L("Titik", "Point"), P.soil.name || "–"], [L("Uji", "Test"), P.soil.test === "cpt" ? "CPT" : "N-SPT"], [L("Muka air tanah", "Groundwater"), ds.gwt, "m", 2], ["Er", P.soil.Er, "%", 0], ["Nkt", P.soil.Nkt, "", 0], [L("Kelas situs", "Site class"), `${sc.cls} — ${sc.why}`], [L("Metode daya dukung", "Bearing method"), QA_METHOD()[b.method]], ["FS", b.FS, "", 1]] }],
    tables: [input, derived, qaT, pT], qa0, pile: sp,
    notes: [L("Korelasi bersifat empiris; verifikasi dengan uji laboratorium (UU/CU, oedometer) dan uji beban tiang. Parameter yang ditimpa manual ditandai ✎.", "Correlations are empirical; verify with laboratory tests (UU/CU, oedometer) and pile load tests. Manually overridden parameters are marked ✎."),
      L("Daya dukung pasir N-SPT/CPT memakai kriteria penurunan 25 mm (Meyerhof) dibatasi keruntuhan geser Vesic; lempung memakai Skempton φ = 0. Kapasitas tiang α/β mengikuti API RP 2GEO (pancang) / FHWA GEC 10 (bor).", "Sand bearing by N-SPT/CPT uses the 25 mm settlement criterion (Meyerhof) capped by Vesic shear failure; clay uses Skempton φ = 0. α/β pile capacity follows API RP 2GEO (driven) / FHWA GEC 10 (bored).")],
    drawings: [{ make: (m) => profileChart(ds, palette(m)), cap: L("Gambar 1 — Profil tanah, N60, qc, cu/φ", "Figure 1 — Soil profile, N60, qc, cu/φ") }, { make: qaChart, cap: L("Gambar 2 — Daya dukung izin vs lebar pondasi", "Figure 2 — Allowable bearing vs footing width"), maxH: 300 }, { make: pChart, cap: L("Gambar 3 — Kapasitas aksial tiang vs panjang", "Figure 3 — Pile axial capacity vs length"), maxH: 300 }],
    steps: [{ h: `${L("Daya dukung", "Bearing capacity")} — ${qa0.txt} (B = ${nf(b.B, 2)} m, Df = ${nf(b.Df, 2)} m)`, rows: qa0.rows }, pSteps],
    combos: [], cases: {},
  }
}
