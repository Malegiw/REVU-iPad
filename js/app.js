// Kerangka app: menu (hash), bahasa Indonesia/Inggris, tema terang/gelap/otomatis, pemasangan offline (service worker). Tiap alat dimuat saat dibuka.
import { createShell } from "./shell.js"
const $ = (s) => document.querySelector(s)
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* tanpa penyimpanan */ } },
}

// ---------------------------------------------------------------- bahasa
let lang = store.get("ymd.lang", (navigator.language || "id").startsWith("en") ? "en" : "id")
const EN = {}                                   // terjemahan antarmuka lama (alat baru memakai L(id, en) langsung di kode)
const SHELL = {
  sub: { id: "Desain pondasi & sipil migas · offline", en: "O&G foundation & civil design · offline" },
  home: { id: "Beranda", en: "Home" }, penurunan: { id: "Penurunan Pondasi", en: "Foundation Settlement" }, alur: { id: "Alur Produksi Migas", en: "Oil & Gas Production Flow" },
  desain: { id: "Desain Pondasi", en: "Foundation Design" }, tanah: { id: "Data Tanah", en: "Soil Data" }, gempa: { id: "Parameter Gempa", en: "Seismic Parameters" }, laporan: { id: "Laporan Proyek", en: "Project Report" },
  nHome: { id: "Beranda", en: "Home" }, nPenurunan: { id: "Penurunan", en: "Settlement" }, nAlur: { id: "Alur Migas", en: "Oil & Gas Flow" }, nDesain: { id: "Desain", en: "Design" },
  nTanah: { id: "Tanah", en: "Soil" }, nGempa: { id: "Gempa", en: "Seismic" }, nLaporan: { id: "Laporan", en: "Report" },
  offlineOk: { id: "Siap offline", en: "Offline ready" }, offNow: { id: "Tanpa internet", en: "No connection" }, newVer: { id: "Versi baru siap.", en: "A new version is ready." }, reload: { id: "Muat ulang", en: "Reload" },
  load: { id: "Memuat…", en: "Loading…" }, fail: { id: "Gagal memuat. Periksa sambungan lalu coba lagi.", en: "Could not load. Check the connection and try again." },
  themeTip: { id: "Tema: otomatis / terang / gelap", en: "Theme: auto / light / dark" },
  disc: { id: "Alat bantu desain & pembanding; angka bawaan hanya contoh umum. Ikuti Design Basis dan kode yang berlaku.", en: "Design aid & cross-check; default values are general examples. Follow the Design Basis and governing codes." },
}
// Tombol "kalkulator" di Alur Migas: arahkan ke modul Desain yang sesuai (indeks tahap pada data/flow_*.json)
const FLOW_CALC = { 2: "dinamis", 4: "vessel", 5: "vessel", 6: "tangki", 7: "tangki", 8: "dinamis", 9: "dinamis", 11: "trafo" }
const FLOW_LABEL = { tangki: { id: "Desain Pondasi Tangki", en: "Tank Foundation Design" }, vessel: { id: "Desain Pondasi Vessel", en: "Vessel Foundation Design" },
  dinamis: { id: "Desain Pondasi Peralatan Dinamis", en: "Dynamic Equipment Foundation Design" }, trafo: { id: "Desain Pondasi Trafo", en: "Transformer Foundation Design" } }
const S = (k) => SHELL[k][lang]
const t = (s) => (lang === "en" ? (EN[s] ?? s) : s)

// ---------------------------------------------------------------- tema
let theme = store.get("ymd.theme", "auto")                 // auto | light | dark
const dark = () => theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches)
function applyTheme() {
  document.documentElement.dataset.theme = dark() ? "dark" : "light"
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark() ? "#0B0C0F" : "#F4F4F1"
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (theme === "auto") { applyTheme(); route() } })

