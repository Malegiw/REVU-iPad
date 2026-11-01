// Kerangka antarmuka modul Desain: penyimpanan, formulir berbasis skema (dengan konversi satuan kN ↔ tf), editor beban pengguna & lapisan,
// editor kombinasi beban, tampilan hasil (status, metrik hitung-naik, batang rasio beranimasi, tabel), dan ekspor Excel/PDF dengan hak cipta.
import { L, lang, units, UNITS, uName, uFac, nf, toDisp, COMBOS, comboName, comboFormula, LOAD_KEYS, copyright, stamp, AUTHOR, govern, seismicParams, SITES } from "./core.js"
import { buildXlsx, ST } from "./xlsx.js"
import { reportPdf } from "./pdf.js"

export const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const svgNS = "http://www.w3.org/2000/svg"
export const sv = (tag, attrs, txt) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e }
const parseNum = (s) => { const v = parseFloat(String(s).trim().replace(",", ".")); return isFinite(v) ? v : NaN }
const fmtIn = (v) => (isFinite(v) ? String(+(+v).toPrecision(6)) : "")
export const isConv = (k) => !!UNITS.si[k]
export const uLab = (k) => (isConv(k) ? uName(k) : k)

// ---------------------------------------------------------------- penyimpanan
const KEY = "ymd.desain.v1"
export function loadState(defaults) {
  let s = null
  try { s = JSON.parse(localStorage.getItem(KEY) || "null") } catch (e) { s = null }
  const d = defaults()
  if (!s || typeof s !== "object") return d
  const out = { ...d, ...s, project: { ...d.project, ...(s.project || {}) }, site: { ...d.site, ...(s.site || {}) }, m: { ...d.m }, cmb: { ...d.cmb, ...(s.cmb || {}) } }
  for (const k of Object.keys(d.m)) out.m[k] = { ...d.m[k], ...((s.m || {})[k] || {}) }
  return out
}
export const saveState = (S) => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* tanpa penyimpanan */ } }

// ---------------------------------------------------------------- data lokasi → parameter angin & gempa
export function siteCtx(site) {
  const sp = seismicParams(site.Ss, site.S1, site.cls)
  return { wind: { V: site.V, exp: site.exp, Kzt: site.Kzt, Kd: site.Kd, G: 0.85 }, sp, seisBase: { SDS: sp.SDS, SD1: sp.SD1, S1: site.S1, TL: site.TL } }
}

