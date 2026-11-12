// Tab "RTS" (Rokan Technical Standard): pustaka dokumen standar di perangkat, pencarian bebas Indonesia/Inggris dengan sorotan & nilai teknis,
// parameter kunci desain (mutu beton, selimut, tulangan, grout, baut angkur, galvanis, pemadatan …) yang bisa ditetapkan dari pasal RTS,
// dan cek kepatuhan masukan modul Desain terhadap nilai RTS tersebut. Mesin: js/rts.js; penyimpanan & impor: js/rts_store.js.
// Tata letak: ringkasan bento (dokumen, parameter, saran, kepatuhan) → tab bersegmen Cari · Parameter · Kepatuhan · Pustaka (satu bagian tampil
// sekaligus) → panel geser bawah untuk pasal lengkap & detail parameter. Pintasan: "/" atau ⌘K = cari, ↑/↓ = pindah hasil, Esc = tutup/hapus.
import { L, lang, nf } from "./desain/core.js"
import { el, sv, exportBar, reveal } from "./desain/ui.js"
import { projLoad } from "./project.js"
import { initUnits, footer } from "./pj_ui.js"
import { ico } from "./icons.js"
import { buildIndex, search, findParam, PARAMS, PARAM_GROUPS, extractValues, parseQuery, termSpans, complianceRows, pinNumber, fold } from "./rts.js"
import * as store from "./rts_store.js"

const KEY = "ymd.rts.v1"
const DEF = () => ({ pins: {}, recent: [], q: "", doc: "", tab: "cari", pf: "all", view: "rel" })
const loadSt = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); return { ...DEF(), ...(o || {}) } } catch (e) { return DEF() } }
const saveSt = (S) => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* tanpa penyimpanan */ } }
export const rtsPins = () => loadSt().pins

let DOCS = null, IX = null     // cache selama app terbuka
let keyHandler = null          // pintasan papan ketik (dilepas saat tab dipasang ulang)
const kb = (n) => (n > 1048576 ? `${nf(n / 1048576, 1)} MB` : `${nf(n / 1024, 0)} kB`)
const refOf = (doc, sec) => `${doc.docNo}${doc.rev ? " Rev." + doc.rev : ""}${sec ? ` · ${sec.no ? "§" + sec.no + " " : ""}${sec.title || ""}${sec.page ? ` · ${L("hal.", "p.")} ${sec.page}` : ""}` : ""}`.trim()
const docTitle = (doc) => doc.title || doc.fileName || ""
// baris dokumen sumber: nomor RTS + judul dokumen + revisi (supaya jelas pasal ini dari dokumen apa)
function docLine(doc, cls = "rt-docl") {
  const d = el("span", cls)
  d.append(el("span", "rt-badge", doc.docNo), el("span", "rt-docl-t", docTitle(doc) || "–"))
  if (doc.rev) d.append(el("small", null, "Rev." + doc.rev))
  d.title = `${doc.docNo}${doc.rev ? " Rev." + doc.rev : ""} — ${docTitle(doc)}`
  return d
}
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const btn = (cls, label, icon) => { const b = el("button", cls); b.type = "button"; if (icon) b.append(ico(icon)); if (label != null) b.append(el("span", null, label)); return b }
// angka naik bertahap (count-up) untuk ringkasan
function countUp(node, to, fmt = (x) => String(Math.round(x))) {
  if (reduced() || !isFinite(to) || to <= 0) { node.textContent = fmt(to); return }
  const t0 = performance.now(), dur = 650
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(to * e); if (k < 1 && node.isConnected) requestAnimationFrame(step) }
  requestAnimationFrame(step)
}

