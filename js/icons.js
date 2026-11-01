// Ikon garis SVG seragam (24×24, stroke = currentColor) pengganti emoji: tampil sama di iPad, terang/gelap, dan ikut warna aksen.
// ico(x) menerima nama ikon atau emoji lama (dipetakan otomatis); teks lain dikembalikan apa adanya.
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  flow: '<path d="M7 21 10 4h1.5l3 17"/><path d="M8.3 14h6M9.1 9.5h4.4"/><path d="M3 21h18"/><path d="M15.5 7h5m-1.8-1.8L20.5 7l-1.8 1.8"/>',
  soil: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path d="M3 9h18M3 14.5h18"/><circle cx="7.5" cy="6.3" r=".9"/><circle cx="15" cy="11.8" r=".9"/><circle cx="10" cy="17.5" r=".9"/><circle cx="17" cy="17.5" r=".9"/>',
  seismic: '<path d="M2 12h3.2l2-5 3 10 3-14 3 12 2-6 1.8 3H22"/>',
  design: '<circle cx="12" cy="5.5" r="2"/><path d="M11 7.3 6 20.5M13 7.3l5 13.2"/><path d="M8 15.2h8"/>',
  settle: '<path d="M3 20.5h18"/><rect x="6" y="8.5" width="12" height="4.5" rx="1"/><path d="M12 2.5v4m-2-2 2 2 2-2"/><path d="M5 16.8c2 .9 4.3 1.3 7 1.3s5-.4 7-1.3"/>',
  report: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14.5 3v4.5H19"/><path d="M9 12h7M9 15.5h7M9 8.5h3"/>',
  pile: '<rect x="3.5" y="5.5" width="17" height="4.5" rx="1.2"/><path d="M10 5.5V2.5h4v3"/><path d="M7 10v11M12 10v11M17 10v11"/>',
  tank: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  vessel: '<path d="M8 7a4 3 0 0 1 8 0v9.5a4 3 0 0 1-8 0z"/><path d="M9 19l-1 2.5h8l-1-2.5"/><path d="M16 10h3.5M4.5 13.5H8"/>',
  pump: '<circle cx="9" cy="13" r="5.2"/><circle cx="9" cy="13" r="1.7"/><path d="M14.2 13H21V9h-3"/><path d="M4.5 21h9"/><path d="M9 7.8V3.5h4.5"/>',
  trafo: '<rect x="4" y="9" width="16" height="10" rx="1.6"/><path d="M8 9V5.5M12 9V4.5M16 9V5.5"/><path d="M7.5 12.5h9M7.5 15.5h9"/><path d="M3 21.5h18"/>',
  project: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4.1l2.2 2.2h7.3A2.2 2.2 0 0 1 21 9.4v8.4a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.7 2.7L16.2 9.6"/>',
  loads: '<path d="M7 3v11m-3-3 3 3 3-3"/><path d="M17 3v11m-3-3 3 3 3-3"/><path d="M3 19.5h18"/>',
  bolt: '<path d="M8.5 3h7l1 3h-9z"/><path d="M12 6v15"/><path d="m9.8 9.5 4.4 1.2M9.8 13l4.4 1.2M9.8 16.5l4.4 1.2"/>',
  found: '<path d="M2.5 21h19"/><rect x="4.5" y="14" width="15" height="5" rx="1"/><rect x="9" y="7" width="6" height="7" rx="1"/><path d="M12 7V3"/>',
  group: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="8" cy="16" r="1.7"/><circle cx="16" cy="16" r="1.7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  block: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  pit: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="m20 20-4.6-4.6"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M8.2 7h7.6"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" stroke-width="2.6"/>',
  chart: '<path d="M4 4v16h16"/><path d="m7.5 15 3.8-5 3 3 4.7-6.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="5" cy="18" r="1.1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2m1-5 2 2m1-5 2 2"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
}
// emoji lama → nama ikon
const E = {
  "🏠": "home", "🛢️": "tank", "🛢": "pit", "📍": "pile", "⚗️": "vessel", "⚙️": "pump", "⚡": "trafo", "📁": "project", "🧱": "soil", "✅": "check", "⬇️": "loads",
  "🔩": "bolt", "🏗️": "found", "🏗": "found", "🧩": "group", "🔗": "link", "🧊": "block", "🔎": "search", "🧮": "calc", "📈": "chart", "🌐": "seismic", "📉": "settle",
  "📑": "report", "🧾": "report", "📋": "list", "🔬": "search", "✍️": "edit", "🧭": "compass", "📐": "ruler", "📊": "chart", "🌬️": "wind",
}
const SVG = (n, cls) => `<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`
export const icoName = (x) => (P[x] ? x : E[x] || null)
export const icoHTML = (x, cls) => { const n = icoName(x); return n ? SVG(n, cls) : String(x ?? "") }
export function ico(x, cls) {
  const s = document.createElement("span")
  s.className = "icw"
  const n = icoName(x)
  if (n) s.innerHTML = SVG(n, cls)
  else s.textContent = x ?? ""
  return s
}
// ikon modul Desain (dipakai kartu, tab modul, dashboard)
export const MOD_ICO = { tiang: "pile", tangki: "tank", vessel: "vessel", dinamis: "pump", trafo: "trafo" }
