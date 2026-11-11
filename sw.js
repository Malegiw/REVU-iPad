// Semula dibuat oleh ipad_build.py; daftar berkas & VERSION diperbarui untuk YMD-CAL (lihat README). Menyimpan semua berkas supaya app jalan tanpa internet; versi baru menunggu sampai pengguna menekan Muat ulang.
const VERSION = "24552c12ea"
const CACHE = "ymd-ipad-" + VERSION
const FILES = [
 "./",
 "assets/flowd_10_cloud.svg",
 "assets/flowd_10_cloud_en.svg",
 "assets/flowd_10_dark.svg",
 "assets/flowd_10_dark_en.svg",
 "assets/flowd_11_cloud.svg",
 "assets/flowd_11_cloud_en.svg",
 "assets/flowd_11_dark.svg",
 "assets/flowd_11_dark_en.svg",
 "assets/flowd_12_cloud.svg",
 "assets/flowd_12_cloud_en.svg",
 "assets/flowd_12_dark.svg",
 "assets/flowd_12_dark_en.svg",
 "assets/flowd_1_cloud.svg",
 "assets/flowd_1_cloud_en.svg",
 "assets/flowd_1_dark.svg",
 "assets/flowd_1_dark_en.svg",
 "assets/flowd_2_cloud.svg",
 "assets/flowd_2_cloud_en.svg",
 "assets/flowd_2_dark.svg",
 "assets/flowd_2_dark_en.svg",
 "assets/flowd_3_cloud.svg",
 "assets/flowd_3_cloud_en.svg",
 "assets/flowd_3_dark.svg",
 "assets/flowd_3_dark_en.svg",
 "assets/flowd_4_cloud.svg",
 "assets/flowd_4_cloud_en.svg",
 "assets/flowd_4_dark.svg",
 "assets/flowd_4_dark_en.svg",
 "assets/flowd_5_cloud.svg",
 "assets/flowd_5_cloud_en.svg",
 "assets/flowd_5_dark.svg",
 "assets/flowd_5_dark_en.svg",
 "assets/flowd_6_cloud.svg",
 "assets/flowd_6_cloud_en.svg",
 "assets/flowd_6_dark.svg",
 "assets/flowd_6_dark_en.svg",
 "assets/flowd_7_cloud.svg",
 "assets/flowd_7_cloud_en.svg",
 "assets/flowd_7_dark.svg",
 "assets/flowd_7_dark_en.svg",
 "assets/flowd_8_cloud.svg",
 "assets/flowd_8_cloud_en.svg",
 "assets/flowd_8_dark.svg",
 "assets/flowd_8_dark_en.svg",
 "assets/flowd_9_cloud.svg",
 "assets/flowd_9_cloud_en.svg",
 "assets/flowd_9_dark.svg",
 "assets/flowd_9_dark_en.svg",
 "assets/hero_cloud.svg",
 "assets/hero_cloud_en.svg",
 "assets/hero_dark.svg",
 "assets/hero_dark_en.svg",
 "assets/pfd_cloud.svg",
 "assets/pfd_cloud_en.svg",
 "assets/pfd_dark.svg",
 "assets/pfd_dark_en.svg",
 "assets/pid1_cloud.svg",
 "assets/pid1_cloud_en.svg",
 "assets/pid1_dark.svg",
 "assets/pid1_dark_en.svg",
 "assets/pid2_cloud.svg",
 "assets/pid2_cloud_en.svg",
 "assets/pid2_dark.svg",
 "assets/pid2_dark_en.svg",
 "css/app.css",
 "css/desain.css",
 "css/flow.css",
 "css/home.css",
 "css/proyek.css",
 "data/flow_en_cloud.json",
 "data/flow_en_dark.json",
 "data/flow_id_cloud.json",
 "data/flow_id_dark.json",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/logo.svg",
 "index.html",
 "js/app.js",
 "js/desain/chart.js",
 "js/desain/core.js",
 "js/desain/deep.js",
 "js/desain/draw.js",
 "js/desain/dynamic.js",
 "js/desain/footing.js",
 "js/desain/m_dinamis.js",
 "js/desain/m_tangki.js",
 "js/desain/m_tiang.js",
 "js/desain/m_trafo.js",
 "js/desain/m_vessel.js",
 "js/desain/pdf.js",
 "js/desain/pile.js",
 "js/desain/rc.js",
 "js/desain/settle.js",
 "js/desain/sketch.js",
 "js/desain/soil.js",
 "js/desain/steel.js",
 "js/desain/steps.js",
 "js/desain/tank.js",
 "js/desain/trafo.js",
 "js/desain/ui.js",
 "js/desain/vessel.js",
 "js/desain/xlsx.js",
 "js/desain_ui.js",
 "js/flow.js",
 "js/fmt.js",
 "js/gempa_ui.js",
 "js/home.js",
 "js/icons.js",
 "js/laporan_ui.js",
 "js/penurunan.js",
 "js/penurunan_ui.js",
 "js/pj_ui.js",
 "js/project.js",
 "js/shell.js",
 "js/tanah_ui.js",
 "js/voice.js",
 "manifest.webmanifest",
]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)))
})
self.addEventListener("message", (e) => { if (e.data && e.data.type === "skip") self.skipWaiting() })
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ymd-ipad-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
// rekaman suara alami (assets/voice/): MP3 disimpan saat pertama diputar (cache terpisah, tetap ada antar versi);
// manifest.json diambil dari jaringan dulu supaya rekaman baru langsung terpakai, cadangannya dari cache.
const VOICE = "ymd-voice-v1"
function voiceFetch(req) {
  if (req.url.endsWith(".json")) {
    return fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(VOICE).then((k) => k.put(req, c)) } return r })
      .catch(() => caches.open(VOICE).then((k) => k.match(req, { ignoreSearch: true })).then((hit) => hit || Response.error()))
  }
  return caches.open(VOICE).then((k) => k.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && r.status === 200) k.put(req, r.clone())
    return r
  })))
}
self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET") return
  if (req.url.includes("/assets/voice/")) { if (!req.headers.has("range")) e.respondWith(voiceFetch(req)); return }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))))
})
