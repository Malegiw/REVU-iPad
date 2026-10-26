// Kerangka app: menu (hash), bahasa Indonesia/Inggris, tema terang/gelap/otomatis, pemasangan offline (service worker). Tiap alat dimuat saat dibuka.
const $ = (s) => document.querySelector(s)
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* tanpa penyimpanan */ } },
}

// ---------------------------------------------------------------- bahasa
let lang = store.get("ymd.lang", (navigator.language || "id").startsWith("en") ? "en" : "id")
const EN = {}                                   // terjemahan antarmuka alat, dimuat dari data/en_<alat>.json
const SHELL = {
  sub: { id: "Kalkulator & referensi · offline", en: "Calculators & reference · offline" },
  home: { id: "Beranda", en: "Home" }, penurunan: { id: "Penurunan Pondasi", en: "Foundation Settlement" }, alur: { id: "Alur Produksi Migas", en: "Oil & Gas Production Flow" },
  nHome: { id: "Beranda", en: "Home" }, nPenurunan: { id: "Penurunan", en: "Settlement" }, nAlur: { id: "Alur Migas", en: "Oil & Gas Flow" },
  open: { id: "Buka", en: "Open" }, soon: { id: "Segera", en: "Soon" },
  homeTitle: { id: "Kalkulator dan referensi untuk reviewer teknik sipil", en: "Calculators and reference for civil engineering reviewers" },
  homeLead: {
    id: "Pembanding independen yang berjalan penuh di iPad ini, tanpa internet dan tanpa Mac. Hasilnya untuk memeriksa perhitungan yang direview, bukan pengganti perhitungan geoteknik atau struktur. Nilai bawaan hanya contoh.",
    en: "Independent cross-checks that run entirely on this iPad, with no internet and no Mac. Use them to check calculations under review; they do not replace geotechnical or structural design. Default values are examples only.",
  },
  penDesc: { id: "Penurunan segera, konsolidasi primer dan sekunder, serta kecepatan penurunan pondasi dangkal.", en: "Immediate settlement, primary and secondary consolidation, and rate of settlement of shallow foundations." },
  alurDesc: { id: "Alur minyak dan gas dari sumur sampai gathering station, lengkap dengan PFD, P&ID, dan animasi cara kerja tiap alat.", en: "Oil and gas flow from the well to the gathering station, with PFD, P&IDs and animations of how each item works." },
  moreTitle: { id: "Kalkulator lain menyusul", en: "More calculators coming" },
  moreText: { id: "Pondasi tangki & peralatan, saluran & gorong-gorong, stabilitas lereng, dan dinding penahan tanah sedang disiapkan untuk versi offline ini.", en: "Tank & equipment foundations, channels & culverts, slope stability and retaining walls are being prepared for this offline version." },
  installTitle: { id: "Pasang sebagai app di iPad", en: "Install as an app on your iPad" },
  install: {
    id: ["Buka alamat ini di Safari (sekali, dengan internet).", "Ketuk tombol Bagikan, lalu Tambah ke Layar Utama.", "Sejak itu app terbuka dari ikon di layar utama, layar penuh, dan jalan tanpa internet."],
    en: ["Open this address in Safari (once, with internet).", "Tap the Share button, then Add to Home Screen.", "From then on the app opens from the icon, full screen, and works without internet."],
  },
  offlineOk: { id: "✓ Siap offline", en: "✓ Offline ready" }, newVer: { id: "Versi baru siap.", en: "A new version is ready." }, reload: { id: "Muat ulang", en: "Reload" },
  load: { id: "Memuat…", en: "Loading…" }, fail: { id: "Gagal memuat. Periksa sambungan lalu coba lagi.", en: "Could not load. Check the connection and try again." },
  themeTip: { id: "Tema: otomatis / terang / gelap", en: "Theme: auto / light / dark" },
  disc: { id: "Pembanding untuk review; angka bawaan hanya contoh umum. Ikuti Design Basis dan kode yang dipakai dokumen.", en: "A cross-check for reviews; default values are general examples. Follow the Design Basis and the code used by the document." },
}
const S = (k) => SHELL[k][lang]
const t = (s) => (lang === "en" ? (EN[s] ?? s) : s)

// ---------------------------------------------------------------- tema
let theme = store.get("ymd.theme", "auto")                 // auto | light | dark
const dark = () => theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches)
function applyTheme() {
  document.documentElement.dataset.theme = dark() ? "dark" : "light"
  $("#btnTheme").textContent = theme === "auto" ? "◐" : theme === "dark" ? "🌙" : "☀️"
  $("#btnTheme").title = S("themeTip")
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark() ? "#0B2229" : "#27323F"
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (theme === "auto") { applyTheme(); route() } })

