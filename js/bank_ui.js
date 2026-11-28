// Bank data tanah proyek (tab Tanah): daftar titik penyelidikan (bor N-SPT BH-1…, sondir CPT S-1…), tambah satu / banyak titik sekaligus,
// duplikat, hapus, urutkan, titik acuan ★, atribut lokasi (koordinat, elevasi, tanggal), tabel perbandingan semua titik, denah titik, dan
// grafik N60 / qc semua titik. Modul Desain memilih titik yang dipakai (lihat js/desain/deep.js soilFields, project.js modSoil).
import { L, nf, toDisp, uName } from "./desain/core.js"
import { el, field, sv } from "./desain/ui.js"
import { root, T } from "./desain/draw.js"
import { siteClass, shallowQa } from "./desain/soil.js"
import { singlePile, effPile } from "./desain/deep.js"
import { soilDS, soilDSOf, setRef, addSoil, addSoilRange, delSoil, sortSoils, modSoil, MAX_PTS, projJSON } from "./project.js"

const parseNum = (s) => { const v = parseFloat(String(s).trim().replace(",", ".")); return isFinite(v) ? v : NaN }
const depthOf = (so) => so.layers.reduce((a, l) => a + (+l.h || 0), 0)
const isCpt = (so) => so.test === "cpt"
export const dsOf = (P, so) => (so === P.soil ? soilDS(P) : soilDSOf(so, P))

// ---------------------------------------------------------------- pemakaian titik oleh modul Desain & kasus manual penurunan
const MOD_T = () => ({ tiang: L("Tiang", "Piles"), tangki: L("Tangki", "Tank"), vessel: "Vessel", dinamis: L("Mesin", "Machine"), trafo: L("Trafo", "Transformer") })
const VES = { gasboot: "Gas Boot", iar: "IA Receiver", sep: "Separator" }
export function usage(P) {
  const u = new Map(), add = (id, t) => { if (!u.has(id)) u.set(id, []); u.get(id).push(t) }
  let raw = null
  try { raw = JSON.parse(localStorage.getItem("ymd.desain.v1") || "null") } catch (e) { raw = null }
  const mt = MOD_T()
  for (const id of Object.keys(mt)) {
    const st = (raw && raw.m && raw.m[id]) || {}
    if (st.soilSrc === "own" || st.soilSrc === "manual" || (id === "tiang" && st.soilSrc === undefined && st.layers)) continue
    const t = id === "vessel" ? VES[st.preset || "gasboot"] || "Vessel" : mt[id]
    add(modSoil(st, P).so.id, t)
  }
  ;(P.settle.manual || []).forEach((c, i) => { const so = P.soils.find((x) => x.id === c.pt) || P.soil; add(so.id, `${L("Penurunan", "Settlement")}: ${c.label || i + 1}`) })
  return u
}

