// Pilihan tipe pondasi untuk modul peralatan (tangki, vessel, dinamis, trafo): DANGKAL (telapak/mat, qa dari data tanah N-SPT/CPT/Vesic atau
// manual) atau DALAM (kelompok tiang di bawah telapak yang menjadi pile cap). Untuk tiang: tata letak otomatis, kapasitas aksial dari tab Tanah
// (α/β, N-SPT, CPT), efisiensi kelompok, lateral (Broms umum + Winkler kepala jepit), struktur tiang (AISC 360 pipa / SNI 2847 bor), pons tiang
// pada cap, pelat tangki di atas tiang, kekakuan tiang (indikatif) untuk pondasi mesin, dan penurunan kelompok (rakit ekuivalen + pemendekan elastis).
import { L, chk, nf, toDisp, uName, barA, GAMMA_C, clamp, govern } from "./core.js"
import { pileAxial, pileLayers, settleGroup, settleShallow, shallowQa, AXIAL_METHOD, QA_METHOD } from "./soil.js"
import { winkler, bromsGeneral, nhAuto, profile, pmGroup, convLab } from "./pile.js"
import { pipeCapacity, h1, E_STEEL } from "./steel.js"
import { pmCapacity, circlePoly, barsOnCircle, vcTwo, vcOne, asFlex, pickBars, phiMn, rhoTS } from "./rc.js"
import { inside, planPoly, weights, resultant, pileGroup, pileReact, analyzeFooting } from "./footing.js"
import { root, T, R as Rect, dim, palette } from "./draw.js"
import { projLoad, soilDS } from "../project.js"
import { sv } from "./ui.js"

// pSrc: "proj" = tiang rencana dari tab Tanah (acuan kapasitas) | "own" = diatur di modul; pLay: "auto" = jumlah tiang & ukuran cap dari kebutuhan
// beban | "grid" = tata letak manual (s, ce) di telapak yang diisi; psD/pceD: jarak tiang & tepi dalam kelipatan D; tAuto: tebal cap/pelat dari geser & pons
export const DEEP0 = { fdType: "shallow", qaSrc: "soil", fSize: "auto", pSrc: "proj", pLay: "auto", psD: 3, pceD: 1, psMax: 0, tAuto: true,
  pk: "pipe", pD: 406.4, pt: 12.7, popen: true, pFy: 310, pL: 18, pmeth: "api", psx: 1.25, pce: 0.5,
  pfc: 30, pn: 8, pdb: 19, pfsC: 2.5, pfsT: 3.0, pfsL: 2.5, pyAllow: 12, sAllow: 0 }
const BAR = { 13: "D13", 16: "D16", 19: "D19", 22: "D22", 25: "D25", 29: "D29", 32: "D32" }
export const isDeep = (s) => s.fdType === "deep"

// ---------------------------------------------------------------- formulir bersama: tipe pondasi
// o: { tank, autoShallow (vessel/trafo), block (pondasi mesin: ukuran blok tetap) }
export function fdSection(s, o = {}) {
  const sh = (x) => !isDeep(x), dp = (x) => isDeep(x), man = (x) => !isDeep(x) && x.qaSrc === "manual"
  const own = (x) => isDeep(x) && x.pSrc === "own", pipe = (x) => own(x) && x.pk === "pipe", bor = (x) => own(x) && x.pk === "bored"
  const grid = (x) => isDeep(x) && x.pLay === "grid", auto = (x) => isDeep(x) && x.pLay !== "grid"
  const projCard = { type: "custom", show: (x) => isDeep(x) && x.pSrc !== "own", render: () => projPileCard() }
  return { id: "fdt", icon: isDeep(s) ? "📍" : "🧱", sketch: (st) => skFound(st, o), badge: isDeep(s) ? L("DALAM · TIANG", "DEEP · PILES") : L("DANGKAL", "SHALLOW"),
    t: L("Tipe pondasi & alur desain", "Foundation type & design flow"),
    note: isDeep(s)
      ? L(`Alur: <b>kapasitas tiang tunggal</b> (tiang rencana tab Tanah) → <b>beban</b> → <b>jumlah tiang</b> n ≥ P/(Qa·Eg) dicek dengan momen → <b>ukuran pile cap</b> dari jarak s & tepi ce${o.tank ? " (tangki: susunan <b>radial</b> cincin konsentris)" : ""} → <b>tebal & tulangan</b> → pemeriksaan → penurunan.`, `Flow: <b>single pile capacity</b> (Soil tab design pile) → <b>loads</b> → <b>number of piles</b> n ≥ P/(Qa·Eg) checked with moments → <b>pile cap size</b> from spacing s & edge ce${o.tank ? " (tank: <b>radial</b> concentric rings)" : ""} → <b>depth & reinforcement</b> → checks → settlement.`)
      : L(`Alur: <b>qa dari tab Tanah</b> (N-SPT / CPT / Vesic) → <b>beban</b> → <b>ukuran telapak</b> A ≥ P/qa${o.autoShallow ? " (otomatis)" : ""} → <b>tebal & tulangan</b> → pemeriksaan → penurunan.`, `Flow: <b>qa from Soil tab</b> (N-SPT / CPT / Vesic) → <b>loads</b> → <b>footing size</b> A ≥ P/qa${o.autoShallow ? " (automatic)" : ""} → <b>depth & reinforcement</b> → checks → settlement.`),
    fields: [
      { k: "fdType", type: "seg", lab: L("Tipe pondasi", "Foundation type"), opts: { shallow: L("Dangkal (telapak/mat)", "Shallow (footing/mat)"), deep: L("Dalam (tiang)", "Deep (piles)") }, wide: true },
      { k: "qaSrc", type: "seg", lab: L("Sumber daya dukung qa", "Bearing capacity source"), opts: { soil: L("Data tanah (tab Tanah)", "Soil data (Soil tab)"), manual: L("Manual", "Manual") }, show: sh },
      { k: "qa", lab: L("Daya dukung izin qa", "Allowable bearing qa"), u: "Q", lo: 20, hi: 2000, show: man },
      ...(o.autoShallow ? [{ k: "fSize", type: "seg", lab: L("Ukuran telapak", "Footing size"), opts: { auto: L("Otomatis dari beban & qa", "Automatic from loads & qa"), manual: L("Manual (isian B, L, t)", "Manual (B, L, t inputs)") }, show: sh, wide: true, struct: true }] : []),
      { k: "pSrc", type: "seg", lab: L("Tiang", "Pile"), opts: { proj: L("Tiang rencana (tab Tanah)", "Design pile (Soil tab)"), own: L("Atur di modul ini", "Set in this module") }, show: dp, wide: true, struct: true },
      projCard,
      { k: "pk", type: "seg", lab: L("Jenis tiang", "Pile type"), opts: { pipe: L("Pipa baja (pancang)", "Steel pipe (driven)"), bored: L("Bor beton (cast in situ)", "Bored (cast in situ)") }, show: own, wide: true,
        on: (st, v) => { if (v === "bored") Object.assign(st, { pD: 600, psx: 1.8, pce: 0.6 }); else Object.assign(st, { pD: 406.4, pt: 12.7, psx: 1.25, pce: 0.5 }) } },
      { k: "pD", lab: L("Diameter tiang D", "Pile diameter D"), u: "mm", lo: 150, hi: 2000, show: own },
      { k: "pt", lab: L("Tebal dinding t", "Wall thickness t"), u: "mm", lo: 4, hi: 50, show: pipe },
      { k: "popen", type: "seg", lab: L("Ujung tiang", "Pile tip"), opts: { true: L("Terbuka", "Open"), false: L("Tertutup", "Closed") }, show: pipe, on: (st, v) => { st.popen = v === "true" } },
      { k: "pFy", lab: "Fy", u: "MPa", lo: 200, hi: 600, show: pipe },
      { k: "pfc", lab: L("fc' tiang bor", "Bored pile fc'"), u: "MPa", lo: 20, hi: 50, show: bor },
      { k: "pn", lab: L("Jumlah tulangan memanjang", "Longitudinal bars"), u: "", lo: 6, hi: 40, show: bor },
      { k: "pdb", type: "sel", lab: L("Diameter tulangan", "Bar size"), opts: BAR, show: bor },
      { k: "pL", lab: L("Panjang tiang di bawah cap Lp", "Pile length below cap Lp"), u: "m", lo: 3, hi: 80, show: own },
      { k: "pmeth", type: "seg", lab: L("Metode kapasitas aksial", "Axial capacity method"), opts: { api: "α/β", spt: "N-SPT", cpt: "CPT" }, show: own, help: L("α/β: API RP 2GEO (pancang) / FHWA GEC 10 (bor); N-SPT: Meyerhof; CPT: LCPC.", "α/β: API RP 2GEO (driven) / FHWA GEC 10 (bored); N-SPT: Meyerhof; CPT: LCPC.") },
      { k: "pfsC", lab: L("FS tekan", "FS compression"), u: "", lo: 1.5, hi: 4, show: own }, { k: "pfsT", lab: L("FS tarik", "FS tension"), u: "", lo: 1.5, hi: 5, show: own },
      { k: "pfsL", lab: L("FS lateral", "FS lateral"), u: "", lo: 1.5, hi: 4, show: own }, { k: "pyAllow", lab: L("Defleksi izin kepala", "Allowable head deflection"), u: "mm", lo: 3, hi: 100, show: own },
      { type: "hr", lab: L("Jumlah & susunan tiang", "Number & layout of piles"), show: dp },
      { k: "pLay", type: "seg", lab: o.tank ? L("Susunan radial", "Radial layout") : L("Jumlah tiang & ukuran cap", "Pile count & cap size"), opts: { auto: L("Otomatis dari kebutuhan beban", "Automatic from load demand"), grid: o.tank ? L("Jarak manual", "Manual spacing") : L("Grid manual di telapak", "Manual grid in footing") }, show: dp, wide: true, struct: true },
      { k: "psD", lab: L("Jarak tiang minimum s", "Minimum pile spacing s"), u: "×D", lo: 2.5, hi: 8, show: auto, help: L("Praktik 3D (gesek) – 2,5D (ujung).", "Practice 3D (friction) – 2.5D (end bearing).") },
      { k: "pceD", lab: L("Pusat tiang ke tepi cap ce", "Pile centre to cap edge ce"), u: "×D", lo: 0.75, hi: 3, show: auto, help: L("≥ D/2 + 150 mm (diambil otomatis bila lebih besar).", "≥ D/2 + 150 mm (applied automatically if larger).") },
      ...(o.tank ? [] : [{ k: "psMax", lab: L("Jarak tiang maksimum", "Maximum pile spacing"), u: "m", lo: 0, hi: 8, show: auto, help: L("0 = otomatis maks(8D; 3 m). Jarak lebih besar → tiang lebih sedikit, cap lebih tebal.", "0 = automatic max(8D; 3 m). Larger spacing → fewer piles, thicker cap.") }]),
      { k: "psx", lab: o.tank ? L("Jarak radial & keliling s", "Radial & circumferential spacing s") : L("Jarak tiang s (grid)", "Pile spacing s (grid)"), u: "m", lo: 0.5, hi: 6, show: grid, struct: true },
      { k: "pce", lab: L("Pusat tiang ke tepi cap ce", "Pile centre to cap edge ce"), u: "m", lo: 0.2, hi: 2, show: grid, struct: true },
      ...(o.block ? [] : [{ k: "tAuto", type: "chk", lab: o.tank ? L("Tebal pelat otomatis (lentur, geser, pons)", "Automatic slab depth (flexure, shear, punching)") : L("Tebal pile cap otomatis (geser satu arah & pons)", "Automatic pile cap depth (one-way & punching shear)"), show: dp }]),
    ] }
}
// ringkasan tiang rencana proyek (tab Tanah) di formulir modul
function projPileCard() {
  const box = document.createElement("div"); box.className = "pj-pilecard"
  try {
    const P = projLoad(), ds = soilDS(P), p = P.pile
    const I = effPile({ pSrc: "proj" }, { pile: p }), sp = singlePile(I, ds, p.z0)
    box.innerHTML = `<b>${L("Tiang rencana dari tab Tanah", "Design pile from Soil tab")}</b><span>${p.kind === "bored" ? L("Bor beton", "Bored") : L("Pipa baja", "Steel pipe")} Ø${nf(p.D, 0)}${p.kind === "pipe" ? " × " + nf(p.t, 1) : ""} mm · L ${nf(p.L, 1)} m · ${AXIAL_METHOD()[p.method].split(" (")[0]}</span>`
      + `<span class="pj-kv"><i>Qa ${L("tekan", "comp.")}</i> ${F_(sp.Qad)} <i>${L("tarik", "tension")}</i> ${F_(sp.Qat)} <i>${L("lateral", "lateral")}</i> ${F_(sp.Ha, 1)}</span><a href="#/tanah">${L("Ubah di tab Tanah →", "Edit in Soil tab →")}</a>`
      + `<small class="hint">${L(`Nilai di atas pada kepala tiang z0 = ${nf(p.z0, 2)} m (tab Tanah). Modul ini menghitung ulang Qa pada dasar pondasinya sendiri — lihat langkah 1 di Alur perhitungan.`, `Values above at pile head z0 = ${nf(p.z0, 2)} m (Soil tab). This module recomputes Qa at its own foundation base — see step 1 of the Calculation flow.`)}</small>`
  } catch (e) { box.textContent = e.message }
  return box
}
// ---------------------------------------------------------------- qa dari tab Tanah
export function qaFor(s, ctx, B, Lf, Df) {
  if (s.qaSrc === "manual" || !ctx.soil) return { qa: s.qa, src: "manual" }
  const r = shallowQa(ctx.soil, B, Lf, Df, ctx.bear.method, ctx.bear.FS)
  return { qa: r.qa, src: "soil", r }
}
export function qaNote(q) {
  return q.src === "soil" ? L(`qa = ${nf(toDisp("Q", q.qa), 1)} ${uName("Q")} dari tab Tanah — ${q.r.txt}, FS ${nf(q.r.FS, 1)} (${q.r.gov}).`, `qa = ${nf(toDisp("Q", q.qa), 1)} ${uName("Q")} from Soil tab — ${q.r.txt}, FS ${nf(q.r.FS, 1)} (${q.r.gov}).`)
    : L("qa diisi manual.", "qa entered manually.")
}

