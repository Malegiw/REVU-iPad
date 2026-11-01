// Tiang pancang pipa baja dan tiang helical: kapasitas aksial tekan/tarik (API RP 2GEO α/β; helical: individual bearing + korelasi torsi ICC-ES AC358),
// lateral (Broms umum untuk tanah berlapis + balok di atas pegas Winkler / elemen hingga), titik jepit (Davisson & Robinson), kapasitas struktur
// (AISC 360-16 = SNI 1729:2020), kelompok tiang + pile cap (SNI 2847:2019 §13.4), serta perlakuan kepala tiang dan sambungan ke pile cap dengan beton isi
// (jepit/sendi). FS geoteknik mengikuti kebiasaan SNI 8460:2017. Satuan: kN, m, kPa (penampang mm, MPa).
import { L, chk, GAMMA_W, GAMMA_S, GAMMA_C, rad, interp, barA, nf } from "./core.js"
import { pipeCapacity, h1, E_STEEL } from "./steel.js"
import { pmCapacity, circlePoly, barsOnCircle, ld, ldh, phiBearing, phiShearFriction, vcTwo, vcOne, asFlex, pickBars, phiMn, rhoTS, sqfc } from "./rc.js"

// ---------------------------------------------------------------- profil tanah (kedalaman diukur dari kepala tiang / dasar pile cap)
// layers: [{h, type: "clay" | "sand", g (kN/m³ total), cu (kPa), phi (°), nh (kN/m³, 0 = otomatis)}]
export function profile(layers, gwt) {
  const tops = []; let z = 0
  for (const l of layers) { tops.push(z); z += l.h }
  const at = (zz) => { for (let i = 0; i < layers.length; i++) if (zz < tops[i] + layers[i].h) return layers[i]; return layers[layers.length - 1] }
  const sv = (zz) => {
    let s = 0
    for (let i = 0; i < layers.length && tops[i] < zz; i++) {
      const a = tops[i], b = Math.min(zz, i === layers.length - 1 ? zz : tops[i] + layers[i].h), g = layers[i].g
      const dry = Math.max(0, Math.min(b, gwt) - a), wet = Math.max(0, b - Math.max(a, gwt))
      s += g * dry + (g - GAMMA_W) * wet
    }
    return s
  }
  return { at, sv, total: z, tops }
}
// API RP 2GEO Tabel 1 (pasir), sebagai fungsi δ = φ − 5°
const API_D = [15, 20, 25, 30, 35], API_FLIM = [47.8, 67.0, 81.3, 95.7, 114.8], API_NQ = [8, 12, 20, 40, 50], API_QLIM = [1900, 2900, 4800, 9600, 12000]
export const apiSand = (phi) => { const d = phi - 5; return { d, flim: interp(API_D, API_FLIM, d), Nq: interp(API_D, API_NQ, d), qlim: interp(API_D, API_QLIM, d) } }
export function alphaClay(cu, sv) {
  const psi = sv > 0 ? cu / sv : 10
  return Math.min(1, psi <= 1 ? 0.5 * Math.pow(psi, -0.5) : 0.5 * Math.pow(psi, -0.25))
}
const fSkin = (l, sv, K) => {
  if (l.type === "clay") return alphaClay(l.cu, sv) * l.cu
  const a = apiSand(l.phi)
  return Math.min(K * sv * Math.tan(rad(a.d)), a.flim)
}
const qTip = (l, sv) => (l.type === "clay" ? 9 * l.cu : Math.min(apiSand(l.phi).Nq * sv, apiSand(l.phi).qlim))

// ---------------------------------------------------------------- aksial pipa baja (D, t dalam m)
export function axialPipe(D, t, Lp, open, layers, gwt) {
  const P = profile(layers, gwt), Di = D - 2 * t, K = open ? 0.8 : 1.0
  const n = Math.max(20, Math.ceil(Lp / 0.05)), dz = Lp / n
  let Qso = 0, Qsi = 0
  const prof = []
  for (let i = 0; i < n; i++) {
    const z = (i + 0.5) * dz, l = P.at(z), sv = P.sv(z), f = fSkin(l, sv, K)
    Qso += f * Math.PI * D * dz
    if (open) Qsi += f * Math.PI * Di * dz
    if (i % Math.max(1, Math.round(n / 60)) === 0) prof.push({ z, sv, f, Qs: Qso })
  }
  const lt = P.at(Lp - 1e-6), q = qTip(lt, P.sv(Lp))
  const Ag = Math.PI * D * D / 4, Aan = Math.PI * (D * D - Di * Di) / 4
  const plugQ = Qso + q * Ag, unplugQ = Qso + Qsi + q * Aan
  const Qc = open ? Math.min(plugQ, unplugQ) : plugQ
  const Wst = GAMMA_S * Aan * Lp - GAMMA_W * Aan * Math.max(0, Lp - gwt)
  return { Qso, Qsi, q, Qb: open ? (plugQ <= unplugQ ? q * Ag : q * Aan) : q * Ag, plugged: !open || plugQ <= unplugQ, Qc, Qt: Qso + Wst, Wst, prof, tipLayer: lt, svTip: P.sv(Lp) }
}

