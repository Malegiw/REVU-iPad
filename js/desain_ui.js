// Halaman "Desain Pondasi": hub 5 kalkulator + halaman modul (formulir, beban, kombinasi, hasil beranimasi, ekspor Excel/PDF).
// Rumus ada di js/desain/*.js (fungsi murni, diuji di tests/suite_desain.js). Teks dua bahasa lewat L(id, en).
import { L, lang, units, nf, SITES, AUTHOR, govern, seismicParams, uName } from "./desain/core.js"
import { el, loadState, saveState, siteCtx, renderForm, comboEditor, checksView, metricsView, tableView, exportBar, reveal, field, fmtCheck, urClass } from "./desain/ui.js"
import * as tiang from "./desain/m_tiang.js"
import * as tangki from "./desain/m_tangki.js"
import * as vessel from "./desain/m_vessel.js"
import * as dinamis from "./desain/m_dinamis.js"
import * as trafo from "./desain/m_trafo.js"

export const MODS = [tiang, tangki, vessel, dinamis, trafo]
const CMB0 = () => ({ en: {}, fx: {}, ortho: false, wp: 0.5 })
function defaults() {
  return {
    units: "si", project: { name: "", client: "", doc: "", rev: "0", eng: AUTHOR, chk: "" },
    site: { V: 32, exp: "C", Kzt: 1, Kd: 0.95, Ss: 0.8, S1: 0.35, cls: "SD", TL: 8 },
    m: Object.fromEntries(MODS.map((m) => [m.id, m.defaults()])), cmb: Object.fromEntries(MODS.map((m) => [m.id, CMB0()])),
  }
}

// Ringkasan semua modul untuk dashboard beranda: jalankan tiap modul dengan masukan tersimpan
export function dashboard(lng) {
  lang.cur = lng
  const S = loadState(defaults)
  for (const m of MODS) S.cmb[m.id] = { ...CMB0(), ...(S.cmb[m.id] || {}) }
  units.sys = S.units === "t" ? "t" : "si"
  const sc = siteCtx(S.site)
  const mods = MODS.map((m) => {
    const cmb = S.cmb[m.id]
    try {
      const out = m.run(S.m[m.id], { ...sc, cmbOpts: { SDS: sc.sp.SDS, wpFrac: cmb.wp, ortho: cmb.ortho, enabled: cmb.en, factors: cmb.fx } })
      const g = govern(out.checks), bad = out.checks.filter((c) => !c.ok && !c.info)
      const st = out.settle && out.settle.r.res ? { s: out.settle.r.res.s_life * 1000, allow: out.settle.r.allow } : null
      return { id: m.id, icon: m.icon, title: m.title(), sub: out.sub, nChk: out.checks.filter((c) => !c.info).length, nBad: bad.length, gov: g, ok: !bad.length, settle: st, nCmb: out.combos.length }
    } catch (e) { return { id: m.id, icon: m.icon, title: m.title(), error: e.message } }
  })
  return { project: S.project, site: S.site, sp: sc.sp, units: units.sys, mods }
}

export function mountDesain(root, ctx, sub) {
  lang.cur = ctx.lang
  const S = loadState(defaults)
  for (const m of MODS) S.cmb[m.id] = { ...CMB0(), ...(S.cmb[m.id] || {}) }
  units.sys = S.units === "t" ? "t" : "si"
  const mod = MODS.find((m) => m.id === sub)
  root.textContent = ""
  if (!mod) hub(root, S)
  else page(root, S, mod)
  reveal(root)
}