// ---------------------------------------------------------------- tata letak tiang (grid di dalam denah, jarak tepi ce)
export function pileLayout(shape, B, Lf, s, ce) {
  const out = [], Lr = shape === "rect" ? Lf : B
  const nx = Math.max(1, Math.floor((B - 2 * ce) / s + 1e-9) + 1), ny = Math.max(1, Math.floor((Lr - 2 * ce) / s + 1e-9) + 1)
  const sh = shape === "rect" ? null : planPoly(shape, Math.max(B - 2 * ce, 0.01))
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = (i - (nx - 1) / 2) * s, y = (j - (ny - 1) / 2) * s
    if (!sh || inside(sh, x, y) || (nx === 1 && ny === 1)) out.push({ x, y })
  }
  if (!out.length) out.push({ x: 0, y: 0 })
  return out
}
// grid nx × ny merata di dalam B × L dengan jarak tepi ce (jarak antar tiang mengisi cap)
export function gridLayout(nx, ny, B, Lf, ce) {
  const sx = nx > 1 ? (B - 2 * ce) / (nx - 1) : 0, sy = ny > 1 ? (Lf - 2 * ce) / (ny - 1) : 0, piles = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) piles.push({ x: (i - (nx - 1) / 2) * sx, y: (j - (ny - 1) / 2) * sy })
  return { piles, sx, sy }
}
// susunan RADIAL untuk pelat bundar (tangki): cincin luar di bawah shell pada R1 = Ds/2 − ce, cincin dalam tiap s ke arah pusat,
// jumlah tiang tiap cincin = ⌊2πR/s⌋ (selang-seling setengah langkah antar cincin), ditambah satu tiang pusat
export function ringLayout(Ds, ce, s) {
  const piles = [], rings = []
  let R = Ds / 2 - ce
  while (R > 0.6 * s) {
    const n = Math.max(3, Math.floor(2 * Math.PI * R / s + 1e-9)), off = rings.length % 2 ? Math.PI / n : 0
    for (let k = 0; k < n; k++) { const a = off + 2 * Math.PI * k / n; piles.push({ x: R * Math.cos(a), y: R * Math.sin(a), ring: rings.length }) }
    rings.push({ R, n }); R -= s
  }
  piles.push({ x: 0, y: 0, ring: rings.length }); rings.push({ R: 0, n: 1 })
  return { piles, rings }
}
// jarak antar tiang & jarak tepi dari kelipatan D (min 2,5D; tepi ≥ D/2 + 150 mm)
export function spacing(I) { const D = I.pD / 1000; return { s: Math.max(I.psD || 3, 2.5) * D, ce: Math.max((I.pceD || 1) * D, D / 2 + 0.15), D } }
// parameter tiang efektif: tiang rencana proyek (tab Tanah) atau milik modul
export function effPile(s, ctx) {
  const p = ctx && ctx.pile
  if (s.pSrc === "own" || !p) return { ...s }
  return { ...s, pk: p.kind, pD: p.D, pt: p.t, popen: p.open, pFy: p.Fy, pfc: p.fc, pn: p.n, pdb: p.db, pL: p.L, pmeth: p.method, pfsC: p.fsC, pfsT: p.fsT, pfsL: p.fsL, pyAllow: p.yAllow }
}
// ---------------------------------------------------------------- kapasitas TIANG TUNGGAL (acuan): geoteknik tekan/tarik, lateral (Broms & batas defleksi), struktur (ASD)
export function singlePile(s, ds, z0) {
  const pp = pileProps(s, ds, z0)
  const lt = lateral({ ...s, psx: 3 * pp.D }, ds, pp, { piles: [{ x: 0, y: 0 }], Df: z0 })
  const Hd = s.pyAllow / 1000 / Math.max(lt.uH.y0, 1e-12)
  const Ha = Math.min(lt.Hal, Hd)
  let Pstr, strTxt
  if (pp.bored) { const Ag = Math.PI * s.pD ** 2 / 4; Pstr = (0.33 * s.pfc * Ag + 0.4 * 420 * pp.rc.Ast) / 1000; strTxt = "0,33·fc'·Ag + 0,4·fy·As" }
  else { const Le = Math.max(lt.Lf, 0.5), cs = pipeCapacity(s.pD, s.pt, s.pFy, 1.2 * Le * 1000, Le * 1000); Pstr = cs.phiPn / 0.9 / 1.67; strTxt = "Pn/Ω (AISC, Ω = 1,67)" }
  const Qac = pp.ax.Qc / s.pfsC, Qat = pp.ax.Qt / s.pfsT
  return { pp, ax: pp.ax, D: pp.D, Qac, Qat, Hal: lt.Hal, Hd, Ha, Pstr, strTxt, Qad: Math.min(Qac, Pstr), govStr: Pstr < Qac, lt, z0 }
}
// pons tiang ke atas menembus cap (tiang tepi: keliling terpotong) — rasio terburuk dari kombinasi LRFD
function pilePunch(m, r, D, fc) {
  let wP = null
  const dmm = r.d, dm = dmm / 1000
  for (const lr of r.lrfd) {
    if (!lr.pk) continue
    m.piles.forEach((p, j) => {
      const R = lr.pk.Pi[j]; if (R <= 0) return
      const e = edgeDist(m.shape, m.B, m.L, p), full = Math.PI * (D + dm) * 1000
      const b0 = Math.min(full, Math.PI * (D + dm) * 500 + 2 * e * 1000)
      const v = R * 1000 / (b0 * dmm), cap = 0.75 * vcTwo(fc, 1, b0 < full ? 20 : 40, b0, dmm)
      if (!wP || v / cap > wP.ur) wP = { ur: v / cap, v, cap, combo: lr.c.id, R, b0, edge: b0 < full }
    })
  }
  return wP
}
const capConcreteOk = (r) => r.checks.filter((c) => /pile cap|footing/i.test(c.grp) && /geser|shear|pons|punching|≥ 300|≥ 150/i.test(c.item)).every((c) => c.ok || c.info)
const up = (v, st = 0.05) => Math.ceil(v / st - 1e-9) * st
// ---------------------------------------------------------------- DESAIN KELOMPOK TIANG OTOMATIS (modul berbasis telapak)
// Alur: kapasitas tiang tunggal (tab Tanah) → beban terbesar dari kombinasi ASD → jumlah tiang n (grid nx × ny terkecil yang reaksi tiangnya
// ≤ Qa·Eg, ≥ −Qa tarik, H ≤ Ha) → ukuran cap B × L = (n−1)s + 2ce (≥ denah peralatan) → tebal cap dari geser satu arah, pons kolom & pons tiang.
// o: { m0, combos, I, ctx, crit, rc, prc, minB, minL, fixB?, fixL?, tAuto }
const smaxOf = (I, D, s) => (I.psMax > 0 ? Math.max(I.psMax, s) : Math.max(8 * D, 3.0))
export function autoCap(o) {
  const { m0, combos, I, ctx } = o, ds = ctx.soil
  const sp1 = singlePile(I, ds, m0.Df), D = sp1.D, { s, ce } = spacing(I)
  const asd = combos.filter((c) => c.kind === "ASD"), tf = (o.crit && o.crit.tempFac) ?? 1
  const tB = o.fixB ?? o.minB, tL = o.fixL ?? o.minL, asp = tB / tL
  const cand = []
  // minimal 2 baris di tiap arah: momen dua arah (angin/gempa X & Y) harus dipikul kopel reaksi tiang, bukan jepitan kepala tiang
  for (let nx = 2; nx <= 14; nx++) for (let ny = 2; ny <= 14; ny++) cand.push({ nx, ny, n: nx * ny })
  const dimOf = (c) => [o.fixB ?? Math.max((c.nx - 1) * s + 2 * ce, o.minB), o.fixL ?? Math.max((c.ny - 1) * s + 2 * ce, o.minL)]
  cand.sort((a, b) => a.n - b.n || Math.abs(Math.log(dimOf(a)[0] / dimOf(a)[1] / asp)) - Math.abs(Math.log(dimOf(b)[0] / dimOf(b)[1] / asp)))
  let best = null, last = null, idx = -1
  const tGuess = o.tAuto ? Math.max(0.6, up(D + 0.3)) : m0.t
  for (const c of cand) {
    const [B, Lc] = dimOf(c), g = gridLayout(c.nx, c.ny, B, Lc, ce)
    const smin = Math.min(c.nx > 1 ? g.sx : 99, c.ny > 1 ? g.sy : 99), smax = smaxOf(I, D, s)
    if (smin < 2.5 * D - 1e-9) continue
    if (Math.max(g.sx, g.sy) > smax + 1e-9) continue                     // jarak maksimum: bentang cap/pelat antar tiang wajar (≤ maks(8D; 3 m))
    const m = { ...m0, shape: "rect", B, L: Lc, t: tGuess, Df: Math.max(m0.Df, tGuess), piles: g.piles, pileD: D }
    const W = weights(m, { A: B * Lc }), pg = pileGroup(g.piles)
    const sEg = smin === 99 ? s : smin, Eg = c.n > 1 ? convLab(c.nx, c.ny, D, sEg) : 1
    const pmF = c.n > 1 ? Math.min(pmGroup(c.nx, sEg / D), pmGroup(c.ny, sEg / D)) : 1
    let worst = 0, Pmax = 0, cP = "", gov = ""
    for (const cb of asd) {
      const R = resultant(m, W, cb.vec, cb.fD), pk = pileReact(pg, R), fac = cb.temp ? tf : 1
      const u = [[pk.max / (sp1.Qad * Eg * fac), L("tekan tiang", "pile compression")], [-pk.min / (sp1.Qat * fac), L("tarik tiang", "pile tension")], [pk.H / (sp1.Ha * pmF * fac), L("lateral tiang", "pile lateral")]]
      for (const [v, t] of u) if (v > worst) { worst = v; gov = `${t} (${cb.id})` }
      if (R.P > Pmax) { Pmax = R.P; cP = cb.id }
    }
    idx++
    last = { ...c, B, L: Lc, ...g, smin: sEg, Eg, pmF, m, worst, Pmax, cP, gov: idx === 0 && worst <= 1 ? (c.n > 4 ? `${L(`jarak maks. tiang ≤ ${nf(smaxOf(I, D, s), 2)} m pada denah minimum`, `max. pile spacing ≤ ${nf(smaxOf(I, D, s), 2)} m over minimum footprint`)} (UR ${nf(worst, 2)})` : `${L("jumlah minimum 2 × 2", "minimum 2 × 2")} (UR ${nf(worst, 2)})`) : `${gov} (UR ${nf(worst, 2)})` }
    if (worst <= 1) { best = last; break }
  }
  const pick = best || last
  // tebal cap dari geser & pons (grid kasar selama iterasi)
  let t = o.tAuto ? Math.max(0.5, up(D + 0.2)) : m0.t, r = null, wP = null, tries = 0
  const runT = (tt, grid) => { const mt = { ...pick.m, t: tt, Df: Math.max(m0.Df, tt), grid }; const rr = analyzeFooting(mt, combos, { qa: 1, mu: 0.5 }, o.crit, o.rc, o.prc); return { mt, rr, wp: pilePunch(mt, rr, D, o.rc.fc) } }
  for (; tries < 60; tries++) {
    const x = runT(t, 30); r = x.rr; wP = x.wp
    if (!o.tAuto || (capConcreteOk(r) && (!wP || wP.ur <= 1))) break
    t = Math.round((t + 0.05) * 100) / 100
  }
  // verifikasi dengan grid penuh (hasil akhir), tambah tebal bila perlu
  if (o.tAuto) for (let k = 0; k < 12; k++) { const x = runT(t, undefined); if (capConcreteOk(x.rr) && (!x.wp || x.wp.ur <= 1)) break; t = Math.round((t + 0.05) * 100) / 100 }
  const mFinal = { ...pick.m, t, Df: Math.max(m0.Df, t) }
  return { m: mFinal, sp1, nx: pick.nx, ny: pick.ny, n: pick.n, sx: pick.sx, sy: pick.sy, smin: pick.smin, Eg: pick.Eg, worst: pick.worst, gov: pick.gov, Pmax: pick.Pmax, cP: pick.cP, nAx: pick.Pmax / sp1.Qad, ok: !!best, t, s, ce }
}
// ---------------------------------------------------------------- UKURAN TELAPAK OTOMATIS (pondasi dangkal)
// Alur: qa dari tab Tanah (tergantung B, L, Df) → telapak terkecil (tambah δ pada denah minimum) yang memenuhi tekanan ≤ qa, kontak, guling, geser
// → tebal dari geser satu arah & pons. o: { m0, combos, qaFn(B, L, Df), mu, crit, rc, prc, minB, minL, tAuto }
export function autoFoot(o) {
  const tryD = (dl, t) => {
    const B = up(o.minB + dl), Lc = up(o.minL + dl), m = { ...o.m0, B, L: o.m0.shape === "rect" ? Lc : B, t, Df: Math.max(o.m0.Df, t), grid: 30 }
    const qa = o.qaFn(B, m.L, m.Df), r = analyzeFooting(m, o.combos, { qa, mu: o.mu }, o.crit, o.rc, o.prc)
    return { ok: r.checks.filter((c) => /Geoteknik|Geotechnical/.test(c.grp)).every((c) => c.ok || c.info), m, qa, r }
  }
  const t0 = o.tAuto ? Math.max(0.4, o.m0.t * 0 + 0.4) : o.m0.t
  let dl = 0, hit = null
  for (; dl <= 25; dl += 0.25) { const x = tryD(dl, t0); if (x.ok) { hit = x; break } }
  if (hit) for (let k = 0; k < 5 && dl > 0; k++) { const x = tryD(Math.max(dl - 0.05, 0), t0); if (!x.ok) break; dl = Math.max(dl - 0.05, 0); hit = x }
  if (!hit) hit = tryD(Math.min(dl, 25), t0)
  let t = t0, r = hit.r
  const concOk = (rr) => rr.checks.filter((c) => /footing|telapak/i.test(c.grp) && /geser|shear|pons|punching|≥ 150/i.test(c.item)).every((c) => c.ok || c.info)
  if (o.tAuto) for (let k = 0; k < 80; k++) {
    const x = tryD(dl, t); r = x.r
    if (!x.ok) { dl += 0.1; continue }                          // telapak lebih tebal = lebih berat: perbesar denah bila geoteknik tidak lagi memenuhi
    if (concOk(r)) { hit = x; break }
    t = Math.round((t + 0.05) * 100) / 100
  }
  // verifikasi grid penuh
  const full = (dd, tt) => { const B = up(o.minB + dd), Lc = up(o.minL + dd), m = { ...o.m0, B, L: o.m0.shape === "rect" ? Lc : B, t: tt, Df: Math.max(o.m0.Df, tt) }; const qa = o.qaFn(B, m.L, m.Df), rr = analyzeFooting(m, o.combos, { qa, mu: o.mu }, o.crit, o.rc, o.prc); return { ok: rr.checks.filter((c) => /Geoteknik|Geotechnical/.test(c.grp)).every((c) => c.ok || c.info), m, qa, r: rr } }
  for (let k = 0; k < 15; k++) { const x = full(dl, t); hit = x; if (!x.ok) { dl += 0.1; continue } if (!o.tAuto || concOk(x.r)) break; t = Math.round((t + 0.05) * 100) / 100 }
  const gch = hit.r.checks.filter((c) => /Geoteknik|Geotechnical/.test(c.grp) && !c.info), gw = gch.reduce((a, b) => (!a || b.ur > a.ur ? b : a), null)
  const gov = dl < 1e-9 ? `${o.minTxt || L("ukuran minimum denah peralatan", "minimum equipment footprint")}${gw ? ` (UR ${L("geoteknik", "geotech.")} ${nf(gw.ur, 2)})` : ""}` : gw ? `${gw.item} (UR ${nf(gw.ur, 2)})` : ""
  return { m: { ...hit.m, t, Df: Math.max(o.m0.Df, t), grid: undefined }, qa: hit.qa, ok: !!hit, t, B: hit.m.B, L: hit.m.L, gov }
}
const edgeDist = (shape, B, Lf, p) => {
  if (shape === "rect") return Math.min(B / 2 - Math.abs(p.x), Lf / 2 - Math.abs(p.y))
  if (shape === "circle") return B / 2 - Math.hypot(p.x, p.y)
  return B / 2 - Math.max(Math.abs(p.x), Math.abs(p.y), (Math.abs(p.x) + Math.abs(p.y)) / Math.SQRT2)
}
const distinct = (a) => [...new Set(a.map((v) => Math.round(v * 1000)))].length

