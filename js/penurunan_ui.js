// Halaman "Penurunan Pondasi" untuk app iPad offline. Rumus ada di penurunan.js (diuji terhadap Python). Teks Indonesia di sini = kunci terjemahan Inggris:
// fungsi t menerjemahkan, T menerjemahkan lalu mengisi tanda kurung kurawal kosong dengan argumen, K hanya menandai teks yang perlu diterjemahkan
// (data/en_penurunan.json dibuat oleh ipad_build.py dari semua teks yang dibungkus ketiganya).
import { analyze, SettleError, fixed, fmtG } from "./penurunan.js"

const K = (s) => s
const KEY = "ymd.penurunan.v1"
const SHAPES = { persegi: K("Persegi / persegi panjang"), lajur: K("Lajur (menerus)"), lingkaran: K("Lingkaran") }
const RIG = { fleksibel_tengah: K("Fleksibel, titik tengah (×1,00)"), fleksibel_rata: K("Fleksibel, rata-rata (×0,85)"), kaku: K("Kaku (×0,93)") }
const NAMES = [K("Tekanan bersih positif"), K("Penurunan total ≤ batas izin"), K("Distorsi sudut ≤ batas")]   // nama pengecekan dari penurunan.js
const ERRORS = [K("Lebar (dan panjang) pondasi harus positif."), K("Isi minimal satu lapis tanah di bawah dasar pondasi."), K("Tebal tiap lapis harus positif."),
  K("Tekanan bersih (q bruto dikurangi tegangan overburden di dasar pondasi) tidak positif: tidak ada penurunan tambahan.")]   // pesan SettleError
const DETAIL = [K("q bersih = {} kPa (bruto {} - overburden {})"), K("{} mm pada {} tahun (batas {} mm)"), K("Δ/L = 1/{} (batas 1/{}; Δ = {} mm pada {} m)")]
const LAYER_DEF = [
  { name: "Pasir", H: 3.0, g: 18.0, gs: 19.0, E: 20.0, nu: 0.30, clay: false },
  { name: "Lempung", H: 4.0, g: 17.0, gs: 17.5, E: 8.0, nu: 0.50, clay: true },
  { name: "Lempung", H: 3.0, g: 17.0, gs: 17.5, E: 8.0, nu: 0.50, clay: true },
  { name: "Pasir", H: 3.0, g: 18.0, gs: 19.0, E: 30.0, nu: 0.30, clay: false },
  { name: "Lempung", H: 3.0, g: 17.0, gs: 17.5, E: 8.0, nu: 0.50, clay: true },
]

function defaults() {
  return {
    shape: "persegi", B: 3.0, L: 3.0, Df: 1.0, mode: "q", q: 150.0, Q: 1350.0, gu: 18.0, gsu: 19.0, dwOn: true, dw: 2.0, nl: 2,
    layers: LAYER_DEF.map((d) => ({ ...d, e0: 0.9, cc: 0.25, cs: 0.05, ocr: 1.0, cv: 2.0, dbl: false, ca: 0.0 })),
    method: "boussinesq", rig: "fleksibel_tengah", dz: 0.5, life: 20.0, allow: 50.0, diff: 0.0, span: 6.0, ang: 500.0,
    cmp: { si: 0, sc: 0, tot: 0, tol: 10 },
  }
}

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const svgNS = "http://www.w3.org/2000/svg"
const sv = (tag, attrs, txt) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e }
const EMO = /^(✅|❌|⚠️)\s*(.*)$/
function withEmoji(node, txt) {                       // glyph emoji menjorok melewati lebarnya; beri jarak lewat span
  const m = String(txt).match(EMO)
  if (!m) { node.textContent = txt; return node }
  const e = document.createElement("span"); e.className = "emo"; e.textContent = m[1]
  node.append(e, document.createTextNode(m[2]))
  return node
}
const parseNum = (s) => { const v = parseFloat(String(s).trim().replace(",", ".")); return isFinite(v) ? v : NaN }

