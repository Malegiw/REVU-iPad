// Tab "Laporan": data proyek, status alur (Tanah → Gempa → Desain → Penurunan) dan laporan proyek gabungan PDF/Excel dengan bab:
// A. Data tanah, B. Parameter gempa, C. Ringkasan desain, D… modul desain terpilih, terakhir Penurunan. Hak cipta & cap waktu pada tiap halaman.
import { L, lang, nf, govern, AUTHOR } from "./desain/core.js"
import { el, field, exportBar, reveal, tableView, fmtCheck, urClass } from "./desain/ui.js"
import { projLoad, projSave, soilDS, seisSite, stepper } from "./project.js"
import { siteClass, QA_METHOD } from "./desain/soil.js"
import { initUnits, hero, card, footer } from "./pj_ui.js"

const OPT = { mods: {}, detail: "full", img: true }
export function mountLaporan(box, ctx) {
  lang.cur = ctx.lang
  initUnits()
  const P = projLoad()
  box.textContent = ""
  const infoBox = el("div"), stBox = el("div"), optBox = el("div"), expBox = el("div", "dz-expbox dz-in")
  box.append(stepper("laporan", P), hero(L("Langkah 5 · keluaran", "Step 5 · output"), L("Laporan Proyek", "Project Report"),
    L("Satu laporan PDF/Excel untuk seluruh proyek: data tanah, parameter gempa, ringkasan & lembar perhitungan setiap pondasi (dangkal/dalam), dan penurunan — dengan hak cipta dan cap waktu.",
      "One PDF/Excel report for the whole project: soil data, seismic parameters, summary & calculation sheets of every foundation (shallow/deep), and settlement — with copyright and timestamp."),
    ["PDF", "Excel (.xlsx)", `© ${AUTHOR}`]), infoBox, stBox, optBox, expBox, footer())
  // ---- data proyek
  const g = el("div", "dz-grid"), sv = () => projSave(P)
  ;[["name", L("Nama proyek", "Project name")], ["client", L("Klien", "Client")], ["loc", L("Lokasi", "Location")], ["doc", L("No. dokumen", "Document no.")], ["rev", "Rev."], ["eng", L("Dihitung oleh", "Prepared by")], ["chk", L("Diperiksa oleh", "Checked by")]]
    .forEach(([k, lab]) => g.append(field({ k, lab, type: "txt", obj: P.info }, P.info, sv)))
  infoBox.append(card("r-info", "📁", L("Data proyek (kepala laporan)", "Project data (report header)"), P.info.name || "", g))
  let built = null
  const state = el("div", "pj-flow"); stBox.append(card("r-flow", "🧭", L("Status alur proyek", "Project workflow status"), null, state))
  state.append(el("p", "hint", L("Menghitung semua modul…", "Computing all modules…")))
  setTimeout(async () => {
    built = await collect(P, ctx.lang)
    if (!box.isConnected) return
    drawStatus(); drawOpts()
    exportBar(expBox, () => compose(P, built), { project: P.info })
    reveal(box)
  }, 30)
  function drawStatus() {
    state.textContent = ""
    const { soil, seis, mods, settle } = built
    const row = (n, ic, t, sub, ok, href) => { const a = el("a", "pj-frow dz-in " + (ok === true ? "ok" : ok === false ? "bad" : "")); a.href = href; a.append(el("span", "pj-n", n), el("span", "pj-ic", ic)); const x = el("span", "pj-tx"); x.append(el("b", null, t), el("small", null, sub)); a.append(x, el("span", "pj-st", ok === true ? "✓" : ok === false ? "!" : "•")); return a }
    const sc = soil.sc
    state.append(row("1", "🧱", L("Data tanah", "Soil data"), `${P.soil.name} · ${P.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${soil.ds.layers.length} ${L("lapis", "layers")} · ${L("kelas situs", "site class")} ${sc.cls} · qa: ${QA_METHOD()[P.bear.method]}`, true, "#/tanah"))
    state.append(row("2", "🌐", L("Parameter gempa", "Seismic parameters"), `SDS ${nf(seis.sp.SDS, 3)} · SD1 ${nf(seis.sp.SD1, 3)} · ${L("kelas", "class")} ${seis.cls} · KDS ${seis.SDC}`, true, "#/gempa"))
    const okN = mods.filter((m) => m.out && m.out.checks.every((c) => c.ok || c.info)).length
    state.append(row("3", "🏗️", L("Desain pondasi", "Foundation design"), `${okN}/${mods.length} ${L("memenuhi", "passing")} · ${mods.map((m) => `${m.m.icon} ${m.out ? (m.out.fdType === "deep" ? L("tiang", "piles") : L("dangkal", "shallow")) : "–"}`).join(" · ")}`, okN === mods.length, "#/desain"))
    const sb = settle.results.filter((x) => !x.r.error), bad = sb.filter((x) => x.r.s > x.r.allow).length
    const worst = sb.reduce((a, b) => (!a || b.r.s / b.r.allow > a.r.s / a.r.allow ? b : a), null)
    state.append(row("4", "📉", L("Penurunan", "Settlement"), `${sb.length} ${L("pondasi", "foundations")}${worst ? ` · ${L("terbesar", "largest")} ${nf(worst.r.s, 1)} mm (${worst.c.title.split(" (")[0]})` : ""}`, !bad, "#/penurunan"))
  }
  function drawOpts() {
    optBox.textContent = ""
    const g2 = el("div", "dz-grid")
    g2.append(field({ k: "detail", type: "seg", lab: L("Isi bab desain", "Design chapter content"), opts: { full: L("Lengkap (lembar hitung, tabel, gambar)", "Full (calc sheets, tables, figures)"), sum: L("Ringkas (ringkasan & pemeriksaan)", "Summary (key results & checks)") }, obj: OPT, wide: true }, OPT, () => drawOpts()),
      field({ k: "img", type: "chk", lab: L("Sertakan gambar", "Include figures"), obj: OPT }, OPT, () => {}))
    const list = el("div", "pj-modsel")
    built.mods.forEach(({ m, out, error }) => {
      if (OPT.mods[m.id] == null) OPT.mods[m.id] = true
      const lb = el("label", "pj-chk"), c = el("input"); c.type = "checkbox"; c.checked = !!OPT.mods[m.id] && !error; c.disabled = !!error
      c.onchange = () => { OPT.mods[m.id] = c.checked }
      const ok = out && out.checks.every((k) => k.ok || k.info)
      lb.append(c, el("span", null, `${m.icon} ${m.title()}`), el("small", ok ? "uok" : "ubad", error ? error : ok ? "OK" : "NOT OK"))
      list.append(lb)
    })
    optBox.append(card("r-opt", "🧾", L("Isi laporan", "Report content"), null, [g2, el("div", "dz-sub", L("Modul desain yang disertakan", "Design modules to include")), list]))
  }
}