// ---------------------------------------------------------------- aksial helical (ds, Dh dalam m; helices dari bawah ke atas)
export const nqHelix = (phi) => 1 + 0.56 * Math.pow(12 * phi, phi / 54)                 // ICC-ES AC358 / Perko (2009)
export function axialHelical(o) {
  const P = profile(o.layers, o.gwt), ds = o.ds
  const zs = [o.zTip]
  for (let i = 1; i < o.helices.length; i++) zs.push(zs[i - 1] - o.ratio * o.helices[i - 1])
  const hel = o.helices.map((Dh, i) => {
    const z = zs[i], l = P.at(z), sv = P.sv(z), Ah = Math.PI / 4 * (Dh * Dh - ds * ds)
    const q = l.type === "clay" ? 9 * l.cu : sv * nqHelix(l.phi)
    let Q = Ah * q
    const capped = o.plateCap > 0 && Q > o.plateCap
    if (capped) Q = o.plateCap
    return { Dh, z, Ah, q, Q, capped, type: l.type }
  })
  let Qs = 0
  const ztop = zs[zs.length - 1] - 3 * o.helices[o.helices.length - 1]
  if (o.shaft && ztop > 0) {
    const n = Math.ceil(ztop / 0.05), dz = ztop / n
    for (let i = 0; i < n; i++) { const z = (i + 0.5) * dz; Qs += fSkin(P.at(z), P.sv(z), 1.0) * Math.PI * ds * dz }
  }
  const Qb = hel.reduce((s, h) => s + h.Q, 0) + Qs
  const Qtq = o.T > 0 ? o.Kt * o.T : Infinity
  const ztopH = zs[zs.length - 1], Dtop = o.helices[o.helices.length - 1]
  return { hel, Qs, Qbear: Qb, Qtq, Qc: Math.min(Qb, Qtq), Qt: Math.min(Qb, Qtq), deep: ztopH / Dtop, ztop: ztopH }
}

// ---------------------------------------------------------------- lateral: balok di atas pegas Winkler (elemen hingga Euler–Bernoulli)
// kD(z) = modulus reaksi per satuan panjang tiang (kN/m²); z = 0 di muka tanah; tiang dari z = −e (kepala) sampai z = L (ujung)
function solveDense(K, F, n) {
  const a = K, b = F
  for (let c = 0; c < n; c++) {
    let p = c
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i * n + c]) > Math.abs(a[p * n + c])) p = i
    if (p !== c) { for (let k = 0; k < n; k++) { const t = a[c * n + k]; a[c * n + k] = a[p * n + k]; a[p * n + k] = t } const t = b[c]; b[c] = b[p]; b[p] = t }
    const piv = a[c * n + c]
    for (let i = c + 1; i < n; i++) {
      const f = a[i * n + c] / piv
      if (f === 0) continue
      for (let k = c; k < n; k++) a[i * n + k] -= f * a[c * n + k]
      b[i] -= f * b[c]
    }
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= a[i * n + k] * x[k]; x[i] = s / a[i * n + i] }
  return x
}
export function winkler(EI, e, Lp, kD, head, H, M, nel = 120) {
  const N = nel + 1, n = 2 * N, h = (e + Lp) / nel
  const K = new Float64Array(n * n), F = new Float64Array(n)
  const k = EI / h ** 3, ke = [12, 6 * h, -12, 6 * h, 6 * h, 4 * h * h, -6 * h, 2 * h * h, -12, -6 * h, 12, -6 * h, 6 * h, 2 * h * h, -6 * h, 4 * h * h]
  for (let el = 0; el < nel; el++) {
    const dofs = [2 * el, 2 * el + 1, 2 * el + 2, 2 * el + 3]
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[dofs[i] * n + dofs[j]] += k * ke[i * 4 + j]
  }
  const zs = Array.from({ length: N }, (_, i) => -e + i * h)
  zs.forEach((z, i) => { if (z > -1e-9) { const trib = i === 0 || i === N - 1 ? h / 2 : h; K[2 * i * n + 2 * i] += kD(Math.max(z, 0)) * trib } })
  F[0] = H; F[1] = head === "fixed" ? 0 : M
  if (head === "fixed") { for (let j = 0; j < n; j++) { K[1 * n + j] = 0; K[j * n + 1] = 0 } K[1 * n + 1] = 1 }
  const u = solveDense(K, F, n)
  const y = zs.map((_, i) => u[2 * i]), Mz = new Array(N).fill(0), Vz = new Array(N).fill(0)
  for (let el = 0; el < nel; el++) {
    const ue = [u[2 * el], u[2 * el + 1], u[2 * el + 2], u[2 * el + 3]]
    const f = [0, 1, 2, 3].map((i) => k * (ke[i * 4] * ue[0] + ke[i * 4 + 1] * ue[1] + ke[i * 4 + 2] * ue[2] + ke[i * 4 + 3] * ue[3]))
    if (el === 0) { Mz[0] = -f[1]; Vz[0] = f[0] }
    Mz[el + 1] = f[3]; Vz[el + 1] = -f[2]
  }
  let iMax = 0
  Mz.forEach((m, i) => { if (Math.abs(m) > Math.abs(Mz[iMax])) iMax = i })
  return { z: zs, y, M: Mz, V: Vz, y0: y[0], Mmax: Math.abs(Mz[iMax]), zMmax: zs[iMax], Mhead: Mz[0] }
}