// ---------------------------------------------------------------- properti & kapasitas satu tiang
export function pileProps(s, ds, z0) {
  const D = s.pD / 1000, bored = s.pk === "bored"
  const ax = pileAxial(ds, { D, t: (s.pt || 0) / 1000, Lp: s.pL, open: s.popen, method: s.pmeth, kind: s.pk, z0 })
  let EI, Ap, Ep, sec = null, rc = null
  if (bored) {
    Ep = 4700 * Math.sqrt(s.pfc) * 1000; Ap = Math.PI * D * D / 4
    EI = 0.7 * Ep * Math.PI * D ** 4 / 64                                              // penampang retak ≈ 0,7Ig (SNI 2847 Tabel 6.6.3.1.1)
    const ab = barA(s.pdb), Dc = s.pD - 2 * (75 + 13 + s.pdb / 2)
    rc = { poly: circlePoly(s.pD, 40), bars: barsOnCircle(Math.round(s.pn), Dc, ab), Ast: Math.round(s.pn) * ab, Dc }
    const c0 = pmCapacity(rc.poly, rc.bars, s.pfc, 420, 0)
    rc.My0 = c0.ok ? c0.phiMn / 0.9 : 0
  } else {
    sec = pipeCapacity(s.pD, s.pt, s.pFy, 1000, 1000)
    Ep = E_STEEL * 1000; Ap = sec.A * 1e-6
    EI = E_STEEL * 1000 * sec.I * 1e-12
  }
  return { D, bored, ax, EI, Ap: bored ? Ap : Math.PI * D * D / 4, ApSt: Ap, Ep: bored ? Ep : Ep * Ap / (Math.PI * D * D / 4), sec, rc, z0 }
}

