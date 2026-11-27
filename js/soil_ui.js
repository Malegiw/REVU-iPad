// Editor data tanah bersama: penyelidikan (N-SPT / CPT, MAT, Er, Nkt, Gs), lapisan / baris per kedalaman (bagi per interval, tempel dari
// Excel, gabung, jenis dari Ic, urungkan) dan timbunan / penurunan MAT. Dipakai tab Tanah (data proyek) dan modul Desain yang memakai
// data tanah sendiri ("Isi di modul ini"). Bekerja langsung pada objek data tanah `so`; changed(structural) dipanggil saat berubah.
import { L, nf, uName, uFac } from "./desain/core.js"
import { el, field, isConv } from "./desain/ui.js"
import { TYPES, typeName, MAX_ROWS, OVR, resampleSoil, mergeRows, classifyCpt, parseSoilPaste, FILL0 } from "./desain/soil.js"

const parseNum = (s) => { const v = parseFloat(String(s).trim().replace(",", ".")); return isFinite(v) ? v : NaN }
const fmtIn = (v) => (isFinite(v) ? String(+(+v).toPrecision(6)) : "")
let showAdv = false

// ---------------------------------------------------------------- penyelidikan tanah
export function invFields(so, changed) {
  const g = el("div", "dz-grid")
  g.append(field({ k: "name", type: "txt", lab: L("Nama titik bor / sondir", "Borehole / CPT name"), obj: so }, so, () => changed(false)),
    field({ k: "test", type: "seg", lab: L("Jenis uji utama", "Primary test"), opts: { spt: "N-SPT", cpt: L("CPT / sondir", "CPT") }, obj: so }, so, changed),
    field({ k: "gwt", lab: L("Muka air tanah dari muka tanah", "Groundwater below grade"), u: "m", lo: 0, hi: 99, obj: so }, so, changed),
    field({ k: "Er", lab: L("Efisiensi hammer Er (N60 = N·Er/60)", "Hammer efficiency Er (N60 = N·Er/60)"), u: "%", lo: 30, hi: 100, obj: so, help: L("Donut ±45%, safety ±60%, otomatis ±80%.", "Donut ≈45%, safety ≈60%, automatic ≈80%.") }, so, changed),
    field({ k: "Nkt", lab: L("Faktor konus Nkt (cu = (qc − σv)/Nkt)", "Cone factor Nkt (cu = (qc − σv)/Nkt)"), u: "", lo: 8, hi: 30, obj: so }, so, changed),
    field({ k: "Gs", lab: L("Berat jenis butir Gs (untuk e0)", "Specific gravity Gs (for e0)"), u: "", lo: 2.4, hi: 2.9, obj: so }, so, changed))
  return g
}

// editor lengkap dalam satu wadah (dipakai modul Desain): penyelidikan + lapisan + timbunan
export function soilEditor(so, changed) {
  if (!so.fill) so.fill = { ...FILL0 }
  const box = el("div", "pj-soiled")
  const sub = (t) => el("div", "dz-sub", t)
  box.append(sub(L("Penyelidikan tanah", "Site investigation")), invFields(so, changed),
    sub(L("Lapisan tanah / data per kedalaman (dari muka tanah ke bawah)", "Soil layers / data by depth (from grade down)")), layersTable(so, changed),
    sub(L("Timbunan & penurunan muka air tanah (gesekan negatif)", "Fill & groundwater lowering (negative skin friction)")), ...fillInputs(so.fill, changed))
  return box
}

// ---------------------------------------------------------------- editor lapisan / baris per interval
const hasV = (v) => v != null && v !== "" && isFinite(v)
// status alat (panel aktif & urungkan) per objek data tanah: tab Tanah dan tiap modul Desain punya editor sendiri
const EDST = new WeakMap(), edSt = (so) => { let x = EDST.get(so); if (!x) EDST.set(so, (x = { tool: "", undo: null })); return x }
const intSt = { dz: 0.5, zmax: 30, blank: false }, pasteSt = { qcUnit: "mpa", fsUnit: "kpa", text: "" }
export function layersTable(so, changed) {
  const box = el("div"), us = edSt(so)
  const draw = () => {
    box.textContent = ""
    const cpt = so.test === "cpt", n = so.layers.length
    const depth = so.layers.reduce((s2, l) => s2 + (+l.h || 0), 0)
    // ---- bilah alat
    const bar = el("div", "pj-row pj-soilbar")
    const btn = (txt, cls, on, dis) => { const x = el("button", cls || "dz-add ghost", txt); x.type = "button"; x.disabled = !!dis; x.onclick = on; return x }
    const apply = (soil, msg) => { us.undo = { layers: so.layers.map((l) => ({ ...l })), msg }; so.layers = soil.layers; us.tool = ""; changed(true) }
    bar.append(btn(L("＋ Tambah baris", "＋ Add row"), "dz-add", () => { const last = so.layers[so.layers.length - 1]; so.layers.push({ ...last }); changed(true) }, n >= MAX_ROWS),
      btn(L("⇅ Bagi per interval…", "⇅ Split by interval…"), "dz-add ghost" + (us.tool === "int" ? " on" : ""), () => { us.tool = us.tool === "int" ? "" : "int"; draw() }),
      btn(L("📋 Tempel dari Excel…", "📋 Paste from Excel…"), "dz-add ghost" + (us.tool === "paste" ? " on" : ""), () => { us.tool = us.tool === "paste" ? "" : "paste"; draw() }),
      btn(L("⊟ Gabung baris yang sama", "⊟ Merge identical rows"), "dz-add ghost", () => { const m = mergeRows(so); if (m.layers.length < n) apply(m, L(`${n} → ${m.layers.length} baris`, `${n} → ${m.layers.length} rows`)) }, n < 2),
      ...(cpt ? [btn(L("◎ Jenis dari CPT (Ic)", "◎ Type from CPT (Ic)"), "dz-add ghost", () => { const r = classifyCpt(so); if (r.n) apply(r.soil, L(`jenis ${r.n} baris diubah dari Ic`, `${r.n} row types set from Ic`)); else { info.textContent = L("Tidak ada jenis yang berubah (perlu qc dan fs).", "No type changed (needs qc and fs).") } })] : []),
      btn(showAdv ? L("Sembunyikan parameter lanjutan", "Hide advanced parameters") : L("Parameter lanjutan ▸", "Advanced parameters ▸"), "dz-add ghost", () => { showAdv = !showAdv; draw() }))
    if (us.undo) bar.append(btn(L(`↶ Urungkan (${us.undo.msg})`, `↶ Undo (${us.undo.msg})`), "dz-add ghost warn", () => { so.layers = us.undo.layers; us.undo = null; changed(true) }))
    const info = el("span", "hint pj-soilinfo", L(`${n} baris · kedalaman ${nf(depth, 2)} m · maks. ${MAX_ROWS} baris`, `${n} rows · depth ${nf(depth, 2)} m · max. ${MAX_ROWS} rows`))
    bar.append(info)
    box.append(bar)
    if (us.tool === "int") box.append(intervalPanel(so, apply))
    if (us.tool === "paste") box.append(pastePanel(so, apply))
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
    const w = el("div", "pj-us.tool dz-in on"), g = el("div", "dz-grid")
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
    const w = el("div", "pj-us.tool dz-in on"), ta = el("textarea", "pj-paste")
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

// ---------------------------------------------------------------- input timbunan / penurunan MAT
export function fillInputs(f, changed) {
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
