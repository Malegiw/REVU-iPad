// Sketsa parameter (tidak berskala) untuk formulir modul Desain: menunjukkan arti setiap simbol masukan (D, H, hp, t, Df, BCD, …) dengan nilai saat ini.
import { L, nf, uName, toDisp } from "./core.js"
import { sv } from "./ui.js"
import { palette, root, T, R, path } from "./draw.js"

const W = 620
// garis ukur dengan panah di kedua ujung; label = simbol (+ nilai) berwarna aksen
function dl(s, x1, y1, x2, y2, label, P, o = {}) {
  const vert = Math.abs(x2 - x1) < 1e-6, g = sv("g")
  g.append(sv("line", { x1, y1, x2, y2, stroke: P.mut, "stroke-width": 1.3 }))
  const ah = (x, y, a) => g.append(sv("polygon", { points: [[x, y], [x - 8 * Math.cos(a - 0.35), y - 8 * Math.sin(a - 0.35)], [x - 8 * Math.cos(a + 0.35), y - 8 * Math.sin(a + 0.35)]].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), fill: P.mut }))
  const a = Math.atan2(y2 - y1, x2 - x1)
  ah(x2, y2, a); ah(x1, y1, a + Math.PI)
  if (o.ext) for (const [x, y] of [[x1, y1], [x2, y2]]) g.append(sv("line", vert ? { x1: x - 6, y1: y, x2: x + 6, y2: y, stroke: P.mut, "stroke-width": 1 } : { x1: x, y1: y - 6, x2: x, y2: y + 6, stroke: P.mut, "stroke-width": 1 }))
  s.append(g)
  if (vert) T(s, x1 + (o.left ? -8 : 8), (y1 + y2) / 2 + 5, label, { c: P.acc, fs: 11.5, b: true, a: o.left ? "end" : "start" })
  else T(s, (x1 + x2) / 2, y1 + (o.below ? 17 : -7), label, { c: P.acc, fs: 11.5, b: true, a: "middle" })
}
const lead = (s, x, y, x2, y2, label, P, a = "start") => { s.append(sv("line", { x1: x, y1: y, x2, y2, stroke: P.mut, "stroke-width": 1 })); s.append(sv("circle", { cx: x, cy: y, r: 2.6, fill: P.mut })); T(s, x2 + (a === "end" ? -4 : 4), y2 + 4, label, { c: P.acc, fs: 11.5, b: true, a }) }
const base = (H, P, title) => { const s = root(W, H, P, title); T(s, 14, 22, title, { c: P.ink, fs: 12.5, b: true }); T(s, W - 14, 22, L("sketsa tidak berskala", "not to scale"), { c: P.mut, fs: 10, a: "end" }); return s }
const ground = (s, y, P, x0 = 14, x1 = W - 14) => { s.append(sv("line", { x1: x0, y1: y, x2: x1, y2: y, stroke: P.ink, "stroke-width": 2 })); for (let x = x0 + 4; x < x1; x += 16) s.append(sv("line", { x1: x, y1: y, x2: x - 8, y2: y + 8, stroke: P.mut, "stroke-width": 1 })) }
const conc = (s, x, y, w, h, P) => { R(s, x, y, w, h, P.conc, P.concD); R(s, x, y, w, h, s.hatch, null) }
const m2 = (v) => `${nf(v, 2)} m`, mm = (v) => `${nf(v, 0)} mm`