// ---------------------------------------------------------------- formulir
// Field: { k, lab, u (satuan/kind), lo, hi, help, type: num|seg|sel|chk|txt|list|layers|loads, opts, show(s), struct, w }
export function renderForm(box, sections, st, onChange) {
  box.textContent = ""
  const refresh = []
  box.__refresh = () => refresh.forEach((f) => f())
  sections.forEach((sec, si) => {
    const d = el("details", "dz-sec dz-in"); d.style.setProperty("--i", si)
    d.open = sec.open !== false && (st.__open ? st.__open[sec.id] !== false : true)
    d.addEventListener("toggle", () => { st.__open = st.__open || {}; st.__open[sec.id] = d.open })
    const sm = el("summary"); sm.append(el("span", "dz-ico", sec.icon || "•"), el("span", "dz-st", sec.t))
    if (sec.badge) sm.append(el("span", "dz-badge", sec.badge))
    d.append(sm)
    if (sec.note) { const p = el("p", "dz-note"); p.innerHTML = sec.note; d.append(p) }
    if (sec.sketch) {
      const sk = el("figure", "dz-sketch")
      const draw = () => { sk.textContent = ""; try { sk.append(sec.sketch(st)) } catch (e) { console.error(e) } }
      draw(); refresh.push(draw); d.append(sk)
    }
    let g = el("div", "dz-grid")
    for (const f of sec.fields) {
      if (f.show && !f.show(st)) continue
      if (f.type === "layers" || f.type === "loads" || f.type === "custom") { if (g.childNodes.length) { d.append(g); g = el("div", "dz-grid") } d.append(f.render(st, onChange)); continue }
      if (f.type === "hr") { if (g.childNodes.length) d.append(g); g = el("div", "dz-grid"); d.append(el("div", "dz-sub", f.lab)); continue }
      g.append(field(f, st, onChange))
    }
    if (g.childNodes.length) d.append(g)
    box.append(d)
  })
}
export function field(f, st, onChange) {
  const obj = f.obj || st
  const t = f.type || "num"
  const w = el(t === "chk" ? "label" : "div", "dz-f" + (t === "seg" ? " isseg" : "") + (f.wide ? " wide" : ""))
  if (t === "chk") {
    const c = el("input"); c.type = "checkbox"; c.checked = !!obj[f.k]
    c.onchange = () => { obj[f.k] = c.checked; onChange(true) }
    w.classList.add("chk"); w.append(c, el("span", "lb", f.lab)); if (f.help) w.title = f.help
    return w
  }
  const lb = el("span", "lb", f.lab); w.append(lb)
  if (t === "seg") {
    const g = el("div", "dz-seg")
    Object.entries(f.opts).forEach(([k, v]) => {
      const b = el("button", "dz-segb" + (String(obj[f.k]) === k ? " on" : ""), v); b.type = "button"
      b.onclick = () => { obj[f.k] = typeof obj[f.k] === "number" ? Number(k) : k; if (f.on) f.on(st, k); onChange(true) }
      g.append(b)
    })
    w.append(g)
  } else if (t === "sel") {
    const s = el("select")
    Object.entries(f.opts).forEach(([k, v]) => { const o = el("option", null, v); o.value = k; if (String(obj[f.k]) === k) o.selected = true; s.append(o) })
    s.onchange = () => { obj[f.k] = typeof obj[f.k] === "number" ? Number(s.value) : s.value; if (f.on) f.on(st, s.value); onChange(true) }
    w.append(s)
  } else if (t === "txt" || t === "list") {
    const i = el("input"); i.type = "text"; i.value = t === "list" ? (obj[f.k] || []).join(", ") : obj[f.k] ?? ""
    i.oninput = () => {
      if (t === "list") { const arr = i.value.split(/[;,\s]+/).map(parseNum).filter((x) => x > 0); i.classList.toggle("bad", !arr.length); if (arr.length) { obj[f.k] = arr; onChange(false) } }
      else { obj[f.k] = i.value; onChange(false) }
    }
    w.append(i)
  } else {
    const kind = f.u || "", fac = isConv(kind) ? uFac(kind) : 1
    const row = el("div", "dz-in-row")
    const i = el("input"); i.type = "text"; i.inputMode = (f.lo ?? 0) < 0 ? "text" : "decimal"; i.autocomplete = "off"
    i.value = fmtIn(obj[f.k] / fac)
    const lo = (f.lo ?? 0) / fac, hi = (f.hi ?? 1e9) / fac
    i.addEventListener("input", () => { const v = parseNum(i.value), ok = !isNaN(v) && v >= lo && v <= hi; i.classList.toggle("bad", !ok); if (ok) { obj[f.k] = v * fac; onChange(false) } })
    i.addEventListener("change", () => { let v = parseNum(i.value); if (isNaN(v)) v = obj[f.k] / fac; v = Math.min(hi, Math.max(lo, v)); i.value = fmtIn(v); i.classList.remove("bad"); obj[f.k] = v * fac; onChange(!!f.struct) })
    row.append(i)
    if (kind) row.append(el("span", "dz-unit", uLab(kind)))
    w.append(row)
  }
  if (f.help) w.append(el("span", "hp", f.help))
  return w
}

// Editor lapisan tanah (tiang): kolom tebal, jenis, γ, cu, φ, nh
export function layersEditor(st, key, onChange) {
  const box = el("div", "dz-tbl-wrap")
  const draw = () => {
    box.textContent = ""
    const tb = el("table", "dz-edit")
    const hd = el("tr"); [L("Lapis", "Layer"), L("Tebal (m)", "Thickness (m)"), L("Jenis", "Type"), `γ (${uLab("G")})`, `cu (${uLab("Q")})`, "φ (°)", `nh (${uLab("G")}, 0 = auto)`, ""].forEach((h) => hd.append(el("th", null, h)))
    tb.append(hd)
    let z = 0
    st[key].forEach((ly, i) => {
      const tr = el("tr")
      tr.append(el("td", "dz-zz", `${nf(z, 1)}–${nf(z + ly.h, 1)} m`)); z += ly.h
      const num = (k, kind, lo, hi, dis) => { const td = el("td"); const inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; const fac = isConv(kind) ? uFac(kind) : 1; inp.value = fmtIn(ly[k] / fac); inp.disabled = !!dis
        inp.oninput = () => { const v = parseNum(inp.value); const ok = !isNaN(v) && v >= lo / fac && v <= hi / fac; inp.classList.toggle("bad", !ok); if (ok) { ly[k] = v * fac; onChange(false) } }
        inp.onchange = () => { draw(); onChange(false) }
        td.append(inp); return td }
      tr.append(num("h", "m", 0.2, 60))
      const tdT = el("td"), sel = el("select")
      ;[["clay", L("Lempung (cu)", "Clay (cu)")], ["sand", L("Pasir (φ)", "Sand (φ)")]].forEach(([k, v]) => { const o = el("option", null, v); o.value = k; if (ly.type === k) o.selected = true; sel.append(o) })
      sel.onchange = () => { ly.type = sel.value; draw(); onChange(false) }
      tdT.append(sel); tr.append(tdT)
      tr.append(num("g", "G", 12, 23), num("cu", "Q", 0, 1000, ly.type !== "clay"), num("phi", "°", 0, 45, ly.type !== "sand"), num("nh", "G", 0, 1e5, ly.type !== "sand"))
      const del = el("button", "dz-x", "✕"); del.type = "button"; del.title = L("Hapus lapis", "Remove layer"); del.disabled = st[key].length <= 1
      del.onclick = () => { st[key].splice(i, 1); draw(); onChange(false) }
      const td = el("td"); td.append(del); tr.append(td)
      tb.append(tr)
    })
    box.append(tb)
    const add = el("button", "dz-add", L("＋ Tambah lapis", "＋ Add layer")); add.type = "button"; add.disabled = st[key].length >= 10
    add.onclick = () => { const last = st[key][st[key].length - 1]; st[key].push({ ...last }); draw(); onChange(false) }
    box.append(add)
  }
  draw()
  return box
}

