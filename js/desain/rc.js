// Beton bertulang: ACI 318-19 (default) atau SNI 2847:2019 (= ACI 318M-14) sesuai CODE.aci. Satuan: mm, MPa, N kecuali disebut lain
// (momen kN·m, gaya kN di antarmuka fungsi). Perbedaan yang dihitung: geser satu arah (Tabel 22.5.5.1 dengan λs & ρw), faktor ukuran λs pada
// geser dua arah (Tabel 22.6.5.2), panjang penyaluran kait (§25.4.3.1).
import { barA, BARS, CODE } from "./core.js"

export const ES = 200000
export const beta1 = (fc) => (fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 28) / 7))
export const rhoTS = (fy) => (fy < 420 ? 0.0020 : Math.max(0.0018 * 420 / fy, 0.0014))          // Tabel 24.4.3.2 (susut & suhu; pelat/footing)
export const sqfc = (fc) => Math.min(Math.sqrt(fc), 8.3)                                         // §22.5.3.1 / §25.4.1.4
// φ dari regangan tarik terluar (Tabel 21.2.2): terkendali tarik εt ≥ 0,005; terkendali tekan εt ≤ εty
export function phiEt(et, fy, spiral = false) {
  const ety = fy / ES, pc = spiral ? 0.75 : 0.65
  if (et >= 0.005) return 0.9
  if (et <= ety) return pc
  return pc + (0.9 - pc) * (et - ety) / (0.005 - ety)
}

// ---------------------------------------------------------------- lentur (lebar b, tinggi efektif d), Mu dalam kN·m
export function asFlex(Mu, b, d, fc, fy) {
  const M = Math.abs(Mu) * 1e6
  if (M < 1) return { As: 0, ok: true, et: Infinity }
  const k = 2 * M / (0.9 * b * d * d) / (0.85 * fc)
  if (k >= 1) return { As: NaN, ok: false, et: 0 }
  const As = 0.85 * fc / fy * (1 - Math.sqrt(1 - k)) * b * d
  const c = As * fy / (0.85 * fc * b) / beta1(fc)
  const et = 0.003 * (d - c) / c
  return { As, ok: et >= 0.004, et }                                                                // §9.3.3.1: εt ≥ 0,004 untuk komponen lentur
}
export function phiMn(As, b, d, fc, fy) {
  const a = As * fy / (0.85 * fc * b), c = a / beta1(fc)
  const et = c > 0 ? 0.003 * (d - c) / c : Infinity
  return phiEt(et, fy) * As * fy * (d - a / 2) / 1e6
}
// Pilih tulangan per meter: diameter pilihan, jarak dibulatkan ke bawah kelipatan 25 mm, ≤ smax; naik diameter bila jarak < 100 mm
export function pickBars(AsReq, smax, pref = 16) {
  const list = BARS.filter((d) => d >= pref)
  for (const db of list.length ? list : [BARS[BARS.length - 1]]) {
    const ab = barA(db)
    let s = AsReq > 0 ? Math.floor(1000 * ab / AsReq / 25) * 25 : smax
    s = Math.min(s, Math.floor(smax / 25) * 25)
    if (s >= 100 || db === BARS[BARS.length - 1]) { s = Math.max(s, 75); return { db, s, As: 1000 * ab / s, txt: `D${db}-${s}` } }
  }
}

// ---------------------------------------------------------------- geser
// faktor ukuran ACI 318-19 §22.5.5.1.3: λs = √(2/(1 + 0,004d)) ≤ 1 (d dalam mm)
export const lamS = (d) => Math.min(1, Math.sqrt(2 / (1 + 0.004 * d)))
// Geser satu arah vc (MPa). ACI 318-19 Tabel 22.5.5.1(c) untuk pelat/telapak tanpa Av,min: 0,66·λs·λ·ρw^(1/3)·√fc' ≤ 0,42λ√fc';
// ACI 318-14 §22.5.5.1: 0,17λ√fc'. ρw = As tarik/(b·d), d mm (bila tidak diberi: rumus 318-14).
export const vcOne = (fc, lam = 1, rho = null, d = null) => (CODE.aci !== "14" && rho != null && d != null
  ? Math.min(0.66 * lamS(d) * lam * Math.cbrt(Math.max(rho, 0)) * sqfc(fc), 0.42 * lam * sqfc(fc)) : 0.17 * lam * sqfc(fc))
