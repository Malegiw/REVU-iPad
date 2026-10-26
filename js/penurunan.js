// Penurunan pondasi dangkal: penurunan segera (Steinbrenner untuk tanah berlapis), konsolidasi primer lempung (Terzaghi, sublapis, muka air tanah),
// kecepatan konsolidasi (Tv dan U), kompresi sekunder opsional. Fungsi murni tanpa DOM; padanan satu-satu dengan penurunan.py di aplikasi Review by YMD
// (diuji dengan tests/run.html terhadap hasil Python). Satuan: kN, m, kPa, kN/m3, tahun (cv dalam m2/tahun); penurunan dalam meter.
// Pembanding independen saat mereview perhitungan penurunan; bukan pengganti perhitungan geoteknik.

import { fixed, fmtG } from "./fmt.js"
export { fixed, fmtG }

export const GAMMA_W = 9.81
export const RIGIDITY = { fleksibel_tengah: 1.0, fleksibel_rata: 0.85, kaku: 0.93 }

export class SettleError extends Error {}

// ---------------------------------------------------------------- tegangan tambahan
export function boussinesqCorner(m, n) {
  const m2 = m * m, n2 = n * n
  const r = Math.sqrt(m2 + n2 + 1)
  const a = 2 * m * n * r / (m2 + n2 + m2 * n2 + 1) * (m2 + n2 + 2) / (m2 + n2 + 1)
  const b = Math.atan2(2 * m * n * r, m2 + n2 - m2 * n2 + 1)
  return (a + b) / (4 * Math.PI)
}

export function stressIncrease(q, shape, B, L, z, method = "boussinesq") {
  if (z <= 0) return q
  if (shape === "lingkaran") {
    const R = B / 2
    if (method === "2:1") return q * B * B / ((B + z) ** 2)
    return q * (1 - 1 / (1 + (R / z) ** 2) ** 1.5)
  }
  const Le = shape === "lajur" ? 1000.0 * B : L
  if (method === "2:1") return q * B * Le / ((B + z) * (Le + z))
  return 4 * q * boussinesqCorner(B / 2 / z, Le / 2 / z)
}

// ---------------------------------------------------------------- penurunan segera (Steinbrenner)
export function steinbrennerIs(m, n, nu) {
  if (n <= 0) return 0.0
  const m2 = m * m, n2 = n * n
  const A0 = m * Math.log((1 + Math.sqrt(m2 + 1)) * Math.sqrt(m2 + n2) / (m * (1 + Math.sqrt(m2 + n2 + 1))))
  const A1 = Math.log((m + Math.sqrt(m2 + 1)) * Math.sqrt(1 + n2) / (m + Math.sqrt(m2 + n2 + 1)))
  const F1 = (A0 + A1) / Math.PI
  const F2 = n / (2 * Math.PI) * Math.atan(m / (n * Math.sqrt(m2 + n2 + 1)))
  return F1 + (1 - 2 * nu) / (1 - nu) * F2
}

function cornerSettlement(q, Bp, Lp, z, E, nu) {
  if (z <= 0) return 0.0
  return q * Bp * (1 - nu ** 2) / E * steinbrennerIs(Lp / Bp, z / Bp, nu)
}

// layers: [{H, E (kPa), nu}] dari dasar pondasi ke bawah; E <= 0 = lapis diabaikan tetapi kedalamannya tetap dihitung. Return [total (m), [tiap lapis]].
export function immediateSettlement(q, shape, B, L, layers, rigidity = "fleksibel_tengah") {
  let Bp, Lp
  if (shape === "lingkaran") {
    const Beq = Math.sqrt(Math.PI) / 2 * B
    Bp = Beq / 2; Lp = Beq / 2
  } else if (shape === "lajur") {
    Bp = B / 2; Lp = 1000.0 * B / 2
  } else {
    Bp = Math.min(B, L) / 2; Lp = Math.max(B, L) / 2
  }
  let z0 = 0.0
  const per = []
  for (const ly of layers) {
    const z1 = z0 + ly.H
    let s = 0.0
    if ((ly.E || 0) > 0) s = 4 * (cornerSettlement(q, Bp, Lp, z1, ly.E, ly.nu) - cornerSettlement(q, Bp, Lp, z0, ly.E, ly.nu))
    per.push(s)
    z0 = z1
  }
  const k = RIGIDITY[rigidity]
  return [k * per.reduce((a, b) => a + b, 0), per.map((s) => k * s)]
}