// nh otomatis (Terzaghi 1955) dari φ: lepas / sedang / padat; kering (di atas MAT) dan terendam
export const nhAuto = (phi, wet) => interp([28, 33, 38], wet ? [1300, 4400, 10700] : [2200, 6600, 17600], phi)

// ---------------------------------------------------------------- Broms umum (tekanan ultimit berlapis): pu = 3·Kp·σ'v·D (pasir), 9·cu·D di bawah 1,5D (lempung)
export function bromsGeneral(layers, gwt, D, Lp, e, Mu, pm = 1) {
  const P = profile(layers, gwt), n = Math.max(400, Math.ceil(Lp / 0.01)), dz = Lp / n
  const z = new Float64Array(n), pu = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const zz = (i + 0.5) * dz, l = P.at(zz)
    z[i] = zz
    pu[i] = pm * (l.type === "clay" ? (zz < 1.5 * D ? 0 : 9 * l.cu * D) : 3 * Math.tan(rad(45 + l.phi / 2)) ** 2 * P.sv(zz) * D)
  }
  const F = new Float64Array(n + 1), Mo = new Float64Array(n + 1)      // ∫pu dz dan ∫pu (z+e) dz kumulatif
  for (let i = 0; i < n; i++) { F[i + 1] = F[i] + pu[i] * dz; Mo[i + 1] = Mo[i] + pu[i] * (z[i] + e) * dz }
  const Ft = F[n], Mt = Mo[n]
  const root = (fn) => { let lo = 0, hi = n; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (fn(Math.floor(mid)) > 0) hi = mid; else lo = mid } return Math.floor((lo + hi) / 2) }
  // kepala bebas
  const ir = root((i) => Mo[i] - (Mt - Mo[i]))
  const freeShort = F[ir] - (Ft - F[ir])
  const im = Mo[n] > Mu ? root((i) => Mo[i] - Mu) : -1
  const freeLong = im >= 0 ? F[im] : Infinity
  // kepala jepit
  const fixShort = Ft
  const fixInt = Mt > Mu ? (() => { const j = root((i) => Mo[i] - (Mt - Mo[i]) - Mu); return F[j] - (Ft - F[j]) })() : Infinity
  const jm = Mt > 2 * Mu ? root((i) => Mo[i] - 2 * Mu) : -1
  const fixLong = jm >= 0 ? F[jm] : Infinity
  const free = Math.min(freeShort, freeLong), fixed = Math.min(fixShort, fixInt, fixLong)
  const modeFree = free === freeLong ? L("panjang (sendi plastis di tiang)", "long (plastic hinge in pile)") : L("pendek (rotasi kaku)", "short (rigid rotation)")
  const modeFix = fixed === fixShort ? L("pendek (translasi)", "short (translation)") : fixed === fixInt ? L("menengah (sendi di kepala)", "intermediate (hinge at head)") : L("panjang (dua sendi)", "long (two hinges)")
  return { free, fixed, freeShort, freeLong, fixShort, fixInt, fixLong, modeFree, modeFix }
}
// Faktor p-multiplier kelompok rata-rata (AASHTO LRFD Tabel 10.7.2.4-1), baris 1, 2, ≥3 pada s = 3D dan 5D
export function pmGroup(nRows, sD) {
  if (nRows <= 1) return 1
  const r = Math.min(Math.max((sD - 3) / 2, 0), 1)
  const row = (k) => (k === 0 ? 0.8 + 0.2 * r : k === 1 ? 0.4 + 0.45 * r : 0.3 + 0.4 * r)
  let s = 0; for (let k = 0; k < nRows; k++) s += row(k)
  return s / nRows
}
// Efisiensi kelompok Converse–Labarre
export const convLab = (nx, ny, D, s) => (nx * ny <= 1 ? 1 : 1 - Math.atan(D / s) * 180 / Math.PI * ((nx - 1) * ny + (ny - 1) * nx) / (90 * nx * ny))

