import * as V from "./voice.js"
import { icoHTML } from "./icons.js"

export function mountFlow(parentElement, data, setTriggerValue) {
  const root = parentElement.querySelector(".ymd-flow-root")
  if (!root || !data) return
  if (root.dataset.sig === data.sig) return          // data sama: biarkan DOM (dan pilihan pengguna) apa adanya
  root.dataset.sig = data.sig
  root.textContent = ""

  const el = (tag, cls, txt) => {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (txt != null) e.textContent = txt
    return e
  }
  const pct = (v) => (v * 100).toFixed(3) + "%"
  const W = data.W, H = data.H - data.Y0
  const U = data.ui
  const card = root.parentElement
  Object.entries(data.vars).forEach(([k, v]) => card.style.setProperty("--" + k, v))

  const head = [el("h2", null, data.title), el("p", "lead", data.lead)]

  const stage = el("div", "stage")
  const img = el("img", "art"); img.src = data.scene; img.alt = data.alt; img.draggable = false
  const hl = el("div", "hl"); hl.hidden = true
  stage.append(img, hl)

  const chips = el("div", "chips")
  const hint = el("div", "hint", data.hint)
  const g1 = el("div", "grp"), g2 = el("div", "grp")
  g1.append(el("b", null, U.g1)); g2.append(el("b", null, U.g2))
  const tour = el("button", "tour", U.tour); tour.type = "button"
  chips.append(hint, g1, g2, tour)

  const panel = el("div", "panel"); panel.hidden = true
  panel.setAttribute("role", "region"); panel.setAttribute("aria-live", "polite")

  const dots = [], chipBtns = []
  let sel = null
  const N = data.stages.length
  // ---- narasi suara (Indonesia: suara wanita, Inggris: suara pria)
  const lang = data.lang === "en" ? "en" : "id"
  const VT = lang === "en"
    ? { listen: "Listen to the story", play: "Play", pause: "Pause", resume: "Resume", stop: "Stop", auto: "Continue to next stage", voice: "Voice", speed: "Speed", none: "Voice narration is not supported in this browser.", male: "male voice", female: "female voice", nov: "no English voice installed — use Settings → Accessibility → Spoken Content → Voices",
        src: "Voice source", rec: "Natural recording", dev: "Device voice", dl: "Save for offline", dling: "Saving", dlok: "Saved for offline", recOn: "natural recording",
        tip: "Tip for a more natural device voice: download an Enhanced/Premium voice (iPad: Settings → Accessibility → Spoken Content → Voices → English → Daniel (Enhanced)) and pick it here." }
    : { listen: "Dengarkan cerita", play: "Putar", pause: "Jeda", resume: "Lanjut", stop: "Berhenti", auto: "Lanjut otomatis ke tahap berikutnya", voice: "Suara", speed: "Kecepatan", none: "Narasi suara tidak didukung peramban ini.", male: "suara pria", female: "suara wanita", nov: "suara Bahasa Indonesia belum terpasang — buka Pengaturan → Aksesibilitas → Konten Lisan → Suara",
        src: "Sumber suara", rec: "Rekaman alami", dev: "Suara perangkat", dl: "Simpan untuk offline", dling: "Menyimpan", dlok: "Tersimpan offline", recOn: "rekaman alami",
        tip: "Tip suara perangkat lebih natural: unduh suara Enhanced/Premium (iPad: Pengaturan → Aksesibilitas → Konten Lisan → Suara → Bahasa Indonesia → Damayanti (Enhanced)), lalu pilih di sini." }
  let autoNext = true, chain = false
  const player = V.createPlayer(lang, {
    onState: (st) => { if (vbar) paintBar(st) },
    onEnd: () => { if (chain && autoNext && sel != null && sel < N) { const nx = sel + 1; show(nx, true); setTimeout(() => { if (sel === nx) { chain = true; player.play() } }, 650) } else chain = false },
  })
  let vbar = null, vbtn = null, vname = null
  function paintBar(st) {
    if (!vbtn) return
    vbtn.innerHTML = icoHTML(st === "playing" ? "pause" : "play") + `<span>${st === "playing" ? VT.pause : st === "paused" ? VT.resume : VT.play}</span>`
    vbtn.classList.toggle("on", st === "playing")
    vbar.classList.toggle("live", st === "playing")
  }
  function voiceBar(segs) {
    const bar = el("div", "vbar")
    if (!V.supported() && !V.recCount(lang)) { bar.append(el("span", "vnote", VT.none)); return bar }
    vbar = bar
    const b = el("button", "vplay"); b.type = "button"; vbtn = b
    b.onclick = () => { if (player.state === "playing") { chain = false; player.pause() } else { chain = true; player.play() } }
    const st = el("button", "vstop"); st.type = "button"; st.innerHTML = icoHTML("stop") + `<span>${VT.stop}</span>`; st.onclick = () => { chain = false; player.stop() }
    const eq = el("span", "veq"); eq.innerHTML = "<i></i><i></i><i></i><i></i>"
    const lab = el("label", "vauto"), cb = el("input"); cb.type = "checkbox"; cb.checked = autoNext; cb.onchange = () => { autoNext = cb.checked }
    lab.append(cb, el("span", null, VT.auto))
    const sp = el("select", "vrate"); sp.title = VT.speed
    ;[[0.85, "0,85×"], [1, "1×"], [1.15, "1,15×"], [1.3, "1,3×"]].forEach(([r, t]) => { const o = el("option", null, lang === "en" ? t.replace(",", ".") : t); o.value = r; if (Math.abs(V.rateGet() - r) < 1e-6) o.selected = true; sp.append(o) })
    sp.onchange = () => V.rateSet(Number(sp.value))
    vname = el("select", "vname"); vname.title = VT.voice
    const fill = () => {
      vname.textContent = ""
      const list = V.langVoices(lang), cur = V.pickVoice(lang)
      if (!list.length) { const o = el("option", null, VT.nov); vname.append(o); vname.disabled = true; return }
      vname.disabled = false
      list.forEach((v) => { const q = V.qualityTag(v), o = el("option", null, `${v.name} (${v.lang})${q ? " " + q : ""}`); o.value = v.voiceURI; if (cur.v && cur.v.voiceURI === v.voiceURI) o.selected = true; vname.append(o) })
    }
    fill(); V.onVoices(fill)
    vname.onchange = () => { V.setPreferred(lang, vname.value); sync() }
    const head = el("div", "vhead"); head.innerHTML = icoHTML("speaker"); const who = el("small"); head.append(el("b", null, VT.listen), who)
    // sumber suara: rekaman alami (bila assets/voice tersedia) atau suara perangkat
    const vsrc = el("select", "vrate vsrc"); vsrc.title = VT.src; vsrc.hidden = true
    ;[["rec", VT.rec], ["dev", VT.dev]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; vsrc.append(o) })
    const dl = el("button", "vstop vdl"); dl.type = "button"; dl.hidden = true; dl.innerHTML = icoHTML("download") + `<span>${VT.dl}</span>`
    const tip = el("small", "vtip"); tip.hidden = true
    const sync = () => {
      const recN = V.recCount(lang), useRec = recN > 0 && V.srcGet() !== "dev"
      vsrc.hidden = !recN; vsrc.value = V.srcGet(); dl.hidden = !useRec
      vname.hidden = useRec
      who.textContent = (lang === "en" ? VT.male : VT.female) + (useRec ? " · " + VT.recOn : "")
      const pv = V.pickVoice(lang).v
      tip.hidden = useRec || !V.supported() || (pv && V.quality(pv) >= 20); tip.textContent = VT.tip
    }
    vsrc.onchange = () => { V.srcSet(vsrc.value); const was = player.state === "playing"; player.stop(); chain = false; sync(); if (was) { chain = true; player.play() } }
    dl.onclick = async () => {
      dl.disabled = true
      const r = await V.recDownload(lang, (k, n) => { dl.lastChild.textContent = `${VT.dling} ${k}/${n}` })
      dl.lastChild.textContent = r.fail ? `${VT.dl} (${r.ok}/${r.n})` : VT.dlok; dl.disabled = !!(!r.fail && r.n)
    }
    sync(); V.onVoices(sync); V.recLoad().then(sync)
    bar.append(head, b, st, eq, lab, sp, vsrc, vname, dl, tip)
    player.load(segs)
    paintBar("idle")
    return bar
  }

  function list(tag, cls, items) {
    const l = el(tag, cls)
    items.forEach((t) => l.append(el("li", null, t)))
    return l
  }

  function show(n, scroll) {
    if (n !== sel || n == null) { const keep = chain; player.stop(); chain = keep && n != null }
    sel = n
    dots.forEach((b, i) => { b.classList.toggle("on", i + 1 === n); b.setAttribute("aria-pressed", String(i + 1 === n)) })
    chipBtns.forEach((b, i) => { b.classList.toggle("on", i + 1 === n); b.setAttribute("aria-pressed", String(i + 1 === n)) })
    tour.hidden = n != null
    if (n == null) { hl.hidden = true; panel.hidden = true; return }
    const s = data.stages[n - 1]
    const [bx, by, bw, bh] = s.box
    hl.style.left = pct(bx / W); hl.style.top = pct((by - data.Y0) / H)
    hl.style.width = pct(bw / W); hl.style.height = pct(bh / H)
    hl.hidden = false

    panel.textContent = ""
    const ph = el("div", "ph")
    const tt = el("div", "tt")
    tt.append(el("h3", null, s.name), el("div", "al", s.alias))
    const prev = el("button", "nav", U.prev); prev.type = "button"; prev.disabled = n <= 1; prev.onclick = () => show(n - 1, true)
    const next = el("button", "nav", U.next); next.type = "button"; next.disabled = n >= N; next.onclick = () => show(n + 1, true)
    const x = el("button", "x", "✕"); x.type = "button"; x.title = U.close; x.setAttribute("aria-label", U.close); x.onclick = () => show(null)
    ph.append(el("div", "num", String(n)), tt, prev, next, x)
    const gist = el("div", "gist", s.fn)
    panel.append(ph, gist)

    const cols = el("div", "cols")
    const left = el("div"), right = el("div")
    const fig = el("figure")
    const di = el("img"); di.src = s.detail; di.alt = U.motion + ": " + s.name; di.draggable = false
    fig.append(di, el("figcaption", null, U.motion))
    left.append(fig, el("h4", null, U.parts))
    const parts = el("ul", "parts")
    s.parts.forEach((p, i) => {
      const li = el("li")
      const b = el("b", null, p.name)
      li.append(el("span", "lt", String.fromCharCode(65 + i)), el("span", null))
      li.lastChild.append(b, document.createTextNode(" — " + p.fn))
      parts.append(li)
    })
    left.append(parts)
    // cerita dipecah per kalimat (disorot saat dibacakan)
    // teks yang dibacakan = V.stageTexts (sama dengan generator rekaman tools/tts_elevenlabs.mjs)
    const texts = V.stageTexts(s), ns = V.sentences(s.story).length
    const story = el("p", "story"), segs = [{ text: texts[0], node: gist }]
    texts.slice(1, 1 + ns).forEach((t) => { const sp = el("span", "sen", t + " "); story.append(sp); segs.push({ text: t, node: sp }) })
    const stepsL = list("ol", "steps", s.steps)
    ;[...stepsL.children].forEach((li, k) => segs.push({ text: texts[1 + ns + k], node: li }))
    right.append(el("h4", null, U.story), story, el("h4", null, U.steps), stepsL)
    const io = el("dl", "io")
    io.append(el("dt", null, U.inp), el("dd", null, s.inp), el("dt", null, U.out), el("dd", null, s.out))
    right.append(io)
    cols.append(left, right)
    panel.append(voiceBar(segs), cols)

    const more = el("div", "more")
    const c1 = el("div"), c2 = el("div")
    c1.append(el("h4", null, U.civil), list("ul", null, s.civil))
    c2.append(el("h4", null, U.check), list("ul", null, s.check))
    more.append(c1, c2)
    panel.append(more)
    if (s.note) panel.append(el("div", "note", U.note + ": " + s.note))
    if (s.calc.length) {
      const cb = el("div", "calc")
      s.calc.forEach((c) => {
        const b = el("button", null, U.calc + ": " + c.label); b.type = "button"
        b.onclick = () => setTriggerValue("goto", c.page)
        cb.append(b)
      })
      panel.append(cb)
    }
    panel.hidden = false
    panel.style.animation = "none"; void panel.offsetWidth; panel.style.animation = ""
    if (scroll !== false && panel.scrollIntoView) panel.scrollIntoView({ block: "start", behavior: "smooth" })
  }
  const pick = (n) => show(sel === n ? null : n)

  data.stages.forEach((s, i) => {
    const n = i + 1
    const d = el("button", "dot", String(n)); d.type = "button"
    d.style.left = pct(s.bx / W); d.style.top = pct((s.by - data.Y0) / H)
    d.title = s.name; d.setAttribute("aria-label", n + ". " + s.name); d.setAttribute("aria-pressed", "false")
    d.onclick = () => pick(n)
    stage.append(d); dots.push(d)
    const c = el("button", "chip", String(n)); c.type = "button"
    c.title = s.name; c.setAttribute("aria-label", n + ". " + s.name); c.setAttribute("aria-pressed", "false")
    c.onclick = () => pick(n)
    ;(n <= data.n_flow ? g1 : g2).append(c); chipBtns.push(c)
  })
  tour.onclick = () => show(1, true)

  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sel != null) { show(null); return }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target.classList && e.target.classList.contains("chip")) {
      const n = Math.min(N, Math.max(1, (Number(e.target.textContent) || 1) + (e.key === "ArrowRight" ? 1 : -1)))
      show(n, false); chipBtns[n - 1].focus(); e.preventDefault()
    }
  })

  function buildDiag() {
    const D = data.diag, dui = D.ui
    const box = el("div", "diag")
    box.append(el("h3", null, D.heading), el("p", "dintro", D.intro))
    const tabs = el("div", "dtabs"), body = el("div"), tbtn = []
    function table(cols, rows, mk) {
      const t = el("table"), hr = el("tr")
      cols.forEach((c) => hr.append(el("th", null, c)))
      t.append(hr)
      rows.forEach((r) => { const tr = el("tr"); mk(r).forEach((c) => tr.append(c)); t.append(tr) })
      return t
    }
    function detailsBox(title, node) {
      const d = el("details"); d.append(el("summary", null, title), node); return d
    }
    function showD(i) {
      tbtn.forEach((b, k) => b.classList.toggle("on", k === i))
      const g = D.items[i]
      body.textContent = ""
      const fig = el("figure"); const im = el("img"); im.src = g.img; im.alt = g.title; im.draggable = false
      const lk = el("a"); lk.href = g.img; lk.target = "_blank"; lk.rel = "noopener"; lk.title = dui.enlarge; lk.append(im)
      fig.append(lk)
      body.append(fig, el("p", "blurb", g.blurb + " " + dui.enlarge))
      if (g.equip) {
        const t = table([dui.tag, dui.name, dui.fn, dui.num], g.equip, (r) => {
          const goCell = el("td")
          r.n.forEach((n) => { const b = el("button", "go", String(n)); b.type = "button"; b.title = dui.goto + " " + n; b.onclick = () => show(n, true); goCell.append(b) })
          return [el("td", "tg", r.tag), el("td", null, r.name), el("td", null, r.fn), goCell]
        })
        body.append(detailsBox(dui.equip + " (" + g.equip.length + ")", t))
      }
      if (g.streams) {
        body.append(detailsBox(dui.streams + " (" + g.streams.length + ")", table([dui.stream, dui.what, dui.phase, dui.route], g.streams, (r) => [el("td", "tg", r[0]), el("td", null, r[1]), el("td", null, r[2]), el("td", null, r[3])])))
      }
      if (g.instr) {
        body.append(detailsBox(dui.instr + " (" + g.instr.length + ")", table([dui.tag, dui.name, dui.fn], g.instr, (r) => [el("td", "tg", r[0]), el("td", null, r[1]), el("td", null, r[2])])))
        body.append(detailsBox(dui.isa, list("ul", null, D.isa)))
      }
      body.append(detailsBox(dui.review, list("ul", null, g.review)), el("div", "dnote", dui.disclaimer))
    }
    D.items.forEach((g, i) => {
      const b = el("button", "dtab", g.tab); b.type = "button"; b.onclick = () => showD(i)
      tabs.append(b); tbtn.push(b)
    })
    box.append(tabs, body)
    showD(0)
    return box
  }

  root.append(...head, buildDiag(), stage, chips, panel, el("div", "disc", data.disclaimer))
}
