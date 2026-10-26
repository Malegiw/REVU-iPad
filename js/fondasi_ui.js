// Halaman "Pondasi Tangki & Peralatan" untuk app iPad offline: pondasi dangkal peralatan, pondasi mesin berputar (indikatif), dan pondasi tangki. Rumus ada di fondasi.js
// (diuji terhadap Python). Teks Indonesia di sini = kunci terjemahan Inggris: t menerjemahkan, T menerjemahkan lalu mengisi {} dengan argumen, K hanya menandai teks
// yang perlu diterjemahkan (data/en_fondasi.json dibuat oleh ipad_build.py dari semua teks yang dibungkus ketiganya).
import { eqReport, mcReport, tkReport } from "./fondasi.js"
import { fixed, fmtG, signed, commas } from "./fmt.js"
import { el, sv, table, metric, mdToDom, bold, download, mdTable, toCsv, withEmoji, makeKit } from "./kit.js"

const K = (s) => s
const KEY = "ymd.fondasi.v1"
const MTYPES = { rec: K("Resiprokal (kompresor torak)"), cen: K("Sentrifugal (pompa, kompresor/turbin sentrifugal)") }
const JENIS = { Tetap: K("Tetap"), Sementara: K("Sementara") }
const METHODS = { laporan: K("Daya dukung izin dari laporan tanah"), hitung: K("Hitung dari c dan φ (Meyerhof/Vesic) dengan FS") }
const TABS = [["eq", K("🏗️ Peralatan")], ["mc", K("⚙️ Mesin berputar")], ["tk", K("🛢️ Tangki")], ["info", K("📘 Rumus & batasan")]]
const DEFAULT_NAMES = [K("Operasi (beban tetap)"), K("Angin, peralatan kosong"), K("Uji hidrostatik")]     // nama kasus bawaan: ditampilkan lewat t(), nama buatan pengguna tampil apa adanya
const MODES = [K("penuh"), K("angkat"), K("guling"), K("sebagian (satu arah)"), K("sebagian (dua arah, luas efektif)")]     // mode distribusi tekanan dari fondasi.js
const NAMES = [K("Beban vertikal total > 0"), K("Tidak terangkat dan resultan di dalam dasar (ex < B/2, ey < L/2)"), K("Resultan di dalam kern (tanpa area terangkat)"), K("Tekanan dasar maksimum ≤ daya dukung izin"),
  K("Stabilitas angin tangki kosong: 0,6 Mw ≤ MDL/1,5 + MDLR"), K("Geser angin ≤ μ × berat tangki kosong"), K("Vertikal"), K("Geser horizontal"), K("Operasi"), K("Hidrotes"),
  K("tanpa momen guling"), K("tanpa gaya geser")]
const ERRORS = [K("Masukan tidak valid (dimensi, berat, G, atau frekuensi operasi ≤ 0, atau ν di luar 0–0,5)."), K("Diameter, tinggi shell, dan lebar ringwall harus lebih dari nol."),
  K("Tinggi total ringwall harus ≥ kedalaman dasar dari muka tanah.")]
// nama dan keterangan pengecekan dengan bagian dinamis ({}): dicocokkan lalu diterjemahkan lewat templat
const TPL = [K("FS daya dukung ≥ {}"), K("FS guling ≥ {}"), K("FS geser ≥ {}"), K("FS daya dukung ringwall ≥ {}"), K("FS daya dukung area tangki ({}) ≥ {}"), K("{}: fn berbeda ≥ {} % dari eksitasi {}×"),
  K("Rasio massa pondasi/mesin ≥ {}"), K("V = {} kN (pondasi terangkat)"), K("ex = {} m (B/2 = {}); ey = {} m (L/2 = {})"), K("6ex/B + 6ey/L = {} (≤ 1)"), K("q maks = {} kPa ≤ {} kPa (izin {} × {})"),
  K("FS = {} (q ult = {} kPa; q efektif = {} kPa)"), K("FS = {}"), K("FS = {} (tahanan {} kN; gaya geser {} kN)"), K("FS = {} (q ringwall = {} kPa; q ult = {} kPa)"), K("FS = {} (q pusat = {} kPa; q ult = {} kPa)"),
  K("rasio = {} (0,6 Mw = {} kNm; tahanan = {} kNm)"), K("FS = {} (gaya angin {} kN; μ = {})"), K("fn = {} Hz; eksitasi {} Hz; beda {} %"), K("rasio = {} (pondasi {} kN; mesin {} kN)")]
const TPL_RX = TPL.map((tp) => [tp, new RegExp("^" + tp.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\}/g, "(.+?)") + "$")]).sort((a, b) => b[0].replace(/\{\}/g, "").length - a[0].replace(/\{\}/g, "").length)

function defaults() {
  return {
    tab: "eq",
    eq: { B: 3.0, L: 3.0, t: 0.6, Df: 1.5, Bp: 0.8, Lp: 0.8, hp: 0.5, gab: 18.0, bf: true, c: 0.0, phi: 30.0, gam: 18.0, delta: 20.0, ca: 0.0, pp: 0.0, es: 20000.0, nu: 0.3, method: "laporan", qa: 150.0, fsb: 3.0, qf: 1.33,
      cases: [
        { name: DEFAULT_NAMES[0], jenis: "Tetap", P: 600, Hx: 0, Hy: 0, Mx: 0, My: 0, fsot: 1.5, fssl: 1.5 },
        { name: DEFAULT_NAMES[1], jenis: "Sementara", P: 350, Hx: 60, Hy: 0, Mx: 0, My: 180, fsot: 1.5, fssl: 1.5 },
        { name: DEFAULT_NAMES[2], jenis: "Sementara", P: 900, Hx: 0, Hy: 0, Mx: 0, My: 0, fsot: 1.5, fssl: 1.5 },
      ], cmp: { v: [0, 0, 0, 0], tol: 5 } },
    mc: { typ: "cen", B: 5.0, L: 4.0, tb: 2.2, wm: 500, wx: 0, vs: 200, gm: 18.0, nu: 0.35, red: 1.0, rpm: 1480, sep: 20, mrmin: { rec: 3.0, cen: 2.0 }, harm: { rec: [1, 2], cen: [1] }, cmp: { v: [0, 0, 0], tol: 10 } },
    tk: { D: 20.0, Hs: 14.0, sg: 0.85, hop: 12.0, htest: 13.0, ws: 1500, wr: 400, wb: 600, rl: 1.2, vw: 35, mu: 0.4, rb: 0.6, rh: 1.2, rdf: 1.0, hpad: 1.0, gpad: 19.0, c: 0.0, phi: 30.0, gam: 18.0, es: 20000, nu: 0.3, fsr: 3.0, fsm: 3.0,
      cmp: { v: [0, 0, 0, 0], tol: 5 } },
  }
}

