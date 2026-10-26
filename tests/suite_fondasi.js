// Kelompok uji Pondasi Tangki & Peralatan: js/fondasi.js terhadap hasil fondasi.py (fondasi_cases.json). Laporan per tab (eqReport, mcReport, tkReport)
// mencerminkan logika fondasi_ui.py, termasuk teks pengecekan.
import { qUltimate, bearingFactors, pressure, shearModulus, windPressureShell, windPressureRoofUplift, eqReport, mcReport, tkReport } from "../js/fondasi.js"

export async function run({ check, same }) {
  const d = await (await fetch("./fondasi_cases.json")).json()

  // fungsi dasar
  d.direct.bf.forEach((c) => check(`faktor daya dukung φ=${c.phi}`, same(bearingFactors(c.phi), c.expect, "Nc,Nq,Ng")))
  d.direct.q.forEach((c, i) => check(`q ultimit #${i + 1} ${JSON.stringify(c.args)}`, same(qUltimate(...c.args), c.expect, "q_ult")))
  d.direct.p.forEach((c, i) => check(`tekanan dasar #${i + 1} ${JSON.stringify(c.args)}`, same(pressure(...c.args), c.expect, "tekanan")))
  d.direct.g.forEach(([vs, g, red, want]) => check(`G dari Vs=${vs}`, same(shearModulus(vs, g, red), want, "G")))
  d.direct.wind.forEach(([v, ps, pu]) => check(`tekanan angin ${v} m/s`, same([windPressureShell(v), windPressureRoofUplift(v)], [ps, pu], "angin")))

  // pondasi peralatan
  for (const c of d.eq) {
    let got, err = null
    try { got = eqReport(c.geom, c.soil, c.cases) } catch (e) { err = e }
    check(c.name, err ? [`JS galat: ${err.message}`] : same(got, c.expect, "hasil"))
  }
  // mesin berputar
  for (const c of d.mc) check(c.name, same(mcReport(c.m), c.expect, "hasil"))
  // tangki
  for (const c of d.tk) check(c.name, same(tkReport(c.k), c.expect, "hasil"))

  // nilai acuan teori
  const [nc, nq, ng] = bearingFactors(30)
  check("faktor daya dukung φ=30° (Vesic): Nq ≈ 18,40; Nc ≈ 30,14; Nγ ≈ 22,40", [Math.abs(nq - 18.401) < 0.01 && Math.abs(nc - 30.14) < 0.01 && Math.abs(ng - 22.40) < 0.01 ? null : `Nc ${nc} Nq ${nq} Ng ${ng}`].filter(Boolean))
  check("φ=0: Nc 5,14; Nq 1; Nγ 0", same(bearingFactors(0), [5.14, 1, 0], "faktor"))
  const pr = pressure(1000, 6, 6, 1, 0)
  check("tekanan di batas kern (e = B/6): q min = 0, q maks = 2V/A", [Math.abs(pr.q_min) < 1e-9 && Math.abs(pr.q_max - 2 * 1000 / 36) < 1e-9 && pr.mode === "penuh" ? null : `mode ${pr.mode} q_min ${pr.q_min} q_max ${pr.q_max}`].filter(Boolean))
}