// ---------------------------------------------------------------- analisis lengkap
export function analyzePile(I, combos) {
  const isH = I.type === "helical"
  const Dmm = isH ? I.ds : I.D, tmm = (isH ? I.ts : I.t) - I.ca
  const D = Dmm / 1000, t = tmm / 1000, Lp = isH ? I.zTip : I.L
  const checks = [], warn = []
  const gG = L("Geoteknik tiang (ASD)", "Pile geotechnical (ASD)"), gS = L("Struktur tiang baja (LRFD)", "Steel pile structure (LRFD)")
  const gC = L("Kepala tiang & sambungan ke pile cap (LRFD)", "Pile head & pile-cap connection (LRFD)"), gK = L("Pile cap (LRFD)", "Pile cap (LRFD)")
  // ---- kelompok dan pile cap
  const n = I.nx * I.ny
  const piles = []
  for (let i = 0; i < I.nx; i++) for (let j = 0; j < I.ny; j++) piles.push({ x: (i - (I.nx - 1) / 2) * I.sx, y: (j - (I.ny - 1) / 2) * I.sy })
  const Bc = (I.nx - 1) * I.sx + 2 * I.ce, Lc = (I.ny - 1) * I.sy + 2 * I.ce
  const Wcap = Bc * Lc * I.hc * GAMMA_C + Math.max(0, Bc * Lc - I.cx * I.cy) * I.hs * I.gs
  const Sx2 = piles.reduce((s, p) => s + p.x * p.x, 0), Sy2 = piles.reduce((s, p) => s + p.y * p.y, 0)
  const react = (v, fD) => {
    const P = v[0] + fD * Wcap, My = v[4] + v[1] * I.hc, Mx = v[3] + v[2] * I.hc
    const Pi = piles.map((p) => P / n + (Sx2 > 0 ? My * p.x / Sx2 : 0) + (Sy2 > 0 ? Mx * p.y / Sy2 : 0))
    return { P, Mx, My, Pi, max: Math.max(...Pi), min: Math.min(...Pi), H: Math.hypot(v[1], v[2]) / n }
  }
  // ---- kapasitas aksial
  const sp = Math.min(I.nx > 1 ? I.sx : Infinity, I.ny > 1 ? I.sy : Infinity)
  const Eg = I.useEg && n > 1 ? convLab(I.nx, I.ny, D, sp) : 1
  let ax
  if (isH) ax = axialHelical({ ds: D, helices: I.helices.map((d) => d / 1000), zTip: I.zTip, ratio: I.ratio, layers: I.layers, gwt: I.gwt, Kt: I.Kt, T: I.T, plateCap: I.plateCap, shaft: I.shaft })
  else ax = I.axOverride || axialPipe(D, (I.t) / 1000, Lp, I.open, I.layers, I.gwt)
  const Qac = ax.Qc * Eg / I.fsC, Qat = ax.Qt * Eg / I.fsT
  // ---- lateral
  const sec = pipeCapacity(Dmm, tmm, I.Fy, 1000, 1000)
  const EI = E_STEEL * 1000 * sec.I * 1e-12                                          // kN·m²
  const sDs = sp === Infinity ? 99 : sp / D
  const pmF = n > 1 ? Math.min(pmGroup(I.nx, I.sx / D), pmGroup(I.ny, I.sy / D)) : 1
  const P0 = profile(I.layers, I.gwt)
  const kD = (z) => { const l = P0.at(z); return pmF * (l.type === "clay" ? 67 * l.cu : (l.nh > 0 ? l.nh : nhAuto(l.phi, z > I.gwt)) * z) }
  const top = I.layers[0]
  const nhTop = top.type === "sand" ? (top.nh > 0 ? top.nh : nhAuto(top.phi, I.gwt <= 1)) * pmF : 0
  const Tch = top.type === "sand" ? Math.pow(EI / nhTop, 0.2) : 0, Rch = top.type === "clay" ? Math.pow(EI / (67 * top.cu * pmF), 0.25) : 0
  const Lf = top.type === "sand" ? 1.8 * Tch : 1.4 * Rch                          // Davisson & Robinson (1965)
  const head = I.conn === "fixed" ? "fixed" : "free"
  const uH = winkler(EI, I.e, Lp, kD, head, 1, 0), uFree = winkler(EI, I.e, Lp, kD, "free", 1, 0)
  const LfFE = head === "fixed" ? Math.cbrt(12 * EI * uH.y0) - I.e : Math.cbrt(3 * EI * uH.y0) - I.e
  const Kf = head === "fixed" ? 1.2 : 2.1, Le = I.e + Lf
  const br = bromsGeneral(I.layers, I.gwt, D, Lp, I.e, sec.Mp, pmF)
  const Hu = head === "fixed" ? br.fixed : br.free
  const Hal = Hu / I.fsL
  const longPile = Lp / (Tch || Rch || 1) >= (top.type === "sand" ? 4 : 3.5)
  // ---- ASD
  const asd = combos.filter((c) => c.kind === "ASD").map((c) => {
    const r = react(c.vec, c.fD), fac = c.temp ? (I.tempFac ?? 1) : 1
    return { c, r, y: r.H * uH.y0 * 1000, okC: r.max <= Qac * fac + 1e-9, okT: r.min >= -Qat * fac - 1e-9, okH: r.H <= Hal * fac + 1e-9, fac }
  })
  const lrfd = combos.filter((c) => c.kind === "LRFD").map((c) => ({ c, r: react(c.vec, c.fD) }))
  const wC = asd.reduce((a, b) => (b.r.max / b.fac > a.r.max / a.fac ? b : a), asd[0])
  const wT = asd.reduce((a, b) => (b.r.min / b.fac < a.r.min / a.fac ? b : a), asd[0])
  const wH = asd.reduce((a, b) => (b.r.H / b.fac > a.r.H / a.fac ? b : a), asd[0])
  const wY = asd.reduce((a, b) => (b.y > a.y ? b : a), asd[0])
  if (wC) checks.push(chk(gG, L("Tekan aksial per tiang ≤ Qa tekan", "Axial compression per pile ≤ Qa compression"), "SNI 8460:2017 / API RP 2GEO", wC.r.max, Qac * wC.fac, "F", { note: wC.c.id, d: 1 }))
  if (wT && wT.r.min < 0) checks.push(chk(gG, L("Tarik (cabut) per tiang ≤ Qa tarik", "Tension (uplift) per pile ≤ Qa tension"), "SNI 8460:2017", -wT.r.min, Qat * wT.fac, "F", { note: wT.c.id, d: 1 }))
  else checks.push(chk(gG, L("Tidak ada tiang tertarik", "No pile in tension"), "—", 0, Qat, "F", { info: true, d: 1 }))
  if (wH) checks.push(chk(gG, L(`Lateral per tiang ≤ Hu/FS (Broms, ${head === "fixed" ? "kepala jepit" : "kepala bebas"})`, `Lateral per pile ≤ Hu/FS (Broms, ${head === "fixed" ? "fixed head" : "free head"})`), "Broms (1964) / SNI 8460", wH.r.H, Hal * wH.fac, "F", { note: wH.c.id, d: 2 }))
  if (wY) checks.push(chk(gG, L("Defleksi lateral kepala tiang (layan)", "Pile-head lateral deflection (service)"), L("kriteria proyek", "project criteria"), wY.y, I.yAllow, "mm", { note: wY.c.id, d: 1 }))
  if (isH) {
    checks.push(chk(gG, L("Jarak antar helix ≥ 3D (individual bearing)", "Helix spacing ≥ 3D (individual bearing)"), "ICC-ES AC358", I.ratio, 3, "D", { mode: "ge", d: 1 }))
    checks.push(chk(gG, L("Helix teratas ≥ 5D di bawah kepala (perilaku dalam)", "Top helix ≥ 5D below head (deep behaviour)"), "AC358 / Perko", ax.deep, 5, "D", { mode: "ge", d: 1 }))
  }
  if (n > 1) checks.push(chk(gG, L("Jarak tiang ≥ 2,5D (praktik) — efisiensi & pemancangan", "Pile spacing ≥ 2.5D (practice) — efficiency & driving"), "SNI 8460 / AASHTO", sDs, 2.5, "D", { mode: "ge", d: 2 }))
  // ---- struktur tiang (LRFD)
  const capS = pipeCapacity(Dmm, tmm, I.Fy, Kf * Le * 1000, Math.max(Le, 0.5) * 1000)
  const Pe = Math.PI ** 2 * EI / (Kf * Le) ** 2
  let wS = null, wV = null, wTt = null
  for (const r of lrfd) {
    const Hp = r.r.H, Mu = Hp * uH.Mmax, Pc = Math.max(r.r.max, 0)
    const B1 = Pc < Pe ? 1 / (1 - Pc / Pe) : Infinity
    const ur = h1(Pc, capS.phiPn, B1 * Mu, capS.phiMn)
    if (!wS || ur > wS.ur) wS = { ur, Pu: Pc, Mu, B1, combo: r.c.id }
    if (!wV || Hp > wV.Vu) wV = { Vu: Hp, combo: r.c.id }
    if (r.r.min < 0) { const urt = h1(-r.r.min, capS.phiPt, Mu, capS.phiMn); if (!wTt || urt > wTt.ur) wTt = { ur: urt, Tu: -r.r.min, Mu, combo: r.c.id } }
  }
  checks.push(chk(gS, L(`Batas kelangsingan D/t ≤ 0,45E/Fy (${capS.fclass})`, `Slenderness limit D/t ≤ 0.45E/Fy (${capS.fclass})`), "AISC 360-16 Tabel B4.1", capS.lam, 0.45 * E_STEEL / I.Fy, "", { d: 1 }))
  if (wS) checks.push(chk(gS, L("Tekan + lentur (H1-1, termasuk B1 P-δ)", "Compression + flexure (H1-1, incl. B1 P-δ)"), "AISC 360-16 §H1, Lamp. 8", wS.ur, 1, "", { note: wS.combo, d: 3 }))
  if (wTt) checks.push(chk(gS, L("Tarik + lentur (H1-1)", "Tension + flexure (H1-1)"), "AISC 360-16 §H1.2", wTt.ur, 1, "", { note: wTt.combo, d: 3 }))
  if (wV) checks.push(chk(gS, L("Geser tiang Vu ≤ φVn", "Pile shear Vu ≤ φVn"), "AISC 360-16 §G5", wV.Vu, capS.phiVn, "F", { note: wV.combo, d: 2 }))
  // ---- sambungan ke pile cap dengan beton isi
  const conn = connection(I, D, t, Dmm, tmm, lrfd, uH, head, piles, Bc, Lc)
  checks.push(...conn.checks.map((c) => ({ ...c, grp: gC })))
  // ---- pile cap
  const capd = pileCap(I, piles, lrfd, Bc, Lc, D)
  checks.push(...capd.checks.map((c) => ({ ...c, grp: gK })))
  if (!longPile) warn.push(L("Tiang relatif pendek terhadap panjang karakteristik: gunakan Broms mode pendek dan hati-hati dengan hasil Winkler.", "Pile is short relative to its characteristic length: rely on Broms short mode and treat Winkler results with care."))
  if (sDs < 3 && n > 1) warn.push(L("Jarak tiang < 3D: p-multiplier memakai nilai 3D (AASHTO) dan efek kelompok bisa lebih besar.", "Pile spacing < 3D: p-multipliers use the 3D values (AASHTO) and group effects may be larger."))
  return { isH, D, t, Dmm, tmm, Lp, sec: capS, EI, ax, Eg, Qac, Qat, piles, n, Bc, Lc, Wcap, react, asd, lrfd, Tch, Rch, Lf, LfFE, Kf, Le, Pe, uH, uFree, br, Hu, Hal, pmF, head, conn, capd, checks, warn, wS, wTt, wV }
}

