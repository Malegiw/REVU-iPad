// Tab "Penurunan Pondasi" (dibangun ulang): penurunan pondasi DANGKAL (segera Steinbrenner + konsolidasi primer Terzaghi + sekunder) dan
// DALAM (kelompok tiang: pemendekan elastis + rakit ekuivalen, pembanding Vesic) memakai profil tab Tanah. Daftar kasus otomatis dari semua
// modul Desain (B, L, Df, q atau konfigurasi tiang) ditambah kasus manual. Mesin: js/penurunan.js (diuji terhadap Python) lewat js/desain/soil.js.
import { L, lang, nf, toDisp, uName } from "./desain/core.js"
import { el, field, exportBar, reveal, tableView, urClass } from "./desain/ui.js"
import { palette, root, T, R as Rect } from "./desain/draw.js"
import { lineChart } from "./desain/chart.js"
import { projLoad, projSave, soilDS, stepper } from "./project.js"
import { settleShallow, settleGroup, pileAxial, typeName, AXIAL_METHOD } from "./desain/soil.js"
import { initUnits, hero, card, footer, nextBtn } from "./pj_ui.js"

const RIG = () => ({ fleksibel_tengah: L("Fleksibel, tengah", "Flexible, centre"), fleksibel_rata: L("Fleksibel, rata-rata", "Flexible, average"), kaku: L("Kaku (×0,93)", "Rigid (×0.93)") })
const SHAPE = () => ({ persegi: L("Persegi/panjang", "Rectangular"), lingkaran: L("Lingkaran", "Circular"), lajur: L("Lajur", "Strip") })

// ---------------------------------------------------------------- daftar kasus (modul Desain + manual)
export async function collectCases(P, lng) {
  const out = []
  try {
    const D = await import("./desain_ui.js")
    const { mods } = D.runAll(lng, { P })
    for (const { m, out: o, error } of mods) {
      if (error || !o || !o.settle) continue
      const sb = o.settle
      out.push({ id: "mod:" + m.id, src: "mod", icon: m.icon, title: m.title(), sub: o.sub, kind: sb.kind, foot: sb.foot, group: sb.group, allowOv: sb.allow, href: "#/desain/" + m.id })
    }
  } catch (e) { console.error(e) }
  ;(P.settle.manual || []).forEach((c, i) => out.push({ id: "man:" + i, src: "man", idx: i, icon: c.kind === "deep" ? "📍" : "🧱", title: c.label || `${L("Kasus manual", "Manual case")} ${i + 1}`, sub: c.kind === "deep" ? L("tiang (manual)", "piles (manual)") : L("dangkal (manual)", "shallow (manual)"), kind: c.kind, man: c }))
  return out
}
// hitung satu kasus memakai kriteria tab ini
export function computeCase(P, ds, c) {
  const o = P.settle
  if (c.kind === "deep") {
    let g = c.group
    if (c.src === "man") {
      const m = c.man, D = m.D / 1000, ax = pileAxial(ds, { D, t: (m.t || 12.7) / 1000, Lp: m.Lp, open: true, method: m.method, kind: m.pk, z0: m.z0 })
      const Ap = m.pk === "bored" ? Math.PI * D * D / 4 : Math.PI / 4 * (D * D - (D - 2 * (m.t || 12.7) / 1000) ** 2)
      g = { D, Lp: m.Lp, n: Math.max(1, Math.round(m.n)), Bg: m.Bg, Lg: m.Lg, Q: m.Q, z0: m.z0, Qb: ax.Qb, Qu: ax.Qc, qb: ax.q, Ap, Ep: m.pk === "bored" ? 4700 * Math.sqrt(30) * 1000 : 2e8, driven: m.pk !== "bored" }
    }
    if (!g) return { error: L("data kelompok tiang tidak tersedia", "pile group data unavailable") }
    const st = settleGroup(ds, g, o)
    const allow = c.src === "mod" && c.allowOv ? c.allowOv : o.allowDeep
    return { kind: "deep", g, st, res: st.raft, layers: st.raftSoil ? st.raftSoil.layers : [], s: st.total * 1000, si: (st.se + st.si) * 1000, sc: st.sc * 1000, allow, error: st.error && !st.raft ? st.error : null }
  }
  const f = c.src === "man" ? { shape: c.man.shape, B: c.man.B, L: c.man.shape === "persegi" ? c.man.L : c.man.B, Df: c.man.Df, q: c.man.q } : c.foot
  if (!f) return { error: L("data pondasi tidak tersedia", "foundation data unavailable") }
  const r = settleShallow(ds, f, o)
  const allow = c.src === "mod" && c.allowOv ? c.allowOv : o.allow
  if (r.error) return { kind: "shallow", foot: f, error: r.error, allow }
  const x = r.res
  return { kind: "shallow", foot: f, res: x, layers: r.soil.layers, s: x.s_life * 1000, si: x.si * 1000, sc: (x.s_life - x.si) * 1000, allow }
}