// ---------------------------------------------------------------- bagian bersama: satuan, proyek, lokasi
function unitsToggle(S, onChange) {
  const g = el("div", "dz-units")
  g.append(el("span", "lb", L("Satuan", "Units")))
  ;[["si", "kN · kPa"], ["t", "ton · t/m²"]].forEach(([k, v]) => {
    const b = el("button", "dz-ub" + (units.sys === k ? " on" : ""), v); b.type = "button"
    b.onclick = () => { S.units = k; units.sys = k; saveState(S); onChange() }
    g.append(b)
  })
  return g
}
let projOpen = false
function projectCard(S, onChange) {
  const d = el("details", "dz-sec dz-in on"); d.open = projOpen
  d.addEventListener("toggle", () => { projOpen = d.open })
  const sm = el("summary"); sm.append(el("span", "dz-ico", "📁"), el("span", "dz-st", L("Data proyek & lokasi (angin, gempa)", "Project & site data (wind, seismic)")))
  const sp = seismicParams(S.site.Ss, S.site.S1, S.site.cls)
  sm.append(el("span", "dz-badge", `V ${nf(S.site.V, 0)} m/s · SDS ${nf(sp.SDS, 3)}`))
  d.append(sm)
  const P = S.project, g1 = el("div", "dz-grid")
  ;[["name", L("Nama proyek", "Project name")], ["client", L("Klien", "Client")], ["doc", L("No. dokumen", "Document no.")], ["rev", "Rev."], ["eng", L("Dihitung oleh", "Prepared by")], ["chk", L("Diperiksa oleh", "Checked by")]]
    .forEach(([k, lab]) => g1.append(field({ k, lab, type: "txt", obj: P }, S, () => onChange(false))))
  d.append(el("div", "dz-sub", L("Proyek (muncul di kepala laporan Excel/PDF)", "Project (shown in the Excel/PDF report header)")), g1)
  const st = S.site, g2 = el("div", "dz-grid"), oc = (x) => onChange(x)
  g2.append(field({ k: "V", lab: L("Kecepatan angin dasar V (3 detik)", "Basic wind speed V (3-s gust)"), u: "m/s", lo: 10, hi: 90, obj: st, help: L("SNI 1727:2020 Gambar 26.5-1 / data meteorologi lokasi.", "SNI 1727:2020 Fig. 26.5-1 / site meteorological data.") }, S, oc))
  g2.append(field({ k: "exp", type: "seg", lab: L("Kategori eksposur", "Exposure category"), opts: { B: "B", C: "C", D: "D" }, obj: st }, S, oc))
  g2.append(field({ k: "Kzt", lab: "Kzt", u: "", lo: 1, hi: 3, obj: st }, S, oc), field({ k: "Kd", lab: "Kd", u: "", lo: 0.85, hi: 1, obj: st, help: L("0,95 tangki/silinder; 0,85 struktur lain.", "0.95 tanks/cylinders; 0.85 other structures.") }, S, oc))
  const g3 = el("div", "dz-grid")
  g3.append(field({ k: "Ss", lab: "Ss (g)", u: "", lo: 0, hi: 3, obj: st, help: L("Peta gempa SNI 1726:2019 / puskim.", "SNI 1726:2019 hazard map / puskim.") }, S, oc), field({ k: "S1", lab: "S1 (g)", u: "", lo: 0, hi: 1.5, obj: st }, S, oc))
  g3.append(field({ k: "cls", type: "seg", lab: L("Kelas situs", "Site class"), opts: Object.fromEntries(SITES.map((s) => [s, s])), obj: st }, S, oc), field({ k: "TL", lab: "TL (s)", u: "s", lo: 2, hi: 20, obj: st }, S, oc))
  d.append(el("div", "dz-sub", L("Angin — SNI 1727:2020 (ASCE 7-16)", "Wind — SNI 1727:2020 (ASCE 7-16)")), g2, el("div", "dz-sub", L("Gempa — SNI 1726:2019", "Seismic — SNI 1726:2019")), g3)
  const info = el("div", "dz-chips")
  ;[["Fa", sp.Fa, 2], ["Fv", sp.Fv, 2], ["SMS", sp.SMS, 3], ["SM1", sp.SM1, 3], ["SDS", sp.SDS, 3], ["SD1", sp.SD1, 3], ["Ts", sp.Ts, 3]].forEach(([k, v, dd]) => info.append(el("span", "dz-chip", `${k} = ${nf(v, dd)}`)))
  d.append(info)
  return d
}

