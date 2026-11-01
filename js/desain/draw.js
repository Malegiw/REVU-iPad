// Gambar SVG modul Desain (layar: beranimasi lewat kelas CSS; ekspor: palet cetak, kelas dibuang). Semua warna eksplisit supaya gambar ikut ke PDF.
import { L, nf, ndu, uName, toDisp } from "./core.js"
import { sv } from "./ui.js"

export function palette(mode) {
  const dark = mode !== "print" && document.documentElement.dataset.theme === "dark"
  return dark
    ? { bg: "#13202C", ink: "#E8EDF3", mut: "#9FB0C0", line: "#3A4C5E", conc: "#5B6570", concD: "#8A939C", concL: "#46505A", steel: "#9BC7D6", clay: "#6E5440", sand: "#857245", water: "#5FB0E8", liq: "#2C6AA3", liqT: "#4E8FCC", acc: "#E3A857", ok: "#4cc27a", bad: "#ff8a7a", wind: "#7CC7E8", arw: "#F59E5B", grid: "#22303D", reb: "#ff9b8a", fill: "#1A2633", machine: "#6F8FAF", machine2: "#4D6A86" }
    : { bg: "#FAF9F7", ink: "#1F2430", mut: "#5C6573", line: "#C3C8CF", conc: "#CFC9BE", concD: "#8F887D", concL: "#E4DFD6", steel: "#3F5A75", clay: "#C9A586", sand: "#E9D9AE", water: "#3D8FD1", liq: "#5E9BD3", liqT: "#87B6E2", acc: "#D18A2E", ok: "#1a7f37", bad: "#b42318", wind: "#2F7FA8", arw: "#C2410C", grid: "#E7E3DB", reb: "#B42318", fill: "#FFFFFF", machine: "#4A6078", machine2: "#27323F" }
}
const FONT = "Helvetica, Arial, sans-serif"
export function root(W, H, P, label) {
  const s = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "dz-svg", role: "img", "aria-label": label, "font-family": FONT })
  s.append(sv("rect", { x: 0, y: 0, width: W, height: H, fill: P.bg, rx: 0 }))
  const defs = sv("defs")
  const hp = sv("pattern", { id: "hc" + Math.random().toString(36).slice(2, 7), width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" })
  hp.append(sv("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: P.concD, "stroke-width": 1, opacity: 0.55 }))
  defs.append(hp); s.append(defs); s.hatch = `url(#${hp.id})`
  return s
}
export const T = (s, x, y, txt, o = {}) => { s.append(sv("text", { x, y, fill: o.c || "#000", "font-size": ((o.fs || 13) * 1.18).toFixed(1), "font-weight": o.b ? 700 : 400, "text-anchor": o.a || "start", "dominant-baseline": o.base || "auto", "font-family": FONT, ...(o.cls ? { class: o.cls } : {}) }, txt)) }
export function arrow(s, x1, y1, x2, y2, c, w = 3, cls) {
  const g = sv("g", cls ? { class: cls } : {})
  const a = Math.atan2(y2 - y1, x2 - x1), h = 7 + w * 2
  g.append(sv("line", { x1, y1, x2: x2 - Math.cos(a) * h * 0.8, y2: y2 - Math.sin(a) * h * 0.8, stroke: c, "stroke-width": w, "stroke-linecap": "round" }))
  g.append(sv("polygon", { points: [[x2, y2], [x2 - h * Math.cos(a - 0.42), y2 - h * Math.sin(a - 0.42)], [x2 - h * Math.cos(a + 0.42), y2 - h * Math.sin(a + 0.42)]].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), fill: c }))
  s.append(g); return g
}
export function dim(s, x1, y1, x2, y2, txt, P, off = 0, vertical = false) {
  const g = sv("g")
  g.append(sv("line", { x1, y1, x2, y2, stroke: P.mut, "stroke-width": 1 }))
  const tk = (x, y) => g.append(sv("line", vertical ? { x1: x - 5, y1: y, x2: x + 5, y2: y, stroke: P.mut, "stroke-width": 1.4 } : { x1: x, y1: y - 5, x2: x, y2: y + 5, stroke: P.mut, "stroke-width": 1.4 }))
  tk(x1, y1); tk(x2, y2)
  s.append(g)
  if (vertical) T(s, x1 + 8 + off, (y1 + y2) / 2, txt, { c: P.mut, fs: 12, base: "middle" })
  else T(s, (x1 + x2) / 2, y1 - 7 + off, txt, { c: P.mut, fs: 12, a: "middle" })
}
export const R = (s, x, y, w, h, fill, stroke, o = {}) => { const r = sv("rect", { x: Math.min(x, x + w), y: Math.min(y, y + h), width: Math.abs(w), height: Math.abs(h), fill, stroke: stroke || "none", "stroke-width": o.sw || 1.5, rx: o.rx || 0, ...(o.cls ? { class: o.cls } : {}), ...(o.op != null ? { opacity: o.op } : {}) }); s.append(r); return r }
export const path = (s, d, o) => { const p = sv("path", { d, fill: "none", ...o }); s.append(p); return p }
function windArrows(s, x, y0, y1, P, n = 4, len = 52) {
  for (let i = 0; i < n; i++) {
    const y = y0 + (y1 - y0) * (i + 0.5) / n
    const g = arrow(s, x, y, x + len * (0.75 + 0.25 * Math.sin(i * 1.7)), y, P.wind, 2.4, "dz-flow")
    g.style.setProperty("--d", `${i * 0.25}s`)
  }
  T(s, x, y0 - 8, L("Angin", "Wind"), { c: P.wind, fs: 12, b: true })
}

// ---------------------------------------------------------------- tiang: tampak samping + profil defleksi & momen
export function pileElevation(I, Rr, P) {
  const W = 960, H = 700, s = root(W, H, P, L("Potongan kelompok tiang dan profil lateral", "Pile group section and lateral profiles"))
  const top = 124, Lp = Rr.Lp, hc = I.hc, depth = Math.max(Lp, I.layers.reduce((a, l) => a + l.h, 0)) + 0.8
  const ky = (H - top - 40) / (depth + hc + 1.4), Z = (z) => top + (1.4 + hc + z) * ky
  const x0 = 40, x1 = 560, cw = (I.nx - 1) * I.sx + 2 * I.ce, kx = Math.min((x1 - x0 - 170) / cw, ky * 4), cx = (x0 + x1) / 2, X = (x) => cx + x * kx
  // tanah
  let z = 0
  I.layers.forEach((ly) => {
    const y0 = Z(z), y1 = Z(Math.min(z + ly.h, depth))
    R(s, x0, y0, x1 - x0, y1 - y0, ly.type === "clay" ? P.clay : P.sand, null, { op: 0.55 })
    T(s, x0 + 8, y0 + 18, ly.type === "clay" ? `${L("Lempung", "Clay")} cu = ${nf(toDisp("Q", ly.cu), 0)} ${uName("Q")}` : `${L("Pasir", "Sand")} φ = ${nf(ly.phi, 0)}°`, { c: P.ink, fs: 12, b: true })
    z += ly.h
  })
  s.append(sv("line", { x1: x0, y1: Z(0), x2: x1, y2: Z(0), stroke: P.ink, "stroke-width": 2 }))
  if (I.gwt < depth) {
    const yw = Z(I.gwt)
    s.append(sv("line", { x1: x0, y1: yw, x2: x1, y2: yw, stroke: P.water, "stroke-width": 2, "stroke-dasharray": "8 6", class: "dz-flow-line" }))
    s.append(sv("polygon", { points: `${x1 - 40},${yw - 12} ${x1 - 28},${yw - 12} ${x1 - 34},${yw - 2}`, fill: P.water }))
    T(s, x1 - 46, yw - 16, L("MAT", "GWT"), { c: P.water, fs: 12, b: true, a: "end" })
  }
  // pile cap & kolom
  const capY = Z(-hc)
  R(s, X(-cw / 2), capY, cw * kx, hc * ky, P.conc, P.concD)
  R(s, X(-cw / 2), capY, cw * kx, hc * ky, s.hatch, null)
  R(s, X(-I.cx / 2), capY - 1.2 * ky, I.cx * kx, 1.2 * ky, P.conc, P.concD)
  // tiang
  const pw = Math.max(Rr.D * kx, 7)
  for (let i = 0; i < I.nx; i++) {
    const px = X((i - (I.nx - 1) / 2) * I.sx)
    const g = sv("g", { class: "dz-pile", style: `--i:${i}` })
    g.append(sv("rect", { x: px - pw / 2, y: Z(-I.emb / 1000), width: pw, height: (Lp + I.emb / 1000) * ky, fill: P.steel, rx: 2 }))
    if (Rr.isH) Rr.ax.hel.forEach((h) => { const hw = Math.max(h.Dh * kx, 16); g.append(sv("ellipse", { cx: px, cy: Z(h.z), rx: hw / 2, ry: 4, fill: "none", stroke: P.steel, "stroke-width": 3, transform: `rotate(-8 ${px} ${Z(h.z)})` })) })
    else g.append(sv("rect", { x: px - pw / 2, y: Z(0) - 1, width: pw, height: Math.min(I.Lp / 1000, Lp) * ky, fill: P.conc, opacity: 0.85 }))
    s.append(g)
  }
  // beban
  const ay = capY - 1.2 * ky
  arrow(s, X(0), ay - 70, X(0), ay - 4, P.arw, 4, "dz-bob")
  T(s, X(0) + 10, ay - 52, "P", { c: P.arw, fs: 15, b: true })
  arrow(s, X(-cw / 2) - 80, capY + hc * ky / 2, X(-cw / 2) - 6, capY + hc * ky / 2, P.arw, 4, "dz-bob-x")
  T(s, X(-cw / 2) - 78, capY + hc * ky / 2 - 10, "H", { c: P.arw, fs: 15, b: true })
  // titik jepit
  const yf = Z(Rr.Lf)
  s.append(sv("line", { x1: X(-cw / 2) - 20, y1: yf, x2: X(cw / 2) + 20, y2: yf, stroke: P.bad, "stroke-width": 2, "stroke-dasharray": "6 5" }))
  T(s, X(cw / 2) + 26, yf + 4, `${L("titik jepit", "fixity")} Lf = ${nf(Rr.Lf, 2)} m`, { c: P.bad, fs: 12, b: true })
  dim(s, x0 + 18, Z(0), x0 + 18, Z(Lp), `L = ${nf(Lp, 1)} m`, P, 0, true)
  T(s, x0, 30, `${Rr.isH ? L("Tiang helical", "Helical pile") : L("Tiang pipa baja", "Steel pipe pile")} Ø${nf(Rr.Dmm, 1)} × ${nf(Rr.isH ? I.ts : I.t, 1)} mm · ${I.nx}×${I.ny} · ${Rr.head === "fixed" ? L("kepala jepit", "fixed head") : L("kepala sendi", "pinned head")}`, { c: P.ink, fs: 15, b: true })
  // profil lateral (kanan)
  const gx0 = 600, gx1 = W - 20, zMax = Math.min(Lp, Math.max(5 * Rr.Lf, 6)), kz = (H - top - 60) / zMax, Zr = (zz) => top + 30 + zz * kz
  const half = (gx1 - gx0 - 20) / 2
  const panel = (px, title, vals, unit, col) => {
    const mx = Math.max(...vals.map((v) => Math.abs(v)), 1e-9), kxx = (half / 2 - 10) / mx, mid = px + half / 2
    R(s, px, top + 20, half, H - top - 50, P.fill, P.line, { rx: 10 })
    T(s, mid, top - 14, title[0], { c: P.ink, fs: 13, b: true, a: "middle" })
    s.append(sv("line", { x1: mid, y1: Zr(0), x2: mid, y2: Zr(zMax), stroke: P.line, "stroke-width": 1 }))
    for (let k = 0; k <= 4; k++) { const zz = zMax * k / 4; T(s, px + 4, Zr(zz) + 4, nf(zz, 1), { c: P.mut, fs: 10 }) }
    const pts = Rr.prof.z.map((zz, i) => [zz, vals[i]]).filter(([zz]) => zz >= -1e-9 && zz <= zMax)
    const d = pts.map(([zz, v], i) => `${i ? "L" : "M"}${(mid + v * kxx).toFixed(1)},${Zr(zz).toFixed(1)}`).join(" ")
    path(s, d + ` L${mid},${Zr(pts[pts.length - 1][0]).toFixed(1)} L${mid},${Zr(pts[0][0]).toFixed(1)} Z`, { fill: col, opacity: 0.16, stroke: "none", class: "dz-fade" })
    path(s, d, { stroke: col, "stroke-width": 3, "stroke-linejoin": "round", class: "dz-draw", pathLength: 1 })
    let im = 0; pts.forEach(([, v], i) => { if (Math.abs(v) > Math.abs(pts[im][1])) im = i })
    s.append(sv("circle", { cx: mid + pts[im][1] * kxx, cy: Zr(pts[im][0]), r: 5, fill: col, class: "dz-pulse" }))
    T(s, mid, top + 6, `${title[1]} · ${L("maks", "max")} ${nf(Math.abs(pts[im][1]), 1)} ${unit}`, { c: col, fs: 10, b: true, a: "middle" })
  }
  panel(gx0, [L("Defleksi y", "Deflection y"), L("layan", "service")], Rr.prof.y, "mm", P.wind)
  panel(gx0 + half + 20, [L("Momen M", "Moment M"), "LRFD"], Rr.prof.M, uName("M"), P.arw)
  T(s, gx0, H - 10, L("kedalaman dari kepala tiang (m) · Winkler/elemen hingga", "depth below pile head (m) · Winkler/finite element"), { c: P.mut, fs: 11 })
  T(s, x0, H - 10, L("skala horizontal diperbesar", "horizontal scale exaggerated"), { c: P.mut, fs: 10.5 })
  return s
}

// ---------------------------------------------------------------- tiang: detail sambungan + denah kelompok
export function pileConnection(I, Rr, P) {
  const W = 960, H = 520, s = root(W, H, P, L("Detail kepala tiang dan denah kelompok", "Pile head detail and group plan"))
  const fixed = Rr.head === "fixed"
  T(s, 30, 34, `${L("Detail sambungan", "Connection detail")}: ${fixed ? L("JEPIT (momen ditransfer lewat beton isi bertulang)", "FIXED (moment via reinforced infill)") : L("SENDI (tanam pendek + dowel)", "PINNED (short embedment + dowels)")}`, { c: P.ink, fs: 15, b: true })
  const k = 300 / Math.max(I.hc + I.Lp / 1000 + 0.4, 1.6), cx = 250, capTop = 70, capH = I.hc * k
  const Dw = Math.max(Rr.Dmm / 1000 * k, 60), emb = I.emb / 1000 * k, Lp = I.Lp / 1000 * k, t = Math.max((Rr.isH ? I.ts : I.t) / 1000 * k, 4)
  R(s, cx - 200, capTop, 400, capH, P.conc, P.concD)
  R(s, cx - 200, capTop, 400, capH, s.hatch, null)
  T(s, cx - 192, capTop + 20, "Pile cap", { c: P.ink, fs: 13, b: true })
  const pileTop = capTop + capH - emb
  R(s, cx - Dw / 2, pileTop, Dw, H - 40 - pileTop, P.steel, null)
  R(s, cx - Dw / 2 + t, pileTop, Dw - 2 * t, Lp + emb, P.concL, null)
  R(s, cx - Dw / 2 + t, pileTop, Dw - 2 * t, Lp + emb, s.hatch, null)
  s.append(sv("line", { x1: cx - Dw / 2 + t, y1: pileTop + Lp + emb, x2: cx + Dw / 2 - t, y2: pileTop + Lp + emb, stroke: P.ink, "stroke-width": 3 }))
  T(s, cx + Dw / 2 + 12, pileTop + Lp + emb + 4, L("pelat/penyumbat dasar beton isi", "infill base plate/plug"), { c: P.mut, fs: 11 })
  const nshow = Math.min(4, I.nd), dc = (Dw - 2 * t - 24)
  for (let i = 0; i < nshow; i++) {
    const x = cx - dc / 2 + dc * i / (nshow - 1 || 1)
    const yb = pileTop + Lp + emb - 18, ytop = capTop + 40
    const dd = fixed || true ? `M${x},${yb} L${x},${ytop}` + (I.hook ? ` L${x + (i < nshow / 2 ? -26 : 26)},${ytop}` : "") : ""
    path(s, dd, { stroke: P.reb, "stroke-width": 3.2, "stroke-linecap": "round", class: "dz-draw", pathLength: 1, style: `--i:${i}` })
  }
  for (let y = pileTop + 30; y < pileTop + Lp + emb - 20; y += 34) s.append(sv("line", { x1: cx - dc / 2 - 6, y1: y, x2: cx + dc / 2 + 6, y2: y, stroke: P.reb, "stroke-width": 1.4, opacity: 0.7 }))
  s.append(sv("line", { x1: cx - 220, y1: capTop + capH, x2: cx + 220, y2: capTop + capH, stroke: P.ink, "stroke-width": 1.5, "stroke-dasharray": "4 4" }))
  dim(s, cx + Dw / 2 + 50, pileTop, cx + Dw / 2 + 50, capTop + capH, `${L("tanam", "embed")} ${nf(I.emb, 0)} mm`, P, 0, true)
  dim(s, cx - Dw / 2 - 40, pileTop, cx - Dw / 2 - 40, pileTop + Lp + emb, "", P, 0, true)
  T(s, cx - Dw / 2 - 48, pileTop + (Lp + emb) / 2, `Lp ${nf(I.Lp, 0)}`, { c: P.mut, fs: 12, a: "end", base: "middle" })
  T(s, cx, H - 16, `Ø${nf(Rr.Dmm, 1)} × ${nf(Rr.isH ? I.ts : I.t, 1)} · ${I.nd} D${I.dbd} ${I.hook ? L("berkait", "hooked") : L("lurus", "straight")} · fc' ${nf(I.fcp, 0)} MPa`, { c: P.ink, fs: 12, b: true, a: "middle" })
  // denah kelompok dengan reaksi
  const px0 = 540, py0 = 70, pw = 390, ph = 400, cw = (I.nx - 1) * I.sx + 2 * I.ce, cl = (I.ny - 1) * I.sy + 2 * I.ce
  const kk = Math.min(pw / cw, ph / cl) * 0.86, mx = px0 + pw / 2, my = py0 + ph / 2
  T(s, px0, 50, L("Denah kelompok · reaksi tiang (ASD penentu)", "Group plan · pile reactions (governing ASD)"), { c: P.ink, fs: 13, b: true })
  R(s, mx - cw * kk / 2, my - cl * kk / 2, cw * kk, cl * kk, P.concL, P.concD, { rx: 4 })
  R(s, mx - I.cx * kk / 2, my - I.cy * kk / 2, I.cx * kk, I.cy * kk, P.conc, P.concD)
  const gv = Rr.govC
  const pmax = Math.max(...Rr.piles.map((_, i) => Math.abs(gv ? gv.r.Pi[i] : 0)), 1e-9)
  Rr.piles.forEach((p, i) => {
    const v = gv ? gv.r.Pi[i] : 0, r = Math.max(Rr.D * kk / 2, 9)
    const c = sv("circle", { cx: mx + p.x * kk, cy: my - p.y * kk, r, fill: v >= 0 ? P.steel : P.bad, opacity: 0.35 + 0.65 * Math.abs(v) / pmax, class: "dz-pop", style: `--i:${i}` })
    s.append(c)
    T(s, mx + p.x * kk, my - p.y * kk + r + 15, nf(toDisp("F", v), 0), { c: v >= 0 ? P.ink : P.bad, fs: 12, b: true, a: "middle" })
  })
  T(s, mx, py0 + ph + 10, `${uName("F")} · ${gv ? gv.c.id : ""} · ${L("negatif = tarik", "negative = tension")}`, { c: P.mut, fs: 11, a: "middle" })
  arrow(s, px0 + 8, py0 + ph - 8, px0 + 48, py0 + ph - 8, P.mut, 2); T(s, px0 + 52, py0 + ph - 4, "x", { c: P.mut, fs: 12 })
  arrow(s, px0 + 8, py0 + ph - 8, px0 + 8, py0 + ph - 48, P.mut, 2); T(s, px0 + 2, py0 + ph - 54, "y", { c: P.mut, fs: 12 })
  return s
}

// ---------------------------------------------------------------- tangki
export function tankDraw(I, out, P) {
  const W = 960, H = 560, s = root(W, H, P, L("Tangki dan pondasinya", "Tank and its foundation"))
  const T0 = out.T, ring = out.type === "ring", Hs = I.Hs, hr = T0.hr
  const k = Math.min(700 / (I.D + 2.5), 360 / (Hs + hr + 2.2)), cx = 470, gy = 120 + (Hs + hr) * k + 30
  const X = (x) => cx + x * k, Y = (z) => gy - z * k
  T(s, 30, 34, `${I.preset === "wash" ? "Wash Tank" : I.preset === "surge" ? "Surge Tank" : L("Tangki", "Tank")} Ø${nf(I.D, 2)} × ${nf(Hs, 2)} m · ${ring ? L("pondasi RINGWALL", "RINGWALL foundation") : L("pondasi PELAT PENUH", "FULL SLAB foundation")}`, { c: P.ink, fs: 15, b: true })
  R(s, 20, gy, W - 40, H - gy - 10, P.sand, null, { op: 0.45 })
  s.append(sv("line", { x1: 20, y1: gy, x2: W - 20, y2: gy, stroke: P.ink, "stroke-width": 2 }))
  const base = 0.25
  if (ring) {
    const b = I.rb, hh = I.rh
    for (const sgn of [-1, 1]) {
      const xr = X(sgn * I.D / 2) - b * k / 2
      R(s, xr, Y(base), b * k, hh * k, P.conc, P.concD); R(s, xr, Y(base), b * k, hh * k, s.hatch, null)
      if ((I.rbf || 0) > b) R(s, X(sgn * I.D / 2) - I.rbf * k / 2, Y(base - hh + I.rtf), I.rbf * k, I.rtf * k, P.conc, P.concD)
      for (let q = 0; q < 3; q++) s.append(sv("circle", { cx: xr + b * k * (0.25 + 0.25 * q), cy: Y(base) + hh * k * 0.5, r: 3, fill: P.reb }))
    }
    R(s, X(-I.D / 2) + I.rb * k / 2, Y(base), (I.D - I.rb) * k, (I.hpad || 0.5) * k * 0.6, P.sand, P.concD, { op: 0.9 })
    T(s, cx, Y(base) + 22, L("urugan pasir/agregat terpadatkan", "compacted sand/aggregate pad"), { c: P.ink, fs: 11, a: "middle" })
  } else {
    const Ds = I.D + 2 * I.proj
    R(s, X(-Ds / 2), Y(base), Ds * k, I.sh * k, P.conc, P.concD); R(s, X(-Ds / 2), Y(base), Ds * k, I.sh * k, s.hatch, null)
    for (let q = 0; q < 18; q++) { s.append(sv("circle", { cx: X(-Ds / 2) + 10 + (Ds * k - 20) * q / 17, cy: Y(base) + I.sh * k - 8, r: 2.2, fill: P.reb })); s.append(sv("circle", { cx: X(-Ds / 2) + 10 + (Ds * k - 20) * q / 17, cy: Y(base) + 8, r: 2.2, fill: P.reb })) }
  }
  // tangki
  const sh = sv("g", { class: "dz-tank" })
  sh.append(sv("rect", { x: X(-I.D / 2), y: Y(base + Hs), width: I.D * k, height: Hs * k, fill: P.fill, stroke: P.steel, "stroke-width": 3 }))
  const clipId = "tk" + Math.random().toString(36).slice(2, 7)
  const cp = sv("clipPath", { id: clipId }); cp.append(sv("rect", { x: X(-I.D / 2) + 2, y: Y(base + I.H) - 12, width: I.D * k - 4, height: I.H * k + 10 })); s.querySelector("defs").append(cp)
  const lq = sv("g", { "clip-path": `url(#${clipId})` })
  lq.append(sv("rect", { x: X(-I.D / 2) + 2, y: Y(base + I.H) + 4, width: I.D * k - 4, height: I.H * k - 4, fill: P.liq, opacity: 0.75 }))
  let wd = `M${X(-I.D / 2) - 120},${Y(base + I.H) + 6}`
  for (let x = -120; x < I.D * k + 240; x += 40) wd += ` q10,-10 20,0 t20,0`
  wd += ` V${Y(base)} H${X(-I.D / 2) - 120} Z`
  lq.append(sv("path", { d: wd, fill: P.liqT, opacity: 0.85, class: "dz-wave" }))
  sh.append(lq)
  sh.append(sv("polygon", { points: `${X(-I.D / 2) - 4},${Y(base + Hs)} ${X(0)},${Y(base + Hs + hr)} ${X(I.D / 2) + 4},${Y(base + Hs)}`, fill: P.concL, stroke: P.steel, "stroke-width": 3 }))
  if (I.roof === "col" && I.nCol > 0) sh.append(sv("line", { x1: X(0), y1: Y(base), x2: X(0), y2: Y(base + Hs + hr), stroke: P.steel, "stroke-width": 3, "stroke-dasharray": "2 0" }))
  s.append(sh)
  windArrows(s, X(-I.D / 2) - 110, Y(base + Hs) + 10, Y(base + 0.8), P, 5, 70)
  dim(s, X(-I.D / 2), Y(base + Hs + hr) - 16, X(I.D / 2), Y(base + Hs + hr) - 16, `D = ${nf(I.D, 2)} m`, P)
  dim(s, X(I.D / 2) + 30, Y(base + Hs), X(I.D / 2) + 30, Y(base), `Hs = ${nf(Hs, 2)} m`, P, 0, true)
  dim(s, X(I.D / 2) + 130, Y(base + I.H), X(I.D / 2) + 130, Y(base), `H = ${nf(I.H, 2)} m`, P, 0, true)
  // tekanan tanah
  const qv = out.R.wq ? (ring ? out.R.wq.q : out.R.wq.pr.qmax) : 0
  const n = 14, x0 = ring ? -I.D / 2 - I.rb : -(I.D / 2 + I.proj), x1 = -x0
  for (let i = 0; i <= n; i++) { const x = X(x0 + (x1 - x0) * i / n); if (ring && Math.abs(x0 + (x1 - x0) * i / n) < I.D / 2 - I.rb) continue; arrow(s, x, H - 14, x, Y(base - (ring ? I.rh : I.sh)) + 6, P.arw, 2, "dz-grow") }
  T(s, W - 30, H - 22, `q ${L("maks", "max")} = ${ndu("Q", qv, 1)}`, { c: P.arw, fs: 13, b: true, a: "end" })
  return s
}

// ---------------------------------------------------------------- vessel / peralatan di atas footing (tampak samping)
export function vesselDraw(I, out, P) {
  const W = 960, H = 560, s = root(W, H, P, L("Vessel dan pondasinya", "Vessel and its foundation"))
  const vert = I.kind === "v"
  const B = I.B, t = I.t, hp = I.hp, Df = I.Df
  const totH = vert ? I.H + hp + t + 1 : I.hc + I.D / 2 + hp + t + 1, totW = vert ? B + 3 : Math.max(B, I.Ls + 2 * I.bx, I.Ltt + I.D) + 2
  const k = Math.min((W - 220) / totW, (H - 150) / totH), cx = 470, gy = H - 90 - (t + hp - Df) * k * 0 - Df * k * 0
  const baseY = H - 70, X = (x) => cx + x * k, Y = (z) => baseY - z * k                         // z = 0 di dasar footing
  T(s, 30, 34, vert ? `${I.preset === "gasboot" ? "Gas Boot" : "Instrument Air Receiver"} Ø${nf(I.D, 2)} × ${nf(I.H, 2)} m` : `Separator Ø${nf(I.D, 2)} × ${nf(I.Ltt, 2)} m T/T · ${L("2 saddle", "2 saddles")}`, { c: P.ink, fs: 15, b: true })
  R(s, 20, Y(Df), W - 40, baseY - Y(Df) + 60, P.sand, null, { op: 0.4 })
  s.append(sv("line", { x1: 20, y1: Y(Df), x2: W - 20, y2: Y(Df), stroke: P.ink, "stroke-width": 2 }))
  const footW = vert ? B : (I.fType === "comb" ? B : I.B)
  const foots = vert || I.fType === "comb" ? [0] : [-I.Ls / 2, I.Ls / 2]
  foots.forEach((fx) => { R(s, X(fx - footW / 2), Y(t), footW * k, t * k, P.conc, P.concD); R(s, X(fx - footW / 2), Y(t), footW * k, t * k, s.hatch, null) })
  const peds = vert ? [{ x: 0, w: I.Dp }] : [{ x: -I.Ls / 2, w: I.bx }, { x: I.Ls / 2, w: I.bx }]
  peds.forEach((p) => { R(s, X(p.x - p.w / 2), Y(t + hp), p.w * k, hp * k, P.conc, P.concD); R(s, X(p.x - p.w / 2), Y(t + hp), p.w * k, hp * k, s.hatch, null) })
  const g = sv("g", { class: "dz-equip" })
  if (vert) {
    const z0 = t + hp, De = I.D
    g.append(sv("rect", { x: X(-De / 2) + 6, y: Y(z0 + I.H * 0.12), width: De * k - 12, height: I.H * 0.12 * k, fill: P.concL, stroke: P.steel, "stroke-width": 2 }))
    g.append(sv("path", { d: `M${X(-De / 2)},${Y(z0 + I.H * 0.12)} V${Y(z0 + I.H - De / 4)} A${De * k / 2},${De * k / 4} 0 0 1 ${X(De / 2)},${Y(z0 + I.H - De / 4)} V${Y(z0 + I.H * 0.12)} Z`, fill: P.fill, stroke: P.steel, "stroke-width": 3 }))
    g.append(sv("path", { d: `M${X(-De / 2)},${Y(z0 + I.H * 0.12)} A${De * k / 2},${De * k / 4} 0 0 0 ${X(De / 2)},${Y(z0 + I.H * 0.12)}`, fill: "none", stroke: P.steel, "stroke-width": 2 }))
    for (let i = 1; i <= 3; i++) g.append(sv("line", { x1: X(De / 2), y1: Y(z0 + I.H * (0.2 + 0.22 * i)), x2: X(De / 2) + 18, y2: Y(z0 + I.H * (0.2 + 0.22 * i)), stroke: P.steel, "stroke-width": 4 }))
    g.append(sv("line", { x1: X(-De / 2) - 14, y1: Y(z0 + 0.3), x2: X(-De / 2) - 14, y2: Y(z0 + I.H * 0.9), stroke: P.mut, "stroke-width": 2 }))
    s.append(g)
    windArrows(s, X(-De / 2) - 140, Y(z0 + I.H * 0.95), Y(z0 + I.H * 0.2), P, 5, 80)
    dim(s, X(De / 2) + 60, Y(z0 + I.H), X(De / 2) + 60, Y(z0), `H = ${nf(I.H, 2)} m`, P, 0, true)
  } else {
    const zc = t + hp + I.hc, Lt = I.Ltt, De = I.D
    for (const p of peds) g.append(sv("polygon", { points: `${X(p.x - p.w / 2)},${Y(t + hp)} ${X(p.x + p.w / 2)},${Y(t + hp)} ${X(p.x + p.w / 2 - 0.05)},${Y(zc - De * 0.3)} ${X(p.x - p.w / 2 + 0.05)},${Y(zc - De * 0.3)}`, fill: P.concL, stroke: P.steel, "stroke-width": 2 }))
    g.append(sv("path", { d: `M${X(-Lt / 2)},${Y(zc + De / 2)} H${X(Lt / 2)} A${De * k / 4},${De * k / 2} 0 0 1 ${X(Lt / 2)},${Y(zc - De / 2)} H${X(-Lt / 2)} A${De * k / 4},${De * k / 2} 0 0 1 ${X(-Lt / 2)},${Y(zc + De / 2)} Z`, fill: P.fill, stroke: P.steel, "stroke-width": 3 }))
    g.append(sv("line", { x1: X(-Lt / 2), y1: Y(zc), x2: X(Lt / 2), y2: Y(zc), stroke: P.line, "stroke-width": 1, "stroke-dasharray": "10 6" }))
    s.append(g)
    T(s, X(-I.Ls / 2), Y(t + hp) - 6 - (I.hc - De * 0.3) * k * 0, L("tetap", "fixed"), { c: P.mut, fs: 11, a: "middle" })
    T(s, X(I.Ls / 2), Y(t + hp) - 6, L("geser", "sliding"), { c: P.mut, fs: 11, a: "middle" })
    windArrows(s, X(-Lt / 2 - De / 4) - 110, Y(zc + De / 2), Y(zc - De / 2), P, 3, 70)
    dim(s, X(-I.Ls / 2), Y(zc + De / 2) - 22, X(I.Ls / 2), Y(zc + De / 2) - 22, `Ls = ${nf(I.Ls, 2)} m`, P)
  }
  // diagram tekanan tanah ASD penentu
  const r0 = out.res[0].r, gv = r0.asd.reduce((a, b) => (b.pr.qmax / b.qa > a.pr.qmax / a.qa ? b : a), r0.asd[0])
  if (gv && isFinite(gv.pr.qmax)) {
    const qmax = gv.pr.qmax, Bx = vert || I.fType === "comb" ? B : I.B, xs = foots.length > 1 ? foots : [0]
    xs.forEach((fx) => {
      const pts = [], n = 24
      for (let i = 0; i <= n; i++) { const x = -Bx / 2 + Bx * i / n, q = Math.max(0, gv.pr.q0 + gv.pr.gx * x); pts.push([X(fx + x), baseY + 6 + q / qmax * 48]) }
      const d = `M${X(fx - Bx / 2)},${baseY + 6} ` + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + ` L${X(fx + Bx / 2)},${baseY + 6} Z`
      path(s, d, { fill: P.arw, opacity: 0.22, stroke: P.arw, "stroke-width": 2, class: "dz-grow" })
    })
    T(s, X(B / 2) + 10, baseY + 40, `q ${L("maks", "max")} ${ndu("Q", qmax, 1)} · ${gv.c.id}`, { c: P.arw, fs: 12, b: true })
  }
  dim(s, X(-footW / 2), baseY + 0 + 4 + 52 + 10, X(footW / 2), baseY + 4 + 52 + 10, `B = ${nf(footW, 2)} m`, P)
  return s
}

// ---------------------------------------------------------------- denah footing dengan peta tekanan
export function footingPlan(r, m, P, title) {
  const W = 760, H = 520, s = root(W, H, P, L("Denah tekanan tanah", "Soil pressure plan"))
  const [x0, y0, x1, y1] = r.geo.bbox, k = Math.min((W - 200) / (x1 - x0), (H - 110) / (y1 - y0)), cx = (W - 120) / 2 + 20, cy = H / 2 + 14
  const X = (x) => cx + x * k, Y = (y) => cy - y * k
  T(s, 20, 30, title || L("Denah · tekanan tanah kombinasi ASD penentu", "Plan · soil pressure, governing ASD combination"), { c: P.ink, fs: 14, b: true })
  const gv = r.asd.reduce((a, b) => (b.pr.qmax / b.qa > a.pr.qmax / a.qa ? b : a), r.asd[0])
  const qm = gv && isFinite(gv.pr.qmax) ? gv.pr.qmax : 1
  const col = (f) => { const a = [[0.24, 0.55, 0.85], [0.35, 0.75, 0.45], [0.95, 0.78, 0.25], [0.86, 0.33, 0.2]], t2 = Math.min(Math.max(f, 0), 1) * 3, i = Math.min(2, Math.floor(t2)), u = t2 - i; return `rgb(${a[i].map((v, j) => Math.round(255 * (v + (a[i + 1][j] - v) * u))).join(",")})` }
  const cs = Math.sqrt(r.geo.dA) * k + 0.6, grp = sv("g", { class: "dz-fade" })
  if (gv && gv.pr.q0 != null) for (let i = 0; i < r.geo.X.length; i += 1) {
    const q = Math.max(0, gv.pr.q0 + gv.pr.gx * r.geo.X[i] + gv.pr.gy * r.geo.Y[i])
    grp.append(sv("rect", { x: (X(r.geo.X[i]) - cs / 2).toFixed(1), y: (Y(r.geo.Y[i]) - cs / 2).toFixed(1), width: cs.toFixed(1), height: cs.toFixed(1), fill: q > 0 ? col(q / qm) : P.grid }))
  }
  s.append(grp)
  s.append(sv("polygon", { points: r.geo.poly.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" "), fill: "none", stroke: P.ink, "stroke-width": 2.5 }))
  for (const p of m.peds) {
    if (p.shape === "rect") s.append(sv("rect", { x: X(p.x - p.bx / 2), y: Y(p.y + p.by / 2), width: p.bx * k, height: p.by * k, fill: "none", stroke: P.ink, "stroke-width": 2, "stroke-dasharray": "6 4" }))
    else if (p.shape === "oct") { const Rr = p.bx / 2 / Math.cos(Math.PI / 8); s.append(sv("polygon", { points: Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${X(p.x + Rr * Math.cos(a)).toFixed(1)},${Y(p.y + Rr * Math.sin(a)).toFixed(1)}` }).join(" "), fill: "none", stroke: P.ink, "stroke-width": 2, "stroke-dasharray": "6 4" })) }
    else s.append(sv("circle", { cx: X(p.x), cy: Y(p.y), r: p.bx * k / 2, fill: "none", stroke: P.ink, "stroke-width": 2, "stroke-dasharray": "6 4" }))
  }
  if (gv) { s.append(sv("circle", { cx: X(gv.pr.ex), cy: Y(gv.pr.ey), r: 7, fill: P.bad, stroke: "#fff", "stroke-width": 2, class: "dz-pulse" })); T(s, X(gv.pr.ex) + 12, Y(gv.pr.ey) - 10, `e = (${nf(gv.pr.ex, 2)}; ${nf(gv.pr.ey, 2)}) m`, { c: P.bad, fs: 12, b: true }) }
  // legenda
  const lx = W - 90, ly0 = 70, lh = 300
  for (let i = 0; i < 30; i++) s.append(sv("rect", { x: lx, y: ly0 + lh * i / 30, width: 22, height: lh / 30 + 0.5, fill: col(1 - i / 29) }))
  T(s, lx + 28, ly0 + 6, ndu("Q", qm, 0), { c: P.ink, fs: 11 }); T(s, lx + 28, ly0 + lh, "0", { c: P.ink, fs: 11 })
  T(s, lx - 4, ly0 - 12, "q", { c: P.ink, fs: 13, b: true })
  if (gv) T(s, 20, H - 16, `${gv.c.id} · ${L("kontak", "contact")} ${nf(gv.pr.contact * 100, 0)}% · q ${L("maks", "max")} ${ndu("Q", gv.pr.qmax, 1)} / qa ${ndu("Q", gv.qa, 0)}`, { c: P.mut, fs: 12 })
  return s
}

// ---------------------------------------------------------------- peralatan dinamis
export function dynDraw(I, out, P) {
  const W = 960, H = 540, s = root(W, H, P, L("Pondasi blok mesin", "Machine block foundation"))
  const k = Math.min(520 / (I.Bx + 1.5), 300 / (I.H + I.hs + 1.4)), cx = 300, gy = 300
  const X = (x) => cx + x * k, Y = (z) => gy - z * k
  T(s, 30, 34, `${out.pre || L("Mesin", "Machine")} · ${nf(I.rpm, 0)} rpm · ${nf(out.Dy.fop, 2)} Hz`, { c: P.ink, fs: 15, b: true })
  const top = I.H - I.emb
  R(s, 20, Y(top - I.emb) - 0, 560, H - 40 - Y(top - I.emb), P.sand, null, { op: 0 })
  R(s, 20, Y(0), 560, H - 30 - Y(0) + 0, P.sand, null, { op: 0.4 })
  s.append(sv("line", { x1: 20, y1: Y(0), x2: 580, y2: Y(0), stroke: P.ink, "stroke-width": 2 }))
  const bTop = Y(top), bBot = Y(top - I.H)
  R(s, X(-I.Bx / 2), bTop, I.Bx * k, I.H * k, P.conc, P.concD); R(s, X(-I.Bx / 2), bTop, I.Bx * k, I.H * k, s.hatch, null)
  // pegas & peredam
  for (let i = 0; i < 4; i++) {
    const x = X(-I.Bx / 2 + I.Bx * (i + 0.5) / 4), y0 = bBot, y1 = bBot + 52
    let d = `M${x},${y0}`; for (let q = 1; q <= 6; q++) d += ` L${x + (q % 2 ? 7 : -7)},${y0 + q * 7}`; d += ` L${x},${y1}`
    path(s, d, { stroke: P.mut, "stroke-width": 2, class: "dz-spring", style: `--i:${i}` })
    s.append(sv("line", { x1: x - 12, y1: y1, x2: x + 12, y2: y1, stroke: P.mut, "stroke-width": 2 }))
  }
  // mesin
  const g = sv("g", { class: "dz-vib" })
  const mL = I.Lb, mz = top
  g.append(sv("rect", { x: X(-mL / 2), y: Y(mz + 0.12), width: mL * k, height: 0.12 * k, fill: P.machine2 }))
  g.append(sv("rect", { x: X(-mL / 2 + 0.05), y: Y(mz + I.hs + 0.35), width: mL * 0.42 * k, height: (I.hs + 0.23) * k, fill: P.machine, rx: 8 }))
  g.append(sv("rect", { x: X(mL / 2 - mL * 0.45), y: Y(mz + I.hs + 0.42), width: mL * 0.42 * k, height: (I.hs + 0.3) * k, fill: P.machine2, rx: 10 }))
  g.append(sv("line", { x1: X(-mL / 2 + 0.05), y1: Y(mz + I.hs), x2: X(mL / 2), y2: Y(mz + I.hs), stroke: P.acc, "stroke-width": 3, "stroke-dasharray": "10 5" }))
  const rot = sv("g", { class: "dz-spin", style: `transform-origin:${X(0)}px ${Y(mz + I.hs)}px` })
  rot.append(sv("circle", { cx: X(0), cy: Y(mz + I.hs), r: 16, fill: P.acc, stroke: P.ink, "stroke-width": 2 }))
  rot.append(sv("line", { x1: X(0) - 16, y1: Y(mz + I.hs), x2: X(0) + 16, y2: Y(mz + I.hs), stroke: P.ink, "stroke-width": 3 }))
  rot.append(sv("circle", { cx: X(0) + 10, cy: Y(mz + I.hs) - 6, r: 3.5, fill: P.bad }))
  g.append(rot)
  s.append(g)
  T(s, X(0), Y(mz + I.hs) - 26 - 0.35 * k, `Fo = ${ndu("F", out.Dy.Fo, 2)}`, { c: P.acc, fs: 13, b: true, a: "middle" })
  dim(s, X(-I.Bx / 2), bBot + 74, X(I.Bx / 2), bBot + 74, `${nf(I.Bx, 2)} m`, P)
  dim(s, X(I.Bx / 2) + 18, bTop, X(I.Bx / 2) + 18, bBot, `H = ${nf(I.H, 2)} m`, P, 0, true)
  // grafik frekuensi
  const fx0 = 610, fx1 = W - 30, fy0 = 80, fy1 = 470
  R(s, fx0 - 10, fy0 - 30, fx1 - fx0 + 20, fy1 - fy0 + 60, P.fill, P.line, { rx: 12 })
  T(s, fx0, fy0 - 8, L("Frekuensi alami vs operasi", "Natural vs operating frequency"), { c: P.ink, fs: 13, b: true })
  const fmax = Math.max(...out.Dy.modes.map((m) => m.f), out.Dy.fop * Math.max(...out.Dy.harm) * 1.3) * 1.1
  const FX = (f) => fx0 + (fx1 - fx0) * f / fmax
  const sep = I.sep / 100
  out.Dy.harm.forEach((h) => {
    const f = h * out.Dy.fop
    R(s, FX(f * (1 - sep)), fy0 + 10, FX(f * (1 + sep)) - FX(f * (1 - sep)), fy1 - fy0 - 20, P.bad, null, { op: 0.12 })
    s.append(sv("line", { x1: FX(f), y1: fy0 + 10, x2: FX(f), y2: fy1 - 10, stroke: P.bad, "stroke-width": 2, "stroke-dasharray": "5 4" }))
    T(s, FX(f), fy1 + 4, `${h}× ${nf(f, 1)} Hz`, { c: P.bad, fs: 11, a: "middle", b: true })
  })
  out.Dy.modes.forEach((md, i) => {
    const y = fy0 + 30 + i * (fy1 - fy0 - 60) / out.Dy.modes.length, bad = out.Dy.harm.some((h) => Math.abs(md.f - h * out.Dy.fop) / (h * out.Dy.fop) < sep)
    const b = R(s, fx0, y + 2, FX(md.f) - fx0, 12, bad ? P.bad : P.ok, null, { rx: 5, cls: "dz-bar-x", op: 0.9 })
    b.style.setProperty("--i", i)
    T(s, fx0, y - 4, `${md.nm} · ${nf(md.f, 1)} Hz`, { c: P.ink, fs: 10.5, b: true })
  })
  T(s, fx0, fy1 + 22, L(`pita merah = ±${I.sep}% di sekitar eksitasi`, `red band = ±${I.sep}% around excitation`), { c: P.mut, fs: 11 })
  return s
}

// ---------------------------------------------------------------- trafo
export function trafoDraw(I, out, P) {
  const k0 = Math.min(760 / (Math.max(I.Lf, I.Lpit) + 1), 360 / (I.Ht + I.hp + I.t + 1.6))
  const W = 960, H = Math.round(Math.min(540, (I.Ht + I.hp + I.t + I.Df) * k0 + 200)), s = root(W, H, P, L("Pondasi trafo", "Transformer foundation"))
  const k = k0, cx = 480, base = H - 60
  const X = (x) => cx + x * k, Y = (z) => base - z * k
  T(s, 30, 34, `${L("Trafo daya", "Power transformer")} ${nf(I.mva, 0)} MVA · ${ndu("F", I.W, 0)} · ${L("oli", "oil")} ${nf(I.Voil / 1000, 1)} m³`, { c: P.ink, fs: 15, b: true })
  R(s, 20, Y(I.Df), W - 40, base - Y(I.Df) + 50, P.sand, null, { op: 0.4 })
  s.append(sv("line", { x1: 20, y1: Y(I.Df), x2: W - 20, y2: Y(I.Df), stroke: P.ink, "stroke-width": 2 }))
  R(s, X(-I.Lf / 2), Y(I.t), I.Lf * k, I.t * k, P.conc, P.concD); R(s, X(-I.Lf / 2), Y(I.t), I.Lf * k, I.t * k, s.hatch, null)
  const curb = 0.2
  for (const sg of [-1, 1]) R(s, X(sg * I.Lpit / 2) - (sg > 0 ? 0 : curb * k), Y(I.t + I.hpit), curb * k, I.hpit * k, P.conc, P.concD)
  const gr = sv("g")
  for (let i = 0; i < 70; i++) gr.append(sv("circle", { cx: X(-I.Lpit / 2 + I.Lpit * ((i * 37) % 70) / 70), cy: Y(I.t + I.hg * ((i * 13) % 10) / 10), r: 3, fill: P.concD, opacity: 0.7 }))
  s.append(gr)
  R(s, X(-I.Lp / 2), Y(I.t + I.hp), I.Lp * k, I.hp * k, P.conc, P.concD); R(s, X(-I.Lp / 2), Y(I.t + I.hp), I.Lp * k, I.hp * k, s.hatch, null)
  const z0 = I.t + I.hp, g = sv("g", { class: "dz-equip" })
  g.append(sv("rect", { x: X(-I.Lt / 2), y: Y(z0 + I.Ht * 0.78), width: I.Lt * k, height: I.Ht * 0.78 * k, fill: P.machine, rx: 6 }))
  for (let i = 0; i < 9; i++) g.append(sv("rect", { x: X(-I.Lt / 2 + 0.15 + i * (I.Lt - 0.3) / 9), y: Y(z0 + I.Ht * 0.7), width: (I.Lt - 0.3) / 9 * k * 0.55, height: I.Ht * 0.5 * k, fill: P.machine2, opacity: 0.6 }))
  g.append(sv("rect", { x: X(-I.Lt * 0.3), y: Y(z0 + I.Ht), width: I.Lt * 0.35 * k, height: I.Ht * 0.12 * k, fill: P.machine2, rx: 12 }))
  for (let i = 0; i < 3; i++) { const bx = X(I.Lt * (0.05 + 0.13 * i)); for (let q = 0; q < 5; q++) g.append(sv("ellipse", { cx: bx, cy: Y(z0 + I.Ht * 0.8 + q * 0.12), rx: 9, ry: 4, fill: P.concL, stroke: P.mut })) }
  s.append(g)
  windArrows(s, X(-I.Lt / 2) - 130, Y(z0 + I.Ht * 0.9), Y(z0 + 0.3), P, 4, 80)
  dim(s, X(-I.Lf / 2), base + 26, X(I.Lf / 2), base + 26, `${nf(I.Lf, 2)} m`, P)
  T(s, X(I.Lpit / 2) + 10, Y(I.t + I.hpit) + 4, `${L("bak oli", "oil pit")} ${nf(I.Lpit, 1)} × ${nf(I.Bpit, 1)} m`, { c: P.mut, fs: 11 })
  T(s, X(I.Lpit / 2) + 10, Y(I.t + I.hpit) + 20, `${L("kerikil", "gravel")} ${nf(I.hg, 2)} m`, { c: P.mut, fs: 11 })
  return s
}

// ---------------------------------------------------------------- diagram interaksi P–M
export function pmChart(curve, pts, P, title) {
  const W = 520, H = 420, s = root(W, H, P, title)
  const x0 = 70, x1 = W - 20, y0 = 50, y1 = H - 50
  const mmax = Math.max(...curve.map((p) => p[0]), ...pts.map((p) => p[0]), 1) * 1.1
  const pmin = Math.min(...curve.map((p) => p[1]), ...pts.map((p) => p[1]), 0) * 1.1, pmax = Math.max(...curve.map((p) => p[1]), ...pts.map((p) => p[1])) * 1.1
  const X = (m) => x0 + (x1 - x0) * m / mmax, Y = (p) => y1 - (y1 - y0) * (p - pmin) / (pmax - pmin)
  T(s, 20, 28, title, { c: P.ink, fs: 14, b: true })
  s.append(sv("line", { x1: x0, y1: Y(0), x2: x1, y2: Y(0), stroke: P.line, "stroke-width": 1.2 }))
  s.append(sv("line", { x1: x0, y1: y0, x2: x0, y2: y1, stroke: P.line, "stroke-width": 1.2 }))
  for (let i = 0; i <= 4; i++) { T(s, x0 + (x1 - x0) * i / 4, y1 + 18, nf(toDisp("M", mmax * i / 4), 0), { c: P.mut, fs: 10.5, a: "middle" }); const pv = pmin + (pmax - pmin) * i / 4; T(s, x0 - 6, Y(pv) + 4, nf(toDisp("F", pv), 0), { c: P.mut, fs: 10.5, a: "end" }) }
  T(s, (x0 + x1) / 2, H - 8, `φMn (${uName("M")})`, { c: P.ink, fs: 12, a: "middle", b: true })
  T(s, 14, y0 - 10, `φPn (${uName("F")})`, { c: P.ink, fs: 12, b: true })
  const d = curve.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")
  path(s, d + " Z", { fill: P.ok, opacity: 0.1, stroke: "none", class: "dz-fade" })
  path(s, d, { stroke: P.ok, "stroke-width": 3, class: "dz-draw", pathLength: 1 })
  pts.forEach((p, i) => { const c = sv("circle", { cx: X(p[0]), cy: Y(p[1]), r: 5, fill: p[2] ? P.ok : P.bad, stroke: "#fff", "stroke-width": 1.5, class: "dz-pop", style: `--i:${i}` }); s.append(c) })
  return s
}