// kapasitas kelompok & lateral (Winkler kepala jepit, Broms umum, titik jepit Davisson–Robinson)
function lateral(s, ds, pp, m) {
  const D = pp.D, n = m.piles.length, z0 = pp.z0
  const nx = m.eqGrid ? m.eqGrid[0] : distinct(m.piles.map((p) => p.x)), ny = m.eqGrid ? m.eqGrid[1] : distinct(m.piles.map((p) => p.y))
  const Eg = n > 1 ? convLab(nx, ny, D, s.psx) : 1
  const Qac = pp.ax.Qc * Eg / s.pfsC, Qat = pp.ax.Qt / s.pfsT
  const lay = pileLayers(ds, z0), gw = Math.max(ds.gwt - z0, 0), P0 = profile(lay, gw)
  const pmF = n > 1 ? Math.min(pmGroup(Math.max(nx, 1), s.psx / D), pmGroup(Math.max(ny, 1), s.psx / D)) : 1
  const kD = (z) => { const l = P0.at(z); return pmF * (l.type === "clay" ? 67 * l.cu : nhAuto(l.phi, z > gw) * z) }
  const uH = winkler(pp.EI, 0, s.pL, kD, "fixed", 1, 0)
  const top = lay[0], nhT = top.type === "sand" ? nhAuto(top.phi, gw <= 1) * pmF : 0
  const Tch = top.type === "sand" ? Math.pow(pp.EI / nhT, 0.2) : 0, Rch = top.type === "clay" ? Math.pow(pp.EI / (67 * top.cu * pmF), 0.25) : 0
  const Lf = top.type === "sand" ? 1.8 * Tch : 1.4 * Rch
  const My = pp.bored ? pp.rc.My0 : pp.sec.Mp
  const br = bromsGeneral(lay, gw, D, s.pL, 0, My, pmF), Hal = br.fixed / s.pfsL
  return { nx, ny, Eg, Qac, Qat, lay, gw, pmF, uH, Tch, Rch, Lf, br, Hal }
}
const groupDims = (m, D) => { const xs = m.piles.map((p) => p.x), ys = m.piles.map((p) => p.y); return [Math.max(...xs) - Math.min(...xs) + D, Math.max(...ys) - Math.min(...ys) + D] }
// Kekakuan kelompok tiang (indikatif, untuk pondasi mesin): vertikal dari penurunan tiang tunggal (Vesic) dengan rasio kelompok √(Bg/D),
// horizontal dari Winkler kepala jepit (dengan p-multiplier), rocking & torsi dari penjumlahan per tiang. Q = beban statik layan.
export function groupStiffness(s, ctx, m, Q) {
  const ds = ctx.soil, pp = pileProps(s, ds, m.Df), lt = lateral(s, ds, pp, m), n = m.piles.length
  const [Bg, Lg] = groupDims(m, pp.D)
  const st = settleGroup(ds, { D: pp.D, Lp: s.pL, Ap: pp.ApSt, Ep: pp.bored ? pp.Ep : E_STEEL * 1000, n, Bg, Lg, Q: Math.max(Q, n), Qb: pp.ax.Qb, Qu: pp.ax.Qc, qb: pp.ax.q, z0: m.Df, driven: !pp.bored }, ctx.settle)
  return { ...pileStiffness({ st, Bg, D: pp.D, n, uH: lt.uH }, m), pp, lt }
}

// ---------------------------------------------------------------- analisis kelompok tiang di bawah telapak (hasil footing.js dengan m.piles)
// r: hasil analyzeFooting (piled), m: model telapak, s: masukan modul, ctx: { soil, settle }, crit: { tempFac }
export function deepFooting(s, ctx, m, r, crit = {}) {
  const ds = ctx.soil, z0 = m.Df, pp = pileProps(s, ds, z0), D = pp.D, n = m.piles.length
  const g = { checks: [], warn: [] }
  const gG = L("Tiang — geoteknik (ASD)", "Piles — geotechnical (ASD)"), gS = L("Tiang — struktur (LRFD)", "Piles — structural (LRFD)"), gC = L("Pile cap — pons tiang (LRFD)", "Pile cap — pile punching (LRFD)")
  const { nx, ny, Eg, Qac, Qat, lay, gw, pmF, uH, Tch, Rch, Lf, br, Hal } = lateral(s, ds, pp, m)
  // ASD
  const tf = crit.tempFac ?? 1
  const rows = r.asd.map((a) => { const fac = a.c.temp ? tf : 1; return { a, fac, y: a.pk.H * uH.y0 * 1000, okC: a.pk.max <= Qac * fac + 1e-9, okT: a.pk.min >= -Qat * fac - 1e-9, okH: a.pk.H <= Hal * fac + 1e-9 } })
  const W = (f) => rows.reduce((x, y) => (f(y) > f(x) ? y : x), rows[0])
  if (rows.length) {
    const wC = W((x) => x.a.pk.max / x.fac), wT = W((x) => -x.a.pk.min / x.fac), wH = W((x) => x.a.pk.H / x.fac), wY = W((x) => x.y)
    g.checks.push(chk(gG, L(`Tekan per tiang ≤ Qa (${n} tiang, Eg ${nf(Eg, 2)})`, `Compression per pile ≤ Qa (${n} piles, Eg ${nf(Eg, 2)})`), "SNI 8460:2017 §10", wC.a.pk.max, Qac * wC.fac, "F", { note: wC.a.c.id, d: 1 }))
    if (wT.a.pk.min < 0) g.checks.push(chk(gG, L("Tarik (cabut) per tiang ≤ Qa tarik", "Tension (uplift) per pile ≤ Qa tension"), "SNI 8460:2017", -wT.a.pk.min, Qat * wT.fac, "F", { note: wT.a.c.id, d: 1 }))
    else g.checks.push(chk(gG, L("Tidak ada tiang tertarik (semua kombinasi ASD)", "No pile in tension (all ASD combinations)"), "—", 0, Qat, "F", { info: true, d: 1 }))
    g.checks.push(chk(gG, L("Lateral per tiang ≤ Hu/FS (Broms, kepala jepit)", "Lateral per pile ≤ Hu/FS (Broms, fixed head)"), "Broms (1964)", wH.a.pk.H, Hal * wH.fac, "F", { note: wH.a.c.id, d: 2 }))
    g.checks.push(chk(gG, L("Defleksi lateral kepala tiang (layan)", "Pile-head lateral deflection (service)"), L("kriteria proyek", "project criteria"), wY.y, s.pyAllow, "mm", { note: wY.a.c.id, d: 1 }))
    Object.assign(g, { wC, wT, wH })
  }
  if (n > 1) g.checks.push(chk(gG, L("Jarak tiang ≥ 2,5D", "Pile spacing ≥ 2.5D"), "SNI 8460 / AASHTO", s.psx / D, 2.5, "D", { mode: "ge", d: 2 }))
  const minEdge = Math.min(...m.piles.map((p) => edgeDist(m.shape, m.B, m.L, p)))
  g.checks.push(chk(gG, L("Tepi cap dari sisi tiang ≥ 150 mm", "Cap edge beyond pile face ≥ 150 mm"), "PIP STC01015 / IBC 1810", (minEdge - D / 2) * 1000, 150, "mm", { mode: "ge", d: 0 }))
  // struktur tiang (LRFD) & pons tiang pada cap
  let wS = null, wP = null
  const dmm = r.d, dm = dmm / 1000, fcCap = ctx.capFc || 30
  for (const lr of r.lrfd) {
    if (!lr.pk) continue
    const Hp = lr.pk.H, Mu = Hp * Math.max(uH.Mmax, Math.abs(uH.Mhead)), Pc = Math.max(lr.pk.max, 0), Tu = Math.max(-lr.pk.min, 0)
    let ur, info
    if (pp.bored) {
      const cP = pmCapacity(pp.rc.poly, pp.rc.bars, s.pfc, 420, Pc), cT = Tu > 0 ? pmCapacity(pp.rc.poly, pp.rc.bars, s.pfc, 420, -Tu) : null
      ur = Math.max(cP.ok ? Mu / Math.max(cP.phiMn, 1e-9) : 99, cT ? (cT.ok ? Mu / Math.max(cT.phiMn, 1e-9) : 99) : 0, Pc / cP.phiPmax)
      info = { Pu: Pc, Tu, Mu, cap: cP.phiMn }
    } else {
      const Le = Math.max(Lf, 0.5), cs = pipeCapacity(s.pD, s.pt, s.pFy, 1.2 * Le * 1000, Le * 1000)
      const Pe = Math.PI ** 2 * pp.EI / (1.2 * Le) ** 2, B1 = Pc < Pe ? 1 / (1 - Pc / Pe) : 99
      ur = Math.max(h1(Pc, cs.phiPn, B1 * Mu, cs.phiMn), Tu > 0 ? h1(Tu, cs.phiPt, Mu, cs.phiMn) : 0, Hp / cs.phiVn)
      info = { Pu: Pc, Tu, Mu, cap: cs.phiMn, B1 }
    }
    if (!wS || ur > wS.ur) wS = { ur, combo: lr.c.id, ...info }
  }
  wP = pilePunch(m, r, D, fcCap)
  if (wS) g.checks.push(chk(gS, pp.bored ? L(`Tiang bor Ø${nf(s.pD, 0)}: P–M (${Math.round(s.pn)} D${s.pdb}), Mu = H·Mmaks Winkler`, `Bored pile Ø${nf(s.pD, 0)}: P–M (${Math.round(s.pn)} D${s.pdb}), Mu = H·Mmax Winkler`)
    : L(`Pipa Ø${nf(s.pD, 1)}×${nf(s.pt, 1)}: H1-1 (tekan/tarik + lentur, B1) & geser`, `Pipe Ø${nf(s.pD, 1)}×${nf(s.pt, 1)}: H1-1 (compression/tension + flexure, B1) & shear`), pp.bored ? "SNI 2847 §22.4" : "AISC 360-16 §H1, G5", wS.ur, 1, "", { note: wS.combo, d: 3 }))
  if (wP) g.checks.push(chk(gC, L(`Pons tiang ${wP.edge ? "tepi " : ""}menembus pile cap (b0 = ${nf(wP.b0, 0)} mm)`, `Punching of ${wP.edge ? "edge " : ""}pile through cap (b0 = ${nf(wP.b0, 0)} mm)`), "SNI 2847 §22.6, §13.4.2", wP.v, wP.cap, "MPa", { note: wP.combo, d: 3 }))
  // penurunan kelompok (A1 = D + Do, beban tetap)
  const a1 = r.asd.find((a) => a.c.base === "A1") || r.asd[0]
  const [Bg, Lg] = groupDims(m, D)
  const st = settleGroup(ds, { D, Lp: s.pL, Ap: pp.ApSt, Ep: pp.bored ? pp.Ep : E_STEEL * 1000, n, Bg, Lg, Q: a1 ? a1.R.P : 0, Qb: pp.ax.Qb, Qu: pp.ax.Qc, qb: pp.ax.q, z0, driven: !pp.bored }, ctx.settle)
  Object.assign(g, { pp, ax: pp.ax, Eg, Qac, Qat, Hal, br, uH, Lf, Tch, Rch, pmF, n, nx, ny, Bg, Lg, st, wS, wP, rows, a1, D, minEdge })
  return g
}

