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
  sub: { id: "Desain pondasi & sipil migas · offline", en: "O&G foundation & civil design · offline" },
  home: { id: "Beranda", en: "Home" }, penurunan: { id: "Penurunan Pondasi", en: "Foundation Settlement" }, alur: { id: "Alur Produksi Migas", en: "Oil & Gas Production Flow" },
  desain: { id: "Desain Pondasi", en: "Foundation Design" },
  nHome: { id: "Beranda", en: "Home" }, nPenurunan: { id: "Penurunan", en: "Settlement" }, nAlur: { id: "Alur Migas", en: "Oil & Gas Flow" }, nDesain: { id: "Desain", en: "Design" },
  offlineOk: { id: "✓ Siap offline", en: "✓ Offline ready" }, newVer: { id: "Versi baru siap.", en: "A new version is ready." }, reload: { id: "Muat ulang", en: "Reload" },
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
  $("#btnTheme").textContent = theme === "auto" ? "◐" : theme === "dark" ? "🌙" : "☀️"
  $("#btnTheme").title = S("themeTip")
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark() ? "#0B2229" : "#27323F"
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (theme === "auto") { applyTheme(); route() } })

// ---------------------------------------------------------------- rute
const ROUTES = ["home", "desain", "penurunan", "alur"]
const rawRoute = () => (location.hash.replace(/^#\/?/, "") || "home").split("/")
const current = () => { const r = rawRoute()[0]; return ROUTES.includes(r) ? r : "home" }
const subRoute = () => rawRoute()[1] || ""
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
  document.title = (r === "home" ? "YMD-CAL" : S(r) + " · YMD-CAL")
  if (r !== "home") scrollTo(0, 0)
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
    } else if (r === "penurunan") {
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
      data.stages.forEach((st, i) => {
        st.calc = (st.calc || []).filter((c) => c.page !== "fondasi")
        if (FLOW_CALC[i]) st.calc.unshift({ label: FLOW_LABEL[FLOW_CALC[i]][lang], page: "desain/" + FLOW_CALC[i] })
      })
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
    mod.mountHome(app, { lang, dark: dark() })
  } catch (e) { if (my === token) { app.textContent = ""; app.append(el("div", "err", S("fail") + " (" + e.message + ")")) } }
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
