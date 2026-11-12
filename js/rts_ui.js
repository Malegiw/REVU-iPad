// Tab "RTS" (Rokan Technical Standard): pustaka dokumen standar di perangkat, pencarian bebas Indonesia/Inggris dengan sorotan & nilai teknis,
// parameter kunci desain (mutu beton, selimut, tulangan, grout, baut angkur, galvanis, pemadatan …) yang bisa ditetapkan dari pasal RTS,
// dan cek kepatuhan masukan modul Desain terhadap nilai RTS tersebut. Mesin: js/rts.js; penyimpanan & impor: js/rts_store.js.
import { L, lang, nf, AUTHOR } from "./desain/core.js"
import { el, exportBar, reveal, tableView } from "./desain/ui.js"
import { projLoad } from "./project.js"
import { initUnits, hero, card, footer } from "./pj_ui.js"
import { ico } from "./icons.js"
import { buildIndex, search, findParam, PARAMS, PARAM_GROUPS, extractValues, parseQuery, termSpans, complianceRows, pinNumber, fold } from "./rts.js"
import * as store from "./rts_store.js"

const KEY = "ymd.rts.v1"
const loadSt = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); return { pins: {}, recent: [], q: "", doc: "", ...(o || {}) } } catch (e) { return { pins: {}, recent: [], q: "", doc: "" } } }
const saveSt = (S) => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* tanpa penyimpanan */ } }
export const rtsPins = () => loadSt().pins

let DOCS = null, IX = null     // cache selama app terbuka
const kb = (n) => (n > 1048576 ? `${nf(n / 1048576, 1)} MB` : `${nf(n / 1024, 0)} kB`)
const refOf = (doc, sec) => `${doc.docNo}${doc.rev ? " Rev." + doc.rev : ""}${sec ? ` · ${sec.no ? "§" + sec.no + " " : ""}${sec.title || ""}${sec.page ? ` · ${L("hal.", "p.")} ${sec.page}` : ""}` : ""}`.trim()

