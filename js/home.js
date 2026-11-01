import { ico, MOD_ICO } from "./icons.js"
// Beranda YMD-CAL: hero ringkas, dashboard status semua kalkulator (dihitung dari masukan tersimpan), dan kartu Alur Produksi Migas.
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const svgNS = "http://www.w3.org/2000/svg"
const sv = (tag, a) => { const e = document.createElementNS(svgNS, tag); for (const k in a) e.setAttribute(k, a[k]); return e }
const nf = (x, d = 1) => (x == null || !isFinite(x) ? "–" : Number(x).toFixed(d))

export function mountHome(app, ctx) {
  const L = (id, en) => (ctx.lang === "en" ? en : id)
  app.textContent = ""
  // ---- hero
  const hero = el("section", "hm-hero")
  hero.innerHTML = `<div class="hm-orbs" aria-hidden="true"><i></i><i></i></div>`
  const logo = el("div", "hm-logo"); logo.innerHTML = document.querySelector(".brand .logo").innerHTML
  const tx = el("div", "hm-tx")
  const h1 = el("h1"); h1.innerHTML = `YMD<i>-CAL</i>`
  tx.append(el("span", "hm-kicker", L("Kalkulator desain sipil migas · offline", "Oil & gas civil design calculator · offline")), h1,
    el("p", null, L("Satu proyek, satu alur: data tanah (N-SPT/CPT) → parameter gempa → desain pondasi dangkal atau dalam (tiang, tangki, vessel, peralatan dinamis, trafo) → penurunan → laporan Excel & PDF.",
      "One project, one flow: soil data (SPT/CPT) → seismic parameters → shallow or deep foundation design (piles, tanks, vessels, dynamic equipment, transformers) → settlement → Excel & PDF report.")))
  const cta = el("div", "hm-cta")
  const a1 = el("a", "hm-btn pri", L("Mulai dari data tanah →", "Start with soil data →")); a1.href = "#/tanah"
  const a3 = el("a", "hm-btn", L("Desain", "Design")); a3.href = "#/desain"
  const a2 = el("a", "hm-btn", L("Alur produksi migas", "Oil & gas flow")); a2.href = "#/alur"
  cta.append(a1, a3, a2); tx.append(cta)
  hero.append(logo, tx)
  app.append(hero)
  // ---- alur proyek
  const wf = el("div", "hm-sech"); wf.append(el("h2", null, L("Alur proyek", "Project workflow")), el("span", "hm-meta", L("Tanah → Gempa → Desain → Penurunan → Laporan", "Soil → Seismic → Design → Settlement → Report")))
  const wfBox = el("div", "hm-wf")
  app.append(wf, wfBox)

  // ---- dashboard
  const dh = el("div", "hm-sech"); dh.append(el("h2", null, L("Dashboard", "Dashboard")), el("span", "hm-meta", L("dihitung dari masukan terakhir", "computed from your latest inputs")))
  const stats = el("div", "hm-stats"), grid = el("div", "hm-grid")
  for (let i = 0; i < 3; i++) stats.append(el("div", "hm-stat sk"))
  for (let i = 0; i < 6; i++) grid.append(el("div", "hm-tile sk"))
  app.append(dh, stats, grid)

  // ---- alur migas
  const fl = el("a", "hm-flow"); fl.href = "#/alur"
  const ft = el("div", "hm-flow-tx")
  ft.append(el("span", "hm-kicker", L("Referensi proses", "Process reference")), el("h2", null, L("Alur Produksi Migas", "Oil & Gas Production Flow")),
    el("p", null, L("Dari sumur sampai gathering station: PFD, dua P&ID bergerak, 12 animasi alat dengan narasi suara (play/pause), dan catatan sipil/struktur — langsung terhubung ke kalkulator desain tiap peralatan.",
      "From the well to the gathering station: PFD, two animated P&IDs, 12 equipment animations with voice narration (play/pause), and civil/structural notes — linked straight to each equipment's design calculator.")),
    el("span", "hm-go", L("Jelajahi alur →", "Explore the flow →")))
  const img = el("img", "hm-flow-img"); img.alt = L("Ilustrasi alur produksi migas", "Oil & gas production flow illustration"); img.loading = "lazy"
  img.src = `assets/hero_${ctx.dark ? "dark" : "cloud"}${ctx.lang === "en" ? "_en" : ""}.svg`
  fl.append(ft, img)
  app.append(fl)

  // ---- pasang & kaki
  const ins = el("details", "hm-install")
  ins.append(el("summary", null, L("📲 Pasang di iPad (offline)", "📲 Install on iPad (offline)")))
  const ol = el("ol")
  ;[L("Buka alamat ini di Safari sekali saat ada internet.", "Open this address in Safari once while online."), L("Ketuk Bagikan → Tambah ke Layar Utama.", "Tap Share → Add to Home Screen."),
    L("Buka dari ikon YMD-CAL: layar penuh dan jalan tanpa internet. Saat ada versi baru, ketuk Muat ulang.", "Open from the YMD-CAL icon: full screen and works offline. When a new version arrives, tap Reload.")].forEach((x) => ol.append(el("li", null, x)))
  ins.append(ol)
  app.append(ins, el("p", "hm-foot", `© Yan Malegi Diardi · YMD-CAL · ${L("alat bantu desain; ikuti Design Basis & kode yang berlaku", "design aid; follow the Design Basis & governing codes")}`))

  // isi dashboard setelah halaman tampil (perhitungan semua modul ± 0,3 detik)
  setTimeout(async () => {
    let D, PJ
    try {
      const [dm, pj] = await Promise.all([import("./desain_ui.js"), import("./project.js")])
      D = dm.dashboard(ctx.lang); PJ = pj
      wfBox.append(pj.stepper("", pj.projLoad()))
    } catch (e) { grid.textContent = ""; grid.append(el("div", "err", e.message)); return }
    if (!app.isConnected) return
    const okMods = D.mods.filter((m) => m.ok).length, nChk = D.mods.reduce((a, m) => a + (m.nChk || 0), 0), nBad = D.mods.reduce((a, m) => a + (m.nBad || 0), 0)
    const sMax = D.mods.filter((m) => m.settle).reduce((a, m) => (!a || m.settle.s > a.settle.s ? m : a), null)
    stats.textContent = ""
    const stat = (lab, val, sub, cls) => { const c = el("div", "hm-stat " + (cls || "")); c.append(el("span", null, lab), el("b", null, val), el("small", null, sub)); return c }
    stats.append(stat(L("Kalkulator memenuhi", "Calculators passing"), `${okMods} / ${D.mods.length}`, L("semua pemeriksaan OK", "all checks OK"), okMods === D.mods.length ? "ok" : "bad"),
      stat(L("Pemeriksaan", "Checks"), `${nChk - nBad} / ${nChk}`, nBad ? `${nBad} ${L("tidak OK", "not OK")}` : L("tanpa kegagalan", "no failures"), nBad ? "bad" : "ok"),
      stat(L("Penurunan terbesar", "Largest settlement"), sMax ? `${nf(sMax.settle.s, 1)} mm` : "–", sMax ? sMax.title.split(" (")[0] : "", sMax && sMax.settle.s > sMax.settle.allow ? "bad" : "ok"))
    const chips = el("div", "hm-chips")
    ;[[L("Proyek", "Project"), D.project.name || "–"], ["Doc", D.project.doc || "–"], ["V", `${nf(D.site.V, 0)} m/s · ${D.site.exp}`], [L("Kelas situs", "Site class"), D.ss.cls], ["SDS", nf(D.sp.SDS, 3)], [L("Kode", "Codes"), D.codes], [L("Satuan", "Units"), D.units === "t" ? "ton · t/m²" : "kN · kPa"]]
      .forEach(([k, v]) => chips.append(el("span", null, `${k}: ${v}`)))
    stats.append(chips)
    grid.textContent = ""
    D.mods.forEach((m, i) => grid.append(tile(m, i, L)))
    // tile penurunan (semua pondasi dari modul Desain)
    const t = el("a", "hm-tile in"); t.href = "#/penurunan"; t.style.setProperty("--i", D.mods.length)
    const top = el("div", "hm-tile-top"); const icS = el("span", "hm-ic"); icS.append(ico("settle")); top.append(icS, el("b", null, L("Penurunan Pondasi", "Foundation Settlement")))
    t.append(top)
    const st = D.mods.filter((m) => m.settle)
    if (!sMax) t.append(el("p", "hm-sub", L("Belum ada hasil penurunan.", "No settlement results yet.")))
    else {
      const w = st.reduce((a, m) => (!a || m.settle.s / m.settle.allow > a.settle.s / a.settle.allow ? m : a), null), ok = w.settle.s <= w.settle.allow
      t.append(el("p", "hm-sub", `${st.length} ${L("pondasi", "foundations")} · ${st.filter((m) => m.settle.kind === "deep").length} ${L("tiang", "piled")} · ${L("penentu", "governing")}: ${w.title.split(" (")[0]}`))
      t.append(gauge(w.settle.s / w.settle.allow, `${nf(w.settle.s, 1)} / ${nf(w.settle.allow, 0)} mm`, ok, ok ? "✓ OK" : L("✕ melebihi izin", "✕ exceeds limit"), L("segera + konsolidasi vs izin", "immediate + consolidation vs limit")))
    }
    t.append(el("span", "hm-open", L("Buka →", "Open →")))
    grid.append(t)
  }, 60)
}