// ---------------------------------------------------------------- nama titik berikutnya: ikut pola titik sejenis terakhir (BH-07 → BH-08)
function nextName(P, test) {
  const same = P.soils.filter((x) => (x.test === "cpt") === (test === "cpt"))
  for (let i = same.length - 1; i >= 0; i--) {
    const m = /^(.*?)(\d+)$/.exec(same[i].name.trim())
    if (!m) continue
    const pre = m[1], pad = m[2].length > 1 && m[2].startsWith("0") ? m[2].length : 1
    let mx = 0
    for (const x of P.soils) { const k = new RegExp("^" + pre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)$", "i").exec(x.name.trim()); if (k) mx = Math.max(mx, +k[1]) }
    return pre + String(mx + 1).padStart(pad, "0")
  }
  const pre = test === "cpt" ? "S-" : "BH-"
  let n = 1
  while (P.soils.some((x) => x.name.toLowerCase() === (pre + n).toLowerCase())) n++
  return pre + n
}

// ---------------------------------------------------------------- kartu bank titik
const bulk = { open: false, prefix: "BH-", a: 1, b: 10, pad: "1", test: "spt", init: "tpl" }
export function bankBody(P, so, on) {
  // on: { pick(id), changed(structural) }
  const box = el("div", "sb-bank"), list = el("div", "sb-list"), u = usage(P)
  P.soils.forEach((x, i) => {
    const b = el("button", "sb-pt" + (x === so ? " on" : "") + (x.id === P.soilRef ? " ref" : "") + (x.tpl ? " tpl" : "")); b.type = "button"; b.style.setProperty("--i", Math.min(i, 14))
    b.setAttribute("aria-pressed", x === so ? "true" : "false")
    const mk = el("i", "sb-mk " + (isCpt(x) ? "cpt" : "bh")); mk.setAttribute("aria-hidden", "true")
    const tx = el("span", "sb-tx")
    tx.append(el("b", null, x.name + (x.id === P.soilRef ? " ★" : "")), el("small", null, `${isCpt(x) ? "CPT" : "N-SPT"} · ${nf(depthOf(x), 1)}\u00a0m · MAT\u00a0${nf(x.gwt, 1)}\u00a0m`))
    if (x.tpl) tx.append(el("small", "sb-tag", L("⚠ data contoh", "⚠ sample data")))
    const us = u.get(x.id)
    if (us) tx.append(el("small", "sb-use", us.join(" · ")))
    b.append(mk, tx)
    b.onclick = () => on.pick(x.id)
    list.append(b)
  })
  const bar = el("div", "pj-row pj-soilbar")
  const btn = (txt, cls, fn, dis) => { const x = el("button", cls || "dz-add ghost", txt); x.type = "button"; x.disabled = !!dis; x.onclick = fn; return x }
  const full = P.soils.length >= MAX_PTS, msg = el("span", "hint pj-soilinfo")
  const addOne = (test) => { const n = addSoil(P, { name: nextName(P, test), test }); if (n) { P.soilEdit = n.id; on.changed(true) } }
  let armed = 0
  const del = btn(L(`✕ Hapus ${so.name}`, `✕ Delete ${so.name}`), "dz-add ghost", () => {
    if (!armed) { armed = setTimeout(() => { armed = 0; del.classList.remove("warn"); del.textContent = L(`✕ Hapus ${so.name}`, `✕ Delete ${so.name}`) }, 3500); del.classList.add("warn"); del.textContent = L(`Ketuk lagi: hapus ${so.name}`, `Tap again: delete ${so.name}`); return }
    clearTimeout(armed); armed = 0
    if (delSoil(P, so.id)) on.changed(true)
  }, P.soils.length <= 1)
  bar.append(btn(L("＋ Bor (N-SPT)", "＋ Borehole (SPT)"), "dz-add", () => addOne("spt"), full),
    btn(L("＋ Sondir (CPT)", "＋ CPT (sondir)"), "dz-add", () => addOne("cpt"), full),
    btn(L("⊞ Buat banyak titik…", "⊞ Create many points…"), "dz-add ghost" + (bulk.open ? " on" : ""), () => { bulk.open = !bulk.open; on.changed(true) }, full),
    btn(L(`⧉ Duplikat ${so.name}`, `⧉ Duplicate ${so.name}`), "dz-add ghost", () => { const n = addSoil(P, { from: so, name: so.name, tpl: !!so.tpl, keepLoc: true }); if (n) { P.soilEdit = n.id; on.changed(true) } }, full),
    btn(so.id === P.soilRef ? L(`★ ${so.name} = titik acuan`, `★ ${so.name} = reference`) : L(`★ Jadikan ${so.name} titik acuan`, `★ Make ${so.name} the reference`), "dz-add ghost", () => { setRef(P, so.id); on.changed(true) }, so.id === P.soilRef),
    btn(L("⇅ Urutkan nama", "⇅ Sort by name"), "dz-add ghost", () => { sortSoils(P); on.changed(true) }, P.soils.length < 2),
    del, msg)
  box.append(list, bar)
  if (bulk.open && !full) box.append(bulkPanel(P, so, on))
  const kb = (projJSON(P).length / 1024)
  box.append(el("p", "dz-note", L(`★ Titik acuan proyek dipakai tab Gempa (kelas situs otomatis), modul Desain yang memilih “titik acuan”, dan kasus manual penurunan. Tiap modul Desain bisa memilih titik lain di bagian Data tanah. Ketuk titik untuk membuka & mengisi datanya di bawah. ${P.soils.length}/${MAX_PTS} titik · ±${nf(kb, 0)} KB tersimpan di iPad.`,
    `★ The project reference point feeds the Seismic tab (automatic site class), Design modules set to “reference point”, and manual settlement cases. Each Design module can pick another point in its Soil data section. Tap a point to open and fill its data below. ${P.soils.length}/${MAX_PTS} points · ≈${nf(kb, 0)} KB stored on the iPad.`)))
  return box
}
function bulkPanel(P, so, on) {
  const w = el("div", "sb-bulk dz-in on"), g = el("div", "dz-grid"), msg = el("p", "dz-note")
  const redraw = () => { const n = w.parentNode; if (n) n.replaceChild(bulkPanel(P, so, on), w) }
  const pre = el("div", "pj-row")
  const preset = (t, p, a, b, test) => { const x = el("button", "dz-add ghost", t); x.type = "button"; x.onclick = () => { Object.assign(bulk, { prefix: p, a, b, test, pad: "1" }); redraw() }; return x }
  pre.append(el("span", "hint", L("Cepat:", "Quick:")), preset("BH-1 … BH-10 (N-SPT)", "BH-", 1, 10, "spt"), preset("S-1 … S-10 (CPT)", "S-", 1, 10, "cpt"))
  const go = el("button", "pj-apply"); go.type = "button"
  const upd = () => { const nm = (k) => `${bulk.prefix}${String(Math.round(k)).padStart(+bulk.pad, "0")}`; go.textContent = L(`Buat titik ${nm(bulk.a)} … ${nm(bulk.b)}`, `Create points ${nm(bulk.a)} … ${nm(bulk.b)}`) }
  g.append(field({ k: "prefix", type: "txt", lab: L("Awalan nama", "Name prefix"), obj: bulk }, bulk, upd),
    field({ k: "a", lab: L("Nomor dari", "Number from"), u: "", lo: 0, hi: 999, obj: bulk }, bulk, upd),
    field({ k: "b", lab: L("sampai", "to"), u: "", lo: 0, hi: 999, obj: bulk }, bulk, upd),
    field({ k: "pad", type: "seg", lab: L("Format nomor", "Number format"), opts: { 1: "1, 2 … 10", 2: "01, 02 … 10", 3: "001 …" }, obj: bulk }, bulk, () => redraw()),
    field({ k: "test", type: "seg", lab: L("Jenis uji", "Test type"), opts: { spt: L("Bor N-SPT", "SPT borehole"), cpt: L("Sondir CPT", "CPT") }, obj: bulk }, bulk, () => { if (bulk.test === "cpt" && bulk.prefix === "BH-") bulk.prefix = "S-"; if (bulk.test === "spt" && bulk.prefix === "S-") bulk.prefix = "BH-"; redraw() }),
    field({ k: "init", type: "seg", lab: L("Isi awal tiap titik", "Initial data of each point"), opts: { tpl: L("Templat contoh", "Sample template"), copy: L(`Salin data ${so.name}`, `Copy ${so.name} data`) }, obj: bulk, wide: true }, bulk, () => redraw()))
  upd()
  go.onclick = () => {
    if (!(bulk.b >= bulk.a)) { msg.textContent = L("Nomor akhir harus ≥ nomor awal.", "The last number must be ≥ the first."); msg.classList.add("bad"); return }
    const r = addSoilRange(P, { prefix: bulk.prefix, from: bulk.a, to: Math.min(bulk.b, bulk.a + MAX_PTS), pad: +bulk.pad, test: bulk.test, from0: bulk.init === "copy" ? so : null })
    if (r.made.length) { P.soilEdit = r.made[0].id; bulk.open = false }
    bulk.msg = L(`${r.made.length} titik dibuat${r.skip.length ? ` · ${r.skip.length} dilewati (nama sudah ada / bank penuh): ${r.skip.slice(0, 6).join(", ")}${r.skip.length > 6 ? "…" : ""}` : ""}.`, `${r.made.length} point(s) created${r.skip.length ? ` · ${r.skip.length} skipped (name exists / bank full): ${r.skip.slice(0, 6).join(", ")}${r.skip.length > 6 ? "…" : ""}` : ""}.`)
    on.changed(true)
  }
  msg.textContent = L("Titik baru berisi data contoh (ditandai ⚠) sampai lapisannya diisi / ditempel dari Excel. Nama yang sudah ada dilewati.", "New points hold sample data (marked ⚠) until their layers are entered / pasted from Excel. Existing names are skipped.")
  w.append(pre, g, go, msg)
  return w
}
// pesan hasil "buat banyak titik" (sekali tampil)
export function bulkMsg() { const m = bulk.msg; bulk.msg = ""; return m || "" }

// ---------------------------------------------------------------- lokasi titik (opsional)
export function locFields(so, changed) {
  const g = el("div", "dz-grid")
  const opt = (k, lab, u) => {
    const w = el("div", "dz-f"), row = el("div", "dz-in-row"), i = el("input")
    i.type = "text"; i.inputMode = "text"; i.autocomplete = "off"; i.value = so[k] != null ? String(so[k]) : ""; i.placeholder = "–"
    i.oninput = () => { const t = i.value.trim(); if (!t) { i.classList.remove("bad"); so[k] = null; changed(false); return } const v = parseNum(t), ok = !isNaN(v) && Math.abs(v) < 1e8; i.classList.toggle("bad", !ok); if (ok) { so[k] = v; changed(false) } }
    i.onchange = () => changed(false)
    row.append(i, el("span", "dz-unit", u)); w.append(el("span", "lb", lab), row); return w
  }
  g.append(opt("x", L("Koordinat X / Timur (E)", "Coordinate X / Easting"), "m"), opt("y", L("Koordinat Y / Utara (N)", "Coordinate Y / Northing"), "m"), opt("elev", L("Elevasi muka tanah", "Ground elevation"), "m"),
    field({ k: "date", type: "txt", lab: L("Tanggal uji", "Test date"), obj: so }, so, () => changed(false)),
    field({ k: "note", type: "txt", lab: L("Keterangan (lokasi / peralatan)", "Remarks (location / equipment)"), obj: so, wide: true }, so, () => changed(false)))
  return g
}

// ---------------------------------------------------------------- ringkasan semua titik (memo per isi titik & parameter proyek)
const cache = new Map()
function ptRes(P, so) {
  const k = JSON.stringify([so.layers, so.gwt, so.Er, so.Nkt, so.Gs, so.test, so.fill, P.bear, P.pile, P.settle.life, so === P.soil])
  let r = cache.get(k)
  if (!r) {
    const ds = dsOf(P, so), sc = siteClass(ds), b = P.bear
    let qa = NaN, Qa = NaN
    try { qa = shallowQa(ds, b.B, b.B, b.Df, b.method, b.FS).qa } catch (e) { /* tanpa qa */ }
    try { Qa = singlePile(effPile({ pSrc: "proj" }, { pile: P.pile }), ds, P.pile.z0).Qad } catch (e) { /* tanpa Qa */ }
    r = { ds, sc, qa, Qa }
    if (cache.size > 160) cache.clear()
    cache.set(k, r)
  }
  return r
}
export function bankTable(P) {
  const u = usage(P), b = P.bear
  const rows = P.soils.map((so) => {
    const r = ptRes(P, so)
    return { cells: [so.name + (so.id === P.soilRef ? " ★" : "") + (so.tpl ? " ⚠" : ""), isCpt(so) ? "CPT" : "N-SPT", so.x != null ? so.x : "–", so.y != null ? so.y : "–", so.elev != null ? so.elev : "–", r.ds.depth, r.ds.gwt, r.sc.Nbar, r.sc.cls,
      isFinite(r.qa) ? toDisp("Q", r.qa) : "–", isFinite(r.Qa) ? toDisp("F", r.Qa) : "–", (u.get(so.id) || []).join(", ") || "–"] }
  })
  return { title: L(`Ringkasan titik penyelidikan (${P.soils.length} titik)`, `Investigation points summary (${P.soils.length} points)`),
    cols: [L("Titik", "Point"), L("Uji", "Test"), "X (m)", "Y (m)", L("Elev. (m)", "Elev. (m)"), L("Kedalaman (m)", "Depth (m)"), L("MAT (m)", "GWT (m)"), "N̄30", L("Kelas situs", "Site class"), `qa (${uName("Q")})`, `Qa ${L("tiang", "pile")} (${uName("F")})`, L("Dipakai", "Used by")],
    rows, dec: [null, null, 2, 2, 2, 1, 2, 1, null, 0, 0, null], align: ["l", "l", "r", "r", "r", "r", "r", "r", "l", "r", "r", "l"],
    note: L(`qa: pondasi bujur sangkar B = ${nf(b.B, 2)} m, Df = ${nf(b.Df, 2)} m, FS ${nf(b.FS, 1)} (metode aktif tab Tanah). Qa tiang: tiang rencana tab Tanah (Ø${nf(P.pile.D, 0)} mm, L ${nf(P.pile.L, 1)} m, z0 ${nf(P.pile.z0, 2)} m). ★ = titik acuan proyek; ⚠ = masih data contoh.`,
      `qa: square footing B = ${nf(b.B, 2)} m, Df = ${nf(b.Df, 2)} m, FS ${nf(b.FS, 1)} (active Soil tab method). Pile Qa: Soil tab design pile (Ø${nf(P.pile.D, 0)} mm, L ${nf(P.pile.L, 1)} m, z0 ${nf(P.pile.z0, 2)} m). ★ = project reference point; ⚠ = still sample data.`) }
}
export const hasPlan = (P) => P.soils.filter((so) => so.x != null && so.y != null).length >= 2

// ---------------------------------------------------------------- denah titik penyelidikan
const COLS = (Pp) => [Pp.acc, Pp.steel, Pp.bad, Pp.ok, Pp.wind, Pp.arw, Pp.machine, Pp.water]
function niceStep(span, n) { const raw = span / Math.max(n, 1), p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p }
export function planDraw(P, Pp, hiId) {
  const pts = P.soils.filter((so) => so.x != null && so.y != null)
  const W = 760, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const span = Math.max(x1 - x0, y1 - y0, 1), pad = span * 0.12
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad
  const m = { l: 70, r: 64, t: 52, b: 58 }, pw = W - m.l - m.r
  const sc = Math.min(pw / (x1 - x0), 440 / (y1 - y0)), ph = (y1 - y0) * sc, H = Math.round(Math.max(ph, 160) + m.t + m.b)
  const cx = m.l + (pw - (x1 - x0) * sc) / 2, X = (v) => cx + (v - x0) * sc, Y = (v) => m.t + (y1 - v) * sc
  const s = root(W, H, Pp, L("Denah titik penyelidikan", "Investigation point plan"))
  T(s, 16, 28, `${L("Denah titik penyelidikan", "Investigation point plan")} · ${pts.length} ${L("titik berkoordinat", "points with coordinates")}`, { c: Pp.ink, fs: 14, b: true })
  const st = niceStep(Math.max(x1 - x0, y1 - y0), 5)
  for (let v = Math.ceil(x0 / st) * st; v <= x1; v += st) { s.append(sv("line", { x1: X(v), x2: X(v), y1: m.t, y2: m.t + (y1 - y0) * sc, stroke: Pp.grid })); T(s, X(v), m.t + (y1 - y0) * sc + 16, nf(v, st < 1 ? 1 : 0), { c: Pp.mut, fs: 9.5, a: "middle" }) }
  for (let v = Math.ceil(y0 / st) * st; v <= y1; v += st) { s.append(sv("line", { x1: cx, x2: cx + (x1 - x0) * sc, y1: Y(v), y2: Y(v), stroke: Pp.grid })); T(s, cx - 6, Y(v) + 4, nf(v, st < 1 ? 1 : 0), { c: Pp.mut, fs: 9.5, a: "end" }) }
  s.append(sv("rect", { x: cx, y: m.t, width: (x1 - x0) * sc, height: (y1 - y0) * sc, fill: "none", stroke: Pp.line }))
  // panah utara
  const nx = W - 32, ny = m.t + 16
  s.append(sv("path", { d: `M${nx},${ny - 12} L${nx + 7},${ny + 8} L${nx},${ny + 3} L${nx - 7},${ny + 8} Z`, fill: Pp.ink }))
  T(s, nx, ny + 22, L("U", "N"), { c: Pp.ink, fs: 11, a: "middle", b: true })
  pts.forEach((p) => {
    const px = X(p.x), py = Y(p.y), hi = p.id === hiId, c = hi ? Pp.acc : Pp.ink, r = hi ? 8.5 : 7
    if (isCpt(p)) s.append(sv("path", { d: `M${px},${py - r * 1.15} L${px + r},${py + r * 0.75} L${px - r},${py + r * 0.75} Z`, fill: hi ? Pp.acc : Pp.bg, stroke: c, "stroke-width": 2 }))
    else { s.append(sv("circle", { cx: px, cy: py, r, fill: hi ? Pp.acc : Pp.bg, stroke: c, "stroke-width": 2 })); s.append(sv("path", { d: `M${px - r},${py} L${px + r},${py} M${px},${py - r} L${px},${py + r}`, stroke: hi ? Pp.bg : c, "stroke-width": 1.4 })) }
    if (p.id === P.soilRef) T(s, px - r - 3, py - r - 1, "★", { c: Pp.acc, fs: 12, a: "end", b: true })
    T(s, px + r + 4, py - 2, p.name, { c, fs: 11.5, b: true })
    if (p.elev != null) T(s, px + r + 4, py + 12, `+${nf(p.elev, 2)}`, { c: Pp.mut, fs: 9.5 })
  })
  const lg = m.t + (y1 - y0) * sc + 38
  s.append(sv("circle", { cx: m.l + 6, cy: lg - 4, r: 6, fill: Pp.bg, stroke: Pp.ink, "stroke-width": 1.8 })); s.append(sv("path", { d: `M${m.l},${lg - 4} L${m.l + 12},${lg - 4} M${m.l + 6},${lg - 10} L${m.l + 6},${lg + 2}`, stroke: Pp.ink, "stroke-width": 1.2 }))
  T(s, m.l + 18, lg, L("Bor N-SPT", "SPT borehole"), { c: Pp.ink, fs: 10.5 })
  s.append(sv("path", { d: `M${m.l + 136},${lg - 11} L${m.l + 142},${lg + 1} L${m.l + 130},${lg + 1} Z`, fill: Pp.bg, stroke: Pp.ink, "stroke-width": 1.6 }))
  T(s, m.l + 148, lg, L("Sondir CPT", "CPT"), { c: Pp.ink, fs: 10.5 })
  T(s, m.l + 250, lg, L("★ titik acuan · koordinat dalam m", "★ reference point · coordinates in m"), { c: Pp.mut, fs: 10.5 })
  return s
}

// ---------------------------------------------------------------- grafik N60 (bor) dan qc (sondir) semua titik terhadap kedalaman
export function overlayDraw(P, Pp, hiId) {
  const W = 760, H = 520, s = root(W, H, Pp, L("Perbandingan profil semua titik", "All points profile comparison"))
  const real = P.soils.filter((x) => !x.tpl), shown = real.length ? real : P.soils, skip = P.soils.length - shown.length
  const spt = shown.filter((x) => !isCpt(x)), cpt = shown.filter(isCpt)
  const groups = [[spt, "N60", (l) => l.N60], [cpt, "qc (MPa)", (l) => l.qcE]].filter((g) => g[0].length)
  T(s, 16, 28, `${L("Perbandingan profil", "Profile comparison")} · ${spt.length} ${L("bor", "boreholes")} · ${cpt.length} ${L("sondir", "CPT")}${skip ? ` · ${skip} ${L("titik data contoh tidak digambar", "sample-data points not drawn")}` : ""}`, { c: Pp.ink, fs: 14, b: true })
  const all = shown.map((so) => [so, dsOf(P, so)]), dmap = new Map(all)
  const depth = Math.ceil(Math.max(...all.map(([, d]) => d.depth), 5) / 5) * 5
  const top = 66, legH = 22 * Math.ceil(shown.length / 6), bot = H - 30 - legH, Y = (z) => top + z / depth * (bot - top)
  const x00 = 56, gap = 30, pw = (W - x00 - 16 - gap * (groups.length - 1)) / groups.length
  for (let z = 0; z <= depth; z += 5) T(s, x00 - 8, Y(z) + 4, nf(z, 0), { c: Pp.mut, fs: 10.5, a: "end" })
  T(s, 16, (top + bot) / 2, "z (m)", { c: Pp.ink, fs: 11 })
  const cols = COLS(Pp), sty = new Map(shown.map((so, i) => [so.id, { c: cols[i % cols.length], d: i >= 16 ? "2 3" : i >= 8 ? "7 4" : null }]))
  groups.forEach(([pts, title, val], gi) => {
    const x0 = x00 + gi * (pw + gap)
    const m0 = Math.max(1, ...pts.flatMap((so) => dmap.get(so).layers.map(val))) * 1.05, stp = niceStep(m0, 4), mx = Math.ceil(m0 / stp) * stp
    T(s, x0 + pw / 2, top - 12, title, { c: Pp.ink, fs: 12, a: "middle", b: true })
    s.append(sv("rect", { x: x0, y: top, width: pw, height: bot - top, fill: "none", stroke: Pp.line }))
    for (let z = 0; z <= depth; z += 5) s.append(sv("line", { x1: x0, x2: x0 + pw, y1: Y(z), y2: Y(z), stroke: Pp.grid }))
    const nk = Math.round(mx / stp)
    for (let k = 0; k <= nk; k++) { const xv = x0 + pw * k / nk; if (k && k < nk) s.append(sv("line", { x1: xv, x2: xv, y1: top, y2: bot, stroke: Pp.grid })); T(s, xv, bot + 14, nf(stp * k, stp >= 1 ? 0 : 1), { c: Pp.mut, fs: 9.5, a: k === 0 ? "start" : k === nk ? "end" : "middle" }) }
    pts.forEach((so) => {
      const ds = dmap.get(so), y = sty.get(so.id), hi = so.id === hiId
      let d = ""
      ds.layers.forEach((l, i) => { const x = x0 + Math.min(val(l), mx) / mx * pw; d += `${i ? "L" : "M"}${x.toFixed(1)},${Y(l.z0).toFixed(1)} L${x.toFixed(1)},${Y(l.z1).toFixed(1)} ` })
      s.append(sv("path", { d, fill: "none", stroke: y.c, "stroke-width": hi ? 3.4 : 1.8, "stroke-linejoin": "round", ...(y.d ? { "stroke-dasharray": y.d } : {}), opacity: hi || !hiId ? 1 : 0.85 }))
    })
  })
  shown.forEach((so, i) => {
    const y = sty.get(so.id), lx = 56 + (i % 6) * 118, ly = bot + 34 + Math.floor(i / 6) * 22
    s.append(sv("line", { x1: lx, x2: lx + 24, y1: ly - 4, y2: ly - 4, stroke: y.c, "stroke-width": so.id === hiId ? 3.4 : 2.2, ...(y.d ? { "stroke-dasharray": y.d } : {}) }))
    T(s, lx + 30, ly, so.name + (so.id === P.soilRef ? " ★" : ""), { c: Pp.ink, fs: 10.5, b: so.id === hiId })
  })
  return s
}