// ---------------------------------------------------------------- pelat tangki di atas tiang (pelat lingkaran Ø Ds, beban dari tank.js)
// tot(c) → { P, M, V } di dasar pelat; I: masukan tangki (sh, proj, fc, fy, cover, db, D, colB, nCol)
// Tiang disusun RADIAL (cincin konsentris di bawah shell → pusat). pLay "auto": jarak s terbesar (jumlah tiang terkecil) yang reaksinya memenuhi;
// "grid"/manual: s = psx, tepi = pce.
export function piledSlab(I, Tk, combos, tot, ctx) {
  const Ds = I.D + 2 * I.proj, D = I.pD / 1000, sp = spacing(I), auto = I.pLay !== "grid"
  const ce = auto ? sp.ce : I.pce, sp1 = singlePile(I, ctx.soil, I.sh)
  const asdC = combos.filter((c) => c.kind === "ASD"), tf = I.tempFac ?? 1
  const evalLay = (lay, sv) => {
    const n = lay.piles.length, Sx2 = lay.piles.reduce((a, p) => a + p.x * p.x, 0), k = Math.max(1, Math.round(Math.sqrt(n))), Eg = n > 1 ? convLab(k, k, D, sv) : 1
    let worst = 0, Pmax = 0, cP = ""
    for (const c of asdC) { const t = tot(c), fac = c.temp ? tf : 1, mx = t.P / n + (Sx2 > 0 ? Math.abs(t.M) * (Ds / 2 - ce) / Sx2 : 0), mn = t.P / n - (Sx2 > 0 ? Math.abs(t.M) * (Ds / 2 - ce) / Sx2 : 0)
      worst = Math.max(worst, mx / (sp1.Qad * Eg * fac), -mn / (sp1.Qat * fac)); if (t.P > Pmax) { Pmax = t.P; cP = c.id } }
    return { worst, Pmax, cP, Eg }
  }
  let lay, sUse, ev
  if (auto) {
    for (let sv = Math.max(sp.s, up(Ds / 2 - ce)); sv >= sp.s - 1e-9; sv = Math.round((sv - 0.05) * 100) / 100) {
      lay = ringLayout(Ds, ce, sv); sUse = sv; ev = evalLay(lay, sv)
      if (ev.worst <= 1) break
    }
  } else { sUse = I.psx; lay = ringLayout(Ds, ce, sUse); ev = evalLay(lay, sUse) }
  const nP = lay.piles.length, kq = Math.max(1, Math.round(Math.sqrt(nP)))
  const m = { shape: "circle", B: Ds, L: Ds, Df: I.sh, t: I.sh, piles: lay.piles, rings: lay.rings, eqGrid: [kq, kq] }
  I = { ...I, psx: sUse, pce: ce }
  const n = m.piles.length, Sx2 = m.piles.reduce((a, p) => a + p.x * p.x, 0)
  const react = (t) => { const Pi = m.piles.map((p) => t.P / n + (Sx2 > 0 ? t.M * p.x / Sx2 : 0)); return { Pi, max: Math.max(...Pi), min: Math.min(...Pi), H: t.V / n, P: t.P } }
  const asd = combos.filter((c) => c.kind === "ASD").map((c) => { const t = tot(c); return { c, R: { P: t.P, Mx: 0, My: t.M, H: t.V }, pk: react(t) } })
  const lrfd = combos.filter((c) => c.kind === "LRFD").map((c) => { const t = tot(c); return { c, R: { P: t.P, Mx: 0, My: t.M, H: t.V }, pk: react(t) } })
  const h = I.sh * 1000, d = h - I.cover - I.db
  const r = { asd, lrfd, d }
  const out = deepFooting(I, { ...ctx, capFc: I.fc }, m, r, { tempFac: I.tempFac })
  Object.assign(out, { sp1, sUse, ce, rings: lay.rings, nAx: ev.Pmax / sp1.Qad, Pmax: ev.Pmax, cP: ev.cP, autoOk: ev.worst <= 1 })
  // lentur pelat datar terbalik (metode desain langsung, panel s × s): Mo = wu·s·ln²/8; lajur kolom s/2
  const s = I.psx, ln = Math.max(s - 0.89 * D, 0.3)
  let Rm = 0, cR = ""
  for (const lr of lrfd) if (lr.pk.max > Rm) { Rm = lr.pk.max; cR = lr.c.id }
  const wu = Rm / (s * s), Mo = wu * s * ln * ln / 8
  const Mneg = 0.65 * 0.75 * Mo / (s / 2), Mpos = 0.35 * 0.6 * Mo / (s / 2)
  const smax = Math.min(3 * h, 450), half = 0.5 * rhoTS(I.fy) * 1000 * h
  const top = pickBars(Math.max(asFlex(Mneg, 1000, d, I.fc, I.fy).As || 0, half), smax, I.db), bot = pickBars(Math.max(asFlex(Mpos, 1000, d, I.fc, I.fy).As || 0, half), smax, I.db)
  const Vu = wu * Math.max(s / 2 - D / 2 - d / 1000, 0)
  const gS = L("Pelat di atas tiang (LRFD)", "Slab on piles (LRFD)")
  out.checks.push(chk(gS, L(`Lentur negatif di atas tiang (atas, ${top.txt} dua arah)`, `Negative moment over piles (top, ${top.txt} both ways)`), L("SNI 2847 §8.10 (metode desain langsung)", "SNI 2847 §8.10 (direct design)"), Mneg, phiMn(top.As, 1000, d, I.fc, I.fy), "Mm", { note: cR, d: 1 }))
  out.checks.push(chk(gS, L(`Lentur positif lapangan (bawah, ${bot.txt} dua arah)`, `Positive span moment (bottom, ${bot.txt} both ways)`), L("SNI 2847 §8.10", "SNI 2847 §8.10"), Mpos, phiMn(bot.As, 1000, d, I.fc, I.fy), "Mm", { note: cR, d: 1 }))
  out.checks.push(chk(gS, L("Geser satu arah pada d dari muka tiang", "One-way shear at d from pile face"), "SNI 2847 §22.5", Vu, 0.75 * vcOne(I.fc, 1, top.As / (1000 * d), d) * d, "W", { note: cR, d: 1 }))
  out.checks.push(chk(gS, L("Tebal pelat d ≥ 300 mm (pile cap)", "Slab depth d ≥ 300 mm (pile cap)"), "SNI 2847 §13.4.2.1", d, 300, "mm", { mode: "ge", d: 0 }))
  return { ...out, kind: "piled", m, asd, lrfd, Ds, d, top, bot, Mneg, Mpos, Vu, wu, geo: { A: Math.PI * Ds * Ds / 4 }, Wsl: Math.PI * Ds * Ds / 4 * I.sh * GAMMA_C }
}

// ---------------------------------------------------------------- kekakuan kelompok tiang (indikatif) untuk pondasi mesin
export function pileStiffness(g, m) {
  const s1 = g.st.s1 > 0 ? g.st.s1 : 1e-3, k1 = g.st.Qpile / s1, Rs = Math.sqrt(Math.max(g.Bg, g.D) / g.D)
  const kz = g.n * k1 / Rs, kx = g.n / Math.max(g.uH.y0, 1e-9)
  const kp = m.piles.reduce((a, p) => a + k1 / Rs * p.y * p.y, 0), kq = m.piles.reduce((a, p) => a + k1 / Rs * p.x * p.x, 0)
  const kt = m.piles.reduce((a, p) => a + (1 / Math.max(g.uH.y0, 1e-9)) * (p.x * p.x + p.y * p.y), 0)
  return { kz, kx, kp: Math.max(kp, kq), kt, k1, Rs }
}

