import { ico, MOD_ICO } from "./icons.js"
// Beranda YMD-CAL: hero ringkas, dashboard status semua kalkulator (dihitung dari masukan tersimpan), dan kartu Alur Produksi Migas.
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const svgNS = "http://www.w3.org/2000/svg"
const sv = (tag, a) => { const e = document.createElementNS(svgNS, tag); for (const k in a) e.setAttribute(k, a[k]); return e }
const nf = (x, d = 1) => (x == null || !isFinite(x) ? "–" : Number(x).toFixed(d))

// angka yang menghitung naik ke nilainya (lebar stabil lewat tabular-nums)
function countUp(node, to, fmt) {
  if (!isFinite(to) || document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = fmt(to); return }
  const t0 = performance.now(), dur = 900
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); node.textContent = fmt(to * e); if (k < 1 && node.isConnected) requestAnimationFrame(step); else node.textContent = fmt(to) }
  requestAnimationFrame(step)
}

export function mountHome(app, ctx) {
  const L = (id, en) => (ctx.lang === "en" ? en : id)
  app.textContent = ""
  const bento = el("div", "bento")
  const bn = (cls, tag = "section") => { const e = el(tag, "bn " + cls); e.style.setProperty("--i", bento.children.length); bento.append(e); return e }

  // ---- hero
  const hero = bn("bn-hero")
  hero.innerHTML = `<div class="bn-grid" aria-hidden="true"></div>`
  const tx = el("div", "bn-hero-tx")
  const mark = el("div", "bn-mark"); const lg = document.querySelector(".ui-brand .logo"); if (lg) mark.innerHTML = lg.innerHTML
  tx.append(mark, el("h1", null, L("Desain pondasi migas, dari data tanah sampai laporan.", "Oil & gas foundation design, from soil data to report.")),
    el("p", null, L("Satu proyek, satu alur: tanah (N-SPT/CPT), gempa, pondasi dangkal atau dalam, penurunan, lalu laporan Excel dan PDF. Semua berjalan offline di iPad.",
      "One project, one flow: soil (SPT/CPT), seismic, shallow or deep foundations, settlement, then Excel and PDF reports. Everything runs offline on iPad.")))
  const cta = el("div", "bn-cta")
  const a1 = el("a", "btn", L("Mulai dari data tanah", "Start with soil data")); a1.href = "#/tanah"; a1.append(ico("arrow"))
  const a2 = el("button", "ghost"); a2.type = "button"; a2.dataset.snd = "1"; a2.append(ico("search"), el("span", null, L("Cari atau lompat", "Search or jump"))); a2.onclick = () => ctx.shell && ctx.shell.openPalette()
  cta.append(a1, a2); tx.append(cta)
  hero.append(tx)

  // ---- skor & statistik (diisi setelah perhitungan)
  const score = bn("bn-score sk"), st1 = bn("bn-stat sk"), st2 = bn("bn-stat sk")
  const ctxT = bn("bn-ctx sk")

  // ---- alur proyek
  const wf = bn("bn-wf")
  const wfH = el("div", "bn-h"); wfH.append(el("h2", null, L("Alur proyek", "Project workflow")), el("span", "bn-meta", L("Lima langkah berurutan, data mengalir otomatis antar tab.", "Five steps in order; data flows between tabs automatically.")))
  const wfBox = el("div", "hm-wf"); wf.append(wfH, wfBox)

  // ---- kalkulator
  const dh = el("div", "bn-sec"); dh.append(el("h2", null, L("Kalkulator desain", "Design calculators")), el("span", "bn-meta", L("Dihitung dari masukan terakhir Anda.", "Computed from your latest inputs.")))
  bento.append(dh)
  const tiles = []
  for (let i = 0; i < 6; i++) tiles.push(bn("hm-tile sk", "div"))

  // ---- alur migas
  const fl = bn("bn-flow", "a"); fl.href = "#/alur"
  const ft = el("div", "bn-flow-tx")
  ft.append(el("h2", null, L("Alur Produksi Migas", "Oil & Gas Production Flow")),
    el("p", null, L("Dari sumur sampai gathering station: PFD, dua P&ID bergerak, 12 animasi alat dengan narasi suara, dan catatan sipil yang terhubung ke kalkulator tiap peralatan.",
      "From the well to the gathering station: PFD, two animated P&IDs, 12 equipment animations with voice narration, and civil notes linked to each equipment's calculator.")))
  const go = el("span", "bn-go", L("Jelajahi alur", "Explore the flow")); go.append(ico("arrow")); ft.append(go)
  const img = el("img", "bn-flow-img"); img.alt = L("Ilustrasi alur produksi migas", "Oil & gas production flow illustration"); img.loading = "lazy"
  img.src = `assets/hero_${ctx.dark ? "dark" : "cloud"}${ctx.lang === "en" ? "_en" : ""}.svg`
  fl.append(ft, img)

  // ---- pasang di iPad
  const ins = bn("bn-ins")
  const insH = el("div", "bn-ins-h"); insH.append(ico("device"), el("h2", null, L("Pasang di iPad", "Install on iPad")))
  const ol = el("ol")
  ;[L("Buka alamat ini di Safari sekali saat ada internet.", "Open this address in Safari once while online."), L("Ketuk Bagikan, lalu Tambah ke Layar Utama.", "Tap Share, then Add to Home Screen."),
    L("Buka dari ikon YMD-CAL: layar penuh dan jalan tanpa internet.", "Open from the YMD-CAL icon: full screen and works offline.")].forEach((x) => ol.append(el("li", null, x)))
  ins.append(insH, ol)

  app.append(bento, el("p", "hm-foot", `© Yan Malegi Diardi · YMD-CAL · ${L("alat bantu desain; ikuti Design Basis & kode yang berlaku", "design aid; follow the Design Basis & governing codes")}`))

  // isi dashboard setelah halaman tampil (perhitungan semua modul ± 0,3 detik)
  setTimeout(async () => {
    let D
    try {
      const [dm, pj] = await Promise.all([import("./desain_ui.js"), import("./project.js")])
      D = dm.dashboard(ctx.lang)
      const sp = pj.stepper("", pj.projLoad()); sp.classList.add("on"); wfBox.append(sp)
    } catch (e) { tiles.forEach((t) => t.remove()); const er = el("div", "err", e.message); er.style.gridColumn = "1 / -1"; dh.after(er); return }
    if (!app.isConnected) return
    const okMods = D.mods.filter((m) => m.ok).length, nChk = D.mods.reduce((a, m) => a + (m.nChk || 0), 0), nBad = D.mods.reduce((a, m) => a + (m.nBad || 0), 0)
    const sMax = D.mods.filter((m) => m.settle).reduce((a, m) => (!a || m.settle.s > a.settle.s ? m : a), null)
    const allOk = okMods === D.mods.length
    // skor: cincin besar kalkulator yang memenuhi
    score.classList.remove("sk")
    const ring = sv("svg", { viewBox: "0 0 120 120", class: "bn-ring" }), R = 52, C = 2 * Math.PI * R
    ring.append(sv("circle", { cx: 60, cy: 60, r: R, class: "hm-ring-bg" }))
    const arc = sv("circle", { cx: 60, cy: 60, r: R, class: "hm-ring-fg " + (allOk ? "ok" : "bad"), "stroke-dasharray": `${C} ${C}`, "stroke-dashoffset": C, transform: "rotate(-90 60 60)" })
    ring.append(arc); requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute("stroke-dashoffset", C * (1 - okMods / Math.max(1, D.mods.length)))))
    const rw = el("div", "bn-ring-w"), rn = el("div", "bn-ring-n"), big = el("b", null, "0")
    rn.append(big, el("span", null, `/ ${D.mods.length}`)); rw.append(ring, rn)
    countUp(big, okMods, (v) => String(Math.round(v)))
    const sx = el("div", "bn-score-tx")
    sx.append(el("span", "hm-pill " + (allOk ? "ok" : "bad"), allOk ? L("Semua memenuhi", "All passing") : `${D.mods.length - okMods} ${L("perlu ditinjau", "need review")}`),
      el("b", null, L("Kalkulator memenuhi", "Calculators passing")), el("small", null, L("Setiap kalkulator lulus bila seluruh pemeriksaannya OK.", "A calculator passes when every one of its checks is OK.")))
    score.append(rw, sx)
    const stat = (box, lab, to, fmt, sub, cls) => { box.classList.remove("sk"); box.classList.add(cls); const b = el("b"); box.append(el("span", null, lab), b, el("small", null, sub)); countUp(b, to, fmt) }
    stat(st1, L("Pemeriksaan lolos", "Checks passed"), nChk - nBad, (v) => `${Math.round(v)} / ${nChk}`, nBad ? `${nBad} ${L("tidak OK", "not OK")}` : L("Tanpa kegagalan", "No failures"), nBad ? "bad" : "ok")
    if (sMax) stat(st2, L("Penurunan terbesar", "Largest settlement"), sMax.settle.s, (v) => `${nf(v, 1)} mm`, sMax.title.split(" (")[0], sMax.settle.s > sMax.settle.allow ? "bad" : "ok")
    else stat(st2, L("Penurunan terbesar", "Largest settlement"), NaN, () => "–", L("Belum ada hasil", "No results yet"), "")
    // konteks proyek
    ctxT.classList.remove("sk")
    ;[[L("Proyek", "Project"), D.project.name || "–"], [L("Dokumen", "Document"), D.project.doc || "–"], [L("Angin", "Wind"), `${nf(D.site.V, 0)} m/s · ${D.site.exp}`], [L("Kelas situs", "Site class"), D.ss.cls], ["SDS", nf(D.sp.SDS, 3)],
      [L("Kode", "Codes"), D.codes], [L("Satuan", "Units"), D.units === "t" ? "ton · t/m²" : "kN · kPa"]]
      .forEach(([k, v]) => { const c = el("div", "bn-kv"); c.append(el("span", null, k), el("b", null, String(v))); ctxT.append(c) })
    // kalkulator
    tiles.forEach((x) => x.remove())
    D.mods.forEach((m, i) => fl.before(tile(m, i, L)))
    const t = el("a", "bn hm-tile in"); t.href = "#/penurunan"; t.style.setProperty("--i", D.mods.length)
    const top = el("div", "hm-tile-top"); const icS = el("span", "hm-ic"); icS.append(ico("settle")); top.append(icS, el("b", null, L("Penurunan Pondasi", "Foundation Settlement")))
    t.append(top)
    const st = D.mods.filter((m) => m.settle)
    if (!sMax) t.append(el("p", "hm-sub", L("Belum ada hasil penurunan.", "No settlement results yet.")))
    else {
      const w = st.reduce((a, m) => (!a || m.settle.s / m.settle.allow > a.settle.s / a.settle.allow ? m : a), null), ok = w.settle.s <= w.settle.allow
      t.append(el("p", "hm-sub", `${st.length} ${L("pondasi", "foundations")} · ${st.filter((m) => m.settle.kind === "deep").length} ${L("tiang", "piled")} · ${L("penentu", "governing")}: ${w.title.split(" (")[0]}`))
      t.append(gauge(w.settle.s / w.settle.allow, `${nf(w.settle.s, 1)} / ${nf(w.settle.allow, 0)} mm`, ok, ok ? "OK" : L("Melebihi izin", "Exceeds limit"), L("segera + konsolidasi vs izin", "immediate + consolidation vs limit")))
    }
    const op = el("span", "hm-open", L("Buka", "Open")); op.append(ico("arrow")); t.append(op)
    fl.before(t)
  }, 60)
}

function tile(m, i, L) {
  const a = el("a", "bn hm-tile in"); a.href = "#/desain/" + m.id; a.style.setProperty("--i", i)
  const top = el("div", "hm-tile-top"); const icM = el("span", "hm-ic"); icM.append(ico(MOD_ICO[m.id])); top.append(icM, el("b", null, m.title))
  a.append(top)
  if (m.error) { a.append(el("p", "hm-sub", m.error)); return a }
  a.append(el("p", "hm-sub", m.sub))
  if (m.fdType) top.append(el("span", "hm-fd " + m.fdType, m.fdType === "deep" ? L("Dalam", "Deep") : L("Dangkal", "Shallow")))
  a.append(gauge(m.gov ? m.gov.ur : 0, m.gov ? `UR ${isFinite(m.gov.ur) ? m.gov.ur.toFixed(3) : "∞"}` : "", m.ok, m.ok ? "OK" : `${m.nBad} ${L("tidak OK", "not OK")}`, m.gov ? m.gov.item : ""))
  const op = el("span", "hm-open", `${m.nCmb} ${L("kombinasi", "combinations")}`); op.append(ico("arrow")); a.append(op)
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
