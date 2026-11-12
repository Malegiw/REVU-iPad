// Penampil berkas asli RTS di dalam app (offline, pdf.js di js/vendor). Menggantikan window.open(blob:…): Safari di iPad memblokir jendela baru
// yang dibuka setelah menunggu IndexedDB, dan app yang dibuka dari Layar Utama tidak bisa menampilkan blob: di jendela lain.
// PDF: halaman digambar saat terlihat (yang jauh dilepas agar memori iPad aman), langsung ke halaman pasal, judul pasal + kata kueri + nilai disorot,
// perbesar dengan tombol, cubit (iPad), ctrl+gulir / cubit trackpad; ←/→ pindah halaman, Esc tutup. Bagikan / simpan lewat lembar Bagikan.
import { L } from "./desain/core.js"
import { el } from "./desain/ui.js"
import { ico } from "./icons.js"
import { loadPdfjs } from "./rts_store.js"
import { termSpans, extractValues, fold } from "./rts.js"

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const mk = (cls, label, icon, aria) => { const b = el("button", cls); b.type = "button"; if (icon) b.append(ico(icon)); if (label != null) b.append(el("span", null, label)); if (aria) { b.setAttribute("aria-label", aria); b.title = aria } return b }

// bagikan / simpan berkas: lembar Bagikan iPadOS (Simpan ke Files, Mail, Word, Excel …) bila tersedia, jika tidak unduh.
// Dipanggil langsung dari ketukan (blob sudah di memori) agar izin gestur pengguna tidak hilang.
export function shareFile(blob, name, type) {
  const file = new File([blob], name || "RTS", { type: type || blob.type || "application/octet-stream" })
  const dl = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 4000) }
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: file.name }).catch((e) => { if (!e || e.name !== "AbortError") dl() })
  } catch (e) { /* lanjut unduh */ }
  dl()
  return Promise.resolve()
}

