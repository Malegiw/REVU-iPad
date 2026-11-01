// Bentuk pondasi untuk perhitungan penurunan (mesin js/penurunan.js lewat js/desain/soil.js): telapak persegi panjang tetap persegi panjang;
// oktagon/lingkaran → lingkaran dengan luas sama. Hasil penurunan dihitung di js/desain/deep.js (settleOf) memakai data tab Tanah.
export function footFrom(shape, B, Lf, A, Df, q, mod, label) {
  if (shape === "rect") return { shape: "persegi", B: Math.min(B, Lf), L: Math.max(B, Lf), Df, q, mod, label }
  return { shape: "lingkaran", B: Math.sqrt(4 * A / Math.PI), L: Math.sqrt(4 * A / Math.PI), Df, q, mod, label }
}