// ---------------------------------------------------------------- sambungan kepala tiang – pile cap (beton isi + dowel)
function connection(I, D, t, Dmm, tmm, lrfd, uH, head, piles, Bc, Lc) {
  const out = []
  const Di = Dmm - 2 * (I.type === "helical" ? I.ts : I.t)
  const nd = I.nd, ab = barA(I.dbd), As = nd * ab
  const Dc = Di - 2 * (50 + 10 + I.dbd / 2)
  let Pu = 0, Tu = 0, Vu = 0, Mu = 0, cP = "", cT = "", cV = "", cM = ""
  for (const r of lrfd) {
    if (r.r.max > Pu) { Pu = r.r.max; cP = r.c.id }
    if (-r.r.min > Tu) { Tu = -r.r.min; cT = r.c.id }
    if (r.r.H > Vu) { Vu = r.r.H; cV = r.c.id }
    const m = head === "fixed" ? Math.abs(r.r.H * uH.Mhead) : 0
    if (m > Mu) { Mu = m; cM = r.c.id }
  }
  // 1. syarat penanaman & tepi (IBC 1810.3.11)
  out.push(chk("", L("Penanaman tiang ke pile cap ≥ 76 mm", "Pile embedment into cap ≥ 76 mm"), "IBC 1810.3.11", I.emb, 76, "mm", { mode: "ge", d: 0 }))
  out.push(chk("", L("Jarak tepi pile cap dari sisi tiang ≥ 102 mm", "Cap edge beyond pile face ≥ 102 mm"), "IBC 1810.3.11", (I.ce - D / 2) * 1000, 102, "mm", { mode: "ge", d: 0 }))
  // 2. tumpu kepala tiang pada beton pile cap
  const A1 = Math.PI * Dmm * Dmm / 4
  const phiB = phiBearing(I.fcc, A1, 4 * A1) / 1000
  out.push(chk("", L("Tumpu kepala tiang pada beton cap: Pu ≤ φBn", "Pile-head bearing on cap concrete: Pu ≤ φBn"), "SNI 2847 §22.8", Pu, phiB, "F", { note: cP, d: 1 }))
  // 3. pons tiang ke atas menembus cap (tiang sudut bila dekat tepi)
  const dcap = I.hc * 1000 - I.emb - 75 - I.dbc
  const edge = (I.ce * 1000 - Dmm / 2)
  const corner = edge < dcap / 2
  const b0 = corner ? Math.PI * (Dmm + dcap) / 4 + 2 * I.ce * 1000 : Math.PI * (Dmm + dcap)
  const phivc = 0.75 * vcTwo(I.fcc, 1, corner ? 20 : 40, b0, dcap)
  out.push(chk("", L(`Geser pons tiang ${corner ? "sudut " : ""}menembus cap`, `Punching of ${corner ? "corner " : ""}pile through cap`), "SNI 2847 §22.6, §13.4.2", Pu * 1000 / (b0 * dcap), phivc, "MPa", { note: cP, d: 3 }))
  // 4. dowel: tarik + geser friksi (§22.9.4.4: tulangan tarik ditambah tulangan geser friksi)
  const mu = I.mu
  const AsReq = Tu * 1000 / (0.9 * I.fyd) + Vu * 1000 / (0.75 * mu * Math.min(I.fyd, 420))
  out.push(chk("", L(`Dowel ${nd} D${I.dbd}: As perlu (tarik + friksi geser) ≤ As pasang`, `Dowels ${nd} D${I.dbd}: As req. (tension + shear friction) ≤ As provided`), "SNI 2847 §22.9, §22.4", AsReq, As, "mm²", { note: [cT, cV].filter(Boolean).join("/"), d: 0 }))
  const Ac = Math.PI * Di * Di / 4
  const phiVsf = phiShearFriction(As, I.fyd, mu, Math.min(I.fcp, I.fcc), Ac) / 1000
  const phiVemb = 0.65 * 0.85 * I.fcc * Dmm * I.emb / 1000
  out.push(chk("", L("Geser lateral: friksi geser dowel + tumpu sisi tiang tertanam ≥ Vu", "Lateral shear: dowel shear friction + embedded side bearing ≥ Vu"), "SNI 2847 §22.9, §22.8", Vu, phiVsf + phiVemb, "F", { note: cV, d: 2 }))
  // 5. penjangkaran dowel ke cap dan ke beton isi
  const avail = I.hc * 1000 - I.emb - 75
  const reqCap = I.hook ? ldh(I.dbd, I.fyd, I.fcc) : ld(I.dbd, I.fyd, I.fcc)
  out.push(chk("", L(`Penjangkaran dowel ke cap (${I.hook ? "berkait" : "lurus"}) tersedia ≥ perlu`, `Dowel anchorage into cap (${I.hook ? "hooked" : "straight"}) available ≥ required`), I.hook ? "SNI 2847 §25.4.3" : "SNI 2847 §25.4.2", avail, reqCap, "mm", { mode: "ge", d: 0 }))
  const reqPlug = ld(I.dbd, I.fyd, I.fcp)
  out.push(chk("", L("Panjang dowel di beton isi (Lp − 50) ≥ ld", "Dowel length inside infill (Lp − 50) ≥ ld"), "SNI 2847 §25.4.2", I.Lp - 50, reqPlug, "mm", { mode: "ge", d: 0 }))
  // 6. lekatan beton isi – dinding pipa (AISC 360-16 §I6.3c): Fin = 5300 t/D² ≤ 1,4 MPa, φ = 0,50
  const tw = I.type === "helical" ? I.ts : I.t
  const Fin = Math.min(5300 * tw / (Dmm * Dmm), 1.4)
  const phiRb = 0.5 * Math.PI * Di * I.Lp * Fin / 1000
  out.push(chk("", L("Lekatan langsung beton isi ke pipa ≥ gaya tarik", "Direct bond of infill to pipe ≥ uplift force"), "AISC 360-16 §I6.3c", Tu, phiRb, "F", { note: cT, d: 1 }))
  // 7. panjang beton isi minimum (praktik): jepit max(2D, ld + 50); sendi max(D, ld + 50)
  const LpMin = Math.max((head === "fixed" ? 2 : 1) * Dmm, reqPlug + 50)
  out.push(chk("", L(`Panjang beton isi Lp ≥ ${head === "fixed" ? "2D" : "1D"} dan ≥ ld + 50 (praktik)`, `Infill length Lp ≥ ${head === "fixed" ? "2D" : "1D"} and ≥ ld + 50 (practice)`), L("praktik JRA/PIP", "JRA/PIP practice"), I.Lp, LpMin, "mm", { mode: "ge", d: 0 }))
  // 8. khusus jepit: kapasitas momen penampang beton isi bertulang di muka cap + tumpu beton isi pada dinding pipa
  let pm = null
  if (head === "fixed") {
    const poly = circlePoly(Di, 48), bars = barsOnCircle(nd, Dc, ab)
    const c0 = pmCapacity(poly, bars, I.fcp, I.fyd, -Tu, 0)
    pm = { poly, bars, phiMn: c0.ok ? c0.phiMn : 0, Pu: -Tu }
    out.push(chk("", L(`Momen jepit kepala: Mu ≤ φMn penampang beton isi (${nd} D${I.dbd}, Pu = −Tu)`, `Fixed-head moment: Mu ≤ φMn of infill RC section (${nd} D${I.dbd}, Pu = −Tu)`), "SNI 2847 §22.4 (serat)", Mu, pm.phiMn, "M", { note: cM, d: 1 }))
    const sb = 6 * Mu * 1e6 / (Di * I.Lp * I.Lp)
    out.push(chk("", L("Tumpu beton isi pada dinding pipa akibat momen: 6Mu/(Di·Lp²) ≤ φ0,85fc'", "Infill bearing on pipe wall from moment: 6Mu/(Di·Lp²) ≤ φ0.85fc'"), "SNI 2847 §22.8", sb, 0.65 * 0.85 * I.fcp, "MPa", { note: cM, d: 2 }))
  } else {
    out.push(chk("", L("Sendi: minimum 4 dowel untuk integritas/angkat", "Pinned: minimum 4 dowels for integrity/uplift"), L("praktik", "practice"), nd, 4, "", { mode: "ge", d: 0 }))
  }
  return { checks: out, Pu, Tu, Vu, Mu, Dc, Di, As, AsReq, Fin, phiRb, dcap, corner, pm, avail, reqCap, reqPlug, LpMin }
}