// ---------------------------------------------------------------- tiang
export function skPileSection(st) {
  const P = palette("screen"), s = base(300, P, L("Penampang tiang", "Pile section"))
  if (st.type !== "helical") {
    const cx = 150, cy = 160, Ro = 92, Ri = 92 - Math.max(8, 92 * 2 * st.t / st.D)
    s.append(sv("circle", { cx, cy, r: Ro, fill: P.steel })); s.append(sv("circle", { cx, cy, r: Ri, fill: st.open ? P.sand : P.fill }))
    if (st.open) T(s, cx, cy + 4, L("plug tanah", "soil plug"), { c: P.ink, fs: 10.5, a: "middle" })
    dl(s, cx - Ro, cy - Ro - 14, cx + Ro, cy - Ro - 14, `D = ${mm(st.D)}`, P, { ext: true })
    lead(s, cx + Ro - (Ro - Ri) / 2, cy + 30, 280, cy + 60, `t = ${nf(st.t, 1)} mm (−ca ${nf(st.ca, 1)})`, P)
    dl(s, cx - Ri, cy + Ro + 18, cx + Ri, cy + Ro + 18, `Di = D − 2t`, P, { below: true })
    const ex = 380
    T(s, ex, 70, L("Tampak samping ujung tiang", "Pile tip elevation"), { c: P.ink, fs: 11, b: true })
    R(s, ex + 40, 86, 44, 170, P.steel, null); R(s, ex + 48, 86, 28, 170, st.open ? P.sand : P.fill, null)
    if (!st.open) R(s, ex + 40, 248, 44, 10, P.steel, null)
    T(s, ex + 96, 250, st.open ? L("ujung terbuka", "open end") : L("ujung tertutup", "closed end"), { c: P.acc, fs: 11.5, b: true })
    T(s, ex, 286, `${L("Mutu", "Grade")}: Fy = ${nf(st.Fy, 0)} MPa`, { c: P.mut, fs: 11 })
  } else {
    const x = 260, top = 50, k = 200 / Math.max(st.zTip, 1)
    R(s, x - 8, top, 16, st.zTip * k + 10, P.steel, null)
    let z = st.zTip
    st.helices.forEach((Dh, i) => {
      const y = top + z * k, rw = Math.max(26, Dh / 6)
      s.append(sv("ellipse", { cx: x, cy: y, rx: rw, ry: 7, fill: "none", stroke: P.steel, "stroke-width": 4, transform: `rotate(-8 ${x} ${y})` }))
      lead(s, x + rw, y, x + rw + 40, y - 6, `Dh${i + 1} = ${mm(Dh)}`, P)
      const zn = z - st.ratio * Dh / 1000
      if (i < st.helices.length - 1) dl(s, x - 70, y, x - 70, top + zn * k, `s = ${nf(st.ratio, 1)}·Dh${i + 1}`, P, { left: true })
      z = zn
    })
    dl(s, x - 130, top, x - 130, top + st.zTip * k, `zTip = ${m2(st.zTip)}`, P, { left: true, ext: true })
    lead(s, x + 8, top + 30, 330, top + 20, `ds = ${mm(st.ds)}, t = ${nf(st.ts, 1)} mm`, P)
    T(s, 420, 250, `Kt = ${nf(st.Kt, 0)} 1/m · T = ${nf(toDisp("M", st.T), 1)} ${uName("M")}`, { c: P.mut, fs: 11 })
    T(s, 420, 270, L("Qu (torsi) = Kt · T", "Qu (torque) = Kt · T"), { c: P.mut, fs: 11 })
  }
  return s
}
export function skPileSoil(st) {
  const P = palette("screen"), s = base(330, P, L("Panjang tiang & lapisan tanah (dari kepala tiang)", "Pile length & soil layers (from pile head)"))
  const labels = [], gy = 80, Lp = st.type === "helical" ? st.zTip : st.L, tot = Math.max(Lp + 1, st.layers.reduce((a, l) => a + l.h, 0)), k = 210 / tot
  let z = 0
  st.layers.forEach((ly, i) => {
    const y0 = gy + z * k, h = Math.min(ly.h, tot - z) * k
    R(s, 14, y0, 400, h, ly.type === "clay" ? P.clay : P.sand, null, { op: 0.55 })
    const lbl = `h${i + 1} = ${m2(ly.h)} · ${ly.type === "clay" ? L("lempung cu", "clay cu") + " " + nf(toDisp("Q", ly.cu), 0) + " " + uName("Q") : L("pasir φ", "sand φ") + " " + nf(ly.phi, 0) + "°"}`
    labels.push([y0 + Math.min(h, 40) / 2 + 5, lbl])
    z += ly.h
  })
  ground(s, gy, P, 14, 414)
  conc(s, 160, gy - 30 - (st.e > 0 ? 24 : 0), 120, 30, P)
  R(s, 212, gy - (st.e > 0 ? 24 : 0), 16, Lp * k + (st.e > 0 ? 24 : 0), P.steel, null)
  if (st.e > 0) dl(s, 250, gy - 24, 250, gy, `e = ${m2(st.e)}`, P)
  dl(s, 440, gy, 440, gy + Lp * k, `L = ${m2(Lp)}`, P, { ext: true })
  if (st.gwt < tot) { const yw = gy + st.gwt * k; s.append(sv("line", { x1: 14, y1: yw, x2: 414, y2: yw, stroke: P.water, "stroke-width": 2, "stroke-dasharray": "7 5" })); T(s, 418, yw + 4, `zw = ${m2(st.gwt)}`, { c: P.water, fs: 11.5, b: true }) }
  for (const [y, txt] of labels) { R(s, 20, y - 13, txt.length * 6.4 + 10, 18, P.fill, null, { op: 0.85, rx: 5 }); T(s, 25, y, txt, { c: P.ink, fs: 10.5 }) }
  T(s, 300, gy - 10, L("kepala tiang = dasar pile cap (z = 0)", "pile head = cap soffit (z = 0)"), { c: P.mut, fs: 10.5 })
  return s
}
export function skPileGroup(st) {
  const P = palette("screen"), s = base(380, P, L("Denah kelompok tiang & pile cap", "Pile group & cap plan"))
  const nx = Math.max(1, Math.round(st.nx)), ny = Math.max(1, Math.round(st.ny))
  const Bc = (nx - 1) * st.sx + 2 * st.ce, Lc = (ny - 1) * st.sy + 2 * st.ce, k = Math.min(280 / Bc, 220 / Lc), cx = 200, cy = 175
  const X = (x) => cx + x * k, Y = (y) => cy - y * k
  R(s, X(-Bc / 2), Y(Lc / 2), Bc * k, Lc * k, P.concL, P.concD, { rx: 3 })
  R(s, X(-st.cx / 2), Y(st.cy / 2), st.cx * k, st.cy * k, P.conc, P.concD)
  const D = (st.type === "helical" ? st.ds : st.D) / 1000
  const px = (i) => (i - (nx - 1) / 2) * st.sx, py = (j) => (j - (ny - 1) / 2) * st.sy
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) s.append(sv("circle", { cx: X(px(i)), cy: Y(py(j)), r: Math.max(D * k / 2, 7), fill: P.steel }))
  if (nx > 1) dl(s, X(px(0)), Y(Lc / 2) - 16, X(px(1)), Y(Lc / 2) - 16, `sx = ${m2(st.sx)}`, P)
  if (ny > 1) dl(s, X(Bc / 2) + 16, Y(py(ny - 1)), X(Bc / 2) + 16, Y(py(ny - 2)), `sy = ${m2(st.sy)}`, P)
  dl(s, X(-Bc / 2), Y(-Lc / 2) + 18, X(px(0)), Y(-Lc / 2) + 18, `ce`, P, { below: true })
  dl(s, X(-Bc / 2), Y(-Lc / 2) + 40, X(Bc / 2), Y(-Lc / 2) + 40, `Bc = ${m2(Bc)}`, P, { below: true, ext: true })
  T(s, X(0), Y(0) + 4, `cx × cy`, { c: P.ink, fs: 10.5, a: "middle", b: true })
  const ex = 430
  T(s, ex, 70, L("Potongan", "Section"), { c: P.ink, fs: 11, b: true })
  R(s, ex, 130, 100, (st.hs > 0 ? 26 : 0), P.sand, null, { op: 0.6 })
  conc(s, ex, 156, 100, 46, P)
  ground(s, 130, P, ex - 10, ex + 110)
  R(s, ex + 16, 202, 12, 60, P.steel, null); R(s, ex + 72, 202, 12, 60, P.steel, null)
  dl(s, ex + 112, 156, ex + 112, 202, `hc = ${m2(st.hc)}`, P)
  if (st.hs > 0) dl(s, ex + 112, 130, ex + 112, 156, `hs`, P)
  return s
}
export function skPileConn(st) {
  const P = palette("screen"), s = base(330, P, L("Kepala tiang & sambungan ke pile cap", "Pile head & cap connection"))
  const fixed = st.conn === "fixed", x = 200, capTop = 60, capH = 120, emb = 30, D = 90, t = 7, Lp = 130
  conc(s, 60, capTop, 280, capH, P)
  T(s, 70, capTop + 18, "Pile cap", { c: P.ink, fs: 11, b: true })
  const ptop = capTop + capH - emb
  R(s, x - D / 2, ptop, D, 320 - ptop, P.steel, null)
  R(s, x - D / 2 + t, ptop, D - 2 * t, Lp + emb, P.concL, null); R(s, x - D / 2 + t, ptop, D - 2 * t, Lp + emb, s.hatch, null)
  s.append(sv("line", { x1: x - D / 2 + t, y1: ptop + Lp + emb, x2: x + D / 2 - t, y2: ptop + Lp + emb, stroke: P.ink, "stroke-width": 3 }))
  for (const dx of [-24, -8, 8, 24]) path(s, `M${x + dx},${ptop + Lp + emb - 10} V${capTop + 22}` + (st.hook ? ` h${dx < 0 ? -22 : 22}` : ""), { stroke: P.reb, "stroke-width": 3, "stroke-linecap": "round" })
  s.append(sv("line", { x1: 40, y1: capTop + capH, x2: 360, y2: capTop + capH, stroke: P.ink, "stroke-width": 1, "stroke-dasharray": "4 4" }))
  dl(s, x + D / 2 + 20, ptop, x + D / 2 + 20, capTop + capH, `emb = ${mm(st.emb)}`, P)
  dl(s, x - D / 2 - 18, ptop, x - D / 2 - 18, ptop + Lp + emb, `Lp = ${mm(st.Lp)}`, P, { left: true })
  lead(s, x + 24, capTop + 70, 390, 90, `${st.nd} D${st.dbd} ${st.hook ? L("berkait", "hooked") : L("lurus", "straight")}`, P)
  lead(s, x, ptop + 70, 390, 150, L(`beton isi fc' ${nf(st.fcp, 0)} MPa`, `infill fc' ${nf(st.fcp, 0)} MPa`), P)
  lead(s, x + D / 2 - 3, 290, 390, 270, L("pipa baja (tiang)", "steel pipe (pile)"), P)
  T(s, 390, 206, fixed ? L("JEPIT (fixed)", "FIXED") : L("SENDI (pinned)", "PINNED"), { c: fixed ? P.bad : P.ok, fs: 12.5, b: true })
  T(s, 390, 224, fixed ? L("momen kepala → beton isi bertulang", "head moment → reinforced infill") : L("hanya aksial & geser", "axial & shear only"), { c: P.mut, fs: 10.5 })
  return s
}