export function mountRts(box, ctx) {
  lang.cur = ctx.lang
  initUnits()
  const S = loadSt()
  box.textContent = ""
  box.classList.add("rt-page")

  const TABS = [
    { id: "cari", ic: "search", lab: () => L("Cari", "Search") },
    { id: "param", ic: "list", lab: () => L("Parameter", "Parameters") },
    { id: "cek", ic: "check", lab: () => L("Kepatuhan", "Compliance") },
    { id: "pustaka", ic: "book", lab: () => L("Pustaka", "Library") },
  ]
  const hashTab = (location.hash.split("/")[2] || "").trim()
  let tab = TABS.some((t) => t.id === hashTab) ? hashTab : TABS.some((t) => t.id === S.tab) ? S.tab : "cari"

  // ---------------------------------------------------------------- kerangka: bento ringkasan + tab + panel
  const bento = el("section", "rt-bento")
  const heroT = el("div", "rt-hero")
  heroT.innerHTML = `<div class="rt-hero-bg" aria-hidden="true"><i></i><i></i></div>`
  const hx = el("div", "rt-hero-tx")
  const meta = el("div", "rt-hero-meta")
  const m1 = el("span"); m1.append(ico("lock"), el("span", null, L("Hanya di perangkat ini · offline", "This device only · offline")))
  meta.append(m1, el("span", null, "PDF · DOCX · XLSX"), el("span", null, L("Sinonim ID ↔ EN", "ID ↔ EN synonyms")))
  hx.append(el("small", "rt-hero-k", "Rokan Technical Standard"), el("h1", null, L("Cari persyaratan RTS", "Find RTS requirements")),
    el("p", null, L("Tanya bebas dalam bahasa Indonesia atau Inggris. Hasil menunjuk dokumen, pasal & halaman; nilainya bisa ditetapkan lalu dicek ke modul Desain.",
      "Ask in Indonesian or English. Results point to the document, clause & page; values can be pinned and checked against the Design modules.")), meta)
  heroT.append(hx)
  const tiles = {}
  const mkTile = (id, icon, label, go) => {
    const t = btn("rt-tile"); t.dataset.k = id
    const top = el("span", "rt-tile-top"); top.append(ico(icon), el("span", null, label))
    const v = el("b", "rt-tile-v", "–"), s = el("small", "rt-tile-s", "")
    t.append(top, v, s)
    t.onclick = go
    tiles[id] = { t, v, s }
    return t
  }
  bento.append(heroT,
    mkTile("docs", "book", L("Dokumen", "Documents"), () => setTab("pustaka", true)),
    mkTile("pins", "pin", L("Parameter ditetapkan", "Pinned parameters"), () => { S.pf = "pinned"; saveSt(S); drawParams(); setTab("param", true) }),
    mkTile("sugg", "spark", L("Saran otomatis", "Auto suggestions"), () => { S.pf = "sugg"; saveSt(S); drawParams(); setTab("param", true) }),
    mkTile("cmp", "check", L("Kepatuhan Desain", "Design compliance"), () => setTab("cek", true)))
  // cincin kemajuan pada ubin parameter
  const ring = sv("svg", { class: "rt-ring", viewBox: "0 0 36 36", "aria-hidden": "true" })
  ring.append(sv("circle", { cx: 18, cy: 18, r: 15, class: "rt-ring-bg" }), sv("circle", { cx: 18, cy: 18, r: 15, class: "rt-ring-fg", "stroke-dasharray": "0 100", pathLength: 100 }))
  tiles.pins.t.append(ring)

  const tabBar = el("div", "rt-tabs"); tabBar.setAttribute("role", "tablist"); tabBar.setAttribute("aria-label", L("Bagian RTS", "RTS sections"))
  const ind = el("span", "rt-tab-ind"); ind.setAttribute("aria-hidden", "true")
  const tabWrap = el("div", "rt-tabs-wrap"); tabWrap.append(tabBar)
  tabBar.append(ind)
  const tabBtn = {}, tabBadge = {}, panels = {}
  for (const t of TABS) {
    const b = el("button", "rt-tab"); b.type = "button"; b.id = "rt-tab-" + t.id
    b.setAttribute("role", "tab"); b.setAttribute("aria-controls", "rt-pane-" + t.id)
    const bd = el("span", "rt-tab-n")
    b.append(ico(t.ic), el("span", "rt-tab-l", t.lab()), bd)
    b.onclick = () => setTab(t.id, true)
    tabBtn[t.id] = b; tabBadge[t.id] = bd
    tabBar.append(b)
    const p = el("div", "rt-pane"); p.id = "rt-pane-" + t.id; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", b.id)
    panels[t.id] = p
  }
  tabBar.onkeydown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    const i = TABS.findIndex((t) => t.id === tab), j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length
    setTab(TABS[j].id, true); tabBtn[TABS[j].id].focus(); e.preventDefault()
  }
  const searchBox = panels.cari, paramBox = el("div"), cmpBox = el("div"), libBox = panels.pustaka
  panels.param.append(paramBox); panels.cek.append(cmpBox)
  const expBox = el("div", "dz-expbox rt-exp")
  box.append(bento, tabWrap, ...Object.values(panels), footer())

  function moveInd() {
    const b = tabBtn[tab]; if (!b || !b.offsetWidth) return
    ind.style.width = b.offsetWidth + "px"; ind.style.transform = `translateX(${b.offsetLeft}px)`
  }
  if (self.ResizeObserver) new ResizeObserver(moveInd).observe(tabBar)
  function setTab(id, user) {
    tab = id; S.tab = id; saveSt(S)
    for (const t of TABS) { const on = t.id === id; tabBtn[t.id].classList.toggle("on", on); tabBtn[t.id].setAttribute("aria-selected", on); tabBtn[t.id].tabIndex = on ? 0 : -1; panels[t.id].hidden = !on }
    moveInd()
    placeExp()
    try { history.replaceState(null, "", `#/rts/${id}`) } catch (e) { /* abaikan */ }
    if (user) {
      const top = tabWrap.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hh")) || 64) - 8
      if (scrollY > top) scrollTo({ top, behavior: reduced() ? "auto" : "smooth" })
      reveal(panels[id])
    }
  }
  // ekspor (parameter + kepatuhan) tampil di bawah tab Parameter & Kepatuhan
  function placeExp() { if (tab === "param") panels.param.append(expBox); else if (tab === "cek") panels.cek.append(expBox) }

  // ---------------------------------------------------------------- pustaka
  async function loadDocs(force) {
    if (DOCS && !force) return DOCS
    try { DOCS = (await store.listDocs()).sort((a, b) => fold(a.docNo).localeCompare(fold(b.docNo))) } catch (e) { DOCS = []; DOCS.err = e.message }
    IX = null
    return DOCS
  }
  const index = () => { if (!IX) IX = buildIndex(DOCS || []); return IX }
  const candsOf = (p) => { const ix = (DOCS || []).length ? index() : null; if (!ix) return []; if (!ix.pc) ix.pc = {}; return (ix.pc[p.id] ||= findParam(ix, p, 3)) }

  let importMsg = ""
  // kotak impor (dipakai di Pustaka dan di keadaan kosong)
  function makeDrop(big) {
    const wrap = el("div", "rt-dropw")
    const drop = el("label", "rt-drop" + (big ? " big" : ""))
    const inp = el("input"); inp.type = "file"; inp.multiple = true; inp.accept = store.ACCEPT
    const icD = el("span", "rt-drop-ic"); icD.append(ico("upload"))
    const dt = el("span", "rt-drop-tx")
    dt.append(el("b", null, L("Impor dokumen RTS", "Import RTS documents")), el("small", null, L("PDF, DOCX, XLSX atau TXT dari Files / iCloud Drive (boleh banyak sekaligus), atau paket .json dari perangkat lain.", "PDF, DOCX, XLSX or TXT from Files / iCloud Drive (many at once), or a .json pack from another device.")))
    drop.append(inp, icD, dt, el("span", "rt-drop-go", L("Pilih berkas", "Choose files")))
    const prog = el("div", "rt-prog"); prog.hidden = !importMsg
    const bar = el("i"), ptx = el("span", null, importMsg); prog.append(bar, ptx)
    prog.setAttribute("role", "status")
    if (importMsg) bar.style.width = "100%"
    inp.onchange = async () => {
      const files = [...inp.files]; if (!files.length) return
      prog.hidden = false; drop.classList.add("busy")
      store.persist()
      const r = await store.importFiles(files, (i, n, fr, note, name) => { bar.style.width = `${Math.round(((i - 1 + fr) / n) * 100)}%`; ptx.textContent = `${i}/${n} · ${name}${note ? " · " + L("hal.", "p.") + " " + note : ""}` })
      drop.classList.remove("busy"); inp.value = ""
      await loadDocs(true)
      const scan = r.done.filter((d) => d.warn === "scan")
      importMsg = ptx.textContent = `✓ ${L("Selesai", "Done")}: ${r.done.length} ${L("dokumen", "documents")}${r.errs.length ? ` · ${r.errs.length} ${L("gagal", "failed")}: ${r.errs.map((e) => `${e.name} (${e.msg})`).join("; ")}` : ""}${scan.length ? ` · ⚠️ ${scan.length} ${L("PDF hasil scan tanpa teks (perlu OCR di komputer dulu)", "scanned PDFs without text (OCR them on a computer first)")}` : ""}`
      bar.style.width = "100%"
      drawAll()
    }
    wrap.append(drop, prog)
    return wrap
  }
  function drawLib() {
    libBox.textContent = ""
    const docs = DOCS || [], nSec = docs.reduce((a, d) => a + d.secs.length, 0)
    const head = el("div", "rt-ph")
    head.append(el("h2", null, L("Pustaka dokumen", "Document library")), el("small", null, docs.length ? `${docs.length} ${L("dokumen", "documents")} · ${nSec} ${L("pasal", "clauses")}` : L("belum ada dokumen", "no documents yet")))
    libBox.append(head, makeDrop(!docs.length))
    // pengukur penyimpanan
    const meter = el("div", "rt-meter")
    const mb = el("i"), mt = el("small")
    const lk = el("small", "rt-lockn"); lk.append(ico("lock"), el("span", null, L("Disimpan hanya di perangkat ini (IndexedDB), tidak diunggah. Repo app publik, jadi isi RTS sengaja tidak dibundel.", "Stored only on this device (IndexedDB), never uploaded. The app repo is public, so RTS content is deliberately not bundled.")))
    const mbar = el("span", "rt-meter-bar"); mbar.append(mb)
    meter.append(mbar, mt)
    libBox.append(lk)
    store.usage().then((u) => { if (!u || u.usage == null) return; mt.textContent = `${L("Penyimpanan app", "App storage")}: ${kb(u.usage)}${u.quota ? " / " + kb(u.quota) : ""}`; if (u.quota) mb.style.width = `${Math.max(1, Math.min(100, (u.usage / u.quota) * 100))}%`; libBox.insertBefore(meter, lk) })
    if (DOCS && DOCS.err) libBox.append(el("div", "err", DOCS.err))
    if (!docs.length) return
    const list = el("div", "rt-docs")
    docs.forEach((d) => {
      const row = el("details", "rt-doc")
      const sm = el("summary")
      const tx = el("span", "rt-doc-tx")
      tx.append(el("b", null, d.docNo + (d.rev ? ` · Rev.${d.rev}` : "")), el("span", null, d.title || d.fileName), el("small", null, `${d.pages} ${L("hal.", "pp.")} · ${d.secs.length} ${L("pasal", "clauses")}${d.size ? " · " + kb(d.size) : ""}${d.warn === "scan" ? " · ⚠️ " + L("scan, teks kosong", "scanned, no text") : ""}`))
      const chev = el("span", "rt-chev"); chev.append(ico("chevR"))
      sm.append(el("span", "rt-type t-" + d.type, d.type.toUpperCase()), tx, chev)
      row.append(sm)
      const acts = el("div", "rt-acts")
      const bFind = btn("rt-btn pri", L("Cari di dokumen ini", "Search this document"), "search")
      bFind.onclick = () => { S.doc = d.id; saveSt(S); drawSearch(); setTab("cari", true); if (qInput) qInput.focus() }
      const bOpen = btn("rt-btn", L("Buka berkas asli", "Open original"), "open")
      bOpen.onclick = async () => { const f = await store.getFile(d.id).catch(() => null); if (!f) { bOpen.lastChild.textContent = L("Berkas asli tidak disimpan", "Original not stored"); return } window.open(URL.createObjectURL(f.blob), "_blank") }
      const bDel = btn("rt-btn danger", L("Hapus", "Delete"), "trash")
      bDel.onclick = async () => { if (!confirm(L(`Hapus ${d.docNo} dari perangkat ini?`, `Delete ${d.docNo} from this device?`))) return; await store.delDoc(d.id); if (S.doc === d.id) { S.doc = ""; saveSt(S) } await loadDocs(true); drawAll() }
      acts.append(bFind, bOpen, bDel)
      // daftar pasal dengan penyaring
      const heads = d.secs.filter((s) => s.title && !(s.part > 1)).slice(0, 400)
      const toc = el("ol", "rt-toc")
      const fil = el("input", "rt-tocf"); fil.type = "search"; fil.placeholder = L(`Saring ${heads.length} pasal…`, `Filter ${heads.length} clauses…`); fil.autocapitalize = "off"
      heads.forEach((s) => { const li = el("li"); const a = el("button", "rt-toc-a"); a.type = "button"; a.append(el("b", null, s.no || "•"), el("span", null, s.title), el("small", null, `${L("hal.", "p.")} ${s.page}`)); a.onclick = () => openSection(d, s); li.dataset.f = fold(`${s.no} ${s.title}`); li.append(a); toc.append(li) })
      fil.oninput = () => { const q = fold(fil.value.trim()); toc.querySelectorAll("li").forEach((li) => { li.hidden = q && !li.dataset.f.includes(q) }) }
      const inner = el("div", "rt-doc-b"); inner.append(acts)
      if (heads.length) inner.append(fil, toc)
      row.append(inner)
      list.append(row)
    })
    libBox.append(list)
    const tools = el("div", "rt-acts rt-libtools")
    const bPack = btn("rt-btn", L("Ekspor paket (.json)", "Export pack (.json)"), "download")
    bPack.onclick = () => { const a = el("a"); a.href = URL.createObjectURL(new Blob([store.makePack(docs)], { type: "application/json" })); a.download = `RTS_pack_${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500) }
    const bClr = btn("rt-btn danger ghosty", L("Hapus semua dokumen", "Delete all documents"), "trash")
    bClr.onclick = async () => { if (!confirm(L("Hapus semua dokumen RTS dari perangkat ini?", "Delete all RTS documents from this device?"))) return; await store.clearAll(); S.doc = ""; saveSt(S); await loadDocs(true); drawAll() }
    tools.append(bPack, bClr)
    libBox.append(tools, el("p", "dz-note", L("Pindah perangkat tanpa impor ulang: ekspor paket lalu impor paket itu di perangkat lain.", "Move devices without re-importing: export a pack and import it on the other device.")))
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
      if (m.v && opts.onVal) {
        mk.tabIndex = 0; mk.setAttribute("role", "button"); mk.title = L("Ketuk untuk menetapkan nilai ini", "Tap to pin this value")
        mk.onclick = (e) => { e.stopPropagation(); opts.onVal(m.v) }
        mk.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); opts.onVal(m.v) } }
      }
      p.append(mk); pos = m.b
    }
    p.append(s.slice(pos))
    if (opts.post) p.append(" …")
    return p
  }

  // ---------------------------------------------------------------- panel geser bawah (pasal lengkap, detail parameter, pilih parameter)
  document.querySelectorAll(".rt-sheet").forEach((n) => n.remove())
  const sheet = el("div", "rt-sheet"); sheet.hidden = true
  document.body.append(sheet)
  let lastFocus = null
  const killSheet = () => {
    if (sheet.hidden) return
    sheet.hidden = true; sheet.textContent = ""; document.documentElement.classList.remove("rt-lock")
    if (lastFocus && lastFocus.isConnected) try { lastFocus.focus({ preventScroll: true }) } catch (e) { /* abaikan */ }
  }
  addEventListener("hashchange", () => { killSheet(); sheet.remove() }, { once: true })
  // panel baru: pegangan (seret ke bawah untuk menutup), kepala, isi; fokus masuk ke panel
  function openPanel(small, kicker, title, sub) {
    if (sheet.hidden) lastFocus = document.activeElement
    sheet.textContent = ""; sheet.hidden = false; document.documentElement.classList.add("rt-lock")
    const pan = el("div", "rt-pan" + (small ? " sm" : "")); pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.tabIndex = -1
    const grab = el("div", "rt-grab"); grab.setAttribute("aria-hidden", "true")
    const head = el("div", "rt-pan-h"), ht = el("div")
    if (kicker) ht.append(el("small", null, kicker))
    const tb = el("b", null, title); tb.id = "rt-pan-t"; pan.setAttribute("aria-labelledby", tb.id)
    ht.append(tb)
    if (sub) ht.append(el("small", null, sub))
    const x = btn("rt-x", null, "close"); x.setAttribute("aria-label", L("Tutup", "Close")); x.onclick = killSheet
    head.append(ht, x)
    pan.append(grab, head)
    sheet.append(pan)
    sheet.onclick = (e) => { if (e.target === sheet) killSheet() }
    // seret pegangan/kepala ke bawah untuk menutup (seperti bottom sheet iOS)
    let y0 = null, dy = 0
    const down = (e) => { if (e.target.closest("button")) return; y0 = e.clientY; dy = 0; pan.style.transition = "none"; head.setPointerCapture?.(e.pointerId) }
    const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); pan.style.transform = `translateY(${dy}px)` }
    const up = () => { if (y0 == null) return; y0 = null; pan.style.transition = ""; if (dy > 90) killSheet(); else pan.style.transform = "" }
    for (const n of [grab, head]) { n.addEventListener("pointerdown", down); n.addEventListener("pointermove", move); n.addEventListener("pointerup", up); n.addEventListener("pointercancel", up) }
    requestAnimationFrame(() => { try { pan.focus({ preventScroll: true }) } catch (e) { /* abaikan */ } })
    return pan
  }
  // pasal berikut/sebelumnya dalam dokumen yang sama
  const headsOf = (doc) => doc.secs.filter((s) => !(s.part > 1))
  function openSection(doc, sec, groups, pinFor) {
    const heads = headsOf(doc)
    let hi = heads.indexOf(sec)
    if (hi < 0) hi = heads.reduce((best, s, i) => (s.no === sec.no && s.title === sec.title && s.page <= sec.page ? i : best), -1)
    const pan = openPanel(false, `${doc.docNo}${doc.rev ? " · Rev." + doc.rev : ""} · ${doc.title || ""}`, `${sec.no ? "§" + sec.no + " " : ""}${sec.title || L("(tanpa judul)", "(untitled)")}`, `${sec.parent ? sec.parent + " · " : ""}${L("halaman", "page")} ${sec.page}`)
    const bodyTx = el("div", "rt-pan-b")
    // bagian lanjutan (pasal panjang dipecah) digabung kembali
    const parts = doc.secs.filter((s) => s.no === sec.no && s.title === sec.title && s.page >= sec.page - 3 && s.page <= sec.page + 6 && (s.part || sec.part))
    const full = parts.length > 1 ? parts.map((s) => s.text).join("\n") : sec.text
    full.split(/\n{2,}/).forEach((para) => bodyTx.append(marked(para, groups, { cls: "rt-para", onVal: pinFor ? (v) => { pinFor(v, doc, sec); killSheet() } : (v) => quickPin(v, doc, sec) })))
    const acts = el("div", "rt-acts rt-pan-f")
    const bc = btn("rt-btn", L("Salin kutipan + referensi", "Copy quote + reference"), "copy")
    bc.onclick = async () => { try { await navigator.clipboard.writeText(`${full.trim()}\n\n— ${refOf(doc, sec)}`); bc.lastChild.textContent = L("Tersalin", "Copied"); bc.classList.add("done") } catch (e) { bc.lastChild.textContent = L("Gagal menyalin", "Copy failed") } }
    const bo = btn("rt-btn", L("Buka berkas asli", "Open original"), "open")
    bo.onclick = async () => { const f = await store.getFile(doc.id).catch(() => null); if (!f) { bo.lastChild.textContent = L("Berkas asli tidak disimpan", "Original not stored"); return } window.open(URL.createObjectURL(f.blob) + (doc.type === "pdf" ? `#page=${sec.page}` : ""), "_blank") }
    const nav = el("div", "rt-pnav")
    const bp = btn("rt-btn icon", null, "chevL"), bn = btn("rt-btn icon", null, "chevR")
    bp.setAttribute("aria-label", L("Pasal sebelumnya", "Previous clause")); bn.setAttribute("aria-label", L("Pasal berikutnya", "Next clause"))
    bp.title = bp.getAttribute("aria-label"); bn.title = bn.getAttribute("aria-label")
    bp.disabled = hi <= 0; bn.disabled = hi < 0 || hi >= heads.length - 1
    bp.onclick = () => openSection(doc, heads[hi - 1], groups, pinFor); bn.onclick = () => openSection(doc, heads[hi + 1], groups, pinFor)
    nav.append(bp, el("small", null, hi >= 0 ? `${hi + 1} / ${heads.length}` : ""), bn)
    acts.append(bc, bo, nav)
    pan.append(el("p", "rt-tip", L("Ketuk nilai bergaris (mis. 28 MPa) untuk menetapkannya sebagai nilai RTS sebuah parameter.", "Tap an underlined value (e.g. 28 MPa) to pin it as an RTS value for a parameter.")), bodyTx, acts)
  }

  // ---------------------------------------------------------------- pencarian
  const EX = () => [
    [L("Mutu beton pondasi?", "Foundation concrete grade?"), "beton pondasi mutu fc"], [L("Selimut beton", "Concrete cover"), "selimut beton"], [L("Lantai kerja", "Lean concrete"), "lantai kerja tebal"],
    [L("Mutu tulangan", "Rebar grade"), "tulangan mutu leleh"], ["Grout", "grout non shrink"], [L("Baut angkur", "Anchor bolts"), "baut angkur"], [L("Galvanis", "Galvanizing"), "galvanis tebal"],
    [L("Pemadatan timbunan", "Backfill compaction"), "pemadatan timbunan"], [L("Uji tiang", "Pile testing"), "uji tiang PDA loading test"], [L("Elevasi atas pondasi", "Top of concrete"), "elevasi atas pondasi di atas tanah"],
  ]
  const PAGE = 8
  let qTimer = 0, resBox = null, qInput = null, facetBox = null, clearB = null, shown = PAGE
  function drawSearch() {
    searchBox.textContent = ""
    const docs = DOCS || []
    if (!docs.length) { resBox = qInput = facetBox = null; searchBox.append(emptyState()); return }
    const wrap = el("div", "rt-search")
    const row = el("div", "rt-q")
    const icS = el("span", "rt-q-ic"); icS.append(ico("search"))
    qInput = el("input"); qInput.type = "search"; qInput.value = S.q || ""; qInput.placeholder = L("Tanya RTS… mis. beton pondasi pakai mutu berapa?", "Ask RTS… e.g. what concrete grade for foundations?")
    qInput.setAttribute("enterkeyhint", "search"); qInput.autocapitalize = "off"; qInput.spellcheck = false; qInput.setAttribute("aria-label", L("Cari di RTS", "Search RTS"))
    clearB = btn("rt-q-x", null, "close"); clearB.setAttribute("aria-label", L("Hapus kueri", "Clear query")); clearB.hidden = !qInput.value
    clearB.onclick = () => { qInput.value = ""; run(false); qInput.focus() }
    const kbd = el("kbd", "rt-kbd", "/"); kbd.title = L("Tekan / atau ⌘K untuk mencari", "Press / or ⌘K to search")
    row.append(icS, qInput, clearB, kbd)
    facetBox = el("div", "rt-facets"); facetBox.setAttribute("role", "group"); facetBox.setAttribute("aria-label", L("Saring dokumen", "Filter documents"))
    resBox = el("div", "rt-res"); resBox.setAttribute("aria-live", "polite")
    wrap.append(row, facetBox, resBox)
    qInput.oninput = () => { clearB.hidden = !qInput.value; clearTimeout(qTimer); qTimer = setTimeout(() => run(false), 220) }
    qInput.onkeydown = (e) => {
      if (e.key === "Enter") { clearTimeout(qTimer); run(true); qInput.blur() }
      else if (e.key === "ArrowDown") { const f = resBox.querySelector(".rt-nav"); if (f) { f.focus(); e.preventDefault() } }
      else if (e.key === "Escape" && qInput.value) { qInput.value = ""; run(false); e.preventDefault() }
    }
    resBox.onkeydown = (e) => {
      const items = [...resBox.querySelectorAll(".rt-nav")], i = items.indexOf(document.activeElement)
      if (i < 0) return
      if (e.key === "ArrowDown" && i < items.length - 1) { items[i + 1].focus(); e.preventDefault() }
      else if (e.key === "ArrowUp") { (i > 0 ? items[i - 1] : qInput).focus(); e.preventDefault() }
      else if ((e.key === "Enter" || e.key === " ") && e.target === items[i]) { items[i].click(); e.preventDefault() }
    }
    searchBox.append(wrap)
    shown = PAGE
    run(false)
  }
  function facets(counts, total) {
    facetBox.textContent = ""
    const docs = DOCS || []
    if (docs.length < 2 && !S.doc) { facetBox.hidden = true; return }
    facetBox.hidden = false
    const chip = (id, label, n) => {
      const b = btn("rt-facet" + (S.doc === id ? " on" : ""), label)
      b.setAttribute("aria-pressed", S.doc === id)
      const d = id && docs.find((x) => x.id === id); if (d) b.title = `${d.docNo} — ${docTitle(d)}`
      if (n != null) b.append(el("i", null, String(n)))
      b.onclick = () => { S.doc = S.doc === id && id ? "" : id; saveSt(S); shown = PAGE; run(false) }
      facetBox.append(b)
    }
    chip("", L("Semua dokumen", "All documents"), counts ? total : null)
    const list = counts ? docs.filter((d) => counts[d.id] || d.id === S.doc).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)) : docs
    list.forEach((d) => chip(d.id, d.docNo, counts ? counts[d.id] || 0 : null))
  }
  function run(commit) {
    if (!resBox) return
    const q = qInput.value.trim()
    if (clearB) clearB.hidden = !qInput.value
    S.q = q
    if (commit && q) { S.recent = [q, ...S.recent.filter((x) => x !== q)].slice(0, 8) }
    saveSt(S)
    resBox.textContent = ""
    if (!q) { facets(null); resBox.append(idle()); return }
    const t0 = performance.now()
    const all = search(index(), q, { limit: 200 })
    const counts = {}
    all.forEach((r) => { counts[r.doc.id] = (counts[r.doc.id] || 0) + 1 })
    facets(counts, all.length)
    const rs = (S.doc ? all.filter((r) => r.doc.id === S.doc) : all).slice(0, 50)
    const groups = parseQuery(q)
    const ms = performance.now() - t0
    const nDoc = new Set(rs.map((r) => r.doc.id)).size
    const head = el("div", "rt-res-h")
    const ht = el("div")
    ht.append(el("b", null, rs.length ? `${rs.length}${rs.length === 50 ? "+" : ""} ${L("pasal relevan", "relevant clauses")} · ${nDoc} ${L("dokumen", nDoc === 1 ? "document" : "documents")}` : L("Tidak ada yang cocok", "No match")), el("small", null, `${groups.map((g) => g.raw).join(" · ")} · ${nf(ms, 0)} ms`))
    const view = el("div", "rt-view"); view.setAttribute("role", "group"); view.setAttribute("aria-label", L("Tampilan hasil", "Result view"))
    ;[["rel", L("Relevansi", "Relevance")], ["doc", L("Per dokumen", "By document")]].forEach(([k, lab]) => { const b = btn("rt-viewb" + ((S.view || "rel") === k ? " on" : ""), lab); b.setAttribute("aria-pressed", (S.view || "rel") === k); b.onclick = () => { S.view = k; saveSt(S); run(false) }; view.append(b) })
    head.append(ht, view)
    resBox.append(head)
    if (rs.length) { const leg = el("div", "rt-legend"); leg.append(el("mark", "rt-hl", L("kata dicari", "query word")), el("mark", "rt-val", L("nilai · ketuk untuk menetapkan", "value · tap to pin"))); resBox.append(leg) }
    if (!rs.length) {
      const e = el("div", "rt-none-box")
      e.append(el("b", null, L("Belum ketemu", "Nothing found")), el("p", null, S.doc ? L("Pencarian dibatasi pada satu dokumen. Coba “Semua dokumen”, atau kata lain yang lebih umum (mis. “beton” saja).", "Search is limited to one document. Try “All documents”, or a broader word (e.g. just “concrete”).") : L("Coba kata lain atau lebih umum (mis. “beton” saja). Kata Indonesia & Inggris dicocokkan bersama.", "Try other or broader words (e.g. just “concrete”). Indonesian & English words are matched together.")))
      resBox.append(e); return
    }
    // jawaban cepat: kalimat terbaik hasil teratas yang memuat nilai
    const top = rs.find((r) => r.values && r.values.length && r.hit === r.of) || null
    if (top) {
      const ans = el("div", "rt-ans rt-nav"); ans.tabIndex = 0; ans.setAttribute("role", "button")
      const k = el("span", "rt-ans-k"); k.append(ico("spark"), el("span", null, L("Jawaban cepat", "Quick answer")))
      const src = el("div", "rt-ans-src")
      src.append(el("small", null, L("Sumber", "Source")), docLine(top.doc), el("small", null, `${top.sec.no ? "§" + top.sec.no + " " : ""}${top.sec.title || ""} · ${L("hal.", "p.")} ${top.sec.page} · ${L("verifikasi di dokumen sumber", "verify in the source document")}`))
      ans.append(k, marked(top.best, groups, { cls: "rt-ans-tx", onVal: (v) => quickPin(v, top.doc, top.sec) }), src)
      ans.onclick = () => openSection(top.doc, top.sec, groups)
      resBox.append(ans)
    }
    const hit = (r, i, withDoc) => {
      const it = el("article", "rt-hit rt-nav"); it.style.setProperty("--i", Math.min(i, 10)); it.tabIndex = 0; it.setAttribute("role", "button")
      const cov = el("span", "rt-cov" + (r.hit === r.of ? " full" : "")); cov.textContent = `${r.hit}/${r.of}`; cov.title = L("kata kueri yang cocok", "query words matched")
      const pg = el("small", "rt-pg", `${L("hal.", "p.")} ${r.sec.page}`)
      const tt = el("b", "rt-hit-t", `${r.sec.no ? "§" + r.sec.no + " " : ""}${r.sec.title || L("(tanpa judul)", "(untitled)")}`)
      const top = el("div", "rt-hit-top")
      // dengan dokumen: baris 1 = nomor + judul dokumen RTS, baris 2 = pasal; dalam kelompok dokumen: pasal langsung di baris 1
      if (withDoc) { top.append(docLine(r.doc), pg, cov); it.append(top, tt) } else { top.append(tt, pg, cov); it.append(top) }
      if (r.sec.parent) it.append(el("small", "rt-parent", r.sec.parent))
      it.append(marked(r.snippet, groups, { pre: r.pre, post: r.post, onVal: (v) => quickPin(v, r.doc, r.sec) }))
      it.onclick = () => openSection(r.doc, r.sec, groups)
      return it
    }
    const page = rs.slice(0, shown)
    if ((S.view || "rel") === "doc") {
      // kelompok per dokumen: judul dokumen RTS sebagai kepala, pasal-pasalnya di bawah (urut relevansi)
      const byDoc = new Map()
      page.forEach((r) => { if (!byDoc.has(r.doc.id)) byDoc.set(r.doc.id, []); byDoc.get(r.doc.id).push(r) })
      let i = 0
      for (const [id, arr] of byDoc) {
        const g = el("section", "rt-dgrp")
        const gh = el("div", "rt-dgrp-h")
        gh.append(docLine(arr[0].doc, "rt-docl big"), el("small", null, `${counts[id]} ${L("pasal", counts[id] === 1 ? "clause" : "clauses")}`))
        const lst = el("div", "rt-hits")
        arr.forEach((r) => lst.append(hit(r, i++, false)))
        g.append(gh, lst)
        resBox.append(g)
      }
    } else {
      const list = el("div", "rt-hits")
      page.forEach((r, i) => list.append(hit(r, i, true)))
      resBox.append(list)
    }
    if (rs.length > shown) {
      const more = btn("rt-more", `${L("Tampilkan lebih banyak", "Show more")} (${rs.length - shown})`, "chevR")
      more.onclick = () => { shown += PAGE * 2; run(false) }
      resBox.append(more)
    }
  }
  // keadaan tanpa kueri: contoh pertanyaan, riwayat, tips
  function idle() {
    const g = el("div", "rt-idle")
    const c1 = el("div", "rt-group"), c2 = el("div", "rt-group")
    c1.append(el("div", "rt-group-h", L("Contoh pertanyaan", "Example questions")))
    const go = (q) => { qInput.value = q; shown = PAGE; run(true) }
    EX().forEach(([lab, q]) => { const b = btn("rt-row"); b.append(ico("search"), el("span", null, lab), ico("chevR")); b.onclick = () => go(q); c1.append(b) })
    const h2 = el("div", "rt-group-h"); h2.append(el("span", null, L("Pencarian terakhir", "Recent searches")))
    if (S.recent.length) { const cl = btn("rt-link", L("hapus", "clear")); cl.onclick = () => { S.recent = []; saveSt(S); run(false) }; h2.append(cl) }
    c2.append(h2)
    if (S.recent.length) S.recent.slice(0, 6).forEach((q) => { const b = btn("rt-row"); b.append(ico("chart"), el("span", null, q), ico("chevR")); b.onclick = () => go(q); c2.append(b) })
    else c2.append(el("p", "rt-group-e", L("Belum ada. Pencarian yang Anda kirim (Enter) muncul di sini.", "None yet. Searches you submit (Enter) appear here.")))
    const tip = el("div", "rt-tipbox")
    tip.append(ico("info"), el("span", null, L("Kata Indonesia & Inggris dicocokkan bersama: beton = concrete, selimut = cover, lantai kerja = lean concrete, baut angkur = anchor bolt, pemadatan = compaction.", "Indonesian & English words are matched together: beton = concrete, selimut = cover, lantai kerja = lean concrete, baut angkur = anchor bolt, pemadatan = compaction.")))
    c2.append(tip)
    g.append(c1, c2)
    return g
  }
  function emptyState() {
    const e = el("div", "rt-empty")
    const ic = el("span", "rt-empty-ic"); ic.append(ico("book"))
    e.append(ic, el("h2", null, L("Belum ada dokumen RTS di iPad ini", "No RTS documents on this iPad yet")),
      el("p", null, L("Impor berkas RTS sekali. Teks dibaca & diindeks di iPad, lalu langsung bisa dicari tanpa internet.", "Import the RTS files once. Text is read & indexed on the iPad and is searchable right away, offline.")))
    const ol = el("ol", "rt-steps")
    ;[[L("Simpan", "Save"), L("Taruh berkas RTS (PDF/DOCX/XLSX) di app Files atau iCloud Drive.", "Put the RTS files (PDF/DOCX/XLSX) in the Files app or iCloud Drive.")],
      [L("Impor", "Import"), L("Ketuk kotak di bawah dan pilih semua berkasnya sekaligus.", "Tap the box below and select all files at once.")],
      [L("Cari", "Search"), L("Tanya bebas, tetapkan nilai, lalu cek kepatuhan Desain.", "Ask freely, pin values, then check Design compliance.")]].forEach(([b, s], i) => { const li = el("li"); li.append(el("i", null, String(i + 1)), el("b", null, b), el("span", null, s)); ol.append(li) })
    e.append(ol, makeDrop(true))
    return e
  }

  // ---------------------------------------------------------------- penetapan nilai
  let toastT = 0
  function toast(msg, undo) {
    const t = document.getElementById("toast"); if (!t) return
    t.textContent = msg
    if (undo) { const b = el("button", null, L("Urungkan", "Undo")); b.type = "button"; b.onclick = () => { clearTimeout(toastT); t.hidden = true; undo() }; t.append(b) }
    t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true }, undo ? 5200 : 2600)
  }
  const restore = (id, prev) => () => { if (prev) S.pins[id] = prev; else delete S.pins[id]; saveSt(S); refreshPins() }
  function refreshPins() { drawParams(); drawCompliance(); drawStats() }
  // pilih parameter untuk nilai yang diketuk di hasil pencarian
  function quickPin(v, doc, sec) {
    const fit = PARAMS.filter((p) => p.kinds.includes(v.kind) && p.cmp !== "x")
    const pan = openPanel(true, refOf(doc, sec), `${L("Tetapkan", "Pin")} “${v.txt}” ${L("sebagai…", "as…")}`)
    const list = el("div", "rt-pick")
    ;(fit.length ? fit : PARAMS).forEach((p) => {
      const b = btn("rt-pick-b"); const tx = el("span"); tx.append(el("b", null, L(...p.lab)), el("small", null, S.pins[p.id] ? `${L("sekarang", "now")}: ${S.pins[p.id].txt}` : L(...PARAM_GROUPS[p.grp])))
      b.append(tx, ico("chevR")); b.onclick = () => { pin(p, v, doc, sec); killSheet() }; list.append(b)
    })
    pan.append(list)
  }
  function pin(p, v, doc, sec) {
    const prev = S.pins[p.id]
    const num = v.kind === "num" ? v.v : pinNumber({ txt: v.grade || v.txt }, p)
    S.pins[p.id] = { txt: v.grade || v.txt, num: num != null && isFinite(num) ? Math.round(num * 1000) / 1000 : null, src: doc ? refOf(doc, sec) : L("manual", "manual"), doc: doc ? doc.id : "", at: Date.now() }
    saveSt(S); refreshPins()
    toast(`✓ ${L(...p.lab)} = ${S.pins[p.id].txt}`, restore(p.id, prev))
  }
  function unpin(p) {
    const prev = S.pins[p.id]; if (!prev) return
    delete S.pins[p.id]; saveSt(S); refreshPins()
    toast(`${L("Dilepas", "Unpinned")}: ${L(...p.lab)}`, restore(p.id, prev))
  }

  // ---------------------------------------------------------------- parameter kunci (daftar ringkas + panel detail)
  const stOf = (p) => (S.pins[p.id] ? "pinned" : candsOf(p).length ? "sugg" : "none")
  const PF = () => [["all", L("Semua", "All")], ["pinned", L("Ditetapkan", "Pinned")], ["sugg", L("Ada saran", "Suggested")], ["none", L("Tidak ditemukan", "Not found")]]
  function drawParams() {
    paramBox.textContent = ""
    const docs = DOCS || []
    const st = Object.fromEntries(PARAMS.map((p) => [p.id, stOf(p)]))
    const cnt = { all: PARAMS.length, pinned: 0, sugg: 0, none: 0 }
    for (const k of Object.values(st)) cnt[k]++
    if (!PF().some(([k]) => k === S.pf)) S.pf = "all"
    const head = el("div", "rt-ph")
    head.append(el("h2", null, L("Parameter kunci desain", "Key design parameters")), el("small", null, `${cnt.pinned}/${PARAMS.length} ${L("ditetapkan", "pinned")}`))
    const prog = el("div", "rt-progress"); const pb = el("i"); pb.style.width = `${(cnt.pinned / PARAMS.length) * 100}%`; prog.append(pb)
    prog.setAttribute("role", "progressbar"); prog.setAttribute("aria-valuemin", 0); prog.setAttribute("aria-valuemax", PARAMS.length); prog.setAttribute("aria-valuenow", cnt.pinned)
    const seg = el("div", "rt-seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", L("Saring parameter", "Filter parameters"))
    PF().forEach(([k, lab]) => { const b = btn("rt-segb" + (S.pf === k ? " on" : ""), lab); b.append(el("i", null, String(cnt[k]))); b.setAttribute("aria-pressed", S.pf === k); b.onclick = () => { S.pf = k; saveSt(S); drawParams() }; seg.append(b) })
    paramBox.append(head, prog, seg, el("p", "dz-note", docs.length
      ? L("Ketuk baris untuk melihat kandidat & pasal sumbernya, atau ketuk nilai saran untuk langsung menetapkannya. Nilai saran adalah kandidat — selalu baca pasalnya.", "Tap a row to see candidates & their source clause, or tap a suggested value to pin it right away. Suggestions are candidates — always read the clause.")
      : L("Impor dokumen RTS di tab Pustaka agar nilai dicari otomatis. Nilai juga bisa diisi manual.", "Import RTS documents in the Library tab for automatic suggestions. Values can also be typed in.")))
    let any = false
    for (const [g, gl] of Object.entries(PARAM_GROUPS)) {
      const ps = PARAMS.filter((p) => p.grp === g)
      const vis = ps.filter((p) => S.pf === "all" || st[p.id] === S.pf)
      if (!vis.length) continue
      any = true
      const sec = el("section", "rt-pgrp")
      const gh = el("div", "rt-group-h"); gh.append(el("span", null, L(...gl)), el("small", null, `${ps.filter((p) => S.pins[p.id]).length}/${ps.length}`))
      const grp = el("div", "rt-group")
      vis.forEach((p) => {
        const pinv = S.pins[p.id], c0 = candsOf(p)[0]
        const r = el("div", "rt-prow s-" + st[p.id]); r.tabIndex = 0; r.setAttribute("role", "button")
        const dot = el("span", "rt-dot"); dot.title = st[p.id] === "pinned" ? L("ditetapkan", "pinned") : st[p.id] === "sugg" ? L("ada saran", "suggested") : L("tidak ditemukan", "not found")
        const tx = el("span", "rt-ptx")
        tx.append(el("b", null, L(...p.lab)), el("small", null, pinv ? pinv.src : c0 ? refOf(c0.doc, c0.sec) : docs.length ? L("Tidak ditemukan otomatis — isi manual atau cari", "Not found automatically — type it or search") : L("Belum ada dokumen", "No documents yet")))
        const val = el("span", "rt-pval")
        if (pinv) val.append(el("span", "rt-pinv", pinv.txt))
        else if (c0 && c0.vals[0]) {
          const sg = btn("rt-sugg", c0.vals[0].grade || c0.vals[0].txt, "spark"); sg.title = L("Ketuk untuk menetapkan saran ini", "Tap to pin this suggestion")
          sg.onclick = (e) => { e.stopPropagation(); pin(p, c0.vals[0], c0.doc, c0.sec) }
          val.append(sg)
        } else val.append(el("span", "rt-dash", "—"))
        const chev = el("span", "rt-chev"); chev.append(ico("chevR"))
        r.append(dot, tx, val, chev)
        r.onclick = () => openParam(p)
        r.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === r) { e.preventDefault(); openParam(p) } }
        grp.append(r)
      })
      sec.append(gh, grp)
      paramBox.append(sec)
    }
    if (!any) paramBox.append(el("p", "rt-group-e", L("Tidak ada parameter pada saringan ini.", "No parameters match this filter.")))
    if (tab === "param") placeExp()
    tabBadge.param.textContent = `${cnt.pinned}/${PARAMS.length}`
  }
  function openParam(p) {
    const pinv = S.pins[p.id], cands = candsOf(p), grpQ = parseQuery(p.q)
    const pan = openPanel(false, L(...PARAM_GROUPS[p.grp]), L(...p.lab), p.unit ? `${L("satuan", "unit")}: ${p.unit}${p.cmp === "min" ? " · " + L("desain ≥ RTS", "design ≥ RTS") : p.cmp === "max" ? " · " + L("desain ≤ RTS", "design ≤ RTS") : ""}` : "")
    const b = el("div", "rt-pan-b plain")
    // nilai saat ini
    const cur = el("div", "rt-cur" + (pinv ? " on" : ""))
    if (pinv) {
      const ct = el("div"); ct.append(el("small", null, L("Nilai RTS ditetapkan", "Pinned RTS value")), el("b", null, pinv.txt), el("small", null, pinv.src))
      const bx = btn("rt-btn danger", L("Lepas", "Unpin"), "close"); bx.onclick = () => { killSheet(); unpin(p) }
      cur.append(ct, bx)
    } else cur.append(el("span", null, L("Belum ditetapkan. Pilih nilai dari kandidat di bawah, atau isi manual.", "Not pinned yet. Pick a value from the candidates below, or type one in.")))
    // isi manual (tanpa dialog prompt)
    const f = el("form", "rt-man")
    const mi = el("input"); mi.type = "text"; mi.value = pinv ? pinv.txt : ""; mi.placeholder = p.unit ? L(`mis. 28 ${p.unit}`, `e.g. 28 ${p.unit}`).replace("28 mm", "75 mm").replace("28 m/s", "33 m/s").replace("28 %", "95 %") : L("nilai / spesifikasi", "value / specification"); mi.setAttribute("aria-label", L("Nilai manual", "Manual value"))
    const ms = btn("rt-btn pri", L("Tetapkan", "Pin"), "pin"); ms.type = "submit"
    f.append(mi, ms)
    f.onsubmit = (e) => { e.preventDefault(); const v = mi.value.trim(); killSheet(); if (!v) { unpin(p); return } const ev = extractValues(v)[0]; pin(p, ev || { txt: v, v: parseFloat(v.replace(",", ".")), unit: p.unit, kind: "other" }, null, null) }
    b.append(cur, el("div", "rt-sub", L("Isi manual", "Type a value")), f)
    b.append(el("div", "rt-sub", cands.length ? `${L("Kandidat dari RTS", "Candidates from RTS")} (${cands.length})` : L("Kandidat dari RTS", "Candidates from RTS")))
    if (!cands.length) b.append(el("p", "rt-group-e", (DOCS || []).length ? L("Tidak ditemukan otomatis. Coba cari dengan kata lain.", "Not found automatically. Try searching with other words.") : L("Impor dokumen RTS dulu di tab Pustaka.", "Import RTS documents in the Library tab first.")))
    cands.forEach((r) => {
      const cd = el("div", "rt-cand")
      cd.append(marked(r.best, grpQ, { cls: "rt-cand-tx", plain: p.kinds.includes("num"), onVal: (v) => { killSheet(); pin(p, v, r.doc, r.sec) } }))
      const ft = el("div", "rt-cand-f")
      const more = btn("rt-link", L("lihat pasal", "view clause"), "chevR"); more.onclick = () => openSection(r.doc, r.sec, grpQ, (v, d, s) => pin(p, v, d, s))
      const fs = el("div", "rt-cand-src"); fs.append(docLine(r.doc), el("small", null, `${r.sec.no ? "§" + r.sec.no + " " : ""}${r.sec.title || ""} · ${L("hal.", "p.")} ${r.sec.page}`))
      ft.append(fs, more)
      cd.append(ft)
      b.append(cd)
    })
    const acts = el("div", "rt-acts rt-pan-f")
    const bs = btn("rt-btn", L("Cari di RTS", "Search RTS"), "search")
    bs.onclick = () => { killSheet(); if (!qInput) return setTab("cari", true); qInput.value = p.q; shown = PAGE; run(true); setTab("cari", true) }
    acts.append(bs)
    pan.append(el("p", "rt-tip", L("Ketuk nilai bergaris pada kandidat untuk menetapkannya. Kandidat bisa saja nilai untuk elemen lain — baca pasal sumbernya.", "Tap an underlined value in a candidate to pin it. A candidate may refer to another element — read its source clause.")), b, acts)
  }

  // ---------------------------------------------------------------- cek kepatuhan Desain
  let cmpRows = [], cmpReady = false
  async function drawCompliance() {
    let D, steel
    try { [D, steel] = await Promise.all([import("./desain_ui.js"), import("./desain/steel.js")]) } catch (e) { cmpBox.textContent = ""; cmpBox.append(el("div", "err", e.message)); return }
    cmpBox.textContent = ""
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
    cmpRows = complianceRows(S.pins, src); cmpReady = true
    const nb = cmpRows.filter((r) => r.ok === false).length, nok = cmpRows.filter((r) => r.ok).length, nq = cmpRows.filter((r) => r.ok == null).length
    const head = el("div", "rt-ph")
    head.append(el("h2", null, L("Kepatuhan Desain terhadap RTS", "Design compliance with RTS")), el("small", null, cmpRows.length ? (nb ? `${nb} ${L("tidak sesuai", "not meeting")}` : L("semua sesuai", "all meeting")) : L("belum ada nilai RTS", "no RTS values yet")))
    cmpBox.append(head)
    if (!cmpRows.length) {
      const e = el("div", "rt-none-box")
      const go = btn("rt-btn pri", L("Buka Parameter", "Open Parameters"), "list"); go.onclick = () => setTab("param", true)
      e.append(el("b", null, L("Belum ada yang bisa dicek", "Nothing to check yet")), el("p", null, L("Tetapkan dulu nilai RTS untuk fc', fy, selimut, baut angkur, FS daya dukung, penurunan izin, atau kecepatan angin — lalu masukan modul Desain dicek otomatis di sini.", "Pin RTS values for fc', fy, cover, anchor bolts, bearing FS, allowable settlement or wind speed first — Design module inputs are then checked here automatically.")), go)
      cmpBox.append(e)
    } else {
      const sum = el("div", "rt-kpis")
      ;[[L("Dicek", "Checked"), cmpRows.length, ""], [L("Sesuai RTS", "Meets RTS"), nok, "ok"], [L("Tidak sesuai", "Not meeting"), nb, nb ? "bad" : ""], [L("Periksa manual", "Check manually"), nq, nq ? "warn" : ""]].forEach(([k, v, c]) => { const t = el("div", "rt-kpi " + c); t.append(el("span", null, k), el("b", null, String(v))); sum.append(t) })
      const tw = el("div", "dz-tw rt-tablew"), tb = el("table", "dz-res rt-cmp")
      const hr = el("tr"); [L("Parameter", "Parameter"), L("Lokasi masukan", "Input location"), L("Nilai desain", "Design value"), L("Syarat RTS", "RTS requirement"), L("Status", "Status")].forEach((h) => hr.append(el("th", null, h))); tb.append(hr)
      // yang tidak sesuai di atas
      ;[...cmpRows].sort((a, b) => (a.ok === false ? 0 : a.ok == null ? 1 : 2) - (b.ok === false ? 0 : b.ok == null ? 1 : 2)).forEach((r) => {
        const tr = el("tr", r.ok === false ? "bad" : "")
        const a = el("a", null, r.s.where); a.href = r.s.href
        const tdW = el("td"); tdW.append(a)
        const cmpTx = r.p.cmp === "min" ? "≥ " : r.p.cmp === "max" ? "≤ " : ""
        const st = el("td"); st.append(el("span", "rt-st " + (r.ok === true ? "uok" : r.ok === false ? "ubad" : "uwarn"), r.ok === true ? "✓ OK" : r.ok === false ? L("✕ tidak sesuai", "✕ not meeting") : L("? periksa", "? check")))
        tr.append(el("td", null, L(...r.p.lab)), tdW, el("td", "r", typeof r.s.val === "number" ? `${nf(r.s.val, r.s.unit === "mm" || r.s.unit === "MPa" ? 0 : 2)} ${r.s.unit}` : String(r.s.val)),
          el("td", null, `${cmpTx}${typeof r.lim === "number" ? nf(r.lim, Number.isInteger(r.lim) ? 0 : r.p.unit === "MPa" || r.p.unit === "mm" ? 1 : 2) + " " + (r.p.unit || "") : r.lim ?? S.pins[r.p.id].txt}`), st)
        tb.append(tr)
      })
      tw.append(tb)
      cmpBox.append(sum, tw, el("p", "dz-note", L("Sumber nilai RTS ada di tab Parameter. Ketuk lokasi masukan untuk membuka modulnya. K-xxx dikonversi ke fc' silinder ≈ 0,083·K MPa; ASTM Grade N (ksi) ≈ 6,895·N MPa.", "RTS value sources are in the Parameters tab. Tap an input location to open its module. K-xxx converted to cylinder fc' ≈ 0.083·K MPa; ASTM Grade N (ksi) ≈ 6.895·N MPa.")))
    }
    if (tab === "cek") placeExp()
    tabBadge.cek.textContent = cmpRows.length ? (nb ? String(nb) : "✓") : ""
    tabBadge.cek.className = "rt-tab-n" + (nb ? " bad" : cmpRows.length ? " ok" : "")
    drawStats()
  }

  // ---------------------------------------------------------------- ringkasan bento
  function drawStats() {
    const docs = DOCS || [], nSec = docs.reduce((a, d) => a + d.secs.length, 0)
    const nPin = PARAMS.filter((p) => S.pins[p.id]).length, nSug = docs.length ? PARAMS.filter((p) => !S.pins[p.id] && candsOf(p).length).length : 0
    const set = (k, v, s, fmt) => { const T = tiles[k]; if (T.v.dataset.v !== String(v)) { T.v.dataset.v = String(v); typeof v === "number" ? countUp(T.v, v, fmt) : (T.v.textContent = v) } T.s.textContent = s }
    set("docs", docs.length, docs.length ? `${nSec} ${L("pasal terindeks", "clauses indexed")}` : L("ketuk untuk impor", "tap to import"))
    set("pins", nPin, `${L("dari", "of")} ${PARAMS.length} ${L("parameter", "parameters")}`)
    ring.lastChild.setAttribute("stroke-dasharray", `${(nPin / PARAMS.length) * 100} 100`); ring.lastChild.style.opacity = nPin ? 1 : 0
    set("sugg", nSug, docs.length ? L("parameter punya kandidat nilai", "parameters with candidate values") : L("impor dokumen dulu", "import documents first"))
    const nb = cmpRows.filter((r) => r.ok === false).length
    const T = tiles.cmp
    T.t.classList.toggle("bad", nb > 0); T.t.classList.toggle("ok", cmpReady && cmpRows.length > 0 && !nb)
    if (!cmpReady || !cmpRows.length) set("cmp", "–", cmpReady ? L("tetapkan nilai RTS dulu", "pin RTS values first") : "")
    else if (nb) set("cmp", nb, L("masukan tidak sesuai RTS", "inputs not meeting RTS"))
    else set("cmp", "✓", `${cmpRows.length} ${L("masukan sesuai RTS", "inputs meet RTS")}`)
    tabBadge.pustaka.textContent = docs.length ? String(docs.length) : ""
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

  // ---------------------------------------------------------------- pintasan papan ketik
  if (keyHandler) removeEventListener("keydown", keyHandler)
  keyHandler = (e) => {
    if (!box.isConnected) { removeEventListener("keydown", keyHandler); keyHandler = null; return }
    if (e.key === "Escape" && !sheet.hidden) { killSheet(); e.preventDefault(); return }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable
    if (!sheet.hidden) return
    if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault()
      if (tab !== "cari") setTab("cari", true)
      if (qInput) { qInput.focus(); qInput.select() }
    }
  }
  addEventListener("keydown", keyHandler)

  function drawAll() { drawSearch(); drawParams(); drawCompliance(); drawLib(); exportBar(expBox, out, { project: projLoad().info }); drawStats(); setTab(tab); reveal(box) }
  // kerangka sementara saat pustaka dimuat
  Object.values(tiles).forEach((T) => T.t.classList.add("sk"))
  for (let i = 0; i < 3; i++) searchBox.append(el("div", "rt-skel sk"))
  setTab(tab)
  loadDocs().then(() => { if (!box.isConnected) return; Object.values(tiles).forEach((T) => T.t.classList.remove("sk")); searchBox.textContent = ""; drawAll() })
}
