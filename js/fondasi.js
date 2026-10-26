// Pondasi dangkal peralatan, pondasi mesin berputar, dan pondasi tangki. Fungsi murni tanpa DOM; padanan satu-satu dengan fondasi.py di aplikasi Review by YMD
// (diuji dengan tests/run.html terhadap hasil Python). Satuan: kN, m, kPa, kN/m3, derajat untuk sudut. Beban vertikal positif = tekan ke bawah.
// Pembanding independen saat mereview perhitungan pondasi; bukan pengganti perhitungan geoteknik/struktur.
// Bagian "laporan" di bawah (eqReport, mcReport, tkReport) menyusun hasil dan pengecekan persis seperti halaman Python (fondasi_ui.py), supaya ikut diuji.
import { fixed, fmtG, signed } from "./fmt.js"

export const G = 9.81
export const GAMMA_W = 9.81
export const GAMMA_C = 24.0
export const MACHINE_TYPES = { rec: ["Resiprokal (kompresor torak)", 3.0, [1, 2]], cen: ["Sentrifugal (pompa, kompresor/turbin sentrifugal)", 2.0, [1]] }

export class FoundationError extends Error {}

const rad = (deg) => deg * (Math.PI / 180)

// ---------------------------------------------------------------- 1. daya dukung
export function bearingFactors(phiDeg) {
  if (phiDeg <= 0.01) return [5.14, 1.0, 0.0]
  const p = rad(phiDeg)
  const nq = Math.exp(Math.PI * Math.tan(p)) * Math.tan(Math.PI / 4 + p / 2) ** 2
  return [(nq - 1) / Math.tan(p), nq, 2 * (nq + 1) * Math.tan(p)]
}

// B, L = dimensi EFEKTIF; Df = kedalaman dasar; q0 = tegangan overburden efektif di dasar; gamma = berat isi efektif di bawah dasar; V, H untuk faktor kemiringan (H = 0: tanpa)
export function qUltimate(B, L, Df, c, phi, gamma, q0, V = 0.0, H = 0.0) {
  const b = Math.min(B, L), l = Math.max(B, L)
  if (b <= 0) return 0.0
  const [nc, nq, ng] = bearingFactors(phi)
  const p = rad(phi)
  const tp = Math.tan(p), sp = Math.sin(p)
  const r = b / l
  const sc = 1 + r * nq / nc
  const sq = 1 + r * tp
  const sg = Math.max(1 - 0.4 * r, 0.6)
  const k = Df / b <= 1 ? Df / b : Math.atan(Df / b)
  let dq, dc
  if (phi > 0.01) {
    dq = 1 + 2 * tp * (1 - sp) ** 2 * k
    dc = dq - (1 - dq) / (nc * tp)
  } else {
    dq = 1.0; dc = 1 + 0.4 * k
  }
  let ic = 1.0, iq = 1.0, ig = 1.0
  if (H > 0 && V > 0) {
    const m = Math.max((2 + r) / (1 + r), (2 + 1 / r) / (1 + 1 / r))
    const den = V + (phi > 0.01 ? b * l * c / tp : 0.0)
    const base = Math.max(0.0, 1 - H / den)
    iq = base ** m; ig = base ** (m + 1)
    ic = phi > 0.01 ? iq - (1 - iq) / (nc * tp) : Math.max(0.0, 1 - m * H / (c > 0 ? b * l * c * nc : Infinity))
  }
  return c * nc * sc * dc * ic + q0 * nq * sq * dq * iq + 0.5 * gamma * b * ng * sg * ig
}

// ---------------------------------------------------------------- 2. pondasi peralatan
// Tekanan dasar dengan eksentrisitas ex (arah B) dan ey (arah L): {mode, q_max, q_min, contact, corners}
export function pressure(V, B, L, ex, ey) {
  if (V <= 0) return { mode: "angkat", q_max: 0.0, q_min: 0.0, contact: 0.0, corners: null }
  const A = B * L
  const kern = 6 * ex / B + 6 * ey / L
  if (kern <= 1 + 1e-9) {
    const qa = V / A
    const cs = []
    for (const sx of [1, -1]) for (const sy of [1, -1]) cs.push(qa * (1 + sx * 6 * ex / B + sy * 6 * ey / L))
    return { mode: "penuh", q_max: qa * (1 + kern), q_min: qa * (1 - kern), contact: 1.0, corners: cs }
  }
  if (ey < 1e-9 && ex < B / 2) {
    const n = 3 * (B / 2 - ex)
    return { mode: "sebagian (satu arah)", q_max: 2 * V / (n * L), q_min: 0.0, contact: n / B, corners: null }
  }
  if (ex < 1e-9 && ey < L / 2) {
    const n = 3 * (L / 2 - ey)
    return { mode: "sebagian (satu arah)", q_max: 2 * V / (n * B), q_min: 0.0, contact: n / L, corners: null }
  }
  const aEff = (B - 2 * ex) * (L - 2 * ey)
  if (aEff <= 0 || ex >= B / 2 || ey >= L / 2) return { mode: "guling", q_max: Infinity, q_min: 0.0, contact: 0.0, corners: null }
  return { mode: "sebagian (dua arah, luas efektif)", q_max: V / aEff, q_min: 0.0, contact: aEff / A, corners: null }
}