// ---------------------------------------------------------------- tegangan overburden
function segments(soil) {
  const segs = []
  let z = 0.0
  if (soil.Df > 0) {
    segs.push([0.0, soil.Df, soil.gamma_up, soil.gsat_up])
    z = soil.Df
  }
  for (const ly of soil.layers) {
    segs.push([z, z + ly.H, ly.gamma, ly.gsat])
    z += ly.H
  }
  return segs
}

// [tegangan total, tegangan efektif] pada kedalaman zs dari permukaan tanah; soil.Dw = muka air dari permukaan (null = tanpa air)
export function overburden(zs, soil) {
  const Dw = soil.Dw == null ? null : soil.Dw
  let tot = 0.0, eff = 0.0
  for (const [a, b0, g, gs] of segments(soil)) {
    if (zs <= a) break
    const b = Math.min(b0, zs)
    const h = b - a
    let dry = Dw === null ? 0.0 : Math.max(0.0, Math.min(b, Dw) - a)
    if (Dw === null) dry = h
    const wet = h - dry
    tot += g * dry + gs * wet
    eff += g * dry + (gs - GAMMA_W) * wet
  }
  return [tot, eff]
}

// ---------------------------------------------------------------- konsolidasi
export function consolidationSublayer(H, e0, Cc, Cs, s0, ds, sp) {
  if (s0 <= 0 || H <= 0) return 0.0
  const k = H / (1 + e0)
  const s1 = s0 + ds
  if (sp <= s0) return k * Cc * Math.log10(s1 / s0)
  if (s1 <= sp) return k * Cs * Math.log10(s1 / s0)
  return k * (Cs * Math.log10(sp / s0) + Cc * Math.log10(s1 / sp))
}

export function uOfTv(tv) {
  if (tv <= 0) return 0.0
  let s = 0.0, m = 0
  for (;;) {
    const M = Math.PI * (2 * m + 1) / 2
    const term = 2 / (M * M) * Math.exp(-M * M * tv)
    s += term
    if (term < 1e-13 || m > 200000) break
    m += 1
  }
  return Math.min(1.0, Math.max(0.0, 1 - s))
}