const merge = (d, s) => ({ ...d, ...(s || {}), cmp: { ...d.cmp, ...((s || {}).cmp || {}) } })
const f2 = (x, d) => (x === Infinity ? "∞" : fixed(x, d))

export function mountFondasi(root, ctx) {
  const t = ctx.t
  const T = (s, ...a) => { let i = 0; return t(s).replace(/\{\}/g, () => (a[i] === undefined ? "{}" : a[i++])) }
  // teks pengecekan dari fondasi.js: cocokkan templat, terjemahkan bagian tetap dan bagian dinamis yang berupa nama
  const tx = (s) => {
    for (const [tp, rx] of TPL_RX) { const m = s.match(rx); if (m) return T(tp, ...m.slice(1).map((g) => t(g))) }
    return t(s)
  }
  let S = defaults()
  try {
    const sv0 = JSON.parse(localStorage.getItem(KEY) || "null")
    if (sv0) {
      const d = defaults()
      S = { ...d, tab: sv0.tab || d.tab, eq: merge(d.eq, sv0.eq), mc: merge(d.mc, sv0.mc), tk: merge(d.tk, sv0.tk) }
      if (!Array.isArray(S.eq.cases) || !S.eq.cases.length) S.eq.cases = d.eq.cases
    }
  } catch (e) { /* tanpa penyimpanan: pakai bawaan */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* abaikan */ } }
  const c = { t, T, tx, save }

  root.textContent = ""
  const intro = el("p", "intro")
  intro.innerHTML = bold(t("Pembanding **independen** untuk perhitungan pondasi dari kontraktor: pondasi dangkal peralatan, pondasi mesin berputar (indikatif), dan pondasi tangki. Rumus transparan, nilai bawaan hanya contoh (ganti dengan data tanah dan kriteria Design Basis proyek). Bukan pengganti perhitungan geoteknik atau struktur."))
  const tabs = el("div", "tabs"), panes = {}, btns = {}
  const show = (id) => {
    S.tab = id; save()
    TABS.forEach(([k]) => { btns[k].classList.toggle("on", k === id); panes[k].hidden = k !== id })
  }
  const builders = { eq: eqTab, mc: mcTab, tk: tkTab }
  const build = (id) => { panes[id].textContent = ""; builders[id](panes[id], S[id], c, () => { S[id] = defaults()[id]; save(); build(id) }) }
  TABS.forEach(([k, label]) => {
    btns[k] = withEmoji(el("button", "tab"), t(label)); btns[k].type = "button"; btns[k].onclick = () => show(k)
    panes[k] = el("div", "pane" + (k === "info" ? " info" : "")); panes[k].hidden = true
    tabs.append(btns[k])
  })
  root.append(intro, tabs, ...TABS.map(([k]) => panes[k]))
  panes.info.append(mdToDom(t(INFO_ID)))
  Object.keys(builders).forEach(build)
  show(TABS.some(([k]) => k === S.tab) ? S.tab : "eq")
}

// ---------------------------------------------------------------- bagian yang dipakai bersama tiap tab
function skeleton(pane) {
  const formBox = el("div", "form"), resBox = el("div", "res"), cmpBox = el("div", "cmpbox"), expBox = el("div", "exp")
  const bar = el("a", "stickybar"); bar.href = "#"; bar.onclick = (e) => { e.preventDefault(); resBox.scrollIntoView({ behavior: "smooth", block: "start" }) }
  pane.append(bar, formBox, resBox, cmpBox, expBox)
  return { formBox, resBox, cmpBox, expBox, bar }
}
const setBar = (bar, ok, txt) => { bar.className = "stickybar " + (ok ? "ok" : "bad"); bar.textContent = ""; withEmoji(bar, (ok ? "✅ " : "❌ ") + txt) }

function resetButton(box, c, onReset) {
  const { t } = c
  const rs = el("button", "ghost", t("↺ Kembalikan nilai bawaan")); rs.type = "button"
  rs.onclick = () => { if (confirm(t("Kembalikan semua masukan ke nilai bawaan?"))) onReset() }
  box.append(rs)
}

function checksTable(c, checks) {
  const { t, tx } = c
  return table([t("Pengecekan"), t("Status"), t("Keterangan")], checks.map(([n, o, d]) => [tx(n), o ? "✅ OK" : "❌ NOT OK", tx(d)]))
}
const headOk = (c, txt, ok) => { const { t } = c; const h = el("h4"); h.append(txt + " "); withEmoji(h, ok ? t("✅ semua OK") : t("❌ ada yang tidak memenuhi")); return h }

// Perbandingan dengan nilai di dokumen yang direview. defs: [[label, satuan]]; kotak masukan dibuat sekali, update(items) menghitung ulang selisihnya.
function makeCompare(box, st, c, kit, defs) {
  const { t, T } = c
  box.append(el("h4", null, t("Bandingkan dengan nilai di dokumen yang direview")))
  const g = kit.row()
  defs.forEach(([lab, unit], i) => kit.numField(g, T("{} di dokumen", t(lab)) + (unit ? ` (${unit})` : ""), { lo: 0, hi: 1e9, help: K("0 = tidak dibandingkan") }, [() => st.v[i], (v) => { st.v[i] = v }]))
  kit.numField(g, t("Toleransi (%)"), { lo: 0.5, hi: 50 }, [() => st.tol, (v) => { st.tol = v }])
  const out = el("div", "cmpres"); box.append(g, out)
  // items: [[label, nilai hitung, satuan]] → baris perbandingan [nama, hitung, dokumen, selisih, ok]
  return function update(items) {
    out.textContent = ""
    const rows = []
    let bad = false
    items.forEach(([lab, calc, unit], i) => {
      const v = st.v[i]
      if (!(v > 0) || !calc || !isFinite(calc)) return
      const d = (v - calc) / calc, ok = Math.abs(d) <= st.tol / 100 + 1e-9
      bad = bad || !ok
      rows.push([unit ? `${t(lab)} (${unit})` : t(lab), calc, v, d, ok])
    })
    if (rows.length) {
      out.append(table([t("Besaran"), t("Hitung app"), t("Dokumen"), t("Selisih (%)"), t("Status")], rows.map(([k, a, v, d, ok]) => [k, fixed(a, 4), fixed(v, 4), fixed(d * 100, 1), ok ? t("✅ dalam toleransi") : t("⚠️ di luar toleransi")])))
      if (bad) out.append(el("div", "warn", t("Ada selisih di luar toleransi. Periksa asumsi (beban, berat pondasi, parameter tanah, faktor beban/kombinasi, metode daya dukung) sebelum menjadikannya komentar.")))
    } else out.append(el("p", "cap", t("Isi nilai dari dokumen untuk melihat selisihnya terhadap hitungan app.")))
    return rows
  }
}

