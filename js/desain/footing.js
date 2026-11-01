// Mesin pondasi telapak umum (footing + satu/lebih pedestal): tekanan tanah tanpa tarik dengan eksentrisitas dua arah untuk denah persegi panjang,
// oktagon, atau lingkaran (solusi elastis tertutup bila kontak penuh; Newton pada grid bila kontak sebagian), stabilitas (ASD), dan desain beton (LRFD):
// lentur, geser satu arah, geser pons dengan transfer momen, penyaluran, serta pedestal (interaksi P–M serat, geser). SNI 2847:2019 = ACI 318M-14.
// Konvensi: x ke kanan, y ke atas (denah). Mx menambah tekanan ke arah +y, My ke arah +x. Gaya horizontal di puncak pedestal setinggi (t + h) dari dasar.
import { GAMMA_C, L, chk, nf } from "./core.js"
import { asFlex, pickBars, phiMn, rhoTS, vcOne, vcTwo, gammaV, Jc, ld, ldh, pmCapacity, rectPoly, octPoly, circlePoly, polyArea, barsOnCircle, barsRect, sqfc } from "./rc.js"
import { barA } from "./core.js"

// ---------------------------------------------------------------- geometri denah (m)
export function planPoly(shape, a, b) {
  if (shape === "oct") return octPoly(a)
  if (shape === "circle") return circlePoly(a, 48)
  return rectPoly(a, b ?? a)
}
function second(p) {
  let Ixx = 0, Iyy = 0, Ixy = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length], k = x1 * y2 - x2 * y1
    Ixx += k * (y1 * y1 + y1 * y2 + y2 * y2); Iyy += k * (x1 * x1 + x1 * x2 + x2 * x2); Ixy += k * (x1 * y2 + 2 * x1 * y1 + 2 * x2 * y2 + x2 * y1)
  }
  const s = Math.sign(polySigned(p)) || 1
  return { Ixx: s * Ixx / 12, Iyy: s * Iyy / 12, Ixy: s * Ixy / 24 }
}
const polySigned = (p) => p.reduce((a, [x1, y1], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x1 * y2 - x2 * y1 }, 0) / 2
export function inside(p, x, y) {
  let c = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c
  }
  return c
}
// Panjang tali busur poligon pada garis x = x0 (axis "x") atau y = y0 (axis "y")
export function chord(p, axis, v) {
  const hits = []
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], ia = axis === "x" ? 0 : 1, ib = 1 - ia
    if ((a[ia] - v) * (b[ia] - v) <= 0 && a[ia] !== b[ia]) hits.push(a[ib] + (v - a[ia]) / (b[ia] - a[ia]) * (b[ib] - a[ib]))
  }
  return hits.length >= 2 ? Math.max(...hits) - Math.min(...hits) : 0
}
// Jarak dari pusat ke tepi poligon searah (ux, uy)
function rayDist(p, ux, uy) {
  let best = Infinity
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length], ex = x2 - x1, ey = y2 - y1
    const den = ux * ey - uy * ex
    if (Math.abs(den) < 1e-12) continue
    const t = (x1 * ey - y1 * ex) / den, s = (x1 * uy - y1 * ux) / den
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.min(best, t)
  }
  return best
}