// geom: B, L, t, hp, Bp, Lp, Df, gamma_above, backfill
export function footingWeights(geom) {
  const wf = geom.B * geom.L * geom.t * GAMMA_C
  const wp = geom.Bp * geom.Lp * geom.hp * GAMMA_C
  const cover = Math.max(geom.Df - geom.t, 0.0)
  const ws = (geom.backfill === undefined ? true : geom.backfill) ? (geom.B * geom.L - geom.Bp * geom.Lp) * cover * geom.gamma_above : 0.0
  return { footing: wf, pedestal: wp, tanah: Math.max(ws, 0.0) }
}

const none = (x) => x === undefined || x === null

// Satu kasus beban pada footing. case: P, Hx, Hy, Mx, My (di puncak pedestal), q_factor, fs_ot, fs_sl, fs_b, kern_required. soil: c, phi, gamma, mu atau delta, ca, Pp, q_allow, method, E, nu
export function footingCase(geom, soil, cs) {
  const B = geom.B, L = geom.L
  const w = footingWeights(geom)
  const V = cs.P + (w.footing + w.pedestal + w.tanah)
  const h = geom.t + geom.hp
  const Hx = Math.abs(cs.Hx ?? 0.0), Hy = Math.abs(cs.Hy ?? 0.0)
  const Mbx = Math.abs(cs.Mx ?? 0.0) + Hy * h
  const Mby = Math.abs(cs.My ?? 0.0) + Hx * h
  const H = Math.hypot(Hx, Hy)
  const out = { name: cs.name ?? "", V, weights: w, Mbx, Mby, H, checks: [] }
  if (V <= 0) {
    Object.assign(out, { ex: 0, ey: 0, press: pressure(V, B, L, 0, 0), q_eff: null, q_ult: null, fs_b: null, fs_ot: null, fs_sl: null })
    out.checks.push(["Beban vertikal total > 0", false, `V = ${fixed(V, 1)} kN (pondasi terangkat)`])
    return out
  }
  const ex = Mby / V, ey = Mbx / V
  const pr = pressure(V, B, L, ex, ey)
  Object.assign(out, { ex, ey, press: pr })
  const qf = cs.q_factor ?? 1.0
  const be = B - 2 * ex, le = L - 2 * ey
  const q0 = geom.gamma_above * geom.Df
  let qEff, qUlt
  if (be > 0 && le > 0) {
    qEff = V / (be * le)
    qUlt = qUltimate(be, le, geom.Df, soil.c, soil.phi, soil.gamma, q0, V, H)
  } else {
    qEff = Infinity; qUlt = 0.0
  }
  out.q_eff = qEff; out.q_ult = qUlt; out.fs_b = qEff && qEff !== Infinity ? qUlt / qEff : 0.0
  const ck = out.checks
  ck.push(["Tidak terangkat dan resultan di dalam dasar (ex < B/2, ey < L/2)", ex < B / 2 && ey < L / 2, `ex = ${fixed(ex, 3)} m (B/2 = ${fixed(B / 2, 2)}); ey = ${fixed(ey, 3)} m (L/2 = ${fixed(L / 2, 2)})`])
  if (cs.kern_required) ck.push(["Resultan di dalam kern (tanpa area terangkat)", pr.mode === "penuh", `6ex/B + 6ey/L = ${fixed(6 * ex / B + 6 * ey / L, 2)} (≤ 1)`])
  if (soil.method === "laporan" && soil.q_allow) {
    const qa = soil.q_allow * qf
    ck.push(["Tekanan dasar maksimum ≤ daya dukung izin", pr.q_max <= qa + 1e-9, `q maks = ${fixed(pr.q_max, 1)} kPa ≤ ${fixed(qa, 1)} kPa (izin ${fixed(soil.q_allow, 0)} × ${fmtG(qf)})`])
    out.q_allow_used = qa
  } else {
    const fsb = cs.fs_b ?? 3.0
    ck.push([`FS daya dukung ≥ ${fixed(fsb, 2)}`, out.fs_b >= fsb, `FS = ${fixed(out.fs_b, 2)} (q ult = ${fixed(qUlt, 0)} kPa; q efektif = ${fixed(qEff, 1)} kPa)`])
    out.q_allow_used = qUlt / fsb
  }
  const fsOt = []
  if (Mby > 1e-9) fsOt.push(V * B / 2 / Mby)
  if (Mbx > 1e-9) fsOt.push(V * L / 2 / Mbx)
  out.fs_ot = fsOt.length ? Math.min(...fsOt) : Infinity
  const reqOt = cs.fs_ot ?? 1.5
  ck.push([`FS guling ≥ ${fixed(reqOt, 2)}`, out.fs_ot >= reqOt, fsOt.length ? `FS = ${fixed(out.fs_ot, 2)}` : "tanpa momen guling"])
  const mu = !none(soil.mu) ? soil.mu : Math.tan(rad(soil.delta ?? 0.0))
  const contactArea = B * L * Math.max(pr.contact, 0.0)
  const resist = V * mu + (soil.ca ?? 0.0) * contactArea + (soil.Pp ?? 0.0)
  out.fs_sl = H > 1e-9 ? resist / H : Infinity
  out.resist = resist
  const reqSl = cs.fs_sl ?? 1.5
  ck.push([`FS geser ≥ ${fixed(reqSl, 2)}`, out.fs_sl >= reqSl, H > 1e-9 ? `FS = ${fixed(out.fs_sl, 2)} (tahanan ${fixed(resist, 1)} kN; gaya geser ${fixed(H, 1)} kN)` : "tanpa gaya geser"])
  if (soil.E) {
    const a = Math.sqrt(B * L / Math.PI)
    out.settle = Math.PI / 2 * (V / (B * L)) * a * (1 - (soil.nu ?? 0.3) ** 2) / soil.E * 1000.0
  }
  return out
}