export function tvOfU(u) {
  if (u <= 0) return 0.0
  if (u >= 0.9999) u = 0.9999
  let lo = 0.0, hi = 20.0
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (uOfTv(mid) < u) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export const TV99 = tvOfU(0.99)
const TV50 = tvOfU(0.5), TV90 = tvOfU(0.9)

const f1 = (x) => fixed(x, 1)

export function analyze(foot, soil, qGross, opt = {}) {
  const { method = "boussinesq", rigidity = "fleksibel_tengah", dz = 0.5, lifeYears = 20.0, allowMm = 50.0, diffMm = 0.0, spanM = 0.0, angLimit = 500.0 } = opt
  const shape = foot.shape
  let B = foot.B, L = foot.L
  if (B <= 0 || (shape === "persegi" && L <= 0)) throw new SettleError("Lebar (dan panjang) pondasi harus positif.")
  if (shape === "persegi" && L < B) [B, L] = [L, B]
  if (!soil.layers.length) throw new SettleError("Isi minimal satu lapis tanah di bawah dasar pondasi.")
  if (soil.layers.some((ly) => ly.H <= 0)) throw new SettleError("Tebal tiap lapis harus positif.")
  const totC = soil.Df > 0 ? overburden(soil.Df, soil)[0] : 0.0
  const q = qGross - totC
  if (q <= 0) throw new SettleError("Tekanan bersih (q bruto dikurangi tegangan overburden di dasar pondasi) tidak positif: tidak ada penurunan tambahan.")
  const [si, siLayers] = immediateSettlement(q, shape, B, L, soil.layers, rigidity)
  const subs = [], cons = []
  let z0 = 0.0
  soil.layers.forEach((ly, idx) => {
    const z1 = z0 + ly.H
    if (ly.clay) {
      const n = Math.max(1, Math.ceil(ly.H / dz - 1e-9))
      const h = ly.H / n
      let scLayer = 0.0
      const nm = ly.name || `Lapis ${idx + 1}`
      for (let j = 0; j < n; j++) {
        const zm = z0 + (j + 0.5) * h
        const ds = stressIncrease(q, shape, B, L, zm, method)
        const s0 = overburden(soil.Df + zm, soil)[1]
        const sp = Math.max(ly.OCR == null ? 1.0 : ly.OCR, 1.0) * s0
        const sc = consolidationSublayer(h, ly.e0, ly.Cc, ly.Cs, s0, ds, sp)
        scLayer += sc
        subs.push({ lapis: nm, z_tengah: zm, ds, s0, sp, sc })
      }
      const Hdr = ly.double ? ly.H / 2 : ly.H
      const cv = ly.cv == null ? 0.0 : ly.cv
      cons.push({ lapis: nm, idx, H: ly.H, Hdr, cv, sc: scLayer, Ca: ly.Ca || 0.0,
        t50: cv > 0 ? TV50 * Hdr ** 2 / cv : null, t90: cv > 0 ? TV90 * Hdr ** 2 / cv : null, tp: cv > 0 ? TV99 * Hdr ** 2 / cv : null })
    }
    z0 = z1
  })
  const scTot = cons.reduce((a, c) => a + c.sc, 0)

  function at(t) {
    let s = si
    for (const c of cons) {
      if (c.cv > 0) {
        s += c.sc * uOfTv(c.cv * t / c.Hdr ** 2)
        if (c.Ca > 0 && t > c.tp) s += c.Ca * c.H * Math.log10(t / c.tp)
      } else {
        s += t > 0 ? c.sc : 0.0
      }
    }
    return s
  }

  const curve = []
  for (let i = 0; i <= 40; i++) { const t = 10 ** (-2 + 4 * i / 40); curve.push([t, at(t)]) }
  const sLife = lifeYears > 0 ? at(lifeYears) : si + scTot
  const sFinal = si + scTot
  let ssLife = 0.0
  for (const c of cons) if (c.Ca > 0 && c.tp && lifeYears > c.tp) ssLife += c.Ca * c.H * Math.log10(lifeYears / c.tp)

  const prim = (t) => cons.reduce((a, c) => a + c.sc * (c.cv > 0 ? uOfTv(c.cv * t / c.Hdr ** 2) : 1.0), 0)
  const tAt = (frac) => {
    if (scTot <= 0 || cons.some((c) => c.cv <= 0)) return null
    let lo = 1e-6, hi = 1e6
    for (let i = 0; i < 100; i++) {
      const mid = Math.sqrt(lo * hi)
      if (prim(mid) < frac * scTot) lo = mid
      else hi = mid
    }
    return Math.sqrt(lo * hi)
  }

  const checks = [
    ["Tekanan bersih positif", true, `q bersih = ${f1(q)} kPa (bruto ${f1(qGross)} - overburden ${f1(totC)})`],
    ["Penurunan total ≤ batas izin", sLife * 1000 <= allowMm + 1e-9, `${f1(sLife * 1000)} mm pada ${fmtG(lifeYears)} tahun (batas ${fmtG(allowMm)} mm)`],
  ]
  let ang = null
  if (diffMm > 0 && spanM > 0) {
    ang = diffMm / 1000 / spanM
    checks.push(["Distorsi sudut ≤ batas", ang <= 1 / angLimit + 1e-12, `Δ/L = 1/${fixed(1 / ang, 0)} (batas 1/${fmtG(angLimit)}; Δ = ${fmtG(diffMm)} mm pada ${fmtG(spanM)} m)`])
  }
  const ztot = soil.layers.reduce((a, ly) => a + ly.H, 0)
  const stress = []
  for (let i = 0; i <= 40; i++) {
    const zz = ztot * i / 40
    stress.push([zz, stressIncrease(q, shape, B, L, zz, method), overburden(soil.Df + zz, soil)[1]])
  }
  return { q_net: q, q_gross: qGross, overburden: totC, si, si_layers: siLayers, sc: scTot, cons, subs, curve, s_life: sLife, s_final: sFinal,
    ss_life: ssLife, t50: tAt(0.5), t90: tAt(0.9), at, checks, ang, stress, shape, B, L, method, rigidity }
}
