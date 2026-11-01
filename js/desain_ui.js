// Halaman "Desain Pondasi": hub 5 kalkulator + halaman modul (formulir, beban, kombinasi, hasil beranimasi, ekspor Excel/PDF).
// Rumus ada di js/desain/*.js (fungsi murni, diuji di tests/suite_desain.js). Teks dua bahasa lewat L(id, en).
import { L, lang, units, nf, AUTHOR, govern, uName, setCode, relabel, edLabel, windCode, aciCode } from "./desain/core.js"
import { el, loadState, saveState, siteCtx, renderForm, comboEditor, checksView, metricsView, tableView, exportBar, reveal, field, fmtCheck, urClass } from "./desain/ui.js"
import * as tiang from "./desain/m_tiang.js"
import * as tangki from "./desain/m_tangki.js"
import * as vessel from "./desain/m_vessel.js"
import * as dinamis from "./desain/m_dinamis.js"
import * as trafo from "./desain/m_trafo.js"
import { projLoad, projSave, soilDS, seisSite, stepper } from "./project.js"
import { ico, MOD_ICO } from "./icons.js"
import { QA_METHOD } from "./desain/soil.js"

export const MODS = [tiang, tangki, vessel, dinamis, trafo]
const CMB0 = () => ({ en: {}, fx: {}, ortho: false, wp: 0.5 })
function defaults() {
  return {
    units: "si", project: { name: "", client: "", doc: "", rev: "0", eng: AUTHOR, chk: "" },
    site: { V: 32, exp: "C", Kzt: 1, Kd: 0.95, Ss: 0.8, S1: 0.35, cls: "SD", TL: 8 },
    m: Object.fromEntries(MODS.map((m) => [m.id, m.defaults()])), cmb: Object.fromEntries(MODS.map((m) => [m.id, CMB0()])),
  }
}

// konteks hitung bersama: angin dari data lokasi Desain, gempa & tanah & kriteria penurunan dari data proyek (tab Gempa / Tanah / Penurunan)
export function designCtx(S, P, cmb) {
  setCode(P.codes)
  const ss = seisSite(P)
  const sc = siteCtx({ ...S.site, Ss: ss.Ss, S1: ss.S1, cls: ss.cls, TL: ss.TL })
  return { ...sc, ss, soil: soilDS(P), bear: P.bear, settle: P.settle, pile: P.pile, cmbOpts: { SDS: sc.sp.SDS, wpFrac: cmb.wp, ortho: cmb.ortho, enabled: cmb.en, factors: cmb.fx } }
}
export function loadDesign() {
  const S = loadState(defaults)
  for (const m of MODS) S.cmb[m.id] = { ...CMB0(), ...(S.cmb[m.id] || {}) }
  // masukan lama (sebelum ada tab Tanah): pertahankan qa & lapisan manual yang sudah diisi pengguna
  let raw = null
  try { raw = JSON.parse(localStorage.getItem("ymd.desain.v1") || "null") } catch (e) { raw = null }
  for (const m of MODS) {
    const o = raw && raw.m && raw.m[m.id]
    if (!o) continue
    if (o.qaSrc === undefined && o.qa !== undefined && m.id !== "tiang") S.m[m.id].qaSrc = "manual"
    if (m.id === "tiang" && o.soilSrc === undefined && o.layers) S.m[m.id].soilSrc = "manual"
    // sebelum alur desain otomatis: pertahankan ukuran telapak & tiang yang sudah diisi pengguna
    if (m.id !== "tiang" && o.fSize === undefined && (o.B !== undefined || o.D !== undefined)) S.m[m.id].fSize = "manual"
    if (m.id !== "tiang" && o.fdType === "deep" && o.pSrc === undefined) Object.assign(S.m[m.id], { pSrc: "own", pLay: "grid", tAuto: false })
  }
  units.sys = S.units === "t" ? "t" : "si"
  return S
}
// Jalankan semua modul dengan masukan tersimpan (dashboard beranda, tab Penurunan, laporan proyek)
export function runAll(lng, opts = {}) {
  if (lng) lang.cur = lng
  const S = loadDesign(), P = opts.P || projLoad()
  const mods = MODS.map((m) => {
    try {
      const out = relabel(m.run(S.m[m.id], designCtx(S, P, S.cmb[m.id])))
      return { m, out }
    } catch (e) { console.error(e); return { m, error: e.message } }
  })
  return { S, P, mods }
}
export function dashboard(lng) {
  const { S, P, mods } = runAll(lng)
  const sc = designCtx(S, P, CMB0())
  return { project: P.info, site: S.site, sp: sc.sp, ss: sc.ss, units: units.sys, codes: `${windCode().replace("SNI 1727:2020 ", "")} · ${aciCode().replace("SNI 2847:2019 ", "")} · AISC 360-22`, mods: mods.map(({ m, out, error }) => {
    if (error) return { id: m.id, icon: m.icon, title: m.title(), error }
    const g = govern(out.checks), bad = out.checks.filter((c) => !c.ok && !c.info)
    const st = out.settle && out.settle.s != null ? { s: out.settle.s, allow: out.settle.allow, kind: out.settle.kind } : null
    return { id: m.id, icon: m.icon, title: m.title(), sub: out.sub, nChk: out.checks.filter((c) => !c.info).length, nBad: bad.length, gov: g, ok: !bad.length, settle: st, nCmb: out.combos.length, fdType: out.fdType }
  }) }
}