export function makeGeo(poly, n = 72) {
  const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const h = Math.max(x1 - x0, y1 - y0) / n, nx = Math.max(2, Math.ceil((x1 - x0) / h)), ny = Math.max(2, Math.ceil((y1 - y0) / h))
  const hx = (x1 - x0) / nx, hy = (y1 - y0) / ny, X = [], Y = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = x0 + (i + 0.5) * hx, y = y0 + (j + 0.5) * hy; if (inside(poly, x, y)) { X.push(x); Y.push(y) } }
  const A = Math.abs(polySigned(poly))
  return { poly, A, ...second(poly), X: Float64Array.from(X), Y: Float64Array.from(Y), dA: A / X.length, bbox: [x0, y0, x1, y1] }
}
function solve3(M, r) {
  const a = M.map((row, i) => [...row, r[i]])
  for (let c = 0; c < 3; c++) {
    let p = c; for (let i = c + 1; i < 3; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i
    ;[a[c], a[p]] = [a[p], a[c]]
    if (Math.abs(a[c][c]) < 1e-300) return null
    for (let i = 0; i < 3; i++) if (i !== c) { const f = a[i][c] / a[c][c]; for (let k = c; k < 4; k++) a[i][k] -= f * a[c][k] }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]]
}
// Tekanan tanah: q(x,y) = q0 + gx·x + gy·y ≥ 0. Hasil {mode, q0, gx, gy, qmax, qmin, contact, ex, ey}
export function pressure(geo, P, Mx, My) {
  if (!(P > 1e-9)) return { mode: "uplift", qmax: Infinity, qmin: 0, contact: 0, ex: 0, ey: 0 }
  const ex = My / P, ey = Mx / P
  if (!inside(geo.poly, ex, ey)) return { mode: "overturn", qmax: Infinity, qmin: 0, contact: 0, ex, ey }
  const el = solve3([[geo.A, 0, 0], [0, geo.Iyy, geo.Ixy], [0, geo.Ixy, geo.Ixx]], [P, My, Mx])
  const vq = (p) => geo.poly.map(([x, y]) => p[0] + p[1] * x + p[2] * y)
  let qv = vq(el)
  if (Math.min(...qv) >= -1e-9 * Math.max(...qv)) return { mode: "full", q0: el[0], gx: el[1], gy: el[2], qmax: Math.max(...qv), qmin: Math.max(0, Math.min(...qv)), contact: 1, ex, ey }
  const { X, Y, dA } = geo, N = X.length
  const Lc = Math.sqrt(geo.A)
  const resid = (p) => {
    let f0 = 0, f1 = 0, f2 = 0, ac = 0
    const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    for (let i = 0; i < N; i++) {
      const q = p[0] + p[1] * X[i] + p[2] * Y[i]
      if (q <= 0) continue
      const x = X[i], y = Y[i]
      f0 += q; f1 += q * x; f2 += q * y; ac++
      J[0][0] += 1; J[0][1] += x; J[0][2] += y; J[1][1] += x * x; J[1][2] += x * y; J[2][2] += y * y
    }
    J[1][0] = J[0][1]; J[2][0] = J[0][2]; J[2][1] = J[1][2]
    for (const r of J) for (let k = 0; k < 3; k++) r[k] *= dA
    const F = [f0 * dA - P, f1 * dA - My, f2 * dA - Mx]
    return { F, J, ac, nrm: Math.abs(F[0]) / P + (Math.abs(F[1]) + Math.abs(F[2])) / (P * Lc) }
  }
  let p = el, r = resid(p)
  for (let it = 0; it < 120 && r.nrm > 1e-10; it++) {
    const d = solve3(r.J, r.F.map((v) => -v))
    if (!d) break
    let t = 1, best = null
    for (let k = 0; k < 30; k++) {
      const pn = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]], rn = resid(pn)
      if (rn.ac > 0 && rn.nrm < r.nrm) { best = [pn, rn]; break }
      t /= 2
    }
    if (!best) break
    ;[p, r] = best
  }
  qv = vq(p)
  return { mode: r.nrm < 1e-4 ? "partial" : "overturn", q0: p[0], gx: p[1], gy: p[2], qmax: Math.max(...qv), qmin: 0, contact: r.ac / N, ex, ey, err: r.nrm }
}
export const qAt = (pr, x, y) => Math.max(0, pr.q0 + pr.gx * x + pr.gy * y)