// ---------------------------------------------------------------- 3. pondasi mesin berputar
// W_total = berat mesin + pondasi (kN); W_machine = berat mesin (kN); G_soil = modulus geser dinamis (kPa); f_op = frekuensi operasi (Hz); sep = pemisahan minimum (0,2 = 20 %)
export function machineFoundation(B, L, wTotal, wMachine, gSoil, nu, fOp, sep = 0.2, massRatioMin = 3.0) {
  if (Math.min(B, L, wTotal, gSoil, fOp) <= 0 || !(nu >= 0 && nu < 0.5)) throw new FoundationError("Masukan tidak valid (dimensi, berat, G, atau frekuensi operasi ≤ 0, atau ν di luar 0–0,5).")
  const r0 = Math.sqrt(B * L / Math.PI)
  const m = wTotal / G
  const kz = 4 * gSoil * r0 / (1 - nu)
  const kx = 32 * (1 - nu) * gSoil * r0 / (7 - 8 * nu)
  const modes = [["Vertikal", kz], ["Geser horizontal", kx]].map(([name, k]) => {
    const fn = Math.sqrt(k * 1.0 / m) / (2 * Math.PI)
    const d = (fn - fOp) / fOp
    return { mode: name, k, fn, beda: d, ok: Math.abs(d) >= sep, rasio: fOp / fn }
  })
  const mr = wMachine > 0 ? (wTotal - wMachine) / wMachine : Infinity
  return { r0, massa: m, modes, mass_ratio: mr, mass_ok: mr >= massRatioMin, mass_min: massRatioMin, sep }
}

// G = rho Vs^2 (kPa) dari Vs (m/s) dan berat isi gamma (kN/m3); reduction = faktor reduksi regangan
export const shearModulus = (vs, gamma, reduction = 1.0) => gamma / G * vs * vs * reduction

// ---------------------------------------------------------------- 4. tangki
export const windPressureShell = (vMs) => 0.86 * (vMs * 3.6 / 190.0) ** 2
export const windPressureRoofUplift = (vMs) => 1.44 * (vMs * 3.6 / 190.0) ** 2

