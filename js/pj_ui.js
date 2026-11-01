// Komponen antarmuka bersama untuk tab proyek (Tanah, Gempa, Penurunan, Laporan): kepala halaman, kartu lipat, satuan, footer.
import { L, AUTHOR, units } from "./desain/core.js"
import { el } from "./desain/ui.js"
import { ico } from "./icons.js"

export function initUnits() {
  try { const o = JSON.parse(localStorage.getItem("ymd.desain.v1") || "null"); units.sys = o && o.units === "t" ? "t" : "si" } catch (e) { units.sys = "si" }
}
export function hero(kicker, title, text, chips = []) {
  const h = el("section", "dz-hero pj-hero dz-in")
  h.innerHTML = `<div class="dz-hero-bg" aria-hidden="true"><i></i><i></i><i></i></div>`
  const t = el("div", "dz-hero-tx")
  t.append(el("span", "dz-kicker", kicker), el("h1", null, title), el("p", null, text))
  if (chips.length) { const c = el("div", "dz-chips"); chips.forEach((x) => c.append(el("span", "dz-chip", x))); t.append(c) }
  h.append(t)
  return h
}
// kartu lipat dengan status buka tersimpan per id
const openState = {}
export function card(id, icon, title, badge, body, open = true) {
  const d = el("details", "dz-sec dz-in")
  d.open = openState[id] ?? open
  d.addEventListener("toggle", () => { openState[id] = d.open })
  const sm = el("summary"); const ic = el("span", "dz-ico"); ic.append(ico(icon)); sm.append(ic, el("span", "dz-st", title))
  if (badge) sm.append(el("span", "dz-badge", badge))
  d.append(sm)
  if (body) d.append(...[].concat(body))
  return d
}
export const footer = () => { const f = el("p", "dz-foot"); f.innerHTML = `© ${AUTHOR} · YMD-CAL · ${L("pembanding desain, ikuti Design Basis & kode yang berlaku", "design cross-check; follow the Design Basis & governing codes")}`; return f }
export function nextBtn(href, label, sub) {
  const a = el("a", "pj-next dz-in"); a.href = href
  a.append(el("span", null, label), el("small", null, sub || ""), el("b", null, "→"))
  return a
}