// Ringkasan markdown dengan struktur yang sama dengan _md di fondasi_ui.py
const FOOT = K("Batas: perhitungan statis/elastis sederhana sebagai pembanding. Tidak mencakup gempa tangki (API 650 Annex E), penurunan konsolidasi atau berlapis, desain tulangan, analisis dinamis tergandeng (ACI 351.3R), atau likuefaksi.")
function mdDoc(c, title, intro, blocks, cmpRows) {
  const { t } = c
  const L = [`# ${t(title)}`, "", t(intro), ""]
  blocks.forEach(([head, lines]) => L.push(`## ${t(head)}`, "", ...lines, ""))
  if (cmpRows.length) {
    L.push(`## ${t("Perbandingan dengan nilai di dokumen yang direview")}`, "")
    cmpRows.forEach(([k, a, v, d, ok]) => L.push(`- ${k}: ${t("hitung app")} = ${fmtG(Number(a.toPrecision(4)))}; ${t("dokumen")} = ${fmtG(Number(v.toPrecision(4)))}; ${t("selisih")} ${signed(d * 100, 1)} % — ${ok ? "OK" : t("di luar toleransi")}`))
    L.push("")
  }
  L.push(`_${t(FOOT)}_`)
  return L.join("\n")
}

function exportBar(box, c, doc) {
  box.textContent = ""
  if (!doc) return
  const { t } = c
  box.append(el("h4", null, t("Unduh")))
  const g = el("div", "btns")
  const b1 = el("button", "pri", t("⬇️ Ringkasan (.md)")), b2 = el("button", "pri", t("⬇️ Tabel (.csv, bisa dibuka di Excel)")), b3 = el("button", "pri", t("🖨️ Cetak / simpan PDF"))
  b1.type = b2.type = b3.type = "button"
  b1.onclick = () => download(doc.name + ".md", doc.md, "text/markdown")
  b2.onclick = () => download(doc.name + ".csv", doc.csv, "text/csv")
  b3.onclick = () => window.print()
  g.append(b1, b2, b3); box.append(g)
}
const inpBlock = (c, inp) => inp.map(([a, b]) => `- ${c.t(a)}: ${b}`)
const checkLines = (c, checks, pre = "") => checks.map(([n, ok, d]) => `- ${pre}${ok ? "OK" : "NOT OK"} — ${c.tx(n)}: ${c.tx(d)}`)

