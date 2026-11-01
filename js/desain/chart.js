// Grafik garis SVG sederhana (dipakai tab Tanah, Gempa, Penurunan): sumbu dengan tick "rapi", sumbu x log opsional, sumbu y ke bawah (kedalaman),
// beberapa seri dengan legenda, penanda titik, garis bantu. Warna eksplisit agar ikut ke PDF.
import { root, T } from "./draw.js"
import { sv } from "./ui.js"
import { nf } from "./core.js"

const nice = (lo, hi, n = 5) => {
  const span = hi - lo || Math.abs(hi) || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = []
  for (let v = a; v <= b + step * 1e-6; v += step) out.push(+v.toPrecision(12))
  return { ticks: out, lo: a, hi: b, step }
}
const dec = (step) => Math.max(0, Math.min(3, -Math.floor(Math.log10(step) + 1e-9)))

export function lineChart(P, o) {
  const W = o.W || 760, H = o.H || 420, s = root(W, H, P, o.title || "chart")
  const m = { l: 70, r: o.legendRight ? 170 : 24, t: o.title ? 46 : 20, b: 52 }
  const all = o.series.flatMap((x) => x.pts).filter((p) => isFinite(p[0]) && isFinite(p[1]))
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1])
  let x0 = o.xMin ?? Math.min(...xs), x1 = o.xMax ?? Math.max(...xs), y0 = o.yMin ?? Math.min(0, ...ys), y1 = o.yMax ?? Math.max(...ys)
  if (!(x1 > x0)) x1 = x0 + 1
  if (!(y1 > y0)) y1 = y0 + 1
  const log = !!o.xLog
  let xt
  if (log) { x0 = Math.max(x0, 1e-6); const a = Math.floor(Math.log10(x0)), b = Math.ceil(Math.log10(x1)); xt = { ticks: Array.from({ length: b - a + 1 }, (_, i) => 10 ** (a + i)), lo: 10 ** a, hi: 10 ** b } }
  else xt = o.xNice === false ? { ticks: [x0, x1], lo: x0, hi: x1, step: x1 - x0 } : nice(x0, x1, o.xTicks || 6)
  const yt = nice(y0, y1, o.yTicks || 5)
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const X = (x) => m.l + (log ? (Math.log10(Math.max(x, 1e-9)) - Math.log10(xt.lo)) / (Math.log10(xt.hi) - Math.log10(xt.lo)) : (x - xt.lo) / (xt.hi - xt.lo)) * pw
  const Y = (y) => (o.yDown ? m.t + (y - yt.lo) / (yt.hi - yt.lo) * ph : m.t + ph - (y - yt.lo) / (yt.hi - yt.lo) * ph)
  if (o.title) T(s, 16, 28, o.title, { c: P.ink, fs: 14, b: true })
  s.append(sv("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: P.fill || "none", stroke: P.line, "stroke-width": 1 }))
  for (const v of yt.ticks) { s.append(sv("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), stroke: P.grid, "stroke-width": 1 })); T(s, m.l - 8, Y(v) + 4, nf(v, dec(yt.step)), { c: P.mut, fs: 10.5, a: "end" }) }
  for (const v of xt.ticks) { s.append(sv("line", { x1: X(v), x2: X(v), y1: m.t, y2: m.t + ph, stroke: P.grid, "stroke-width": 1 })); T(s, X(v), m.t + ph + 16, log ? (v >= 1 ? String(v) : String(+v.toPrecision(3))) : nf(v, dec(xt.step || 1)), { c: P.mut, fs: 10.5, a: "middle" }) }
  if (o.xLab) T(s, m.l + pw / 2, H - 10, o.xLab, { c: P.ink, fs: 11.5, a: "middle" })
  if (o.yLab) { const t = sv("text", { x: 16, y: m.t + ph / 2, fill: P.ink, "font-size": 13.5, "text-anchor": "middle", transform: `rotate(-90 16 ${m.t + ph / 2})`, "font-family": "Helvetica, Arial, sans-serif" }, o.yLab); s.append(t) }
  for (const h of o.hlines || []) { s.append(sv("line", { x1: m.l, x2: m.l + pw, y1: Y(h.y), y2: Y(h.y), stroke: h.c || P.acc, "stroke-width": 1.6, "stroke-dasharray": "7 5" })); if (h.label) T(s, m.l + pw - 6, Y(h.y) - 6, h.label, { c: h.c || P.acc, fs: 10.5, a: "end" }) }
  for (const v of o.vlines || []) { s.append(sv("line", { x1: X(v.x), x2: X(v.x), y1: m.t, y2: m.t + ph, stroke: v.c || P.acc, "stroke-width": 1.6, "stroke-dasharray": "7 5" })); if (v.label) T(s, X(v.x) + 5, m.t + 14, v.label, { c: v.c || P.acc, fs: 10.5 }) }
  o.series.forEach((se, i) => {
    const pts = se.pts.filter((p) => isFinite(p[0]) && isFinite(p[1]))
    if (!pts.length) return
    const d = pts.map((p, j) => `${j ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")
    if (se.fill) s.append(sv("path", { d: `${d} L${X(pts[pts.length - 1][0]).toFixed(1)},${Y(o.yDown ? yt.lo : Math.max(yt.lo, 0)).toFixed(1)} L${X(pts[0][0]).toFixed(1)},${Y(o.yDown ? yt.lo : Math.max(yt.lo, 0)).toFixed(1)} Z`, fill: se.c, opacity: 0.12, stroke: "none" }))
    const p = sv("path", { d, fill: "none", stroke: se.c, "stroke-width": se.w || 2.6, "stroke-linejoin": "round", "stroke-linecap": "round", ...(se.dash ? { "stroke-dasharray": se.dash } : { class: "dz-draw", pathLength: 1 }) })
    p.style.setProperty("--i", i); s.append(p)
    if (se.dots) pts.forEach((q) => s.append(sv("circle", { cx: X(q[0]), cy: Y(q[1]), r: 3.4, fill: se.c, stroke: P.bg, "stroke-width": 1.2 })))
  })
  for (const k of o.marks || []) { s.append(sv("circle", { cx: X(k.x), cy: Y(k.y), r: 6, fill: k.c || P.bad, stroke: "#fff", "stroke-width": 2, class: "dz-pulse" })); if (k.label) T(s, X(k.x) + 9, Y(k.y) - 8, k.label, { c: k.c || P.bad, fs: 11.5, b: true }) }
  const named = o.series.filter((x) => x.name)
  named.forEach((se, i) => {
    const lx = o.legendRight ? W - m.r + 14 : m.l + 10 + (i % 3) * 200, ly = o.legendRight ? m.t + 10 + i * 22 : m.t + 14 + Math.floor(i / 3) * 18
    s.append(sv("line", { x1: lx, x2: lx + 22, y1: ly, y2: ly, stroke: se.c, "stroke-width": 3, ...(se.dash ? { "stroke-dasharray": se.dash } : {}) }))
    T(s, lx + 28, ly + 4, se.name, { c: P.ink, fs: 10.5 })
  })
  s.X = X; s.Y = Y
  return s
}