export function mountRts(box, ctx) {
  lang.cur = ctx.lang
  initUnits()
  const S = loadSt()
  box.textContent = ""
  const libBox = el("div"), searchBox = el("div"), paramBox = el("div"), cmpBox = el("div"), expBox = el("div", "dz-expbox dz-in")
  box.append(hero(L("Referensi · Rokan Technical Standard", "Reference · Rokan Technical Standard"), L("RTS — cari persyaratan standar", "RTS — find standard requirements"),
    L("Tanya bebas dalam bahasa Indonesia atau Inggris — mis. “beton pondasi pakai mutu berapa?”, “selimut beton”, “baut angkur”, “pemadatan timbunan”. Hasil menunjuk nomor dokumen, pasal & halaman, menyorot nilai (MPa, mm, %, ASTM …), dan nilainya bisa ditetapkan lalu dicek terhadap modul Desain.",
      "Ask freely in Indonesian or English — e.g. “what concrete grade for foundations?”, “concrete cover”, “anchor bolts”, “backfill compaction”. Results point to the document number, clause & page, highlight values (MPa, mm, %, ASTM …), which you can pin and check against the Design modules."),
    [L("Offline di iPad", "Offline on iPad"), "PDF · DOCX · XLSX", L("Sinonim ID ↔ EN", "ID ↔ EN synonyms"), L("Cek kepatuhan Desain", "Design compliance check")]), searchBox, paramBox, cmpBox, libBox, expBox, footer())

  // ---------------------------------------------------------------- pustaka
  async function loadDocs(force) {
    if (DOCS && !force) return DOCS
    try { DOCS = (await store.listDocs()).sort((a, b) => fold(a.docNo).localeCompare(fold(b.docNo))) } catch (e) { DOCS = []; DOCS.err = e.message }
    IX = null
    return DOCS
  }
  const index = () => { if (!IX) IX = buildIndex(DOCS || []); return IX }

  let importMsg = ""
  function drawLib() {
    libBox.textContent = ""
    const docs = DOCS || [], nSec = docs.reduce((a, d) => a + d.secs.length, 0)
    const body = []
    const drop = el("label", "rt-drop")
    const inp = el("input"); inp.type = "file"; inp.multiple = true; inp.accept = store.ACCEPT
    const icD = el("span", "rt-drop-ic"); icD.append(ico("download"))
    const dt = el("span", "rt-drop-tx")
    dt.append(el("b", null, L("Impor dokumen RTS", "Import RTS documents")), el("small", null, L("Pilih PDF / DOCX / XLSX / TXT (boleh banyak sekaligus) dari Files / iCloud Drive, atau paket .json dari perangkat lain.", "Pick PDF / DOCX / XLSX / TXT (many at once) from Files / iCloud Drive, or a .json pack from another device.")))
    drop.append(inp, icD, dt)
    const prog = el("div", "rt-prog"); prog.hidden = !importMsg
    const bar = el("i"), ptx = el("span", null, importMsg); prog.append(bar, ptx)
    if (importMsg) bar.style.width = "100%"
    inp.onchange = async () => {
      const files = [...inp.files]; if (!files.length) return
      prog.hidden = false; drop.classList.add("busy")
      store.persist()
      const r = await store.importFiles(files, (i, n, fr, note, name) => { bar.style.width = `${Math.round(((i - 1 + fr) / n) * 100)}%`; ptx.textContent = `${i}/${n} · ${name}${note ? " · " + L("hal.", "p.") + " " + note : ""}` })
      drop.classList.remove("busy"); inp.value = ""
      await loadDocs(true)
      const scan = r.done.filter((d) => d.warn === "scan")
      importMsg = ptx.textContent = `${L("Selesai", "Done")}: ${r.done.length} ${L("dokumen", "documents")}${r.errs.length ? ` · ${r.errs.length} ${L("gagal", "failed")}: ${r.errs.map((e) => `${e.name} (${e.msg})`).join("; ")}` : ""}${scan.length ? ` · ⚠️ ${scan.length} ${L("PDF hasil scan tanpa teks (perlu OCR di komputer dulu)", "scanned PDFs without text (OCR them on a computer first)")}` : ""}`
      bar.style.width = "100%"
      drawAll()
    }
    body.push(drop, prog)
    body.push(el("p", "dz-note", L("🔒 Dokumen hanya disimpan di perangkat ini (IndexedDB) dan tidak diunggah ke mana pun. Repo aplikasi bersifat publik, jadi isi RTS sengaja tidak dimasukkan ke dalam aplikasi.", "🔒 Documents are stored only on this device (IndexedDB) and never uploaded. The app repository is public, so RTS content is deliberately not bundled with the app.")))
    if (DOCS && DOCS.err) body.push(el("div", "err", DOCS.err))
    if (docs.length) {
      const list = el("div", "rt-docs")
      docs.forEach((d, i) => {
        const row = el("details", "rt-doc dz-in"); row.style.setProperty("--i", i)
        const sm = el("summary")
        const tx = el("span", "rt-doc-tx")
        tx.append(el("b", null, d.docNo + (d.rev ? ` · Rev.${d.rev}` : "")), el("span", null, d.title || d.fileName), el("small", null, `${d.type.toUpperCase()} · ${d.pages} ${L("hal.", "pp.")} · ${d.secs.length} ${L("pasal", "clauses")}${d.size ? " · " + kb(d.size) : ""}${d.warn === "scan" ? " · ⚠️ " + L("scan, teks kosong", "scanned, no text") : ""}`))
        sm.append(el("span", "rt-badge", d.type.toUpperCase()), tx)
        row.append(sm)
        const acts = el("div", "rt-acts")
        const bOpen = el("button", "rt-btn", L("Buka berkas asli", "Open original")); bOpen.type = "button"
        bOpen.onclick = async () => { const f = await store.getFile(d.id).catch(() => null); if (!f) { bOpen.textContent = L("Berkas asli tidak disimpan", "Original not stored"); return } window.open(URL.createObjectURL(f.blob), "_blank") }
        const bFind = el("button", "rt-btn", L("Cari di dokumen ini", "Search this document")); bFind.type = "button"
        bFind.onclick = () => { S.doc = d.id; saveSt(S); drawSearch(); searchBox.scrollIntoView({ behavior: "smooth" }) }
        const bDel = el("button", "rt-btn danger", L("Hapus", "Delete")); bDel.type = "button"
        bDel.onclick = async () => { if (!confirm(L(`Hapus ${d.docNo} dari perangkat ini?`, `Delete ${d.docNo} from this device?`))) return; await store.delDoc(d.id); if (S.doc === d.id) { S.doc = ""; saveSt(S) } await loadDocs(true); drawAll() }
        acts.append(bOpen, bFind, bDel)
        const toc = el("ol", "rt-toc")
        d.secs.slice(0, 400).forEach((s) => { if (!s.title || s.part > 1) return; const li = el("li"); const a = el("button", "rt-toc-a"); a.type = "button"; a.append(el("b", null, s.no || "•"), el("span", null, s.title), el("small", null, `${L("hal.", "p.")} ${s.page}`)); a.onclick = () => openSection(d, s); li.append(a); toc.append(li) })
        row.append(acts, el("div", "dz-sub", L("Daftar pasal", "Clauses")), toc)
        list.append(row)
      })
      body.push(list)
      const tools = el("div", "rt-acts")
      const bPack = el("button", "rt-btn", L("Ekspor paket (.json)", "Export pack (.json)")); bPack.type = "button"
      bPack.onclick = () => { const a = el("a"); a.href = URL.createObjectURL(new Blob([store.makePack(docs)], { type: "application/json" })); a.download = `RTS_pack_${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500) }
      const bClr = el("button", "rt-btn danger", L("Hapus semua dokumen", "Delete all documents")); bClr.type = "button"
      bClr.onclick = async () => { if (!confirm(L("Hapus semua dokumen RTS dari perangkat ini?", "Delete all RTS documents from this device?"))) return; await store.clearAll(); S.doc = ""; saveSt(S); await loadDocs(true); drawAll() }
      const use = el("small", "rt-use"); store.usage().then((u) => { if (u && u.usage != null) use.textContent = `${L("Penyimpanan app", "App storage")}: ${kb(u.usage)}${u.quota ? " / " + kb(u.quota) : ""}` })
      tools.append(bPack, bClr, use)
      body.push(tools)
    }
    libBox.append(card("rt-lib", "book", L("Pustaka dokumen RTS", "RTS document library"), docs.length ? `${docs.length} ${L("dokumen", "documents")} · ${nSec} ${L("pasal", "clauses")}` : L("kosong", "empty"), body, !docs.length))
  }

  // ---------------------------------------------------------------- tampilan teks bersorot
  function marked(text, groups, opts = {}) {
    const p = el("p", opts.cls || "rt-snip")
    const s = String(text)
    const ms = []
    if (groups) for (const [a, b] of termSpans(s, groups)) ms.push({ a, b, c: "rt-hl" })
    for (const v of extractValues(s, { plain: !!opts.plain })) ms.push({ a: v.at, b: v.at + v.txt.length, c: "rt-val", v })
    ms.sort((x, y) => x.a - y.a || (x.c === "rt-val" ? -1 : 1))
    let pos = 0
    if (opts.pre) p.append("… ")
    for (const m of ms) {
      if (m.a < pos) continue
      if (m.a > pos) p.append(s.slice(pos, m.a))
      const mk = el("mark", m.c, s.slice(m.a, m.b))
      if (m.v && opts.onVal) { mk.tabIndex = 0; mk.setAttribute("role", "button"); mk.title = L("Ketuk untuk menetapkan nilai ini", "Tap to pin this value"); mk.onclick = (e) => { e.stopPropagation(); opts.onVal(m.v) } }
      p.append(mk); pos = m.b
    }
    p.append(s.slice(pos))
    if (opts.post) p.append(" …")
    return p
  }
  // panel pasal lengkap
  document.querySelectorAll(".rt-sheet").forEach((n) => n.remove())
  const sheet = el("div", "rt-sheet"); sheet.hidden = true
  document.body.append(sheet)
  const killSheet = () => { sheet.hidden = true; sheet.textContent = ""; document.documentElement.classList.remove("rt-lock") }
  addEventListener("hashchange", () => { killSheet(); sheet.remove() }, { once: true })
  function openSection(doc, sec, groups, pinFor) {
    sheet.textContent = ""; sheet.hidden = false; document.documentElement.classList.add("rt-lock")
    const pan = el("div", "rt-pan"), head = el("div", "rt-pan-h")
    const ht = el("div"); ht.append(el("small", null, `${doc.docNo}${doc.rev ? " · Rev." + doc.rev : ""} · ${doc.title || ""}`), el("b", null, `${sec.no ? "§" + sec.no + " " : ""}${sec.title || L("(tanpa judul)", "(untitled)")}`), el("small", null, `${sec.parent ? sec.parent + " · " : ""}${L("halaman", "page")} ${sec.page}`))
    const x = el("button", "rt-x", "✕"); x.type = "button"; x.setAttribute("aria-label", L("Tutup", "Close")); x.onclick = killSheet
    head.append(ht, x)
    const bodyTx = el("div", "rt-pan-b")
    // bagian lanjutan (pasal panjang dipecah) digabung kembali
    const parts = doc.secs.filter((s) => s.no === sec.no && s.title === sec.title && s.page >= sec.page - 3 && s.page <= sec.page + 6 && (s.part || sec.part))
    const full = parts.length > 1 ? parts.map((s) => s.text).join("\n") : sec.text
    full.split(/\n{2,}/).forEach((para) => bodyTx.append(marked(para, groups, { cls: "rt-para", onVal: pinFor ? (v) => { pinFor(v, doc, sec); killSheet() } : (v) => quickPin(v, doc, sec) })))
    const acts = el("div", "rt-acts")
    const bc = el("button", "rt-btn", L("Salin kutipan + referensi", "Copy quote + reference")); bc.type = "button"
    bc.onclick = async () => { try { await navigator.clipboard.writeText(`${full.trim()}\n\n— ${refOf(doc, sec)}`); bc.textContent = L("✓ Tersalin", "✓ Copied") } catch (e) { bc.textContent = L("Gagal menyalin", "Copy failed") } }
    const bo = el("button", "rt-btn", L("Buka PDF asli", "Open original PDF")); bo.type = "button"
    bo.onclick = async () => { const f = await store.getFile(doc.id).catch(() => null); if (!f) { bo.textContent = L("Berkas asli tidak disimpan", "Original not stored"); return } window.open(URL.createObjectURL(f.blob) + (doc.type === "pdf" ? `#page=${sec.page}` : ""), "_blank") }
    acts.append(bc, bo)
    pan.append(head, el("p", "dz-note", L("Ketuk nilai bergaris (mis. 28 MPa) untuk menetapkannya sebagai nilai RTS sebuah parameter.", "Tap an underlined value (e.g. 28 MPa) to pin it as an RTS value for a parameter.")), bodyTx, acts)
    sheet.append(pan)
    sheet.onclick = (e) => { if (e.target === sheet) killSheet() }
  }

  // ---------------------------------------------------------------- pencarian
  const EX = () => [
    [L("Mutu beton pondasi?", "Foundation concrete grade?"), "beton pondasi mutu fc"], [L("Selimut beton", "Concrete cover"), "selimut beton"], [L("Lantai kerja", "Lean concrete"), "lantai kerja tebal"],
    [L("Mutu tulangan", "Rebar grade"), "tulangan mutu leleh"], ["Grout", "grout non shrink"], [L("Baut angkur", "Anchor bolts"), "baut angkur"], [L("Galvanis", "Galvanizing"), "galvanis tebal"],
    [L("Pemadatan timbunan", "Backfill compaction"), "pemadatan timbunan"], [L("Uji tiang", "Pile testing"), "uji tiang PDA loading test"], [L("Elevasi atas pondasi", "Top of concrete"), "elevasi atas pondasi di atas tanah"],
  ]
  let qTimer = 0, resBox = null, qInput = null
  function drawSearch() {
    searchBox.textContent = ""
    const docs = DOCS || []
    const wrap = el("div", "rt-search")
    const row = el("div", "rt-q")
    const icS = el("span", "rt-q-ic"); icS.append(ico("search"))
    qInput = el("input"); qInput.type = "search"; qInput.value = S.q || ""; qInput.placeholder = L("Tanya RTS… mis. beton pondasi pakai mutu berapa?", "Ask RTS… e.g. what concrete grade for foundations?")
    qInput.setAttribute("enterkeyhint", "search"); qInput.autocapitalize = "off"; qInput.spellcheck = false
    const sel = el("select", "rt-docsel")
    sel.append(new Option(L("Semua dokumen", "All documents"), ""))
    docs.forEach((d) => sel.append(new Option(`${d.docNo}${d.title ? " — " + d.title.slice(0, 40) : ""}`, d.id)))
    sel.value = docs.some((d) => d.id === S.doc) ? S.doc : ""
    sel.onchange = () => { S.doc = sel.value; saveSt(S); run() }
    row.append(icS, qInput, sel)
    const chips = el("div", "rt-chips")
    EX().forEach(([lab, q]) => { const b = el("button", "rt-chip", lab); b.type = "button"; b.onclick = () => { qInput.value = q; run(true) }; chips.append(b) })
    if (S.recent.length) { chips.append(el("span", "rt-chips-l", L("Terakhir:", "Recent:"))); S.recent.slice(0, 6).forEach((q) => { const b = el("button", "rt-chip ghost", q); b.type = "button"; b.onclick = () => { qInput.value = q; run(true) }; chips.append(b) }) }
    resBox = el("div", "rt-res")
    wrap.append(row, chips, resBox)
    qInput.oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(() => run(false), 220) }
    qInput.onkeydown = (e) => { if (e.key === "Enter") { clearTimeout(qTimer); run(true); qInput.blur() } }
    searchBox.append(card("rt-search", "search", L("Cari di RTS", "Search RTS"), docs.length ? `${docs.length} ${L("dokumen", "docs")}` : L("impor dokumen dulu", "import documents first"), wrap))
    run(false)
  }
  function run(commit) {
    if (!resBox) return
    const q = qInput.value.trim()
    S.q = q
    if (commit && q) { S.recent = [q, ...S.recent.filter((x) => x !== q)].slice(0, 8) }
    saveSt(S)
    resBox.textContent = ""
    const docs = DOCS || []
    if (!docs.length) { resBox.append(emptyState()); return }
    if (!q) { resBox.append(el("p", "dz-note", L("Ketik pertanyaan atau ketuk contoh di atas. Kata Indonesia & Inggris dicocokkan bersama (beton = concrete, selimut = cover, baut angkur = anchor bolt …).", "Type a question or tap an example above. Indonesian & English words are matched together (beton = concrete, selimut = cover, baut angkur = anchor bolt …)."))); return }
    const t0 = performance.now()
    const rs = search(index(), q, { limit: 25, docId: S.doc || undefined })
    const groups = parseQuery(q)
    const ms = performance.now() - t0
    const head = el("div", "rt-res-h")
    head.append(el("b", null, rs.length ? `${rs.length} ${L("pasal relevan", "relevant clauses")}` : L("Tidak ada yang cocok", "No match")), el("small", null, `${groups.map((g) => g.raw).join(" · ")} · ${nf(ms, 0)} ms`))
    resBox.append(head)
    if (!rs.length) { resBox.append(el("p", "dz-note", L("Coba kata lain atau lebih umum (mis. “beton” saja), atau pilih “Semua dokumen”.", "Try other or broader words (e.g. just “concrete”), or choose “All documents”."))); return }
    // jawaban cepat: kalimat terbaik hasil teratas yang memuat nilai
    const top = rs.find((r) => r.values && r.values.length && r.hit === r.of) || null
    if (top) {
      const ans = el("div", "rt-ans dz-in")
      ans.append(el("span", "rt-ans-k", L("Jawaban cepat", "Quick answer")), marked(top.best, groups, { cls: "rt-ans-tx", onVal: (v) => quickPin(v, top.doc, top.sec) }), el("small", null, `${refOf(top.doc, top.sec)} · ${L("verifikasi di dokumen sumber", "verify in the source document")}`))
      ans.onclick = () => openSection(top.doc, top.sec, groups)
      resBox.append(ans)
    }
    rs.forEach((r, i) => {
      const it = el("article", "rt-hit dz-in"); it.style.setProperty("--i", Math.min(i, 10))
      const h = el("div", "rt-hit-h")
      h.append(el("span", "rt-badge", r.doc.docNo), el("b", null, `${r.sec.no ? "§" + r.sec.no + " " : ""}${r.sec.title || L("(tanpa judul)", "(untitled)")}`), el("small", null, `${L("hal.", "p.")} ${r.sec.page}`))
      const cov = el("span", "rt-cov" + (r.hit === r.of ? " full" : "")); cov.textContent = `${r.hit}/${r.of}`; cov.title = L("kata kueri yang cocok", "query words matched"); h.append(cov)
      it.append(h)
      if (r.sec.parent) it.append(el("small", "rt-parent", r.sec.parent))
      it.append(marked(r.snippet, groups, { pre: r.pre, post: r.post, onVal: (v) => quickPin(v, r.doc, r.sec) }))
      it.onclick = () => openSection(r.doc, r.sec, groups)
      resBox.append(it)
    })
    reveal(resBox)
  }
  function emptyState() {
    const e = el("div", "rt-empty")
    e.append(el("b", null, L("Belum ada dokumen RTS di iPad ini", "No RTS documents on this iPad yet")))
    const ol = el("ol")
    ;[L("Simpan berkas RTS (PDF/DOCX/XLSX) ke app Files atau iCloud Drive.", "Save the RTS files (PDF/DOCX/XLSX) to the Files app or iCloud Drive."),
      L("Ketuk “Impor dokumen RTS” di kartu Pustaka (di bawah), pilih semua berkasnya.", "Tap “Import RTS documents” in the Library card (below) and select all files."),
      L("Teks dibaca & diindeks di iPad (tanpa internet), lalu langsung bisa dicari.", "Text is read & indexed on the iPad (offline) and is searchable right away.")].forEach((x) => ol.append(el("li", null, x)))
    const go = el("button", "rt-btn pri", L("Ke Pustaka → Impor", "Go to Library → Import")); go.type = "button"
    go.onclick = () => { libBox.scrollIntoView({ behavior: "smooth" }); const d = libBox.querySelector("details"); if (d) d.open = true }
    e.append(ol, go)
    return e
  }

  // ---------------------------------------------------------------- penetapan nilai
  // pilih parameter untuk nilai yang diketuk di hasil pencarian
  function quickPin(v, doc, sec) {
    const cand = PARAMS.filter((p) => p.kinds.includes(v.kind) && p.cmp !== "x")
    sheet.textContent = ""; sheet.hidden = false; document.documentElement.classList.add("rt-lock")
    const pan = el("div", "rt-pan sm"), head = el("div", "rt-pan-h")
    const ht = el("div"); ht.append(el("small", null, refOf(doc, sec)), el("b", null, `${L("Tetapkan", "Pin")} “${v.txt}” ${L("sebagai…", "as…")}`))
    const x = el("button", "rt-x", "✕"); x.type = "button"; x.onclick = killSheet
    head.append(ht, x)
    const list = el("div", "rt-pick")
    ;(cand.length ? cand : PARAMS).forEach((p) => { const b = el("button", "rt-pick-b"); b.type = "button"; b.append(el("b", null, L(...p.lab)), el("small", null, S.pins[p.id] ? `${L("sekarang", "now")}: ${S.pins[p.id].txt}` : L(...PARAM_GROUPS[p.grp]))); b.onclick = () => { pin(p, v, doc, sec); killSheet() }; list.append(b) })
    pan.append(head, list)
    sheet.append(pan)
    sheet.onclick = (e) => { if (e.target === sheet) killSheet() }
  }
  function pin(p, v, doc, sec) {
    const num = v.kind === "num" ? v.v : pinNumber({ txt: v.grade || v.txt }, p)
    S.pins[p.id] = { txt: v.grade || v.txt, num: num != null && isFinite(num) ? Math.round(num * 1000) / 1000 : null, src: doc ? refOf(doc, sec) : L("manual", "manual"), doc: doc ? doc.id : "", at: Date.now() }
    saveSt(S); drawParams(); drawCompliance()
    const t = document.getElementById("toast"); if (t) { t.textContent = `✓ ${L(...p.lab)} = ${S.pins[p.id].txt}`; t.hidden = false; setTimeout(() => { t.hidden = true }, 2600) }
  }

  // ---------------------------------------------------------------- parameter kunci
  const pOpen = {}
  function drawParams() {
    paramBox.textContent = ""
    const docs = DOCS || [], ix = docs.length ? index() : null
    const body = [el("p", "dz-note", L("Nilai kandidat dicari otomatis dari pasal RTS. Ketuk nilai bergaris untuk menetapkannya (atau isi manual); nilai tetap dipakai pada cek kepatuhan Desain & laporan. Selalu baca pasal sumbernya — kandidat bisa saja nilai untuk elemen lain.",
      "Candidate values are found automatically from RTS clauses. Tap an underlined value to pin it (or type it); pinned values feed the Design compliance check & report. Always read the source clause — a candidate may refer to another element."))]
    for (const [g, gl] of Object.entries(PARAM_GROUPS)) {
      const ps = PARAMS.filter((p) => p.grp === g)
      body.push(el("div", "dz-sub", L(...gl)))
      const grid = el("div", "rt-params")
      ps.forEach((p, i) => {
        const pinv = S.pins[p.id]
        const c = el("div", "rt-param dz-in" + (pinv ? " pinned" : "")); c.style.setProperty("--i", i)
        const top = el("div", "rt-param-h")
        top.append(el("b", null, L(...p.lab)))
        if (pinv) top.append(el("span", "rt-pinv", pinv.txt))
        c.append(top)
        if (pinv) c.append(el("small", "rt-src", `📌 ${pinv.src}`))
        if (ix && !ix.pc) ix.pc = {}
        const cands = ix ? (ix.pc[p.id] ||= findParam(ix, p, 3)) : []
        if (ix && !cands.length) c.append(el("small", "rt-none", L("Tidak ditemukan otomatis — coba cari manual.", "Not found automatically — try a manual search.")))
        const grpQ = parseQuery(p.q)
        const show = pOpen[p.id] ? cands : cands.slice(0, 1)
        show.forEach((r) => {
          const cd = el("div", "rt-cand")
          cd.append(marked(r.best, grpQ, { cls: "rt-cand-tx", plain: p.kinds.includes("num"), onVal: (v) => pin(p, v, r.doc, r.sec) }), el("small", null, refOf(r.doc, r.sec)))
          const more = el("button", "rt-link", L("lihat pasal", "view clause")); more.type = "button"; more.onclick = () => openSection(r.doc, r.sec, grpQ, (v, d, s) => pin(p, v, d, s))
          cd.append(more)
          c.append(cd)
        })
        const acts = el("div", "rt-param-a")
        if (cands.length > 1) { const b = el("button", "rt-link", pOpen[p.id] ? L("lebih sedikit", "fewer") : `+${cands.length - 1} ${L("kandidat", "candidates")}`); b.type = "button"; b.onclick = () => { pOpen[p.id] = !pOpen[p.id]; drawParams() }; acts.append(b) }
        const bs = el("button", "rt-link", L("cari", "search")); bs.type = "button"; bs.onclick = () => { if (qInput) { qInput.value = p.q; run(true); searchBox.scrollIntoView({ behavior: "smooth" }) } }
        const bm = el("button", "rt-link", L("isi manual", "type value")); bm.type = "button"
        bm.onclick = () => { const v = prompt(`${L(...p.lab)}${p.unit ? " (" + p.unit + ")" : ""}`, pinv ? pinv.txt : ""); if (v == null) return; if (!v.trim()) { delete S.pins[p.id]; saveSt(S); drawParams(); drawCompliance(); return } const ev = extractValues(v)[0]; pin(p, ev || { txt: v.trim(), v: parseFloat(v.replace(",", ".")), unit: p.unit, kind: "other" }, null, null) }
        acts.append(bs, bm)
        if (pinv) { const bx = el("button", "rt-link danger", L("lepas", "unpin")); bx.type = "button"; bx.onclick = () => { delete S.pins[p.id]; saveSt(S); drawParams(); drawCompliance() }; acts.append(bx) }
        c.append(acts)
        grid.append(c)
      })
      body.push(grid)
    }
    const n = Object.keys(S.pins).length
    paramBox.append(card("rt-params", "list", L("Parameter kunci desain dari RTS", "Key design parameters from RTS"), `${n}/${PARAMS.length} ${L("ditetapkan", "pinned")}`, body, true))
    reveal(paramBox)
  }

  // ---------------------------------------------------------------- cek kepatuhan Desain
  let cmpRows = []
  async function drawCompliance() {
    cmpBox.textContent = ""
    let D, steel
    try { [D, steel] = await Promise.all([import("./desain_ui.js"), import("./desain/steel.js")]) } catch (e) { cmpBox.append(el("div", "err", e.message)); return }
    const Sd = D.loadDesign(), P = projLoad(), titles = Object.fromEntries(D.MODS.map((m) => [m.id, m.title()]))
    const src = []
    const add = (param, mod, lab, val, unit, href) => { if (val != null) src.push({ param, mod, where: `${mod ? titles[mod] || mod : L("Proyek", "Project")} · ${lab}`, val, unit, href: href || (mod ? "#/desain/" + mod : "#/tanah") }) }
    const m = Sd.m
    add("fc", "tiang", "fc' pile cap", m.tiang.fcc, "MPa"); add("fc", "tiang", L("fc' beton isi tiang", "pile infill fc'"), m.tiang.fcp, "MPa")
    for (const id of ["tangki", "vessel", "dinamis", "trafo"]) { add("fc", id, "fc'", m[id].fc, "MPa"); add("fy", id, "fy", m[id].fy, "MPa"); add("cover", id, L("selimut", "cover"), m[id].cover, "mm") }
    add("fy", "tiang", "fy pile cap", m.tiang.fyc, "MPa"); add("fy", "tiang", "fy dowel", m.tiang.fyd, "MPa")
    if (P.pile.kind !== "pipe") add("fc", null, L("fc' tiang bor (tiang rencana)", "bored pile fc' (design pile)"), P.pile.fc, "MPa", "#/tanah")
    const ag = steel.ANCHOR[m.vessel.bg]; if (ag) add("bolt", "vessel", L("baut angkur", "anchor bolts"), ag.nm, "")
    add("fs", null, L("FS daya dukung dangkal", "shallow bearing FS"), P.bear.FS, "", "#/tanah"); add("fs", null, L("FS tekan tiang", "pile compression FS"), P.pile.fsC, "", "#/tanah")
    add("settle", null, L("penurunan izin dangkal", "shallow allowable settlement"), P.settle.allow, "mm", "#/penurunan"); add("settle", null, L("penurunan izin tiang", "piled allowable settlement"), P.settle.allowDeep, "mm", "#/penurunan")
    add("wind", null, L("kecepatan angin dasar V", "basic wind speed V"), Sd.site.V, "m/s", "#/desain")
    cmpRows = complianceRows(S.pins, src)
    const body = []
    if (!cmpRows.length) body.push(el("p", "dz-note", L("Tetapkan dulu nilai RTS untuk fc', fy, selimut, baut angkur, FS daya dukung, penurunan izin, atau kecepatan angin — lalu masukan modul Desain dicek otomatis di sini.", "Pin RTS values for fc', fy, cover, anchor bolts, bearing FS, allowable settlement or wind speed first — Design module inputs are then checked here automatically.")))
    else {
      const nb = cmpRows.filter((r) => r.ok === false).length, nq = cmpRows.filter((r) => r.ok == null).length
      const sum = el("div", "pj-kpis")
      ;[[L("Dicek", "Checked"), cmpRows.length], [L("Sesuai RTS", "Meets RTS"), cmpRows.filter((r) => r.ok).length], [L("Tidak sesuai", "Not meeting"), nb], [L("Periksa manual", "Check manually"), nq]].forEach(([k, v], i) => { const c = el("div", "pj-kpi" + (i === 2 && v ? " bad" : i === 1 ? " hi" : "")); c.append(el("span", null, k), el("b", null, String(v))); sum.append(c) })
      const tw = el("div", "dz-tw"), tb = el("table", "dz-res rt-cmp")
      const hr = el("tr"); [L("Parameter", "Parameter"), L("Lokasi masukan", "Input location"), L("Nilai desain", "Design value"), L("Syarat RTS", "RTS requirement"), L("Status", "Status")].forEach((h) => hr.append(el("th", null, h))); tb.append(hr)
      cmpRows.forEach((r) => {
        const tr = el("tr", r.ok === false ? "bad" : "")
        const a = el("a", null, r.s.where); a.href = r.s.href
        const tdW = el("td"); tdW.append(a)
        const cmpTx = r.p.cmp === "min" ? "≥ " : r.p.cmp === "max" ? "≤ " : ""
        tr.append(el("td", null, L(...r.p.lab)), tdW, el("td", "r", typeof r.s.val === "number" ? `${nf(r.s.val, r.s.unit === "mm" || r.s.unit === "MPa" ? 0 : 2)} ${r.s.unit}` : String(r.s.val)),
          el("td", null, `${cmpTx}${typeof r.lim === "number" ? nf(r.lim, Number.isInteger(r.lim) ? 0 : r.p.unit === "MPa" || r.p.unit === "mm" ? 1 : 2) + " " + (r.p.unit || "") : r.lim ?? S.pins[r.p.id].txt}`), el("td", "rt-st " + (r.ok === true ? "uok" : r.ok === false ? "ubad" : "uwarn"), r.ok === true ? "✓ OK" : r.ok === false ? L("✕ tidak sesuai", "✕ not meeting") : L("? periksa", "? check")))
        tb.append(tr)
      })
      tw.append(tb)
      body.push(sum, tw, el("p", "dz-note", L("Sumber nilai RTS ada di kartu Parameter kunci. Ketuk lokasi masukan untuk membuka modulnya. K-xxx dikonversi ke fc' silinder ≈ 0,083·K MPa; ASTM Grade N (ksi) ≈ 6,895·N MPa.", "RTS value sources are in the Key parameters card. Tap an input location to open its module. K-xxx converted to cylinder fc' ≈ 0.083·K MPa; ASTM Grade N (ksi) ≈ 6.895·N MPa.")))
    }
    const nb = cmpRows.filter((r) => r.ok === false).length
    cmpBox.append(card("rt-cmp", "check", L("Cek kepatuhan Desain terhadap RTS", "Design compliance with RTS"), cmpRows.length ? (nb ? `${nb} ${L("tidak sesuai", "not meeting")}` : L("semua sesuai", "all meeting")) : L("belum ada nilai RTS", "no RTS values yet"), body, true))
    reveal(cmpBox)
  }

  // ---------------------------------------------------------------- ekspor (Excel/PDF): parameter RTS & kepatuhan
  function out() {
    const rowsP = PARAMS.map((p) => { const v = S.pins[p.id]; return [L(...PARAM_GROUPS[p.grp]), L(...p.lab), v ? v.txt : "–", v ? v.src : L("belum ditetapkan", "not pinned")] })
    const rowsC = cmpRows.map((r) => [L(...r.p.lab), r.s.where, typeof r.s.val === "number" ? `${nf(r.s.val, 2)} ${r.s.unit}` : String(r.s.val), `${r.p.cmp === "min" ? "≥ " : r.p.cmp === "max" ? "≤ " : ""}${typeof r.lim === "number" ? nf(r.lim, 2) + " " + (r.p.unit || "") : r.lim ?? ""}`, r.ok === true ? "OK" : r.ok === false ? "NOT OK" : L("periksa", "check")])
    const docs = (DOCS || []).map((d) => [d.docNo, d.rev || "", d.title || "", d.fileName || "", d.pages, d.secs.length])
    return {
      file: "RTS_Parameter", suite: "RTS", title: L("Parameter Desain menurut Rokan Technical Standard", "Design Parameters per Rokan Technical Standard"), sub: `${Object.keys(S.pins).length} ${L("parameter ditetapkan", "parameters pinned")} · ${(DOCS || []).length} ${L("dokumen RTS", "RTS documents")}`, refs: "Rokan Technical Standard (RTS)",
      metrics: [{ lab: L("Parameter ditetapkan", "Pinned parameters"), val: Object.keys(S.pins).length }, { lab: L("Dicek", "Checked"), val: cmpRows.length }, { lab: L("Tidak sesuai", "Not meeting"), val: cmpRows.filter((r) => r.ok === false).length }],
      checks: [], kv: [],
      tables: [{ title: L("Parameter kunci & sumber RTS", "Key parameters & RTS source"), cols: [L("Kelompok", "Group"), L("Parameter", "Parameter"), L("Nilai RTS", "RTS value"), L("Sumber (dokumen · pasal · halaman)", "Source (document · clause · page)")], rows: rowsP, align: ["l", "l", "l", "l"] },
        ...(rowsC.length ? [{ title: L("Kepatuhan masukan Desain", "Design input compliance"), cols: [L("Parameter", "Parameter"), L("Lokasi", "Location"), L("Desain", "Design"), "RTS", L("Status", "Status")], rows: rowsC, align: ["l", "l", "r", "l", "l"] }] : []),
        ...(docs.length ? [{ title: L("Dokumen RTS di perangkat", "RTS documents on device"), cols: [L("No. dokumen", "Document no."), "Rev.", L("Judul", "Title"), L("Berkas", "File"), L("Hal.", "Pages"), L("Pasal", "Clauses")], rows: docs, dec: [null, null, null, null, 0, 0], align: ["l", "l", "l", "l", "r", "r"] }] : [])],
      notes: [L("Nilai RTS ditetapkan pengguna dari pasal yang dikutip; verifikasi terhadap revisi RTS yang berlaku dan Design Basis proyek.", "RTS values are pinned by the user from the quoted clauses; verify against the governing RTS revision and the project Design Basis.")],
      drawings: [], steps: [], combos: [], cases: {},
    }
  }

  function drawAll() { drawSearch(); drawParams(); drawCompliance(); drawLib(); exportBar(expBox, out, { project: projLoad().info }); reveal(box) }
  searchBox.append(el("p", "hint", L("Memuat pustaka RTS…", "Loading RTS library…")))
  loadDocs().then(() => { if (box.isConnected) drawAll() })
}
