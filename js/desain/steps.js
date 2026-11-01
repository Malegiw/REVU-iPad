// Lembar perhitungan langkah demi langkah (Besaran | Rumus | Substitusi | Hasil) untuk tiap modul Desain: ditampilkan di layar dan ikut ke PDF/Excel.
import { L, nf, toDisp, uName, GAMMA_C, GAMMA_W, GAMMA_S, rad, seismicCoef, qz, kz } from "./core.js"
import { beta1, rhoTS, sqfc } from "./rc.js"

const F = (v, d = 1) => `${nf(toDisp("F", v), d)} ${uName("F")}`
const Mo = (v, d = 1) => `${nf(toDisp("M", v), d)} ${uName("M")}`
const Q = (v, d = 1) => `${nf(toDisp("Q", v), d)} ${uName("Q")}`
const Mm = (v, d = 1) => `${nf(toDisp("Mm", v), d)} ${uName("Mm")}`
const Wl = (v, d = 1) => `${nf(toDisp("W", v), d)} ${uName("W")}`
const G = (v, d = 1) => nf(toDisp("G", v), d)
const m = (v, d = 2) => `${nf(v, d)} m`
const sec = (h, rows) => ({ h, rows: rows.filter(Boolean) })

// ---------------------------------------------------------------- telapak (dipakai vessel, trafo, dinamis)
export function footingSteps(md, r, rc, prc, label = "") {
  const out = [], A = r.geo.A, W = r.W, t = md.t, sfx = label ? ` · ${label}` : ""
  const aTxt = md.shape === "oct" ? ["A = 0,8284·B²", `0,8284 × ${nf(md.B, 2)}²`] : md.shape === "circle" ? ["A = π·B²/4", `π × ${nf(md.B, 2)}² / 4`] : ["A = B·L", `${nf(md.B, 2)} × ${nf(md.L, 2)}`]
  const pedA = md.peds.reduce((s, p) => s + (p.shape === "oct" ? 0.82843 * p.bx * p.bx : p.shape === "circle" ? Math.PI / 4 * p.bx * p.bx : p.bx * p.by), 0)
  out.push(sec(L("Berat pondasi", "Foundation weight") + sfx, [
    [L("Luas telapak", "Footing area"), aTxt[0], aTxt[1], `${nf(A, 3)} m²`],
    [L("Berat telapak", "Footing weight"), "Wf = A·t·γc", `${nf(A, 3)} × ${nf(t, 2)} × ${G(GAMMA_C)}`, F(W.footing)],
    [L("Berat pedestal", "Pedestal weight"), "Wp = Ap·hp·γc", `${nf(pedA, 3)} × ${nf(md.peds[0].h, 2)} × ${G(GAMMA_C)}`, F(W.peds.reduce((a, b) => a + b, 0))],
    [L("Berat tanah urug", "Backfill weight"), "Ws = (A − Ap)·(Df − t)·γs", `(${nf(A, 3)} − ${nf(pedA, 3)}) × ${nf(W.cover, 2)} × ${G(md.gs ?? 18)}`, F(W.soil)],
    [L("Total berat pondasi", "Total foundation weight"), "W = Wf + Wp + Ws", "", F(W.total)],
  ]))
  const gv = r.asd.reduce((a, b) => (b.pr.qmax / b.qa > a.pr.qmax / a.qa ? b : a), r.asd[0])
  if (gv) {
    const R = gv.R, pr = gv.pr, full = pr.mode === "full"
    const Sx = r.geo.Ixx / (Math.max(...r.geo.poly.map((q) => Math.abs(q[1])))), Sy = r.geo.Iyy / (Math.max(...r.geo.poly.map((q) => Math.abs(q[0]))))
    out.push(sec(L("Tekanan tanah & stabilitas — kombinasi ASD penentu ", "Soil pressure & stability — governing ASD combination ") + gv.c.id + sfx, [
      [L("Kombinasi", "Combination"), gv.c.formula, gv.c.name, gv.c.id],
      [L("Beban vertikal total di dasar", "Total vertical load at base"), "P = ΣPi + fD·W", `ΣPi + ${nf(gv.c.fD, 3)} × ${nf(toDisp("F", W.total), 1)}`, F(R.P)],
      [L("Momen di dasar (sumbu x)", "Base moment (x-axis)"), "Mx = ΣMx + ΣPi·yi + ΣVy·(t + h)", "", Mo(R.Mx)],
      [L("Momen di dasar (sumbu y)", "Base moment (y-axis)"), "My = ΣMy + ΣPi·xi + ΣVx·(t + h)", "", Mo(R.My)],
      [L("Eksentrisitas", "Eccentricity"), "ex = My/P ; ey = Mx/P", `${nf(toDisp("M", R.My), 1)}/${nf(toDisp("F", R.P), 1)} ; ${nf(toDisp("M", R.Mx), 1)}/${nf(toDisp("F", R.P), 1)}`, `${nf(pr.ex, 3)} ; ${nf(pr.ey, 3)} m`],
      full ? [L("Tekanan maks (kontak penuh)", "Max pressure (full contact)"), "qmax = P/A + |My|/Sy + |Mx|/Sx", `${nf(toDisp("F", R.P), 1)}/${nf(A, 2)} + ${nf(toDisp("M", Math.abs(R.My)), 1)}/${nf(Sy, 3)} + ${nf(toDisp("M", Math.abs(R.Mx)), 1)}/${nf(Sx, 3)}`, Q(pr.qmax)]
        : [L("Tekanan maks (kontak sebagian)", "Max pressure (partial contact)"), L("q = q0 + gx·x + gy·y ≥ 0, kesetimbangan ΣF, ΣM (Newton)", "q = q0 + gx·x + gy·y ≥ 0, equilibrium ΣF, ΣM (Newton)"), `${L("kontak", "contact")} ${nf(pr.contact * 100, 1)}%`, Q(pr.qmax)],
      [L("Daya dukung izin", "Allowable bearing"), "qmax ≤ qa", `${nf(toDisp("Q", pr.qmax), 1)} ≤ ${nf(toDisp("Q", gv.qa), 1)}`, `UR ${nf(pr.qmax / gv.qa, 3)}`],
      [L("Faktor aman guling", "Overturning FS"), "FS = r_tepi / e", `e = ${nf(Math.hypot(pr.ex, pr.ey), 3)} m`, nf(gv.fsOT, 2)],
      [L("Faktor aman geser", "Sliding FS"), "FS = μ·P / √(Vx² + Vy²)", `${nf(R.P > 0 ? gv.fsSL * R.H / R.P : 0, 2)} × ${nf(toDisp("F", R.P), 1)} / ${nf(toDisp("F", R.H), 2)}`, nf(gv.fsSL, 2)],
    ]))
  }
  const h = r.h, d = r.d
  const rows = [[L("Tinggi efektif", "Effective depth"), "d = t − selimut − db", `${nf(h, 0)} − ${rc.cover} − ${rc.db}`, `${nf(d, 0)} mm`]]
  for (const ax of ["x", "y"]) {
    const q = r.reinf[ax], AX = ax.toUpperCase(), Mu = q.Mpos * 1e6, Rn = Mu / (0.9 * 1000 * d * d)
    rows.push([`Mu ${AX} (${L("muka pedestal", "pedestal face")})`, L("Mu = Σ(qu − wu)·dist·dA / lebar", "Mu = Σ(qu − wu)·dist·dA / width"), q.posAt ? `${q.posAt.combo} · ${q.posAt.at}` : "", Mm(q.Mpos)])
    rows.push([`Rn ${AX}`, "Rn = Mu/(φ·b·d²)", `${nf(Mu / 1e6, 1)}e6 / (0,9 × 1000 × ${nf(d, 0)}²)`, `${nf(Rn, 3)} MPa`])
    rows.push([`As ${AX} ${L("perlu", "req.")}`, "As = 0,85fc'/fy·[1 − √(1 − 2Rn/(0,85fc'))]·b·d", `fc' ${rc.fc}, fy ${rc.fy}`, `${nf(q.fb.As || 0, 0)} mm²/m`])
    rows.push([`As,min`, "As,min = ρts·b·h", `${rhoTS(rc.fy)} × 1000 × ${nf(h, 0)}`, `${nf(rhoTS(rc.fy) * 1000 * h, 0)} mm²/m`])
    rows.push([`${L("Tulangan bawah", "Bottom bars")} ${AX}`, "φMn = φ·As·fy·(d − a/2)", `${q.bot.txt} → As = ${nf(q.bot.As, 0)} mm²/m`, Mm(q.phiMnB)])
    rows.push([`${L("Geser satu arah", "One-way shear")} ${AX}`, "φVc = 0,75·0,17·λ·√fc'·b·d", `0,75 × 0,17 × ${nf(sqfc(rc.fc), 3)} × 1000 × ${nf(d, 0)} / 1000`, `${Wl(q.phiVc)} ≥ Vu ${Wl(q.Vu)}`])
  }
  r.punch.forEach((p, k) => {
    if (!p || p.na) { rows.push([`${L("Pons pedestal", "Pedestal punching")} ${k + 1}`, L("keliling kritis d/2 di luar telapak", "critical perimeter outside footing"), "", "–"]); return }
    rows.push([`${L("Pons pedestal", "Pedestal punching")}${r.punch.length > 1 ? " " + (k + 1) : ""}`, "vu = Vu/(b0·d) + γv·Mu·c/Jc", `Vu ${F(p.Vu)}, b0 ${nf(p.b0, 0)} mm`, `${nf(p.vu, 3)} MPa`])
    rows.push(["φvc", "φ·min(0,33; 0,17(1+2/β); 0,083(αs·d/b0+2))·√fc'", `0,75 × … × ${nf(sqfc(rc.fc), 3)}`, `${nf(p.phivc, 3)} MPa`])
  })
  out.push(sec(L("Desain beton telapak (LRFD)", "Footing concrete design (LRFD)") + sfx, rows))
  const pr = r.pedRes[0]
  if (pr && pr.worst && md.pedKind !== "plinth" && md.peds[0].h > 0) out.push(sec(L("Pedestal (LRFD)", "Pedestal (LRFD)") + sfx, [
    [L("Luas & tulangan", "Area & steel"), "ρ = As/Ag", `${prc.n} D${prc.db} / ${nf(pr.Ag, 0)} mm²`, `${nf(pr.rho * 100, 3)} %`],
    [L("Gaya penentu", "Governing forces"), "Pu, Mux = Mx + Vy·hp, Muy = My + Vx·hp", pr.worst.combo, `Pu ${F(pr.worst.Pu)}`],
    [L("Interaksi P–M (serat)", "P–M interaction (fibre)"), md.peds[0].shape === "rect" ? "(Mux/φMnx)^1,15 + (Muy/φMny)^1,15 ≤ 1" : "√(Mux² + Muy²)/φMn ≤ 1", L("regangan beton 0,003, blok Whitney β1 = ", "concrete strain 0.003, Whitney block β1 = ") + nf(beta1(prc.fc), 3), `UR ${nf(pr.worst.ur, 3)}`],
  ]))
  return out
}

