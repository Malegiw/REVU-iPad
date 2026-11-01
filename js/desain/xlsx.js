// Penulis .xlsx minimal (Office Open XML) tanpa pustaka luar: ZIP metode "store" + CRC32, string inline, gaya sel (judul, kepala tabel, angka, OK/NOT OK),
// lebar kolom, sel gabung, kepala/kaki halaman cetak dengan hak cipta. Cukup untuk lembar hitungan yang dibuka di Excel / Numbers / Google Sheets.

const enc = new TextEncoder()
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
export function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }

// files: [[nama, Uint8Array | string]] → Uint8Array zip
export function zipStore(files, date = new Date()) {
  const dt = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xFFFF
  const dd = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF
  const chunks = [], central = []
  let off = 0
  for (const [name, data0] of files) {
    const data = typeof data0 === "string" ? enc.encode(data0) : data0, nm = enc.encode(name), crc = crc32(data)
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034B50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true)
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true)
    chunks.push(new Uint8Array(h.buffer), nm, data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014B50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true)
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true)
    central.push(new Uint8Array(c.buffer), nm)
    off += 30 + nm.length + data.length
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0)
  const e = new DataView(new ArrayBuffer(22))
  e.setUint32(0, 0x06054B50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true)
  const all = [...chunks, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((s, a) => s + a.length, 0))
  let p = 0; for (const a of all) { out.set(a, p); p += a.length }
  return out
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
const col = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }
// Gaya: 0 biasa, 1 judul, 2 subjudul, 3 kepala tabel, 4 teks berbingkai, 5 angka 0.00, 6 angka 0.000, 7 angka 0, 8 OK, 9 NOT OK, 10 judul bagian, 11 label tebal, 12 hak cipta, 13 angka 0.0, 14 info, 15 angka tebal 0.00
export const ST = { title: 1, sub: 2, head: 3, text: 4, n2: 5, n3: 6, n0: 7, ok: 8, bad: 9, sec: 10, lab: 11, copy: 12, n1: 13, info: 14, n2b: 15 }
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0.000"/></numFmts>
<fonts count="10">
<font><sz val="10"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF223246"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF5C6573"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FF1A7F37"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FFB42318"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FF223246"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><name val="Calibri"/></font>
<font><i/><sz val="9"/><color rgb="FF5C6573"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF5C6573"/><name val="Calibri"/></font>
</fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF27323F"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3F4E8"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDE4E1"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE9E6DF"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4F2ED"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFC4C9D0"/></left><right style="thin"><color rgb="FFC4C9D0"/></right><top style="thin"><color rgb="FFC4C9D0"/></top><bottom style="thin"><color rgb="FFC4C9D0"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="6" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="7" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="2" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

// sheet: { name, rows: [[sel]], widths: [lebar], merges: ["A1:F1"], head, foot }. Sel: null | string | number | {v, s}
function sheetXml(sh) {
  const rows = sh.rows.map((r, ri) => {
    const cells = r.map((c, ci) => {
      if (c == null || c === "") return ""
      const o = typeof c === "object" ? c : { v: c }
      const ref = col(ci) + (ri + 1)
      if (typeof o.v === "number" && isFinite(o.v)) return `<c r="${ref}"${o.s != null ? ` s="${o.s}"` : ""}><v>${o.v}</v></c>`
      const v = typeof o.v === "number" ? (o.v > 0 ? "∞" : o.v < 0 ? "−∞" : "–") : o.v
      return `<c r="${ref}" t="inlineStr"${o.s != null ? ` s="${o.s}"` : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    }).join("")
    const ht = sh.heights && sh.heights[ri] ? ` ht="${sh.heights[ri]}" customHeight="1"` : ""
    return `<row r="${ri + 1}"${ht}>${cells}</row>`
  }).join("")
  const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : ""
  const merges = sh.merges && sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""
  const hf = `<headerFooter><oddHeader>${esc(sh.head || "")}</oddHeader><oddFooter>${esc(sh.foot || "")}</oddFooter></headerFooter>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>${cols}<sheetData>${rows}</sheetData>${merges}
<pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>${hf}</worksheet>`
}

export function buildXlsx(sheets, meta = {}) {
  const safe = (n, i) => (String(n).replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || `Sheet${i + 1}`)
  const names = []
  sheets.forEach((s, i) => { let n = safe(s.name, i), k = 2; while (names.includes(n)) n = safe(s.name, i).slice(0, 28) + " " + k++; names.push(n) })
  const iso = new Date().toISOString().replace(/\.\d+Z$/, "Z")
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
    ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(meta.title || "")}</dc:title><dc:creator>${esc(meta.author || "")}</dc:creator><cp:lastModifiedBy>${esc(meta.author || "")}</cp:lastModifiedBy><dc:rights>${esc(meta.rights || "")}</dc:rights>
<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`],
    ["docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>YMD-CAL</Application><Company>${esc(meta.author || "")}</Company></Properties>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ]
  return zipStore(files)
}
