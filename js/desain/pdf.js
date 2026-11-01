// Penulis PDF minimal tanpa pustaka luar: A4, font standar Helvetica (WinAnsi), teks, garis, kotak, gambar JPEG, serta penata laporan hitungan
// (blok judul, data proyek, ringkasan, tabel otomatis dengan pindah halaman, tabel pemeriksaan dengan batang rasio, gambar), kepala & kaki halaman
// dengan hak cipta dan nomor halaman. Karakter di luar WinAnsi (huruf Yunani, ≤, ≥, √ …) ditulis ulang menjadi teks ASCII.
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,761,222,556,333,1000,556,556,333,1000,667,333,1000,761,611,761,761,222,222,333,333,350,556,1000,333,1000,500,333,944,761,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500]
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,761,278,556,500,1000,556,556,333,1000,667,333,1000,761,611,761,761,278,278,500,500,350,556,1000,333,1000,556,333,944,761,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]

const WIN = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 }
const SUB = { "φ": "phi", "Φ": "Phi", "γ": "gamma", "δ": "delta", "Δ": "Delta", "ν": "nu", "μ": "µ", "ψ": "psi", "ξ": "xi", "ω": "omega", "α": "alpha", "β": "beta", "λ": "lambda", "ρ": "rho",
  "σ": "sigma", "τ": "tau", "ε": "eps", "θ": "theta", "η": "eta", "π": "pi", "ζ": "zeta", "κ": "kappa", "Σ": "Sum", "≤": "<=", "≥": ">=", "≈": "~", "√": "sqrt", "∞": "inf", "→": "->", "←": "<-",
  "↓": "", "↑": "", "✅": "OK", "❌": "X", "⚠": "!", "️": "", "−": "-", "‒": "-", "≠": "!=", "′": "'", "″": "\"", "⁻": "-", "∑": "Sum", "∫": "int", "⊥": "perp", "·": "·", "₀": "0", "₁": "1", "₂": "2", "₃": "3", "⁰": "^0", "⁴": "^4", "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9", "ₓ": "x", "ᵧ": "y", "ʹ": "'", "✓": "v", "✗": "x", "▸": ">", "◐": "", "★": "*" }
export function winAnsi(s) {
  let out = ""
  for (const ch of String(s)) {
    const c = ch.codePointAt(0)
    if (c >= 32 && c < 127) out += ch
    else if (c >= 128 && c < 256) out += ch                   // Latin-1, atau kode WinAnsi 128–159 yang sudah dikodekan
    else if (WIN[ch]) out += String.fromCharCode(WIN[ch])
    else if (SUB[ch] !== undefined) out += SUB[ch]
    else if (c === 10 || c === 9) out += " "
    else if (c >= 0x1F300) out += ""
    else out += "?"
  }
  return out
}
export const textWidth = (s, size, bold) => { const t = bold ? W_BOLD : W_REG; let w = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); w += c >= 32 && c < 256 ? t[c - 32] : 500 } return w * size / 1000 }
const pesc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
const f3 = (x) => (Math.round(x * 100) / 100).toString()
const rgb = (c) => c.map((v) => f3(v)).join(" ")