// ---------------------------------------------------------------- pile cap: lentur di muka kolom, geser satu arah (§13.4.2.5), pons kolom
function pileCap(I, piles, lrfd, Bc, Lc, D) {
  const out = []
  const h = I.hc * 1000, d = h - I.emb - 75 - I.dbc, dm = d / 1000
  const share = (dist) => Math.min(1, Math.max(0, dist / D + 0.5))           // pusat ≥ D/2 di luar penampang: penuh; ≥ D/2 di dalam: nol
  let Mx = 0, My = 0, Vx = 0, Vy = 0, Vp = 0, cMx = "", cMy = "", cVx = "", cVy = "", cVp = ""
  const wcap = I.hc * GAMMA_C + I.hs * I.gs
  for (const r of lrfd) {
    const Pi = r.r.Pi.map((p) => p - (r.r.P - r.c.vec[0]) / piles.length)   // reaksi tiang dikurangi berat cap terfaktor (dipikul langsung)
    for (const s of [1, -1]) {
      let mx = 0, my = 0, vx = 0, vy = 0
      piles.forEach((p, i) => {
        const dx = s * p.x - I.cx / 2, dy = s * p.y - I.cy / 2
        if (dx > 0) mx += Pi[i] * dx
        if (dy > 0) my += Pi[i] * dy
        vx += Pi[i] * share(dx - dm); vy += Pi[i] * share(dy - dm)
      })
      if (mx / Lc > Mx) { Mx = mx / Lc; cMx = r.c.id }
      if (my / Bc > My) { My = my / Bc; cMy = r.c.id }
      if (vx / Lc > Vx) { Vx = vx / Lc; cVx = r.c.id }
      if (vy / Bc > Vy) { Vy = vy / Bc; cVy = r.c.id }
    }
    let vp = 0
    piles.forEach((p, i) => { const dist = Math.max(Math.abs(p.x) - (I.cx + dm) / 2, Math.abs(p.y) - (I.cy + dm) / 2); vp += Pi[i] * share(dist) })
    if (vp > Vp) { Vp = vp; cVp = r.c.id }
  }
  const smax = Math.min(3 * h, 450), asMin = rhoTS(I.fyc) * 1000 * h
  const fx = asFlex(Mx, 1000, d, I.fcc, I.fyc), fy = asFlex(My, 1000, d, I.fcc, I.fyc)
  const bx = pickBars(Math.max(fx.As || 0, asMin), smax, I.dbc), by = pickBars(Math.max(fy.As || 0, asMin), smax, I.dbc)
  const phiVcX = 0.75 * vcOne(I.fcc, 1, bx.As / (1000 * d), d) * d, phiVcY = 0.75 * vcOne(I.fcc, 1, by.As / (1000 * d), d) * d   // kN/m
  out.push(chk("", L(`Lentur arah X di muka kolom (${bx.txt})`, `X-direction flexure at column face (${bx.txt})`), "SNI 2847 §13.2.7.1", Mx, phiMn(bx.As, 1000, d, I.fcc, I.fyc), "Mm", { note: cMx, d: 1 }))
  out.push(chk("", L(`Lentur arah Y di muka kolom (${by.txt})`, `Y-direction flexure at column face (${by.txt})`), "SNI 2847 §13.2.7.1", My, phiMn(by.As, 1000, d, I.fcc, I.fyc), "Mm", { note: cMy, d: 1 }))
  out.push(chk("", L("Geser satu arah X (reaksi tiang parsial §13.4.2.5)", "One-way shear X (partial pile reactions §13.4.2.5)"), "SNI 2847 §13.4.2.5, §22.5", Vx, phiVcX, "W", { note: cVx, d: 1 }))
  out.push(chk("", L("Geser satu arah Y", "One-way shear Y"), "SNI 2847 §22.5", Vy, phiVcY, "W", { note: cVy, d: 1 }))
  const b0 = 2 * (I.cx * 1000 + d) + 2 * (I.cy * 1000 + d)
  const beta = Math.max(I.cx, I.cy) / Math.min(I.cx, I.cy)
  if (piles.length > 1) out.push(chk("", L("Geser dua arah (pons) kolom pada pile cap", "Two-way (punching) shear of column on pile cap"), "SNI 2847 §22.6", Vp * 1000 / (b0 * d), 0.75 * vcTwo(I.fcc, beta, 40, b0, d), "MPa", { note: cVp, d: 3 }))
  out.push(chk("", L("Tebal pile cap di atas tulangan bawah ≥ 300 mm", "Cap depth above bottom bars ≥ 300 mm"), "SNI 2847 §13.4.2.1", d, 300, "mm", { mode: "ge", d: 0 }))
  return { checks: out, d, Mx, My, Vx, Vy, Vp, bx, by, asMin, wcap }
}