// ---------------------------------------------------------------- tabel, ringkasan & langkah perhitungan
export function deepTables(s, g) {
  const uF = uName("F"), uQ = uName("Q"), F = (v, d = 1) => nf(toDisp("F", v), d)
  const ax = g.ax, t = []
  t.push({ title: L("Kapasitas aksial tiang dari data tanah", "Pile axial capacity from soil data"), cols: [L("Komponen", "Component"), L("Nilai", "Value"), L("Satuan", "Unit")], rows: [
    [L("Metode", "Method"), AXIAL_METHOD()[s.pmeth], ""], [L("Kepala tiang (dasar cap) z0 / ujung", "Pile head (cap base) z0 / tip"), `${nf(ax.z0, 2)} / ${nf(ax.tip.z, 2)}`, "m"],
    [L("Gesek selimut Qs", "Shaft friction Qs"), toDisp("F", ax.Qso), uF], ...(ax.Qsi ? [[L("Gesek dalam Qs,in", "Inner friction Qs,in"), toDisp("F", ax.Qsi), uF]] : []),
    [L("Tahanan ujung satuan q", "Unit end bearing q"), toDisp("Q", ax.q), uQ], [L("Tahanan ujung Qb", "End bearing Qb"), toDisp("F", ax.Qb), uF], [L("Qu tekan", "Qu compression"), toDisp("F", ax.Qc), uF],
    [L("Qu tarik (+ berat tiang)", "Qu tension (+ pile weight)"), toDisp("F", ax.Qt), uF], [L("Efisiensi kelompok Eg (Converse–Labarre)", "Group efficiency Eg (Converse–Labarre)"), g.Eg, "–"],
    [`Qa ${L("tekan", "comp.")} = Qu·Eg/${nf(s.pfsC, 1)}`, toDisp("F", g.Qac), uF], [`Qa ${L("tarik", "tension")} = Qu,t/${nf(s.pfsT, 1)}`, toDisp("F", g.Qat), uF],
    [`Ha = Hu/${nf(s.pfsL, 1)} (Broms ${L("jepit", "fixed")})`, toDisp("F", g.Hal), uF], [L("Defleksi kepala per 1 kN (Winkler jepit)", "Head deflection per 1 kN (fixed Winkler)"), g.uH.y0 * 1000, "mm"],
    [L("Titik jepit Lf (Davisson–Robinson)", "Fixity depth Lf (Davisson–Robinson)"), g.Lf, "m"]], dec: [null, 3, null], align: ["l", "r", "l"] })
  t.push({ title: L("Reaksi tiang per kombinasi ASD (cap kaku)", "Pile reactions per ASD combination (rigid cap)"), cols: [L("Kode", "Code"), L("Rumus", "Formula"), `P ${L("total", "total")} (${uF})`, `P ${L("maks", "max")} (${uF})`, `P ${L("min", "min")} (${uF})`, `H/${L("tiang", "pile")} (${uF})`, "y (mm)", "Status"],
    rows: g.rows.map((x) => { const ok = x.okC && x.okT && x.okH; return { cells: [x.a.c.id, x.a.c.formula, toDisp("F", x.a.pk.P), toDisp("F", x.a.pk.max), toDisp("F", x.a.pk.min), toDisp("F", x.a.pk.H), x.y, ok ? "OK" : "NOT OK"], cls: ok ? "" : "bad" } }),
    dec: [null, null, 1, 1, 1, 2, 2, null], align: ["l", "l", "r", "r", "r", "r", "r", "l"] })
  return t
}
export function deepKv(s, g) {
  return { title: L("Pondasi dalam (tiang)", "Deep foundation (piles)"), rows: [[L("Jenis tiang", "Pile type"), s.pk === "bored" ? `${L("Bor beton", "Bored")} Ø${nf(s.pD, 0)} mm, fc' ${s.pfc} MPa, ${Math.round(s.pn)} D${s.pdb}` : `${L("Pipa baja", "Steel pipe")} Ø${nf(s.pD, 1)} × ${nf(s.pt, 1)} mm, Fy ${s.pFy} MPa, ${s.popen ? L("ujung terbuka", "open end") : L("ujung tertutup", "closed end")}`],
    [L("Panjang di bawah cap", "Length below cap"), s.pL, "m", 2], [L("Jumlah & tata letak", "Number & layout"), `${g.n} (${g.nx} × ${g.ny} grid, s ${nf(s.psx, 2)} m, ce ${nf(s.pce, 2)} m)`],
    [L("Metode aksial", "Axial method"), AXIAL_METHOD()[s.pmeth]], ["FS " + L("tekan/tarik/lateral", "comp./tension/lateral"), `${s.pfsC} / ${s.pfsT} / ${s.pfsL}`]] }
}
export function deepSteps(s, g) {
  const F = (v) => `${nf(toDisp("F", v), 1)} ${uName("F")}`, ax = g.ax
  const rows = [
    [L("Luas ujung Ag", "Tip area Ag"), "π·D²/4", `D = ${nf(g.D, 3)} m`, `${nf(ax.Ag, 4)} m²`],
    [L("Gesek selimut", "Shaft friction"), s.pmeth === "spt" ? (s.pk === "bored" ? "fs = N60 ≤ 70 kPa (pasir); α·cu (lempung)" : "fs = 2·N60 ≤ 100 kPa (pasir); α·cu (lempung)") : s.pmeth === "cpt" ? "fs = qc/α_LCPC ≤ fs,maks" : (s.pk === "bored" ? "fs = 0,55cu; β·σ'v (β = 1,5 − 0,245√z)" : "fs = α·cu; K·σ'v·tan(φ − 5°) ≤ flim"), `z = ${nf(ax.z0, 2)} … ${nf(ax.tip.z, 2)} m`, F(ax.Qso)],
    [L("Tahanan ujung satuan", "Unit end bearing"), s.pmeth === "spt" ? "q = 40·N60·L/D ≤ 400·N60 (pancang); 9cu" : s.pmeth === "cpt" ? "q = kc·qc" : "q = Nq·σ'v ≤ qlim; 9cu", `${L("lapis ujung", "tip layer")}: ${ax.tip.type}`, `${nf(toDisp("Q", ax.q), 0)} ${uName("Q")}`],
    ["Qu", "Qs + q·Ag", "", F(ax.Qc)], ["Eg", "1 − θ·[(n−1)m + (m−1)n]/(90·m·n), θ = atan(D/s)", `m ${g.nx}, n ${g.ny}, s ${nf(s.psx, 2)}`, nf(g.Eg, 3)],
    ["Qa", "Qu·Eg/FS", `FS ${s.pfsC}`, F(g.Qac)], ["Pi", "P/n ± My·x/Σx² ± Mx·y/Σy²", `n = ${g.n}`, g.wC ? `${L("maks", "max")} ${F(g.wC.a.pk.max)} (${g.wC.a.c.id})` : "–"],
    [L("Lateral", "Lateral"), "Hu Broms (jepit) / FS", `FS ${s.pfsL}`, F(g.Hal)],
  ]
  const st = g.st, srows = [
    [L("Beban layan (A1)", "Service load (A1)"), "Q = D + Do + berat cap", "", F(g.a1 ? g.a1.R.P : 0)],
    [L("Pemendekan elastis", "Elastic shortening"), "se = (Qp + 0,5Qs)·L/(Ap·Ep)", `Qp ${nf(st.Qp, 1)}, Qs ${nf(st.Qs, 1)} kN`, `${nf(st.se * 1000, 2)} mm`],
    [L("Rakit ekuivalen", "Equivalent raft"), st.endB ? L("di ujung tiang", "at pile tip") : "z = z0 + 2L/3, 1H:4V", `B×L = ${nf(st.Br, 2)} × ${nf(st.Lr, 2)} m @ z ${nf(st.zr, 2)} m`, `q = ${nf(st.qnet, 1)} kPa`],
    [L("Penurunan rakit (segera + konsolidasi)", "Raft settlement (immediate + consolidation)"), "Steinbrenner + Terzaghi", st.raft ? `si ${nf(st.raft.si * 1000, 1)} + sc ${nf(st.raft.sc * 1000, 1)} mm` : st.error || "", st.raft ? `${nf(st.raft.s_life * 1000, 1)} mm` : "–"],
    [L("Total kelompok", "Group total"), "se + s,rakit", "", `${nf(st.total * 1000, 1)} mm`], [L("Pembanding Vesic", "Vesic comparison"), "sg = s1·√(Bg/D)", `s1 ${nf(st.s1 * 1000, 2)} mm`, `${nf(st.sgV * 1000, 1)} mm`]]
  return [{ h: L("Pondasi dalam — kapasitas & reaksi tiang", "Deep foundation — pile capacity & reactions"), rows }, { h: L("Pondasi dalam — penurunan kelompok tiang", "Deep foundation — pile group settlement"), rows: srows }]
}

// ---------------------------------------------------------------- penurunan → blok hasil untuk modul (dangkal / dalam)
export function settleOf(kind, ctx, data, allowMm, label, mod) {
  const o = ctx.settle || {}
  const grp = L("Penurunan (data tanah → tab Penurunan)", "Settlement (soil data → Settlement tab)")
  if (kind === "deep") {
    const st = data.st, allow = allowMm > 0 ? allowMm : (o.allowDeep ?? 25)
    const check = chk(grp, L(`Penurunan kelompok tiang (${nf(o.life ?? 20, 0)} th) ≤ izin`, `Pile group settlement (${nf(o.life ?? 20, 0)} yr) ≤ allowable`), L("SNI 8460:2017 §10 · rakit ekuivalen", "SNI 8460:2017 §10 · equivalent raft"), st.total * 1000, allow, "mm",
      { d: 1, note: `se ${nf(st.se * 1000, 1)} + si ${nf(st.si * 1000, 1)} + sc ${nf(st.sc * 1000, 1)} mm` })
    return { kind, label, mod, allow, life: o.life ?? 20, s: st.total * 1000, si: (st.se + st.si) * 1000, sc: st.sc * 1000, check, st, group: data.group }
  }
  const r = settleShallow(ctx.soil, data, o), allow = allowMm > 0 ? allowMm : (o.allow ?? 50)
  if (r.error) return { kind, label, mod, allow, life: o.life ?? 20, error: r.error, check: chk(grp, L("Penurunan pondasi", "Foundation settlement"), "SNI 8460:2017", 0, 1, "", { info: true, note: r.error }), foot: data }
  const x = r.res
  const check = chk(grp, L(`Penurunan total (${nf(o.life ?? 20, 0)} th) ≤ izin`, `Total settlement (${nf(o.life ?? 20, 0)} yr) ≤ allowable`), "SNI 8460:2017 §9 · Steinbrenner + Terzaghi", x.s_life * 1000, allow, "mm",
    { d: 1, note: `si ${nf(x.si * 1000, 1)} + sc ${nf(x.sc * 1000, 1)} mm` })
  return { kind, label, mod, allow, life: o.life ?? 20, s: x.s_life * 1000, si: x.si * 1000, sc: (x.s_life - x.si) * 1000, check, res: x, foot: data }
}
export function settleTable(sb) {
  if (sb.error) return null
  const rows = sb.kind === "deep" ? [
    [L("Pemendekan elastis tiang se", "Pile elastic shortening se"), `${nf(sb.st.se * 1000, 1)} mm`], [L("Rakit ekuivalen", "Equivalent raft"), `${nf(sb.st.Br, 2)} × ${nf(sb.st.Lr, 2)} m @ z = ${nf(sb.st.zr, 2)} m`],
    [L("Segera si (rakit)", "Immediate si (raft)"), `${nf(sb.st.si * 1000, 1)} mm`], [L("Konsolidasi sc (rakit)", "Consolidation sc (raft)"), `${nf(sb.st.sc * 1000, 1)} mm`],
    [L("Total kelompok", "Group total"), `${nf(sb.s, 1)} mm`], [L("Pembanding Vesic", "Vesic comparison"), `${nf(sb.st.sgV * 1000, 1)} mm`], [L("Batas izin", "Allowable"), `${nf(sb.allow, 0)} mm`]]
    : [[L("Bentuk & ukuran", "Shape & size"), sb.foot.shape === "lingkaran" ? `Ø ${nf(sb.foot.B, 2)} m` : `${nf(sb.foot.B, 2)} × ${nf(sb.foot.L, 2)} m`], [L("Kedalaman dasar Df", "Base depth Df"), `${nf(sb.foot.Df, 2)} m`],
      [L("q bruto / bersih", "Gross / net q"), `${nf(toDisp("Q", sb.res.q_gross), 1)} / ${nf(toDisp("Q", sb.res.q_net), 1)} ${uName("Q")}`], [L("Penurunan segera si", "Immediate settlement si"), `${nf(sb.res.si * 1000, 1)} mm`],
      [L("Konsolidasi sc (+ sekunder)", "Consolidation sc (+ secondary)"), `${nf(sb.sc, 1)} mm`], [L(`Total ${nf(sb.life, 0)} tahun`, `Total ${nf(sb.life, 0)} years`), `${nf(sb.s, 1)} mm`], ["t90", sb.res.t90 == null ? "–" : `${nf(sb.res.t90, 2)} ${L("tahun", "yr")}`], [L("Batas izin", "Allowable"), `${nf(sb.allow, 0)} mm`]]
  return { title: L("Penurunan pondasi (data tanah, terhubung ke tab Penurunan)", "Foundation settlement (soil data, linked to Settlement tab)"), cols: [L("Besaran", "Quantity"), L("Nilai", "Value")], rows, align: ["l", "r"],
    note: L("Profil & parameter tanah dari tab Tanah; umur rencana, metode tegangan dan batas izin dari tab Penurunan.", "Soil profile & parameters from the Soil tab; design life, stress method and limits from the Settlement tab.") }
}