// Editor beban pengguna: baris {k, ped, P, Vx, Vy, Mx, My} di puncak pedestal / pile cap
export const LOAD_LABEL = () => ({ D: L("D — mati (struktur/peralatan kosong)", "D — dead (structure/empty equipment)"), Do: L("Do — isi operasi", "Do — operating contents"), Dt: L("Dt — isi uji hidrostatik", "Dt — hydrotest contents"),
  L: L("L — hidup/platform", "L — live/platform"), T: L("T — termal/gesek pipa", "T — thermal/pipe friction"), Wx: L("Wx — angin arah X", "Wx — wind X"), Wy: L("Wy — angin arah Y", "Wy — wind Y"),
  Ex: L("Ex — gempa arah X", "Ex — seismic X"), Ey: L("Ey — gempa arah Y", "Ey — seismic Y") })
export function loadsEditor(st, key, peds, onChange, opts = {}) {
  const box = el("div", "dz-tbl-wrap")
  const draw = () => {
    box.textContent = ""
    const tb = el("table", "dz-edit")
    const hd = el("tr")
    const cols = [L("Kasus", "Case"), ...(peds.length > 1 ? [L("Titik", "Point")] : []), `P (${uLab("F")})`, `Vx (${uLab("F")})`, `Vy (${uLab("F")})`, `Mx (${uLab("M")})`, `My (${uLab("M")})`, ""]
    cols.forEach((h) => hd.append(el("th", null, h))); tb.append(hd)
    st[key].forEach((r, i) => {
      const tr = el("tr")
      const tdK = el("td"), sel = el("select")
      Object.entries(LOAD_LABEL()).forEach(([k, v]) => { const o = el("option", null, v); o.value = k; if (r.k === k) o.selected = true; sel.append(o) })
      sel.onchange = () => { r.k = sel.value; onChange(false) }
      tdK.append(sel); tr.append(tdK)
      if (peds.length > 1) { const td = el("td"), s2 = el("select"); peds.forEach((p, j) => { const o = el("option", null, p); o.value = j; if ((r.ped || 0) === j) o.selected = true; s2.append(o) }); s2.onchange = () => { r.ped = Number(s2.value); onChange(false) }; td.append(s2); tr.append(td) }
      for (const [k, kind] of [["P", "F"], ["Vx", "F"], ["Vy", "F"], ["Mx", "M"], ["My", "M"]]) {
        const td = el("td"), inp = el("input"); inp.type = "text"; inp.inputMode = "text"; inp.value = fmtIn((r[k] || 0) / uFac(kind))
        inp.oninput = () => { const v = parseNum(inp.value); inp.classList.toggle("bad", isNaN(v)); if (!isNaN(v)) { r[k] = v * uFac(kind); onChange(false) } }
        td.append(inp); tr.append(td)
      }
      const del = el("button", "dz-x", "✕"); del.type = "button"; del.onclick = () => { st[key].splice(i, 1); draw(); onChange(false) }
      const td = el("td"); td.append(del); tr.append(td)
      tb.append(tr)
    })
    box.append(tb)
    const add = el("button", "dz-add", L("＋ Tambah beban", "＋ Add load")); add.type = "button"
    add.onclick = () => { st[key].push({ k: opts.defKey || "L", ped: 0, P: 0, Vx: 0, Vy: 0, Mx: 0, My: 0 }); draw(); onChange(false) }
    box.append(add)
    if (opts.note) box.append(el("p", "dz-note", opts.note))
  }
  draw()
  return box
}
// tambahkan beban pengguna ke kasus (vektor per pedestal [P, Vx, Vy, Mx, My])
export function addUserLoads(cases, rows, nPed) {
  for (const r of rows || []) {
    const k = r.k, j = Math.min(r.ped || 0, nPed - 1)
    if (!cases[k]) cases[k] = new Array(5 * nPed).fill(0)
    const v = [r.P || 0, r.Vx || 0, r.Vy || 0, r.Mx || 0, r.My || 0]
    v.forEach((x, q) => { cases[k][5 * j + q] += x })
  }
  for (const k of ["Wx", "Wy", "Ex", "Ey"]) if (!cases[k]) cases[k] = new Array(5 * nPed).fill(0)
  return cases
}

