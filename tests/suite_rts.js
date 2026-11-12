// Kelompok uji pencarian RTS (js/rts.js, js/rts_store.js): token & sinonim Indonesia–Inggris, nilai teknis (MPa, mm, %, K-xxx, ASTM Grade),
// judul pasal, pembuangan kepala/kaki halaman, penyambungan baris PDF, nomor dokumen, peringkat BM25, cuplikan, parameter kunci,
// cek kepatuhan, baris dari item teks PDF, DOCX/XLSX, dan paket JSON. Dokumen uji di sini fiktif (bukan isi RTS sebenarnya).
import * as R from "../js/rts.js"
import { docxLines, xlsxPages, parsePack, makePack, unzip } from "../js/rts_store.js"
import { zipStore } from "../js/desain/xlsx.js"

export async function run({ check }) {
  const truthy = (name, cond, msg) => check(name, cond ? [] : [msg || "gagal"])
  const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want) ? [] : [`${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`])
  const near = (name, got, want, tol = 1e-6) => check(name, Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)) ? [] : [`${got} ≠ ${want}`])

  // ---- token, kata umum, stemer
  eq("tokens: kata umum dibuang, fc' → fc, desimal koma → titik", R.tokens("Beton pondasi pakai mutu berapa? fc' 28,5 MPa"), ["beton", "pondasi", "mutu", "fc", "28.5", "mpa"])
  eq("stemer: jamak Inggris, kata Indonesia berakhiran -as tetap", ["bolts", "piles", "kelas", "batas", "areas", "processes"].map(R.stem), ["bolt", "pile", "kelas", "batas", "area", "process"])

  // ---- kueri & sinonim
  const g1 = R.parseQuery("baut angkur")
  truthy("frasa 'baut angkur' jadi satu kelompok berisi 'anchor bolt'", g1.length === 1 && g1[0].terms.has("§anchor bolt") && g1[0].terms.has("bolt"))
  const g2 = R.parseQuery("beton concrete selimut")
  truthy("kata sekonsep digabung (beton + concrete = 1 kelompok)", g2.length === 2 && g2[0].terms.has("concrete") && g2[1].terms.has("cover"))
  truthy("lantai kerja → lean concrete / blinding", R.parseQuery("lantai kerja")[0].terms.has("§lean concrete") && R.parseQuery("lantai kerja")[0].terms.has("blinding"))

  // ---- nilai teknis
  const v = R.extractValues("min. 28 MPa (4000 psi) at 28 days; cover 75 mm; 3 in. clear; K-300; ASTM A615 Grade 60; BJTS 420; 95% MDD; 85 µm; V = 33 m/s; Section 4 in this")
  const by = (t) => v.find((x) => x.txt === t)
  truthy("28 MPa → tegangan", by("28 MPa") && by("28 MPa").kind === "stress" && by("28 MPa").v === 28)
  near("4000 psi → 27,58 MPa", R.toBase(by("4000 psi").v, "psi"), 27.579, 1e-4)
  truthy("28 days → waktu; 75 mm & 3 in. → panjang", by("28 days").kind === "time" && by("75 mm").kind === "length" && by("3 in.").kind === "length")
  near("3 in. → 76,2 mm", R.toBase(3, "in."), 76.2, 1e-12)
  near("K-300 → fc' ≈ 0,083·300 = 24,9 MPa", by("K-300").v, 24.9, 1e-9)
  near("ASTM A615 Grade 60 → 60 ksi ≈ 413,7 MPa", by("ASTM A615 Grade 60").v, 60 * 6.89476, 1e-9)
  truthy("BJTS 420 → 420 MPa", by("BJTS 420").v === 420)
  truthy("95% → persen; 85 µm → film; 33 m/s → kecepatan (bukan 33 m)", by("95%").kind === "percent" && by("85 µm").kind === "film" && by("33 m/s").kind === "speed")
  truthy("'4 in this' tidak dibaca sebagai 4 inci", !v.some((x) => x.txt.startsWith("4 in")))
  const vp = R.extractValues("factor of safety shall be 3.0 and w/c 0.45; clause 5.2.1 applies", { plain: true }).filter((x) => x.kind === "num").map((x) => x.v)
  eq("angka tanpa satuan hanya bila diminta; nomor pasal 5.2.1 bukan angka", vp, [3, 0.45])
  truthy("tanpa opsi plain, angka polos tidak disorot", !R.extractValues("shall be 3.0").length)

  // ---- judul pasal
  const H = (l) => R.isHeading(l)
  truthy("'5.2.1 Concrete Strength' & '5.2.1. Mutu Beton' = judul", H("5.2.1 Concrete Strength").no === "5.2.1" && H("5.2.1. Mutu Beton").no === "5.2.1")
  truthy("'SECTION 3 – MATERIALS' = judul", H("SECTION 3 – MATERIALS").no === "SECTION 3")
  truthy("butir daftar '1. The contractor shall provide' bukan judul", H("1. The contractor shall provide") === null)
  truthy("'2.5 MPa minimum' bukan judul; baris daftar isi bukan judul", H("2.5 MPa minimum") === null && H("3. CONCRETE ......... 12") === null)
  truthy("kalimat bernomor panjang bukan judul", H("4.3 Concrete shall be placed within 90 minutes after batching.") === null)

  // ---- halaman → bagian
  const pages = [
    ["RTS-CIV-901   Rev. 1", "SAMPLE CONCRETE SPECIFICATION", "1. GENERAL", "This sample covers foundations.", "2. MATERIALS", "2.1 Reinforcing Steel", "Bars shall be ASTM A615 Grade 60.", "Page 1 of 3"],
    ["RTS-CIV-901   Rev. 1", "SAMPLE CONCRETE SPECIFICATION", "3. CONCRETE", "3.1 Concrete Strength", "Structural concrete for foundations shall have a minimum compressive", "strength of 28 MPa at 28 days.", "a) Lean concrete shall be 50 mm thick.", "Page 2 of 3"],
    ["RTS-CIV-901   Rev. 1", "SAMPLE CONCRETE SPECIFICATION", "3.2 Concrete Cover", "Minimum cover for concrete cast against earth is 75 mm.", "4. EARTHWORK", "Backfill shall be compacted to 95% of maximum dry density.", "The factor of safety against bearing failure shall be 3.0.", "Page 3 of 3"],
  ]
  const meta = R.detectDocMeta(pages, "x.pdf")
  eq("nomor dokumen, revisi, judul", [meta.docNo, meta.rev, meta.title], ["RTS-CIV-901", "1", "SAMPLE CONCRETE SPECIFICATION"])
  const secs = R.splitSections(pages)
  eq("pasal terbaca berurutan", secs.map((s) => s.no), ["1", "2.1", "3.1", "3.2", "4"])
  truthy("kepala/kaki halaman berulang dibuang", !secs.some((s) => /Page \d|SAMPLE CONCRETE|RTS-CIV-901/.test(s.text)))
  const s31 = secs.find((s) => s.no === "3.1")
  truthy("baris PDF terpotong disambung; butir a) tetap baris baru", s31.text.includes("minimum compressive strength of 28 MPa") && /\na\) Lean/.test(s31.text))
  truthy("judul kosong menjadi induk ('3 CONCRETE') dan halaman tercatat", s31.parent === "3 CONCRETE" && s31.page === 2)
  eq("reflow", R.reflow(["one two", "three.", "1. item", "x   y", "z"]), "one two three.\n1. item\nx   y\nz")

  // ---- pencarian
  const ix = R.buildIndex([{ id: "a", ...meta, secs }])
  const top = (q, o) => R.search(ix, q, o)[0]
  const r1 = top("beton pondasi pakai mutu berapa")
  truthy("“beton pondasi pakai mutu berapa” → §3.1 (Inggris), semua kata cocok", r1 && r1.sec.no === "3.1" && r1.hit === r1.of, r1 && r1.sec.no)
  truthy("jawaban cepat memuat 28 MPa", r1.values.some((x) => x.txt === "28 MPa"))
  truthy("“selimut beton” → §3.2", top("selimut beton").sec.no === "3.2")
  truthy("“lantai kerja” → §3.1 dengan cuplikan lean concrete", top("lantai kerja").sec.no === "3.1" && /Lean concrete/.test(top("lantai kerja").best))
  truthy("“pemadatan timbunan” → §4 (95%)", top("pemadatan timbunan").sec.no === "4")
  truthy("“mutu tulangan” → §2.1", top("mutu tulangan").sec.no === "2.1")
  truthy("filter dokumen lain → kosong", R.search(ix, "beton", { docId: "zzz" }).length === 0)
  truthy("kata tak dikenal → kosong", R.search(ix, "helikopter").length === 0)
  const sp = R.termSpans("The factor of safety shall be 3.0", R.parseQuery("faktor keamanan"))
  truthy("frasa dengan kata umum di tengah ('factor of safety') tersorot utuh", sp.length && sp[0][0] === 4 && sp[0][1] === 20)
  const sn = R.snippet("Intro text. The factor of safety shall be 3.0. Other.", R.parseQuery("faktor keamanan"), ["num"])
  truthy("titik desimal bukan akhir kalimat (cuplikan memuat 3.0)", sn.best === "The factor of safety shall be 3.0." && sn.values[0].v === 3)

  // ---- parameter kunci & kepatuhan
  const P = (id) => R.PARAMS.find((p) => p.id === id)
  const cand = (id) => R.findParam(ix, P(id), 3)[0]
  truthy("parameter fc' → 28 MPa", cand("fc") && cand("fc").vals.some((x) => x.txt === "28 MPa"))
  truthy("parameter selimut → 75 mm", cand("cover") && cand("cover").vals[0].txt === "75 mm")
  truthy("parameter FS → 3.0", cand("fs") && cand("fs").vals.some((x) => x.v === 3))
  truthy("parameter pemadatan → 95%", cand("compact") && cand("compact").vals[0].txt === "95%")
  near("pinNumber: 4000 psi → MPa", R.pinNumber({ txt: "4000 psi" }, P("fc")), 27.579, 1e-4)
  near("pinNumber: 3 in. → mm", R.pinNumber({ txt: "3 in." }, P("cover")), 76.2, 1e-9)
  near("pinNumber: Grade 60 → MPa", R.pinNumber({ txt: "ASTM A615 Grade 60" }, P("fy")), 413.6856, 1e-6)
  const rows = R.complianceRows({ fc: { txt: "28 MPa" }, cover: { txt: "75 mm" }, settle: { txt: "25 mm" }, bolt: { txt: "ASTM F1554 Grade 36" }, lean: { txt: "50 mm" } },
    [{ param: "fc", val: 30 }, { param: "fc", val: 25 }, { param: "cover", val: 50 }, { param: "settle", val: 50 }, { param: "bolt", val: "ASTM F1554 Gr.36" }, { param: "bolt", val: "ASTM A307 Gr.A" }, { param: "lean", val: 10 }])
  eq("kepatuhan: min/maks/spesifikasi; parameter info tidak dicek", rows.map((r) => [r.p.id, r.ok]), [["fc", true], ["fc", false], ["cover", false], ["bolt", true], ["bolt", false], ["settle", false]])

  // ---- PDF: item teks → baris
  const items = [{ str: "3.1", transform: [1, 0, 0, 10, 50, 700], width: 12, height: 10 }, { str: "Concrete", transform: [1, 0, 0, 10, 70, 700.5], width: 40, height: 10 },
    { str: "Strength", transform: [1, 0, 0, 10, 112, 700], width: 40, height: 10 }, { str: "Next line", transform: [1, 0, 0, 10, 50, 680], width: 40, height: 10 }, { str: "col B", transform: [1, 0, 0, 10, 300, 680], width: 20, height: 10 }]
  eq("item PDF → baris (urut y lalu x, kolom berjauhan dipisah 3 spasi)", R.pdfItemsToLines(items), ["3.1 Concrete Strength", "Next line   col B"])

  // ---- DOCX / XLSX / ZIP
  const dx = '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>General</w:t></w:r></w:p><w:p><w:r><w:t>Body &amp; text</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Compaction</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Lift</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>200 mm</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'
  const dl = docxLines(dx)
  eq("DOCX: Heading diberi nomor & ditandai, tabel → sel ' | '", dl, ["§§1\tGeneral", "Body & text", "§§1.1\tCompaction", "Lift | 200 mm"])
  eq("DOCX: judul bertanda selalu jadi pasal", R.splitSections([dl]).map((s) => [s.no, s.title]), [["1", "General"], ["1.1", "Compaction"]])
  const enc = (s) => new TextEncoder().encode(s)
  const zip = zipStore([["xl/sharedStrings.xml", enc('<sst><si><t>Item</t></si><si><t>fc&apos;</t></si></sst>')], ["xl/worksheets/sheet1.xml", enc('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Beton</t></is></c><c r="B2"><v>28</v></c></row></sheetData></worksheet>')]])
  const files = await unzip(zip.buffer)
  eq("XLSX: lembar → baris sel ' | '", xlsxPages(files), [["Item | fc'", "Beton | 28"]])

  if (self.CompressionStream) {
    const raw = enc("<w:document><w:body><w:p><w:r><w:t>Deflate OK</w:t></w:r></w:p></w:body></w:document>")
    const def = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer())
    const z = zipStore([["word/document.xml", def]])
    new DataView(z.buffer).setUint16(8, 8, true)                                      // metode 8 (deflate) di kepala lokal
    const cd = z.length - 22 - 46 - "word/document.xml".length; new DataView(z.buffer).setUint16(cd + 10, 8, true)   // dan di direktori pusat
    const f2 = await unzip(z.buffer)
    eq("ZIP deflate dibuka dengan DecompressionStream", docxLines(new TextDecoder().decode(f2["word/document.xml"])), ["Deflate OK"])
  }

  // ---- paket JSON
  const pk = parsePack(makePack([{ id: "a", ...meta, secs, fileName: "x.pdf", pages: 3 }]))
  truthy("paket JSON ekspor → impor utuh", pk.length === 1 && pk[0].docNo === "RTS-CIV-901" && pk[0].secs.length === secs.length && pk[0].secs[1].text === secs[1].text)
  let bad = ""
  try { parsePack('{"x":1}') } catch (e) { bad = e.message }
  truthy("paket tidak sah ditolak", /paket RTS/.test(bad))
}
