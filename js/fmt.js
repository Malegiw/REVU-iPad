// Pemformat angka yang sama dengan f-string Python, dipakai semua kalkulator supaya teks hasil (pembulatan, nilai tak hingga) identik dengan versi Python.

// Setara f"{x:g}" (6 angka penting, tanpa nol di belakang)
export function fmtG(x) {
  if (!isFinite(x)) return isNaN(x) ? "nan" : x < 0 ? "-inf" : "inf"
  if (x === 0) return Object.is(x, -0) ? "-0" : "0"
  const e = Math.floor(Math.log10(Math.abs(x)))
  if (e < -4 || e >= 6) {
    let s = x.toExponential(5).replace(/\.?0+e/, "e")
    return s.replace(/e([+-])(\d)$/, "e$10$2")
  }
  return String(parseFloat(x.toPrecision(6)))
}

// Setara f"{x:.{d}f}": nilai persis di tengah dibulatkan ke angka genap (toFixed JavaScript membulatkan ke atas)
export function fixed(x, d) {
  if (!isFinite(x)) return isNaN(x) ? "nan" : x < 0 ? "-inf" : "inf"
  if (x === 0 && Object.is(x, -0)) return "-" + (0).toFixed(d)
  const full = Math.abs(x).toFixed(d + 30)
  const dot = full.indexOf(".")
  if (/^50*$/.test(full.slice(dot + 1 + d))) {
    const head = full.slice(0, dot + 1 + d).replace(/\.$/, "")
    const lastDigit = Number(head.replace(".", "").slice(-1))
    if (lastDigit % 2 === 0) return (x < 0 ? "-" : "") + head
  }
  return x.toFixed(d)
}

// Setara f"{x:+.{d}f}"
export const signed = (x, d) => (x < 0 || Object.is(x, -0) ? "" : "+") + fixed(x, d)

// Setara f"{x:,.{d}f}" (pemisah ribuan koma)
export function commas(x, d) {
  const s = fixed(x, d)
  if (!isFinite(x)) return s
  const [a, b] = s.split(".")
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b !== undefined ? "." + b : "")
}