// ---------------------------------------------------------------- rute
const ROUTES = ["home", "penurunan", "alur"]
const current = () => { const r = (location.hash.replace(/^#\/?/, "") || "home"); return ROUTES.includes(r) ? r : "home" }
let token = 0

function drawNav() {
  const nav = $("#nav"); nav.textContent = ""
  ROUTES.forEach((r) => { const a = el("a", current() === r ? "on" : "", S("n" + r[0].toUpperCase() + r.slice(1))); a.title = S(r); a.href = "#/" + (r === "home" ? "" : r); nav.append(a) })
  $("#btnLang").textContent = lang === "id" ? "ID" : "EN"
  $("#sub").textContent = S("sub")
  document.documentElement.lang = lang
}

async function loadEN(tool) {
  if (lang !== "en" || EN["__" + tool]) return
  try { Object.assign(EN, await (await fetch(`data/en_${tool}.json`)).json()); EN["__" + tool] = "1" } catch (e) { /* tanpa terjemahan: teks Indonesia */ }
}

async function route() {
  const my = ++token, r = current(), app = $("#app")
  drawNav(); applyTheme()
  document.title = (r === "home" ? "Review by YMD" : S(r) + " · Review by YMD")
  app.textContent = ""
  if (r === "home") return home(app)
  app.append(el("p", "hint", S("load")))
  try {
    if (r === "penurunan") {
      await loadEN("penurunan")
      const mod = await import("./penurunan_ui.js")
      if (my !== token) return
      app.textContent = ""
      const h = el("h1", null, S("penurunan")); const box = el("div")
      app.append(h, box, el("p", "cap", S("disc")))
      mod.mountPenurunan(box, { t, lang })
    } else if (r === "alur") {
      const data = await (await fetch(`data/flow_${lang}_${dark() ? "dark" : "cloud"}.json`)).json()
      const mod = await import("./flow.js")
      if (my !== token) return
      app.textContent = ""
      const wrap = el("div"); wrap.innerHTML = '<div class="ymd-flow"><div class="ymd-flow-root"></div></div>'
      app.append(wrap)
      mod.mountFlow(wrap, data, (k, v) => { if (k === "goto" && ROUTES.includes(v)) location.hash = "#/" + v })
    }
  } catch (e) {
    if (my === token) { app.textContent = ""; app.append(el("div", "err", S("fail") + " (" + e.message + ")")) }
  }
}

function home(app) {
  const c = el("section", "card")
  c.append(el("h1", null, S("homeTitle")), el("p", null, S("homeLead")))
  const cards = el("div", "cards")
  const tool = (r, desc) => { const a = el("a", "card tool"); a.href = "#/" + r; a.append(el("b", null, S(r)), el("span", "hint", desc), el("span", "btn go", S("open"))); return a }
  cards.append(tool("penurunan", S("penDesc")), tool("alur", S("alurDesc")))
  const more = el("div", "card tool soon"); more.append(el("b", null, S("moreTitle")), el("span", "hint", S("moreText")))
  cards.append(more)
  const ins = el("section", "card"); ins.append(el("h3", null, S("installTitle")))
  const ol = el("ol", "tips"); S("install").forEach((x) => ol.append(el("li", null, x))); ins.append(ol)
  app.append(c, cards, ins, el("p", "cap", S("disc")))
}

// ---------------------------------------------------------------- tombol
$("#btnLang").onclick = () => { lang = lang === "id" ? "en" : "id"; store.set("ymd.lang", lang); route() }
$("#btnTheme").onclick = () => { theme = { auto: "light", light: "dark", dark: "auto" }[theme]; store.set("ymd.theme", theme); route() }
addEventListener("hashchange", route)
const setHH = () => document.documentElement.style.setProperty("--hh", ($(".top") ? $(".top").offsetHeight : 64) + "px")
if (self.ResizeObserver) new ResizeObserver(setHH).observe($(".top")); else addEventListener("resize", setHH)
setHH()

// ---------------------------------------------------------------- offline (service worker)
function toast(msg, action, fn) {
  const tt = $("#toast"); tt.textContent = msg; tt.hidden = false
  if (action) { const b = el("button", null, action); b.onclick = fn; tt.append(b) } else setTimeout(() => { tt.hidden = true }, 4000)
}
if ("serviceWorker" in navigator && location.search.includes("nosw")) {         // pengembangan: ?nosw mematikan penyimpanan offline dan menghapus yang lama
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
  if (self.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
} else if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const ready = () => { const c = $("#offline"); c.textContent = S("offlineOk"); c.hidden = false }
    navigator.serviceWorker.ready.then(ready)
    reg.addEventListener("updatefound", () => {
      const w = reg.installing
      w && w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          toast(S("newVer"), S("reload"), () => { navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true }); w.postMessage({ type: "skip" }) })
        }
      })
    })
  }).catch(() => { /* tanpa service worker: app tetap jalan saat online */ })
}

route()