// ---------------------------------------------------------------- tab 1: pondasi peralatan
function eqTab(pane, e, c, onReset) {
  const { t, T, tx, save } = c
  const { formBox, resBox, cmpBox, expBox, bar } = skeleton(pane)
  const kit = makeKit(t, (structural) => { save(); if (structural) renderForm(); renderResults() })
  const { row, prop } = kit
  const open = e.cases.map((_, i) => i === 0)
  const cap = el("p", "cap")
  cap.innerHTML = bold(t("Footing persegi panjang dengan pedestal untuk **peralatan statis** (vessel, heat exchanger, skid, pipe rack): tekanan tanah dengan eksentrisitas dua arah, daya dukung, guling, dan geser untuk banyak kasus beban. Masukkan beban **di puncak pedestal** (tanpa berat pondasi; app menambahkan berat footing, pedestal, dan tanah urug)."))
  pane.prepend(cap)

  function renderForm() {
    formBox.textContent = ""
    const h = (txt) => formBox.append(el("h4", null, t(txt)))
    h(K("Geometri"))
    let g = row()
    kit.numField(g, t("Lebar B, arah x (m)"), { lo: 0.3, hi: 50 }, prop(e, "B"))
    kit.numField(g, t("Panjang L, arah y (m)"), { lo: 0.3, hi: 50 }, prop(e, "L"))
    kit.numField(g, t("Tebal footing t (m)"), { lo: 0.1, hi: 5 }, prop(e, "t"))
    kit.numField(g, t("Kedalaman dasar Df dari muka tanah (m)"), { lo: 0, hi: 20 }, prop(e, "Df"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("Pedestal Bp (m)"), { lo: 0.1, hi: 20 }, prop(e, "Bp"))
    kit.numField(g, t("Pedestal Lp (m)"), { lo: 0.1, hi: 20 }, prop(e, "Lp"))
    kit.numField(g, t("Tinggi pedestal di atas footing hp (m)"), { lo: 0, hi: 10 }, prop(e, "hp"))
    kit.numField(g, t("Berat isi tanah urug (kN/m³)"), { lo: 10, hi: 25 }, prop(e, "gab"))
    kit.checkField(g, t("Ikut hitung berat tanah urug di atas footing (hilangkan untuk perkiraan terburuk pada kasus angkat/guling)"), e.bf, (v) => { e.bf = v })
    formBox.append(g)
    h(K("Tanah"))
    g = row()
    kit.numField(g, t("Kohesi c (kPa)"), { lo: 0, hi: 500 }, prop(e, "c"))
    kit.numField(g, t("Sudut geser φ (°)"), { lo: 0, hi: 45 }, prop(e, "phi"))
    kit.numField(g, t("Berat isi di bawah dasar γ (kN/m³)"), { lo: 5, hi: 25, help: K("Gunakan berat isi efektif (dikurangi γw bila di bawah muka air tanah).") }, prop(e, "gam"))
    kit.numField(g, t("Sudut geser dasar–tanah δ (°)"), { lo: 0, hi: 45, help: K("Umumnya 2/3 φ untuk beton cor di tempat.") }, prop(e, "delta"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("Adhesi dasar ca (kPa)"), { lo: 0, hi: 200 }, prop(e, "ca"))
    kit.numField(g, t("Tahanan pasif yang diperhitungkan (kN)"), { lo: 0, hi: 1e5, help: K("Hanya bila perhitungan yang direview memakainya. Biasanya diabaikan (konservatif).") }, prop(e, "pp"))
    kit.numField(g, t("Modulus elastis tanah Es (kPa), 0 = lewati penurunan"), { lo: 0, hi: 1e6 }, prop(e, "es"))
    kit.numField(g, t("Poisson ν"), { lo: 0, hi: 0.49 }, prop(e, "nu"))
    formBox.append(g)
    g = row()
    kit.radioField(g, t("Daya dukung yang dipakai"), METHODS, e.method, (v) => { e.method = v })
    formBox.append(g)
    g = row()
    kit.numField(g, t("Daya dukung izin qa (kPa)"), { lo: 10, hi: 5000, disabled: e.method !== "laporan" }, prop(e, "qa"))
    kit.numField(g, t("FS daya dukung (beban tetap)"), { lo: 1, hi: 6, disabled: e.method !== "hitung" }, prop(e, "fsb"))
    kit.numField(g, t("Pengali daya dukung untuk beban sementara"), { lo: 1, hi: 2, help: K("Angin/gempa/uji: daya dukung izin dinaikkan (contoh umum 1,33). Pada metode hitung, FS minimum diturunkan dengan pengali yang sama.") }, prop(e, "qf"))
    formBox.append(g)
    h(K("Kasus beban (di puncak pedestal)"))
    formBox.append(el("p", "cap", t("Tiap baris = satu kombinasi beban layan (ASD) dari dokumen yang direview. P = vertikal tekan (kN); Hx, Hy = gaya horizontal (kN); Mx, My = momen di puncak pedestal (kNm); momen dasar = |M| + |H|·h dengan nilai mutlak (arah terburuk). Beban hidup operasi tidak dikurangi, jadi buat baris terpisah untuk kasus 'kosong' bila guling/angkat dicek.")))
    e.cases.forEach((cs, i) => {
      const d = el("details", "layer"); d.open = !!open[i]
      d.addEventListener("toggle", () => { open[i] = d.open })
      const sm = el("summary", null, `${t(cs.name) || T("Kasus {}", i + 1)} · ${t(JENIS[cs.jenis])}`)
      d.append(sm)
      let r = row()
      kit.textField(r, t("Kasus"), t(cs.name), (v) => { cs.name = v; sm.textContent = `${v || T("Kasus {}", i + 1)} · ${t(JENIS[cs.jenis])}`; save(); renderResults() })
      kit.selField(r, t("Jenis"), JENIS, cs.jenis, (v) => { cs.jenis = v })
      d.append(r)
      r = row()
      kit.numField(r, t("P (kN)"), { lo: -1e9, hi: 1e9, help: K("Negatif = tarik (angkat).") }, prop(cs, "P"))
      kit.numField(r, t("Hx (kN)"), { lo: 0, hi: 1e9 }, prop(cs, "Hx"))
      kit.numField(r, t("Hy (kN)"), { lo: 0, hi: 1e9 }, prop(cs, "Hy"))
      kit.numField(r, t("Mx (kNm)"), { lo: 0, hi: 1e9 }, prop(cs, "Mx"))
      kit.numField(r, t("My (kNm)"), { lo: 0, hi: 1e9 }, prop(cs, "My"))
      d.append(r)
      r = row()
      kit.numField(r, t("FS guling min"), { lo: 1, hi: 6 }, prop(cs, "fsot"))
      kit.numField(r, t("FS geser min"), { lo: 1, hi: 6 }, prop(cs, "fssl"))
      d.append(r)
      const del = el("button", "ghost", t("🗑️ Hapus kasus ini")); del.type = "button"; del.disabled = e.cases.length <= 1
      del.onclick = () => { e.cases.splice(i, 1); open.splice(i, 1); save(); renderForm(); renderResults() }
      d.append(del)
      formBox.append(d)
    })
    const add = el("button", "ghost", t("＋ Tambah kasus beban")); add.type = "button"; add.disabled = e.cases.length >= 12
    add.onclick = () => { const last = e.cases[e.cases.length - 1]; e.cases.push({ ...last, name: T("Kasus {}", e.cases.length + 1) }); open.push(true); save(); renderForm(); renderResults() }
    formBox.append(add)
    resetButton(formBox, c, onReset)
  }

  const cmp = makeCompare(cmpBox, e.cmp, c, kit, [[K("q maks"), "kPa"], [K("FS guling"), ""], [K("FS geser"), ""], [K("q ultimit"), "kPa"]])

  function fail(msg, cls) {
    setBar(bar, false, msg); resBox.append(el("div", cls || "err", msg)); cmp([]); exportBar(expBox, c, null)
  }
  function renderResults() {
    resBox.textContent = ""
    const cases = []
    e.cases.forEach((cs) => {
      const nm = cs.name.trim(); if (!nm) return
      const fq = cs.jenis === "Sementara" ? e.qf : 1.0
      cases.push({ name: t(nm), P: cs.P, Hx: cs.Hx, Hy: cs.Hy, Mx: cs.Mx, My: cs.My, q_factor: fq, fs_b: e.fsb / fq, fs_ot: cs.fsot, fs_sl: cs.fssl, jenis: cs.jenis })
    })
    if (!cases.length) return fail(t("Isi minimal satu kasus beban."), "note")
    if (e.Bp > e.B || e.Lp > e.L) return fail(t("Pedestal tidak boleh lebih besar dari footing."))
    const geom = { B: e.B, L: e.L, t: e.t, hp: e.hp, Bp: e.Bp, Lp: e.Lp, Df: e.Df, gamma_above: e.gab, backfill: e.bf }
    const soil = { c: e.c, phi: e.phi, gamma: e.gam, delta: e.delta, ca: e.ca, Pp: e.pp, q_allow: e.method === "laporan" ? e.qa : null, method: e.method, E: e.es || null, nu: e.nu }
    const R = eqReport(geom, soil, cases)
    const { res, w } = R, gov = res[R.gov]
    setBar(bar, R.ok_all, `${t("Kasus penentu")}: ${gov.name} · ${t("q maks (kPa)")}: ${f2(gov.press.q_max, 1)} ↓`)
    resBox.append(el("p", "cap", T("Berat pondasi: footing {} kN · pedestal {} kN · tanah urug {} kN · total {} kN.", fixed(w.footing, 1), fixed(w.pedestal, 1), fixed(w.tanah, 1), fixed(w.footing + w.pedestal + w.tanah, 1))))
    const m = el("div", "metrics")
    m.append(metric(t("Kasus penentu"), gov.name.slice(0, 24)), metric(t("q maks (kPa)"), f2(gov.press.q_max, 1)), metric(t("FS guling minimum"), R.min_fs_ot == null ? "-" : f2(R.min_fs_ot, 2)),
      metric(t("FS geser minimum"), R.min_fs_sl == null ? "-" : f2(R.min_fs_sl, 2)))
    resBox.append(m)
    resBox.append(headOk(c, t("Hasil per kasus"), R.ok_all))
    const cols = [t("Kasus"), t("V (kN)"), t("ex (m)"), t("ey (m)"), t("q maks (kPa)"), t("q min (kPa)"), t("Kontak (%)"), t("FS daya dukung"), t("FS guling"), t("FS geser"), t("Status")]
    const rows = res.map((r) => {
      const pr = r.press
      return [r.name, fixed(r.V, 1), fixed(r.ex ?? 0, 3), fixed(r.ey ?? 0, 3), pr.q_max === Infinity ? "" : fixed(pr.q_max, 1), fixed(pr.q_min, 1), fixed(pr.contact * 100, 0), r.fs_b != null ? fixed(r.fs_b, 2) : "",
        r.fs_ot != null && r.fs_ot !== Infinity ? fixed(r.fs_ot, 2) : "", r.fs_sl != null && r.fs_sl !== Infinity ? fixed(r.fs_sl, 2) : "", r.checks.every((k) => k[1]) ? "✅" : "❌"]
    })
    resBox.append(table(cols, rows))
    const two = el("div", "two"), left = el("div"), right = el("div")
    left.append(planSVG(e.B, e.L, e.Bp, e.Lp, gov.ex ?? 0, gov.ey ?? 0, gov.press.corners, t, T))
    right.append(el("b", null, T("Pengecekan: {}", gov.name)), checksTable(c, gov.checks))
    if (gov.press.mode !== "penuh") right.append(el("div", "warn", T("Distribusi tekanan: {}; area kontak {} % dari dasar. Resultan beban di luar kern.", t(gov.press.mode), fixed(gov.press.contact * 100, 0))))
    if (gov.settle != null) right.append(el("p", "cap", T("Penurunan elastis indikatif (pelat kaku): {} mm. Bukan pengganti analisis penurunan geoteknik.", fixed(gov.settle, 1))))
    two.append(left, right); resBox.append(two)
    const det = el("details", "more"); det.append(el("summary", null, t("Pengecekan semua kasus")))
    res.forEach((r) => det.append(el("b", null, r.name), checksTable(c, r.checks)))
    resBox.append(det)
    const cmpRows = cmp([[K("q maks"), gov.press.q_max, "kPa"], [K("FS guling"), R.cmp_fs_ot, ""], [K("FS geser"), R.cmp_fs_sl, ""], [K("q ultimit"), R.cmp_qult, "kPa"]])

    const inp = [[K("B x L x t (m)"), `${e.B} x ${e.L} x ${e.t}`], [K("Pedestal (m)"), `${e.Bp} x ${e.Lp} x ${e.hp}`], [K("Df (m)"), e.Df], [K("c (kPa)"), e.c], [K("phi (°)"), e.phi], [K("gamma (kN/m³)"), e.gam], [K("delta (°)"), e.delta],
      [K("Metode daya dukung"), e.method], [K("qa (kPa)"), e.method === "laporan" ? e.qa : "-"], [K("FS daya dukung"), e.method === "hitung" ? e.fsb : "-"]]
    const allChecks = res.flatMap((r) => r.checks.map(([n, ok, d]) => [r.name, n, ok, d]))
    const md = mdDoc(c, K("Cek independen pondasi peralatan (footing + pedestal)"), K("Pondasi dangkal peralatan statis: tekanan dasar dengan eksentrisitas, daya dukung (Meyerhof/Vesic), guling, dan geser. Perhitungan independen dengan app Review by YMD; bukan dokumen kontraktor."),
      [[K("Masukan"), inpBlock(c, inp)], [K("Hasil per kasus"), mdTable(cols, rows)], [K("Pengecekan"), res.flatMap((r) => checkLines(c, r.checks, `[${r.name}] `))]], cmpRows)
    const csv = toCsv([[t("Masukan"), [[t("Parameter"), t("Nilai")], ...inp.map(([a, b]) => [t(a), b])]], [t("Hasil per kasus"), [cols, ...rows]],
      [t("Pengecekan"), [[t("Kasus"), t("Pengecekan"), t("Status"), t("Keterangan")], ...allChecks.map(([cn, n, ok, d]) => [cn, tx(n), ok ? "OK" : "NOT OK", tx(d)])]]])
    exportBar(expBox, c, { name: "Cek_Pondasi_Peralatan", md, csv })
  }
  renderForm(); renderResults()
}

// ---------------------------------------------------------------- tab 2: mesin berputar
function mcTab(pane, m, c, onReset) {
  const { t, T, tx, save } = c
  const { formBox, resBox, cmpBox, expBox, bar } = skeleton(pane)
  const kit = makeKit(t, (structural) => { save(); if (structural) renderForm(); renderResults() })
  const { row, prop } = kit
  const cap = el("p", "cap"); cap.innerHTML = bold(t("Pemeriksaan **indikatif** pondasi blok untuk mesin berputar: frekuensi alami vertikal dan geser (pegas tanah Richart–Whitman, plat kaku melingkar ekuivalen), pemisahan terhadap frekuensi operasi dan harmoniknya, serta rasio massa pondasi/mesin. Mode rocking dan kopling antar-mode TIDAK dihitung: untuk keputusan desain pakai analisis khusus (ACI 351.3R, vendor mesin)."))
  pane.prepend(cap)

  function renderForm() {
    formBox.textContent = ""
    let g = row()
    kit.selField(g, t("Jenis mesin"), MTYPES, m.typ, (v) => { m.typ = v })
    formBox.append(g)
    g = row()
    kit.numField(g, t("Lebar blok B (m)"), { lo: 0.5, hi: 50 }, prop(m, "B"))
    kit.numField(g, t("Panjang blok L (m)"), { lo: 0.5, hi: 50 }, prop(m, "L"))
    kit.numField(g, t("Tebal blok (m)"), { lo: 0.2, hi: 10 }, prop(m, "tb"))
    kit.numField(g, t("Berat mesin + baseplate (kN)"), { lo: 1, hi: 1e6 }, prop(m, "wm"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("Berat tambahan di atas blok (kN)"), { lo: 0, hi: 1e6, help: K("Mis. beban isi atau perlengkapan yang ikut bergetar.") }, prop(m, "wx"))
    kit.numField(g, t("Kecepatan gelombang geser Vs (m/s)"), { lo: 30, hi: 1500, help: K("Dari laporan tanah (uji geofisika/seismik atau korelasi N-SPT).") }, prop(m, "vs"))
    kit.numField(g, t("Berat isi tanah (kN/m³)"), { lo: 10, hi: 25 }, prop(m, "gm"))
    kit.numField(g, t("Poisson ν"), { lo: 0, hi: 0.49 }, prop(m, "nu"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("Faktor reduksi G (regangan)"), { lo: 0.2, hi: 1, help: K("G dari Vs adalah regangan sangat kecil. Beberapa pedoman memakai 0,5–0,8 untuk getaran mesin; ikuti kriteria proyek.") }, prop(m, "red"))
    kit.numField(g, t("Kecepatan operasi (rpm)"), { lo: 10, hi: 20000 }, prop(m, "rpm"))
    kit.numField(g, t("Pemisahan minimum frekuensi (%)"), { lo: 5, hi: 60, help: K("Contoh umum 20 %: fn harus berbeda ≥ 20 % dari frekuensi eksitasi. Ikuti kriteria proyek/vendor.") }, prop(m, "sep"))
    kit.numField(g, t("Rasio massa minimum (pondasi/mesin)"), { lo: 0.5, hi: 10, help: K("Contoh umum: ≥ 3 untuk kompresor torak, ≥ 2 untuk mesin sentrifugal. Ikuti kriteria vendor/ACI 351.3R.") }, [() => m.mrmin[m.typ], (v) => { m.mrmin[m.typ] = v }])
    formBox.append(g)
    g = row()
    kit.chipsField(g, t("Harmonik eksitasi yang diperiksa"), [1, 2, 3].map((h) => [h, T("{}× putaran", h)]), m.harm[m.typ], (v) => { m.harm[m.typ] = v })
    formBox.append(g)
    resetButton(formBox, c, onReset)
  }

  const cmp = makeCompare(cmpBox, m.cmp, c, kit, [[K("fn vertikal"), "Hz"], [K("fn geser"), "Hz"], [K("Rasio massa"), ""]])

  function renderResults() {
    resBox.textContent = ""
    const R = mcReport({ B: m.B, L: m.L, tb: m.tb, wm: m.wm, wx: m.wx, vs: m.vs, gm: m.gm, nu: m.nu, red: m.red, rpm: m.rpm, sep: m.sep / 100, mrmin: m.mrmin[m.typ], harm: m.harm[m.typ] })
    if (R.error) { setBar(bar, false, t(R.error)); resBox.append(el("div", "err", t(R.error))); cmp([]); exportBar(expBox, c, null); return }
    const r0 = R.r0
    setBar(bar, R.ok_all, `${t("fn vertikal (Hz)")}: ${fixed(r0.modes[0].fn, 2)} · ${t("Frekuensi operasi (Hz)")}: ${fixed(m.rpm / 60, 2)} ↓`)
    resBox.append(el("p", "cap", T("Berat blok {} kN · berat total {} kN · massa {} ton · G = {} kPa · jari-jari ekuivalen r0 = {} m.", fixed(R.wf, 0), fixed(R.wt, 0), fixed(r0.massa, 1), commas(R.G, 0), fixed(r0.r0, 3))))
    const mt = el("div", "metrics")
    mt.append(metric(t("fn vertikal (Hz)"), fixed(r0.modes[0].fn, 2)), metric(t("fn geser (Hz)"), fixed(r0.modes[1].fn, 2)), metric(t("Frekuensi operasi (Hz)"), fixed(m.rpm / 60, 2)), metric(t("Rasio massa"), f2(r0.mass_ratio, 2)))
    resBox.append(mt)
    resBox.append(headOk(c, t("Pengecekan"), R.ok_all))
    const cols = [t("Mode"), t("Kekakuan (kN/m)"), t("fn (Hz)"), t("Eksitasi"), t("Beda (%)"), t("Status")]
    const rows = R.rows.map((r) => [t(r.mode), fixed(r.k, 0), fixed(r.fn, 2), `${r.h}× = ${fixed(r.fop, 2)} Hz`, fixed(r.beda * 100, 1), r.ok ? "✅" : "❌"])
    resBox.append(table(cols, rows), checksTable(c, R.checks))
    resBox.append(el("div", "note", t("Hasil ini hanya penyaring awal: tanpa rocking dan kopling, tanpa amplitudo getaran, tanpa efek kedalaman tanam atau lapisan tanah. Bila hasilnya mendekati batas atau dokumen memakai analisis lain, minta dokumen menunjukkan metodenya.")))
    const cmpRows = cmp([[K("fn vertikal"), r0.modes[0].fn, "Hz"], [K("fn geser"), r0.modes[1].fn, "Hz"], [K("Rasio massa"), r0.mass_ratio, ""]])

    const inp = [[K("Jenis mesin"), t(MTYPES[m.typ])], [K("B x L x tebal (m)"), `${m.B} x ${m.L} x ${m.tb}`], [K("Berat mesin (kN)"), m.wm], [K("Berat total (kN)"), Math.round(R.wt * 10) / 10], [K("Vs (m/s)"), m.vs], [K("G (kPa)"), Math.round(R.G)],
      [K("nu"), m.nu], [K("Putaran (rpm)"), m.rpm], [K("Pemisahan min (%)"), m.sep], [K("Rasio massa min"), m.mrmin[m.typ]]]
    const md = mdDoc(c, K("Cek independen pondasi mesin berputar (indikatif)"), K("Pemeriksaan indikatif pondasi blok mesin berputar (pegas Richart–Whitman, mode vertikal dan geser tak-tergandeng). Perhitungan independen dengan app Review by YMD; bukan dokumen kontraktor."),
      [[K("Masukan"), inpBlock(c, inp)], [K("Pengecekan"), checkLines(c, R.checks)]], cmpRows)
    const csv = toCsv([[t("Masukan"), [[t("Parameter"), t("Nilai")], ...inp.map(([a, b]) => [t(a), b])]], [t("Frekuensi"), [cols, ...rows]],
      [t("Pengecekan"), [[t("Pengecekan"), t("Status"), t("Keterangan")], ...R.checks.map(([n, ok, d]) => [tx(n), ok ? "OK" : "NOT OK", tx(d)])]]])
    exportBar(expBox, c, { name: "Cek_Pondasi_Mesin", md, csv })
  }
  renderForm(); renderResults()
}

// ---------------------------------------------------------------- tab 3: tangki
function tkTab(pane, k, c, onReset) {
  const { t, T, tx, save } = c
  const { formBox, resBox, cmpBox, expBox, bar } = skeleton(pane)
  const kit = makeKit(t, (structural) => { save(); if (structural) renderForm(); renderResults() })
  const { row, prop } = kit
  const cap = el("p", "cap"); cap.innerHTML = bold(t("Pondasi **tangki silindris** (API 650, disederhanakan): tekanan dasar pada kondisi operasi dan hidrotes, beban garis ke ringwall, daya dukung ringwall dan area tangki, penurunan elastis pusat–tepi, serta stabilitas angin tangki kosong. Beban gempa tangki (API 650 Annex E) TIDAK dihitung di sini."))
  pane.prepend(cap)

  function renderForm() {
    formBox.textContent = ""
    const h = (txt) => formBox.append(el("h4", null, t(txt)))
    h(K("Tangki"))
    let g = row()
    kit.numField(g, t("Diameter D (m)"), { lo: 2, hi: 120 }, prop(k, "D"))
    kit.numField(g, t("Tinggi shell Hs (m)"), { lo: 2, hi: 30 }, prop(k, "Hs"))
    kit.numField(g, t("Berat jenis produk (operasi)"), { lo: 0.5, hi: 2 }, prop(k, "sg"))
    kit.numField(g, t("Tinggi cairan operasi (m)"), { lo: 0.5, hi: 30 }, prop(k, "hop"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("Tinggi cairan hidrotes (m), air SG 1,0"), { lo: 0.5, hi: 30 }, prop(k, "htest"))
    kit.numField(g, t("Berat shell (kN)"), { lo: 10, hi: 1e6 }, prop(k, "ws"))
    kit.numField(g, t("Berat atap (kN)"), { lo: 0, hi: 1e6 }, prop(k, "wr"))
    kit.numField(g, t("Berat pelat dasar (kN)"), { lo: 0, hi: 1e6 }, prop(k, "wb"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("Beban hidup atap (kPa)"), { lo: 0, hi: 5, help: K("API 650: minimum 1,0 kPa; ikuti dokumen.") }, prop(k, "rl"))
    kit.numField(g, t("Kecepatan angin rancangan (m/s)"), { lo: 5, hi: 80, help: K("Tekanan angin API 650: 0,86 kPa pada 190 km/jam, berskala V².") }, prop(k, "vw"))
    kit.numField(g, t("Koefisien gesek tangki–pondasi"), { lo: 0.1, hi: 0.8, help: K("API 650 memakai 0,4.") }, prop(k, "mu"))
    formBox.append(g)
    h(K("Ringwall dan urugan"))
    g = row()
    kit.numField(g, t("Lebar ringwall b (m)"), { lo: 0.2, hi: 5 }, prop(k, "rb"))
    kit.numField(g, t("Tinggi total ringwall (m)"), { lo: 0.3, hi: 6, help: K("Dari dasar ringwall sampai puncak.") }, prop(k, "rh"))
    kit.numField(g, t("Kedalaman dasar dari muka tanah (m)"), { lo: 0, hi: 6 }, prop(k, "rdf"))
    kit.numField(g, t("Tinggi urugan (pad) di atas tanah asli (m)"), { lo: 0, hi: 5 }, prop(k, "hpad"))
    kit.numField(g, t("Berat isi urugan (kN/m³)"), { lo: 10, hi: 25 }, prop(k, "gpad"))
    formBox.append(g)
    h(K("Tanah"))
    g = row()
    kit.numField(g, t("Kohesi c (kPa)"), { lo: 0, hi: 500 }, prop(k, "c"))
    kit.numField(g, t("Sudut geser φ (°)"), { lo: 0, hi: 45 }, prop(k, "phi"))
    kit.numField(g, t("Berat isi γ (kN/m³)"), { lo: 5, hi: 25 }, prop(k, "gam"))
    kit.numField(g, t("Modulus Es (kPa), 0 = lewati penurunan"), { lo: 0, hi: 1e6 }, prop(k, "es"))
    kit.numField(g, t("Poisson ν"), { lo: 0, hi: 0.49 }, prop(k, "nu"))
    formBox.append(g)
    g = row()
    kit.numField(g, t("FS minimum daya dukung ringwall"), { lo: 1, hi: 6 }, prop(k, "fsr"))
    kit.numField(g, t("FS minimum daya dukung area tangki"), { lo: 1, hi: 6 }, prop(k, "fsm"))
    formBox.append(g)
    resetButton(formBox, c, onReset)
  }

  const cmp = makeCompare(cmpBox, k.cmp, c, kit, [[K("q ringwall"), "kPa"], [K("q pusat maks"), "kPa"], [K("Penurunan pusat maks"), "mm"], [K("Rasio angin"), ""]])

  function renderResults() {
    resBox.textContent = ""
    const R = tkReport(k)
    if (R.error) { setBar(bar, false, t(R.error)); resBox.append(el("div", "err", t(R.error))); cmp([]); exportBar(expBox, c, null); return }
    const o = R.o, top = o.conds[R.top]
    setBar(bar, R.ok_all, `${t("q ringwall (kPa)")}: ${fixed(o.q_rw, 1)} · ${t("Rasio angin (≤ 1)")}: ${f2(o.ur_wind, 2)} ↓`)
    const mt = el("div", "metrics")
    mt.append(metric(t("q ringwall (kPa)"), fixed(o.q_rw, 1)), metric(t("q pusat maks (kPa)"), fixed(top.q_c, 1), t(top.name)), metric(t("Beban garis ke ringwall (kN/m)"), fixed(o.w_line, 1)), metric(t("Rasio angin (≤ 1)"), f2(o.ur_wind, 2)))
    resBox.append(mt)
    resBox.append(headOk(c, t("Pengecekan"), R.ok_all), checksTable(c, R.checks))
    const hasS = o.conds.some((x) => x.s_center != null)
    const cols = [t("Kondisi"), t("Tekanan cairan (kPa)"), t("Pelat dasar (kPa)"), t("Urugan (kPa)"), t("q pusat (kPa)")]
    if (hasS) cols.push(t("Penurunan pusat (mm)"), t("Penurunan tepi (mm)"), t("Selisih pusat–tepi (mm)"), t("Kemiringan pusat–tepi"))
    const rows = o.conds.map((x) => {
      const r = [t(x.name), fixed(x.p_liq, 1), fixed(x.p_bot, 1), fixed(x.p_pad, 1), fixed(x.q_c, 1)]
      if (hasS) r.push(fixed(x.s_center, 0), fixed(x.s_edge, 0), fixed(x.s_diff, 0), x.tilt > 0 ? `1:${fixed(1 / x.tilt, 0)}` : "-")
      return r
    })
    resBox.append(el("h4", null, t("Tekanan dasar dan penurunan")), table(cols, rows))
    if (k.es) resBox.append(el("p", "cap", t("Penurunan = pelat lentur melingkar di atas ruang setengah-elastis homogen (pusat 2qa(1−ν²)/E; tepi 4qa(1−ν²)/(πE)). Indikatif: tidak memperhitungkan lapisan, konsolidasi, atau pengaruh ringwall. Bandingkan dengan batas proyek / API 653 Annex B untuk penurunan seragam, miring, dan mangkuk.")))
    resBox.append(el("p", "cap", T("Angin: tekanan shell {} kPa → gaya {} kN, momen Mw = {} kNm di dasar shell. Gaya angkat atap {} kN pada tekanan {} kPa (periksa sambungan atap–shell di dokumen; di sini hanya informasi). Kriteria stabilitas mengikuti API 650 §5.11 kriteria (a), sederhana: periksa edisi dan kriteria lain (b), (c) pada dokumen.",
      fixed(o.pw, 3), fixed(o.Fw, 1), fixed(o.Mw, 0), fixed(o.uplift_roof, 0), fixed(o.p_uplift, 3))))
    const cmpRows = cmp([[K("q ringwall"), o.q_rw, "kPa"], [K("q pusat maks"), top.q_c, "kPa"], [K("Penurunan pusat maks"), R.cmp_s_center, "mm"], [K("Rasio angin"), o.ur_wind, ""]])

    const inp = [[K("D x Hs (m)"), `${k.D} x ${k.Hs}`], [K("SG operasi / H (m)"), `${k.sg} / ${k.hop}`], [K("H hidrotes (m)"), k.htest], [K("Berat shell / atap / dasar (kN)"), `${k.ws} / ${k.wr} / ${k.wb}`], [K("Angin (m/s)"), k.vw],
      [K("Ringwall b x tinggi (m)"), `${k.rb} x ${k.rh}`], [K("Df (m)"), k.rdf], [K("Pad (m, kN/m³)"), `${k.hpad}, ${k.gpad}`], [K("c / phi / gamma"), `${k.c} / ${k.phi} / ${k.gam}`], [K("Es (kPa) / nu"), `${k.es} / ${k.nu}`]]
    const md = mdDoc(c, K("Cek independen pondasi tangki (API 650, disederhanakan)"), K("Pondasi tangki silindris: tekanan dasar, beban ringwall, daya dukung, penurunan elastis, dan stabilitas angin tangki kosong (API 650, disederhanakan). Perhitungan independen dengan app Review by YMD; bukan dokumen kontraktor."),
      [[K("Masukan"), inpBlock(c, inp)], [K("Pengecekan"), checkLines(c, R.checks)]], cmpRows)
    const csv = toCsv([[t("Masukan"), [[t("Parameter"), t("Nilai")], ...inp.map(([a, b]) => [t(a), b])]], [t("Tekanan dan penurunan"), [cols, ...rows]],
      [t("Pengecekan"), [[t("Pengecekan"), t("Status"), t("Keterangan")], ...R.checks.map(([n, ok, d]) => [tx(n), ok ? "OK" : "NOT OK", tx(d)])]]])
    exportBar(expBox, c, { name: "Cek_Pondasi_Tangki", md, csv })
  }
  renderForm(); renderResults()
}

// ---------------------------------------------------------------- gambar denah footing (padanan plan_png di fondasi.py)
function planSVG(B, L, Bp, Lp, ex, ey, corners, t, T) {
  const W = 900, H = 560, pad = 120
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "profile", role: "img", "aria-label": t("Denah footing dengan resultan beban dan tekanan di sudut") })
  svg.append(sv("rect", { x: 0, y: 0, width: W, height: H, fill: "#FAF9F7" }))
  const k = Math.min((W - 2 * pad) / B, (H - 2 * pad) / L), cx = W / 2, cy = H / 2
  const P = (x, y) => [cx + x * k, cy - y * k]
  const rect = (a, b, fill, sw) => { const [x1, y1] = P(...a), [x2, y2] = P(...b); svg.append(sv("rect", { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), fill, stroke: "#463E37", "stroke-width": sw })) }
  const text = (p, s, fill, anchor, base) => svg.append(sv("text", { x: p[0], y: p[1], fill, "font-size": 26, "text-anchor": anchor, "dominant-baseline": base, "font-family": "Helvetica, Arial, sans-serif" }, s))
  rect([-B / 2, L / 2], [B / 2, -L / 2], "#D6CFC4", 4)
  rect([-Bp / 2, Lp / 2], [Bp / 2, -Lp / 2], "#96A0AF", 3)
  const kern = [P(B / 6, 0), P(0, L / 6), P(-B / 6, 0), P(0, -L / 6)]
  svg.append(sv("polygon", { points: kern.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "), fill: "none", stroke: "#1E64A0", "stroke-width": 2.5 }))
  const [px, py] = P(Math.min(ex, B / 2), Math.min(ey, L / 2))
  svg.append(sv("circle", { cx: px, cy: py, r: 8, fill: "#C82828" }))
  text([20, 52], T("e = ({}; {}) m", fixed(ex, 2), fixed(ey, 2)), "#C82828", "start", "hanging")
  text(P(0, -L / 2 - 0.08 * L), T("B = {} m (arah x)", fixed(B, 2)), "#3C3732", "middle", "hanging")
  text(P(B / 2 + 0.03 * B, 0), T("L = {} m", fixed(L, 2)), "#3C3732", "start", "middle")
  if (corners) {
    const pos = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    pos.forEach(([sx, sy], i) => {
      const [x, y] = P(sx * B / 2, sy * L / 2)
      text([x - sx * 8, y + sy * 8], fixed(Math.max(corners[i], 0), 0), "#1E64A0", sx > 0 ? "end" : "start", sy > 0 ? "hanging" : "alphabetic")
    })
  }
  text([20, 14], t("kPa di sudut · garis biru = kern · titik merah = resultan"), "#3C3732", "start", "hanging")
  return svg
}

// ---------------------------------------------------------------- teks "Rumus & batasan" (Indonesia; terjemahan lewat t())
const INFO_ID = `**Daya dukung (persamaan umum, Meyerhof / Vesic / Hansen)**
- q_ult = c·Nc·sc·dc·ic + q0·Nq·sq·dq·iq + ½·γ·B'·Nγ·sγ·dγ·iγ, dengan Nq = e^(π tan φ)·tan²(45°+φ/2), Nc = (Nq−1)/tan φ, Nγ = 2(Nq+1)·tan φ (Vesic); φ = 0 → Nc = 5,14
- B', L' = dimensi efektif (B − 2ex, L − 2ey); faktor bentuk sc = 1 + (B'/L')(Nq/Nc), sq = 1 + (B'/L') tan φ, sγ = 1 − 0,4 B'/L'; faktor kedalaman Hansen/Vesic; faktor kemiringan Vesic (eksponen m terbesar, konservatif)
- Tekanan dasar: di dalam kern (6ex/B + 6ey/L ≤ 1) linear q = V/(BL)·(1 ± 6ex/B ± 6ey/L); di luar kern satu arah segitiga q maks = 2V / (3·L·(B/2 − e)); dua arah dipakai luas efektif Meyerhof q = V/A'

**Pondasi peralatan**
- Momen dasar = |M| + |H|·h (nilai mutlak, arah terburuk). Guling: FS = V·(B/2)/Mb (dan arah y). Geser: FS = (V·tan δ + ca·A kontak + Pp) / H
- Berat pondasi dihitung otomatis: footing, pedestal, dan tanah urug (bisa dimatikan)

**Mesin berputar (indikatif)**
- Pegas pelat kaku melingkar ekuivalen (r0 = √(BL/π)): Kz = 4·G·r0/(1−ν), Kx = 32(1−ν)·G·r0/(7−8ν); fn = ½π·√(K/m); G = (γ/g)·Vs²
- Pemisahan |fn − f_op| / f_op ≥ 20 % (contoh umum) pada tiap harmonik; rasio massa pondasi/mesin (contoh umum ≥ 3 resiprokal, ≥ 2 sentrifugal)

**Tangki (API 650, disederhanakan)**
- Tekanan cairan p = γw·SG·H; beban garis ke ringwall = (W shell + W atap + beban hidup atap) / πD; tekanan ringwall = (beban garis + berat ringwall) / b
- Penurunan: pelat lentur melingkar di atas ruang setengah-elastis; pusat 2qa(1−ν²)/E, tepi 4qa(1−ν²)/(πE)
- Angin: tekanan shell 0,86 kPa × (V/190 km/jam)² pada bidang proyeksi; Mw = F·Hs/2; tangki kosong stabil bila 0,6 Mw ≤ MDL/1,5 + MDLR (API 650 §5.11 kriteria (a)); geser angin ≤ 0,4 × berat tangki kosong

**Batasan**
- Statis/elastis sederhana. TIDAK mencakup: gempa tangki (API 650 Annex E), penurunan konsolidasi atau berlapis, likuefaksi, desain tulangan, rocking dan kopling pondasi mesin (ACI 351.3R), pengaruh muka air tanah selain lewat berat isi efektif.
- Nilai bawaan (FS, pengali beban sementara, 20 % pemisahan frekuensi, rasio massa, koefisien gesek) adalah contoh umum, bukan kriteria proyek. Ikuti Design Basis dan edisi kode yang dipakai dokumen.`