export function mountPenurunan(box, ctx) {
  lang.cur = ctx.lang
  initUnits()
  const P = projLoad(), o = P.settle
  box.textContent = ""
  const crit = el("div"), listBox = el("div"), detBox = el("div"), manBox = el("div"), expBox = el("div", "dz-expbox dz-in")
  box.append(stepper("penurunan", P), hero(L("Langkah 4 · analisis", "Step 4 · analysis"), L("Penurunan Pondasi — Dangkal & Dalam", "Foundation Settlement — Shallow & Deep"),
    L("Penurunan segera (Steinbrenner, tanah berlapis), konsolidasi primer (Terzaghi, NC/OC) + sekunder, dan total terhadap waktu — untuk pondasi dangkal dan kelompok tiang (pemendekan elastis + rakit ekuivalen). Profil tanah dari tab Tanah; daftar pondasi otomatis dari tab Desain.",
      "Immediate (Steinbrenner, layered soil), primary consolidation (Terzaghi, NC/OC) + secondary, and total over time — for shallow foundations and pile groups (elastic shortening + equivalent raft). Soil profile from the Soil tab; foundation list automatic from the Design tab."),
    ["SNI 8460:2017 §9–10", "Steinbrenner", "Terzaghi", L("Rakit ekuivalen", "Equivalent raft")]), crit, listBox, detBox, manBox, expBox, nextBtn("#/laporan", L("Lanjut: laporan proyek", "Next: project report"), L("gabungan tanah, gempa, desain & penurunan", "soil, seismic, design & settlement combined")), footer())
  let cases = [], results = [], last = null, timer = 0
  const changed = (structural) => { projSave(P); if (structural) { drawCrit(); drawManual() } clearTimeout(timer); timer = setTimeout(recompute, structural ? 0 : 200) }
  function drawCrit() {
    crit.textContent = ""
    const g = el("div", "dz-grid")
    g.append(field({ k: "life", lab: L("Umur rencana", "Design life"), u: L("tahun", "years"), lo: 0.1, hi: 100, obj: o }, o, changed),
      field({ k: "allow", lab: L("Batas penurunan pondasi dangkal", "Shallow foundation limit"), u: "mm", lo: 5, hi: 1000, obj: o }, o, changed),
      field({ k: "allowDeep", lab: L("Batas penurunan pondasi tiang", "Pile foundation limit"), u: "mm", lo: 5, hi: 500, obj: o }, o, changed),
      field({ k: "method", type: "seg", lab: L("Distribusi tegangan Δσ", "Stress distribution Δσ"), opts: { boussinesq: "Boussinesq", "2:1": "2V : 1H" }, obj: o }, o, changed),
      field({ k: "rig", type: "seg", lab: L("Kekakuan pondasi (penurunan segera)", "Foundation rigidity (immediate)"), opts: RIG(), obj: o, wide: true }, o, changed),
      field({ k: "dz", lab: L("Tebal sublapis konsolidasi", "Consolidation sublayer"), u: "m", lo: 0.1, hi: 2, obj: o }, o, changed))
    crit.append(card("s-crit", "⚙️", L("Kriteria & metode (berlaku untuk semua modul Desain)", "Criteria & methods (apply to all Design modules)"), `${nf(o.life, 0)} ${L("th", "yr")} · ${nf(o.allow, 0)} / ${nf(o.allowDeep, 0)} mm`, [g,
      el("p", "dz-note", L("Batas umum: telapak terpisah 25–50 mm, mat/rakit 50–100 mm, tangki timbun 150–300 mm (seragam), tiang 10–25 mm. Batas khusus per modul (isian 'Batas penurunan izin' di modul) diutamakan.", "Typical limits: isolated footings 25–50 mm, mats/rafts 50–100 mm, storage tanks 150–300 mm (uniform), piles 10–25 mm. A module-specific limit (its 'Allowable settlement' field) takes precedence."))]))
  }
  function drawManual() {
    manBox.textContent = ""
    const list = el("div")
    ;(o.manual || []).forEach((c, i) => {
      const g = el("div", "dz-grid pj-man")
      g.append(field({ k: "label", type: "txt", lab: L("Nama", "Name"), obj: c }, c, () => changed(false)))
      if (c.kind === "deep") {
        g.append(field({ k: "pk", type: "seg", lab: L("Tiang", "Pile"), opts: { pipe: L("Pipa", "Pipe"), bored: L("Bor", "Bored") }, obj: c }, c, changed),
          field({ k: "method", type: "seg", lab: L("Metode", "Method"), opts: { api: "α/β", spt: "N-SPT", cpt: "CPT" }, obj: c }, c, changed),
          field({ k: "D", lab: "D", u: "mm", lo: 150, hi: 2000, obj: c }, c, changed), field({ k: "Lp", lab: "Lp", u: "m", lo: 3, hi: 80, obj: c }, c, changed),
          field({ k: "n", lab: L("Jumlah tiang n", "Number of piles n"), u: "", lo: 1, hi: 500, obj: c }, c, changed), field({ k: "z0", lab: L("Kepala tiang z0", "Pile head z0"), u: "m", lo: 0, hi: 10, obj: c }, c, changed),
          field({ k: "Bg", lab: L("Lebar kelompok Bg", "Group width Bg"), u: "m", lo: 0.3, hi: 100, obj: c }, c, changed), field({ k: "Lg", lab: L("Panjang kelompok Lg", "Group length Lg"), u: "m", lo: 0.3, hi: 100, obj: c }, c, changed),
          field({ k: "Q", lab: L("Beban layan tetap Q", "Sustained service load Q"), u: "F", lo: 1, hi: 1e6, obj: c }, c, changed))
      } else {
        g.append(field({ k: "shape", type: "seg", lab: L("Bentuk", "Shape"), opts: SHAPE(), obj: c }, c, changed),
          field({ k: "B", lab: c.shape === "lingkaran" ? L("Diameter", "Diameter") : "B", u: "m", lo: 0.3, hi: 100, obj: c }, c, changed),
          ...(c.shape === "persegi" ? [field({ k: "L", lab: "L", u: "m", lo: 0.3, hi: 200, obj: c }, c, changed)] : []),
          field({ k: "Df", lab: "Df", u: "m", lo: 0, hi: 10, obj: c }, c, changed), field({ k: "q", lab: L("q bruto (tetap)", "Gross q (sustained)"), u: "Q", lo: 1, hi: 2000, obj: c }, c, changed))
      }
      const del = el("button", "dz-x", "✕"); del.type = "button"; del.title = L("Hapus kasus", "Remove case"); del.onclick = () => { o.manual.splice(i, 1); if (o.sel === "man:" + i) o.sel = ""; changed(true) }
      const w = el("div", "pj-manrow"); w.append(el("span", "pj-tag", c.kind === "deep" ? L("DALAM", "DEEP") : L("DANGKAL", "SHALLOW")), g, del)
      list.append(w)
    })
    const bar = el("div", "pj-row")
    const a1 = el("button", "dz-add", L("＋ Kasus dangkal", "＋ Shallow case")); a1.type = "button"
    a1.onclick = () => { o.manual.push({ kind: "shallow", label: L("Telapak manual", "Manual footing"), shape: "persegi", B: 3, L: 3, Df: 1.5, q: 150 }); changed(true) }
    const a2 = el("button", "dz-add", L("＋ Kasus tiang", "＋ Pile case")); a2.type = "button"
    a2.onclick = () => { o.manual.push({ kind: "deep", label: L("Kelompok tiang manual", "Manual pile group"), pk: "pipe", method: "api", D: 406.4, t: 12.7, Lp: 18, n: 9, z0: 1.5, Bg: 3.0, Lg: 3.0, Q: 3000 }); changed(true) }
    bar.append(a1, a2)
    manBox.append(card("s-man", "✍️", L("Kasus manual (pondasi lain)", "Manual cases (other foundations)"), `${(o.manual || []).length}`, [list, bar], (o.manual || []).length > 0))
  }
  async function recompute() {
    const ds = soilDS(P)
    cases = await collectCases(P, ctx.lang)
    results = cases.map((c) => ({ c, r: computeCase(P, ds, c) }))
    if (!results.find((x) => x.c.id === o.sel)) o.sel = results.length ? results[0].c.id : ""
    drawList(); drawDetail()
  }
  function drawList() {
    listBox.textContent = ""
    const grid = el("div", "pj-cases")
    results.forEach(({ c, r }, i) => {
      const a = el("button", "pj-case dz-in" + (c.id === o.sel ? " on" : "")); a.type = "button"; a.style.setProperty("--i", i)
      const top = el("div", "pj-case-top"); top.append(el("span", "pj-case-ic", c.icon), el("b", null, c.title.split(" (")[0]), el("span", "pj-tag" + (c.kind === "deep" ? " deep" : ""), c.kind === "deep" ? L("DALAM", "DEEP") : L("DANGKAL", "SHALLOW")))
      a.append(top)
      if (r.error) a.append(el("small", "pj-err", r.error))
      else {
        const ur = r.s / r.allow
        const v = el("div", "pj-case-v"); v.append(el("b", urClass(ur), `${nf(r.s, 1)} mm`), el("span", null, `/ ${nf(r.allow, 0)} mm`))
        const bar = el("div", "dz-bar"), fill = el("i", urClass(ur)); fill.style.transform = `scaleX(${Math.min(ur, 1.2) / 1.2})`; const mk = el("b"); mk.style.left = `${100 / 1.2}%`; bar.append(fill, mk)
        a.append(v, bar, el("small", null, `si ${nf(r.si, 1)} · sc ${nf(r.sc, 1)} mm`))
      }
      a.onclick = () => { o.sel = c.id; projSave(P); drawList(); drawDetail(); detBox.scrollIntoView({ behavior: "smooth", block: "start" }) }
      grid.append(a)
    })
    if (!results.length) grid.append(el("p", "dz-note", L("Belum ada kasus. Buka tab Desain atau tambah kasus manual.", "No cases yet. Open the Design tab or add a manual case.")))
    listBox.append(card("s-list", "📋", L("Daftar pondasi (otomatis dari Desain + manual)", "Foundation list (automatic from Design + manual)"), `${results.length}`, grid))
  }
  function drawDetail() {
    detBox.textContent = ""
    const it = results.find((x) => x.c.id === o.sel)
    const ds = soilDS(P)
    last = buildOut(P, ds, results, it)
    if (it) {
      const { c, r } = it
      const body = []
      if (r.error) body.push(el("p", "dz-note", r.error))
      else {
        const k = el("div", "pj-kpis")
        const items = r.kind === "deep" ? [[L("Pemendekan elastis se", "Elastic shortening se"), r.st.se * 1000], [L("Segera (rakit) si", "Immediate (raft) si"), r.st.si * 1000], [L("Konsolidasi sc", "Consolidation sc"), r.st.sc * 1000], [L(`Total ${nf(o.life, 0)} th`, `Total ${nf(o.life, 0)} yr`), r.s], [L("Izin", "Allowable"), r.allow], [L("Vesic (pembanding)", "Vesic (comparison)"), r.st.sgV * 1000]]
          : [[L("Segera si", "Immediate si"), r.res.si * 1000], [L("Konsolidasi primer sc", "Primary consolidation sc"), r.res.sc * 1000], [L("Sekunder", "Secondary"), r.res.ss_life * 1000], [L(`Total ${nf(o.life, 0)} th`, `Total ${nf(o.life, 0)} yr`), r.s], [L("Total akhir", "Final total"), r.res.s_final * 1000 + r.res.ss_life * 1000], [L("Izin", "Allowable"), r.allow]]
        items.forEach(([lab, v], i) => { const d = el("div", "pj-kpi dz-in" + (i === 3 ? " hi" : "")); d.style.setProperty("--i", i); d.append(el("span", null, lab), el("b", null, `${nf(v, 1)} mm`)); k.append(d) })
        body.push(k)
        if (r.res) body.push(el("p", "dz-note", `t50 = ${r.res.t50 == null ? "–" : nf(r.res.t50, 2)} · t90 = ${r.res.t90 == null ? "–" : nf(r.res.t90, 2)} ${L("tahun", "years")} · q ${L("bersih", "net")} = ${nf(toDisp("Q", r.res.q_net), 1)} ${uName("Q")}${r.kind === "deep" ? ` · ${L("rakit ekuivalen", "equivalent raft")} ${nf(r.st.Br, 2)} × ${nf(r.st.Lr, 2)} m @ z = ${nf(r.st.zr, 2)} m` : ""}`))
        const figs = el("div", "pj-figs")
        last.drawings.forEach((d) => { if (d.detail) { const f = el("figure", "dz-fig pj-fig"); try { f.append(d.make("screen")) } catch (e) { f.append(el("div", "err", e.message)) } f.append(el("figcaption", "dz-cap", d.cap)); figs.append(f) } })
        body.push(figs)
        last.tables.filter((t) => t.detail).forEach((t) => {
          if (!t.fold) { body.push(tableView(t)); return }
          const d = el("details", "dz-tdet"); const sm = el("summary", null, t.title); sm.append(el("span", "dz-badge", String(t.rows.length))); d.append(sm, tableView({ ...t, title: "" })); body.push(d)
        })
        last.steps.forEach((st) => { const t = tableView({ title: st.h, cols: [L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")], rows: st.rows, align: ["l", "l", "l", "r"] }); t.classList.add("dz-steptbl"); body.push(t) })
        if (c.href) { const a = el("a", "pj-link"); a.href = c.href; a.append(el("span", "pj-link-ic", c.icon), (() => { const x = el("span"); x.append(el("b", null, L("Buka modul desain", "Open design module")), el("small", null, c.sub || "")); return x })(), el("span", "pj-go", "→")); body.push(a) }
      }
      detBox.append(card("s-det", "🔬", `${L("Rincian", "Details")} — ${c.title.split(" (")[0]}`, c.kind === "deep" ? L("TIANG", "PILES") : L("DANGKAL", "SHALLOW"), body))
    }
    exportBar(expBox, () => last, { project: P.info })
    reveal(box)
  }
  drawCrit(); drawManual(); recompute()
}

// ---------------------------------------------------------------- hasil untuk tampilan & ekspor
function buildOut(P, ds, results, it) {
  const o = P.settle, uQ = uName("Q")
  const sum = { title: L("Ringkasan penurunan semua pondasi", "Settlement summary, all foundations"), cols: [L("Pondasi", "Foundation"), L("Tipe", "Type"), "si (mm)", "sc (mm)", `${L("Total", "Total")} ${nf(o.life, 0)} ${L("th", "yr")} (mm)`, L("Izin (mm)", "Allow. (mm)"), "UR", "Status"],
    rows: results.map(({ c, r }) => (r.error ? [c.title, c.kind === "deep" ? L("dalam", "deep") : L("dangkal", "shallow"), "–", "–", "–", "–", "–", r.error] : { cells: [c.title.split(" (")[0], c.kind === "deep" ? L("dalam (tiang)", "deep (piles)") : L("dangkal", "shallow"), r.si, r.sc, r.s, r.allow, r.s / r.allow, r.s <= r.allow ? "OK" : "NOT OK"], cls: r.s <= r.allow ? "" : "bad" })),
    dec: [null, null, 1, 1, 1, 0, 3, null], align: ["l", "l", "r", "r", "r", "r", "r", "l"] }
  const checks = results.filter(({ r }) => !r.error).map(({ c, r }) => ({ grp: L("Penurunan", "Settlement"), item: `${c.title.split(" (")[0]} — ${c.kind === "deep" ? L("kelompok tiang", "pile group") : L("pondasi dangkal", "shallow foundation")}`, ref: c.kind === "deep" ? "SNI 8460 §10 · Tomlinson" : "SNI 8460 §9 · Steinbrenner + Terzaghi", dem: r.s, cap: r.allow, unit: "mm", ur: r.s / r.allow, ok: r.s <= r.allow + 1e-9, d: 1, note: `si ${nf(r.si, 1)} + sc ${nf(r.sc, 1)} mm` }))
  const tables = [sum], drawings = [], steps = []
  if (it && !it.r.error) {
    const { c, r } = it, x = r.res
    if (x) {
      tables.push({ detail: true, title: L("Penurunan segera per lapis (Steinbrenner)", "Immediate settlement per layer (Steinbrenner)"), cols: [L("Lapis", "Layer"), "H (m)", "E (MPa)", "ν", "si (mm)"],
        rows: (x.si_layers || []).map((si, i) => { const ly = (r.layers || [])[i] || {}; return [`${i + 1} · ${ly.name || ""}`, ly.H ?? "", ly.E != null ? ly.E / 1000 : "", ly.nu ?? "", si * 1000] }), dec: [null, 2, 1, 2, 2], align: ["l", "r", "r", "r", "r"] })
      tables.push({ detail: true, title: L("Konsolidasi per lapis lempung (Terzaghi)", "Consolidation per clay layer (Terzaghi)"), cols: [L("Lapis", "Layer"), "H (m)", "Hdr (m)", "cv (m²/th)", "sc (mm)", "t90 (th)"],
        rows: x.cons.map((k) => [k.lapis, k.H, k.Hdr, k.cv, k.sc * 1000, k.t90 == null ? "–" : k.t90]), dec: [null, 2, 2, 2, 1, 2], align: ["l", "r", "r", "r", "r", "r"] })
      tables.push({ detail: true, fold: true, title: L("Sublapis konsolidasi", "Consolidation sublayers"), cols: [L("Lapis", "Layer"), "z (m)", `σ'v0 (${uQ})`, `σ'p (${uQ})`, `Δσ (${uQ})`, "sc (mm)"],
        rows: x.subs.map((k) => [k.lapis, k.z_tengah, toDisp("Q", k.s0), toDisp("Q", k.sp), toDisp("Q", k.ds), k.sc * 1000]), dec: [null, 2, 1, 1, 1, 2], align: ["l", "r", "r", "r", "r", "r"] })
      drawings.push({ detail: true, make: (m) => { const Pp = palette(m); return lineChart(Pp, { title: L("Penurunan vs waktu", "Settlement vs time"), xLog: true, xLab: L("waktu (tahun, log)", "time (years, log)"), yLab: "s (mm)", yDown: true, yMin: 0,
        series: [{ c: Pp.acc, w: 3, pts: x.curve.map(([t, s]) => [t, (s + (r.kind === "deep" ? r.st.se : 0)) * 1000]), fill: true }], hlines: [{ y: r.allow, label: `${L("izin", "allow.")} ${nf(r.allow, 0)} mm`, c: Pp.bad }], vlines: [{ x: o.life, label: `${nf(o.life, 0)} ${L("th", "yr")}` }] }) }, cap: L("Kurva penurunan terhadap waktu (segera + konsolidasi + sekunder)", "Settlement–time curve (immediate + consolidation + secondary)"), maxH: 300 })
      drawings.push({ detail: true, make: (m) => { const Pp = palette(m); return lineChart(Pp, { title: L("Tegangan di bawah pusat pondasi", "Stress below foundation centre"), xLab: uQ, yLab: L("kedalaman di bawah dasar (m)", "depth below base (m)"), yDown: true, legendRight: true,
        series: [{ name: "Δσ", c: Pp.bad, w: 3, pts: x.stress.map(([z, d]) => [toDisp("Q", d), z]) }, { name: "σ'v0", c: Pp.steel, dash: "6 4", pts: x.stress.map(([z, , s0]) => [toDisp("Q", s0), z]) }, { name: "0,1σ'v0", c: Pp.mut, dash: "2 4", w: 1.6, pts: x.stress.map(([z, , s0]) => [toDisp("Q", 0.1 * s0), z]) }] }) }, cap: L("Distribusi Δσ dan σ'v0 di bawah pusat (kedalaman pengaruh: Δσ ≈ 0,1σ'v0)", "Δσ and σ'v0 below the centre (influence depth: Δσ ≈ 0.1σ'v0)"), maxH: 300 })
    }
    drawings.push({ detail: true, make: (m) => sectionDraw(ds, it, palette(m)), cap: L("Potongan pondasi & profil tanah (tab Tanah)", "Foundation section & soil profile (Soil tab)"), maxH: 300 })
    if (r.kind === "deep") steps.push({ h: L("Penurunan kelompok tiang", "Pile group settlement"), rows: [
      [L("Beban per tiang", "Load per pile"), "Q/n", `${nf(r.g.Q, 1)} / ${r.g.n}`, `${nf(r.st.Qpile, 1)} kN`],
      [L("Bagian ujung / selimut", "Tip / shaft share"), "Qp = Q·Qb/Qu ; Qs = Q − Qp", `Qb/Qu = ${nf(r.st.ratioB, 3)}`, `${nf(r.st.Qp, 1)} / ${nf(r.st.Qs, 1)} kN`],
      [L("Pemendekan elastis", "Elastic shortening"), "se = (Qp + 0,5·Qs)·L/(Ap·Ep)", `L ${nf(r.g.Lp, 2)} m, Ap·Ep ${nf(r.g.Ap * r.g.Ep / 1000, 0)} MN`, `${nf(r.st.se * 1000, 2)} mm`],
      [L("Rakit ekuivalen", "Equivalent raft"), r.st.endB ? L("di ujung tiang (dukung ujung)", "at pile tip (end bearing)") : "z = z0 + 2L/3 ; B' = Bg + 2·(2L/3)/4", `Bg × Lg = ${nf(r.g.Bg, 2)} × ${nf(r.g.Lg, 2)} m`, `${nf(r.st.Br, 2)} × ${nf(r.st.Lr, 2)} m @ ${nf(r.st.zr, 2)} m`],
      [L("Tekanan bersih rakit", "Raft net pressure"), "q = Q/(B'·L')", "", `${nf(toDisp("Q", r.st.qnet), 1)} ${uQ}`],
      [L("Penurunan rakit", "Raft settlement"), "si (Steinbrenner) + sc (Terzaghi)", r.res ? `si ${nf(r.res.si * 1000, 1)} + sc ${nf(r.res.sc * 1000, 1)}` : "", r.res ? `${nf(r.res.s_life * 1000, 1)} mm` : "–"],
      [L("Total", "Total"), "s = se + s,rakit", "", `${nf(r.s, 1)} mm`],
      [L("Pembanding Vesic", "Vesic comparison"), "s1 = se + Cp·Qp/(D·qp) + Qs/(pL)·D/Es·(1 − ν²)·Iws ; sg = s1·√(Bg/D)", `s1 ${nf(r.st.s1 * 1000, 2)} mm`, `${nf(r.st.sgV * 1000, 1)} mm`]] })
    else steps.push({ h: L("Penurunan pondasi dangkal", "Shallow foundation settlement"), rows: [
      [L("Pondasi", "Foundation"), SHAPE()[r.foot.shape], `B ${nf(r.foot.B, 2)}${r.foot.shape === "persegi" ? ` × L ${nf(r.foot.L, 2)}` : ""} m, Df ${nf(r.foot.Df, 2)} m`, ""],
      [L("Tekanan bersih", "Net pressure"), "q = q bruto − σv0(Df)", `${nf(toDisp("Q", x.q_gross), 1)} − ${nf(toDisp("Q", x.overburden), 1)}`, `${nf(toDisp("Q", x.q_net), 1)} ${uQ}`],
      [L("Penurunan segera", "Immediate settlement"), "si = Σ q·B'·(1 − ν²)/E·(Is,bawah − Is,atas)·4·Fr", `${RIG()[o.rig]}`, `${nf(x.si * 1000, 1)} mm`],
      [L("Konsolidasi primer", "Primary consolidation"), "sc = Σ H/(1 + e0)·[Cs·log(σ'p/σ'0) + Cc·log((σ'0 + Δσ)/σ'p)]", `Δσ ${o.method === "2:1" ? "2V:1H" : "Boussinesq"}`, `${nf(x.sc * 1000, 1)} mm`],
      [L("Derajat konsolidasi", "Degree of consolidation"), "Tv = cv·t/Hdr² → U(Tv)", `t = ${nf(o.life, 1)} ${L("th", "yr")}`, `t90 = ${x.t90 == null ? "–" : nf(x.t90, 2)} ${L("th", "yr")}`],
      [L("Sekunder", "Secondary"), "ss = Cα/(1 + e0)·H·log(t/tp)", "", `${nf(x.ss_life * 1000, 1)} mm`],
      [L("Total pada umur rencana", "Total at design life"), "s = si + U·sc + ss", "", `${nf(r.s, 1)} mm`]] })
  }
  const worst = results.filter((x) => !x.r.error).reduce((a, b) => (!a || b.r.s / b.r.allow > a.r.s / a.r.allow ? b : a), null)
  return {
    file: "Penurunan_Pondasi", suite: L("PENURUNAN PONDASI", "FOUNDATION SETTLEMENT"), title: L("Penurunan Pondasi — Dangkal & Dalam", "Foundation Settlement — Shallow & Deep"), sub: `${results.length} ${L("pondasi", "foundations")} · ${L("umur", "life")} ${nf(o.life, 0)} ${L("th", "yr")} · ${o.method === "2:1" ? "2V:1H" : "Boussinesq"} · ${P.soil.name}`,
    refs: "SNI 8460:2017 §9–10 · Steinbrenner (1934) · Terzaghi · Das · Tomlinson · Vesic (1977)",
    metrics: [{ lab: L("Jumlah pondasi", "Foundations"), val: String(results.length) }, { lab: L("Penurunan terbesar", "Largest settlement"), val: worst ? worst.r.s : 0, d: 1, unit: "mm" }, { lab: L("Pondasi penentu", "Governing"), val: worst ? worst.c.title.split(" (")[0] : "–" }, { lab: L("Umur rencana", "Design life"), val: o.life, d: 0, unit: L("th", "yr") }],
    checks, kv: [{ title: L("Kriteria", "Criteria"), rows: [[L("Umur rencana", "Design life"), o.life, L("tahun", "years"), 0], [L("Batas dangkal / tiang", "Limit shallow / pile"), `${nf(o.allow, 0)} / ${nf(o.allowDeep, 0)} mm`], ["Δσ", o.method === "2:1" ? "2V:1H" : "Boussinesq"], [L("Kekakuan", "Rigidity"), RIG()[o.rig]], [L("Sublapis", "Sublayer"), o.dz, "m", 2]] }],
    tables, drawings, steps, combos: [], cases: {},
    notes: [L("Parameter tanah (E, ν, e0, Cc, Cs, OCR, cv, Cα) dari tab Tanah (korelasi atau nilai manual). Tegangan awal memakai γ dan muka air tanah dari profil yang sama.", "Soil parameters (E, ν, e0, Cc, Cs, OCR, cv, Cα) from the Soil tab (correlated or manual). Initial stresses use γ and groundwater of the same profile."),
      L("Kelompok tiang: rakit ekuivalen (Terzaghi–Peck/Tomlinson) pada 2L/3 dengan sebaran 1H:4V untuk tiang gesek atau di ujung tiang untuk tiang dukung ujung; ditambah pemendekan elastis tiang. Vesic ditampilkan sebagai pembanding.", "Pile groups: equivalent raft (Terzaghi–Peck/Tomlinson) at 2L/3 with 1H:4V spread for friction piles or at the pile tip for end-bearing piles; plus pile elastic shortening. Vesic shown for comparison.")],
  }
}
function sectionDraw(ds, it, P) {
  const { c, r } = it, W = 760, H = 420, s = root(W, H, P, L("Potongan pondasi", "Foundation section"))
  const deep = r.kind === "deep", B = deep ? r.g.Bg : r.foot.B, Df = deep ? r.g.z0 : r.foot.Df
  const zr = deep ? (r.st.zr + Math.max(r.st.Br, 2) * 1.5) : Df + Math.max(B, 1) * 2.5, depth = Math.min(Math.max(zr, deep ? r.g.z0 + r.g.Lp + 3 : 6), ds.depth + 5)
  const top = 50, ky = (H - top - 26) / depth, kx = deep ? (W - 380) / Math.max(r.st.Br, B * 1.3, 1) : Math.min((W - 300) / Math.max(B * 1.6, 1), ky * 2), cx = 330, Y = (z) => top + z * ky, X = (x) => cx + x * kx
  T(s, 16, 28, `${c.title.split(" (")[0]} — ${deep ? L("kelompok tiang & rakit ekuivalen", "pile group & equivalent raft") : L("pondasi dangkal", "shallow foundation")}`, { c: P.ink, fs: 14, b: true })
  for (const l of ds.layers) { if (l.z0 > depth) break; Rect(s, 16, Y(l.z0), W - 32, (Math.min(l.z1, depth) - l.z0) * ky, l.coh ? P.clay : P.sand, null, { op: 0.45 }); T(s, W - 22, Y(l.z0) + 15, `${typeName(l.type)} · ${l.coh ? "cu " + nf(l.cu, 0) + " · Cc " + nf(l.Cc, 2) : "φ " + nf(l.phi, 0) + "°"} · E ${nf(l.E / 1000, 1)} MPa`, { c: P.ink, fs: 10.5, a: "end" }) }
  if (ds.gwt < depth) { s.append(sv2("line", { x1: 16, x2: W - 16, y1: Y(ds.gwt), y2: Y(ds.gwt), stroke: P.water, "stroke-width": 2, "stroke-dasharray": "8 5" })); T(s, 22, Y(ds.gwt) - 5, `▽ MAT ${nf(ds.gwt, 1)} m`, { c: P.water, fs: 11 }) }
  s.append(sv2("line", { x1: 16, x2: W - 16, y1: Y(0), y2: Y(0), stroke: P.ink, "stroke-width": 2 }))
  if (deep) {
    Rect(s, X(-B / 2), Y(Df - 0.8), B * kx, 0.8 * ky, P.conc, P.ink, { sw: 2 })
    const n = Math.min(Math.round(Math.sqrt(r.g.n)), 8), w = Math.max(r.g.D * kx, 4)
    for (let i = 0; i < n; i++) { const x = -B / 2 + r.g.D / 2 + (B - r.g.D) * (n > 1 ? i / (n - 1) : 0.5); Rect(s, X(x) - w / 2, Y(Df), w, r.g.Lp * ky, P.steel, P.ink, { sw: 1, cls: "dz-grow" }) }
    const Br = r.st.Br
    s.append(sv2("path", { d: `M${X(-B / 2)},${Y(Df)} L${X(-Br / 2)},${Y(r.st.zr)} L${X(Br / 2)},${Y(r.st.zr)} L${X(B / 2)},${Y(Df)}`, fill: "none", stroke: P.acc, "stroke-width": 1.6, "stroke-dasharray": "6 4" }))
    Rect(s, X(-Br / 2), Y(r.st.zr) - 4, Br * kx, 8, P.acc, null, { op: 0.85 })
    T(s, X(Br / 2) + 10, Y(r.st.zr) + 4, `${L("rakit ekuivalen", "equivalent raft")} ${nf(Br, 2)} m @ ${nf(r.st.zr, 2)} m`, { c: P.acc, fs: 11.5, b: true })
  } else {
    Rect(s, X(-B / 2), Y(Df - Math.min(0.6, Df || 0.6)), B * kx, Math.min(0.6, Df || 0.6) * ky, P.conc, P.ink, { sw: 2 })
    // bola tegangan 2:1
    s.append(sv2("path", { d: `M${X(-B / 2)},${Y(Df)} L${X(-B / 2 - (depth - Df) / 2)},${Y(depth)} M${X(B / 2)},${Y(Df)} L${X(B / 2 + (depth - Df) / 2)},${Y(depth)}`, stroke: P.acc, "stroke-width": 1.4, "stroke-dasharray": "6 4" }))
    T(s, X(B / 2) + 10, Y(Df) + 16, `B ${nf(B, 2)} m · Df ${nf(Df, 2)} m · q ${nf(toDisp("Q", r.foot.q), 0)} ${uName("Q")}`, { c: P.ink, fs: 11.5, b: true })
  }
  T(s, 16, H - 8, `${L("Total", "Total")} ${nf(r.s, 1)} mm ${L("dari izin", "of allowable")} ${nf(r.allow, 0)} mm`, { c: r.s <= r.allow ? P.ok : P.bad, fs: 12, b: true })
  return s
}
const sv2 = (tag, a) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in a) e.setAttribute(k, a[k]); return e }

// laporan semua pondasi (tab Laporan)
export async function settleReport(P, lng) {
  const ds = soilDS(P), cases = await collectCases(P, lng)
  const results = cases.map((c) => ({ c, r: computeCase(P, ds, c) }))
  return { out: buildOut(P, ds, results, null), results }
}
// ringkasan untuk beranda
export async function settleSummary(lng) {
  const P = projLoad(), ds = soilDS(P), cases = await collectCases(P, lng)
  const res = cases.map((c) => ({ c, r: computeCase(P, ds, c) })).filter((x) => !x.r.error)
  const worst = res.reduce((a, b) => (!a || b.r.s / b.r.allow > a.r.s / a.r.allow ? b : a), null)
  return { n: res.length, nBad: res.filter((x) => x.r.s > x.r.allow).length, worst: worst ? { title: worst.c.title, s: worst.r.s, allow: worst.r.allow, kind: worst.r.kind } : null }
}
