// Penyimpanan & impor dokumen RTS di perangkat: IndexedDB ("ymd-rts"), pembaca PDF (pdf.js, js/vendor), DOCX/XLSX (unzip bawaan peramban),
// TXT/MD/CSV, dan paket JSON. Tidak ada yang dikirim ke server; isi standar perusahaan tetap di iPad pengguna.
import { detectDocMeta, detectCategory, detectDiscipline, DISCS, makeDisc, splitSections, textToPages, pdfItemsToLines } from "./rts.js"

const DB = "ymd-rts", VER = 1
let dbp = null
function db() {
  if (dbp) return dbp
  dbp = new Promise((res, rej) => {
    if (!self.indexedDB) return rej(new Error("IndexedDB tidak tersedia"))
    const r = indexedDB.open(DB, VER)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "id" })
      if (!d.objectStoreNames.contains("files")) d.createObjectStore("files", { keyPath: "id" })
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error || new Error("IndexedDB gagal dibuka"))
  })
  dbp.catch(() => { dbp = null })
  return dbp
}
const tx = async (store, mode, fn) => {
  const d = await db()
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), r = fn(t.objectStore(store))
    t.oncomplete = () => res(r ? r.result : undefined)
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("transaksi dibatalkan"))
  })
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

export async function listDocs() {
  const d = await db()
  return req(d.transaction("docs").objectStore("docs").getAll())
}
export const putDoc = (doc) => tx("docs", "readwrite", (s) => s.put(doc))
export const putFile = (id, blob, name, type) => tx("files", "readwrite", (s) => s.put({ id, blob, name, type }))
export async function getFile(id) { const d = await db(); return req(d.transaction("files").objectStore("files").get(id)) }
// id dokumen yang berkas aslinya tersimpan (untuk tombol Lihat / Bagikan berkas asli)
export async function fileIds() { const d = await db(); return new Set(await req(d.transaction("files").objectStore("files").getAllKeys())) }
export async function delDoc(id) { await tx("docs", "readwrite", (s) => s.delete(id)); await tx("files", "readwrite", (s) => s.delete(id)) }
export async function clearAll() { await tx("docs", "readwrite", (s) => s.clear()); await tx("files", "readwrite", (s) => s.clear()) }
export async function usage() { try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null } catch (e) { return null } }
export async function persist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false } catch (e) { return false } }

// ---------------------------------------------------------------- disiplin tambahan pengguna (di perangkat ini, localStorage)
const DKEY = "ymd.rts.discs.v1"
let discCache = null, allCache = null
// [{ id, name, codes }]
export function customDiscs() {
  if (discCache) return discCache
  try { const a = JSON.parse(localStorage.getItem(DKEY) || "[]"); discCache = (Array.isArray(a) ? a : []).filter((d) => d && d.id && d.name).map((d) => ({ id: String(d.id), name: String(d.name), codes: Array.isArray(d.codes) ? d.codes.map(String) : [] })) } catch (e) { discCache = [] }
  return discCache
}
export function saveCustomDiscs(list) { discCache = list; allCache = null; try { localStorage.setItem(DKEY, JSON.stringify(list)) } catch (e) { /* tanpa penyimpanan */ } }
// semua disiplin: bawaan (Civil) lalu tambahan pengguna, bentuk seragam untuk deteksi & tampilan
export function allDiscs() { if (!allCache) allCache = [...DISCS, ...customDiscs().map(makeDisc)]; return allCache }