// ---------------------------------------------------------------- kombinasi beban
export function comboEditor(box, cmb, cases, out, onChange, opts = {}) {
  box.textContent = ""
  const cnt = { ASD: 0, LRFD: 0 }; out.forEach((c) => cnt[c.kind]++)
  const head = el("div", "dz-cmb-head")
  head.append(el("div", "dz-pill ok", `${out.length} ${L("kombinasi aktif", "active combinations")}`), el("div", "dz-pill", `ASD ${cnt.ASD}`), el("div", "dz-pill", `LRFD ${cnt.LRFD}`))
  box.append(head)
  const g = el("div", "dz-grid")
  g.append(field({ k: "ortho", type: "chk", lab: L("Gempa ortogonal 100%–30% (SNI 1726 §7.5.3)", "Orthogonal seismic 100%–30% (SNI 1726 §7.5.3)") }, cmb, onChange))
  g.append(field({ k: "wp", lab: L("Fraksi angin saat uji (Wp/W)", "Wind fraction during test (Wp/W)"), u: "", lo: 0, hi: 1, help: L("PIP STC01015: angin parsial selama uji hidrostatik.", "PIP STC01015: partial wind during hydrotest.") }, cmb, onChange))
  box.append(g)
  const tw = el("div", "dz-tw"), tb = el("table", "dz-cmb")
  const hd = el("tr"); [L("Aktif", "On"), L("Kode", "Code"), L("Kombinasi", "Combination"), L("Faktor (dapat diubah)", "Factors (editable)"), L("Acuan", "Ref."), L("Varian", "Variants")].forEach((h) => hd.append(el("th", null, h)))
  tb.append(hd)
  const has = (k) => (k === "W" || k === "Wp" ? ["Wx", "Wy"] : k === "E" ? ["Ex", "Ey"] : k === "Dyn" ? ["Dyn1", "Dyn2"] : [k]).some((q) => cases[q] && cases[q].some((x) => Math.abs(x) > 1e-12))
  for (const tpl of COMBOS) {
    if (opts.hide && opts.hide.includes(tpl.id)) continue
    const relevant = tpl.need.every(has)
    const tr = el("tr", relevant ? "" : "dim")
    const td0 = el("td"), c = el("input"); c.type = "checkbox"; c.checked = cmb.en[tpl.id] !== false
    c.onchange = () => { cmb.en[tpl.id] = c.checked; onChange(true) }
    td0.append(c); tr.append(td0)
    tr.append(el("td", "dz-code", tpl.id), el("td", null, comboName(tpl)))
    const tdF = el("td", "dz-fac")
    const f = { ...tpl.f, ...(cmb.fx[tpl.id] || {}) }
    for (const k of LOAD_KEYS) {
      if (!(k in tpl.f)) continue
      const lab = el("label", "dz-fi"), inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.value = fmtIn(f[k])
      inp.onchange = () => { const v = parseNum(inp.value); if (!isNaN(v) && v >= 0 && v <= 3) { cmb.fx[tpl.id] = { ...(cmb.fx[tpl.id] || {}), [k]: v }; onChange(true) } else inp.value = fmtIn(f[k]) }
      lab.append(inp, el("span", null, k)); tdF.append(lab)
    }
    if (tpl.ev) tdF.append(el("span", "dz-ev", `${tpl.ev > 0 ? "+" : "−"}${nf(Math.abs(tpl.ev), 3)}SDS·D`))
    tr.append(tdF, el("td", "dz-ref", tpl.ref), el("td", "dz-n", String(out.filter((o) => o.base === tpl.id).length)))
    tb.append(tr)
  }
  tw.append(tb); box.append(tw)
  const rs = el("button", "dz-add", L("↺ Kembalikan faktor bawaan", "↺ Reset default factors")); rs.type = "button"
  rs.onclick = () => { cmb.en = {}; cmb.fx = {}; onChange(true) }
  box.append(rs)
}