// ---------------------------------------------------------------- model pondasi
// m: { shape, B, L (rect) | B = lebar lintas sisi (oct) | B = diameter (circle), t, Df, gs (berat isi tanah urug), peds: [{x, y, shape, bx, by, h}] }
export function pedArea(p) { return p.shape === "oct" ? 0.82843 * p.bx * p.bx : p.shape === "circle" ? Math.PI / 4 * p.bx * p.bx : p.bx * p.by }
export const pedSq = (p) => (p.shape === "rect" ? [p.bx, p.by] : [Math.sqrt(pedArea(p)), Math.sqrt(pedArea(p))])   // §13.2.7: penampang setara bujur sangkar
export function weights(m, geo) {
  const footing = geo.A * m.t * (m.gc ?? GAMMA_C)
  const peds = m.peds.map((p) => pedArea(p) * p.h * (m.gc ?? GAMMA_C))
  const cover = Math.max(m.Df - m.t, 0)
  const soil = Math.max(0, geo.A - m.peds.reduce((s, p) => s + pedArea(p), 0)) * cover * (m.gs ?? 18)
  return { footing, peds, soil, cover, total: footing + soil + peds.reduce((a, b) => a + b, 0) }
}
// vec: per pedestal [P, Vx, Vy, Mx, My] di puncak pedestal (larik datar 5n)
export const pedLoad = (vec, i) => ({ P: vec[5 * i], Vx: vec[5 * i + 1], Vy: vec[5 * i + 2], Mx: vec[5 * i + 3], My: vec[5 * i + 4] })
export function resultant(m, W, vec, fD) {
  let P = fD * (W.footing + W.soil), Mx = 0, My = 0, Vx = 0, Vy = 0
  m.peds.forEach((p, i) => {
    const q = pedLoad(vec, i), z = m.t + p.h, pw = fD * W.peds[i]
    P += q.P + pw; Vx += q.Vx; Vy += q.Vy
    My += q.My + (q.P + pw) * p.x + q.Vx * z
    Mx += q.Mx + (q.P + pw) * p.y + q.Vy * z
  })
  return { P, Mx, My, Vx, Vy, H: Math.hypot(Vx, Vy) }
}

// Kontak tanah: beban tetap → tanpa angkat (rasio Δq/q0 = (qmax − qmin)/(qmax + qmin) ≤ 1, setara e/kern); beban sementara → kontak ≥ batas
export function contactChecks(asd, grp, crit) {
  const out = [], minC = crit.minContact ?? 0.5
  const ratio = (r) => (r.pr.mode === "full" ? (r.pr.qmax - r.pr.qmin) / Math.max(r.pr.qmax + r.pr.qmin, 1e-9) : 1 + (1 - r.pr.contact))
  const sus = asd.filter((r) => !r.c.temp), tmp = asd.filter((r) => r.c.temp)
  if (sus.length) {
    const w = sus.reduce((a, b) => (ratio(b) > ratio(a) ? b : a), sus[0])
    out.push(chk(grp, L("Beban tetap: seluruh dasar tertekan (resultan di dalam kern)", "Sustained loads: whole base in compression (resultant within kern)"), "PIP STC01015", ratio(w), 1, "", { note: w.c.id, d: 3 }))
  }
  if (tmp.length) {
    const w = tmp.reduce((a, b) => (b.pr.contact < a.pr.contact ? b : a), tmp[0])
    out.push(chk(grp, L(`Beban sementara: luas kontak ≥ ${Math.round(minC * 100)}%`, `Temporary loads: contact area ≥ ${Math.round(minC * 100)}%`), "PIP STC01015", (1 - w.pr.contact) / Math.max(1 - minC, 1e-9), 1, "", { note: `${w.c.id} · ${Math.round(w.pr.contact * 100)}%`, d: 3 }))
  }
  return out
}

