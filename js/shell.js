// Kerangka antarmuka v2: dock navigasi dengan pil meluncur, palet perintah (⌘K / Ctrl+K / "/"), lembar pengaturan
// (tema, warna aksen, bahasa, kepadatan, suara, gerak), toast bertumpuk, suara antarmuka (WebAudio, tanpa berkas),
// sorotan yang mengikuti penunjuk, dan transisi tema melingkar (View Transition API bila tersedia).
import { icoHTML } from "./icons.js"

const $ = (s, r = document) => r.querySelector(s)
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const root = document.documentElement
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* tanpa penyimpanan */ } },
}
const ACCENTS = [["teal", "Teal", "oklch(62% .1 195)"], ["blue", "Blue", "oklch(62% .16 255)"], ["violet", "Violet", "oklch(62% .17 292)"], ["rose", "Rose", "oklch(64% .17 12)"],
  ["amber", "Amber", "oklch(70% .14 62)"], ["green", "Green", "oklch(64% .13 152)"], ["neutral", "Neutral", "var(--fg)"]]
const calm = () => root.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches

// ---------------------------------------------------------------- suara antarmuka
// [frekuensi awal, frekuensi akhir, durasi s, volume, jeda s]
const SND = { tap: [[900, 640, .045, .03]], on: [[520, 840, .08, .04]], off: [[780, 470, .08, .04]], open: [[620, 640, .05, .028], [930, 950, .08, .028, .05]],
  close: [[700, 520, .06, .026]], ok: [[660, 670, .07, .034], [990, 1000, .12, .034, .075]], bad: [[230, 170, .15, .05]] }
let ac = null, soundOn = store.get("ymd.sound", "on") === "on", lastSnd = 0
export function sound(name) {
  if (!soundOn || !SND[name]) return
  const now = performance.now(); if (name === "tap" && now - lastSnd < 50) return; lastSnd = now
  try {
    ac = ac || new (self.AudioContext || self.webkitAudioContext)()
    if (ac.state === "suspended") ac.resume()
    const t0 = ac.currentTime
    for (const [f0, f1, dur, vol, delay = 0] of SND[name]) {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + delay
      o.type = name === "bad" ? "triangle" : "sine"
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur)
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.03)
    }
  } catch (e) { /* tanpa audio */ }
}