// ---------------------------------------------------------------- hub
function hub(root, S) {
  const hero = el("section", "dz-hero dz-in")
  hero.innerHTML = `<div class="dz-hero-bg" aria-hidden="true"><i></i><i></i><i></i></div>`
  const h = el("div", "dz-hero-tx")
  h.append(el("span", "dz-kicker", L("Desain pondasi fasilitas migas", "Oil & gas facility foundation design")), el("h1", null, L("Desain Pondasi · Paket Lengkap", "Foundation Design · Complete Package")),
    el("p", null, L("Lima kalkulator desain dengan input beban, kombinasi SNI 1727/ASCE 7 + PIP otomatis, pemeriksaan geoteknik & struktur (SNI 2847/ACI 318, AISC 360, API 650, ACI 351.3R), dan ekspor laporan Excel & PDF. Semua berjalan offline di iPad.",
      "Five design calculators with load input, automatic SNI 1727/ASCE 7 + PIP combinations, geotechnical & structural checks (SNI 2847/ACI 318, AISC 360, API 650, ACI 351.3R), and Excel & PDF report export. Everything runs offline on the iPad.")))
  const chips = el("div", "dz-chips")
  ;["SNI 1726 · 1727 · 2847 · 8460", "AISC 360-16", "ACI 318M · 351.3R", "API 650 · RP 2GEO", "PIP", "Excel · PDF"].forEach((c) => chips.append(el("span", "dz-chip", c)))
  h.append(chips)
  hero.append(h)
  const bar = el("div", "dz-hub-bar"); bar.append(unitsToggle(S, () => { root.textContent = ""; hub(root, S); reveal(root) }))
  const grid = el("div", "dz-hub")
  MODS.forEach((m, i) => {
    const a = el("a", "dz-card dz-in"); a.href = "#/desain/" + m.id; a.style.setProperty("--i", i)
    const ic = el("div", "dz-card-ic", m.icon)
    a.append(ic, el("b", null, m.title()), el("span", "dz-card-tx", m.blurb()))
    const cc = el("div", "dz-card-codes"); m.codes.split(" · ").slice(0, 4).forEach((c) => cc.append(el("span", null, c)))
    a.append(cc, el("span", "dz-go", L("Buka kalkulator →", "Open calculator →")))
    grid.append(a)
  })
  const save = (x) => { saveState(S); if (x) { root.textContent = ""; hub(root, S); reveal(root) } }
  root.append(hero, bar, grid, projectCard(S, save), footer())
}
function settleCard(sb) {
  const c = el("div", "dz-settle dz-in")
  const h = el("div", "dz-settle-h")
  h.append(el("span", "dz-settle-ic", "📉"), el("div"))
  h.lastChild.append(el("b", null, L("Penurunan pondasi", "Foundation settlement")), el("span", "hint", L(" · terhubung ke tab Penurunan (profil tanah, konsolidasi, batas izin)", " · linked to the Settlement tab (soil profile, consolidation, limit)")))
  c.append(h)
  if (sb.r.error) c.append(el("p", "dz-note", sb.r.error))
  else {
    const x = sb.r.res, tot = x.s_life * 1000, ur = tot / sb.r.allow
    const g = el("div", "dz-settle-g")
    ;[[L("Segera si", "Immediate si"), x.si * 1000], [L("Konsolidasi sc", "Consolidation sc"), x.sc * 1000], [L(`Total ${nf(sb.r.life, 0)} th`, `Total ${nf(sb.r.life, 0)} yr`), tot], [L("Izin", "Allowable"), sb.r.allow]]
      .forEach(([k, v]) => { const m = el("div", "dz-sm"); m.append(el("span", null, k), el("b", null, `${nf(v, 1)} mm`)); g.append(m) })
    c.append(g)
    const bar = el("div", "dz-bar"), fill = el("i", urClass(ur)), mk = el("b"); mk.style.left = `${100 / 1.2}%`
    fill.style.transform = "scaleX(0)"; bar.append(fill, mk); c.append(bar)
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transform = `scaleX(${Math.min(ur, 1.2) / 1.2})` }))
  }
  const btn = el("button", "dz-btn ghost dz-settle-go"); btn.type = "button"
  btn.innerHTML = `<span class="ic">↗</span><span><b>${L("Buka di tab Penurunan", "Open in Settlement tab")}</b><small>${L("kirim B, L, Df, q dari desain ini", "send B, L, Df, q from this design")}</small></span>`
  btn.onclick = () => { sb.send(); location.hash = "#/penurunan" }
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
  MODS.forEach((m) => { const a = el("a", "dz-sw" + (m === mod ? " on" : ""), `${m.icon} ${m.title().split(" (")[0].replace("Pondasi ", "").replace(" Foundation", "")}`); a.href = "#/desain/" + m.id; sw.append(a) })
  crumbs.append(sw)
  const ttl = el("div", "dz-ttl"); ttl.append(el("span", "dz-ttl-ic", mod.icon)); const tt = el("div"); tt.append(el("h1", null, mod.title()), el("p", "dz-codes", mod.codes)); ttl.append(tt)
  head.append(crumbs, ttl)
  const status = el("a", "dz-status"); status.href = "#"
  status.onclick = (e) => { e.preventDefault(); resBox.scrollIntoView({ behavior: "smooth", block: "start" }) }
  const nav = el("div", "dz-jump")
  const tools = el("div", "dz-tools")
  const projBox = el("div"), formBox = el("div", "dz-form"), cmbWrap = el("details", "dz-sec dz-in"), resBox = el("div", "dz-res"), expBox = el("div", "dz-expbox dz-in")
  const cmbSum = el("summary"); cmbSum.append(el("span", "dz-ico", "🧮"), el("span", "dz-st", L("Kombinasi beban (SNI 1727:2020 / ASCE 7-16 + PIP STC01015)", "Load combinations (SNI 1727:2020 / ASCE 7-16 + PIP STC01015)")))
  const cmbCount = el("span", "dz-badge"); cmbSum.append(cmbCount)
  const cmbBox = el("div"); cmbWrap.append(cmbSum, cmbBox)
  ;[[L("Masukan", "Input"), formBox], [L("Kombinasi", "Combinations"), cmbWrap], [L("Hasil", "Results"), resBox], [L("Ekspor", "Export"), expBox]].forEach(([t, target]) => {
    const b = el("button", "dz-jb", t); b.type = "button"; b.onclick = () => target.scrollIntoView({ behavior: "smooth", block: "start" }); nav.append(b)
  })
  tools.append(nav, unitsToggle(S, () => { drawForm(); compute(true) }))
  root.append(head, status, tools, projBox, formBox, cmbWrap, resBox, expBox, footer())

  let last = null, timer = 0, onlyBad = false, drawIx = 0
  const ctx = () => {
    const sc = siteCtx(S.site)
    return { ...sc, cmbOpts: { SDS: sc.sp.SDS, wpFrac: cmb.wp, ortho: cmb.ortho, enabled: cmb.en, factors: cmb.fx } }
  }
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
    try { out = mod.run(st, ctx()) } catch (e) {
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
      const ss = el("summary"); ss.append(el("span", "dz-ico", "📐"), el("span", null, L("Lembar perhitungan langkah demi langkah", "Step-by-step calculation sheet")), el("span", "dz-badge", `${out.steps.length} ${L("bagian", "parts")}`))
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
    exportBar(expBox, () => last, S)
  }
  drawForm(); compute(true)
}