// ---------------------------------------------------------------- analisis lengkap
// soil: { qa, mu, ca, Pp }; crit: { fsOT, fsSL, fsOTs, fsSLs (untuk kombinasi 0,6D), tempFac, minContact }; rc: { fc, fy, cover, db }; pr: { fc, fy, n, db, cover }
export function analyzeFooting(m, combos, soil, crit, rc, prc) {
  const geo = makeGeo(planPoly(m.shape, m.B, m.L), m.grid || 72)
  const W = weights(m, geo)
  const asd = [], lrfd = [], checks = []
  // ---- ASD: tekanan dan stabilitas
  for (const c of combos.filter((k) => k.kind === "ASD")) {
    const R = resultant(m, W, c.vec, c.fD)
    const pr = pressure(geo, R.P, R.Mx, R.My)
    const qa = soil.qa * (c.temp ? (crit.tempFac ?? 1) : 1)
    const e = Math.hypot(pr.ex, pr.ey)
    const fsOT = pr.mode === "uplift" ? 0 : e < 1e-9 ? Infinity : rayDist(geo.poly, pr.ex / e, pr.ey / e) / e
    const resist = Math.max(R.P, 0) * soil.mu + (soil.ca || 0) * geo.A * pr.contact + (soil.Pp || 0)
    const fsSL = R.H > 1e-9 ? resist / R.H : Infinity
    const reqOT = c.stab ? (crit.fsOTs ?? 1.0) : (crit.fsOT ?? 1.5), reqSL = c.stab ? (crit.fsSLs ?? 1.0) : (crit.fsSL ?? 1.5)
    const reqC = c.temp ? (crit.minContact ?? 0.5) : 1.0
    const ok = pr.mode !== "uplift" && pr.mode !== "overturn" && pr.qmax <= qa + 1e-9 && fsOT >= reqOT - 1e-9 && fsSL >= reqSL - 1e-9 && pr.contact >= reqC - 1e-6
    asd.push({ c, R, pr, qa, fsOT, fsSL, reqOT, reqSL, reqC, ok })
  }
  // ---- LRFD: desain beton
  const h = m.t * 1000, d = h - rc.cover - rc.db, dm = d / 1000
  const wS = (x, y) => { for (const p of m.peds) { const [a, b] = pedSq(p); if (Math.abs(x - p.x) <= a / 2 && Math.abs(y - p.y) <= b / 2) return m.t * (m.gc ?? GAMMA_C) } return m.t * (m.gc ?? GAMMA_C) + W.cover * (m.gs ?? 18) }
  const { X, Y, dA } = geo, N = X.length
  const wself = new Float64Array(N); for (let i = 0; i < N; i++) wself[i] = wS(X[i], Y[i])
  const dirs = [["x", 1], ["x", -1], ["y", 1], ["y", -1]]
  const env = { x: { pos: null, neg: null, v: null }, y: { pos: null, neg: null, v: null } }
  const punch = m.peds.map(() => null), pedEnv = m.peds.map(() => [])
  const upd = (o, key, val, info, cmp) => { if (!o[key] || cmp(val, o[key].val)) o[key] = { val, ...info } }
  for (const c of combos.filter((k) => k.kind === "LRFD")) {
    const R = resultant(m, W, c.vec, c.fD)
    const pr = pressure(geo, R.P, R.Mx, R.My)
    const row = { c, R, pr, valid: pr.mode === "full" || pr.mode === "partial" }
    lrfd.push(row)
    const pl = m.peds.map((p, i) => { const q = pedLoad(c.vec, i); return { ...q, Pb: q.P + c.fD * W.peds[i], Mxb: q.Mx + q.Vy * p.h, Myb: q.My + q.Vx * p.h } })
    pl.forEach((q, i) => pedEnv[i].push({ c, ...q }))
    if (!row.valid) continue
    const qn = new Float64Array(N)
    for (let i = 0; i < N; i++) qn[i] = qAt(pr, X[i], Y[i]) - c.fD * wself[i]
    // momen & geser pada garis potong
    const cut = (axis, v0, sgn, dd) => {
      let M = 0, V = 0
      const C = axis === "x" ? X : Y
      for (let i = 0; i < N; i++) {
        const dist = sgn * (C[i] - v0)
        if (dist > 0) M += qn[i] * dist * dA
        if (dist > dd) V += qn[i] * dA
      }
      m.peds.forEach((p, k) => {
        const pc = axis === "x" ? p.x : p.y, dist = sgn * (pc - v0)
        const mom = axis === "x" ? pl[k].Myb : pl[k].Mxb
        if (dist > 0) M -= pl[k].Pb * dist + sgn * mom
        if (dist > dd) V -= pl[k].Pb
      })
      const w = chord(geo.poly, axis, v0), wv = chord(geo.poly, axis, v0 + sgn * dd)
      return { M: w > 0 ? M / w : 0, V: wv > 0 ? V / wv : 0, w }
    }
    const cuts = []
    m.peds.forEach((p, k) => {
      const [a, b] = pedSq(p)
      for (const [ax, s] of dirs) cuts.push([ax, (ax === "x" ? p.x : p.y) + s * (ax === "x" ? a : b) / 2, s, `${L("muka pedestal", "pedestal face")} ${m.peds.length > 1 ? k + 1 + " " : ""}${s > 0 ? "+" : "−"}${ax}`])
    })
    if (m.peds.length > 1) {
      const [x0, y0, x1, y1] = geo.bbox
      for (const ax of ["x", "y"]) for (let i = 1; i < 40; i++) {
        const v = ax === "x" ? x0 + (x1 - x0) * i / 40 : y0 + (y1 - y0) * i / 40
        const inPed = m.peds.some((p) => { const [a, b] = pedSq(p); return ax === "x" ? Math.abs(v - p.x) < a / 2 : Math.abs(v - p.y) < b / 2 })
        if (!inPed) cuts.push([ax, v, 1, `${ax} = ${nf(v, 2)} m`])
      }
    }
    for (const [ax, v0, s, lab] of cuts) {
      const r = cut(ax, v0, s, dm)
      const info = { combo: c.id, at: lab, w: r.w }
      upd(env[ax], "pos", r.M, info, (a, b) => a > b)
      upd(env[ax], "neg", r.M, info, (a, b) => a < b)
      upd(env[ax], "v", Math.abs(r.V), info, (a, b) => a > b)
    }
    // geser pons tiap pedestal
    m.peds.forEach((p, k) => {
      const [a, b] = pedSq(p), b1x = a + dm, b1y = b + dm
      const corners = [[p.x - b1x / 2, p.y - b1y / 2], [p.x + b1x / 2, p.y - b1y / 2], [p.x + b1x / 2, p.y + b1y / 2], [p.x - b1x / 2, p.y + b1y / 2]]
      if (!corners.every(([x, y]) => inside(geo.poly, x, y))) { if (!punch[k]) punch[k] = { na: true }; return }
      let inS = 0
      for (let i = 0; i < N; i++) if (Math.abs(X[i] - p.x) <= b1x / 2 && Math.abs(Y[i] - p.y) <= b1y / 2) inS += qn[i] * dA
      const Vu = pl[k].Pb - inS
      const b0 = 2 * (b1x + b1y) * 1000, dd = d
      const gx = gammaV(b1x, b1y), gy = gammaV(b1y, b1x)
      const jx = Jc(b1x * 1000, b1y * 1000, dd), jy = Jc(b1y * 1000, b1x * 1000, dd)
      const vu = Vu * 1000 / (b0 * dd) + gx * Math.abs(pl[k].Myb) * 1e6 * (b1x * 500) / jx + gy * Math.abs(pl[k].Mxb) * 1e6 * (b1y * 500) / jy
      const beta = Math.max(a, b) / Math.min(a, b)
      const phivc = 0.75 * vcTwo(rc.fc, beta, 40, b0, dd)
      if (!punch[k] || punch[k].na || vu / phivc > punch[k].ur) punch[k] = { vu, phivc, ur: vu / phivc, Vu, b0, combo: c.id }
    })
  }
  // ---- tulangan footing
  const smax = Math.min(3 * h, 450)
  const asMin = rhoTS(rc.fy) * 1000 * h
  const reinf = {}
  for (const ax of ["x", "y"]) {
    const e = env[ax], Mpos = e.pos ? Math.max(e.pos.val, 0) : 0, Mneg = e.neg ? Math.min(e.neg.val, 0) : 0
    const fb = asFlex(Mpos, 1000, d, rc.fc, rc.fy), ft = asFlex(Mneg, 1000, d, rc.fc, rc.fy)
    const bot = pickBars(Math.max(fb.As || 0, asMin), smax, rc.db)
    const top = Mneg < -1e-6 ? pickBars(Math.max(ft.As || 0, asMin * 0.5), smax, rc.dbTop || rc.db) : null
    reinf[ax] = { Mpos, Mneg, posAt: e.pos, negAt: e.neg, fb, ft, bot, top, phiMnB: phiMn(bot.As, 1000, d, rc.fc, rc.fy), phiMnT: top ? phiMn(top.As, 1000, d, rc.fc, rc.fy) : 0, Vu: e.v ? e.v.val : 0, vAt: e.v,
      phiVc: 0.75 * vcOne(rc.fc) * 1000 * d / 1000 }
  }
  // panjang penyaluran: jarak muka pedestal ke tepi footing dikurangi selimut 75 mm
  const ldv = ld(rc.db, rc.fy, rc.fc)
  const avail = Math.min(...m.peds.flatMap((p) => { const [a, b] = pedSq(p); return [["x", 1], ["x", -1], ["y", 1], ["y", -1]].map(([ax, s]) => rayDist(geo.poly.map(([x, y]) => [x - p.x, y - p.y]), ax === "x" ? s : 0, ax === "y" ? s : 0) - (ax === "x" ? a : b) / 2) })) * 1000 - 75

  // ---- pedestal
  const pedRes = m.peds.map((p, k) => {
    const ab = barA(prc.db), cc = prc.cover + (prc.tie || 10) + prc.db / 2
    let poly, bars
    if (p.shape === "rect") { poly = rectPoly(p.bx * 1000, p.by * 1000); bars = barsRect(p.bx * 1000, p.by * 1000, prc.n, cc, ab) }
    else { const D = p.bx * 1000; poly = p.shape === "oct" ? octPoly(D) : circlePoly(D, 32); bars = barsOnCircle(prc.n, D - 2 * cc, ab, Math.PI / prc.n) }
    const Ag = polyArea(poly).A, rho = prc.n * ab / Ag
    let worst = null
    for (const q of pedEnv[k]) {
      const Pu = q.Pb
      let ur
      if (p.shape === "rect") {
        const cx = pmCapacity(poly, bars, prc.fc, prc.fy, Pu, 0), cy = pmCapacity(poly, bars, prc.fc, prc.fy, Pu, Math.PI / 2)
        if (!cx.ok || !cy.ok) ur = Infinity
        else ur = Math.pow(Math.abs(q.Mxb) / Math.max(cx.phiMn, 1e-9), 1.15) + Math.pow(Math.abs(q.Myb) / Math.max(cy.phiMn, 1e-9), 1.15)
        if (!worst || ur > worst.ur) worst = { ur, Pu, Mx: q.Mxb, My: q.Myb, phiMnx: cx.phiMn, phiMny: cy.phiMn, combo: q.c.id }
      } else {
        const Mr = Math.hypot(q.Mxb, q.Myb), cp = pmCapacity(poly, bars, prc.fc, prc.fy, Pu, 0)
        ur = cp.ok ? Mr / Math.max(cp.phiMn, 1e-9) : Infinity
        if (!worst || ur > worst.ur) worst = { ur, Pu, Mx: q.Mxb, My: q.Myb, Mr, phiMn: cp.phiMn, combo: q.c.id }
      }
    }
    let vw = null
    for (const q of pedEnv[k]) {
      const Vu = Math.hypot(q.Vx, q.Vy), bw = Math.min(...pedSq(p)) * 1000, dd = 0.8 * Math.max(...pedSq(p)) * 1000
      const phiVc = 0.75 * 0.17 * Math.max(0, 1 + Math.max(q.P, 0) * 1000 / (14 * Ag)) * sqfc(prc.fc) * bw * dd / 1000
      if (!vw || Vu / phiVc > vw.ur) vw = { Vu, phiVc, ur: Vu / phiVc, combo: q.c.id }
    }
    return { poly, bars, Ag, rho, worst, vw }
  })

  // ---- daftar pemeriksaan
  const gA = L("Geoteknik & stabilitas (ASD)", "Geotechnical & stability (ASD)"), gS = L("Beton footing (LRFD)", "Footing concrete (LRFD)"), gP = L("Pedestal (LRFD)", "Pedestal (LRFD)")
  const worstBy = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) ? b : a), arr[0])
  if (asd.length) {
    const wq = worstBy(asd, (r) => r.pr.qmax / r.qa)
    checks.push(chk(gA, L("Tekanan tanah maks ≤ daya dukung izin", "Max soil pressure ≤ allowable bearing"), "SNI 8460:2017 §9", wq.pr.qmax, wq.qa, "Q", { note: wq.c.id, d: 1 }))
    checks.push(...contactChecks(asd, gA, crit))
    const wo = worstBy(asd, (r) => r.reqOT / Math.max(r.fsOT, 1e-9))
    checks.push(chk(gA, L("Faktor aman guling", "Overturning safety factor"), "PIP STC01015 / SNI 8460", wo.fsOT, wo.reqOT, "", { mode: "ge", note: wo.c.id }))
    const ws = worstBy(asd, (r) => r.reqSL / Math.max(r.fsSL, 1e-9))
    checks.push(chk(gA, L("Faktor aman geser", "Sliding safety factor"), "PIP STC01015 / SNI 8460", ws.fsSL, ws.reqSL, "", { mode: "ge", note: ws.c.id }))
  }
  for (const ax of ["x", "y"]) {
    const r = reinf[ax], AX = ax.toUpperCase()
    checks.push(chk(gS, L(`Lentur bawah arah ${AX}: Mu ≤ φMn (${r.bot.txt})`, `Bottom flexure ${AX}-dir: Mu ≤ φMn (${r.bot.txt})`), "SNI 2847 §13.2.7, §22.3", r.Mpos, r.phiMnB, "Mm", { note: r.posAt ? r.posAt.combo : "", d: 1 }))
    if (r.top) checks.push(chk(gS, L(`Lentur atas arah ${AX}: |Mu| ≤ φMn (${r.top.txt})`, `Top flexure ${AX}-dir: |Mu| ≤ φMn (${r.top.txt})`), "SNI 2847 §22.3", -r.Mneg, r.phiMnT, "Mm", { note: r.negAt ? r.negAt.combo : "", d: 1 }))
    checks.push(chk(gS, L(`Geser satu arah ${AX} (pada d dari muka)`, `One-way shear ${AX} (at d from face)`), "SNI 2847 §13.2.7.2, §22.5", r.Vu, r.phiVc, "W", { note: r.vAt ? r.vAt.combo : "", d: 1 }))
  }
  punch.forEach((p, k) => {
    const nm = m.peds.length > 1 ? ` ${k + 1}` : ""
    if (!p || p.na) checks.push(chk(gS, L(`Geser dua arah (pons) pedestal${nm}`, `Two-way (punching) shear, pedestal${nm}`), "SNI 2847 §22.6", 0, 1, "MPa", { info: true, note: L("keliling kritis di luar footing: geser satu arah menentukan", "critical perimeter outside footing: one-way shear governs") }))
    else checks.push(chk(gS, L(`Geser dua arah (pons) pedestal${nm}, termasuk transfer momen`, `Two-way (punching) shear, pedestal${nm}, incl. moment transfer`), "SNI 2847 §22.6, §8.4.4.2", p.vu, p.phivc, "MPa", { note: p.combo, d: 3 }))
  })
  const ldhv = ldh(rc.db, rc.fy, rc.fc), hookNeed = avail < ldv
  checks.push(chk(gS, hookNeed ? L("Penyaluran tulangan footing: lurus kurang → pakai kait standar 90° (ldh)", "Footing bar development: straight too short → use standard 90° hook (ldh)") : L("Panjang penyaluran tulangan footing (lurus) tersedia ≥ ld", "Available straight development length ≥ ld"),
    hookNeed ? "SNI 2847 §25.4.3" : "SNI 2847 §25.4.2", avail, hookNeed ? ldhv : ldv, "mm", { mode: "ge", d: 0 }))
  checks.push(chk(gS, L("Tebal efektif d ≥ 150 mm (footing di atas tanah)", "Effective depth d ≥ 150 mm (footing on soil)"), "SNI 2847 §13.3.1.2", d, 150, "mm", { mode: "ge", d: 0 }))
  pedRes.forEach((p, k) => {
    const nm = m.peds.length > 1 ? ` ${k + 1}` : ""
    if (p.worst) checks.push(chk(gP, L(`Interaksi P–M pedestal${nm} (${prc.n} D${prc.db})`, `P–M interaction, pedestal${nm} (${prc.n} D${prc.db})`), "SNI 2847 §22.4", p.worst.ur, 1, "", { note: p.worst.combo, d: 3 }))
    if (m.pedKind !== "plinth") checks.push(chk(gP, L(`Rasio tulangan pedestal${nm} ≥ 0,005·Ag,eff (Ag,eff = Ag/2)`, `Pedestal${nm} reinforcement ≥ 0.005·Ag,eff (Ag,eff = Ag/2)`), "SNI 2847 §16.3.4.1, §10.3.1.2", p.rho * 100, 0.25, "%", { mode: "ge", d: 2 }))
    if (p.vw) checks.push(chk(gP, L(`Geser pedestal${nm} (beton saja)`, `Pedestal${nm} shear (concrete only)`), "SNI 2847 §22.5.6", p.vw.Vu, p.vw.phiVc, "F", { note: p.vw.combo, d: 1 }))
  })
  const badL = lrfd.filter((r) => !r.valid)
  if (badL.length) checks.push(chk(gS, L("Resultan terfaktor di dalam footing (semua kombinasi LRFD)", "Factored resultant within footing (all LRFD combos)"), "SNI 2847 §13.2", false, 0, "", { mode: "bool", note: badL.map((r) => r.c.id).join(", ") }))
  return { geo, W, asd, lrfd, reinf, punch, pedRes, d, h, ldv, ldhv, avail, checks }
}