// ---------------------------------------------------------------- paket untuk modul berbasis telapak (vessel, trafo, dinamis)
// res: [{ m, r }] hasil analyzeFooting dengan m.piles
export function deepBundle(s, ctx, res, crit, mod, nm, sAllow) {
  const gs = res.map(({ m, r }) => deepFooting(s, ctx, m, r, crit))
  const lab = (i) => res[i].m.label
  const checks = []
  gs.forEach((g, i) => g.checks.forEach((c) => checks.push(lab(i) ? { ...c, grp: `${c.grp} · ${lab(i)}` } : c)))
  const g0 = gs.reduce((a, b) => (b.wC && (!a.wC || b.wC.a.pk.max > a.wC.a.pk.max) ? b : a), gs[0])
  const settle = settleOf("deep", ctx, { st: g0.st }, sAllow, nm, mod)
  settle.group = { D: g0.D, Lp: s.pL, n: g0.n, Bg: g0.Bg, Lg: g0.Lg, Q: g0.a1 ? g0.a1.R.P : 0, z0: res[0].m.Df, Qb: g0.ax.Qb, Qu: g0.ax.Qc, qb: g0.ax.q, Ap: g0.pp.ApSt, Ep: g0.pp.bored ? g0.pp.Ep : E_STEEL * 1000, driven: !g0.pp.bored }
  checks.push(settle.check)
  const tables = gs.flatMap((g, i) => deepTables(s, g).map((t) => (lab(i) ? { ...t, title: `${t.title} · ${lab(i)}` } : t)))
  const stt = settleTable(settle); if (stt) tables.push(stt)
  const drawings = res.map(({ m }, i) => ({ make: (md) => pilePlan(m, gs[i], palette(md), lab(i) ? `${L("Denah pile cap", "Pile cap plan")} · ${lab(i)}` : undefined), cap: `${L("Denah tiang & reaksi (ASD penentu)", "Pile layout & reactions (governing ASD)")}${lab(i) ? " · " + lab(i) : ""}`, maxH: 300 }))
  drawings.push({ make: (md) => pileSection(res[0].m, s, g0, ctx.soil, palette(md)), cap: L("Potongan tiang & profil tanah (tab Tanah)", "Pile section & soil profile (Soil tab)"), maxH: 300 })
  const uF = uName("F")
  const metrics = [
    { lab: L("Qa tekan / tiang", "Qa compression / pile"), val: toDisp("F", g0.Qac), d: 0, unit: uF },
    { lab: L("P maks / tiang (ASD)", "Max P / pile (ASD)"), val: toDisp("F", g0.wC ? g0.wC.a.pk.max : 0), d: 0, unit: uF },
    { lab: L("Jumlah tiang", "Number of piles"), val: `${gs.reduce((a, g) => a + g.n, 0)} × Ø${nf(s.pD, 0)}` },
    { lab: L("Penurunan kelompok", "Group settlement"), val: settle.s ?? 0, d: 1, unit: "mm" },
  ]
  return { gs, g0, checks, tables, kv: deepKv(s, g0), steps: deepSteps(s, g0), drawings, settle, metrics, draw: { s, D: g0.D, nTot: gs.reduce((a, g) => a + g.n, 0), n: g0.n } }
}
export function shallowSettle(ctx, foot, sAllow) {
  const settle = settleOf("shallow", ctx, foot, sAllow, foot.label, foot.mod)
  return { settle, table: settleTable(settle) }
}

// ---------------------------------------------------------------- ALUR PERHITUNGAN (ditampilkan di atas hasil, ikut lembar hitung & PDF)
const F_ = (v, d = 0) => `${nf(toDisp("F", v), d)} ${uName("F")}`, Q_ = (v, d = 0) => `${nf(toDisp("Q", v), d)} ${uName("Q")}`
const chkSum = (checks) => { const real = checks.filter((c) => !c.info), bad = real.filter((c) => !c.ok).length, g = govern(checks); return { n: real.length, bad, g } }
// o: { sp1, I, P, M, cP, loadSub, n, layout, cap, rebar, checks, settle, auto, nAx }
export function flowDeep(o) {
  const sp = o.sp1, I = o.I, cs = chkSum(o.checks)
  const govN = o.gov ? ` · ${L("penentu", "governing")}: ${o.gov}` : ""
  return [
    { ic: "pile", t: L("Kapasitas tiang tunggal", "Single pile capacity"), v: `Qa ${F_(sp.Qad)}`, f: L("Qa = min(Qu/FS; Pa struktur)", "Qa = min(Qu/FS; structural Pa)"), sub: `${I.pk === "bored" ? L("bor", "bored") : L("pipa", "pipe")} Ø${nf(I.pD, 0)} · L ${nf(I.pL, 1)} m · ${AXIAL_METHOD()[I.pmeth].split(" (")[0]} · ${L("tarik", "tension")} ${F_(sp.Qat)} · ${L("lateral", "lateral")} ${F_(sp.Ha, 1)}${I.pSrc !== "own" ? " · " + L("tab Tanah", "Soil tab") : ""}` },
    { ic: "loads", t: L("Beban struktur atas", "Superstructure loads"), v: `P ${F_(o.P)}`, f: L("P = Σ beban + berat cap & urugan (ASD terbesar)", "P = Σ loads + cap & backfill weight (max ASD)"), sub: `${o.loadSub || ""}${o.cP ? ` · ${o.cP}` : ""}${o.M ? ` · M ${nf(toDisp("M", o.M), 0)} ${uName("M")}` : ""}` },
    { ic: "group", t: L("Kebutuhan tiang", "Required piles"), v: `n = ${o.n}`, f: L("n ≥ P/(Qa·Eg), cek momen: Pi = P/n ± M·x/Σx²", "n ≥ P/(Qa·Eg), moment check: Pi = P/n ± M·x/Σx²"), sub: `P/Qa = ${nf(o.nAx, 2)} → ${o.layout}${o.auto ? govN : " (" + L("manual", "manual") + ")"}` },
    { ic: "found", t: o.capTitle || L("Ukuran pile cap", "Pile cap size"), v: o.cap, f: o.capF || L("B = (nx−1)s + 2ce ≥ denah peralatan; tebal dari geser & pons", "B = (nx−1)s + 2ce ≥ equipment footprint; depth from shear & punching"), sub: o.capSub || "" },
    { ic: "ruler", t: L("Penulangan", "Reinforcement"), v: o.rebar, f: L("As dari Mu (reaksi tiang), ≥ As min", "As from Mu (pile reactions), ≥ As min"), sub: o.rebarSub || "" },
    { ic: "check", t: L("Pemeriksaan", "Checks"), v: cs.bad ? `${cs.bad} ${L("tidak OK", "not OK")}` : `${cs.n}/${cs.n} OK`, f: L("UR = demand/kapasitas ≤ 1", "UR = demand/capacity ≤ 1"), sub: cs.g ? `UR ${L("maks", "max")} ${nf(cs.g.ur, 3)} — ${cs.g.item}` : "", ok: !cs.bad },
    { ic: "settle", t: L("Penurunan", "Settlement"), v: o.settle && o.settle.s != null ? `${nf(o.settle.s, 1)} mm` : "–", f: L("se + si + sc ≤ s izin", "se + si + sc ≤ s allow"), sub: o.settle && o.settle.s != null ? `${L("izin", "allow.")} ${nf(o.settle.allow, 0)} mm` : "", ok: o.settle && o.settle.s != null ? o.settle.s <= o.settle.allow : undefined },
  ]
}
// o: { q (hasil qaFor), P, M, cP, loadSub, A, size, auto, rebar, checks, settle }
export function flowShallow(o) {
  const cs = chkSum(o.checks)
  return [
    { ic: "soil", t: L("Daya dukung izin tanah", "Allowable soil bearing"), v: `qa ${Q_(o.q.qa)}`, f: o.q.src === "soil" ? o.q.r.txt : L("manual", "manual"), sub: o.q.src === "soil" ? `${L("tab Tanah", "Soil tab")} · FS ${nf(o.q.r.FS, 1)} · ${o.q.r.gov}` : L("diisi manual", "entered manually") },
    { ic: "loads", t: L("Beban struktur atas", "Superstructure loads"), v: `P ${F_(o.P)}`, f: L("P = Σ beban + berat pondasi & urugan (ASD terbesar)", "P = Σ loads + foundation & backfill weight (max ASD)"), sub: `${o.loadSub || ""}${o.cP ? ` · ${o.cP}` : ""}${o.M ? ` · M ${nf(toDisp("M", o.M), 0)} ${uName("M")}` : ""}` },
    { ic: "found", t: L("Ukuran telapak", "Footing size"), v: o.size, f: L("A ≥ P/qa, lalu cek eksentrisitas, kontak, guling, geser", "A ≥ P/qa, then eccentricity, contact, overturning, sliding"), sub: `A ${L("perlu", "req.")} ≈ ${nf(o.P / Math.max(o.q.qa, 1), 2)} m² · A ${L("pakai", "used")} ${nf(o.A, 2)} m²${o.sizeNote ? " · " + o.sizeNote : o.auto ? ` · ${L("otomatis", "automatic")}${o.gov ? ` · ${L("penentu", "governing")}: ${o.gov}` : ""}` : " · " + L("manual", "manual")}` },
    { ic: "ruler", t: L("Tebal & penulangan", "Depth & reinforcement"), v: o.rebar, f: L("tebal dari geser satu arah & pons; As dari Mu", "depth from one-way & punching shear; As from Mu"), sub: o.rebarSub || "" },
    { ic: "check", t: L("Pemeriksaan", "Checks"), v: cs.bad ? `${cs.bad} ${L("tidak OK", "not OK")}` : `${cs.n}/${cs.n} OK`, f: L("UR = demand/kapasitas ≤ 1", "UR = demand/capacity ≤ 1"), sub: cs.g ? `UR ${L("maks", "max")} ${nf(cs.g.ur, 3)} — ${cs.g.item}` : "", ok: !cs.bad },
    { ic: "settle", t: L("Penurunan", "Settlement"), v: o.settle && o.settle.s != null ? `${nf(o.settle.s, 1)} mm` : "–", f: L("si + sc ≤ s izin", "si + sc ≤ s allow"), sub: o.settle && o.settle.s != null ? `${L("izin", "allow.")} ${nf(o.settle.allow, 0)} mm` : "", ok: o.settle && o.settle.s != null ? o.settle.s <= o.settle.allow : undefined },
  ]
}
export const flowStep = (flow) => ({ h: L("Alur perhitungan (ringkas)", "Calculation flow (summary)"), rows: flow.map((f, i) => [`${i + 1}. ${f.t}`, f.f || "", f.sub || "", f.v]) })
// beban vertikal ASD terbesar di dasar pondasi (termasuk berat pondasi)
export function maxLoad(rows) {
  let w = null
  for (const a of rows) if (!w || a.R.P > w.R.P) w = a
  return w ? { P: w.R.P, M: Math.hypot(w.R.Mx || 0, w.R.My || 0), cP: w.c.id } : { P: 0, M: 0, cP: "" }
}