// ---------------------------------------------------------------- angin & gempa umum
function windRows(w, b, z0, H, Cf, F0, M0) {
  return [[L("Kecepatan angin dasar", "Basic wind speed"), "V (3 dtk)", "", `${nf(w.V, 1)} m/s`],
    [L("Koef. tekanan velositas di puncak", "Velocity pressure coeff. at top"), "Kz = 2,01·(z/zg)^(2/α)", `z = ${nf(z0 + H, 2)} m, ${L("eksposur", "exposure")} ${w.exp}`, nf(kz(z0 + H, w.exp), 3)],
    [L("Tekanan velositas di puncak", "Velocity pressure at top"), "qz = 0,613·Kz·Kzt·Kd·V²", `0,613 × ${nf(kz(z0 + H, w.exp), 3)} × ${nf(w.Kzt ?? 1, 2)} × ${nf(w.Kd ?? 0.95, 2)} × ${nf(w.V, 1)}² / 1000`, Q(qz(w.V, z0 + H, w), 3)],
    [L("Gaya angin (integrasi per pias)", "Wind force (strip integration)"), "F = Σ qz(zi)·G·Cf·b·Δz", `G 0,85 · Cf ${nf(Cf, 2)} · b ${nf(b, 2)} m · H ${nf(H, 2)} m`, F(F0, 2)],
    [L("Momen angin di dasar benda", "Wind moment at body base"), "M = Σ Fi·zi", "", Mo(M0, 2)]]
}
function seisRows(seis, W, h, lab) {
  const c = seismicCoef(seis)
  return [[L("Parameter respons", "Response parameters"), "SDS = 2/3·Fa·Ss ; SD1 = 2/3·Fv·S1", `Fa, Fv ${L("dari kelas situs", "from site class")}`, `${nf(seis.SDS, 3)} ; ${nf(seis.SD1, 3)}`],
    [L("Koefisien gempa", "Seismic coefficient"), seis.method === "rigid" ? "Cs = 0,30·SDS·Ie (T < 0,06 dtk)" : "Cs = SDS/(R/Ie) ≥ max(0,044·SDS·Ie; 0,03)", seis.method === "rigid" ? `0,30 × ${nf(seis.SDS, 3)} × ${nf(seis.Ie, 2)}` : `${nf(seis.SDS, 3)} / (${nf(seis.R, 1)}/${nf(seis.Ie, 2)})`, `${nf(c.Cs, 4)} (${c.rule})`],
    [L("Geser dasar", "Base shear"), "V = Cs·W", `${nf(c.Cs, 4)} × ${nf(toDisp("F", W), 1)} (${lab})`, F(c.Cs * W, 2)],
    [L("Momen guling di dasar benda", "Overturning moment at base"), "M = V·hcg", `${nf(toDisp("F", c.Cs * W), 2)} × ${nf(h, 2)}`, Mo(c.Cs * W * h, 2)]]
}

