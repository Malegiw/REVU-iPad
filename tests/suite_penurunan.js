// Kelompok uji Penurunan Pondasi: js/penurunan.js terhadap hasil penurunan.py (penurunan_cases.json) dan beberapa nilai acuan teori.
import { analyze, SettleError, uOfTv, tvOfU, boussinesqCorner, steinbrennerIs, fmtG, fixed } from "../js/penurunan.js"

export async function run({ check, same }) {
  const cases = await (await fetch("./penurunan_cases.json")).json()
  for (const c of cases) {
    const opt = { method: c.opt.method, rigidity: c.opt.rigidity, dz: c.opt.dz, lifeYears: c.opt.life_years, allowMm: c.opt.allow_mm, diffMm: c.opt.diff_mm, spanM: c.opt.span_m, angLimit: c.opt.ang_limit }
    let res, err = null
    try { res = analyze(c.foot, c.soil, c.q, opt) } catch (e) { if (e instanceof SettleError) err = e.message; else throw e }
    if (c.expect.error !== undefined) { check(c.name, err === c.expect.error ? [] : [`pesan galat JS "${err}" ≠ Python "${c.expect.error}"`]); continue }
    if (err) { check(c.name, [`JS galat: ${err}`]); continue }
    const got = { q_net: res.q_net, q_gross: res.q_gross, overburden: res.overburden, si: res.si, si_layers: res.si_layers, sc: res.sc, s_life: res.s_life, s_final: res.s_final, ss_life: res.ss_life,
      t50: res.t50, t90: res.t90, ang: res.ang, B: res.B, L: res.L, checks: res.checks, subs: res.subs, cons: res.cons, curve: res.curve, stress: res.stress,
      at: Object.fromEntries(Object.keys(c.expect.at).map((t) => [t, res.at(parseFloat(t))])) }
    check(c.name, same(got, c.expect, "hasil"))
  }

  // beberapa nilai acuan teori yang sama dengan uji Python
  check("Tv50 ≈ 0,197", [Math.abs(tvOfU(0.5) - 0.197) < 0.001 ? null : "Tv50"].filter(Boolean))
  check("Tv90 ≈ 0,848", [Math.abs(tvOfU(0.9) - 0.848) < 0.001 ? null : "Tv90"].filter(Boolean))
  check("U(Tv=0,197) ≈ 0,5", [Math.abs(uOfTv(0.197) - 0.5) < 0.002 ? null : "U"].filter(Boolean))
  check("Steinbrenner Is(1, ∞, 0,5) ≈ 0,5611", [Math.abs(steinbrennerIs(1, 5000, 0.5) - 0.5611) < 0.001 ? null : "Is"].filter(Boolean))
  check("Boussinesq sudut I(1,1) ≈ 0,1752", [Math.abs(boussinesqCorner(1, 1) - 0.17522) < 0.0005 ? null : "I"].filter(Boolean))
  check("fmtG seperti Python :g", [[[20, "20"], [0.5, "0.5"], [1234567, "1.23457e+06"], [0.0001, "0.0001"], [0.00001234, "1.234e-05"], [12.34567891, "12.3457"], [Infinity, "inf"], [-Infinity, "-inf"]]
    .filter(([x, s]) => fmtG(x) !== s).map(([x, s]) => `${x} → ${fmtG(x)} ≠ ${s}`)].flat())
  check("fixed seperti Python :.nf (tengah → genap, tak hingga)", [[[8.25, 1, "8.2"], [8.35, 1, "8.3"], [0.125, 2, "0.12"], [2.5, 0, "2"], [3.5, 0, "4"], [-8.25, 1, "-8.2"], [91.84, 1, "91.8"], [0.15, 1, "0.1"], [1234.5678, 2, "1234.57"],
    [Infinity, 2, "inf"], [-Infinity, 1, "-inf"], [NaN, 1, "nan"], [-0, 1, "-0.0"], [-0.04, 1, "-0.0"]]
    .filter(([x, d, w]) => fixed(x, d) !== w).map(([x, d, w]) => `${x} → ${fixed(x, d)} ≠ ${w}`)].flat())
}