export const PW = 595.28, PH = 841.89
export class PDF {
  constructor(meta = {}) { this.meta = meta; this.pages = []; this.imgs = []; this.add() }
  add() { this.cur = []; this.pages.push(this.cur); return this }
  text(x, y, s, o = {}) {
    const size = o.size || 9, bold = !!o.bold, str = winAnsi(s)
    let xx = x
    if (o.align === "right") xx = x - textWidth(str, size, bold)
    else if (o.align === "center") xx = x - textWidth(str, size, bold) / 2
    const font = bold ? "F2" : o.italic ? "F3" : "F1"
    this.cur.push(`BT /${font} ${f3(size)} Tf ${rgb(o.color || [0.12, 0.14, 0.19])} rg 1 0 0 1 ${f3(xx)} ${f3(PH - y)} Tm (${pesc(str)}) Tj ET`)
  }
  rect(x, y, w, h, fill, stroke, lw = 0.5) {
    if (fill) this.cur.push(`${rgb(fill)} rg ${f3(x)} ${f3(PH - y - h)} ${f3(w)} ${f3(h)} re f`)
    if (stroke) this.cur.push(`${rgb(stroke)} RG ${f3(lw)} w ${f3(x)} ${f3(PH - y - h)} ${f3(w)} ${f3(h)} re S`)
  }
  line(x1, y1, x2, y2, c = [0.75, 0.77, 0.8], lw = 0.5) { this.cur.push(`${rgb(c)} RG ${f3(lw)} w ${f3(x1)} ${f3(PH - y1)} m ${f3(x2)} ${f3(PH - y2)} l S`) }
  image(jpeg, pw, ph, x, y, w, h) {
    const id = this.imgs.length + 1
    this.imgs.push({ data: jpeg, w: pw, h: ph })
    this.cur.push(`q ${f3(w)} 0 0 ${f3(h)} ${f3(x)} ${f3(PH - y - h)} cm /Im${id} Do Q`)
  }
  output() {
    const chunks = [], offs = []
    let len = 0
    const bin = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xFF; return u }
    const put = (u) => { chunks.push(u); len += u.length }
    const obj = (n, body) => { offs[n] = len; put(bin(`${n} 0 obj\n`)); for (const b of body) put(typeof b === "string" ? bin(b) : b); put(bin("\nendobj\n")) }
    put(bin("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"))
    const nF = 3, imgStart = 3 + nF, pageStart = imgStart + this.imgs.length
    const pageIds = this.pages.map((_, i) => pageStart + i * 2)
    obj(1, [`<< /Type /Catalog /Pages 2 0 R >>`])
    obj(2, [`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${this.pages.length} >>`])
    ;["Helvetica", "Helvetica-Bold", "Helvetica-Oblique"].forEach((f, i) => obj(3 + i, [`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`]))
    this.imgs.forEach((im, i) => obj(imgStart + i, [`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`, im.data, "\nendstream"]))
    const xo = this.imgs.length ? `/XObject << ${this.imgs.map((_, i) => `/Im${i + 1} ${imgStart + i} 0 R`).join(" ")} >>` : ""
    this.pages.forEach((ops, i) => {
      const content = ops.join("\n")
      obj(pageIds[i], [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${xo} >> /Contents ${pageIds[i] + 1} 0 R >>`])
      obj(pageIds[i] + 1, [`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"])
    })
    const infoId = pageStart + this.pages.length * 2
    const d = new Date(), p = (x) => String(x).padStart(2, "0")
    const pd = `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    obj(infoId, [`<< /Title (${pesc(winAnsi(this.meta.title || ""))}) /Author (${pesc(winAnsi(this.meta.author || ""))}) /Creator (YMD-CAL) /Producer (YMD-CAL) /Subject (${pesc(winAnsi(this.meta.rights || ""))}) /CreationDate (${pd}) >>`])
    const xref = len, n = infoId + 1
    let x = `xref\n0 ${n}\n0000000000 65535 f \n`
    for (let i = 1; i < n; i++) x += String(offs[i] || 0).padStart(10, "0") + " 00000 n \n"
    put(bin(x + `trailer\n<< /Size ${n} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`))
    const out = new Uint8Array(len); let q = 0; for (const c of chunks) { out.set(c, q); q += c.length }
    return out
  }
}

// ---------------------------------------------------------------- penata laporan
const C = { ink: [0.12, 0.14, 0.19], mut: [0.36, 0.40, 0.45], head: [0.153, 0.196, 0.247], acc: [0.89, 0.66, 0.34], zebra: [0.965, 0.957, 0.94], line: [0.8, 0.82, 0.85],
  ok: [0.10, 0.50, 0.22], bad: [0.71, 0.14, 0.09], okBg: [0.89, 0.957, 0.91], badBg: [0.992, 0.894, 0.882], warn: [0.85, 0.55, 0.1], box: [0.973, 0.969, 0.957] }
function wrap(s, w, size, bold) {
  const str = winAnsi(s), words = str.split(/ +/), lines = []
  let cur = ""
  for (const wd of words) {
    const t = cur ? cur + " " + wd : wd
    if (textWidth(t, size, bold) <= w) { cur = t; continue }
    if (cur) lines.push(cur)
    if (textWidth(wd, size, bold) <= w) cur = wd
    else { let part = ""; for (const ch of wd) { if (textWidth(part + ch, size, bold) > w && part) { lines.push(part); part = ch } else part += ch } cur = part }
  }
  lines.push(cur)
  return lines
}
// rep: { title, sub, refs, project {name, client, doc, rev, eng, chk}, stamp, copy, ok, gov, metrics [[lab, val]], sections [...] }
export function reportPdf(rep, lbl) {
  const doc = new PDF({ title: rep.title, author: rep.author, rights: rep.copy })
  const M = 40, W = PW - 2 * M, TOP = M + 26, BOT = PH - M - 22
  let y = TOP
  const pageHead = () => {
    doc.text(M, M + 6, "YMD-CAL  ·  " + (lbl.suite || "DESAIN PONDASI"), { size: 7, bold: true, color: C.mut })
    doc.text(PW - M, M + 6, [rep.project.name, rep.project.doc].filter(Boolean).join("  ·  "), { size: 7, color: C.mut, align: "right" })
    doc.line(M, M + 12, PW - M, M + 12, C.line, 0.6)
    doc.rect(M, M + 11.4, 46, 1.4, C.acc)
  }
  const newPage = () => { doc.add(); pageHead(); y = TOP }
  const need = (h) => { if (y + h > BOT) newPage() }
  pageHead()
  // blok judul
  doc.text(M, y + 14, rep.title, { size: 17, bold: true, color: C.head }); y += 22
  for (const ln of wrap(rep.sub, W, 9.5, false)) { doc.text(M, y + 9, ln, { size: 9.5, color: C.mut }); y += 12 }
  y += 4
  const pj = [[lbl.project, rep.project.name], [lbl.client, rep.project.client], [lbl.doc, rep.project.doc], [lbl.rev, rep.project.rev], [lbl.eng, rep.project.eng], [lbl.chk, rep.project.chk], [lbl.date, rep.stamp], [lbl.units, rep.units]]
  const bh = 4 * 15 + 8
  doc.rect(M, y, W, bh, C.box, C.line)
  pj.forEach(([k, v], i) => {
    const cx = M + 8 + (i % 2) * W / 2, cy = y + 13 + Math.floor(i / 2) * 15
    doc.text(cx, cy, k, { size: 7.5, color: C.mut }); doc.text(cx + 70, cy, v || "–", { size: 8.5, bold: true })
  })
  y += bh + 8
  for (const ln of wrap(lbl.codes + ": " + rep.refs, W, 7.5, false)) { doc.text(M, y + 7, ln, { size: 7.5, color: C.mut }); y += 9.5 }
  y += 6
  // ringkasan status
  const sh = 34
  doc.rect(M, y, W, sh, rep.ok ? C.okBg : C.badBg, rep.ok ? C.ok : C.bad, 0.8)
  doc.rect(M, y, 5, sh, rep.ok ? C.ok : C.bad)
  doc.text(M + 14, y + 14, rep.ok ? lbl.allOk : lbl.notOk, { size: 11, bold: true, color: rep.ok ? C.ok : C.bad })
  doc.text(M + 14, y + 27, wrap(rep.gov, W - 24, 8, false)[0], { size: 8, color: C.ink })
  y += sh + 8
  if (rep.metrics && rep.metrics.length) {
    const n = Math.min(4, rep.metrics.length), mw = (W - (n - 1) * 6) / n
    for (let r = 0; r < rep.metrics.length; r += n) {
      need(34)
      rep.metrics.slice(r, r + n).forEach(([k, v], i) => {
        const x = M + i * (mw + 6)
        doc.rect(x, y, mw, 30, C.box, C.line)
        doc.text(x + 6, y + 10, wrap(k, mw - 12, 6.8, false)[0], { size: 6.8, color: C.mut })
        doc.text(x + 6, y + 24, String(v), { size: 11.5, bold: true, color: C.head })
      })
      y += 36
    }
  }
  // tabel umum
  const table = (cols, rows, o = {}) => {
    const fs = o.fs || 7.4, pad = 3, lh = fs * 1.25
    const nC = cols.length
    let ws = o.w
    if (!ws) {
      ws = cols.map((c, j) => Math.min(Math.max(textWidth(winAnsi(c), fs, true), ...rows.slice(0, 80).map((r) => textWidth(winAnsi(cellText(r[j])), fs, false))) + 2 * pad + 2, W * 0.5))
    }
    const tot = ws.reduce((a, b) => a + b, 0), cw = ws.map((w) => w / tot * W)
    const headLines = cols.map((c, j) => wrap(c, cw[j] - 2 * pad, fs, true))
    const hh = Math.max(...headLines.map((l) => l.length)) * lh + 2 * pad
    const drawHead = () => {
      doc.rect(M, y, W, hh, C.head)
      let x = M
      headLines.forEach((ls, j) => { ls.forEach((ln, k) => doc.text(alignX(x, cw[j], pad, o.align && o.align[j]), y + pad + fs + k * lh, ln, { size: fs, bold: true, color: [1, 1, 1], align: o.align && o.align[j] === "r" ? "right" : o.align && o.align[j] === "c" ? "center" : undefined })); x += cw[j] })
      y += hh
    }
    need(hh + lh + 2 * pad); drawHead()
    rows.forEach((r, i) => {
      const cells = r.map((c0, j) => { const c = c0 && typeof c0 === "object" ? c0 : null; return { c, raw: c0, lines: wrap(cellText(c0), cw[j] - 2 * pad, fs, !!(c && c.bold)) } })
      const rh = Math.max(...cells.map((x) => x.lines.length)) * lh + 2 * pad
      if (y + rh > BOT) { newPage(); drawHead() }
      if (i % 2) doc.rect(M, y, W, rh, C.zebra)
      let x = M
      cells.forEach(({ c, lines }, j) => {
        const al = (c && c.align) || (o.align && o.align[j])
        if (c && c.bar != null && isFinite(c.bar)) {
          const bw = cw[j] - 2 * pad, fr = Math.max(0, Math.min(c.bar, 1))
          doc.rect(x + pad, y + rh - pad - 2.2, bw, 2.2, [0.88, 0.89, 0.9])
          doc.rect(x + pad, y + rh - pad - 2.2, bw * fr, 2.2, c.bar > 1 ? C.bad : c.bar > 0.9 ? C.warn : C.ok)
        }
        if (c && c.fill) doc.rect(x + 0.6, y + 0.6, cw[j] - 1.2, rh - 1.2, c.fill)
        lines.forEach((ln, k) => doc.text(alignX(x, cw[j], pad, al), y + pad + fs + k * lh, ln, { size: fs, bold: !!(c && c.bold), color: (c && c.color) || C.ink, align: al === "r" ? "right" : al === "c" ? "center" : undefined }))
        x += cw[j]
      })
      doc.line(M, y + rh, M + W, y + rh, C.line, 0.3)
      y += rh
    })
    y += 8
  }
  for (const s of rep.sections) {
    if (s.h) {
      need(40)
      y += 4
      doc.rect(M, y, 3, 12, C.acc)
      doc.text(M + 8, y + 10, s.h, { size: 11, bold: true, color: C.head }); y += 18
    }
    if (s.note) for (const ln of wrap(s.note, W, 7.6, false)) { need(10); doc.text(M, y + 7, ln, { size: 7.6, color: C.mut }); y += 9.5 }
    if (s.kv) {
      const rows = []
      for (let i = 0; i < s.kv.length; i += 2) {
        const a = s.kv[i], b = s.kv[i + 1]
        rows.push([{ t: a[0], color: C.mut }, { t: valU(a), bold: true }, b ? { t: b[0], color: C.mut } : "", b ? { t: valU(b), bold: true } : ""])
      }
      table([lbl.param, lbl.value, lbl.param, lbl.value], rows, { w: [30, 20, 30, 20] })
    }
    if (s.table) table(s.table.cols, s.table.rows, { align: s.table.align, w: s.table.w, fs: s.table.fs })
    if (s.checks) {
      const rows = s.checks.map((c, i) => [String(i + 1), { t: c.item }, { t: c.ref, color: C.mut }, { t: c.dem, align: "r" }, { t: c.cap, align: "r" }, { t: c.unit, color: C.mut },
        { t: c.urTxt, align: "r", bar: c.info ? null : c.ur, bold: true }, { t: c.info ? "INFO" : c.ok ? "OK" : "NOT OK", bold: true, align: "c", color: c.info ? C.mut : c.ok ? C.ok : C.bad, fill: c.info ? null : c.ok ? C.okBg : C.badBg }, { t: c.note, color: C.mut }])
      table(["#", lbl.check, lbl.ref, lbl.dem, lbl.cap, lbl.unit, "UR", lbl.status, lbl.combo], rows, { w: [3, 34, 13, 8, 8, 6, 7, 8, 13], align: ["c", "l", "l", "r", "r", "l", "r", "c", "l"], fs: 6.9 })
    }
    if (s.text) for (const p of s.text) { for (const ln of wrap(p, W, 8, false)) { need(11); doc.text(M, y + 8, ln, { size: 8 }); y += 10.5 } y += 3 }
    if (s.img) {
      const { bytes, w, h } = s.img, sc = Math.min(W / w, (s.img.maxH || 330) / h), dw = w * sc, dh = h * sc
      need(dh + 6)
      doc.image(bytes, w, h, M + (W - dw) / 2, y, dw, dh)
      doc.rect(M + (W - dw) / 2, y, dw, dh, null, C.line, 0.5)
      y += dh + 6
      if (s.img.cap) { doc.text(PW / 2, y + 7, s.img.cap, { size: 7.4, color: C.mut, align: "center" }); y += 12 }
    }
  }
  // kaki halaman (setelah jumlah halaman diketahui)
  const N = doc.pages.length
  doc.pages.forEach((ops, i) => {
    doc.cur = ops
    doc.line(M, PH - M - 10, PW - M, PH - M - 10, C.line, 0.6)
    doc.text(M, PH - M + 1, rep.copy, { size: 7.6, bold: true, color: C.head })
    doc.text(PW / 2, PH - M + 1, lbl.foot, { size: 6.8, color: C.mut, align: "center" })
    doc.text(PW - M, PH - M + 1, `${lbl.page} ${i + 1} / ${N}`, { size: 7.6, color: C.mut, align: "right" })
  })
  return doc.output()
}
const cellText = (c) => (c == null ? "" : typeof c === "object" ? String(c.t ?? "") : String(c))
const alignX = (x, w, pad, al) => (al === "r" ? x + w - pad : al === "c" ? x + w / 2 : x + pad)
const valU = (a) => (a[2] ? `${a[1]} ${a[2]}` : String(a[1]))