let PJ = null
export function mountDesain(root, ctx, sub) {
  lang.cur = ctx.lang
  const S = loadDesign()
  PJ = projLoad()
  const mod = MODS.find((m) => m.id === sub)
  root.textContent = ""
  if (!mod) hub(root, S)
  else { root.append(stepper("desain", PJ)); page(root, S, mod) }
  reveal(root)
}

// ---------------------------------------------------------------- bagian bersama: satuan, proyek, lokasi
function unitsToggle(S, onChange) {
  const g = el("div", "dz-units")
  g.append(el("span", "lb", L("Satuan", "Units")))
  ;[["si", "kN · kPa"], ["t", "ton · t/m²"]].forEach(([k, v]) => {
    const b = el("button", "dz-ub" + (units.sys === k ? " on" : ""), v); b.type = "button"
    b.onclick = () => {
      S.units = k; units.sys = k; saveState(S)
      g.querySelectorAll(".dz-ub").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false") })
      onChange()
    }
    b.setAttribute("aria-pressed", units.sys === k ? "true" : "false")
    g.append(b)
  })
  return g
}
let projOpen = false
function projectCard(S, onChange) {
  const d = el("details", "dz-sec dz-in on"); d.open = projOpen
  d.addEventListener("toggle", () => { projOpen = d.open })
  setCode(PJ.codes)
  const sm = el("summary"); const icP = el("span", "dz-ico"); icP.append(ico("project")); sm.append(icP, el("span", "dz-st", L("Data proyek, edisi kode, angin, gempa & tanah", "Project, code edition, wind, seismic & soil data")))
  const ss = seisSite(PJ), sp = ss.sp
  sm.append(el("span", "dz-badge", `${windCode().replace("SNI 1727:2020 ", "")} · ${aciCode().replace("SNI 2847:2019 ", "")} · V ${nf(S.site.V, 0)} m/s · SDS ${nf(sp.SDS, 3)}`))
  d.append(sm)
  const P = PJ.info, g1 = el("div", "dz-grid"), savePJ = () => { projSave(PJ); onChange(false) }
  ;[["name", L("Nama proyek", "Project name")], ["client", L("Klien", "Client")], ["doc", L("No. dokumen", "Document no.")], ["rev", "Rev."], ["eng", L("Dihitung oleh", "Prepared by")], ["chk", L("Diperiksa oleh", "Checked by")]]
    .forEach(([k, lab]) => g1.append(field({ k, lab, type: "txt", obj: P }, S, savePJ)))
  d.append(el("div", "dz-sub", L("Proyek (muncul di kepala laporan Excel/PDF)", "Project (shown in the Excel/PDF report header)")), g1)
  const st = S.site, g2 = el("div", "dz-grid"), oc = (x) => onChange(x)
  g2.append(field({ k: "V", lab: L("Kecepatan angin dasar V (3 detik)", "Basic wind speed V (3-s gust)"), u: "m/s", lo: 10, hi: 90, obj: st, help: L("SNI 1727:2020 Gambar 26.5-1 / data meteorologi lokasi.", "SNI 1727:2020 Fig. 26.5-1 / site meteorological data.") }, S, oc))
  g2.append(field({ k: "exp", type: "seg", lab: L("Kategori eksposur", "Exposure category"), opts: { B: "B", C: "C", D: "D" }, obj: st }, S, oc))
  g2.append(field({ k: "Kzt", lab: "Kzt", u: "", lo: 1, hi: 3, obj: st }, S, oc), field({ k: "Kd", lab: "Kd", u: "", lo: 0.85, hi: 1, obj: st, help: L("0,95 tangki/silinder; 0,85 struktur lain.", "0.95 tanks/cylinders; 0.85 other structures.") }, S, oc))
  const cd = PJ.codes, gC = el("div", "dz-grid"), ocC = () => { projSave(PJ); onChange(true) }
  gC.append(field({ k: "wind", type: "seg", lab: L("Kode angin & kombinasi beban", "Wind & load combination code"), opts: { "7-22": L("ASCE 7-22 (terbaru)", "ASCE 7-22 (latest)"), "7-16": "SNI 1727:2020 / ASCE 7-16" }, obj: cd, wide: true }, cd, ocC),
    field({ k: "aci", type: "seg", lab: L("Kode beton", "Concrete code"), opts: { "19": L("ACI 318-19 (terbaru)", "ACI 318-19 (latest)"), "14": "SNI 2847:2019 / ACI 318-14" }, obj: cd, wide: true }, cd, ocC))
  d.append(el("div", "dz-sub", L("Edisi kode desain", "Design code edition")), gC,
    el("p", "dz-note", L("Baja: AISC 360-22 (rumus pipa bulat sama dengan SNI 1729:2020). Gempa: SNI 1726:2019 (tab Gempa). ACI 318-19 memakai faktor ukuran λs dan ρw pada geser satu arah telapak — kapasitas geser telapak tebal bisa jauh lebih kecil dibanding ACI 318-14.", "Steel: AISC 360-22 (round HSS equations same as SNI 1729:2020). Seismic: SNI 1726:2019 (Seismic tab). ACI 318-19 applies the size factor λs and ρw to one-way shear of footings — thick footings can have much lower shear capacity than under ACI 318-14.")))
  d.append(el("div", "dz-sub", L(`Angin — ${windCode()}`, `Wind — ${windCode()}`)), g2)
  const link = (href, ic, b, t) => { const a = el("a", "pj-link"); a.href = href; { const w = el("span", "pj-link-ic"); w.append(ico(ic)); a.append(w) } const x = el("span"); x.append(el("b", null, b), el("small", null, t)); a.append(x, el("span", "pj-go", "→")); return a }
  const ds = soilDS(PJ), lk = el("div", "pj-links")
  lk.append(link("#/gempa", "seismic", L("Gempa — tab Gempa (SNI 1726:2019)", "Seismic — Seismic tab (SNI 1726:2019)"), `Ss ${nf(ss.Ss, 3)} · S1 ${nf(ss.S1, 3)} · ${L("kelas", "class")} ${ss.cls}${ss.auto ? " (" + L("otomatis", "auto") + ")" : ""} · SDS ${nf(sp.SDS, 3)} · SD1 ${nf(sp.SD1, 3)} · KDS ${ss.SDC}`),
    link("#/tanah", "soil", L("Tanah — tab Tanah", "Soil — Soil tab"), `${PJ.soil.name} · ${PJ.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${ds.layers.length} ${L("lapis", "layers")} · MAT ${nf(ds.gwt, 1)} m · qa: ${QA_METHOD()[PJ.bear.method]}`))
  d.append(el("div", "dz-sub", L("Gempa & tanah (dari tab Gempa / Tanah — ubah di sana)", "Seismic & soil (from the Seismic / Soil tabs — edit there)")), lk)
  return d
}