// Geser dua arah vc (MPa), Tabel 22.6.5.2: β = sisi panjang/pendek kolom, αs = 40 dalam / 30 tepi / 20 sudut; ACI 318-19 dikali λs (tanpa tulangan geser)
export const vcTwo = (fc, beta, as, b0, d, lam = 1) => Math.min(0.33, 0.17 * (1 + 2 / beta), 0.083 * (as * d / b0 + 2)) * lam * sqfc(fc) * (CODE.aci !== "14" ? lamS(d) : 1)
// Fraksi momen tak seimbang yang dipikul geser (§8.4.4.2): γv = 1 − 1/(1 + (2/3)√(b1/b2))
export const gammaV = (b1, b2) => 1 - 1 / (1 + 2 / 3 * Math.sqrt(b1 / b2))
// Jc penampang kritis kolom dalam (b1 searah momen)
export const Jc = (b1, b2, d) => d * b1 ** 3 / 6 + b1 * d ** 3 / 6 + d * b2 * b1 * b1 / 2

// ---------------------------------------------------------------- penyaluran (§25.4.2.2 dan §25.4.3.1)
export function ld(db, fy, fc, o = {}) {
  const psi = (o.psiT ?? 1) * (o.psiE ?? 1), lam = o.lam ?? 1
  const v = fy * psi / ((db <= 19 ? 2.1 : 1.7) * lam * sqfc(fc)) * db
  return Math.max(v, 300)
}
// Panjang penyaluran kait standar. ACI 318-14 §25.4.3.1: 0,24·fy·ψe·ψc·ψr/(λ√fc')·db (ψc = 0,7 selimut cukup).
// ACI 318-19 §25.4.3.1: (fy·ψe·ψr·ψo·ψc/(23λ√fc'))·db^1,5 dengan ψr = 1,6 (tanpa tulangan pengekang), ψo = 1,0, ψc = fc'/105 + 0,6 (fc' < 40 MPa).
export function ldh(db, fy, fc, o = {}) {
  if (CODE.aci !== "14") {
    const psiC = fc < 40 ? fc / 105 + 0.6 : 1.0
    const v = fy * (o.psiE ?? 1) * (o.psiR19 ?? 1.6) * (o.psiO ?? 1.0) * psiC / (23 * (o.lam ?? 1) * sqfc(fc)) * Math.pow(db, 1.5)
    return Math.max(v, 8 * db, 150)
  }
  const v = 0.24 * fy * (o.psiE ?? 1) * (o.psiC ?? 0.7) * (o.psiR ?? 1) / ((o.lam ?? 1) * sqfc(fc)) * db
  return Math.max(v, 8 * db, 150)
}
// Tumpu beton (§22.8.3.2): φBn = 0,65·0,85·fc'·A1·√(A2/A1) ≤ 2 (N)
export const phiBearing = (fc, A1, A2) => 0.65 * 0.85 * fc * A1 * Math.min(Math.sqrt(Math.max(A2, A1) / A1), 2)
// Geser friksi (§22.9): φVn = 0,75·μ·Avf·fy ≤ batas (N); Ac luas bidang geser
export function phiShearFriction(Avf, fy, mu, fc, Ac) {
  const vn = mu * Avf * Math.min(fy, 420)
  const cap = Math.min(0.2 * fc * Ac, (3.3 + 0.08 * fc) * Ac, 11 * Ac)
  return 0.75 * Math.min(vn, cap)
}

// ---------------------------------------------------------------- penampang (poligon mm, pusat di 0,0)
export const rectPoly = (b, h) => [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]]
export const circlePoly = (D, n = 48) => Array.from({ length: n }, (_, i) => [D / 2 * Math.cos(2 * Math.PI * i / n), D / 2 * Math.sin(2 * Math.PI * i / n)])
export const octPoly = (F) => { const R = F / 2 / Math.cos(Math.PI / 8); return Array.from({ length: 8 }, (_, i) => [R * Math.cos(Math.PI / 8 + i * Math.PI / 4), R * Math.sin(Math.PI / 8 + i * Math.PI / 4)]) }
export function polyArea(p) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length], k = x1 * y2 - x2 * y1
    a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k
  }
  a /= 2
  return { A: Math.abs(a), cx: a ? cx / (6 * a) : 0, cy: a ? cy / (6 * a) : 0 }
}
// Potong poligon dengan setengah bidang y ≥ y0 (Sutherland–Hodgman)
function clipAbove(p, y0) {
  const out = []
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], ia = a[1] >= y0, ib = b[1] >= y0
    if (ia) out.push(a)
    if (ia !== ib) { const t = (y0 - a[1]) / (b[1] - a[1]); out.push([a[0] + t * (b[0] - a[0]), y0]) }
  }
  return out
}
export const barsOnCircle = (n, Dc, A, off = 0) => Array.from({ length: n }, (_, i) => { const t = off + 2 * Math.PI * i / n; return { x: Dc / 2 * Math.cos(t), y: Dc / 2 * Math.sin(t), A } })
// Tulangan merata di keliling persegi panjang (b × h, jarak pusat tulangan ke tepi = cc)
export function barsRect(b, h, n, cc, A) {
  const bx = b - 2 * cc, by = h - 2 * cc, per = 2 * (bx + by), out = []
  const m = Math.max(4, n)
  for (let i = 0; i < m; i++) {
    let s = per * i / m, x, y
    if (s < bx) { x = -bx / 2 + s; y = -by / 2 } else if ((s -= bx) < by) { x = bx / 2; y = -by / 2 + s } else if ((s -= by) < bx) { x = bx / 2 - s; y = by / 2 } else { s -= bx; x = -bx / 2; y = by / 2 - s }
    out.push({ x, y, A })
  }
  return out
}