function tile(m, i, L) {
  const a = el("a", "hm-tile in"); a.href = "#/desain/" + m.id; a.style.setProperty("--i", i)
  const top = el("div", "hm-tile-top"); const icM = el("span", "hm-ic"); icM.append(ico(MOD_ICO[m.id])); top.append(icM, el("b", null, m.title))
  a.append(top)
  if (m.error) { a.append(el("p", "hm-sub", m.error)); return a }
  a.append(el("p", "hm-sub", m.sub))
  if (m.fdType) a.append(el("span", "hm-fd " + m.fdType, m.fdType === "deep" ? L("DALAM · tiang", "DEEP · piles") : L("DANGKAL", "SHALLOW")))
  a.append(gauge(m.gov ? m.gov.ur : 0, m.gov ? `UR ${isFinite(m.gov.ur) ? m.gov.ur.toFixed(3) : "∞"}` : "", m.ok, m.ok ? L("✓ OK", "✓ OK") : `✕ ${m.nBad} ${L("tidak OK", "not OK")}`, m.gov ? m.gov.item : ""))
  a.append(el("span", "hm-open", `${m.nCmb} ${L("kombinasi", "combinations")} · ${L("Buka →", "Open →")}`))
  return a
}
function gauge(ur, label, ok, pill, item) {
  const w = el("div", "hm-gauge")
  const s = sv("svg", { viewBox: "0 0 64 64", class: "hm-ring" })
  const r = 26, C = 2 * Math.PI * r, f = Math.min(isFinite(ur) ? ur : 1.2, 1.2) / 1.2
  s.append(sv("circle", { cx: 32, cy: 32, r, class: "hm-ring-bg" }))
  const arc = sv("circle", { cx: 32, cy: 32, r, class: "hm-ring-fg " + (!isFinite(ur) || ur > 1 ? "bad" : ur > 0.9 ? "warn" : "ok"), "stroke-dasharray": `${C} ${C}`, "stroke-dashoffset": C, transform: "rotate(-90 32 32)" })
  s.append(arc)
  requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute("stroke-dashoffset", C * (1 - f))))
  const t = el("div", "hm-gauge-tx")
  if (pill) t.append(el("span", "hm-pill " + (ok ? "ok" : "bad"), pill))
  t.append(el("b", null, label))
  if (item) t.append(el("small", null, item))
  w.append(s, t)
  return w
}