export function mountPenurunan(root, ctx) {
  const t = ctx.t
  const T = (s, ...a) => { let i = 0; return t(s).replace(/\{\}/g, () => (a[i] === undefined ? "{}" : a[i++])) }
  let S = defaults()
  try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && saved.layers && saved.layers.length === 5) S = { ...S, ...saved, cmp: { ...S.cmp, ...(saved.cmp || {}) } } } catch (e) { /* tanpa penyimpanan: pakai bawaan */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* abaikan */ } }

  root.textContent = ""
  const intro = el("p", "intro")
  intro.innerHTML = t("Pembanding **independen** untuk **penurunan pondasi dangkal**: penurunan segera (elastis, Steinbrenner untuk tanah berlapis), konsolidasi primer lempung (Terzaghi dengan sublapis, muka air tanah, dan tegangan tambahan Boussinesq atau 2:1), kecepatan konsolidasi, dan kompresi sekunder opsional. Nilai bawaan hanya contoh.").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  const tabs = el("div", "tabs", "")
  const bCalc = el("button", "tab on", t("📉 Hitung")), bInfo = el("button", "tab", t("📘 Rumus & batasan"))
  bCalc.type = bInfo.type = "button"
  tabs.append(bCalc, bInfo)
  const paneCalc = el("div", "pane"), paneInfo = el("div", "pane info"); paneInfo.hidden = true
  bCalc.onclick = () => { bCalc.classList.add("on"); bInfo.classList.remove("on"); paneCalc.hidden = false; paneInfo.hidden = true }
  bInfo.onclick = () => { bInfo.classList.add("on"); bCalc.classList.remove("on"); paneInfo.hidden = false; paneCalc.hidden = true }
  root.append(intro, tabs, paneCalc, paneInfo)
  paneInfo.append(mdToDom(t(INFO_ID)))

  const formBox = el("div", "form"), resBox = el("div", "res"), cmpBox = el("div", "cmpbox"), expBox = el("div", "exp")
  const bar = el("a", "stickybar"); bar.href = "#"; bar.onclick = (e) => { e.preventDefault(); resBox.scrollIntoView({ behavior: "smooth", block: "start" }) }
  paneCalc.append(bar, formBox, resBox, cmpBox, expBox)

  // ------------------------------------------------------------ bentuk-bentuk masukan
  function numField(parent, label, key, o, getSet) {
    const w = el("label", "fld" + (o.disabled ? " dis" : ""))
    w.append(el("span", "lb", label))
    const inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.autocomplete = "off"; inp.disabled = !!o.disabled
    const [get, set] = getSet
    inp.value = String(get())
    const rng = el("span", "rg", `${fmtG(o.lo)} – ${fmtG(o.hi)}`)
    inp.addEventListener("input", () => { const v = parseNum(inp.value); const okv = !isNaN(v) && v >= o.lo && v <= o.hi; inp.classList.toggle("bad", !okv); if (okv) { set(v); after(o.struct) } })
    inp.addEventListener("change", () => {
      let v = parseNum(inp.value)
      if (isNaN(v)) v = get()
      v = Math.min(o.hi, Math.max(o.lo, v)); inp.value = String(v); inp.classList.remove("bad")
      const was = get(); set(v)
      after(o.struct && (o.struct === true || o.struct(was, v)))
    })
    w.append(inp)
    if (o.help) { w.title = t(o.help); w.append(el("span", "hp", t(o.help))) } else w.append(rng)
    parent.append(w)
    return inp
  }
  const after = (structural) => { save(); if (structural) renderForm(); renderResults() }
  const row = () => el("div", "grid")
  function selField(parent, label, key, opts, cur, onSet, o = {}) {
    const w = el("label", "fld"); w.append(el("span", "lb", label))
    const s = el("select")
    Object.entries(opts).forEach(([k, v]) => { const op = el("option", null, t(v)); op.value = k; if (k === cur) op.selected = true; s.append(op) })
    s.onchange = () => { onSet(s.value); after(true) }
    w.append(s); parent.append(w)
  }
  function radioField(parent, label, opts, cur, onSet) {
    const w = el("div", "fld"); w.append(el("span", "lb", label))
    const g = el("div", "seg")
    Object.entries(opts).forEach(([k, v]) => {
      const b = el("button", "segb" + (k === cur ? " on" : ""), t(v)); b.type = "button"
      b.onclick = () => { onSet(k); after(true) }
      g.append(b)
    })
    w.append(g); parent.append(w)
  }
  function checkField(parent, label, cur, onSet, help) {
    const w = el("label", "chk"); const c = el("input"); c.type = "checkbox"; c.checked = !!cur
    c.onchange = () => { onSet(c.checked); after(true) }
    w.append(c, el("span", null, label)); if (help) w.title = t(help)
    parent.append(w)
  }
  const area = () => (S.shape === "lajur" ? S.B : S.shape === "persegi" ? S.B * S.L : Math.PI * S.B * S.B / 4)
  const qNow = () => (S.mode === "q" ? S.q : S.Q / area())
  const prop = (o, k) => [() => o[k], (v) => { o[k] = v }]

  function renderForm() {
    formBox.textContent = ""
    const h = (txt) => formBox.append(el("h4", null, t(txt)))
    h(K("Pondasi dan beban"))
    let g = row()
    selField(g, t("Bentuk pondasi"), "shape", SHAPES, S.shape, (v) => { S.shape = v })
    numField(g, t("Lebar B / diameter D (m)"), "B", { lo: 0.3, hi: 100, help: K("Lingkaran: isi diameter. Lajur: lebar pondasi menerus.") }, prop(S, "B"))
    numField(g, t("Panjang L (m)"), "L", { lo: 0.3, hi: 500, disabled: S.shape !== "persegi" }, prop(S, "L"))
    numField(g, t("Kedalaman dasar Df (m)"), "Df", { lo: 0, hi: 20 }, prop(S, "Df"))
    formBox.append(g)
    g = row()
    radioField(g, t("Masukan beban"), { q: K("Tekanan kontak q (kPa)"), Q: K("Beban total Q (kN)") }, S.mode, (v) => { S.mode = v })
    if (S.mode === "q") numField(g, t("Tekanan kontak bruto q (kPa)"), "q", { lo: 1, hi: 2000, help: K("Tekanan di dasar pondasi (beban struktur + berat pondasi + tanah di atasnya) dibagi luas.") }, prop(S, "q"))
    else {
      numField(g, t("Beban total Q (kN)") + (S.shape === "lajur" ? t(" per meter") : ""), "Q", { lo: 1, hi: 1e7, help: K("Lajur: kN per meter panjang. Luas dasar dipakai untuk mengubah ke tekanan.") }, prop(S, "Q"))
      const m = el("div", "fld"); m.append(el("span", "lb", t("q = Q / A (kPa)")), el("b", "qv", fixed(qNow(), 1))); m.id = "qv"; g.append(m)
    }
    formBox.append(g)
    h(K("Tanah di atas dasar pondasi dan muka air"))
    g = row()
    numField(g, t("γ tanah di atas dasar (kN/m³)"), "gu", { lo: 10, hi: 25 }, prop(S, "gu"))
    numField(g, t("γ jenuh di atas dasar (kN/m³)"), "gsu", { lo: 10, hi: 25 }, prop(S, "gsu"))
    checkField(g, t("Ada muka air tanah"), S.dwOn, (v) => { S.dwOn = v })
    numField(g, t("Muka air dari permukaan tanah (m)"), "dw", { lo: 0, hi: 50, disabled: !S.dwOn }, prop(S, "dw"))
    formBox.append(g)
    h(K("Lapisan tanah di bawah dasar pondasi"))
    g = row()
    selField(g, t("Jumlah lapis"), "nl", { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" }, String(S.nl), (v) => { S.nl = parseInt(v, 10) })
    formBox.append(g)
    S.open = S.open || [true, true, false, false, false]
    for (let i = 0; i < S.nl; i++) {
      const ly = S.layers[i]
      const d = el("details", "layer"); d.open = !!S.open[i]
      d.addEventListener("toggle", () => { S.open[i] = d.open })
      d.append(el("summary", null, T("Lapis {}: ", i + 1) + (ly.name || "")))
      let r = row()
      const nm = el("label", "fld"); nm.append(el("span", "lb", t("Nama lapis")))
      const ni = el("input"); ni.type = "text"; ni.value = ly.name; ni.oninput = () => { ly.name = ni.value; d.firstChild.textContent = T("Lapis {}: ", i + 1) + ly.name; save(); renderResults() }
      nm.append(ni); r.append(nm)
      numField(r, t("Tebal H (m)"), "H", { lo: 0.2, hi: 100 }, prop(ly, "H"))
      numField(r, t("γ (kN/m³)"), "g", { lo: 10, hi: 25 }, prop(ly, "g"))
      numField(r, t("γ jenuh (kN/m³)"), "gs", { lo: 10, hi: 25 }, prop(ly, "gs"))
      d.append(r)
      r = row()
      numField(r, t("Modulus elastis E (MPa)"), "E", { lo: 0, hi: 2000, help: K("Untuk penurunan segera. Lempung: E undrained (Eu) dengan ν = 0,5. 0 = lapis tidak ikut dihitung. 1 MPa = 1000 kPa.") }, prop(ly, "E"))
      numField(r, t("Angka Poisson ν"), "nu", { lo: 0, hi: 0.5 }, prop(ly, "nu"))
      checkField(r, t("Lempung yang berkonsolidasi"), ly.clay, (v) => { ly.clay = v }, K("Hitung konsolidasi primer (Terzaghi) untuk lapis ini."))
      d.append(r)
      if (ly.clay) {
        r = row()
        numField(r, "e0", "e0", { lo: 0.2, hi: 5 }, prop(ly, "e0"))
        numField(r, "Cc", "cc", { lo: 0.01, hi: 3, help: K("Indeks kompresi (garis normal-konsolidasi).") }, prop(ly, "cc"))
        numField(r, "Cs (Cr)", "cs", { lo: 0.001, hi: 1, help: K("Indeks pengembangan/rekompresi.") }, prop(ly, "cs"))
        numField(r, "OCR", "ocr", { lo: 1, hi: 10, help: K("σ'p = OCR × σ'0 di tengah tiap sublapis. 1 = normal-konsolidasi.") }, prop(ly, "ocr"))
        numField(r, t("cv (m²/tahun)"), "cv", { lo: 0.01, hi: 1000, help: K("Koefisien konsolidasi.") }, prop(ly, "cv"))
        d.append(r)
        r = row()
        checkField(r, t("Drainase dua arah (atas dan bawah)"), ly.dbl, (v) => { ly.dbl = v }, K("Jalur drainase Hdr = H/2 bila dicentang, H bila tidak."))
        numField(r, t("Cαε (kompresi sekunder)"), "ca", { lo: 0, hi: 0.1, help: K("Regangan per siklus log waktu setelah konsolidasi primer. 0 = diabaikan.") }, prop(ly, "ca"))
        d.append(r)
      }
      formBox.append(d)
    }
    h(K("Metode dan kriteria"))
    g = row()
    radioField(g, t("Tegangan tambahan"), { boussinesq: K("Boussinesq (Newmark)"), "2:1": K("Metode 2:1") }, S.method, (v) => { S.method = v })
    selField(g, t("Kekakuan pondasi (penurunan segera)"), "rig", RIG, S.rig, (v) => { S.rig = v })
    numField(g, t("Tebal maksimum sublapis lempung (m)"), "dz", { lo: 0.1, hi: 2, help: K("Makin kecil makin teliti. Satu sublapis tebal dapat memperkecil konsolidasi sampai ±30 %.") }, prop(S, "dz"))
    numField(g, t("Umur rencana (tahun)"), "life", { lo: 0.1, hi: 200 }, prop(S, "life"))
    formBox.append(g)
    g = row()
    numField(g, t("Batas penurunan total (mm)"), "allow", { lo: 1, hi: 1000, help: K("Contoh umum. Ikuti kriteria proyek (kode, pemilik, jenis struktur/tangki).") }, prop(S, "allow"))
    numField(g, t("Penurunan diferensial perkiraan (mm), 0 = tidak dicek"), "diff", { lo: 0, hi: 1000, struct: (a, b) => (a > 0) !== (b > 0) }, prop(S, "diff"))
    numField(g, t("Jarak antar titik (m)"), "span", { lo: 0.1, hi: 500, disabled: S.diff <= 0 }, prop(S, "span"))
    numField(g, t("Batas distorsi sudut 1/…"), "ang", { lo: 50, hi: 2000, disabled: S.diff <= 0, help: K("Contoh umum 1/500 untuk rangka tanpa retak.") }, prop(S, "ang"))
    formBox.append(g)
    const rs = el("button", "ghost", t("↺ Kembalikan nilai bawaan")); rs.type = "button"
    rs.onclick = () => { if (confirm(t("Kembalikan semua masukan ke nilai bawaan?"))) { S = defaults(); save(); cmpBuilt = false; cmpBox.textContent = ""; renderForm(); renderResults() } }
    formBox.append(rs)
  }

  // ------------------------------------------------------------ hasil
  let res = null, lastIn = null
  const fmtT = (x) => (x == null ? "-" : x < 1 ? fixed(x * 12, 1) + " bln" : fixed(x, 1) + " th")
  const tdet = (s) => {
    for (const tp of DETAIL) {
      const rx = new RegExp("^" + tp.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\}/g, "(.+?)") + "$")
      const m = s.match(rx)
      if (m) return T(tp, ...m.slice(1))
    }
    return s
  }
  function inputs() {
    const layers = S.layers.slice(0, S.nl).map((ly) => {
      const o = { name: ly.name, H: ly.H, gamma: ly.g, gsat: ly.gs, E: ly.E * 1000.0, nu: ly.nu, clay: ly.clay }
      if (ly.clay) Object.assign(o, { e0: ly.e0, Cc: ly.cc, Cs: ly.cs, OCR: ly.ocr, cv: ly.cv, double: ly.dbl, Ca: ly.ca })
      return o
    })
    return {
      foot: { shape: S.shape, B: S.B, L: S.L }, soil: { Df: S.Df, gamma_up: S.gu, gsat_up: S.gsu, Dw: S.dwOn ? S.dw : null, layers }, q: qNow(),
      opt: { method: S.method, rigidity: S.rig, dz: S.dz, lifeYears: S.life, allowMm: S.allow, diffMm: S.diff, spanM: S.span, angLimit: S.ang },
    }
  }
  const mcard = (lab, val) => { const c = el("div", "metric"); c.append(el("div", "ml", lab), el("div", "mv", val)); return c }
  function table(cols, rows) {
    const tb = el("table"), hr = el("tr")
    cols.forEach((c) => hr.append(el("th", null, c)))
    tb.append(hr)
    rows.forEach((r) => { const tr = el("tr"); r.forEach((c) => tr.append(withEmoji(el("td"), c == null ? "" : String(c)))); tb.append(tr) })
    const w = el("div", "tw"); w.append(tb); return w
  }

  function renderResults() {
    const qv = document.getElementById("qv"); if (qv) qv.lastChild.textContent = fixed(qNow(), 1)
    resBox.textContent = ""
    lastIn = inputs()
    try { res = analyze(lastIn.foot, lastIn.soil, lastIn.q, lastIn.opt) } catch (e) {
      res = null; bar.className = "stickybar bad"; bar.textContent = "❌ " + (e instanceof SettleError ? t(e.message) : e.message)
      resBox.append(el("div", "err", e instanceof SettleError ? t(e.message) : T("Perhitungan tidak dapat diselesaikan: {}", e.message)))
      renderCmp(); renderExport(); return
    }
    const ok = res.checks.every((c) => c[1])
    bar.className = "stickybar " + (ok ? "ok" : "bad")
    bar.textContent = `${ok ? "✅" : "❌"} ${T("Total pada {} tahun (mm)", fmtG(S.life))}: ${fixed(res.s_life * 1000, 1)} · ${t("Batas penurunan total (mm)")}: ${fmtG(S.allow)} ↓`
    const m = el("div", "metrics")
    m.append(mcard(t("Tekanan bersih (kPa)"), fixed(res.q_net, 1)), mcard(t("Penurunan segera (mm)"), fixed(res.si * 1000, 1)), mcard(t("Konsolidasi primer (mm)"), fixed(res.sc * 1000, 1)),
      mcard(T("Total pada {} tahun (mm)", fmtG(S.life)), fixed(res.s_life * 1000, 1)), mcard(t("Waktu 90 % konsolidasi"), fmtT(res.t90)))
    resBox.append(m)
    if (res.ss_life > 0) resBox.append(el("p", "cap", T("Termasuk kompresi sekunder {} mm pada umur rencana. Penurunan akhir (primer selesai, tanpa sekunder) = {} mm.", fixed(res.ss_life * 1000, 1), fixed(res.s_final * 1000, 1))))
    const hc = el("h4"); hc.append(t("Pengecekan") + " "); withEmoji(hc, ok ? t("✅ semua OK") : t("❌ ada yang tidak memenuhi")); resBox.append(hc)
    resBox.append(table([t("Pengecekan"), t("Status"), t("Keterangan")], res.checks.map(([n, o, d]) => [t(n), o ? "✅ OK" : "❌ NOT OK", tdet(d)])))
    const two = el("div", "two")
    const left = el("div"), right = el("div")
    left.append(profileSVG(lastIn.foot, lastIn.soil, res, t, T))
    right.append(el("b", null, t("Penurunan terhadap waktu")), timeChart(res, t), table([t("Waktu"), t("Penurunan (mm)")], TIMES.map(([tt, n]) => [t(n), fixed(res.at(tt) * 1000, 1)])))
    two.append(left, right)
    resBox.append(two)
    const det = el("details", "more"); det.append(el("summary", null, t("Rincian per lapis dan sublapis")))
    det.append(table([t("Lapis"), t("Tebal (m)"), t("E (MPa)"), "ν", t("Penurunan segera (mm)")], lastIn.soil.layers.map((ly, i) => [ly.name || T("Lapis {}", i + 1), ly.H, ly.E / 1000, ly.nu, fixed(res.si_layers[i] * 1000, 1)])))
    if (res.cons.length) {
      det.append(table([t("Lapis lempung"), t("H (m)"), t("Hdr (m)"), t("cv (m²/th)"), t("Sc (mm)"), "t50", "t90"], res.cons.map((c) => [c.lapis, c.H, c.Hdr, c.cv, fixed(c.sc * 1000, 1), fmtT(c.t50), fmtT(c.t90)])))
      det.append(table([t("Lapis"), t("z tengah dari dasar (m)"), t("Δσ (kPa)"), t("σ'0 (kPa)"), t("σ'p (kPa)"), t("Sc sublapis (mm)")], res.subs.map((s) => [s.lapis, fixed(s.z_tengah, 2), fixed(s.ds, 1), fixed(s.s0, 1), fixed(s.sp, 1), fixed(s.sc * 1000, 2)])))
    } else det.append(el("p", "cap", t("Tidak ada lapis lempung yang dicentang; hanya penurunan segera yang dihitung.")))
    det.append(el("p", "cap", T("Tegangan overburden total di dasar pondasi = {} kPa (dikurangkan dari q bruto {} kPa).", fixed(res.overburden, 1), fixed(res.q_gross, 1))))
    resBox.append(det)
    renderCmp(); renderExport()
  }
  const TIMES = [[0.25, K("3 bulan")], [0.5, K("6 bulan")], [1, K("1 tahun")], [2, K("2 tahun")], [5, K("5 tahun")], [10, K("10 tahun")], [20, K("20 tahun")], [50, K("50 tahun")]]

  // ------------------------------------------------------------ perbandingan dengan dokumen
  let cmpBuilt = false
  function renderCmp() {
    if (!cmpBuilt) {
      cmpBuilt = true
      cmpBox.append(el("h4", null, t("Bandingkan dengan nilai di dokumen yang direview")))
      const g = row()
      const mk = (lab, key) => numField(g, lab, key, { lo: 0, hi: 1e9, help: K("0 = tidak dibandingkan") }, [() => S.cmp[key], (v) => { S.cmp[key] = v }])
      mk(t("Penurunan segera di dokumen (mm)"), "si"); mk(t("Konsolidasi primer di dokumen (mm)"), "sc"); mk(T("Total {} th di dokumen (mm)", fmtG(S.life)), "tot")
      numField(g, t("Toleransi (%)"), "tol", { lo: 0.5, hi: 50 }, [() => S.cmp.tol, (v) => { S.cmp.tol = v }])
      cmpBox.append(g, el("div", "cmpres"))
      cmpBox.querySelectorAll("input").forEach((i) => i.addEventListener("input", () => { setTimeout(() => { save(); renderCmp() }, 0) }))
    }
    const out = cmpBox.querySelector(".cmpres"); out.textContent = ""
    if (!res) return
    const items = [[t("Penurunan segera"), res.si * 1000, S.cmp.si], [t("Konsolidasi primer"), res.sc * 1000, S.cmp.sc], [T("Total {} th", fmtG(S.life)), res.s_life * 1000, S.cmp.tot]]
    const rows = []
    let bad = false
    cmpRows = []
    items.forEach(([lab, c, v]) => {
      if (!(v > 0) || !c) return
      const d = (v - c) / c, ok = Math.abs(d) <= S.cmp.tol / 100 + 1e-9
      bad = bad || !ok
      cmpRows.push([lab + " (mm)", c, v, d, ok])
      rows.push([lab + " (mm)", fixed(c, 4), fixed(v, 4), fixed(d * 100, 1), ok ? t("✅ dalam toleransi") : t("⚠️ di luar toleransi")])
    })
    if (rows.length) {
      out.append(table([t("Besaran"), t("Hitung app"), t("Dokumen"), t("Selisih (%)"), t("Status")], rows))
      if (bad) out.append(el("div", "warn", t("Ada selisih di luar toleransi. Periksa asumsi (beban, berat pondasi, parameter tanah, faktor beban/kombinasi, metode daya dukung) sebelum menjadikannya komentar.")))
    } else out.append(el("p", "cap", t("Isi nilai dari dokumen untuk melihat selisihnya terhadap hitungan app.")))
  }
  let cmpRows = []

  // ------------------------------------------------------------ unduh
  function mdText() {
    const o = (s) => t(s)
    const I = lastIn
    const inp = [[t("Bentuk / B / L (m)"), `${t(SHAPES[I.foot.shape])} / ${I.foot.B} / ${I.foot.shape === "persegi" ? I.foot.L : "-"}`], [t("Df (m) / q bruto (kPa)"), `${I.soil.Df} / ${fixed(I.q, 1)}`],
      [t("Tanah di atas dasar γ / γ jenuh / MAT (m)"), `${I.soil.gamma_up} / ${I.soil.gsat_up} / ${I.soil.Dw !== null ? I.soil.Dw : t("tanpa air")}`],
      [t("Metode tegangan / kekakuan / dz"), `${S.method} / ${S.rig} / ${S.dz} m`], [t("Umur rencana (tahun) / batas total (mm)"), `${S.life} / ${S.allow}`]]
    I.soil.layers.forEach((ly, i) => inp.push([`${T("Lapis {} {}", i + 1, ly.name || "")}`.trim(),
      `H ${ly.H} m · γ ${ly.gamma}/${ly.gsat} · E ${fmtG(ly.E / 1000)} MPa · ν ${ly.nu}` + (ly.clay ? ` · ${t("lempung")} e0 ${ly.e0} Cc ${ly.Cc} Cs ${ly.Cs} OCR ${ly.OCR} cv ${ly.cv} ${ly.double ? t("2 arah") : t("1 arah")} Cαε ${ly.Ca}` : "")]))
    const r2 = (x) => (x == null ? "" : Math.round(x * 100) / 100)
    const resRows = [[t("Tekanan bersih (kPa)"), r2(res.q_net)], [t("Penurunan segera (mm)"), r2(res.si * 1000)], [t("Konsolidasi primer (mm)"), r2(res.sc * 1000)],
      [t("Kompresi sekunder pada umur rencana (mm)"), r2(res.ss_life * 1000)], [T("Total pada {} tahun (mm)", fmtG(S.life)), r2(res.s_life * 1000)],
      [t("Waktu 50 % konsolidasi (tahun)"), res.t50 == null ? "-" : Math.round(res.t50 * 1000) / 1000], [t("Waktu 90 % konsolidasi (tahun)"), res.t90 == null ? "-" : Math.round(res.t90 * 1000) / 1000]]
    const L = [`# ${t("Cek independen penurunan pondasi dangkal")}`, "", t("Penurunan pondasi dangkal: penurunan segera (Steinbrenner), konsolidasi primer lempung (Terzaghi, sublapis, muka air tanah), kecepatan konsolidasi, dan kompresi sekunder opsional. Perhitungan independen dengan app Review by YMD; bandingkan dengan dokumen yang direview dan konfirmasikan asumsi (modulus, parameter konsolidasi, metode tegangan)."), ""]
    L.push(`## ${t("Masukan")}`, "", ...inp.map(([a, b]) => `- ${a}: ${b}`), "", `## ${t("Hasil")}`, "", ...resRows.map(([a, b]) => `- ${a}: ${b}`), "", `## ${t("Pengecekan")}`, "",
      ...res.checks.map(([n, ok, d]) => `- ${ok ? "OK" : "NOT OK"} — ${t(n)}: ${tdet(d)}`), "")
    if (cmpRows.length) {
      L.push(`## ${t("Perbandingan dengan nilai di dokumen yang direview")}`, "")
      cmpRows.forEach(([k, c, v, d, ok]) => L.push(`- ${k}: ${t("hitung app")} = ${Number(c.toPrecision(4))}; ${t("dokumen")} = ${Number(v.toPrecision(4))}; ${t("selisih")} ${d >= 0 ? "+" : ""}${fixed(d * 100, 1)} % — ${ok ? "OK" : t("di luar toleransi")}`))
      L.push("")
    }
    L.push(`_${t("Batas: perhitungan elastis/konsolidasi satu dimensi sederhana sebagai pembanding, lapisan mendatar dan beban merata. Lihat tab Rumus & batasan.")}_`)
    return { md: L.join("\n"), inp, resRows }
  }
  function csvText(m) {
    const q = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const blocks = [[t("Masukan"), [[t("Parameter"), t("Nilai")], ...m.inp]], [t("Hasil"), [[t("Besaran"), t("Nilai")], ...m.resRows]],
      [t("Sublapis"), [[t("Lapis"), t("z tengah (m)"), t("Δσ (kPa)"), t("σ'0 (kPa)"), t("σ'p (kPa)"), t("Sc (mm)")], ...res.subs.map((s) => [s.lapis, fixed(s.z_tengah, 2), fixed(s.ds, 2), fixed(s.s0, 2), fixed(s.sp, 2), fixed(s.sc * 1000, 3)])]],
      [t("Waktu"), [[t("Waktu (tahun)"), t("Penurunan (mm)")], ...res.curve.map(([a, b]) => [fixed(a, 4), fixed(b * 1000, 2)])]],
      [t("Pengecekan"), [[t("Pengecekan"), t("Status"), t("Keterangan")], ...res.checks.map(([n, o, d]) => [t(n), o ? "OK" : "NOT OK", tdet(d)])]]]
    return "﻿" + blocks.map(([h, rows]) => [q(h), ...rows.map((r) => r.map(q).join(","))].join("\n")).join("\n\n") + "\n"
  }
  function download(name, text, mime) {
    const a = el("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
  }
  function renderExport() {
    expBox.textContent = ""
    if (!res) return
    expBox.append(el("h4", null, t("Unduh")))
    const g = el("div", "btns")
    const b1 = el("button", "pri", t("⬇️ Ringkasan (.md)")), b2 = el("button", "pri", t("⬇️ Tabel (.csv, bisa dibuka di Excel)")), b3 = el("button", "pri", t("🖨️ Cetak / simpan PDF"))
    b1.type = b2.type = b3.type = "button"
    b1.onclick = () => download("Cek_Penurunan_Pondasi.md", mdText().md, "text/markdown")
    b2.onclick = () => download("Cek_Penurunan_Pondasi.csv", csvText(mdText()), "text/csv")
    b3.onclick = () => window.print()
    g.append(b1, b2, b3); expBox.append(g)
  }

  renderForm(); renderResults()
}