// ---------------------------------------------------------------- vessel
export function vesselSteps(I, meta, out) {
  const s = []
  if (I.kind === "v") s.push(sec(L("Beban angin — SNI 1727:2020 Bab 29", "Wind load — SNI 1727:2020 Ch. 29"), windRows(I.wind, meta.De, Math.max(meta.z0, 0), I.H, meta.wind.Cf ?? meta.Cf, meta.wind.F, meta.wind.M)))
  else s.push(sec(L("Beban angin — SNI 1727:2020 Bab 29", "Wind load — SNI 1727:2020 Ch. 29"), [
    [L("Angin melintang (bidang L × De)", "Transverse wind (L × De area)"), "F = Σ qz·G·Cf·L·Δz", `L = ${nf(meta.Ltot, 2)} m, De = ${nf(meta.De, 2)} m`, F(meta.wind.F, 2)],
    [L("Angin memanjang (ujung)", "Longitudinal wind (end)"), "Fl = qz·G·0,5·π·De²/4", "", F(meta.wind.Fl, 2)],
    [L("Kopel vertikal antar saddle", "Vertical couple between saddles"), "ΔP = F·hc/Ls", `${nf(toDisp("F", meta.wind.Fl), 2)} × ${nf(I.hc, 2)} / ${nf(I.Ls, 2)}`, F(meta.wind.Fl * I.hc / I.Ls, 2)],
    [L("Gesek termal saddle geser", "Sliding-saddle thermal friction"), "Ff = μ·(We + Wo)/2", `${nf(I.mu, 2)} × (${nf(toDisp("F", I.We), 1)} + ${nf(toDisp("F", I.Wo), 1)}) / 2`, F(meta.Ff, 2)]]))
  s.push(sec(L("Beban gempa — SNI 1726:2019 §15.4", "Seismic load — SNI 1726:2019 §15.4"), seisRows(I.seis, I.We + I.Wo, I.kind === "v" ? I.hcg : I.hc, "We + Wo")))
  out.res.forEach(({ m: md, r }) => s.push(...footingSteps(md, r, { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, { fc: I.fc, fy: I.fy, n: I.nBars, db: I.dbP }, md.label)))
  const w = out.anc.w
  if (w) {
    const ac = w.ac
    s.push(sec(L("Baut angkur — ACI 318M-14 Bab 17", "Anchor bolts — ACI 318M-14 Ch. 17"), [
      I.kind === "v" ? [L("Tarik per baut", "Tension per bolt"), "Tu = 4·Mu/(n·BCD) − Pu/n", `n ${I.nb}, BCD ${nf(I.BCD, 2)} m · ${w.c}`, F(Math.max(w.Tu, 0), 2)] : [L("Tarik per baut", "Tension per bolt"), "Tu = |Mx|/sb/(n/2) − Pu/n", `n ${I.nb}, sb ${nf(I.sb, 2)} m · ${w.c}`, F(Math.max(w.Tu, 0), 2)],
      [L("Geser per baut", "Shear per bolt"), "Vu = V/n", "", F(w.Vu, 2)],
      [L("Luas efektif ulir", "Effective thread area"), "Ase = 0,7854·(d − 0,9382·p)²", `M${I.bd}`, `${nf(ac.Ase, 1)} mm²`],
      [L("Kuat tarik baja", "Steel tension strength"), "φNsa = 0,75·Ase·futa", `0,75 × ${nf(ac.Ase, 1)} × ${nf(ac.futa, 0)} / 1000`, F(ac.phiNsa, 2)],
      [L("Kuat cabut", "Pull-out strength"), "φNpn = 0,70·8·Abrg·fc'", `0,70 × 8 × ${nf(ac.Abrg, 0)} × ${nf(I.fc, 0)} / 1000`, F(ac.phiNpn, 2)],
      [L("Kuat geser baja (grout)", "Steel shear (grout)"), "φVsa = 0,65·0,6·Ase·futa·0,8", "", F(ac.phiVsa, 2)],
      [L("Interaksi", "Interaction"), "(Nu/φNn)^5/3 + (Vu/φVn)^5/3 ≤ 1", `${nf(ac.rn, 3)}^5/3 + ${nf(ac.rv, 3)}^5/3`, nf(ac.inter, 3)],
    ]))
  }
  return s
}

// ---------------------------------------------------------------- trafo
export function trafoSteps(I, meta, out) {
  const s = [sec(L("Beban angin — badan trafo", "Wind load — transformer body"), windRows(I.wind, I.Bt, Math.max(I.hp + I.t - I.Df, 0), I.Ht, 1.4, meta.fx.F, meta.fx.M)),
    sec(L("Beban gempa — peralatan kaku", "Seismic load — rigid equipment"), seisRows(I.seis, I.W, I.hcg, "W"))]
  s.push(...footingSteps(out.m, out.r, { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, { fc: I.fc, fy: I.fy, n: I.nBars, db: I.dbP }))
  const Apit = I.Lpit * I.Bpit, Apl = I.Lp * I.Bp
  s.push(sec(L("Bak oli & dongkrak", "Oil pit & jacking"), [
    [L("Volume tersedia", "Available volume"), "V = (Apit − Aplinth)·[(hpit − hg) + n·hg]", `(${nf(Apit, 2)} − ${nf(Apl, 2)}) × [(${nf(I.hpit, 2)} − ${nf(I.hg, 2)}) + ${nf(I.por, 2)} × ${nf(I.hg, 2)}]`, `${nf(out.Vavail, 2)} m³`],
    [L("Volume perlu", "Required volume"), "V = 1,1·Voil + Apit·hujan + air pemadam", `1,1 × ${nf(I.Voil / 1000, 2)} + ${nf(Apit, 2)} × ${nf(I.rain / 1000, 3)} + ${nf(I.fireW, 1)}`, `${nf(out.Vreq, 2)} m³`],
    [L("Beban dongkrak", "Jacking load"), "Pj = 1,4·W/2", `1,4 × ${nf(toDisp("F", I.W), 1)} / 2`, F(1.4 * I.W / 2)],
  ]))
  return s
}

// ---------------------------------------------------------------- dinamis
export function dynSteps(I, Dy, out) {
  const s = [], rho = I.gs / 9.81
  s.push(sec(L("Massa & properti tanah", "Mass & soil properties"), [
    [L("Berat blok", "Block weight"), "Wb = Bx·By·H·γc", `${nf(I.Bx, 2)} × ${nf(I.By, 2)} × ${nf(I.H, 2)} × ${G(GAMMA_C)}`, F(Dy.Wb)],
    [L("Rasio massa", "Mass ratio"), "Wb/Wm", `${nf(toDisp("F", Dy.Wb), 1)} / ${nf(toDisp("F", I.Wm), 1)}`, nf(Dy.mr, 2)],
    [L("Massa total", "Total mass"), "m = (Wb + Wm)/g", "", `${nf(Dy.m, 2)} t`],
    [L("Modulus geser dinamis", "Dynamic shear modulus"), I.Gmode === "G" ? "G" : "G = ρ·Vs²·reduksi", I.Gmode === "G" ? "" : `${nf(rho, 3)} × ${nf(I.Vs, 0)}² × ${nf(I.red, 2)}`, Q(Dy.Gs, 0)],
    [L("Jari-jari ekuivalen", "Equivalent radius"), "r0 = √(Bx·By/π)", "", m(Dy.r0, 3)],
  ]))
  const [v, hz, rk, tr] = Dy.modes
  s.push(sec(L("Kekakuan, redaman & frekuensi (Richart–Whitman)", "Stiffness, damping & frequency (Richart–Whitman)"), [
    [L("Vertikal", "Vertical"), "kz = 4·G·r0/(1 − ν)·ηz", `ηz = ${nf(Dy.ez, 3)}`, `${nf(v.K, 0)} kN/m`],
    ["fn,z", "fn = √(k/m)/(2π)", `√(${nf(v.K, 0)}/${nf(Dy.m, 2)})/2π`, `${nf(v.f, 2)} Hz`],
    ["ξz", "ξz = 0,425/√Bz ; Bz = (1 − ν)/4·m/(ρ·r0³)", `Bz = ${nf(Dy.Bz, 3)}`, nf(v.xi, 3)],
    [L("Horizontal", "Horizontal"), "kx = 32(1 − ν)·G·r0/(7 − 8ν)·ηx", `ηx = ${nf(Dy.ex, 3)}`, `${nf(hz.K, 0)} kN/m · ${nf(hz.f, 2)} Hz`],
    [L("Rocking", "Rocking"), "kψ = 8·G·r0ψ³/(3(1 − ν))·ηψ", `r0ψ = ${nf(Dy.r0p, 3)} m, Iψ = ${nf(Dy.Ixb, 1)} t·m²`, `${nf(rk.K, 0)} kN·m/rad · ${nf(rk.f, 2)} Hz`],
    [L("Torsi", "Torsion"), "kθ = 16·G·r0θ³/3", `r0θ = ${nf(Dy.r0t, 3)} m`, `${nf(tr.K, 0)} kN·m/rad · ${nf(tr.f, 2)} Hz`],
    [L("Sliding–rocking tergandeng", "Coupled sliding–rocking"), "ωn⁴ − ωn²(ωx² + ωψ²)/γ + ωx²·ωψ²/γ = 0", `γ = Io/Iψ = ${nf(Dy.Io / Dy.Ixb, 3)}`, `${nf(Dy.modes[4].f, 2)} ; ${nf(Dy.modes[5].f, 2)} Hz`],
  ]))
  const r1 = Dy.resp[0]
  s.push(sec(L("Eksitasi & respons", "Excitation & response"), [
    [L("Frekuensi operasi", "Operating frequency"), "f = rpm/60", `${nf(I.rpm, 0)}/60`, `${nf(Dy.fop, 2)} Hz`],
    [L("Gaya tak seimbang", "Unbalanced force"), I.Fo > 0 ? L("data vendor", "vendor data") : "Fo = mr·(G/ω)·ω² (ISO 1940)", I.Fo > 0 ? "" : `${nf(I.Wr / 9.81, 3)} t × ${nf(I.Gq, 1)}/1000 × ${nf(2 * Math.PI * Dy.fop, 1)}`, F(Dy.Fo, 3)],
    [L("Amplitudo vertikal", "Vertical amplitude"), "Az = Fo/kz · 1/√((1 − r²)² + (2ξr)²)", `r = ${nf(Dy.fop / v.f, 3)}`, `${nf(r1.Az, 2)} μm`],
    [L("Amplitudo horizontal di poros", "Horizontal amplitude at shaft"), "Ay = Fo/kx·Mx + θ·(H + hs)", "", `${nf(r1.Ay, 2)} μm`],
    [L("Kecepatan getar puncak", "Peak vibration velocity"), "v = ω·A", `${nf(2 * Math.PI * Dy.fop, 1)} × ${nf(Math.max(r1.Az, r1.Ay), 2)} μm`, `${nf(Math.max(r1.vz, r1.vy), 3)} mm/s`],
  ]))
  s.push(...footingSteps(out.m, out.r, { fc: I.fc, fy: I.fy, cover: I.cover, db: I.db }, { fc: I.fc, fy: I.fy, n: 8, db: 16 }))
  return s
}

// ---------------------------------------------------------------- tangki
export function tankSteps(I, T, out) {
  const s = [], A = T.A
  s.push(sec(L("Berat tangki & isi", "Tank & contents weight"), [
    [L("Berat shell", "Shell weight"), "Ws = π·D·Hs·t·γs", `π × ${nf(I.D, 2)} × ${nf(I.Hs, 2)} × ${nf(I.tShell / 1000, 4)} × ${G(GAMMA_S)}`, F(T.Ws)],
    [L("Berat pelat dasar", "Bottom weight"), "Wb = π·D²/4·tb·γs", `${nf(A, 2)} × ${nf(I.tBot / 1000, 4)} × ${G(GAMMA_S)}`, F(T.Wb)],
    [L("Berat atap", "Roof weight"), "Wr = A/cos θ·tr·γs·(1,10–1,25)", `${nf(A, 2)}/cos ${nf(I.slope, 1)}° × ${nf(I.tRoof / 1000, 4)} × ${G(GAMMA_S)}`, F(T.Wr)],
    [L("Berat cairan operasi", "Operating liquid"), "Wp = γw·SG·A·H", `${G(GAMMA_W, 2)} × ${nf(I.SG, 2)} × ${nf(A, 2)} × ${nf(I.H, 2)}`, F(T.Wp, 0)],
    [L("Tekanan cairan di dasar", "Liquid pressure at bottom"), "p = γw·SG·H", `${G(GAMMA_W, 2)} × ${nf(I.SG, 2)} × ${nf(I.H, 2)}`, Q(T.pOp)],
    [L("Beban garis shell", "Shell line load"), "w = (Ws + Wacc + Wr·(1 − fk))/(π·D)", `(${nf(toDisp("F", T.Ws), 1)} + ${nf(toDisp("F", I.Wacc), 1)} + ${nf(toDisp("F", T.Wr * (1 - T.cf)), 1)}) / (π × ${nf(I.D, 2)})`, Wl(T.wD, 2)],
  ]))
  s.push(sec(L("Angin & stabilitas API 650 §5.11", "Wind & API 650 §5.11 stability"), [
    ...windRows(I.wind, I.D, I.z0, I.Hs, T.Cf, T.Fw, T.Mw),
    [L("Momen tahanan", "Resisting moments"), "MDL = (Ws + Wacc)·D/2 ; MDLR = Wr·D/2", "", `${Mo(T.MDL, 0)} ; ${Mo(T.MDLR, 0)}`],
    [L("Kriteria (a)", "Criterion (a)"), "0,6·Mw ≤ MDL/1,5 + MDLR", `${nf(toDisp("M", 0.6 * T.Mw), 1)} ≤ ${nf(toDisp("M", T.MDL / 1.5 + T.MDLR), 1)}`, `UR ${nf(T.urWind, 3)}`],
  ]))
  if (T.s) {
    const e = T.s
    s.push(sec(L("Gempa API 650 Annex E", "API 650 Annex E seismic"), [
      [L("Massa impulsif", "Impulsive mass"), e.DH >= 1.333 ? "Wi = tanh(0,866·D/H)/(0,866·D/H)·Wp" : "Wi = (1 − 0,218·D/H)·Wp", `D/H = ${nf(e.DH, 3)}`, F(e.Wi, 0)],
      [L("Massa konvektif", "Convective mass"), "Wc = 0,230·D/H·tanh(3,67·H/D)·Wp", "", F(e.Wc, 0)],
      [L("Tinggi pusat impulsif/konvektif", "Impulsive/convective heights"), "Xi ; Xc", "", `${m(e.Xi)} ; ${m(e.Xc)}`],
      [L("Periode konvektif", "Convective period"), "Tc = 1,8·Ks·√D ; Ks = 0,578/√tanh(3,68·H/D)", `Ks = ${nf(e.Ks, 3)}`, `${nf(e.Tc, 2)} s`],
      [L("Koefisien spektral", "Spectral coefficients"), "Ai = SDS·Ie/Rwi ; Ac = 1,5·SD1/Tc·Ie/Rwc", `Rwi ${nf(e.Rwi, 1)}, Rwc ${nf(e.Rwc, 1)}`, `${nf(e.Ai, 4)} ; ${nf(e.Ac, 4)}`],
      [L("Geser dasar", "Base shear"), "V = √(Vi² + Vc²) ; Vi = Ai(Ws + Wr + Wf + Wi), Vc = Ac·Wc", "", F(e.V, 1)],
      [L("Momen ringwall", "Ringwall moment"), "Mrw = √[(Ai(Wi·Xi + Ws·Xs + Wr·Xr))² + (Ac·Wc·Xc)²]", "", Mo(e.Mrw, 0)],
      [L("Momen pelat", "Slab moment"), "Ms = √[(Ai(Wi·Xis + Ws·Xs + Wr·Xr))² + (Ac·Wc·Xcs)²]", "", Mo(e.Ms, 0)],
      [L("Rasio angkur", "Anchorage ratio"), "J = Mrw/(D²·(wt·(1 − 0,4Av) + wa))", `wt ${nf(e.wt / 1000, 2)} kN/m, wa ${nf(e.wa / 1000, 2)} kN/m`, nf(e.J, 3)],
      [L("Gelombang sloshing", "Sloshing wave"), "δs = 0,42·D·Af", `Af = ${nf(e.Af, 4)}`, m(e.slosh)],
    ]))
  }
  const R = out.R
  if (out.type === "ring") s.push(sec(L("Ringwall (PIP STE03020)", "Ringwall (PIP STE03020)"), [
    [L("Tekanan di bawah ringwall (penentu)", "Pressure under ringwall (governing)"), "q = (w + 4M/(πD²) + p·b/2 + Wrw)/bf", R.wq.c.id, Q(R.wq.q)],
    [L("Tarik hoop", "Hoop tension"), "T = K·(γ·h²/2 + p·h)·D/2", `${nf(I.K0, 2)} × (${G(I.gpad)} × ${nf(I.rh, 2)}²/2 + ${nf(toDisp("Q", Math.max(T.pOp, T.pTest)), 1)} × ${nf(I.rh, 2)}) × ${nf(I.D, 2)}/2`, F(R.Th)],
    [L("Tarik hoop terfaktor", "Factored hoop tension"), "Tu = 1,6·T", "", F(R.Tu)],
    [L("Tulangan hoop perlu", "Required hoop steel"), "As = max(Tu/(0,9·fy) ; 0,0025·b·h)", `${nf(R.AsH, 0)} ; ${nf(R.AsHmin, 0)}`, `${nf(Math.max(R.AsH, R.AsHmin), 0)} mm² → ${R.nb} D${I.dbH}`],
  ]))
  else s.push(sec(L("Pelat penuh (pelat lingkaran kaku)", "Full slab (rigid circular plate)"), [
    [L("Diameter pelat", "Slab diameter"), "Ds = D + 2a", `${nf(I.D, 2)} + 2 × ${nf(I.proj, 2)}`, m(R.Ds)],
    [L("Tekanan maks (penentu)", "Max pressure (governing)"), "q = P/A + M/S (tanpa tarik)", R.wq.c.id, Q(R.wq.pr.qmax)],
    [L("Momen kantilever di luar shell", "Cantilever moment outside shell"), "Mu = (qu,tepi − wu)·a²/2", "", Mm(R.Mc)],
    [L("Momen interior (bawah/atas)", "Interior moment (bottom/top)"), "M = (3 + ν)·w·a²/16 + (5 + ν)·q1·a²·0,3849/48", "ν = 0,2", `${Mm(R.Mbi)} / ${Mm(R.Mt)}`],
    [L("Tulangan", "Reinforcement"), "As dari Mu, ≥ 0,5·ρts·b·h per muka", "", `${L("bawah", "bottom")} ${R.bot.txt} · ${L("atas", "top")} ${R.top.txt}`],
    [L("Geser satu arah", "One-way shear"), "φVc = 0,75·0,17·√fc'·b·d", `d = ${nf(R.d, 0)} mm`, `${Wl(0.75 * 0.17 * sqfc(I.fc) * R.d)} ≥ ${Wl(Math.max(R.Vc, R.Vi))}`],
  ]))
  return s
}

// ---------------------------------------------------------------- tiang
export function pileSteps(I, R) {
  const s = [], sec2 = R.sec, Dm = R.D
  if (R.isH) s.push(sec(L("Kapasitas aksial helical (AC358)", "Helical axial capacity (AC358)"), [
    ...R.ax.hel.map((h, i) => [`Helix ${i + 1} Ø${nf(h.Dh * 1000, 0)} @ ${nf(h.z, 2)} m`, h.type === "clay" ? "Qh = Ah·9·cu" : "Qh = Ah·σ'v·Nq ; Nq = 1 + 0,56(12φ)^(φ/54)", `Ah = π/4(Dh² − ds²) = ${nf(h.Ah, 4)} m² · q = ${nf(toDisp("Q", h.q), 0)} ${uName("Q")}`, F(h.Q)]),
    [L("Kapasitas bearing", "Bearing capacity"), "Qu = ΣQh + Qs", "", F(R.ax.Qbear)], [L("Korelasi torsi", "Torque correlation"), "Qu = Kt·T", `${nf(I.Kt, 0)} × ${nf(toDisp("M", I.T), 1)}`, isFinite(R.ax.Qtq) ? F(R.ax.Qtq) : "–"],
    [L("Kapasitas izin", "Allowable capacity"), "Qa = min(Qu)·Eg/FS", `${nf(toDisp("F", R.ax.Qc), 1)} × ${nf(R.Eg, 3)} / ${nf(I.fsC, 2)}`, F(R.Qac)],
  ]))
  else s.push(sec(L("Kapasitas aksial pipa (API RP 2GEO)", "Pipe axial capacity (API RP 2GEO)"), [
    [L("Gesek selimut lempung", "Clay shaft friction"), "f = α·cu ; α = 0,5ψ^−0,5 (ψ ≤ 1) / 0,5ψ^−0,25 ; ψ = cu/σ'v", "", ""],
    [L("Gesek selimut pasir", "Sand shaft friction"), "f = K·σ'v·tan(φ − 5°) ≤ flim ; K = 0,8 terbuka / 1,0 tertutup", "", ""],
    [L("Gesek luar", "Outer friction"), "Qs,out = Σ f·π·D·Δz", `D = ${nf(Dm, 4)} m, L = ${nf(I.L, 2)} m`, F(R.ax.Qso)],
    [L("Gesek dalam (ujung terbuka)", "Inner friction (open end)"), "Qs,in = Σ f·π·Di·Δz", "", F(R.ax.Qsi)],
    [L("Tahanan ujung satuan", "Unit end bearing"), R.ax.tipLayer.type === "clay" ? "q = 9·cu" : "q = Nq·σ'v ≤ qlim", `σ'v ${L("ujung", "tip")} = ${nf(toDisp("Q", R.ax.svTip), 1)} ${uName("Q")}`, Q(R.ax.q, 0)],
    [L("Kapasitas ultimit tekan", "Ultimate compression"), I.open ? "Qu = min(Qs,out + q·Ag ; Qs,out + Qs,in + q·Aann)" : "Qu = Qs,out + q·Ag", R.ax.plugged ? L("tersumbat", "plugged") : L("tidak tersumbat", "unplugged"), F(R.ax.Qc)],
    [L("Kapasitas ultimit tarik", "Ultimate tension"), "Qt = Qs,out + W'tiang", "", F(R.ax.Qt)],
    [L("Efisiensi kelompok", "Group efficiency"), "Eg = 1 − θ[(n − 1)m + (m − 1)n]/(90mn) ; θ = atan(D/s)", "", nf(R.Eg, 3)],
    [L("Kapasitas izin tekan / tarik", "Allowable compression / tension"), "Qa = Qu·Eg/FS", `FS ${nf(I.fsC, 2)} / ${nf(I.fsT, 2)}`, `${F(R.Qac)} / ${F(R.Qat)}`],
  ]))
  const g = R.govC
  if (g) {
    const Sx2 = R.piles.reduce((a, p) => a + p.x * p.x, 0)
    s.push(sec(L("Reaksi tiang (pile cap kaku) — ", "Pile reactions (rigid cap) — ") + g.c.id, [
      [L("Beban vertikal", "Vertical load"), "P = Pkolom + fD·Wcap", "", F(g.r.P)],
      [L("Momen di kepala tiang", "Moment at pile heads"), "My' = My + Vx·hc ; Mx' = Mx + Vy·hc", "", `${Mo(g.r.My)} ; ${Mo(g.r.Mx)}`],
      [L("Reaksi maks/min", "Max/min reaction"), "Pi = P/n ± My'·xi/Σx² ± Mx'·yi/Σy²", `n = ${R.n}, Σx² = ${nf(Sx2, 3)} m²`, `${F(g.r.max)} / ${F(g.r.min)}`],
      [L("Lateral per tiang", "Lateral per pile"), "H = √(Vx² + Vy²)/n", "", F(g.r.H, 2)],
    ]))
  }
  s.push(sec(L("Lateral & titik jepit", "Lateral & fixity"), [
    R.Tch ? [L("Panjang karakteristik (pasir)", "Characteristic length (sand)"), "T = (EI/nh)^(1/5)", `EI ${nf(R.EI, 0)} kN·m²`, m(R.Tch, 3)] : [L("Panjang karakteristik (lempung)", "Characteristic length (clay)"), "R = (EI/k)^(1/4) ; k = 67·cu", `EI ${nf(R.EI, 0)} kN·m²`, m(R.Rch, 3)],
    [L("Titik jepit Davisson–Robinson", "Davisson–Robinson fixity"), R.Tch ? "Lf = 1,8·T" : "Lf = 1,4·R", "", m(R.Lf)],
    [L("Titik jepit setara (Winkler)", "Equivalent fixity (Winkler)"), R.head === "fixed" ? "y = H·(e + Lf)³/(12EI)" : "y = H·(e + Lf)³/(3EI)", "", m(R.LfFE)],
    [L("Kapasitas lateral Broms", "Broms lateral capacity"), R.head === "fixed" ? "Hu = min(pendek, menengah, panjang) ; pu = 3Kp·σ'v·D / 9cu·D" : "Hu = min(pendek, panjang)", `Mp = ${Mo(sec2.Mp)}, pm = ${nf(R.pmF, 2)}`, F(R.Hu)],
    [L("Kapasitas lateral izin", "Allowable lateral"), "Ha = Hu/FS", `${nf(toDisp("F", R.Hu), 1)} / ${nf(I.fsL, 2)}`, F(R.Hal)],
    [L("Respons per 1 kN", "Response per 1 kN"), "y1, M1 (FE Winkler, kD = nh·z atau 67cu)", "", `${nf(R.uH.y0 * 1000, 4)} mm ; ${nf(R.uH.Mmax, 3)} kN·m`],
  ]))
  const ws = R.wS
  s.push(sec(L("Struktur tiang — AISC 360-16", "Pile structure — AISC 360-16"), [
    [L("Kelangsingan lokal", "Local slenderness"), "λ = D/t ; λp = 0,07E/Fy ; λr = 0,31E/Fy", `t ${L("efektif", "eff.")} = ${nf(R.tmm, 2)} mm`, `${nf(sec2.lam, 1)} (${sec2.fclass})`],
    [L("Modulus plastis", "Plastic modulus"), "Z = (D³ − Di³)/6", "", `${nf(sec2.Z / 1e3, 1)}×10³ mm³`],
    [L("Kuat lentur", "Flexural strength"), "φMn = 0,9·Fy·Z (kompak)", `0,9 × ${nf(I.Fy, 0)} × ${nf(sec2.Z / 1e3, 1)}e3`, Mo(sec2.phiMn)],
    [L("Tekuk", "Buckling"), "Fe = π²E/(KL/r)² ; Fcr = 0,658^(Fy/Fe)·Fy", `K ${nf(R.Kf, 1)}, L ${nf(R.Le, 2)} m, KL/r ${nf(sec2.kr, 1)}`, `Fcr ${nf(sec2.Fcr, 1)} MPa`],
    [L("Kuat tekan", "Compression strength"), "φPn = 0,9·Fcr·Ae", "", F(sec2.phiPn, 0)],
    ws ? [L("Interaksi H1-1", "H1-1 interaction"), "Pr/Pc + 8/9·B1·Mr/Mc ≤ 1 ; B1 = 1/(1 − Pr/Pe)", `Pu ${F(ws.Pu)}, Mu ${Mo(ws.Mu)}, B1 ${nf(ws.B1, 3)} · ${ws.combo}`, nf(ws.ur, 3)] : null,
  ]))
  const c = R.conn
  s.push(sec(L("Sambungan kepala tiang (beton isi)", "Pile-head connection (infill)"), [
    [L("Gaya desain", "Design forces"), "Pu, Tu, Vu, Mu (LRFD)", "", `${F(c.Pu)} ; ${F(c.Tu)} ; ${F(c.Vu, 2)} ; ${Mo(c.Mu)}`],
    [L("Tulangan dowel perlu", "Required dowel steel"), "As = Tu/(0,9fy) + Vu/(0,75·μ·fy)", `μ = ${nf(I.mu, 2)}, fy = ${nf(I.fyd, 0)}`, `${nf(c.AsReq, 0)} ≤ ${nf(c.As, 0)} mm²`],
    [L("Lekatan beton isi", "Infill bond"), "φRn = 0,5·π·Di·Lp·Fin ; Fin = 5300·t/D² ≤ 1,4 MPa", `Fin = ${nf(c.Fin, 3)} MPa`, F(c.phiRb)],
    [L("Penjangkaran dowel", "Dowel anchorage"), I.hook ? "ldh = 0,24·fy·ψc/(λ√fc')·db" : "ld = fy·ψt·ψe/(2,1λ√fc')·db", `${L("tersedia", "available")} ${nf(c.avail, 0)} mm`, `${nf(c.reqCap, 0)} mm`],
    c.pm ? [L("Momen jepit vs beton isi", "Fixed moment vs infill"), "Mu ≤ φMn (P–M serat, Pu = −Tu)", `${I.nd} D${I.dbd} ${L("pada lingkar", "on circle")} ${nf(c.Dc, 0)} mm`, `${Mo(c.Mu)} ≤ ${Mo(c.pm.phiMn)}`] : null,
  ]))
  return s
}
