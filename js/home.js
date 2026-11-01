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
    el("p", null, L("Desain pondasi tiang, tangki, vessel, peralatan dinamis, dan trafo dengan kombinasi beban SNI/ASCE, penurunan terhubung, serta laporan Excel & PDF.",
      "Design piles, tanks, vessels, dynamic equipment and transformer foundations with SNI/ASCE load combinations, linked settlement, and Excel & PDF reports.")))
  const cta = el("div", "hm-cta")
  const a1 = el("a", "hm-btn pri", L("Mulai desain →", "Start designing →")); a1.href = "#/desain"
  const a2 = el("a", "hm-btn", L("Alur produksi migas", "Oil & gas flow")); a2.href = "#/alur"
  cta.append(a1, a2); tx.append(cta)
  hero.append(logo, tx)
  app.append(hero)

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
    el("p", null, L("Dari sumur sampai gathering station: PFD, dua P&ID bergerak, 12 animasi alat, dan catatan sipil/struktur — langsung terhubung ke kalkulator desain tiap peralatan.",
      "From the well to the gathering station: PFD, two animated P&IDs, 12 equipment animations and civil/structural notes — linked straight to each equipment's design calculator.")),
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
    let D, P
    try {
      const [dm, pm] = await Promise.all([import("./desain_ui.js"), import("./penurunan_ui.js")])
      D = dm.dashboard(ctx.lang); P = pm.settleSummary()
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
    ;[[L("Proyek", "Project"), D.project.name || "–"], ["Doc", D.project.doc || "–"], ["V", `${nf(D.site.V, 0)} m/s · ${D.site.exp}`], ["SDS", nf(D.sp.SDS, 3)], [L("Satuan", "Units"), D.units === "t" ? "ton · t/m²" : "kN · kPa"]]
      .forEach(([k, v]) => chips.append(el("span", null, `${k}: ${v}`)))
    stats.append(chips)
    grid.textContent = ""
    D.mods.forEach((m, i) => grid.append(tile(m, i, L)))
    // tile penurunan
    const t = el("a", "hm-tile in"); t.href = "#/penurunan"; t.style.setProperty("--i", D.mods.length)
    const top = el("div", "hm-tile-top"); top.append(el("span", "hm-ic", "📉"), el("b", null, L("Penurunan Pondasi", "Foundation Settlement")))
    t.append(top)
    if (P.error) t.append(el("p", "hm-sub", P.error))
    else {
      t.append(el("p", "hm-sub", `${P.shape === "lingkaran" ? "Ø" + nf(P.B, 2) : nf(P.B, 2) + " × " + nf(P.L, 2)} m · q ${nf(P.q, 1)} kPa${P.link ? " · 🔗 " + P.link.label : ""}`))
      t.append(gauge(P.s / P.allow, `${nf(P.s, 1)} / ${nf(P.allow, 0)} mm`, P.ok, P.ok ? "✓ OK" : L("✕ melebihi izin", "✕ exceeds limit"), L("penurunan total vs izin", "total settlement vs limit")))
    }
    t.append(el("span", "hm-open", L("Buka →", "Open →")))
    grid.append(t)
  }, 60)
}

function tile(m, i, L) {
  const a = el("a", "hm-tile in"); a.href = "#/desain/" + m.id; a.style.setProperty("--i", i)
  const top = el("div", "hm-tile-top"); top.append(el("span", "hm-ic", m.icon), el("b", null, m.title))
  a.append(top)
  if (m.error) { a.append(el("p", "hm-sub", m.error)); return a }
  a.append(el("p", "hm-sub", m.sub))
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