// ---------------------------------------------------------------- gambar
function nice(maxv, n) {
  const raw = maxv / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

function timeChart(res, t) {
  const W = 420, H = 260, ml = 52, mr = 12, mt = 12, mb = 38
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" })
  const pts = res.curve.map(([tt, s]) => [tt, s * 1000])
  const ymin = Math.min(...pts.map((p) => p[1])), ymax = Math.max(...pts.map((p) => p[1]))
  const y0 = Math.max(0, ymin - (ymax - ymin) * 0.05), y1 = ymax + (ymax - ymin) * 0.05 + 1e-9
  const X = (tt) => ml + (Math.log10(tt) + 2) / 4 * (W - ml - mr)
  const Y = (s) => mt + (s - y0) / (y1 - y0) * (H - mt - mb)
  svg.append(sv("rect", { x: ml, y: mt, width: W - ml - mr, height: H - mt - mb, class: "ch-bg" }))
  for (let d = -2; d <= 2; d++) {
    const x = X(10 ** d)
    svg.append(sv("line", { x1: x, y1: mt, x2: x, y2: H - mb, class: "ch-grid" }), sv("text", { x, y: H - mb + 15, class: "ch-tx", "text-anchor": "middle" }, fmtG(10 ** d)))
  }
  const step = nice(y1 - y0, 5)
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
    const y = Y(v)
    svg.append(sv("line", { x1: ml, y1: y, x2: W - mr, y2: y, class: "ch-grid" }), sv("text", { x: ml - 6, y: y + 4, class: "ch-tx", "text-anchor": "end" }, fmtG(Math.round(v * 100) / 100)))
  }
  svg.append(sv("path", { d: pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" "), class: "ch-line" }))
  svg.append(sv("text", { x: (ml + W - mr) / 2, y: H - 4, class: "ch-lb", "text-anchor": "middle" }, t("Waktu (tahun)")))
  svg.append(sv("text", { x: 12, y: (mt + H - mb) / 2, class: "ch-lb", "text-anchor": "middle", transform: `rotate(-90 12 ${(mt + H - mb) / 2})` }, t("Penurunan (mm)")))
  return svg
}

