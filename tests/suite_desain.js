// Kelompok uji modul Desain (js/desain/*.js) terhadap nilai acuan teori/tertutup (bukan Python): tekanan tanah, ACI/SNI 2847, AISC 360, Winkler vs
// Matlock–Reese & Hetenyi, Broms, API RP 2GEO, API 650 Annex E, SNI 1726/1727, kombinasi beban, Richart–Whitman, serta penulis XLSX/PDF.
import * as core from "../js/desain/core.js"
import * as rc from "../js/desain/rc.js"
import * as st from "../js/desain/steel.js"
import * as ft from "../js/desain/footing.js"
import * as pl from "../js/desain/pile.js"
import * as tk from "../js/desain/tank.js"
import * as dy from "../js/desain/dynamic.js"
import { crc32, buildXlsx } from "../js/desain/xlsx.js"
import { winAnsi, textWidth, reportPdf } from "../js/desain/pdf.js"
import { footFrom } from "../js/desain/settle.js"
import { settleShallow, deriveSoil, defaultSoil } from "../js/desain/soil.js"
import { analyze } from "../js/penurunan.js"

export async function run({ check }) {
  const near = (name, got, want, rel = 1e-6, abs = 1e-9) => check(name, Math.abs(got - want) <= Math.max(abs, rel * Math.abs(want)) ? [] : [`${got} ≠ ${want} (toleransi ${rel})`])
  const truthy = (name, cond, msg) => check(name, cond ? [] : [msg || "gagal"])

  // ---- tekanan tanah
  const g6 = ft.makeGeo(ft.planPoly("rect", 6, 6))
  let p = ft.pressure(g6, 1000, 0, 1000)
  near("tekanan: e = B/6 → q maks = 2P/A, q min = 0", p.qmax, 2000 / 36); near("tekanan: q min di batas kern", p.qmin, 0, 0, 1e-9)
  p = ft.pressure(g6, 1000, 0, 1500)
  near("tekanan satu arah di luar kern: q maks = 2P/(3L(B/2 − e))", p.qmax, 2000 / (3 * 6 * 1.5), 2e-3); near("tekanan satu arah: kontak = 3(B/2 − e)/B", p.contact, 0.75, 1e-2)
  p = ft.pressure(g6, 1000, 900, 1200)
  near("tekanan dua arah: kesetimbangan gaya terpenuhi (residu)", p.err, 0, 0, 1e-8)
  truthy("tekanan: resultan di luar dasar → guling", ft.pressure(g6, 100, 0, 400).mode === "overturn")
  truthy("tekanan: P ≤ 0 → terangkat", ft.pressure(g6, -5, 0, 0).mode === "uplift")
  const go = ft.makeGeo(ft.planPoly("oct", 5))
  near("oktagon: luas = 0,8284·F²", go.A, 0.828427 * 25, 1e-4)

  // ---- beton SNI 2847 / ACI 318M-14
  near("asFlex: Mu 200 kN·m, b 1000, d 500, fc 30, fy 420", rc.asFlex(200, 1000, 500, 30, 420).As, 1077.317, 1e-5)
  near("φMn dari As kembali ke Mu", rc.phiMn(1077.317, 1000, 500, 30, 420), 200, 1e-4)
  near("β1 fc' 40 MPa = 0,764", rc.beta1(40), 0.85 - 0.05 * 12 / 7, 1e-9)
  near("ρ susut fy 420 = 0,0018", rc.rhoTS(420), 0.0018); near("ρ susut fy 280 = 0,0020", rc.rhoTS(280), 0.0020)
  near("ld D16 fy 420 fc 30 = fy/(2,1√fc)·db", rc.ld(16, 420, 30), 420 / (2.1 * Math.sqrt(30)) * 16, 1e-9)
  near("ldh D19 = 0,24·fy·0,7/√fc·db", rc.ldh(19, 420, 30), 0.24 * 420 * 0.7 / Math.sqrt(30) * 19, 1e-9)
  near("vc dua arah bujur sangkar interior = 0,33√fc", rc.vcTwo(30, 1, 40, 4000, 500), 0.33 * Math.sqrt(30), 1e-9)
  const sq = rc.rectPoly(400, 400), bars = rc.barsRect(400, 400, 8, 59.5, core.barA(19))
  near("P–M: tarik murni φPt = 0,9·fy·As", rc.pmCapacity(sq, bars, 30, 420, 0, 0).phiPt, -0.9 * 420 * 8 * core.barA(19) / 1000, 1e-9)
  near("P–M: φPn maks = 0,8·0,65·Po", rc.pmCapacity(sq, bars, 30, 420, 0, 0).phiPmax, 0.52 * (0.85 * 30 * (160000 - 8 * core.barA(19)) + 420 * 8 * core.barA(19)) / 1000, 1e-9)
  const c0 = rc.pmCapacity(sq, bars, 30, 420, 0, 0)
  truthy("P–M: lentur murni 400×400 8D19 dalam rentang wajar (110–160 kN·m)", c0.phiMn > 110 && c0.phiMn < 160, String(c0.phiMn))

  // ---- baja AISC 360-16
  const pp = st.pipeCapacity(406.4, 12.7, 241, 8000, 4000)
  near("pipa kompak: φMn = 0,9·Fy·Z", pp.phiMn, 0.9 * 241 * (406.4 ** 3 - 381 ** 3) / 6 / 1e6, 1e-9)
  truthy("pipa D/t = 32 kompak (λp = 0,07E/Fy)", pp.fclass === "kompak")
  near("tarik leleh φPt = 0,9·Fy·A", pp.phiPt, 0.9 * 241 * Math.PI / 4 * (406.4 ** 2 - 381 ** 2) / 1000, 1e-9)
  near("H1-1a: Pr/Pc ≥ 0,2", st.h1(50, 100, 30, 100), 0.5 + 8 / 9 * 0.3, 1e-12); near("H1-1b: Pr/Pc < 0,2", st.h1(10, 100, 30, 100), 0.05 + 0.3, 1e-12)
  near("Ase M24 = 0,7854(d − 0,9382p)²", st.anchorAse(24), 0.7854 * (24 - 0.9382 * 3) ** 2, 1e-4)

  // ---- lateral Winkler vs Matlock–Reese (nh) dan Hetenyi (k tetap)
  const EI = 200e6 * Math.PI / 64 * (0.4064 ** 4 - 0.381 ** 4), nh = 5000, T = Math.pow(EI / nh, 0.2)
  const fr = pl.winkler(EI, 0, 25, (z) => nh * z, "free", 1, 0), fx = pl.winkler(EI, 0, 25, (z) => nh * z, "fixed", 1, 0)
  near("Matlock–Reese kepala bebas: y0 = 2,435·H·T³/EI", fr.y0 * EI / T ** 3, 2.435, 5e-3)
  near("Matlock–Reese kepala bebas: Mmax = 0,772·H·T", fr.Mmax / T, 0.772, 5e-3)
  near("Matlock–Reese kepala jepit: y0 = 0,93·H·T³/EI", fx.y0 * EI / T ** 3, 0.93, 5e-3)
  near("Matlock–Reese kepala jepit: M kepala = 0,93·H·T", Math.abs(fx.Mhead) / T, 0.93, 5e-3)
  const k = 20000, be = Math.pow(k / (4 * EI), 0.25)
  near("Hetenyi kepala bebas: y0 = 2Hβ/k", pl.winkler(EI, 0, 30, () => k, "free", 1, 0).y0, 2 * be / k, 1e-2)
  near("Hetenyi kepala jepit: M0 = H/(2β)", Math.abs(pl.winkler(EI, 0, 30, () => k, "fixed", 1, 0).Mhead), 1 / (2 * be), 1e-2)
  // ---- Broms
  const D = 0.4064, Mu = 400, Kp = 3, gs = 18
  let H1 = 100; for (let i = 0; i < 200; i++) H1 = Mu / (0.544 * Math.sqrt(H1 / (gs * D * Kp)))
  let H2 = 100; for (let i = 0; i < 200; i++) H2 = 2 * Mu / (0.544 * Math.sqrt(H2 / (gs * D * Kp)))
  const bs = pl.bromsGeneral([{ h: 30, type: "sand", g: 18, phi: 30, cu: 0, nh: 0 }], 99, D, 20, 0, Mu)
  near("Broms pasir, tiang panjang kepala bebas", bs.freeLong, H1, 1e-2); near("Broms pasir, tiang panjang kepala jepit", bs.fixLong, H2, 1e-2)
  near("Broms pasir, tiang pendek kepala jepit = 1,5γDL²Kp", bs.fixShort, 1.5 * gs * 400 * D * Kp, 1e-3)
  const bc = pl.bromsGeneral([{ h: 30, type: "clay", g: 17, phi: 0, cu: 50, nh: 0 }], 99, D, 20, 0, Mu)
  let H3 = 100; for (let i = 0; i < 300; i++) H3 = Mu / (1.5 * D + 0.5 * H3 / (9 * 50 * D))
  near("Broms lempung, tiang panjang kepala bebas", bc.freeLong, H3, 1e-2); near("Broms lempung, pendek kepala jepit = 9cuD(L − 1,5D)", bc.fixShort, 9 * 50 * D * (20 - 1.5 * D), 1e-3)
  // ---- API RP 2GEO & helical
  near("API pasir φ 35 → δ 30: Nq 40, qlim 9,6 MPa", pl.apiSand(35).Nq, 40); near("API α lempung ψ = 0,25 → α = 1,0", pl.alphaClay(25, 100), 1.0)
  near("API α lempung ψ = 4 → 0,5·ψ^−0,25", pl.alphaClay(400, 100), 0.5 * Math.pow(4, -0.25), 1e-12)
  near("AC358: Nq = 1 + 0,56(12φ)^(φ/54) pada φ 30", pl.nqHelix(30), 1 + 0.56 * Math.pow(360, 30 / 54), 1e-12)
  near("Converse–Labarre 2×2, s = 3D", pl.convLab(2, 2, 1, 3), 1 - Math.atan(1 / 3) * 180 / Math.PI * 4 / 360, 1e-12)
  near("p-multiplier AASHTO 3 baris s = 3D", pl.pmGroup(3, 3), (0.8 + 0.4 + 0.3) / 3, 1e-12)
  const ax = pl.axialPipe(0.4064, 0.0127, 10, false, [{ h: 20, type: "clay", g: 18, cu: 50, phi: 0, nh: 0 }], 99)
  truthy("aksial ujung tertutup lempung: Qb = 9cu·A", Math.abs(ax.Qb - 9 * 50 * Math.PI * 0.4064 ** 2 / 4) < 1e-6)

  // ---- SNI 1726 / 1727
  const sp = core.seismicParams(0.8, 0.35, "SD")
  near("Fa kelas SD, Ss 0,8 (interpolasi)", sp.Fa, 1.18, 1e-9); near("Fv kelas SD, S1 0,35", sp.Fv, 1.95, 1e-9); near("SDS = 2/3·Fa·Ss", sp.SDS, 2 / 3 * 1.18 * 0.8, 1e-12)
  near("Cs = SDS/(R/Ie)", core.seismicCoef({ SDS: 0.6, SD1: 0.4, S1: 0.35, R: 2, Ie: 1.25, method: "cs" }).Cs, 0.375, 1e-12)
  near("Cs min struktur nongedung 0,03", core.seismicCoef({ SDS: 0.2, SD1: 0.1, S1: 0.1, R: 8, Ie: 1, method: "cs" }).Cs, 0.03, 1e-12)
  near("Kz eksposur C, z 10 m", core.kz(10, "C"), 2.01 * Math.pow(10 / 274.32, 2 / 9.5), 1e-12)
  near("qz = 0,613·Kz·Kd·V²", core.qz(40, 10, { exp: "C", Kd: 0.95 }), 0.613 * core.kz(10, "C") * 0.95 * 1600 / 1000, 1e-12)
  // ---- kombinasi
  const cb = core.expandCombos({ D: [100], Do: [50], Wx: [5], Wy: [3], Ex: [7], Ey: [7] }, 1, { SDS: 0.6 })
  near("kombinasi A6: (1 + 0,14·SDS)(D + Do) + 0,7E", cb.find((c) => c.id === "A6 +x").vec[0], 1.084 * 150 + 0.7 * 7, 1e-12)
  near("kombinasi U7: (0,9 − 0,2·SDS)(D + Do) − E", cb.find((c) => c.id === "U7 −x").vec[0], 0.78 * 150 - 7, 1e-12)
  truthy("kombinasi tanpa L/T/Dt tidak dibentuk", !cb.some((c) => ["A2", "A3", "A10", "U2", "U8"].includes(c.base)))
  near("ortogonal 100–30 menambah varian gempa", core.expandCombos({ D: [1], Ex: [1], Ey: [1] }, 1, { SDS: 0.5, ortho: true }).filter((c) => c.base === "A6").length, 12)

  // ---- API 650 Annex E (D/H = 1)
  const s = tk.seismicAPI({ D: 10, H: 10, SG: 1, Hs: 11, tBot: 8, seis: { SDS: 0.6, SD1: 0.3, S1: 0.3, Ie: 1, TL: 8, anchored: false } }, 100, 20, 30, 1000, 0.5)
  near("API E: Wi/Wp = 1 − 0,218·D/H (D/H < 1,333)", s.Wi / 1000, 1 - 0.218, 1e-12)
  near("API E: Wc/Wp = 0,230·D/H·tanh(3,67·H/D)", s.Wc / 1000, 0.23 * Math.tanh(3.67), 1e-12)
  near("API E: Xi = (0,5 − 0,094·D/H)·H", s.Xi, 0.406 * 10, 1e-12)
  near("API E: Tc = 1,8·Ks·√D", s.Tc, 1.8 * 0.578 / Math.sqrt(Math.tanh(3.68)) * Math.sqrt(10), 1e-12)
  near("API E: Ai = SDS·Ie/Rwi (swa-angkur 3,5)", s.Ai, 0.6 / 3.5, 1e-12)

  // ---- Richart–Whitman
  const I = { ...dy.PRESETS.wtp, exm: 0, eym: 0, Gmode: "G", Gsoil: 50000, Vs: 0, red: 1, nu: 0.3, gs: 18, emb: 0, Fo: 0 }
  const Dd = dy.dynamics(I), r0 = Math.sqrt(I.Bx * I.By / Math.PI), kz = 4 * 50000 * r0 / 0.7
  near("Richart: Kz = 4Gr0/(1 − ν) (tanpa tanam)", Dd.modes[0].K, kz, 1e-12)
  near("Richart: fn = √(K/m)/2π", Dd.modes[0].f, Math.sqrt(kz / Dd.m) / (2 * Math.PI), 1e-12)
  near("ISO 1940: Fo = mr·(G/ω)·ω²", Dd.FoAuto, I.Wr / core.G * I.Gq / 1000 * 2 * Math.PI * I.rpm / 60, 1e-12)

  // ---- penautan Desain ↔ Penurunan
  const fo = footFrom("oct", 4, 4, 0.82843 * 16, 1.5, 80, "vessel", "uji")
  near("telapak oktagon → lingkaran luas sama", Math.PI * fo.B ** 2 / 4, 0.82843 * 16, 1e-9)
  const dsT = deriveSoil(defaultSoil())
  const sf = settleShallow(dsT, { shape: "persegi", B: 3, L: 4, Df: 1.0, q: 120 })
  truthy("penurunan dari modul Desain dihitung dengan mesin tab Penurunan (data tab Tanah)", sf.res && sf.res.s_life > 0 && Math.abs(sf.res.q_gross - 120) < 1e-9)
  const sf2 = settleShallow(dsT, { shape: "persegi", B: 3, L: 4, Df: 1.0, q: 240 })
  truthy("penurunan naik bila tekanan naik", sf2.res.s_life > sf.res.s_life)

  // ---- penulis berkas
  near("CRC32('123456789') = 0xCBF43926", crc32(new TextEncoder().encode("123456789")), 0xCBF43926)
  const xl = buildXlsx([{ name: "Uji", rows: [["a", 1.5]] }], { title: "t", author: "Yan Malegi Diardi" })
  truthy("XLSX: tanda tangan ZIP PK\\x03\\x04", xl[0] === 0x50 && xl[1] === 0x4B && xl[2] === 3 && xl[3] === 4)
  truthy("WinAnsi idempoten untuk —, •, …", winAnsi(winAnsi("a—b•c…")) === winAnsi("a—b•c…") && winAnsi("φ ≤ γ") === "phi <= gamma")
  near("lebar teks Helvetica 'Helvetica' 10 pt", textWidth("Helvetica", 10, false), (722 + 556 + 222 + 500 + 556 + 278 + 222 + 500 + 556) / 100, 1e-12)
  const pdf = reportPdf({ title: "Uji", sub: "s", refs: "r", project: {}, stamp: "01/01/2026 - 00:00", copy: "© Yan Malegi Diardi (01/01/2026 - 00:00)", author: "Yan Malegi Diardi", units: "SI", ok: true, gov: "", metrics: [], sections: [{ h: "1", kv: [["a", "1", "m"]] }] },
    { suite: "", project: "", client: "", doc: "", rev: "", eng: "", chk: "", date: "", units: "", codes: "", allOk: "OK", notOk: "X", param: "", value: "", check: "", ref: "", dem: "", cap: "", unit: "", status: "", combo: "", foot: "", page: "" })
  const head = String.fromCharCode(...pdf.slice(0, 8)), tail = String.fromCharCode(...pdf.slice(-6))
  truthy("PDF: kepala %PDF-1.4 dan akhir %%EOF", head === "%PDF-1.4" && tail.includes("%%EOF"))
}
