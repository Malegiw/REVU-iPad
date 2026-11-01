// Penautan modul Desain ↔ tab Penurunan: penurunan pondasi (segera Steinbrenner + konsolidasi Terzaghi) dihitung dengan profil tanah & kriteria
// yang diisi di tab Penurunan, memakai dimensi dan tekanan kontak kombinasi operasi tetap (A1 = D + Do) dari modul Desain.
import { L, chk, nf, toDisp, uName } from "./core.js"
import { settleFor, settleSend } from "../penurunan_ui.js"

// Telapak denah apa pun → bentuk tab Penurunan: persegi panjang tetap persegi; oktagon/lingkaran → lingkaran dengan luas sama
export function footFrom(shape, B, Lf, A, Df, q, mod, label) {
  if (shape === "rect") return { shape: "persegi", B: Math.min(B, Lf), L: Math.max(B, Lf), Df, q, mod, label }
  return { shape: "lingkaran", B: Math.sqrt(4 * A / Math.PI), L: Math.sqrt(4 * A / Math.PI), Df, q, mod, label }
}
export function settleBlock(foot, allowMm = 0) {
  const r = settleFor(foot)
  if (allowMm > 0) r.allow = allowMm
  const grp = L("Penurunan (profil tanah dari tab Penurunan)", "Settlement (soil profile from Settlement tab)")
  let check, rows = []
  if (r.error) check = chk(grp, L("Penurunan pondasi (tab Penurunan)", "Foundation settlement (Settlement tab)"), "SNI 8460:2017", 0, 1, "", { info: true, note: r.error })
  else {
    const x = r.res
    check = chk(grp, L(`Penurunan total pada ${nf(r.life, 0)} tahun ≤ izin`, `Total settlement at ${nf(r.life, 0)} years ≤ allowable`), "SNI 8460:2017 §9 · Steinbrenner + Terzaghi", x.s_life * 1000, r.allow, "mm",
      { d: 1, note: `si ${nf(x.si * 1000, 1)} + sc ${nf(x.sc * 1000, 1)} mm` })
    rows = [[L("Bentuk & ukuran ekuivalen", "Equivalent shape & size"), foot.shape === "persegi" ? `${nf(foot.B, 2)} × ${nf(foot.L, 2)} m` : `Ø ${nf(foot.B, 2)} m`],
      [L("Kedalaman dasar Df", "Base depth Df"), `${nf(foot.Df, 2)} m`], [L("q bruto (A1 = D + Do)", "Gross q (A1 = D + Do)"), `${nf(toDisp("Q", x.q_gross), 1)} ${uName("Q")}`],
      [L("q bersih = q bruto − σv0 di Df", "Net q = gross q − σv0 at Df"), `${nf(toDisp("Q", x.q_net), 1)} ${uName("Q")}`],
      [L("Penurunan segera si (Steinbrenner)", "Immediate settlement si (Steinbrenner)"), `${nf(x.si * 1000, 1)} mm`], [L("Konsolidasi primer sc (Terzaghi)", "Primary consolidation sc (Terzaghi)"), `${nf(x.sc * 1000, 1)} mm`],
      [L(`Total pada ${nf(r.life, 0)} tahun`, `Total at ${nf(r.life, 0)} years`), `${nf(x.s_life * 1000, 1)} mm`], [L("Total akhir", "Final total"), `${nf(x.s_final * 1000, 1)} mm`],
      ["t90", x.t90 == null ? "–" : `${nf(x.t90, 2)} ${L("tahun", "years")}`], [L("Batas izin (tab Penurunan)", "Allowable (Settlement tab)"), `${nf(r.allow, 0)} mm`]]
  }
  return { foot, r, check, table: rows.length ? { title: L("Penurunan pondasi (terhubung ke tab Penurunan)", "Foundation settlement (linked to Settlement tab)"), cols: [L("Besaran", "Quantity"), L("Nilai", "Value")], rows, align: ["l", "r"],
    note: L("Profil tanah, modulus, parameter konsolidasi, umur rencana dan batas izin diambil dari tab Penurunan. Ubah di sana untuk memperbarui hasil ini.", "Soil profile, moduli, consolidation parameters, design life and limit come from the Settlement tab. Edit them there to update this result.") } : null, send: () => settleSend(foot) }
}