// ---------------------------------------------------------------- tampilan hasil
const prevUR = new Map(), prevVal = new Map()
export function urClass(ur) { return !isFinite(ur) || ur > 1.0001 ? "ubad" : ur > 0.9 ? "uwarn" : "uok" }
export function fmtCheck(c) {
  const conv = isConv(c.unit)
  const v = (x) => (typeof x === "number" ? nf(conv ? toDisp(c.unit, x) : x, c.d) : String(x))
  const unit = conv ? uName(c.unit) : c.unit
  return { dem: c.mode === "bool" ? (c.ok ? "✓" : "✗") : v(c.dem), cap: c.mode === "bool" ? "" : v(c.cap), unit, urTxt: c.info ? "–" : isFinite(c.ur) ? nf(c.ur, 3) : "∞" }
}
export function checksView(checks, key, onlyBad) {
  const box = el("div", "dz-checks")
  const groups = []
  for (const c of checks) { let g = groups.find((x) => x.n === c.grp); if (!g) groups.push(g = { n: c.grp, items: [] }); g.items.push(c) }
  groups.forEach((g, gi) => {
    const items = onlyBad ? g.items.filter((c) => !c.ok && !c.info) : g.items
    if (!items.length) return
    const card = el("div", "dz-cgrp dz-in"); card.style.setProperty("--i", gi)
    const bad = g.items.filter((c) => !c.ok && !c.info).length
    const h = el("div", "dz-cgh"); h.append(el("b", null, g.n), el("span", "dz-pill " + (bad ? "bad" : "ok"), bad ? `${bad} ${L("tidak OK", "not OK")}` : L("semua OK", "all OK")))
    card.append(h)
    items.forEach((c, i) => {
      const f = fmtCheck(c), id = `${key}|${c.grp}|${c.item}`
      const row = el("div", "dz-chk " + (c.info ? "info" : c.ok ? "ok" : "bad"))
      const top = el("div", "dz-chk-top")
      top.append(el("span", "dz-dot"), el("span", "dz-item", c.item))
      const st = el("span", "dz-stat " + (c.info ? "info" : c.ok ? "ok" : "bad"), c.info ? "INFO" : c.ok ? "OK" : "NOT OK")
      top.append(st)
      const meta = el("div", "dz-chk-meta")
      meta.append(el("span", "dz-num", c.mode === "bool" ? f.dem : `${f.dem} / ${f.cap} ${f.unit}`))
      if (!c.info) meta.append(el("span", "dz-ur " + urClass(c.ur), `UR ${f.urTxt}`))
      if (c.note) meta.append(el("span", "dz-tag", c.note))
      if (c.ref) meta.append(el("span", "dz-ref", c.ref))
      row.append(top, meta)
      if (!c.info) {
        const bar = el("div", "dz-bar"), fill = el("i", urClass(c.ur)), mark = el("b")
        const target = Math.min(isFinite(c.ur) ? c.ur : 1.2, 1.2) / 1.2
        const from = prevUR.has(id) ? prevUR.get(id) : 0
        fill.style.transform = `scaleX(${from})`; mark.style.left = `${100 / 1.2}%`
        bar.append(fill, mark); row.append(bar)
        requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transform = `scaleX(${target})` }))
        prevUR.set(id, target)
      }
      row.style.setProperty("--j", i)
      card.append(row)
    })
    box.append(card)
  })
  return box
}
export function metricsView(metrics, key) {
  const m = el("div", "dz-metrics")
  metrics.forEach((x, i) => {
    const c = el("div", "dz-metric dz-in" + (x.cls ? " " + x.cls : "")); c.style.setProperty("--i", i)
    const v = el("div", "mv")
    c.append(el("div", "ml", x.lab), v)
    if (x.sub) c.append(el("div", "ms", x.sub))
    m.append(c)
    const id = key + "|" + x.lab
    if (typeof x.val === "number" && isFinite(x.val)) countUp(v, prevVal.has(id) ? prevVal.get(id) : 0, x.val, x.d ?? 1, x.unit || "")
    else v.textContent = (typeof x.val === "number" ? nf(x.val, x.d ?? 1) : x.val) + (x.unit ? " " + x.unit : "")
    prevVal.set(id, x.val)
  })
  return m
}
function countUp(node, a, b, d, unit) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduce || a === b) { node.textContent = nf(b, d) + (unit ? " " + unit : ""); return }
  const t0 = performance.now(), dur = 650
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = nf(a + (b - a) * e, d) + (unit ? " " + unit : ""); if (k < 1) requestAnimationFrame(step) }
  requestAnimationFrame(step)
}
export function tableView(t) {
  const w = el("div", "dz-tw dz-in")
  if (t.title) w.append(el("div", "dz-tt", t.title))
  const tb = el("table", "dz-res"), hr = el("tr")
  t.cols.forEach((c, j) => { const th = el("th", t.align && t.align[j] === "r" ? "r" : "", c); hr.append(th) })
  tb.append(hr)
  t.rows.forEach((r) => {
    const tr = el("tr", r.cls || "")
    ;(r.cells || r).forEach((c, j) => { const td = el("td", t.align && t.align[j] === "r" ? "r" : ""); td.textContent = cellStr(c, t.dec && t.dec[j]); tr.append(td) })
    tb.append(tr)
  })
  w.append(tb)
  if (t.note) w.append(el("p", "dz-note", t.note))
  return w
}
export const cellStr = (c, d) => (c == null ? "" : typeof c === "number" ? nf(c, d ?? 2) : String(c))