export function createShell(o) {
  const L = (id, en) => (o.getLang() === "en" ? en : id)
  const dock = $("#dock"), toasts = $("#toasts"), top = $(".ui-top")
  let layer = null                                   // lapisan yang sedang terbuka: { close }

  // ---------------------------------------------------------------- dock
  const pill = el("span", "ui-dock-pill still")
  function placePill(still) {
    const a = $("a.on", dock); if (!a) return
    pill.classList.toggle("still", !!still || calm())
    pill.style.width = a.offsetWidth + "px"; pill.style.transform = `translateX(${a.offsetLeft}px)`
    if (still) requestAnimationFrame(() => pill.classList.remove("still"))
  }
  let navSig = ""
  function drawNav() {
    const cur = o.current(), sig = o.getLang()
    if (navSig !== sig) {                            // bangun ulang hanya saat bahasa berubah, supaya pil bisa meluncur antar menu
      navSig = sig; dock.textContent = ""; dock.append(pill)
      o.routes.forEach((r) => {
        const a = el("a"); a.href = "#/" + (r.id === "home" ? "" : r.id); a.dataset.r = r.id; a.title = r.title(); a.innerHTML = icoHTML(r.icon)
        a.append(el("span", "l", r.label()), el("span", "s", r.short())); dock.append(a)
      })
      $("#btnSearch").innerHTML = icoHTML("search") + `<span>${L("Cari atau lompat ke…", "Search or jump to…")}</span><kbd>${/Mac|iP(hone|ad|od)/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd>`
      $("#btnSearch").setAttribute("aria-label", L("Cari", "Search"))
      $("#btnSet").innerHTML = icoHTML("sliders"); $("#btnSet").setAttribute("aria-label", L("Pengaturan", "Settings")); $("#btnSet").title = L("Pengaturan", "Settings")
    }
    const was = $("a.on", dock)
    dock.querySelectorAll("a").forEach((a) => { const on = a.dataset.r === cur; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current") })
    placePill(!was)
    const r = o.routes.find((x) => x.id === cur)
    $("#crumb").textContent = cur === "home" ? "" : r.title()
  }
  addEventListener("resize", () => placePill(true))
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placePill(true))
  // sembunyikan dock saat mengetik (papan ketik layar) supaya tidak menutupi masukan
  document.addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches("main input[type=text], main textarea") && matchMedia("(pointer: coarse)").matches) dock.classList.add("away") })
  document.addEventListener("focusout", () => dock.classList.remove("away"))
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 4)
  addEventListener("scroll", onScroll, { passive: true }); onScroll()

  // ---------------------------------------------------------------- gestur: suara ketuk & sorotan penunjuk
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("button, a[href], summary, input[type=checkbox], input[type=radio]")
    if (t && !t.dataset.snd && !t.disabled) sound("tap")
  }, true)
  if (matchMedia("(hover: hover)").matches) {
    document.addEventListener("pointermove", (e) => {
      const c = e.target.closest && e.target.closest(".spot, .dz-card, .hm-tile, .pj-case, .bn")
      if (!c) return
      const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px")
    }, { passive: true })
  }

  // ---------------------------------------------------------------- toast
  function toast(msg, opt = {}) {
    const t = el("div", "ui-toast " + (opt.tone || ""))
    if (opt.tone) t.innerHTML = icoHTML(opt.tone === "bad" ? "alert" : "check")
    t.append(el("span", null, msg))
    const close = () => { if (!t.isConnected || t.classList.contains("out")) return; t.classList.add("out"); setTimeout(() => t.remove(), calm() ? 0 : 260) }
    if (opt.action) { const b = el("button", null, opt.action); b.type = "button"; b.onclick = () => { close(); opt.onAction && opt.onAction() }; t.append(b) }
    else { t.onclick = close; setTimeout(close, opt.ms || 3600) }
    toasts.append(t)
    while (toasts.children.length > 3) toasts.firstElementChild.remove()
    sound(opt.tone === "bad" ? "bad" : opt.tone === "ok" ? "ok" : "open")
    return close
  }

  // ---------------------------------------------------------------- lapisan (palet & pengaturan)
  function openLayer(panel, onClose) {
    if (layer) layer.close(true)
    const scrim = el("div", "ui-scrim"), back = document.activeElement
    document.body.append(scrim, panel)
    requestAnimationFrame(() => { scrim.classList.add("on"); panel.classList.add("on") })
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); me.close() }
      if (e.key === "Tab") {                         // jebak fokus di dalam panel
        const f = [...panel.querySelectorAll("button, input, a[href], select")].filter((x) => !x.disabled && x.offsetParent)
        if (!f.length) return
        const i = f.indexOf(document.activeElement)
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus() } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus() }
      }
    }
    const me = {
      close(quiet) {
        if (layer !== me) return
        layer = null; document.removeEventListener("keydown", key, true)
        scrim.classList.remove("on"); panel.classList.remove("on")
        setTimeout(() => { scrim.remove(); panel.remove() }, calm() ? 0 : 280)
        if (!quiet) { sound("close"); if (back && back.focus) back.focus({ preventScroll: true }) }
        onClose && onClose()
      },
    }
    scrim.onclick = () => me.close()
    document.addEventListener("keydown", key, true)
    layer = me; sound("open")
    return me
  }

  // ---------------------------------------------------------------- tema (dengan transisi melingkar dari titik ketuk)
  function themeTo(t, ev) {
    const run = () => o.setTheme(t)
    if (!document.startViewTransition || calm()) return run()
    const r = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget.getBoundingClientRect() : null
    root.style.setProperty("--vx", (r ? r.left + r.width / 2 : innerWidth / 2) + "px"); root.style.setProperty("--vy", (r ? r.top + r.height / 2 : 0) + "px")
    document.startViewTransition(run)
  }
  const setAccent = (a) => { root.dataset.accent = a; store.set("ymd.accent", a) }
  const setSound = (on) => { soundOn = on; store.set("ymd.sound", on ? "on" : "off"); if (on) sound("on") }
  const setMotion = (on) => { if (on) delete root.dataset.motion; else root.dataset.motion = "off"; store.set("ymd.motion", on ? "on" : "off") }
  const setDensity = (d) => { root.dataset.density = d; store.set("ymd.density", d); requestAnimationFrame(() => placePill(true)) }

  // ---------------------------------------------------------------- lembar pengaturan
  function seg(opts, val, fn) {
    const s = el("div", "ui-seg"); s.style.setProperty("--n", opts.length); s.setAttribute("role", "group")
    const set = (v) => { s.style.setProperty("--i", Math.max(0, opts.findIndex((x) => x[0] === v))); [...s.children].forEach((b, i) => b.setAttribute("aria-pressed", String(opts[i][0] === v))) }
    opts.forEach(([v, label, icon]) => { const b = el("button"); b.type = "button"; b.innerHTML = icon ? icoHTML(icon) : ""; b.append(el("span", null, label)); b.onclick = (e) => { set(v); fn(v, e) }; s.append(b) })
    set(val)
    return s
  }
  function toggle(on, fn, label) {
    const b = el("button", "ui-switch"); b.type = "button"; b.setAttribute("role", "switch"); b.setAttribute("aria-checked", String(on)); b.setAttribute("aria-label", label); b.dataset.snd = "1"
    b.onclick = () => { const v = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(v)); sound(v ? "on" : "off"); fn(v) }
    return b
  }
  const row = (title, sub, ctl, col) => { const r = el("div", "ui-row" + (col ? " col" : "")), l = el("div", "ui-row-l"); l.append(el("span", null, title)); if (sub) l.append(el("small", null, sub)); r.append(l, ctl); return r }
  function openSettings() {
    const sh = el("div", "ui-sheet"); sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-label", L("Pengaturan", "Settings"))
    let me
    const fill = () => {
      sh.textContent = ""
      const grab = el("button", "ui-sheet-grab"); grab.type = "button"; grab.setAttribute("aria-label", L("Tutup", "Close")); grab.dataset.snd = "1"
      const h = el("div", "ui-sheet-h"), x = el("button", "ui-icb plain"); x.type = "button"; x.innerHTML = icoHTML("x"); x.setAttribute("aria-label", L("Tutup", "Close")); x.dataset.snd = "1"; x.onclick = () => me.close()
      h.append(el("b", null, L("Pengaturan", "Settings")), x)
      const sw = el("div", "ui-swatches"), cur = root.dataset.accent || "teal"
      ACCENTS.forEach(([id, name, c]) => { const b = el("button", "ui-sw"); b.type = "button"; b.style.setProperty("--c", c); b.title = name; b.setAttribute("aria-label", name); b.setAttribute("aria-pressed", String(id === cur))
        b.onclick = () => { setAccent(id); sw.querySelectorAll("button").forEach((y) => y.setAttribute("aria-pressed", String(y === b))) }; sw.append(b) })
      const keys = el("div", "ui-keys")
      ;[[L("Palet perintah", "Command palette"), ["⌘", "K"]], [L("Cari cepat", "Quick search"), ["/"]], [L("Pindah halaman", "Switch page"), ["1", "–", "7"]], [L("Tutup lapisan", "Close layer"), ["Esc"]]]
        .forEach(([t, ks]) => { const k = el("span"); ks.forEach((q) => k.append(q === "–" ? document.createTextNode("–") : el("kbd", null, q))); keys.append(el("span", null, t), k) })
      sh.append(grab, h,
        row(L("Tema", "Theme"), null, seg([["auto", L("Otomatis", "Auto"), "auto"], ["light", L("Terang", "Light"), "sun"], ["dark", L("Gelap", "Dark"), "moon"]], o.getTheme(), (v, e) => themeTo(v, e)), true),
        row(L("Warna aksen", "Accent colour"), L("Dipakai untuk pilihan aktif, tautan, dan grafik.", "Used for active choices, links and charts."), sw, true),
        row(L("Bahasa", "Language"), null, seg([["id", "Indonesia"], ["en", "English"]], o.getLang(), (v) => { o.setLang(v); setTimeout(fill, 0) }), true),
        row(L("Kepadatan", "Density"), null, seg([["comfortable", L("Nyaman", "Comfortable")], ["compact", L("Ringkas", "Compact")]], root.dataset.density || "comfortable", setDensity), true),
        row(L("Suara antarmuka", "Interface sounds"), L("Bunyi halus saat mengetuk dan beralih.", "Soft cues on taps and toggles."), toggle(soundOn, setSound, L("Suara antarmuka", "Interface sounds"))),
        row(L("Animasi", "Motion"), L("Matikan untuk tampilan tanpa gerak.", "Turn off for a still interface."), toggle(root.dataset.motion !== "off", setMotion, L("Animasi", "Motion"))),
        row(L("Pintasan papan ketik", "Keyboard shortcuts"), null, keys, true))
      // tarik ke bawah untuk menutup (lembar bawah di layar sempit)
      let y0 = null
      grab.onpointerdown = (e) => { y0 = e.clientY; sh.classList.add("dragging"); grab.setPointerCapture(e.pointerId) }
      grab.onpointermove = (e) => { if (y0 != null) sh.style.setProperty("--drag", Math.max(0, e.clientY - y0) + "px") }
      grab.onpointerup = grab.onpointercancel = (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; sh.classList.remove("dragging"); sh.style.removeProperty("--drag"); if (dy > 70 || dy < 4) me.close() }
    }
    fill()
    me = openLayer(sh)
    setTimeout(() => { const b = sh.querySelector(".ui-sheet-h button"); b && b.focus({ preventScroll: true }) }, 30)
  }

  // ---------------------------------------------------------------- palet perintah
  function commands() {
    const go = (h) => () => { location.hash = h }
    const cur = o.current()
    return [
      ...o.routes.map((r, i) => ({ g: L("Halaman", "Pages"), icon: r.icon, t: r.title(), k: r.label() + " " + r.id, hint: String(i + 1), cur: r.id === cur, run: go("#/" + (r.id === "home" ? "" : r.id)) })),
      ...o.mods.map((m) => ({ g: L("Kalkulator desain", "Design calculators"), icon: m.icon, t: m.title(), k: m.id + " " + m.keys, run: go("#/desain/" + m.id) })),
      { g: L("Tampilan", "Appearance"), icon: "sun", t: L("Tema terang", "Light theme"), k: "theme tema light terang", run: () => themeTo("light") },
      { g: L("Tampilan", "Appearance"), icon: "moon", t: L("Tema gelap", "Dark theme"), k: "theme tema dark gelap malam", run: () => themeTo("dark") },
      { g: L("Tampilan", "Appearance"), icon: "auto", t: L("Tema otomatis (ikut perangkat)", "Automatic theme (follow device)"), k: "theme tema auto otomatis system", run: () => themeTo("auto") },
      ...ACCENTS.map(([id, name]) => ({ g: L("Tampilan", "Appearance"), icon: "swatch", t: L("Aksen: ", "Accent: ") + name, k: "accent aksen warna color colour " + id, cur: (root.dataset.accent || "teal") === id, run: () => setAccent(id) })),
      { g: L("Tindakan", "Actions"), icon: "globe", t: L("Switch to English", "Ganti ke Bahasa Indonesia"), k: "language bahasa english indonesia", run: () => o.setLang(o.getLang() === "id" ? "en" : "id") },
      { g: L("Tindakan", "Actions"), icon: soundOn ? "mute" : "speaker", t: soundOn ? L("Matikan suara antarmuka", "Turn interface sounds off") : L("Nyalakan suara antarmuka", "Turn interface sounds on"), k: "sound suara mute bunyi", run: () => setSound(!soundOn) },
      { g: L("Tindakan", "Actions"), icon: "rows", t: root.dataset.density === "compact" ? L("Kepadatan nyaman", "Comfortable density") : L("Kepadatan ringkas", "Compact density"), k: "density kepadatan compact ringkas", run: () => setDensity(root.dataset.density === "compact" ? "comfortable" : "compact") },
      { g: L("Tindakan", "Actions"), icon: "print", t: L("Cetak halaman ini", "Print this page"), k: "print cetak pdf", run: () => setTimeout(() => print(), 320) },
      { g: L("Tindakan", "Actions"), icon: "sliders", t: L("Buka pengaturan", "Open settings"), k: "settings pengaturan preferences", run: () => setTimeout(openSettings, 0) },
      { g: L("Tindakan", "Actions"), icon: "refresh", t: L("Muat ulang aplikasi", "Reload the app"), k: "reload refresh muat ulang", run: () => location.reload() },
    ]
  }
  // cocokkan longgar: semua huruf kueri muncul berurutan; skor lebih tinggi untuk awal kata & huruf berdempetan
  function fuzzy(q, text) {
    const s = text.toLowerCase(); let i = 0, score = 0, last = -2; const hit = []
    for (const ch of q) {
      const j = s.indexOf(ch, i); if (j < 0) return null
      score += (j === last + 1 ? 6 : 1) + (j === 0 || s[j - 1] === " " ? 4 : 0) - Math.min(3, (j - i) * 0.2)
      hit.push(j); last = j; i = j + 1
    }
    return { score: score - s.length * 0.01, hit }
  }
  function openPalette() {
    const pal = el("div", "ui-pal"); pal.setAttribute("role", "dialog"); pal.setAttribute("aria-modal", "true"); pal.setAttribute("aria-label", L("Palet perintah", "Command palette"))
    const top2 = el("div", "ui-pal-in"); top2.innerHTML = icoHTML("search")
    const inp = el("input"); inp.type = "text"; inp.placeholder = L("Cari halaman, kalkulator, atau tindakan…", "Search pages, calculators or actions…"); inp.setAttribute("aria-label", inp.placeholder)
    inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("autocapitalize", "off")
    const esc = el("kbd", null, "Esc"); top2.append(inp, esc)
    const list = el("div", "ui-pal-list"); list.setAttribute("role", "listbox")
    const ft = el("div", "ui-pal-ft")
    ;[["↑↓", L("pilih", "navigate")], ["↵", L("jalankan", "run")]].forEach(([k, t]) => { const s = el("span"); s.append(el("kbd", null, k), document.createTextNode(t)); ft.append(s) })
    pal.append(top2, list, ft)
    const all = commands(); let shown = [], act = 0
    const hi = el("div", "ui-pal-hi")
    const mark = (i, scroll) => {
      act = Math.max(0, Math.min(shown.length - 1, i))
      shown.forEach((c, k) => c.node.setAttribute("aria-selected", String(k === act)))
      const n = shown[act] && shown[act].node
      hi.style.height = n ? n.offsetHeight + "px" : "0"; if (n) hi.style.transform = `translateY(${n.offsetTop}px)`
      if (n && scroll) n.scrollIntoView({ block: "nearest" })
    }
    const draw = () => {
      const raw = inp.value.trim().toLowerCase(), q = raw.replace(/\s+/g, "")
      list.textContent = ""; list.append(hi); shown = []
      let rows = all.map((c) => ({ c, m: q ? fuzzy(q, c.t) || (c.k.toLowerCase().includes(raw) ? { score: -5, hit: [] } : null) : { score: 0, hit: [] } })).filter((x) => x.m)
      if (q) rows.sort((a, b) => b.m.score - a.m.score)
      if (!rows.length) { list.append(el("div", "ui-pal-0", L("Tidak ada yang cocok. Coba kata lain.", "No matches. Try another word."))); hi.style.height = "0"; return }
      let g = null
      rows.slice(0, q ? 12 : 99).forEach(({ c, m }) => {
        if (!q && c.g !== g) { g = c.g; list.append(el("div", "ui-pal-g", g)) }
        const b = el("button", "ui-pal-i" + (c.cur ? " cur" : "")); b.type = "button"; b.setAttribute("role", "option"); b.dataset.snd = "1"; b.innerHTML = icoHTML(c.icon)
        const sp = el("span"); [...c.t].forEach((ch, i) => sp.append(m.hit.includes(i) ? el("mark", null, ch) : document.createTextNode(ch)))
        b.append(sp); if (q) b.append(el("small", null, c.g)); else if (c.hint) b.append(el("kbd", null, c.hint))
        const idx = shown.length
        b.onclick = () => run(idx); b.onpointermove = () => { if (act !== idx) mark(idx) }
        shown.push({ c, node: b }); list.append(b)
      })
      mark(0)
    }
    const me = openLayer(pal)
    const run = (i) => { const c = shown[i] && shown[i].c; if (!c) return; me.close(true); sound("ok"); c.run() }
    inp.oninput = draw
    inp.onkeydown = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); mark(act + 1 >= shown.length ? 0 : act + 1, true) }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(act - 1 < 0 ? shown.length - 1 : act - 1, true) }
      else if (e.key === "Enter") { e.preventDefault(); run(act) }
    }
    esc.onclick = () => me.close()
    draw(); setTimeout(() => { inp.focus(); mark(act) }, 30)
  }

  // ---------------------------------------------------------------- tombol & pintasan
  $("#btnSearch").dataset.snd = "1"; $("#btnSet").dataset.snd = "1"
  $("#btnSearch").onclick = openPalette
  $("#btnSet").onclick = openSettings
  addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (layer) layer.close(); else openPalette(); return }
    if (typing || layer || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "/") { e.preventDefault(); openPalette() }
    else if (/^[1-9]$/.test(e.key) && o.routes[+e.key - 1]) { const r = o.routes[+e.key - 1]; location.hash = "#/" + (r.id === "home" ? "" : r.id) }
  })

  return { drawNav, toast, openPalette, openSettings, sound,
    setOffline(text, off) { const c = $("#offline"); c.classList.toggle("off", !!off); c.lastElementChild.textContent = text; c.hidden = false } }
}