// t: D, Hs, W_shell, W_roof, W_bottom, roof_live, conds [{name, SG, H}], v_wind, mu_slide. soil: c, phi, gamma, E, nu.
// ring: b, hw, Df, gamma_above, h_pad, gamma_pad
export function tankAnalysis(t, soil, ring) {
  const D = t.D, Hs = t.Hs
  if (Math.min(D, Hs) <= 0 || ring.b <= 0) throw new FoundationError("Diameter, tinggi shell, dan lebar ringwall harus lebih dari nol.")
  const A = Math.PI * D * D / 4
  const out = { A, conds: [], checks: [] }
  const wRoofLive = (t.roof_live ?? 0.0) * A
  const wLine = (t.W_shell + t.W_roof + wRoofLive) / (Math.PI * D)
  const wWall = ring.b * ring.hw * GAMMA_C
  const qRw = (wLine + wWall) / ring.b
  const q0 = ring.gamma_above * ring.Df
  const qUltRw = qUltimate(ring.b, 100 * ring.b, ring.Df, soil.c, soil.phi, soil.gamma, q0)
  Object.assign(out, { w_line: wLine, w_wall: wWall, q_rw: qRw, q_ult_rw: qUltRw, fs_rw: qRw > 0 ? qUltRw / qRw : Infinity })
  for (const cnd of t.conds) {
    const pLiq = GAMMA_W * cnd.SG * cnd.H
    const pBot = t.W_bottom / A
    const pPad = ring.h_pad * ring.gamma_pad
    const qC = pLiq + pBot + pPad
    const qMatUlt = qUltimate(D, D, 0.0, soil.c, soil.phi, soil.gamma, 0.0)
    const r = { name: cnd.name, SG: cnd.SG, H: cnd.H, p_liq: pLiq, p_bot: pBot, p_pad: pPad, q_c: qC, q_mat_ult: qMatUlt, fs_mat: qC > 0 ? qMatUlt / qC : Infinity }
    if (soil.E) {
      const a = D / 2
      const qNet = qC
      const k = a * (1 - (soil.nu ?? 0.3) ** 2) / soil.E * 1000.0
      r.s_center = 2 * qNet * k
      r.s_edge = 4 / Math.PI * qNet * k
      r.s_diff = r.s_center - r.s_edge
      r.tilt = r.s_diff / 1000.0 / a
    }
    out.conds.push(r)
  }
  const pw = windPressureShell(t.v_wind ?? 0.0)
  const Fw = pw * D * Hs
  const Mw = Fw * Hs / 2
  const mDl = t.W_shell * D / 2
  const mDlr = t.W_roof * D / 2
  const stab = mDl / 1.5 + mDlr
  Object.assign(out, { pw, Fw, Mw, m_dl: mDl, m_dlr: mDlr, stab, ur_wind: stab > 0 ? 0.6 * Mw / stab : Infinity, p_uplift: windPressureRoofUplift(t.v_wind ?? 0.0) })
  out.uplift_roof = out.p_uplift * A
  const mu = t.mu_slide ?? 0.4
  const wEmpty = t.W_shell + t.W_roof + t.W_bottom
  out.fs_slide = Fw > 1e-9 ? mu * wEmpty / Fw : Infinity
  return out
}

// ---------------------------------------------------------------- laporan per tab (padanan logika fondasi_ui.py)
const minOr = (xs, d) => (xs.length ? Math.min(...xs) : d)

// cases: [{name, P, Hx, Hy, Mx, My, q_factor, fs_b, fs_ot, fs_sl}]; hasil: res per kasus, indeks kasus penentu (tekanan / izin terbesar), ringkasan FS
export function eqReport(geom, soil, cases) {
  const res = cases.map((cs) => footingCase(geom, soil, cs))
  const util = (r) => (r.q_allow_used ? r.press.q_max / r.q_allow_used : Infinity)
  let gov = 0, best = util(res[0])
  res.forEach((r, i) => { const u = util(r); if (u > best) { best = u; gov = i } })
  const ok = res.every((r) => r.checks.every((c) => c[1]))
  const all = (k) => res.every((r) => !none(r[k]))
  const some = (k) => res.filter((r) => !none(r[k])).map((r) => r[k])
  return { res, gov, ok_all: ok, w: res[0].weights, min_fs_ot: all("fs_ot") ? Math.min(...res.map((r) => r.fs_ot)) : null, min_fs_sl: all("fs_sl") ? Math.min(...res.map((r) => r.fs_sl)) : null,
    cmp_fs_ot: minOr(some("fs_ot"), 0.0), cmp_fs_sl: minOr(some("fs_sl"), 0.0), cmp_qult: res[gov].q_ult || 0.0 }
}