function profileSVG(foot, soil, res, t, T) {
  const W = 1000, H = 620
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "profile", role: "img" })
  svg.append(sv("rect", { x: 0, y: 0, width: W, height: H, fill: "#FAF9F7" }))
  const B = foot.B, Df = soil.Df, ztot = soil.layers.reduce((a, l) => a + l.H, 0)
  const xl = -1.6 * B, xr = 1.6 * B
  const topY = -(0.9 + 0.04 * (Df + ztot)), botY = Df + ztot
  const padx = 40, pady = 36
  const k = Math.min((W * 0.55 - padx) / (xr - xl), (H - 2 * pady) / (botY - topY))
  const ox = padx - xl * k, oy = pady - topY * k
  const P = (x, y) => [ox + x * k, oy + y * k]
  const rect = (a, b, fill, stroke) => { const [x1, y1] = P(a[0], a[1]), [x2, y2] = P(b[0], b[1]); svg.append(sv("rect", { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), fill, stroke: stroke || "none" })) }
  const text = (p, s, fill, anchor, base) => svg.append(sv("text", { x: p[0], y: p[1], fill, "font-size": 21, "text-anchor": anchor, "dominant-baseline": base, "font-family": "Helvetica, Arial, sans-serif" }, s))
  const cols = ["#E0D6C6", "#CDD6BE", "#DEC8B4", "#C4CCDA", "#D6C4D6", "#BED2CE"]
  if (Df > 0) rect([xl, 0], [xr, Df], "#EBE4D6")
  let z = Df
  soil.layers.forEach((ly, i) => {
    rect([xl, z], [xr, z + ly.H], ly.clay ? "#C8BCAA" : cols[i % cols.length], "#786E64")
    text(P(xl + 0.08, z + ly.H / 2), `${ly.name || T("Lapis {}", i + 1)} · H = ${fmtG(ly.H)} m` + (ly.clay ? t(" (lempung)") : ""), "#322D28", "start", "middle")
    z += ly.H
  })
  if (soil.Dw != null && soil.Dw >= 0 && soil.Dw <= botY) {
    const a = P(xl, soil.Dw), b = P(xr, soil.Dw)
    svg.append(sv("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "#1E64A0", "stroke-width": 3 }))
    text([b[0] - 6, a[1] - 3], t("MAT"), "#1E64A0", "end", "text-after-edge")
  }
  const g0 = P(xl, 0), g1 = P(xr, 0)
  svg.append(sv("line", { x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1], stroke: "#463E37", "stroke-width": 3 }))
  const fh = Math.max(0.25, 0.06 * ztot)
  rect([-B / 2, Df - fh], [B / 2, Df], "#8C96A5", "#463E37")
  for (let i = 0; i < 5; i++) {
    const xx = -B / 2 + B * i / 4, a = P(xx, Df - fh - 0.5), b = P(xx, Df - fh)
    svg.append(sv("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "#C83C28", "stroke-width": 2 }))
  }
  text(P(0, Df - fh - 0.6), T("q = {} kPa (bersih {})", fmtG(res.q_gross), Math.round(res.q_net)), "#C83C28", "middle", "text-after-edge")
  const gx0 = W * 0.62, gx1 = W - padx, qmax = Math.max(res.q_net, 1e-9)
  const yTop = P(0, Df)[1], yBot = P(0, Df + ztot)[1]
  const pts = res.stress.map(([zz, ds]) => [gx0 + (gx1 - gx0) * ds / qmax, P(0, Df + zz)[1]])
  svg.append(sv("polygon", { points: [[gx0, pts[0][1]], ...pts, [gx0, pts[pts.length - 1][1]]].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), fill: "#CDDEF0" }))
  svg.append(sv("line", { x1: gx0, y1: yTop, x2: gx0, y2: yBot, stroke: "#3C3732", "stroke-width": 2 }))
  svg.append(sv("polyline", { points: pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), fill: "none", stroke: "#1E64A0", "stroke-width": 3 }))
  text([gx0, yTop - 10], t("Δσ di bawah titik tengah (kPa)"), "#1E64A0", "start", "alphabetic")
  text([gx1, pts[0][1] + 4], String(Math.round(res.q_net)), "#1E64A0", "end", "hanging")
  text([gx0 + (gx1 - gx0) * 0.5, yBot + 8], T("Si = {} mm · Sc = {} mm", Math.round(res.si * 1000), Math.round(res.sc * 1000)), "#3C3732", "middle", "hanging")
  return svg
}