async function collect(P, lng) {
  const [T, G, D, S] = await Promise.all([import("./tanah_ui.js"), import("./gempa_ui.js"), import("./desain_ui.js"), import("./penurunan_ui.js")])
  const ds = soilDS(P)
  const run = D.runAll(lng, { P })
  return { soil: { ds, sc: siteClass(ds), out: T.soilReport(P) }, seis: { ...seisSite(P), out: G.seisReport(P) }, mods: run.mods, settle: await S.settleReport(P, lng) }
}
const short = (t) => t.split(" (")[0].replace("Pondasi ", "").replace(" Foundation", "")
function summaryOf(o) {
  return { ...o, kv: [{ title: L("Ringkasan hasil", "Key results"), rows: o.metrics.map((m) => [m.lab, typeof m.val === "number" ? nf(m.val, m.d ?? 1) : m.val, m.unit || ""]) }, ...o.kv.slice(0, 1)], tables: [], steps: [], notes: [], drawings: (o.drawings || []).slice(0, 1) }
}
function compose(P, B) {
  const mods = B.mods.filter(({ m, out }) => out && OPT.mods[m.id] !== false)
  const sum = { title: L("Ringkasan desain pondasi", "Foundation design summary"), cols: [L("Modul", "Module"), L("Tipe pondasi", "Foundation type"), L("Pemeriksaan", "Checks"), L("Menentukan", "Governing"), "UR", L("Penurunan", "Settlement"), "Status"],
    rows: mods.map(({ m, out }) => { const g = govern(out.checks), bad = out.checks.filter((c) => !c.ok && !c.info).length, n = out.checks.filter((c) => !c.info).length
      return { cells: [short(m.title()), out.fdType === "deep" ? L("Dalam (tiang)", "Deep (piles)") : L("Dangkal", "Shallow"), `${n - bad}/${n}`, g ? g.item : "–", g ? fmtCheck(g).urTxt : "–", out.settle && out.settle.s != null ? `${nf(out.settle.s, 1)} / ${nf(out.settle.allow, 0)} mm` : "–", bad ? "NOT OK" : "OK"], cls: bad ? "bad" : "" } }),
    align: ["l", "l", "r", "l", "r", "r", "l"] }
  const sumOut = { title: "", metrics: [], checks: [], kv: [], tables: [sum], steps: [], notes: [], drawings: [] }
  const chapters = [
    { title: L("Data Tanah", "Soil Data"), sub: B.soil.out.sub, out: B.soil.out, noImg: !OPT.img },
    { title: L("Parameter Gempa", "Seismic Parameters"), sub: B.seis.out.sub, out: B.seis.out, noImg: !OPT.img },
    { title: L("Ringkasan Desain Pondasi", "Foundation Design Summary"), sub: L("Status semua modul desain yang disertakan", "Status of all included design modules"), out: sumOut, noImg: true },
    ...mods.map(({ m, out }) => ({ title: out.title, sub: out.sub, out: OPT.detail === "sum" ? summaryOf(out) : out, noImg: !OPT.img })),
    { title: L("Penurunan Pondasi", "Foundation Settlement"), sub: B.settle.out.sub, out: { ...B.settle.out, drawings: [] }, noImg: true },
  ]
  const allChecks = mods.flatMap(({ m, out }) => out.checks.map((c) => ({ ...c, grp: `${short(m.title())} · ${c.grp}` })))
  const ok = allChecks.every((c) => c.ok || c.info)
  const g = govern(allChecks)
  return {
    file: "Laporan_Proyek", suite: L("LAPORAN PROYEK", "PROJECT REPORT"), title: `${L("Laporan Proyek", "Project Report")} — ${P.info.name || "Project"}`, sub: `${L("Data tanah", "Soil")} ${P.soil.name} · ${L("kelas situs", "site class")} ${B.seis.cls} · SDS ${nf(B.seis.sp.SDS, 3)} · ${mods.length} ${L("modul desain", "design modules")} · ${L("penurunan", "settlement")} ${B.settle.results.length} ${L("pondasi", "foundations")}`,
    refs: "SNI 8460:2017 · SNI 1726:2019 · SNI 1727:2020 · SNI 2847:2019 · SNI 1729:2020 · API 650 · API RP 2GEO · ACI 351.3R · PIP · IEEE 980",
    metrics: [{ lab: L("Kelas situs / SDS", "Site class / SDS"), val: `${B.seis.cls} / ${nf(B.seis.sp.SDS, 3)}` }, { lab: L("Modul memenuhi", "Modules passing"), val: `${mods.filter(({ out }) => out.checks.every((c) => c.ok || c.info)).length} / ${mods.length}` }, { lab: L("Pemeriksaan", "Checks"), val: String(allChecks.filter((c) => !c.info).length) }, { lab: L("Penurunan terbesar", "Largest settlement"), val: (() => { const x = B.settle.results.filter((r) => !r.r.error).reduce((a, b) => (!a || b.r.s > a.r.s ? b : a), null); return x ? `${nf(x.r.s, 1)} mm` : "–" })() }],
    checks: allChecks, banner: allChecks.length ? null : undefined, govTxt: "",
    kv: [{ title: L("Proyek", "Project"), rows: [[L("Nama", "Name"), P.info.name], [L("Klien", "Client"), P.info.client || "–"], [L("Lokasi", "Location"), P.info.loc || "–"], [L("No. dokumen", "Doc no."), P.info.doc || "–"], ["Rev.", P.info.rev || "–"]] }, ...B.soil.out.kv, ...B.seis.out.kv],
    tables: [...B.soil.out.tables, ...B.seis.out.tables, sum, ...B.settle.out.tables], steps: [...B.soil.out.steps, ...B.seis.out.steps, ...mods.flatMap(({ out }) => out.steps || [])],
    notes: [L("Laporan ini disusun otomatis dari data proyek (tab Tanah, Gempa, Desain, Penurunan) pada saat ekspor. Verifikasi oleh engineer yang berwenang tetap diperlukan.", "This report is compiled automatically from the project data (Soil, Seismic, Design, Settlement tabs) at export time. Verification by a responsible engineer is still required.")],
    drawings: [], chapters, combos: [], cases: {}, ok, g,
  }
}