// ---------------------------------------------------------------- hub
function hub(root, S) {
  const hero = el("section", "dz-hero dz-in")
  hero.innerHTML = `<div class="dz-hero-bg" aria-hidden="true"><i></i><i></i><i></i></div>`
  const h = el("div", "dz-hero-tx")
  h.append(el("span", "dz-kicker", L("Desain pondasi fasilitas migas", "Oil & gas facility foundation design")), el("h1", null, L("Desain Pondasi · Paket Lengkap", "Foundation Design · Complete Package")),
    el("p", null, L("Lima kalkulator desain. Pondasi peralatan bisa DANGKAL (telapak/mat, qa dari tab Tanah: N-SPT, CPT atau Vesic) atau DALAM (tiang pipa/bor, kapasitas dari tab Tanah). Gempa dari tab Gempa, penurunan otomatis ke tab Penurunan, kombinasi SNI 1727/ASCE 7 + PIP, pemeriksaan SNI 2847/ACI 318, AISC 360, API 650, ACI 351.3R, ekspor Excel & PDF — offline di iPad.",
      "Five design calculators. Equipment foundations can be SHALLOW (footing/mat, qa from the Soil tab: N-SPT, CPT or Vesic) or DEEP (pipe/bored piles, capacity from the Soil tab). Seismic from the Seismic tab, settlement feeds the Settlement tab, SNI 1727/ASCE 7 + PIP combinations, SNI 2847/ACI 318, AISC 360, API 650, ACI 351.3R checks, Excel & PDF export — offline on the iPad.")))
  const chips = el("div", "dz-chips")
  ;[windCode(), aciCode(), "AISC 360-22", "SNI 1726:2019 · 8460:2017", "API 650 · RP 2GEO", "ACI 351.3R", "PIP", "Excel · PDF"].forEach((c) => chips.append(el("span", "dz-chip", c)))
  h.append(chips)
  hero.append(h)
  const bar = el("div", "dz-hub-bar"); bar.append(unitsToggle(S, () => { root.textContent = ""; hub(root, S); reveal(root) }))
  const grid = el("div", "dz-hub")
  MODS.forEach((m, i) => {
    const a = el("a", "dz-card dz-in"); a.href = "#/desain/" + m.id; a.style.setProperty("--i", i)
    const ic = el("div", "dz-card-ic"); ic.append(ico(MOD_ICO[m.id]))
    a.append(ic, el("b", null, m.title()), el("span", "dz-card-tx", m.blurb()))
    const cc = el("div", "dz-card-codes"); edLabel(m.codes).split(" · ").slice(0, 4).forEach((c) => cc.append(el("span", null, c)))
    a.append(cc, el("span", "dz-go", L("Buka kalkulator →", "Open calculator →")))
    grid.append(a)
  })
  const save = (x) => { saveState(S); if (x) { root.textContent = ""; hub(root, S); reveal(root) } }
  root.append(stepper("desain", PJ), hero, bar, grid, projectCard(S, save), footer())
}
// alur perhitungan: kartu bernomor berurutan (kapasitas → beban → ukuran → tulangan → pemeriksaan → penurunan)
function flowView(flow) {
  const box = el("section", "dz-cflow dz-in")
  const h = el("div", "dz-cflow-h"); h.append(el("b", null, L("Alur perhitungan", "Calculation flow")), el("span", "hint", L("urutan desain dari data tanah sampai penurunan", "design sequence from soil data to settlement")))
  const row = el("ol", "dz-cflow-row")
  flow.forEach((f, i) => {
    const li = el("li", "dz-fstep" + (f.ok === false ? " bad" : f.ok === true ? " ok" : "")); li.style.setProperty("--i", i)
    const ic = el("span", "dz-fic"); ic.append(ico(f.ic)); const no = el("span", "dz-fno", String(i + 1))
    const tx = el("div", "dz-ftx"); tx.append(el("span", "dz-fti", f.t), el("b", "dz-fv", f.v), el("small", "dz-ff", f.f || ""), el("small", "dz-fs", f.sub || ""))
    li.append(no, ic, tx); row.append(li)
  })
  box.append(h, row)
  return box
}
function settleCard(sb) {
  const c = el("div", "dz-settle dz-in")
  const h = el("div", "dz-settle-h")
  { const w = el("span", "dz-settle-ic"); w.append(ico("settle")); h.append(w, el("div")) }
  h.lastChild.append(el("b", null, sb.kind === "deep" ? L("Penurunan kelompok tiang", "Pile group settlement") : L("Penurunan pondasi dangkal", "Shallow foundation settlement")), el("span", "hint", L(" · data tab Tanah, kriteria tab Penurunan", " · Soil tab data, Settlement tab criteria")))
  c.append(h)
  if (sb.error) c.append(el("p", "dz-note", sb.error))
  else {
    const tot = sb.s, ur = tot / sb.allow
    const g = el("div", "dz-settle-g")
    ;[[sb.kind === "deep" ? L("Segera + elastis", "Immediate + elastic") : L("Segera si", "Immediate si"), sb.si], [L("Konsolidasi sc", "Consolidation sc"), sb.sc], [L(`Total ${nf(sb.life, 0)} th`, `Total ${nf(sb.life, 0)} yr`), tot], [L("Izin", "Allowable"), sb.allow]]
      .forEach(([k, v]) => { const m = el("div", "dz-sm"); m.append(el("span", null, k), el("b", null, `${nf(v, 1)} mm`)); g.append(m) })
    c.append(g)
    const bar = el("div", "dz-bar"), fill = el("i", urClass(ur)), mk = el("b"); mk.style.left = `${100 / 1.2}%`
    fill.style.transform = "scaleX(0)"; bar.append(fill, mk); c.append(bar)
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transform = `scaleX(${Math.min(ur, 1.2) / 1.2})` }))
  }
  const btn = el("button", "dz-btn ghost dz-settle-go"); btn.type = "button"
  btn.innerHTML = `<span class="ic">↗</span><span><b>${L("Buka di tab Penurunan", "Open in Settlement tab")}</b><small>${L("rincian segera, konsolidasi, kurva waktu", "immediate, consolidation, time curve details")}</small></span>`
  btn.onclick = () => { PJ.settle.sel = "mod:" + sb.mod; projSave(PJ); location.hash = "#/penurunan" }
  c.append(btn)
  return c
}
const footer = () => { const f = el("p", "dz-foot"); f.innerHTML = `© ${AUTHOR} · YMD-CAL · ${L("pembanding desain, ikuti Design Basis & kode yang berlaku", "design cross-check; follow the Design Basis & governing codes")}`; return f }