// ---------------------------------------------------------------- tangki
export function skTank(st) {
  const P = palette("screen"), s = base(330, P, L("Tangki: simbol dimensi", "Tank: dimension symbols"))
  const x0 = 150, w = 240, gy = 290, hs = 190, z0 = 14, hr = Math.min(40, w / 2 * Math.tan(st.slope * Math.PI / 180) * 2)
  ground(s, gy, P, 14, 520)
  conc(s, x0 - 20, gy - z0, w + 40, z0, P)
  const yb = gy - z0
  R(s, x0, yb - hs, w, hs, P.fill, P.steel, { sw: 3 })
  const hL = hs * Math.min(st.H / st.Hs, 1), hT = hs * Math.min(st.Ht / st.Hs, 1)
  R(s, x0 + 3, yb - hL, w - 6, hL - 2, P.liq, null, { op: 0.6 })
  s.append(sv("line", { x1: x0, y1: yb - hT, x2: x0 + w, y2: yb - hT, stroke: P.water, "stroke-width": 2, "stroke-dasharray": "6 4" }))
  s.append(sv("polygon", { points: `${x0 - 4},${yb - hs} ${x0 + w / 2},${yb - hs - hr} ${x0 + w + 4},${yb - hs}`, fill: P.concL, stroke: P.steel, "stroke-width": 3 }))
  if (st.roof === "col") s.append(sv("line", { x1: x0 + w / 2, y1: yb, x2: x0 + w / 2, y2: yb - hs - hr, stroke: P.steel, "stroke-width": 3 }))
  dl(s, x0, yb - hs - hr - 16, x0 + w, yb - hs - hr - 16, `D = ${m2(st.D)}`, P, { ext: true })
  dl(s, x0 - 30, yb, x0 - 30, yb - hs, `Hs = ${m2(st.Hs)}`, P, { left: true, ext: true })
  dl(s, x0 + w + 24, yb, x0 + w + 24, yb - hL, `H = ${m2(st.H)}`, P)
  T(s, x0 + w + 24, yb - hT - 4, `Ht = ${m2(st.Ht)} (${L("uji", "test")})`, { c: P.water, fs: 11, b: true })
  lead(s, x0 + w * 0.78, yb - hs - hr * 0.44, x0 + w + 40, yb - hs - hr - 4, `θ = ${nf(st.slope, 1)}°`, P)
  dl(s, x0 + w + 110, gy, x0 + w + 110, yb, `z0`, P)
  T(s, x0 + w / 2, yb - hL / 2, `SG = ${nf(st.SG, 2)}`, { c: "#fff", fs: 12, b: true, a: "middle" })
  if (st.roof === "col") lead(s, x0 + w / 2, yb - 40, x0 + w + 40, yb - 50, `${L("kolom", "column")} ×${st.nCol}`, P)
  return s
}
export function skTankFound(st) {
  const P = palette("screen"), ring = st.found === "auto" ? st.D > st.dLim : st.found === "ring"
  const s = base(300, P, ring ? L("Ringwall: potongan", "Ringwall: section") : L("Pelat penuh: potongan", "Full slab: section"))
  const gy = 160
  ground(s, gy, P, 14, 600)
  if (ring) {
    const x = 220, b = 70, h = 110
    R(s, x + b, gy - 40, 300, 40 + (st.hpad > 0 ? 0 : 0), P.sand, P.concD, { op: 0.9 })
    T(s, x + b + 150, gy - 16, L("urugan/pad terpadatkan", "compacted pad"), { c: P.ink, fs: 10.5, a: "middle" })
    conc(s, x, gy - 40, b, h, P)
    if (st.rbf > st.rb) conc(s, x - 40, gy - 40 + h, b + 80, 34, P)
    s.append(sv("line", { x1: x + b / 2, y1: gy - 40, x2: x + b / 2, y2: 40, stroke: P.steel, "stroke-width": 5 }))
    T(s, x + b / 2 + 8, 52, L("shell tangki (di tengah ringwall)", "tank shell (centred on ringwall)"), { c: P.mut, fs: 10.5 })
    dl(s, x, gy - 52, x + b, gy - 52, `b = ${m2(st.rb)}`, P)
    dl(s, x - 20, gy - 40, x - 20, gy - 40 + h, `h = ${m2(st.rh)}`, P, { left: true })
    if (st.rbf > st.rb) { dl(s, x - 40, gy - 40 + h + 50, x + b + 40, gy - 40 + h + 50, `bf = ${m2(st.rbf)}`, P, { below: true }); dl(s, x + b + 56, gy - 40 + h, x + b + 56, gy - 40 + h + 34, `tf`, P) }
    dl(s, x + b + 320, gy - 40, x + b + 320, gy, `hpad = ${m2(st.hpad)}`, P, { left: true })
    T(s, 345, 225, L("Tarik hoop: T = K·(γ·h²/2 + p·h)·D/2", "Hoop tension: T = K·(γ·h²/2 + p·h)·D/2"), { c: P.mut, fs: 11 })
  } else {
    const x = 60, w = 460, h = 46
    conc(s, x, gy - 10, w, h, P)
    s.append(sv("line", { x1: x + 60, y1: gy - 10, x2: x + 60, y2: 40, stroke: P.steel, "stroke-width": 5 })); s.append(sv("line", { x1: x + w - 60, y1: gy - 10, x2: x + w - 60, y2: 40, stroke: P.steel, "stroke-width": 5 }))
    R(s, x + 63, 70, w - 126, gy - 80, P.liq, null, { op: 0.35 })
    dl(s, x + 60, 30, x + w - 60, 30, `D = ${m2(st.D)}`, P, { ext: true })
    dl(s, x, gy + 56, x + 60, gy + 56, `a = ${m2(st.proj)}`, P, { below: true })
    dl(s, x, gy + 92, x + w, gy + 92, `Ds = D + 2a`, P, { below: true, ext: true })
    dl(s, x + w + 18, gy - 10, x + w + 18, gy + h - 10, `h = ${m2(st.sh)}`, P)
  }
  return s
}