// ---------------------------------------------------------------- gambar: denah tiang & reaksi
export function pilePlan(m, g, P, title) {
  const W = 760, H = 520, s = root(W, H, P, L("Denah tiang", "Pile plan"))
  const poly = planPoly(m.shape, m.B, m.L), xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const k = Math.min((W - 220) / (x1 - x0), (H - 120) / (y1 - y0)), cx = (W - 140) / 2 + 20, cy = H / 2 + 14
  const X = (x) => cx + x * k, Y = (y) => cy - y * k
  T(s, 20, 30, title || L("Denah pile cap · reaksi tiang kombinasi ASD penentu", "Pile cap plan · pile reactions, governing ASD combination"), { c: P.ink, fs: 14, b: true })
  s.append(sv("polygon", { points: poly.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" "), fill: P.concL, stroke: P.ink, "stroke-width": 2.5 }))
  for (const p of m.peds || []) {
    if (p.shape === "circle") s.append(sv("circle", { cx: X(p.x), cy: Y(p.y), r: p.bx * k / 2, fill: "none", stroke: P.ink, "stroke-width": 2, "stroke-dasharray": "6 4" }))
    else s.append(sv("rect", { x: X(p.x - p.bx / 2), y: Y(p.y + (p.by ?? p.bx) / 2), width: p.bx * k, height: (p.by ?? p.bx) * k, fill: "none", stroke: P.ink, "stroke-width": 2, "stroke-dasharray": "6 4" }))
  }
  const gv = g.wC ? g.wC.a : null, Qa = g.Qac
  const col = (f) => (f > 1 ? P.bad : f > 0.85 ? P.acc : P.ok)
  m.piles.forEach((p, j) => {
    const R = gv ? gv.pk.Pi[j] : 0, f = R / Qa
    const c = sv("circle", { cx: X(p.x), cy: Y(p.y), r: Math.max(g.D * k / 2, 7), fill: R < 0 ? P.water : col(f), stroke: "#fff", "stroke-width": 2, class: "dz-pop" })
    c.style.setProperty("--i", j); s.append(c)
    if (m.piles.length <= 40) T(s, X(p.x), Y(p.y) - Math.max(g.D * k / 2, 7) - 5, nf(toDisp("F", R), 0), { c: P.ink, fs: 10.5, a: "middle" })
  })
  if (m.piles.length > 1) {
    const sorted = [...m.piles].sort((a, b) => a.y - b.y || a.x - b.x), a = sorted[0], b = sorted.find((q) => Math.abs(q.y - a.y) < 1e-6 && q.x > a.x + 1e-6)
    if (b) dim(s, X(a.x), Y(a.y) + 34, X(b.x), Y(a.y) + 34, `s = ${nf(b.x - a.x, 2)} m`, P)
  }
  const lx = W - 120
  ;[[P.ok, "≤ 0,85 Qa"], [P.acc, "0,85–1,0 Qa"], [P.bad, "> Qa"], [P.water, L("tarik", "tension")]].forEach(([c, t], i) => { s.append(sv("circle", { cx: lx, cy: 80 + i * 26, r: 8, fill: c })); T(s, lx + 14, 84 + i * 26, t, { c: P.ink, fs: 11 }) })
  T(s, 20, H - 16, gv ? `${gv.c.id} · ${g.n} ${L("tiang", "piles")} · P ${L("maks", "max")} ${nf(toDisp("F", gv.pk.max), 0)} / Qa ${nf(toDisp("F", Qa), 0)} ${uName("F")}` : "", { c: P.mut, fs: 12 })
  return s
}
// potongan sederhana: telapak/cap + tiang + lapisan tanah
export function pileSection(m, s0, g, ds, P) {
  const W = 760, H = 460, s = root(W, H, P, L("Potongan pondasi tiang", "Pile foundation section"))
  const Bx = m.B, depth = m.Df + s0.pL + 2, kx = (W - 280) / Math.max(Bx, 1), ky = (H - 70) / depth, cx = (W - 120) / 2, top = 40
  const X = (x) => cx + x * kx, Y = (z) => top + z * ky
  T(s, 20, 26, L("Potongan · tiang & profil tanah", "Section · piles & soil profile"), { c: P.ink, fs: 14, b: true })
  for (const l of ds.layers) { if (l.z0 > depth) break; Rect(s, 20, Y(l.z0), W - 40, (Math.min(l.z1, depth) - l.z0) * ky, l.coh ? P.clay : P.sand, null, { op: 0.45 }); T(s, W - 26, Y(l.z0) + 16, `${l.coh ? "cu " + nf(l.cu, 0) : "φ " + nf(l.phi, 0) + "°"} · N60 ${nf(l.N60, 0)}`, { c: P.ink, fs: 10.5, a: "end" }) }
  if (ds.gwt < depth) { s.append(sv("line", { x1: 20, x2: W - 20, y1: Y(ds.gwt), y2: Y(ds.gwt), stroke: P.water, "stroke-width": 2, "stroke-dasharray": "8 5" })); T(s, 26, Y(ds.gwt) - 5, `▽ MAT ${nf(ds.gwt, 1)} m`, { c: P.water, fs: 11 }) }
  s.append(sv("line", { x1: 20, x2: W - 20, y1: Y(0), y2: Y(0), stroke: P.ink, "stroke-width": 2 }))
  Rect(s, X(-Bx / 2), Y(m.Df - m.t), Bx * kx, m.t * ky, P.conc, P.ink, { sw: 2 })
  const xsU = [...new Set(m.piles.map((p) => Math.round(p.x * 1000) / 1000))]
  xsU.forEach((x, i) => { const r = Rect(s, X(x) - Math.max(g.D * kx, 4) / 2, Y(m.Df), Math.max(g.D * kx, 4), s0.pL * ky, s0.pk === "bored" ? P.concD : P.steel, P.ink, { sw: 1, cls: "dz-grow" }); r.style.setProperty("--i", i) })
  dim(s, X(-Bx / 2) - 30, Y(m.Df), X(-Bx / 2) - 30, Y(m.Df + s0.pL), `Lp = ${nf(s0.pL, 1)} m`, P, 0, true)
  T(s, X(Bx / 2) + 10, Y(m.Df) + 4, `Df ${nf(m.Df, 2)} m`, { c: P.mut, fs: 11 })
  T(s, 20, H - 12, `${g.n} × ${s0.pk === "bored" ? L("bor", "bored") : L("pipa", "pipe")} Ø${nf(s0.pD, 0)} · Qa ${nf(toDisp("F", g.Qac), 0)} ${uName("F")} · ${AXIAL_METHOD()[s0.pmeth]}`, { c: P.mut, fs: 12 })
  return s
}

// ---------------------------------------------------------------- sketsa parameter tipe pondasi
export function skFound(st, o = {}) {
  const P = palette("screen"), W = 620, H = 270, title = isDeep(st) ? L("Pondasi dalam — tiang di bawah pile cap", "Deep foundation — piles under pile cap") : L("Pondasi dangkal — telapak/mat", "Shallow foundation — footing/mat")
  const s = root(W, H, P, title)
  T(s, 14, 22, title, { c: P.ink, fs: 12.5, b: true }); T(s, W - 14, 22, L("sketsa tidak berskala", "not to scale"), { c: P.mut, fs: 10, a: "end" })
  const gy = 74, fx = 190, fw = 240, ft = 34, fy = gy + 30
  Rect(s, 14, gy, W - 28, H - gy - 6, P.sand, null, { op: 0.35 })
  s.append(sv("line", { x1: 14, y1: gy, x2: W - 14, y2: gy, stroke: P.ink, "stroke-width": 2 }))
  Rect(s, fx + fw / 2 - 34, gy - 30, 68, fy - gy + 30, P.conc, P.concD)
  Rect(s, fx, fy, fw, ft, P.conc, P.concD, { sw: 2 })
  const dv = (x, y1, y2, t, left) => { s.append(sv("line", { x1: x, y1, x2: x, y2, stroke: P.mut, "stroke-width": 1.3 })); [y1, y2].forEach((y) => s.append(sv("line", { x1: x - 6, x2: x + 6, y1: y, y2: y, stroke: P.mut }))); T(s, x + (left ? -8 : 8), (y1 + y2) / 2 + 4, t, { c: P.acc, fs: 11.5, b: true, a: left ? "end" : "start" }) }
  dv(fx + fw + 26, gy, fy + ft, "Df")
  if (isDeep(st)) {
    const n = 4, x0 = fx + 40, sp = (fw - 80) / (n - 1), py = fy + ft, ph = H - py - 40, pw = 12
    for (let i = 0; i < n; i++) Rect(s, x0 + i * sp - pw / 2, py, pw, ph, st.pk === "bored" ? P.concD : P.steel, P.ink, { sw: 1 })
    const tick = (x, y) => s.append(sv("line", { x1: x, x2: x, y1: y - 5, y2: y + 5, stroke: P.mut, "stroke-width": 1.3 }))
    // ce: tepi cap ke pusat tiang pertama (di atas cap)
    const yc = fy - 12
    s.append(sv("line", { x1: fx, x2: x0, y1: yc, y2: yc, stroke: P.mut, "stroke-width": 1.3 })); tick(fx, yc); tick(x0, yc)
    s.append(sv("line", { x1: x0, x2: x0, y1: yc, y2: fy, stroke: P.mut, "stroke-width": 1, "stroke-dasharray": "3 3" }))
    T(s, (fx + x0) / 2, yc - 7, `ce ${nf(st.pce, 2)} m`, { c: P.acc, fs: 11, b: true, a: "middle" })
    // s: jarak antar tiang (di bawah)
    const ys = H - 26
    s.append(sv("line", { x1: x0, x2: x0 + sp, y1: ys, y2: ys, stroke: P.mut, "stroke-width": 1.3 })); tick(x0, ys); tick(x0 + sp, ys)
    T(s, x0 + sp / 2, ys + 17, `s = ${nf(st.psx, 2)} m`, { c: P.acc, fs: 11.5, b: true, a: "middle" })
    dv(fx - 22, py, py + ph, `Lp = ${nf(st.pL, 1)} m`, true)
    const xl = x0 + 3 * sp
    s.append(sv("line", { x1: xl - pw / 2, x2: xl + pw / 2, y1: py + ph * 0.45, y2: py + ph * 0.45, stroke: P.ink, "stroke-width": 1.2 }))
    T(s, xl + pw / 2 + 8, py + ph * 0.45 + 4, `D = ${nf(st.pD, 0)} mm${st.pk === "pipe" ? ` · t ${nf(st.pt, 1)}` : ""}`, { c: P.acc, fs: 11.5, b: true })
    T(s, 14, 44, `${st.pk === "bored" ? L("Tiang bor beton", "Bored concrete piles") : L("Tiang pipa baja", "Steel pipe piles")} · ${AXIAL_METHOD()[st.pmeth]} · ${L("data tab Tanah", "Soil tab data")}`, { c: P.mut, fs: 11 })
  } else {
    for (let i = 0; i <= 8; i++) { const x = fx + 8 + i * (fw - 16) / 8; s.append(sv("line", { x1: x, y1: fy + ft + 34, x2: x, y2: fy + ft + 8, stroke: P.arw, "stroke-width": 2 })); s.append(sv("polygon", { points: `${x},${fy + ft + 4} ${x - 4},${fy + ft + 12} ${x + 4},${fy + ft + 12}`, fill: P.arw })) }
    s.append(sv("line", { x1: fx, x2: fx + fw, y1: fy + ft + 34, y2: fy + ft + 34, stroke: P.arw, "stroke-width": 2 }))
    T(s, fx + fw / 2, fy + ft + 56, st.qaSrc === "manual" ? `qa = ${nf(toDisp("Q", st.qa), 0)} ${uName("Q")} (manual)` : L("qa dari tab Tanah — memakai B, L, Df pondasi ini", "qa from Soil tab — using this footing's B, L, Df"), { c: P.acc, fs: 11.5, b: true, a: "middle" })
    s.append(sv("line", { x1: fx, x2: fx + fw, y1: fy - 12, y2: fy - 12, stroke: P.mut })); T(s, fx + fw / 2 + 52, fy - 16, "B × L", { c: P.acc, fs: 11.5, b: true, a: "middle" })
    T(s, 14, 44, L("Tekanan kontak q ≤ qa (tanpa tarik), stabilitas guling/geser", "Contact pressure q ≤ qa (no tension), overturning/sliding stability"), { c: P.mut, fs: 11 })
  }
  return s
}
export { QA_METHOD }