// m: B, L, tb, wm, wx, vs, gm, nu, red, rpm, sep (pecahan), mrmin, harm [1, 2, 3]
export function mcReport(m) {
  const wf = m.B * m.L * m.tb * GAMMA_C
  const wt = m.wm + m.wx + wf
  const g = shearModulus(m.vs, m.gm, m.red)
  let r0
  try { r0 = machineFoundation(m.B, m.L, wt, m.wm, g, m.nu, m.rpm / 60.0, m.sep, m.mrmin) } catch (e) {
    if (e instanceof FoundationError) return { error: e.message }
    throw e
  }
  const rows = [], checks = []
  for (const h of m.harm.length ? m.harm : [1]) {
    const fop = h * m.rpm / 60.0
    const rr = machineFoundation(m.B, m.L, wt, m.wm, g, m.nu, fop, m.sep, m.mrmin)
    for (const mo of rr.modes) {
      rows.push({ mode: mo.mode, k: mo.k, fn: mo.fn, h, fop, beda: mo.beda, ok: mo.ok })
      checks.push([`${mo.mode}: fn berbeda ≥ ${fixed(m.sep * 100, 0)} % dari eksitasi ${h}×`, mo.ok, `fn = ${fixed(mo.fn, 2)} Hz; eksitasi ${fixed(fop, 2)} Hz; beda ${signed(mo.beda * 100, 1)} %`])
    }
  }
  checks.push([`Rasio massa pondasi/mesin ≥ ${fixed(m.mrmin, 1)}`, r0.mass_ok, `rasio = ${fixed(r0.mass_ratio, 2)} (pondasi ${fixed(wf, 0)} kN; mesin ${fixed(m.wm, 0)} kN)`])
  return { wf, wt, G: g, r0, rows, checks, ok_all: checks.every((c) => c[1]) }
}

// k: D, Hs, sg, hop, htest, ws, wr, wb, rl, vw, mu, rb, rh, rdf, hpad, gpad, c, phi, gam, es, nu, fsr, fsm
export function tkReport(k) {
  if (k.rh < k.rdf) return { error: "Tinggi total ringwall harus ≥ kedalaman dasar dari muka tanah." }
  const tIn = { D: k.D, Hs: k.Hs, W_shell: k.ws, W_roof: k.wr, W_bottom: k.wb, roof_live: k.rl, v_wind: k.vw, mu_slide: k.mu,
    conds: [{ name: "Operasi", SG: k.sg, H: k.hop }, { name: "Hidrotes", SG: 1.0, H: k.htest }] }
  const soil = { c: k.c, phi: k.phi, gamma: k.gam, E: k.es || null, nu: k.nu }
  const ring = { b: k.rb, hw: k.rh, Df: k.rdf, gamma_above: k.gam, h_pad: k.hpad, gamma_pad: k.gpad }
  let o
  try { o = tankAnalysis(tIn, soil, ring) } catch (e) {
    if (e instanceof FoundationError) return { error: e.message }
    throw e
  }
  const checks = [[`FS daya dukung ringwall ≥ ${fixed(k.fsr, 2)}`, o.fs_rw >= k.fsr, `FS = ${fixed(o.fs_rw, 2)} (q ringwall = ${fixed(o.q_rw, 1)} kPa; q ult = ${fixed(o.q_ult_rw, 0)} kPa)`]]
  for (const cnd of o.conds) checks.push([`FS daya dukung area tangki (${cnd.name}) ≥ ${fixed(k.fsm, 2)}`, cnd.fs_mat >= k.fsm, `FS = ${fixed(cnd.fs_mat, 2)} (q pusat = ${fixed(cnd.q_c, 1)} kPa; q ult = ${fixed(cnd.q_mat_ult, 0)} kPa)`])
  checks.push(["Stabilitas angin tangki kosong: 0,6 Mw ≤ MDL/1,5 + MDLR", o.ur_wind <= 1.0, `rasio = ${fixed(o.ur_wind, 3)} (0,6 Mw = ${fixed(0.6 * o.Mw, 0)} kNm; tahanan = ${fixed(o.stab, 0)} kNm)`])
  checks.push(["Geser angin ≤ μ × berat tangki kosong", o.fs_slide >= 1.0, `FS = ${fixed(o.fs_slide, 2)} (gaya angin ${fixed(o.Fw, 1)} kN; μ = ${fmtG(k.mu)})`])
  let top = 0
  o.conds.forEach((c, i) => { if (c.q_c > o.conds[top].q_c) top = i })
  return { o, checks, ok_all: checks.every((c) => c[1]), top, cmp_s_center: Math.max(...o.conds.map((c) => c.s_center ?? 0.0)) }
}