// ---------------------------------------------------------------- rute
const ROUTES = ["home", "alur", "tanah", "gempa", "desain", "penurunan", "laporan"]
const PAGES = { tanah: ["./tanah_ui.js", "mountTanah"], gempa: ["./gempa_ui.js", "mountGempa"], penurunan: ["./penurunan_ui.js", "mountPenurunan"], laporan: ["./laporan_ui.js", "mountLaporan"] }
const rawRoute = () => (location.hash.replace(/^#\/?/, "") || "home").split("/")
const current = () => { const r = rawRoute()[0]; return ROUTES.includes(r) ? r : "home" }
const subRoute = () => rawRoute()[1] || ""
let token = 0, lastRoute = ""

const NAV_SHORT = { alur: { id: "Alur", en: "Flow" }, penurunan: { id: "Turun", en: "Settle" } }
const NAV_ICO = { home: "home", alur: "flow", tanah: "soil", gempa: "seismic", desain: "design", penurunan: "settle", laporan: "report" }
const shell = createShell({
  routes: ROUTES.map((r) => ({ id: r, icon: NAV_ICO[r], label: () => S("n" + r[0].toUpperCase() + r.slice(1)), short: () => (NAV_SHORT[r] || {})[lang] || S("n" + r[0].toUpperCase() + r.slice(1)), title: () => S(r) })),
  mods: [["tiang", "pile", "Tiang Pipa Baja & Helical", "Steel Pipe & Helical Piles", "pile tiang helical pipa"], ["tangki", "tank", "Pondasi Tangki", "Tank Foundation", "tank tangki ring wall"],
    ["vessel", "vessel", "Pondasi Vessel (Gas Boot, Separator, IA Receiver)", "Vessel Foundation (Gas Boot, Separator, IA Receiver)", "vessel separator gas boot receiver"],
    ["dinamis", "pump", "Pondasi Peralatan Dinamis", "Dynamic Equipment Foundation", "pump pompa compressor kompresor dynamic dinamis"], ["trafo", "trafo", "Pondasi Trafo", "Transformer Foundation", "transformer trafo oil pit"]]
    .map(([id, icon, a, b, keys]) => ({ id, icon, keys, title: () => (lang === "en" ? b : a) })),
  current: () => current(), getLang: () => lang, getTheme: () => theme,
  setLang: (v) => { lang = v; store.set("ymd.lang", lang); return route() },
  setTheme: (v) => { theme = v; store.set("ymd.theme", theme); applyTheme(); return route() },
})
function drawNav() { document.documentElement.lang = lang; shell.drawNav() }

async function route() {
  const my = ++token, r = current(), app = $("#app")
  try { if (self.speechSynthesis) speechSynthesis.cancel() } catch (e) { /* abaikan */ }
  drawNav(); applyTheme()
  document.title = (r === "home" ? "YMD-CAL" : S(r) + " · YMD-CAL")
  if (r !== lastRoute) scrollTo(0, 0)
  lastRoute = r
  app.textContent = ""
  if (r === "home") return home(app, my)
  app.append(el("p", "hint", S("load")))
  try {
    if (r === "desain") {
      const mod = await import("./desain_ui.js")
      if (my !== token) return
      app.textContent = ""
      const box = el("div")
      app.append(box)
      mod.mountDesain(box, { t, lang }, subRoute())
    } else if (PAGES[r]) {
      const [file, fn] = PAGES[r]
      const mod = await import(file)
      if (my !== token) return
      app.textContent = ""
      const box = el("div")
      app.append(box, el("p", "cap", S("disc")))
      mod[fn](box, { t, lang })
    } else if (r === "alur") {
      const data = await (await fetch(`data/flow_${lang}_${dark() ? "dark" : "cloud"}.json`)).json()
      const mod = await import("./flow.js")
      if (my !== token) return
      app.textContent = ""
      const wrap = el("div"); wrap.innerHTML = '<div class="ymd-flow"><div class="ymd-flow-root"></div></div>'
      app.append(wrap)
      data.stages.forEach((st, i) => {
        st.calc = (st.calc || []).filter((c) => c.page !== "fondasi")
        if (FLOW_CALC[i]) st.calc.unshift({ label: FLOW_LABEL[FLOW_CALC[i]][lang], page: "desain/" + FLOW_CALC[i] })
      })
      data.lang = lang
      mod.mountFlow(wrap, data, (k, v) => { if (k === "goto" && ROUTES.includes(String(v).split("/")[0])) location.hash = "#/" + v })
    }
  } catch (e) {
    if (my === token) { app.textContent = ""; app.append(el("div", "err", S("fail") + " (" + e.message + ")")) }
  }
}

async function home(app, my) {
  try {
    const mod = await import("./home.js")
    if (my !== token) return
    app.textContent = ""
    mod.mountHome(app, { lang, dark: dark(), shell })
  } catch (e) { if (my === token) { app.textContent = ""; app.append(el("div", "err", S("fail") + " (" + e.message + ")")) } }
}

// ---------------------------------------------------------------- tinggi bilah atas (untuk bilah status lengket) & status sambungan
addEventListener("hashchange", route)
const setHH = () => document.documentElement.style.setProperty("--hh", ($(".ui-top") ? $(".ui-top").offsetHeight : 60) + "px")
if (self.ResizeObserver) new ResizeObserver(setHH).observe($(".ui-top")); else addEventListener("resize", setHH)
setHH()
let swReady = false
const netState = () => { if (!navigator.onLine) shell.setOffline(S("offNow"), true); else if (swReady) shell.setOffline(S("offlineOk")); else $("#offline").hidden = true }
addEventListener("online", netState); addEventListener("offline", netState)

// ---------------------------------------------------------------- offline (service worker)
if ("serviceWorker" in navigator && location.search.includes("nosw")) {         // pengembangan: ?nosw mematikan penyimpanan offline dan menghapus yang lama
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))
  if (self.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
} else if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    navigator.serviceWorker.ready.then(() => { swReady = true; netState() })
    reg.addEventListener("updatefound", () => {
      const w = reg.installing
      w && w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          shell.toast(S("newVer"), { action: S("reload"), onAction: () => { navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true }); w.postMessage({ type: "skip" }) } })
        }
      })
    })
  }).catch(() => { /* tanpa service worker: app tetap jalan saat online */ })
}

route().then(netState)