// ---------------------------------------------------------------- teks "Rumus & batasan" (Indonesia; terjemahan lewat t())
const INFO_ID = `**Tekanan bersih dan tegangan tambahan**
- q bersih = q bruto di dasar pondasi − tegangan total overburden pada kedalaman Df (muka air tanah dihitung)
- Boussinesq: persegi panjang di bawah titik tengah = 4 × (sudut Newmark) dengan I(m, n), m = (B/2)/z, n = (L/2)/z; lajur dihitung sebagai L/B = 1000; lingkaran Δσ = q[1 − (1 + (R/z)²)^(-3/2)]
- Metode 2:1: Δσ = q·B·L / ((B + z)(L + z))

**Penurunan segera (elastis)**
- Steinbrenner: S = 4 · q · B' · (1 − ν²)/E · Is, B' = B/2; Is = F1 + (1 − 2ν)/(1 − ν) · F2 (dari m = L'/B' dan n = H/B'). Tanah berlapis: selisih penurunan di batas bawah dan atas tiap lapis dengan E dan ν lapis itu
- Faktor kekakuan: fleksibel titik tengah ×1,00; fleksibel rata-rata ×0,85; kaku ×0,93 (nilai umum). Lingkaran dihitung sebagai persegi berluas sama. Tanpa faktor kedalaman (konservatif)
- Lempung memakai E undrained (Eu) dengan ν = 0,5; pasir memakai E drained

**Konsolidasi primer (Terzaghi 1D)**
- Tiap lapis lempung dibagi sublapis ≤ dz; tegangan efektif awal σ'0 di tengah sublapis, σ'p = OCR × σ'0
- Sc = H/(1 + e0) · [ Cs · log(σ'p/σ'0) + Cc · log((σ'0 + Δσ)/σ'p) ] (hanya Cs bila σ'0 + Δσ ≤ σ'p; hanya Cc bila σ'0 ≥ σ'p)

**Waktu**
- Tv = cv·t / Hdr², Hdr = H (drainase satu arah) atau H/2 (dua arah); U(Tv) dari deret eksak (Tv50 = 0,197; Tv90 = 0,848)
- Kompresi sekunder (opsional): Ss = Cαε · H · log10(t / tp), tp = waktu U = 99 % (Tv = 1,78)

**Batasan**
- Lapis mendatar homogen, beban merata, pondasi tunggal (tanpa pengaruh pondasi tetangga), tegangan lebih pori awal seragam di tiap lapis lempung, tanpa penurunan akibat turunnya muka air tanah, tanpa pengaruh beban bertahap atau galian, tanpa tegangan pada tangki besar yang fleksibel di tanah lunak yang menuntut analisis khusus
- Nilai bawaan (batas penurunan, distorsi sudut) adalah contoh umum, bukan kriteria proyek. Ikuti Design Basis dan kode yang dipakai dokumen.`

function mdToDom(md) {
  const box = document.createElement("div")
  let ul = null
  const inline = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  md.split("\n").forEach((line) => {
    if (line.startsWith("- ")) {
      if (!ul) { ul = document.createElement("ul"); box.append(ul) }
      const li = document.createElement("li"); li.innerHTML = inline(line.slice(2)); ul.append(li)
    } else if (line.trim()) {
      ul = null
      const p = document.createElement("p"); p.innerHTML = inline(line); box.append(p)
    } else ul = null
  })
  return box
}