// ---------------------------------------------------------------- ekspor
function dl(name, bytes, mime) {
  const a = el("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500)
}
async function svgToJpeg(svg, scale = 2) {
  const vb = (svg.getAttribute("viewBox") || "0 0 800 500").split(/\s+/).map(Number)
  const w = Math.round(vb[2] * scale), h = Math.round(vb[3] * scale)
  const s = svg.cloneNode(true); s.setAttribute("width", w); s.setAttribute("height", h); s.setAttribute("xmlns", svgNS)
  s.querySelectorAll("[class]").forEach((n) => n.removeAttribute("class"))
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(s))
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h
  const g = cv.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.9))
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h }
}
const fileStamp = (d) => { const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}` }
const LBL = () => ({ suite: L("DESAIN PONDASI", "FOUNDATION DESIGN"), project: L("Proyek", "Project"), client: L("Klien", "Client"), doc: L("No. dokumen", "Document no."), rev: "Rev.", eng: L("Dihitung", "Prepared"),
  chk: L("Diperiksa", "Checked"), date: L("Tanggal", "Date"), units: L("Satuan", "Units"), codes: L("Acuan", "Codes"), allOk: L("SEMUA PEMERIKSAAN OK", "ALL CHECKS OK"), notOk: L("ADA PEMERIKSAAN YANG TIDAK MEMENUHI", "SOME CHECKS NOT SATISFIED"),
  param: L("Parameter", "Parameter"), value: L("Nilai", "Value"), check: L("Pemeriksaan", "Check"), ref: L("Acuan", "Reference"), dem: "Demand", cap: L("Kapasitas", "Capacity"), unit: L("Satuan", "Unit"), status: "Status",
  combo: L("Kombinasi", "Combination"), foot: L("YMD-CAL · kalkulator desain offline", "YMD-CAL · offline design calculator"), page: L("Hal.", "Page") })

// out: hasil modul (title, sub, refs, metrics, kv, tables, checks, notes, drawings), S: state global
export function buildReport(out, S, now) {
  const g = govern(out.checks)
  const ok = out.checks.every((c) => c.ok || c.info)
  const unitsTxt = units.sys === "si" ? "SI (kN, kN·m, kPa, MPa)" : L("Metrik-ton (tf, tf·m, t/m², MPa)", "Metric-ton (tf, tf·m, t/m², MPa)")
  const metrics = out.metrics.map((m) => [m.lab, (typeof m.val === "number" ? nf(m.val, m.d ?? 1) : m.val) + (m.unit ? " " + m.unit : "")])
  const gf = g ? fmtCheck(g) : null
  return { title: out.title, sub: out.sub, refs: out.refs, project: S.project, stamp: stamp(now), copy: copyright(now), author: AUTHOR, units: unitsTxt, ok,
    gov: g ? `${L("Menentukan", "Governing")}: ${g.item} — UR ${gf.urTxt}${g.note ? " (" + g.note + ")" : ""}` : "", metrics, g }
}
export function exportBar(box, getOut, S) {
  box.textContent = ""
  const h = el("div", "dz-exp-h"); h.append(el("b", null, L("Ekspor laporan hitungan", "Export calculation report")), el("span", "hint", L("Excel (.xlsx) dan PDF dengan hak cipta & cap waktu.", "Excel (.xlsx) and PDF with copyright & timestamp.")))
  const g = el("div", "dz-exp")
  const bx = el("button", "dz-btn xl"), bp = el("button", "dz-btn pdf"), bpr = el("button", "dz-btn ghost")
  bx.innerHTML = `<span class="ic">▦</span><span><b>Excel</b><small>.xlsx</small></span>`; bp.innerHTML = `<span class="ic">⎙</span><span><b>PDF</b><small>${L("lembar hitungan", "calc sheet")}</small></span>`
  bpr.innerHTML = `<span class="ic">🖨</span><span><b>${L("Cetak", "Print")}</b><small>${L("dari peramban", "from browser")}</small></span>`
  ;[bx, bp, bpr].forEach((b) => { b.type = "button" })
  const busy = (b, on) => { b.disabled = on; b.classList.toggle("busy", on) }
  bx.onclick = () => { busy(bx, true); try { const o = getOut(); const now = new Date(); dl(`YMD_${o.file}_${(S.project.doc || "calc").replace(/[^\w-]+/g, "_")}_${fileStamp(now)}.xlsx`, xlsxFrom(o, S, now), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") } finally { busy(bx, false) } }
  bp.onclick = async () => {
    busy(bp, true)
    try {
      const o = getOut(), now = new Date(), rep = buildReport(o, S, now)
      const imgs = []
      for (const d of o.drawings || []) { try { imgs.push({ ...(await svgToJpeg(d.make("print"))), cap: d.cap, maxH: d.maxH }) } catch (e) { /* gambar dilewati */ } }
      rep.sections = pdfSections(o, imgs)
      dl(`YMD_${o.file}_${(S.project.doc || "calc").replace(/[^\w-]+/g, "_")}_${fileStamp(now)}.pdf`, reportPdf(rep, LBL()), "application/pdf")
    } finally { busy(bp, false) }
  }
  bpr.onclick = () => window.print()
  g.append(bx, bp, bpr)
  box.append(h, g, el("p", "dz-copy", `© ${AUTHOR} · ${L("cap waktu ditambahkan saat ekspor", "timestamp added on export")} (DD/MM/YYYY - HH:MM)`))
}
function kvRows(kv) { return kv.map(([a, b, u, d]) => [a, typeof b === "number" ? nf(b, d ?? 3) : String(b ?? ""), u || ""]) }
function pdfSections(o, imgs) {
  const sec = []
  let n = 1
  const H = (t) => `${n++}. ${t}`
  for (const blk of o.kv) sec.push({ h: H(blk.title), kv: kvRows(blk.rows) })
  imgs.forEach((im, i) => sec.push({ h: i === 0 ? H(L("Gambar", "Drawings")) : "", img: im }))
  ;(o.steps || []).forEach((st, i) => sec.push({ h: i === 0 ? H(L("Lembar perhitungan", "Calculation sheet")) : "", note: st.h, table: { cols: [L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")], rows: st.rows, w: [24, 32, 28, 16], align: ["l", "l", "l", "r"], fs: 6.9 } }))
  for (const t of o.tables) sec.push({ h: H(t.title), note: t.note, table: { cols: t.cols, rows: t.rows.map((r) => (r.cells || r).map((c, j) => cellStr(c, t.dec && t.dec[j]))), align: t.align ? t.align.map((a) => (a === "r" ? "r" : "l")) : undefined } })
  sec.push({ h: H(L("Pemeriksaan (rasio pemanfaatan UR = demand/kapasitas)", "Checks (utilisation ratio UR = demand/capacity)")), checks: o.checks.map((c) => ({ ...c, ...fmtCheck(c), item: `${c.item}`, note: c.note, ref: c.ref })) })
  if (o.notes && o.notes.length) sec.push({ h: H(L("Catatan & batasan", "Notes & limitations")), text: o.notes })
  return sec.filter((s) => s.h !== "" || s.img)
}
function xlsxFrom(o, S, now) {
  const rep = buildReport(o, S, now), head = `&L&"Calibri,Bold"YMD-CAL · ${o.title}&R${S.project.doc || ""}`, foot = `&L${copyright(now)}&C${L("Hal.", "Page")} &P / &N&R${AUTHOR}`
  const cp = [{ v: copyright(now), s: ST.copy }]
  const sum = [[{ v: o.title, s: ST.title }], [{ v: o.sub, s: ST.sub }], [{ v: `${L("Acuan", "Codes")}: ${o.refs}`, s: ST.sub }], []]
  const P = S.project
  ;[[L("Proyek", "Project"), P.name], [L("Klien", "Client"), P.client], [L("No. dokumen", "Document no."), P.doc], ["Rev.", P.rev], [L("Dihitung", "Prepared"), P.eng], [L("Diperiksa", "Checked"), P.chk], [L("Tanggal", "Date"), stamp(now)], [L("Satuan", "Units"), rep.units]]
    .forEach(([a, b]) => sum.push([{ v: a, s: ST.lab }, { v: b || "–", s: ST.text }]))
  sum.push([], [{ v: rep.ok ? L("SEMUA PEMERIKSAAN OK", "ALL CHECKS OK") : L("ADA PEMERIKSAAN YANG TIDAK MEMENUHI", "SOME CHECKS NOT SATISFIED"), s: rep.ok ? ST.ok : ST.bad }], [{ v: rep.gov, s: ST.text }], [])
  sum.push([{ v: L("Ringkasan", "Summary"), s: ST.head }, { v: L("Nilai", "Value"), s: ST.head }])
  rep.metrics.forEach(([a, b]) => sum.push([{ v: a, s: ST.text }, { v: b, s: ST.text }]))
  sum.push([], cp)
  const kvS = [[{ v: L("Data masukan", "Input data"), s: ST.title }], []]
  for (const blk of o.kv) { kvS.push([{ v: blk.title, s: ST.sec }, { v: "", s: ST.sec }, { v: "", s: ST.sec }]); kvS.push([{ v: L("Parameter", "Parameter"), s: ST.head }, { v: L("Nilai", "Value"), s: ST.head }, { v: L("Satuan", "Unit"), s: ST.head }]); blk.rows.forEach(([a, b, u, d]) => kvS.push([{ v: a, s: ST.text }, { v: b, s: typeof b === "number" ? (d === 0 ? ST.n0 : d === 1 ? ST.n1 : d >= 3 ? ST.n3 : ST.n2) : ST.text }, { v: u || "", s: ST.text }])); kvS.push([]) }
  kvS.push(cp)
  const tabS = [[{ v: L("Beban, kombinasi & hasil", "Loads, combinations & results"), s: ST.title }], []]
  for (const t of o.tables) {
    tabS.push([{ v: t.title, s: ST.sec }, ...t.cols.slice(1).map(() => ({ v: "", s: ST.sec }))])
    tabS.push(t.cols.map((c) => ({ v: c, s: ST.head })))
    t.rows.forEach((r) => tabS.push((r.cells || r).map((c, j) => (typeof c === "number" ? { v: c, s: (t.dec && t.dec[j]) === 0 ? ST.n0 : (t.dec && t.dec[j]) === 1 ? ST.n1 : (t.dec && t.dec[j]) >= 3 ? ST.n3 : ST.n2 } : { v: c ?? "", s: ST.text }))))
    if (t.note) tabS.push([{ v: t.note, s: ST.sub }])
    tabS.push([])
  }
  tabS.push(cp)
  const ck = [[{ v: L("Pemeriksaan desain", "Design checks"), s: ST.title }], [{ v: L("UR = demand / kapasitas (untuk syarat minimum: syarat / nilai). UR ≤ 1,0 memenuhi.", "UR = demand / capacity (for minimum requirements: required / provided). UR ≤ 1.0 passes."), s: ST.sub }], [],
    ["#", L("Kelompok", "Group"), L("Pemeriksaan", "Check"), L("Acuan", "Reference"), "Demand", L("Kapasitas", "Capacity"), L("Satuan", "Unit"), "UR", "Status", L("Kombinasi/catatan", "Combination/note")].map((v) => ({ v, s: ST.head }))]
  o.checks.forEach((c, i) => {
    const conv = isConv(c.unit), num = (x) => (typeof x === "number" ? { v: conv ? toDisp(c.unit, x) : x, s: c.d === 0 ? ST.n0 : c.d === 1 ? ST.n1 : c.d >= 3 ? ST.n3 : ST.n2 } : { v: String(x), s: ST.text })
    ck.push([{ v: i + 1, s: ST.n0 }, { v: c.grp, s: ST.text }, { v: c.item, s: ST.text }, { v: c.ref, s: ST.text }, c.mode === "bool" ? { v: c.ok ? "✓" : "✗", s: ST.text } : num(c.dem), c.mode === "bool" ? { v: "", s: ST.text } : num(c.cap),
      { v: conv ? uName(c.unit) : c.unit, s: ST.text }, c.info ? { v: "–", s: ST.info } : { v: isFinite(c.ur) ? c.ur : "∞", s: ST.n3 }, { v: c.info ? "INFO" : c.ok ? "OK" : "NOT OK", s: c.info ? ST.info : c.ok ? ST.ok : ST.bad }, { v: c.note || "", s: ST.text }])
  })
  ck.push([], cp)
  if (o.notes && o.notes.length) { ck.push([], [{ v: L("Catatan & batasan", "Notes & limitations"), s: ST.sec }]); o.notes.forEach((t) => ck.push([{ v: "• " + t, s: ST.sub }])) }
  const stS = [[{ v: L("Lembar perhitungan langkah demi langkah", "Step-by-step calculation sheet"), s: ST.title }], []]
  for (const st of o.steps || []) {
    stS.push([{ v: st.h, s: ST.sec }, { v: "", s: ST.sec }, { v: "", s: ST.sec }, { v: "", s: ST.sec }])
    stS.push([L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")].map((v) => ({ v, s: ST.head })))
    st.rows.forEach((r) => stS.push(r.map((v, j) => ({ v: v ?? "", s: j === 0 ? ST.lab : ST.text }))))
    stS.push([])
  }
  stS.push(cp)
  const wTab = Math.max(...o.tables.map((t) => t.cols.length), 3)
  return buildXlsx([
    { name: L("Ringkasan", "Summary"), rows: sum, widths: [34, 44], merges: ["A1:B1", "A2:B2", "A3:B3"], head, foot },
    { name: L("Masukan", "Inputs"), rows: kvS, widths: [46, 18, 14], head, foot },
    { name: L("Langkah perhitungan", "Calculation steps"), rows: stS, widths: [34, 46, 46, 22], head, foot },
    { name: L("Beban & hasil", "Loads & results"), rows: tabS, widths: Array.from({ length: wTab }, (_, i) => (i === 0 ? 16 : i === 1 ? 30 : 13)), head, foot },
    { name: L("Pemeriksaan", "Checks"), rows: ck, widths: [5, 22, 56, 22, 12, 12, 9, 9, 10, 20], head, foot },
  ], { title: o.title, author: AUTHOR, rights: copyright(now) })
}

// ---------------------------------------------------------------- gerak: kartu muncul saat terlihat
let io = null
export function reveal(root) {
  if (!("IntersectionObserver" in self)) { root.querySelectorAll(".dz-in").forEach((n) => n.classList.add("on")); return }
  io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target) } }), { rootMargin: "0px 0px -6% 0px" })
  root.querySelectorAll(".dz-in:not(.on)").forEach((n) => io.observe(n))
}
export const SITE_OPTS = () => ({ cls: Object.fromEntries(SITES.map((s) => [s, s])) })
export { lang }
