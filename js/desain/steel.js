// Baja: penampang pipa bulat (AISC 360-16 = SNI 1729:2020, LRFD) dan baut angkur cor di tempat (ACI 318M-14 Bab 17 = SNI 2847:2019 Pasal 17).
// Satuan: mm, MPa; gaya keluar dalam kN, momen kN·m.

export const E_STEEL = 200000
export const GRADES = {
  A252_2: { nm: "ASTM A252 Gr.2", fy: 241, fu: 414 },
  A252_3: { nm: "ASTM A252 Gr.3", fy: 310, fu: 455 },
  X52: { nm: "API 5L X52 (PSL2)", fy: 359, fu: 455 },
  A53B: { nm: "ASTM A53 Gr.B", fy: 241, fu: 414 },
  A500C: { nm: "ASTM A500 Gr.C (bulat)", fy: 317, fu: 427 },
  BJ41: { nm: "SNI BJ 41", fy: 250, fu: 410 },
}

export function pipeProps(D, t) {
  const Di = D - 2 * t
  const A = Math.PI / 4 * (D * D - Di * Di)
  const I = Math.PI / 64 * (D ** 4 - Di ** 4)
  return { D, t, Di, A, I, S: 2 * I / D, Z: (D ** 3 - Di ** 3) / 6, r: Math.sqrt(I / A) }
}

// Kapasitas desain LRFD. KL = panjang tekuk efektif (mm), Lv = jarak geser maks–nol (mm)
export function pipeCapacity(D, t, Fy, KL, Lv) {
  const E = E_STEEL, p = pipeProps(D, t), lam = D / t
  // lentur F8
  const lp = 0.07 * E / Fy, lr = 0.31 * E / Fy
  let Mn, fclass
  if (lam <= lp) { Mn = Fy * p.Z; fclass = "kompak" }
  else if (lam <= lr) { Mn = (0.021 * E / lam + 1) * Fy * p.S; fclass = "nonkompak" }
  else { Mn = 0.33 * E / lam * p.S; fclass = "langsing" }
  Mn = Math.min(Mn, Fy * p.Z)
  // tekan E3 / E7 (luas efektif pipa langsing, Pers. E7-6)
  const lrc = 0.11 * E / Fy
  const Ae = lam <= lrc ? p.A : Math.min(p.A, (0.038 * E / (Fy * lam) + 2 / 3) * p.A)
  const kr = KL / p.r
  const Fe = Math.PI ** 2 * E / (kr * kr)
  const Fcr = Fy / Fe <= 2.25 ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe
  const Pn = Fcr * Ae
  // geser G5
  const fv1 = 1.60 * E / (Math.sqrt(Math.max(Lv, 1) / D) * Math.pow(lam, 1.25)), fv2 = 0.78 * E / Math.pow(lam, 1.5)
  const Fcrv = Math.min(Math.max(fv1, fv2), 0.6 * Fy)
  const Vn = Fcrv * p.A / 2
  return {
    ...p, lam, lp, lr, fclass, lrc, slenderC: lam > lrc, okLimit: lam <= 0.45 * E / Fy, kr, Fe, Fcr,
    phiMn: 0.9 * Mn / 1e6, phiPn: 0.9 * Pn / 1000, phiPt: 0.9 * Fy * p.A / 1000, phiVn: 0.9 * Vn / 1000,
    Pe: Fe * p.A / 1000, Mp: Fy * p.Z / 1e6,
  }
}
// Interaksi H1-1 (Pr, Pc dalam kN; Mr, Mc dalam kN·m)
export function h1(Pr, Pc, Mr, Mc) {
  const a = Math.abs(Pr) / Pc
  return a >= 0.2 ? a + 8 / 9 * Math.abs(Mr) / Mc : a / 2 + Math.abs(Mr) / Mc
}

// ---------------------------------------------------------------- baut angkur
export const ANCHOR = {
  F1554_36: { nm: "ASTM F1554 Gr.36", fy: 248, fu: 400 },
  F1554_55: { nm: "ASTM F1554 Gr.55", fy: 380, fu: 517 },
  F1554_105: { nm: "ASTM F1554 Gr.105", fy: 724, fu: 862 },
  A307: { nm: "ASTM A307 Gr.A", fy: 248, fu: 414 },
  ISO46: { nm: "ISO 898 kelas 4.6", fy: 240, fu: 400 },
  ISO88: { nm: "ISO 898 kelas 8.8", fy: 640, fu: 800 },
}
const PITCH = { 12: 1.75, 16: 2.0, 20: 2.5, 24: 3.0, 27: 3.0, 30: 3.5, 33: 3.5, 36: 4.0, 42: 4.5, 48: 5.0, 56: 5.5, 64: 6.0 }
export const ANCHOR_D = Object.keys(PITCH).map(Number)
export const anchorAse = (d) => Math.PI / 4 * (d - 0.9382 * (PITCH[d] || d / 8)) ** 2
// Ulir ISO: lebar kunci mur heksagonal (s) untuk luas tumpu kepala/mur
const NUT_S = { 12: 18, 16: 24, 20: 30, 24: 36, 27: 41, 30: 46, 33: 50, 36: 55, 42: 65, 48: 75, 56: 85, 64: 95 }
export const nutAbrg = (d) => { const s = NUT_S[d] || 1.5 * d; return 0.866 * s * s - Math.PI / 4 * d * d }
// Pemeriksaan per baut: Nua, Vua (kN) per baut; grout: pelat dasar di atas grout (×0,8 untuk geser, §17.5.1.3); Abrg (mm²) mur/pelat; fc beton
export function anchorCheck(d, grade, Nua, Vua, fc, opts = {}) {
  const g = ANCHOR[grade] || ANCHOR.F1554_36
  const Ase = anchorAse(d), futa = Math.min(g.fu, 1.9 * g.fy, 860)
  const phiNsa = 0.75 * Ase * futa / 1000                                    // §17.4.1.2, baja daktail φ = 0,75
  const phiVsa = 0.65 * 0.6 * Ase * futa / 1000 * (opts.grout === false ? 1 : 0.8)   // §17.5.1.2b, φ = 0,65
  const Abrg = opts.Abrg || nutAbrg(d)
  const phiNpn = 0.70 * 8 * Abrg * fc / 1000                                 // §17.4.3.4 (ψc,P = 1,0 retak), kondisi B φ = 0,70
  const rn = Math.max(Nua, 0) / Math.min(phiNsa, phiNpn), rv = Math.max(Vua, 0) / phiVsa
  const inter = rn ** (5 / 3) + rv ** (5 / 3)                                 // R17.6 (ζ = 5/3)
  return { Ase, futa, phiNsa, phiVsa, phiNpn, Abrg, rn, rv, inter, grade: g }
}