// Gaya dalam pada kedalaman sumbu netral c (tekan positif). θ: arah serat tekan (0 = +y, π/2 = +x)
function forces(poly, bars, fc, fy, c, th) {
  const rot = (x, y) => x * Math.sin(th) + y * Math.cos(th)
  const pr = poly.map(([x, y]) => [x * Math.cos(th) - y * Math.sin(th), rot(x, y)])
  const ys = pr.map((q) => q[1]), ytop = Math.max(...ys), ybot = Math.min(...ys)
  const a = Math.min(beta1(fc) * c, ytop - ybot)
  const cp = clipAbove(pr, ytop - a)
  const { A: Ac, cy } = cp.length >= 3 ? polyArea(cp) : { A: 0, cy: 0 }
  let P = 0.85 * fc * Ac, M = 0.85 * fc * Ac * cy, dt = 0
  for (const b of bars) {
    const yb = rot(b.x, b.y), depth = ytop - yb
    dt = Math.max(dt, depth)
    let fs = Math.max(-fy, Math.min(fy, ES * 0.003 * (c - depth) / c))
    if (yb >= ytop - a) fs -= 0.85 * fc
    P += fs * b.A; M += fs * b.A * yb
  }
  const et = 0.003 * (dt - c) / c
  return { P, M, et, h: ytop - ybot }
}
// φMn (kN·m) pada beban aksial terfaktor Pu (kN, tekan +). spiral: φ tekan 0,75 dan batas 0,85Po
export function pmCapacity(poly, bars, fc, fy, Pu, th = 0, spiral = false) {
  const Ag = polyArea(poly).A, Ast = bars.reduce((s, b) => s + b.A, 0)
  const Po = 0.85 * fc * (Ag - Ast) + fy * Ast
  const phiPmax = (spiral ? 0.75 * 0.85 : 0.65 * 0.8) * Po / 1000
  const phiPt = -0.9 * fy * Ast / 1000
  if (Pu > phiPmax + 1e-9 || Pu < phiPt - 1e-9) return { phiMn: 0, ok: false, phiPmax, phiPt, Ag, Ast }
  const H = Math.max(...poly.map(([x, y]) => Math.abs(x * Math.sin(th) + y * Math.cos(th)))) * 2
  const g = (c) => { const f = forces(poly, bars, fc, fy, c, th); const ph = phiEt(f.et, fy, spiral); return { v: ph * f.P / 1000 - Pu, ph, f } }
  let lo = H * 1e-4, hi = H * 30
  let glo = g(lo), ghi = g(hi)
  if (ghi.v < 0) ghi = g(hi = H * 1000)
  if (glo.v > 0) { const ph = glo.ph; return { phiMn: Math.max(0, ph * glo.f.M / 1e6), phi: ph, c: lo, et: glo.f.et, ok: true, phiPmax, phiPt, Ag, Ast } }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2, gm = g(mid)
    if (gm.v > 0) { hi = mid; ghi = gm } else { lo = mid; glo = gm }
  }
  const r = ghi
  return { phiMn: Math.abs(r.ph * r.f.M / 1e6), phi: r.ph, c: hi, et: r.f.et, ok: true, phiPmax, phiPt, Ag, Ast }
}
// Kurva interaksi φPn–φMn untuk gambar: [[φMn kN·m, φPn kN], ...] dari tarik murni sampai tekan maksimum
export function pmCurve(poly, bars, fc, fy, th = 0, spiral = false, n = 40) {
  const Ag = polyArea(poly).A, Ast = bars.reduce((s, b) => s + b.A, 0)
  const Po = 0.85 * fc * (Ag - Ast) + fy * Ast
  const phiPmax = (spiral ? 0.75 * 0.85 : 0.65 * 0.8) * Po / 1000
  const H = Math.max(...poly.map(([x, y]) => Math.abs(x * Math.sin(th) + y * Math.cos(th)))) * 2
  const pts = [[0, -0.9 * fy * Ast / 1000]]
  for (let i = 1; i <= n; i++) {
    const c = H * Math.pow(10, -2 + 3 * i / n)
    const f = forces(poly, bars, fc, fy, c, th), ph = phiEt(f.et, fy, spiral)
    const P = Math.min(ph * f.P / 1000, phiPmax)
    pts.push([Math.abs(ph * f.M / 1e6), P])
    if (P >= phiPmax) break
  }
  pts.push([0, phiPmax])
  return pts
}