// opsi: { blob, name, type, title, page (1-based), groups (kueri terurai), heading (judul pasal) }
export async function openPdf(o) {
  document.querySelectorAll(".rt-viewer").forEach((n) => n.dispatchEvent(new Event("rt-close")))
  const opener = document.activeElement
  const root = el("div", "rt-viewer"); root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", o.title || o.name || "PDF"); root.tabIndex = -1
  const bar = el("div", "rt-vbar")
  const bx = mk("rt-vb", null, "close", L("Tutup", "Close"))
  const tt = el("div", "rt-vt"), tb = el("b", null, o.title || o.name || "PDF"), ts = el("small", "rt-shimmer", L("Memuat PDF…", "Loading PDF…"))
  tt.append(tb, ts)
  const nav = el("div", "rt-vnav")
  const bPrev = mk("rt-vb", null, "chevL", L("Halaman sebelumnya", "Previous page")), bNext = mk("rt-vb", null, "chevR", L("Halaman berikutnya", "Next page"))
  const pin = el("input", "rt-vpg"); pin.type = "text"; pin.inputMode = "numeric"; pin.enterKeyHint = "go"; pin.setAttribute("aria-label", L("Nomor halaman", "Page number"))
  const pof = el("span", "rt-vof", "/ –")
  nav.append(bPrev, pin, pof, bNext)
  const zm = el("div", "rt-vzoom")
  const bOut = mk("rt-vb", "−", null, L("Perkecil", "Zoom out")), bFit = mk("rt-vb rt-vfit", "100%", null, L("Pas lebar", "Fit width")), bIn = mk("rt-vb", "+", null, L("Perbesar", "Zoom in"))
  zm.append(bOut, bFit, bIn)
  const bShare = mk("rt-vb rt-vshare", L("Bagikan", "Share"), "upload", L("Bagikan / simpan berkas asli", "Share / save the original file"))
  bar.append(bx, tt, nav, zm, bShare)
  const sc = el("div", "rt-vscroll"), box = el("div", "rt-vpages")
  sc.append(box)
  root.append(bar, sc)
  document.body.append(root)
  document.documentElement.classList.add("rt-lock")
  requestAnimationFrame(() => { try { root.focus({ preventScroll: true }) } catch (e) { /* abaikan */ } })

  let lib = null, doc = null, sizes = [], pages = [], z = 1, fit = 1, gen = 0, cur = Math.max(1, o.page || 1), alive = true, io = null, headDone = false, rTimer = 0
  const scale = () => fit * z
  function close() {
    if (!alive) return
    alive = false; gen++
    if (io) io.disconnect()
    removeEventListener("keydown", onKey, true); removeEventListener("hashchange", close)
    root.remove()
    if (!document.querySelector(".rt-sheet:not([hidden])")) document.documentElement.classList.remove("rt-lock")
    if (doc) doc.destroy().catch(() => null)
    if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }) } catch (e) { /* abaikan */ }
  }
  root.addEventListener("rt-close", close)
  bx.onclick = close
  addEventListener("hashchange", close)
  bShare.onclick = () => shareFile(o.blob, o.name, o.type || "application/pdf")

  try {
    lib = await loadPdfjs()
    doc = await lib.getDocument({ data: new Uint8Array(await o.blob.arrayBuffer()), isEvalSupported: false, useSystemFonts: true }).promise
    if (!alive) { doc.destroy(); return }
    for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1 }); sizes.push({ w: vp.width, h: vp.height }) }
  } catch (e) {
    ts.classList.remove("rt-shimmer"); ts.textContent = ""
    const er = el("div", "rt-verr"); er.append(el("b", null, L("PDF tidak bisa dibuka", "Could not open the PDF")), el("p", null, e.message || String(e)), mk("rt-btn", L("Bagikan / simpan berkas", "Share / save the file"), "upload"))
    er.lastChild.onclick = () => shareFile(o.blob, o.name, o.type || "application/pdf")
    sc.append(er)
    return
  }
  if (!alive) return
  cur = Math.min(cur, doc.numPages)
  ts.classList.remove("rt-shimmer")
  pof.textContent = `/ ${doc.numPages}`
  sizes.forEach((sz, i) => {
    const w = el("div", "rt-vpage"); w.dataset.i = i
    const hl = el("div", "rt-vhl")
    w.append(el("span", "rt-vno", String(i + 1)), hl)
    box.append(w)
    pages.push({ w, hl, canvas: null, at: 0, busy: -1 })
  })

  // ukuran halaman mengikuti lebar layar × perbesaran
  function layout() {
    const avail = Math.max(200, sc.clientWidth - 24)
    fit = avail / Math.max(...sizes.map((s) => s.w))
    const k = scale()
    pages.forEach((p, i) => { p.w.style.width = `${Math.floor(sizes[i].w * k)}px`; p.w.style.height = `${Math.floor(sizes[i].h * k)}px` })
    bFit.lastChild.textContent = `${Math.round(z * 100)}%`
  }
  function setZoom(nz, anchor) {
    nz = Math.min(4, Math.max(0.5, nz))
    if (Math.abs(nz - z) < 1e-3) return
    const r = sc.getBoundingClientRect()
    const ax = anchor ? anchor.x - r.left : sc.clientWidth / 2, ay = anchor ? anchor.y - r.top : sc.clientHeight / 2
    const cx = sc.scrollLeft + ax, cy = sc.scrollTop + ay, k0 = scale()
    z = nz; layout()
    pages.forEach((p) => { p.hl.textContent = "" })
    const f = scale() / k0
    sc.scrollLeft = cx * f - ax; sc.scrollTop = cy * f - ay
    gen++
    clearTimeout(rTimer); rTimer = setTimeout(renderVisible, 140)
  }
  // gambar satu halaman pada skala saat ini (kanvas dibatasi ±12 juta piksel agar tidak melebihi batas Safari)
  async function render(i) {
    const p = pages[i], my = gen, k = scale()
    if ((p.at === k && p.canvas) || p.busy === my) return
    p.busy = my
    try { await draw(p, i, my, k) } finally { if (p.busy === my) p.busy = -1 }
  }
  async function draw(p, i, my, k) {
    const page = await doc.getPage(i + 1)
    if (!alive || my !== gen) return
    const vp = page.getViewport({ scale: k })
    let dpr = Math.min(2, devicePixelRatio || 1)
    while (vp.width * vp.height * dpr * dpr > 12e6 && dpr > 0.5) dpr *= 0.85
    const c = document.createElement("canvas")
    c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr)
    try { await page.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise } catch (e) { return }
    if (!alive || my !== gen) { c.width = c.height = 0; return }
    if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove() }
    p.canvas = c; p.at = k
    p.w.insertBefore(c, p.hl)
    p.w.classList.add("on")
    await marks(i, page, vp, my)
  }
  function unrender(i) { const p = pages[i]; if (!p.canvas) return; p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null; p.at = 0; p.hl.textContent = ""; p.w.classList.remove("on") }
  // sorotan: judul pasal (halaman tujuan), kata kueri, nilai teknis
  async function marks(i, page, vp, my) {
    const p = pages[i]
    p.hl.textContent = ""
    const head = i + 1 === o.page && o.heading ? fold(o.heading).replace(/\s+/g, " ").slice(0, 28) : ""
    if (!o.groups && !head) return
    let tc
    try { tc = await page.getTextContent() } catch (e) { return }
    if (!alive || my !== gen) return
    let headEl = null
    // posisi huruf diukur dengan font yang sama (bukan lebar rata) agar sorotan pas pada kata
    const mc = (marks.ctx ||= document.createElement("canvas").getContext("2d"))
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue
      const t = lib.Util.transform(vp.transform, it.transform)
      if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue                // teks diputar: lewati
      const fh = Math.hypot(t[2], t[3]), w = it.width * vp.scale, x0 = t[4], y0 = t[5], n = it.str.length
      const st = tc.styles && tc.styles[it.fontName]
      mc.font = `100px ${st && st.fontFamily ? st.fontFamily : "sans-serif"}`
      const full = mc.measureText(it.str).width || 1
      const at = (k) => (k <= 0 ? 0 : k >= n ? w : (w * mc.measureText(it.str.slice(0, k)).width) / full)
      const box = (a, b, cls) => { const xa = at(a), xb = at(b), d = el("i", cls); d.style.left = `${x0 + xa}px`; d.style.top = `${y0 - fh * 0.88}px`; d.style.width = `${Math.max(2, xb - xa)}px`; d.style.height = `${fh * 1.12}px`; p.hl.append(d); return d }
      if (head && !headEl && fold(it.str).replace(/\s+/g, " ").includes(head)) headEl = box(0, n, "head")
      if (o.groups) { for (const [a, b] of termSpans(it.str, o.groups)) box(a, b, "term"); for (const v of extractValues(it.str)) box(v.at, v.at + v.txt.length, "val") }
    }
    if (headEl && !headDone) { headDone = true; sc.scrollTo({ top: Math.max(0, p.w.offsetTop + headEl.offsetTop - sc.clientHeight * 0.3), behavior: reduced() ? "auto" : "smooth" }) }
  }
  const near = new Set()
  function renderVisible() {
    if (!alive) return
    const order = [...near].sort((a, b) => Math.abs(a - (cur - 1)) - Math.abs(b - (cur - 1)))
    order.forEach((i) => render(i))
    pages.forEach((p, i) => { if (!near.has(i) && p.canvas) unrender(i) })
  }
  io = new IntersectionObserver((es) => { es.forEach((e) => { const i = Number(e.target.dataset.i); if (e.isIntersecting) near.add(i); else near.delete(i) }); clearTimeout(rTimer); rTimer = setTimeout(renderVisible, 60) }, { root: sc, rootMargin: "900px 0px" })
  pages.forEach((p) => io.observe(p.w))

  // halaman saat ini dari posisi gulir
  let raf = 0
  sc.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = sc.scrollTop + sc.clientHeight * 0.35; let k = 0; while (k < pages.length - 1 && pages[k + 1].w.offsetTop <= y) k++; if (k + 1 !== cur) { cur = k + 1; showPage() } }) }, { passive: true })
  function showPage() { if (document.activeElement !== pin) pin.value = String(cur); ts.textContent = `${L("halaman", "page")} ${cur} ${L("dari", "of")} ${doc.numPages}${o.page ? ` · ${L("pasal di hal.", "clause on p.")} ${o.page}` : ""}`; bPrev.disabled = cur <= 1; bNext.disabled = cur >= doc.numPages }
  function goTo(n, smooth) { n = Math.min(doc.numPages, Math.max(1, n)); cur = n; showPage(); sc.scrollTo({ top: pages[n - 1].w.offsetTop - 12, behavior: smooth && !reduced() ? "smooth" : "auto" }) }
  bPrev.onclick = () => goTo(cur - 1, true); bNext.onclick = () => goTo(cur + 1, true)
  pin.onfocus = () => pin.select()
  pin.onkeydown = (e) => { if (e.key === "Enter") { const n = parseInt(pin.value, 10); if (isFinite(n)) goTo(n, false); pin.blur() } }
  pin.onblur = () => { pin.value = String(cur) }
  bIn.onclick = () => setZoom(z * 1.25); bOut.onclick = () => setZoom(z / 1.25); bFit.onclick = () => setZoom(1)

  // cubit di iPad (gesture Safari): pratinjau dengan transform, gambar ulang saat selesai
  let z0 = 1, g0 = null
  sc.addEventListener("gesturestart", (e) => { e.preventDefault(); z0 = z; g0 = { x: e.clientX, y: e.clientY }; const r = box.getBoundingClientRect(); box.style.transformOrigin = `${e.clientX - r.left}px ${e.clientY - r.top}px` })
  sc.addEventListener("gesturechange", (e) => { e.preventDefault(); const k = Math.min(4, Math.max(0.5, z0 * e.scale)) / z; box.style.transform = `scale(${k})` })
  sc.addEventListener("gestureend", (e) => { e.preventDefault(); box.style.transform = ""; setZoom(z0 * e.scale, g0) })
  // ctrl+gulir / cubit trackpad di komputer
  sc.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(z * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY }) }, { passive: false })
  function onKey(e) {
    if (!alive) return
    const typing = e.target === pin
    if (e.key === "Escape") { close(); e.preventDefault(); e.stopPropagation(); return }
    if (typing) return
    if (e.key === "ArrowRight" || e.key === "PageDown") { goTo(cur + 1, true); e.preventDefault() }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { goTo(cur - 1, true); e.preventDefault() }
    else if (e.key === "+" || e.key === "=") { setZoom(z * 1.25); e.preventDefault() }
    else if (e.key === "-") { setZoom(z / 1.25); e.preventDefault() }
    else if (e.key === "0") { setZoom(1); e.preventDefault() }
    else return
    e.stopPropagation()
  }
  addEventListener("keydown", onKey, true)
  new ResizeObserver(() => { if (!alive) return; const k0 = scale(); layout(); if (Math.abs(scale() - k0) > 1e-3) { gen++; clearTimeout(rTimer); rTimer = setTimeout(renderVisible, 140) } }).observe(sc)

  layout()
  goTo(cur, false)
  showPage()
  return close
}