// ---------------------------------------------------------------- vessel
export function skVessel(st) {
  const P = palette("screen")
  if (st.kind === "h") {
    const s = base(320, P, L("Separator horizontal: simbol dimensi", "Horizontal separator: dimension symbols"))
    const gy = 250, cx = 300, Lt = 300, D = 80, zc = gy - 40 - 50
    ground(s, gy, P, 14, 606)
    for (const dx of [-90, 90]) { conc(s, cx + dx - 22, gy - 40, 44, 40, P); s.append(sv("polygon", { points: `${cx + dx - 20},${gy - 40} ${cx + dx + 20},${gy - 40} ${cx + dx + 14},${zc} ${cx + dx - 14},${zc}`, fill: P.concL, stroke: P.steel, "stroke-width": 2 })) }
    conc(s, cx - 150, gy, 300, 22, P)
    path(s, `M${cx - Lt / 2},${zc - D / 2} H${cx + Lt / 2} A20,${D / 2} 0 0 1 ${cx + Lt / 2},${zc + D / 2} H${cx - Lt / 2} A20,${D / 2} 0 0 1 ${cx - Lt / 2},${zc - D / 2} Z`, { fill: P.fill, stroke: P.steel, "stroke-width": 3 })
    s.append(sv("line", { x1: cx - Lt / 2 - 20, y1: zc, x2: cx + Lt / 2 + 20, y2: zc, stroke: P.line, "stroke-dasharray": "8 5" }))
    dl(s, cx - Lt / 2, zc - D / 2 - 16, cx + Lt / 2, zc - D / 2 - 16, `L T/T = ${m2(st.Ltt)}`, P, { ext: true })
    dl(s, cx + Lt / 2 + 40, zc - D / 2, cx + Lt / 2 + 40, zc + D / 2, `D = ${m2(st.D)}`, P)
    dl(s, cx - 90, gy + 40, cx + 90, gy + 40, `Ls = ${m2(st.Ls)}`, P, { below: true, ext: true })
    dl(s, cx - 150 - 16, gy - 40, cx - 150 - 16, zc, `hc = ${m2(st.hc)}`, P, { left: true })
    dl(s, cx + 128, gy - 40, cx + 128, gy, `hp`, P)
    T(s, cx - 90, gy - 46, L("tetap", "fixed"), { c: P.mut, fs: 10.5, a: "middle" }); T(s, cx + 90, gy - 46, L("geser", "sliding"), { c: P.mut, fs: 10.5, a: "middle" })
    return s
  }
  const s = base(340, P, L("Vessel vertikal: simbol dimensi", "Vertical vessel: dimension symbols"))
  const gy = 300, cx = 220, D = 64, H = 190, z0 = gy - 30
  ground(s, gy, P, 14, 606)
  conc(s, cx - 50, z0, 100, 30, P)
  path(s, `M${cx - D / 2},${z0} V${z0 - H + 16} A${D / 2},16 0 0 1 ${cx + D / 2},${z0 - H + 16} V${z0} Z`, { fill: P.fill, stroke: P.steel, "stroke-width": 3 })
  R(s, cx - D / 2 - 14, z0 - H + 8, D + 28, H - 8, "none", P.wind, { sw: 1.5 }).setAttribute("stroke-dasharray", "6 4")
  dl(s, cx - D / 2, z0 - H - 14, cx + D / 2, z0 - H - 14, `D = ${m2(st.D)}`, P, { ext: true })
  T(s, cx + D / 2 + 20, z0 - H + 26, `D + ΔD = ${m2(st.D + st.Dadd)} (${L("lebar angin", "wind width")})`, { c: P.wind, fs: 11, b: true })
  dl(s, cx - 90, z0, cx - 90, z0 - H, `H = ${m2(st.H)}`, P, { left: true, ext: true })
  const ycg = z0 - H * Math.min(st.hcg / st.H, 1)
  s.append(sv("circle", { cx, cy: ycg, r: 7, fill: P.bad })); s.append(sv("line", { x1: cx - 7, y1: ycg, x2: cx + 7, y2: ycg, stroke: "#fff", "stroke-width": 2 }))
  dl(s, cx + 70, z0, cx + 70, ycg, `hcg = ${m2(st.hcg)}`, P)
  T(s, 380, 120, `We, Wo, Wt → ${L("di pusat vessel", "at vessel centre")}`, { c: P.mut, fs: 11 })
  T(s, 380, 140, `Tp, Tm → ${L("beban pipa di base plate", "pipe loads at base plate")}`, { c: P.mut, fs: 11 })
  return s
}
export function skVesselFound(st) {
  const P = palette("screen"), s = base(330, P, L("Pedestal, telapak & baut angkur", "Pedestal, footing & anchor bolts"))
  const gy = 120, cx = 225, vert = st.kind !== "h"
  const pw = vert ? 100 : 56, fw = 230, hp = 60, t = 46, df = 80
  ground(s, gy, P, 14, 340)
  conc(s, cx - pw / 2, gy - (hp - df + t) , pw, hp, P)
  conc(s, cx - fw / 2, gy - (hp - df + t) + hp, fw, t, P)
  const yTop = gy - (hp - df + t), yFt = yTop + hp, yBot = yFt + t
  dl(s, cx - pw / 2, yTop - 14, cx + pw / 2, yTop - 14, vert ? `Dp = ${m2(st.Dp)}` : `bx = ${m2(st.bx)}`, P)
  dl(s, cx + pw / 2 + 14, yTop, cx + pw / 2 + 14, yFt, `hp = ${m2(st.hp)}`, P)
  dl(s, cx - fw / 2, yBot + 18, cx + fw / 2, yBot + 18, vert ? (st.fShape === "oct" ? `B = ${m2(st.B)} (${L("lintas sisi", "across flats")})` : `B = ${m2(st.B)}`) : `B = ${m2(st.B)}`, P, { below: true, ext: true })
  dl(s, cx + fw / 2 + 14, yFt, cx + fw / 2 + 14, yBot, `t = ${m2(st.t)}`, P)
  dl(s, cx - fw / 2 - 14, gy, cx - fw / 2 - 14, yBot, `Df = ${m2(st.Df)}`, P, { left: true })
  for (const dx of [-0.32, 0.32]) s.append(sv("line", { x1: cx + dx * pw, y1: yTop - 6, x2: cx + dx * pw, y2: yTop + Math.min(hp + t - 10, 70), stroke: P.reb, "stroke-width": 3 }))
  T(s, cx, yBot + 52, `hef = ${mm(st.hef)}`, { c: P.acc, fs: 11.5, b: true, a: "middle" })
  // denah baut
  const px = 500, py = 185
  T(s, px - 70, 60, L("Denah baut", "Bolt plan"), { c: P.ink, fs: 11, b: true })
  if (vert) {
    const Rp = 70, oct = (r) => Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(px + r * Math.cos(a)).toFixed(1)},${(py + r * Math.sin(a)).toFixed(1)}` }).join(" ")
    if (st.pedShape === "oct") s.append(sv("polygon", { points: oct(Rp / Math.cos(Math.PI / 8)), fill: P.concL, stroke: P.concD, "stroke-width": 1.5 }))
    else if (st.pedShape === "circle") s.append(sv("circle", { cx: px, cy: py, r: Rp, fill: P.concL, stroke: P.concD }))
    else R(s, px - Rp, py - Rp, 2 * Rp, 2 * Rp, P.concL, P.concD)
    const rb = Rp * Math.min(st.BCD / st.Dp, 0.92)
    s.append(sv("circle", { cx: px, cy: py, r: rb, fill: "none", stroke: P.mut, "stroke-dasharray": "5 4" }))
    const n = Math.max(2, Math.round(st.nb))
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; s.append(sv("circle", { cx: px + rb * Math.cos(a), cy: py + rb * Math.sin(a), r: 4.5, fill: P.reb })) }
    dl(s, px - rb, py + Rp + 16, px + rb, py + Rp + 16, `BCD = ${m2(st.BCD)}`, P, { below: true })
    T(s, px, py + 4, `${n} × M${st.bd}`, { c: P.ink, fs: 11, b: true, a: "middle" })
  } else {
    const bw = 130, bh = 56
    R(s, px - bw / 2, py - bh / 2, bw, bh, P.concL, P.concD)
    const sbp = bh * 0.7
    for (const yy of [-sbp / 2, sbp / 2]) for (const xx of [-0.35, 0.35]) s.append(sv("circle", { cx: px + xx * bw, cy: py + yy, r: 4.5, fill: P.reb }))
    dl(s, px - bw / 2 - 14, py - sbp / 2, px - bw / 2 - 14, py + sbp / 2, `sb = ${m2(st.sb)}`, P, { left: true })
    dl(s, px - bw / 2, py + bh / 2 + 16, px + bw / 2, py + bh / 2 + 16, `by = ${m2(st.by)}`, P, { below: true })
    T(s, px, py - bh / 2 - 10, L("pelat dasar saddle (melintang)", "saddle base plate (transverse)"), { c: P.mut, fs: 10.5, a: "middle" })
  }
  return s
}

// ---------------------------------------------------------------- peralatan dinamis
export function skDyn(st) {
  const P = palette("screen"), s = base(340, P, L("Blok mesin: simbol dimensi", "Machine block: dimension symbols"))
  const gy = 170, x0 = 96, bw = 220, bh = 90, emb = bh * Math.min(st.emb / st.H, 1)
  ground(s, gy, P, 14, 380)
  conc(s, x0, gy - (bh - emb), bw, bh, P)
  const top = gy - (bh - emb)
  const lb = bw * Math.min(st.Lb / st.Bx, 0.95), mx = x0 + bw / 2 - lb / 2
  R(s, mx, top - 10, lb, 10, P.machine2, null); R(s, mx + 6, top - 52, lb * 0.42, 42, P.machine, null, { rx: 6 }); R(s, mx + lb * 0.52, top - 58, lb * 0.45, 48, P.machine2, null, { rx: 8 })
  const ys = top - 30
  s.append(sv("line", { x1: mx, y1: ys, x2: mx + lb, y2: ys, stroke: P.acc, "stroke-width": 2.5, "stroke-dasharray": "8 4" }))
  dl(s, x0, top + bh + 20, x0 + bw, top + bh + 20, `Bx = ${m2(st.Bx)} (${L("sumbu poros", "shaft axis")})`, P, { below: true, ext: true })
  dl(s, x0 - 16, top, x0 - 16, top + bh, `H = ${m2(st.H)}`, P, { left: true })
  dl(s, x0 + bw + 14, gy, x0 + bw + 14, top + bh, `De = ${m2(st.emb)}`, P)
  dl(s, mx, top - 70, mx + lb, top - 70, `Lb = ${m2(st.Lb)}`, P)
  dl(s, x0 + bw + 50, top, x0 + bw + 50, ys, `hs = ${m2(st.hs)}`, P)
  // denah
  const px = 535, py = 170, k = Math.min(130 / st.Bx, 110 / st.By)
  T(s, px - 60, 70, L("Denah", "Plan"), { c: P.ink, fs: 11, b: true })
  R(s, px - st.Bx * k / 2, py - st.By * k / 2, st.Bx * k, st.By * k, P.concL, P.concD)
  R(s, px + st.exm * k - st.Lb * k / 2, py - st.eym * k - st.Bb * k / 2, st.Lb * k, st.Bb * k, P.machine, null, { op: 0.75 })
  T(s, px, py + st.By * k / 2 + 64, `Bx × By = ${nf(st.Bx, 2)} × ${nf(st.By, 2)} m`, { c: P.acc, fs: 11, b: true, a: "middle" })
  dl(s, px + st.exm * k - st.Lb * k / 2, py + st.By * k / 2 + 16, px + st.exm * k + st.Lb * k / 2, py + st.By * k / 2 + 16, `Lb × Bb`, P, { below: true })
  T(s, px, py + st.By * k / 2 + 46, `ex, ey = ${nf(st.exm, 2)}, ${nf(st.eym, 2)} m`, { c: P.acc, fs: 11, b: true, a: "middle" })
  return s
}

// ---------------------------------------------------------------- trafo
export function skTrafo(st) {
  const P = palette("screen"), s = base(390, P, L("Trafo, plinth, telapak & bak oli", "Transformer, plinth, footing & oil pit"))
  const gy = 250, cx = 300, fw = 440, pw = 300, tw = 200
  ground(s, gy, P, 14, 606)
  conc(s, cx - fw / 2, gy + 30, fw, 30, P)
  for (const sg of [-1, 1]) conc(s, cx + sg * (pw / 2 + 50) - (sg > 0 ? 0 : 12), gy - 20, 12, 50, P)
  for (let i = 0; i < 36; i++) s.append(sv("circle", { cx: cx - pw / 2 - 40 + (pw + 80) * ((i * 37) % 36) / 36, cy: gy + 22 - ((i * 13) % 5) * 3, r: 2.5, fill: P.concD }))
  conc(s, cx - pw / 2, gy - 20, pw, 50, P)
  R(s, cx - tw / 2, gy - 140, tw, 120, P.machine, null, { rx: 6 })
  for (let i = 0; i < 7; i++) R(s, cx - tw / 2 + 12 + i * 26, gy - 128, 14, 90, P.machine2, null, { op: 0.6 })
  s.append(sv("circle", { cx, cy: gy - 70, r: 6, fill: P.bad }))
  dl(s, cx - tw / 2, gy - 152, cx + tw / 2, gy - 152, `Lt = ${m2(st.Lt)}`, P, { ext: true })
  dl(s, cx + tw / 2 + 14, gy - 20, cx + tw / 2 + 14, gy - 140, `Ht = ${m2(st.Ht)}`, P)
  dl(s, cx - tw / 2 - 14, gy - 20, cx - tw / 2 - 14, gy - 70, `hcg`, P, { left: true })
  dl(s, cx - pw / 2, gy + 74, cx + pw / 2, gy + 74, `Lp = ${m2(st.Lp)}`, P, { below: true })
  dl(s, cx - fw / 2, gy + 104, cx + fw / 2, gy + 104, `Lf = ${m2(st.Lf)}`, P, { below: true, ext: true })
  dl(s, cx + pw / 2 + 16, gy - 20, cx + pw / 2 + 16, gy + 30, `hp`, P)
  dl(s, cx + fw / 2 + 12, gy + 30, cx + fw / 2 + 12, gy + 60, `t`, P)
  T(s, 24, 48, `${L("bak oli", "oil pit")}: Lpit × Bpit × hpit = ${nf(st.Lpit, 1)} × ${nf(st.Bpit, 1)} × ${nf(st.hpit, 2)} m`, { c: P.acc, fs: 11, b: true })
  T(s, 24, 66, `${L("kerikil", "gravel")} hg = ${nf(st.hg, 2)} m · Bt × Bp × B = ${nf(st.Bt, 1)} × ${nf(st.Bp, 1)} × ${nf(st.B, 1)} m (Y)`, { c: P.acc, fs: 11, b: true })
  return s
}