// ---------------------------------------------------------------- halaman modul
function page(root, S, mod) {
  const st = S.m[mod.id], cmb = S.cmb[mod.id]
  // kepala
  const head = el("div", "dz-head dz-in")
  const crumbs = el("div", "dz-crumb"); const back = el("a", null, L("← Desain", "← Design")); back.href = "#/desain"; crumbs.append(back)
  const sw = el("div", "dz-switch")
  MODS.forEach((m) => { const a = el("a", "dz-sw" + (m === mod ? " on" : "")); a.append(ico(MOD_ICO[m.id]), document.createTextNode(m.title().split(" (")[0].replace("Pondasi ", "").replace(" Foundation", ""))); a.href = "#/desain/" + m.id; sw.append(a) })
  crumbs.append(sw)
  const ttl = el("div", "dz-ttl"); { const w = el("span", "dz-ttl-ic"); w.append(ico(MOD_ICO[mod.id])); ttl.append(w) } const tt = el("div"); const codesEl = el("p", "dz-codes", edLabel(mod.codes)); tt.append(el("h1", null, mod.title()), codesEl); ttl.append(tt)
  head.append(crumbs, ttl)
  const status = el("a", "dz-status"); status.href = "#"
  status.onclick = (e) => { e.preventDefault(); resBox.scrollIntoView({ behavior: "smooth", block: "start" }) }
  const nav = el("div", "dz-jump")
  const tools = el("div", "dz-tools")
  const projBox = el("div"), formBox = el("div", "dz-form"), cmbWrap = el("details", "dz-sec dz-in"), resBox = el("div", "dz-res"), expBox = el("div", "dz-expbox dz-in")
  const cmbSum = el("summary"); { const w = el("span", "dz-ico"); w.append(ico("calc")); cmbSum.append(w, el("span", "dz-st", edLabel(L("Kombinasi beban (SNI 1727:2020 / ASCE 7-16 + PIP STC01015)", "Load combinations (SNI 1727:2020 / ASCE 7-16 + PIP STC01015)")))) }
  const cmbCount = el("span", "dz-badge"); cmbSum.append(cmbCount)
  const cmbBox = el("div"); cmbWrap.append(cmbSum, cmbBox)
  ;[[L("Masukan", "Input"), formBox], [L("Kombinasi", "Combinations"), cmbWrap], [L("Hasil", "Results"), resBox], [L("Ekspor", "Export"), expBox]].forEach(([t, target]) => {
    const b = el("button", "dz-jb", t); b.type = "button"; b.onclick = () => target.scrollIntoView({ behavior: "smooth", block: "start" }); nav.append(b)
  })
  tools.append(nav, unitsToggle(S, () => { drawForm(); compute(true) }))
  root.append(head, status, tools, projBox, formBox, cmbWrap, resBox, expBox, footer())

  let last = null, timer = 0, onlyBad = false, drawIx = 0
  const ctx = () => designCtx(S, PJ, cmb)
  const changed = (structural) => {
    saveState(S)
    if (structural) drawForm()
    clearTimeout(timer); timer = setTimeout(() => compute(structural), structural ? 0 : 160)
  }
  function drawForm() {
    projBox.textContent = ""; projBox.append(projectCard(S, (x) => { saveState(S); if (x) { drawForm() } clearTimeout(timer); timer = setTimeout(() => compute(true), 120) }))
    renderForm(formBox, mod.form(st, changed), st, changed)
    reveal(root)
  }
  function compute(redrawCmb) {
    if (formBox.__refresh) formBox.__refresh()
    let out
    try { out = relabel(mod.run(st, ctx())); codesEl.textContent = edLabel(mod.codes) } catch (e) {
      console.error(e)
      resBox.textContent = ""; resBox.append(el("div", "err", L("Perhitungan gagal: ", "Calculation failed: ") + e.message))
      status.className = "dz-status bad"; status.textContent = "⚠️ " + e.message
      return
    }
    last = out
    const cnt = { ASD: 0, LRFD: 0 }; out.combos.forEach((c) => cnt[c.kind]++)
    cmbCount.textContent = `${out.combos.length} · ASD ${cnt.ASD} · LRFD ${cnt.LRFD}`
    if (redrawCmb || !cmbBox.childNodes.length) comboEditor(cmbBox, cmb, out.cases, out.combos, (x) => { saveState(S); clearTimeout(timer); timer = setTimeout(() => compute(true), 80) })
    renderResults(out)
    reveal(root)
  }
  function renderResults(out) {
    resBox.textContent = ""
    const ok = out.checks.every((c) => c.ok || c.info), g = govern(out.checks), gf = g ? fmtCheck(g) : null
    const nBad = out.checks.filter((c) => !c.ok && !c.info).length
    status.className = "dz-status " + (ok ? "ok" : "bad")
    status.textContent = ""
    const pill = el("span", "dz-pill " + (ok ? "ok" : "bad"), ok ? L("✓ SEMUA OK", "✓ ALL OK") : `✕ ${nBad} ${L("TIDAK OK", "NOT OK")}`)
    const txt = el("span", "dz-gov", g ? `${L("Menentukan", "Governing")}: ${g.item} · UR ${gf.urTxt}${g.note ? " · " + g.note : ""}` : "")
    const ur = el("span", "dz-ur " + (g ? urClass(g.ur) : "uok"), g ? gf.urTxt : "")
    status.append(pill, txt, ur)
    status.classList.remove("flash"); void status.offsetWidth; status.classList.add("flash")
    resBox.append(el("h2", "dz-h2", L("Hasil desain", "Design results")))
    if (out.flow && out.flow.length) resBox.append(flowView(out.flow))
    // gambar + metrik
    const hero = el("div", "dz-hero2 dz-in")
    const figBox = el("div", "dz-fig")
    const tabs = el("div", "dz-figtabs")
    const show = (i) => {
      drawIx = i
      ;[...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i))
      figBox.querySelectorAll(".dz-figwrap").forEach((n) => n.remove())
      const w = el("div", "dz-figwrap" + (out.drawings[i].small ? " small" : ""))
      try { w.append(out.drawings[i].make("screen")) } catch (e) { console.error(e); w.append(el("div", "err", e.message)) }
      w.append(el("p", "dz-cap", out.drawings[i].cap))
      figBox.append(w)
    }
    if (out.drawings.length > 1) out.drawings.forEach((d, i) => { const b = el("button", "dz-ft", `${L("Gambar", "Figure")} ${i + 1}`); b.type = "button"; b.onclick = () => show(i); tabs.append(b) })
    figBox.append(tabs)
    hero.append(metricsView(out.metrics, mod.id), figBox)
    resBox.append(hero)
    show(Math.min(drawIx, out.drawings.length - 1))
    // penurunan (terhubung ke tab Penurunan)
    if (out.settle) resBox.append(settleCard(out.settle))
    // pemeriksaan
    const ch = el("div", "dz-chkhead")
    ch.append(el("h3", null, L("Pemeriksaan desain", "Design checks")))
    const fb = el("button", "dz-filter" + (onlyBad ? " on" : ""), onlyBad ? L("Tampilkan semua", "Show all") : L("Hanya yang tidak OK", "Only failures")); fb.type = "button"
    fb.onclick = () => { onlyBad = !onlyBad; renderResults(out); reveal(root) }
    ch.append(fb)
    resBox.append(ch)
    const cv = checksView(out.checks, mod.id, onlyBad)
    if (onlyBad && !cv.childNodes.length) cv.append(el("p", "dz-note", L("Tidak ada pemeriksaan yang gagal. 🎉", "No failing checks. 🎉")))
    resBox.append(cv)
    // tabel
    resBox.append(el("h3", "dz-h3", L("Rincian beban, kombinasi & perhitungan", "Load, combination & calculation details")))
    out.tables.forEach((t, i) => {
      const d = el("details", "dz-tdet dz-in"); d.open = i < 1 || t.rows.length <= 6; d.style.setProperty("--i", i)
      const sm = el("summary", null, t.title); sm.append(el("span", "dz-badge", `${t.rows.length}`)); d.append(sm)
      d.append(tableView({ ...t, title: "" }))
      resBox.append(d)
    })
    if (out.steps && out.steps.length) {
      const sd = el("details", "dz-steps dz-in")
      const ss = el("summary"); const icS = el("span", "dz-ico"); icS.append(ico("ruler")); ss.append(icS, el("span", null, L("Lembar perhitungan langkah demi langkah", "Step-by-step calculation sheet")), el("span", "dz-badge", `${out.steps.length} ${L("bagian", "parts")}`))
      sd.append(ss)
      out.steps.forEach((st, i) => {
        const w = el("div", "dz-step"); w.style.setProperty("--i", i)
        w.append(el("div", "dz-step-h", st.h))
        const tb = el("table", "dz-res dz-steptbl"), hr = el("tr")
        ;[L("Besaran", "Quantity"), L("Rumus", "Formula"), L("Substitusi", "Substitution"), L("Hasil", "Result")].forEach((h) => hr.append(el("th", null, h)))
        tb.append(hr)
        st.rows.forEach((r) => { const tr = el("tr"); r.forEach((c, j) => tr.append(el("td", j === 1 ? "f" : j === 3 ? "r" : "", c))); tb.append(tr) })
        const tw = el("div", "dz-tw"); tw.append(tb); w.append(tw)
        sd.append(w)
      })
      resBox.append(sd)
    }
    const kvd = el("details", "dz-tdet dz-in"); kvd.append(el("summary", null, L("Ringkasan data masukan", "Input summary")))
    out.kv.forEach((b) => kvd.append(tableView({ title: b.title, cols: [L("Parameter", "Parameter"), L("Nilai", "Value"), L("Satuan", "Unit")], rows: b.rows.map(([a, v, u, d]) => [a, typeof v === "number" ? nf(v, d ?? 3) : v, u || ""]), align: ["l", "r", "l"] })))
    resBox.append(kvd)
    const nt = el("div", "dz-notes dz-in"); nt.append(el("b", null, L("Dasar perhitungan & batasan", "Basis & limitations"))); const ul = el("ul"); out.notes.forEach((n) => ul.append(el("li", null, n))); nt.append(ul)
    resBox.append(nt)
    exportBar(expBox, () => last, { ...S, project: PJ.info })
  }
  drawForm(); compute(true)
}