// ---------------------------------------------------------------- pembaca berkas
const ext = (n) => (String(n).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || ""
export const ACCEPT = ".pdf,.docx,.xlsx,.txt,.md,.csv,.json"
let pdfjs = null
export async function loadPdfjs() {
  if (pdfjs) return pdfjs
  pdfjs = await import("./vendor/pdf.min.mjs")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href
  return pdfjs
}
async function pdfPages(buf, onProg, max = Infinity) {
  const lib = await loadPdfjs()
  const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise
  const pages = []
  for (let i = 1; i <= Math.min(doc.numPages, max); i++) {
    const pg = await doc.getPage(i)
    const tc = await pg.getTextContent()
    pages.push(pdfItemsToLines(tc.items))
    pg.cleanup()
    if (onProg) onProg(i / doc.numPages, `${i}/${doc.numPages}`)
  }
  await doc.destroy()
  return pages
}
// baris beberapa halaman pertama PDF tersimpan (untuk memperbaiki judul dokumen yang sudah diimpor)
export const pdfHeadPages = async (blob, n = 3) => pdfPages(await blob.arrayBuffer(), null, n)
// ZIP (DOCX/XLSX): direktori pusat → isi berkas; deflate dibuka dengan DecompressionStream("deflate-raw")
export async function unzip(buf, want) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let e = u8.length - 22
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--
  if (e < 0) throw new Error("bukan berkas ZIP")
  const n = dv.getUint16(e + 10, true)
  let p = dv.getUint32(e + 16, true)
  const out = {}
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true)
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl))
    p += 46 + nl + xl + cl
    if (want && !want(name)) continue
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true)
    const data = u8.subarray(ds, ds + csize)
    if (method === 0) out[name] = data
    else if (method === 8) {
      if (!self.DecompressionStream) throw new Error("peramban belum mendukung DecompressionStream (perbarui iPadOS ≥ 16.4)")
      const st = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
      out[name] = new Uint8Array(await new Response(st).arrayBuffer())
    }
  }
  return out
}
const xmlText = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&")
// DOCX: paragraf → baris; gaya Heading N diberi nomor otomatis "5.2.1" agar dikenali sebagai judul pasal; tabel → sel dipisah " | "
export function docxLines(xml) {
  const lines = [], cnt = [0, 0, 0, 0, 0, 0]
  const body = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const rows = (tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map((tr) => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) => paraText(tc).trim()).join(" | "))
    return `<w:p><w:r><w:t>${rows.join("\u2029")}</w:t></w:r></w:p>`
  })
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) || []) {
    const sty = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || ""
    const t = paraText(p)
    const hm = sty.match(/^(?:Heading|Judul)\s*([1-6])$/i)
    if (hm && t.trim()) {
      // judul bergaya Heading: nomor otomatis Word tidak ada di teks → beri nomor urut; tandai "§§no<TAB>judul" (judul pasti)
      const lv = Number(hm[1]) - 1, own = t.trim().match(/^((?:\d+\.)*\d+)\.?\s+(.*)$/)
      cnt[lv]++; for (let k = lv + 1; k < cnt.length; k++) cnt[k] = 0
      lines.push(own ? `\u00A7\u00A7${own[1]}\t${own[2]}` : `\u00A7\u00A7${cnt.slice(0, lv + 1).map((x) => x || 1).join(".")}\t${t.trim()}`)
    } else lines.push(...t.split("\u2029"))
  }
  return lines
  function paraText(x) { return xmlText((x.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || []).map((r) => (r === "<w:tab/>" ? "\t" : r === "<w:br/>" ? "\n" : r.replace(/<[^>]+>/g, ""))).join("")) }
}
// XLSX: tiap lembar = satu "halaman"; baris = sel dipisah " | "
export function xlsxPages(files) {
  const dec = new TextDecoder()
  const ss = files["xl/sharedStrings.xml"] ? (dec.decode(files["xl/sharedStrings.xml"]).match(/<si>[\s\S]*?<\/si>/g) || []).map((si) => xmlText((si.match(/<t[^>]*>[^<]*<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))) : []
  const names = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
  return names.map((n) => (dec.decode(files[n]).match(/<row[ >][\s\S]*?<\/row>/g) || []).map((row) => (row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).map((c) => {
    const tt = (c.match(/ t="(\w+)"/) || [])[1], v = (c.match(/<v>([^<]*)<\/v>/) || [])[1], is = (c.match(/<t[^>]*>([^<]*)<\/t>/) || [])[1]
    return tt === "s" ? ss[Number(v)] ?? "" : tt === "inlineStr" ? xmlText(is || "") : xmlText(v || "")
  }).filter((x) => x !== "").join(" | ")).filter(Boolean))
}
const uid = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// berkas → dokumen siap simpan { id, docNo, title, rev, cat, fileName, size, type, pages, secs, addedAt, warn }
export async function parseFile(file, onProg) {
  const e = ext(file.name), buf = await file.arrayBuffer()
  let pages, warn = ""
  if (e === "pdf") pages = await pdfPages(buf, onProg)
  else if (e === "docx") { const f = await unzip(buf, (n) => n === "word/document.xml"); if (!f["word/document.xml"]) throw new Error("word/document.xml tidak ditemukan"); pages = [docxLines(new TextDecoder().decode(f["word/document.xml"]))] }
  else if (e === "xlsx") pages = xlsxPages(await unzip(buf, (n) => n.startsWith("xl/sharedStrings") || n.startsWith("xl/worksheets/sheet")))
  else if (["txt", "md", "csv"].includes(e)) pages = textToPages(new TextDecoder().decode(buf))
  else throw new Error(`format .${e || "?"} belum didukung (PDF, DOCX, XLSX, TXT, MD, CSV, JSON)`)
  const chars = pages.reduce((a, p) => a + p.join("").length, 0)
  if (e === "pdf" && chars < 40 * pages.length) warn = "scan"            // PDF hasil pindai tanpa lapisan teks
  const meta = detectDocMeta(pages, file.name)
  const secs = splitSections(pages)
  return { id: uid(), ...meta, disc: detectDiscipline(meta.docNo, meta.title, file.name, allDiscs()), fileName: file.name, size: file.size, type: e, pages: pages.length, chars, secs, addedAt: Date.now(), warn }
}
// paket JSON (ekspor dari perangkat lain / hasil tools): { format: "ymd-rts-pack", docs: [...] }
export function parsePack(txt) {
  const o = JSON.parse(txt)
  const docs = Array.isArray(o) ? o : o && Array.isArray(o.docs) ? o.docs : null
  if (!docs) throw new Error("bukan paket RTS (butuh { docs: [...] })")
  return docs.filter((d) => d && Array.isArray(d.secs)).map((d) => ({ id: d.id || uid(), docNo: d.docNo || d.fileName || "RTS", title: d.title || "", rev: d.rev || "", fileName: d.fileName || "", size: d.size || 0, type: d.type || "json", pages: d.pages || 0, chars: d.chars || 0, cat: d.cat || detectCategory(d.docNo || d.fileName || "", d.title || "", d.fileName || ""), disc: d.disc || detectDiscipline(d.docNo || d.fileName || "", d.title || "", d.fileName || "", allDiscs()), ...(d.catManual ? { catManual: true } : {}), ...(d.discManual ? { discManual: true } : {}), ...(d.titleManual ? { titleManual: true } : {}),
    secs: d.secs.map((s) => ({ no: String(s.no ?? ""), title: String(s.title ?? ""), page: Number(s.page) || 1, text: String(s.text ?? ""), ...(s.parent ? { parent: String(s.parent) } : {}), ...(s.part ? { part: s.part } : {}) })), addedAt: d.addedAt || Date.now(), warn: d.warn || "", tags: d.tags || [] }))
}
export const makePack = (docs) => JSON.stringify({ format: "ymd-rts-pack", v: 1, made: new Date().toISOString(), discs: customDiscs(), docs: docs.map(({ id, docNo, title, rev, cat, catManual, disc, discManual, titleManual, fileName, size, type, pages, chars, secs, addedAt, warn, tags }) => ({ id, docNo, title, rev, cat, catManual, disc, discManual, titleManual, fileName, size, type, pages, chars, secs, addedAt, warn, tags })) })
// definisi disiplin tambahan di dalam paket (agar disiplin ikut pindah ke perangkat lain)
export function packDiscs(txt) {
  try { const o = JSON.parse(txt); return (o && Array.isArray(o.discs) ? o.discs : []).filter((d) => d && d.id && d.name).map((d) => ({ id: String(d.id), name: String(d.name), codes: Array.isArray(d.codes) ? d.codes.map(String) : [] })) } catch (e) { return [] }
}

// impor banyak berkas sekaligus; onProg(i, n, frac, note, name)
export async function importFiles(files, onProg, keepOriginal = true) {
  const done = [], errs = []
  let i = 0
  for (const f of files) {
    i++
    try {
      if (ext(f.name) === "json") {
        const txt = await f.text()
        const have = customDiscs(), add = packDiscs(txt).filter((x) => !have.some((h) => h.id === x.id) && !DISCS.some((b) => b.id === x.id))
        if (add.length) saveCustomDiscs([...have, ...add])
        for (const d of parsePack(txt)) { await putDoc(d); done.push(d) }
      } else {
        const d = await parseFile(f, (fr, note) => onProg && onProg(i, files.length, fr, note, f.name))
        await putDoc(d)
        if (keepOriginal && (d.type === "pdf" || d.type === "docx" || d.type === "xlsx")) { try { await putFile(d.id, f, f.name, f.type) } catch (e) { /* tanpa berkas asli */ } }
        done.push(d)
      }
    } catch (e) { errs.push({ name: f.name, msg: e.message || String(e) }) }
    if (onProg) onProg(i, files.length, 1, "", f.name)
  }
  return { done, errs }
}
