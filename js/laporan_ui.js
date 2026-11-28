// Tab "Laporan": data proyek, status alur (Tanah → Gempa → Desain → Penurunan) dan laporan proyek gabungan PDF/Excel dengan bab:
// A. Data tanah, B. Parameter gempa, C. Ringkasan desain, D… modul desain terpilih, terakhir Penurunan. Hak cipta & cap waktu pada tiap halaman.
import { L, lang, nf, govern, AUTHOR, edLabel } from "./desain/core.js"
import { el, field, exportBar, reveal, tableView, fmtCheck, urClass } from "./desain/ui.js"
import { projLoad, projSave, soilDS, seisSite, stepper } from "./project.js"
import { siteClass, QA_METHOD } from "./desain/soil.js"
import { initUnits, hero, card, footer } from "./pj_ui.js"
import { palette } from "./desain/draw.js"
import { ico, MOD_ICO } from "./icons.js"

const OPT = { mods: {}, detail: "full", img: true, soils: "used" }
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
    const row = (n, ic, t, sub, ok, href) => { const a = el("a", "pj-frow dz-in " + (ok === true ? "ok" : ok === false ? "bad" : "")); a.href = href; const icw = el("span", "pj-ic"); icw.append(ico(ic)); a.append(el("span", "pj-n", n), icw); const x = el("span", "pj-tx"); x.append(el("b", null, t), el("small", null, sub)); a.append(x, el("span", "pj-st", ok === true ? "✓" : ok === false ? "!" : "•")); return a }
    const sc = soil.sc
    const tpl = P.soils.filter((x) => x.tpl && soil.used.has(x.id))
    state.append(row("1", "🧱", L("Data tanah", "Soil data"), `${P.soils.length > 1 ? `${P.soils.length} ${L("titik", "points")} (${soil.used.size} ${L("dipakai", "used")}) · ★ ` : ""}${P.soil.name} · ${P.soil.test === "cpt" ? "CPT" : "N-SPT"} · ${soil.ds.layers.length} ${L("lapis", "layers")} · ${L("kelas situs", "site class")} ${sc.cls} · qa: ${QA_METHOD()[P.bear.method]}${tpl.length ? ` · ⚠ ${L("data contoh", "sample data")}: ${tpl.map((x) => x.name).join(", ")}` : ""}`, !tpl.length, "#/tanah"))
    state.append(row("2", "🌐", L("Parameter gempa", "Seismic parameters"), `SDS ${nf(seis.sp.SDS, 3)} · SD1 ${nf(seis.sp.SD1, 3)} · ${L("kelas", "class")} ${seis.cls} · KDS ${seis.SDC}`, true, "#/gempa"))
    const okN = mods.filter((m) => m.out && m.out.checks.every((c) => c.ok || c.info)).length
    state.append(row("3", "🏗️", L("Desain pondasi", "Foundation design"), `${okN}/${mods.length} ${L("memenuhi", "passing")} · ${mods.map((m) => `${short(m.m.title())}: ${m.out ? (m.out.fdType === "deep" ? L("tiang", "piles") : L("dangkal", "shallow")) : "–"}`).join(" · ")}`, okN === mods.length, "#/desain"))
    const sb = settle.results.filter((x) => !x.r.error), bad = sb.filter((x) => x.r.s > x.r.allow).length
    const worst = sb.reduce((a, b) => (!a || b.r.s / b.r.allow > a.r.s / a.r.allow ? b : a), null)
    state.append(row("4", "📉", L("Penurunan", "Settlement"), `${sb.length} ${L("pondasi", "foundations")}${worst ? ` · ${L("terbesar", "largest")} ${nf(worst.r.s, 1)} mm (${worst.c.title.split(" (")[0]})` : ""}`, !bad, "#/penurunan"))
  }
  function drawOpts() {
    optBox.textContent = ""
    const g2 = el("div", "dz-grid")
    g2.append(field({ k: "detail", type: "seg", lab: L("Isi bab desain", "Design chapter content"), opts: { full: L("Lengkap (lembar hitung, tabel, gambar)", "Full (calc sheets, tables, figures)"), sum: L("Ringkas (ringkasan & pemeriksaan)", "Summary (key results & checks)") }, obj: OPT, wide: true }, OPT, () => drawOpts()),
      field({ k: "img", type: "chk", lab: L("Sertakan gambar", "Include figures"), obj: OPT }, OPT, () => {}),
      ...(P.soils.length > 1 ? [field({ k: "soils", type: "seg", lab: L("Titik tanah di laporan", "Soil points in the report"), opts: { used: L(`Yang dipakai (${built.soil.used.size})`, `Used (${built.soil.used.size})`), all: L(`Semua titik (${P.soils.length})`, `All points (${P.soils.length})`) }, obj: OPT, wide: true }, OPT, () => drawOpts())] : []))
    const list = el("div", "pj-modsel")
    built.mods.forEach(({ m, out, error }) => {
      if (OPT.mods[m.id] == null) OPT.mods[m.id] = true
      const lb = el("label", "pj-chk"), c = el("input"); c.type = "checkbox"; c.checked = !!OPT.mods[m.id] && !error; c.disabled = !!error
      c.onchange = () => { OPT.mods[m.id] = c.checked }
      const ok = out && out.checks.every((k) => k.ok || k.info)
      const icm = el("span", "pj-chk-ic"); icm.append(ico(MOD_ICO[m.id])); lb.append(c, icm, el("span", null, m.title()), el("small", ok ? "uok" : "ubad", error ? error : ok ? "OK" : "NOT OK"))
      list.append(lb)
    })
    optBox.append(card("r-opt", "🧾", L("Isi laporan", "Report content"), null, [g2, el("div", "dz-sub", L("Modul desain yang disertakan", "Design modules to include")), list]))
  }
}

async function collect(P, lng) {
  const [T, G, D, S] = await Promise.all([import("./tanah_ui.js"), import("./gempa_ui.js"), import("./desain_ui.js"), import("./penurunan_ui.js")])
  const B = await import("./bank_ui.js")
  const ds = soilDS(P)
  const run = D.runAll(lng, { P })
  // titik yang dipakai: titik acuan ★ + titik pilihan modul Desain + titik kasus manual penurunan
  const u = B.usage(P), used = new Set([P.soilRef, ...u.keys()])
  const pts = P.soils.map((so) => ({ so, users: u.get(so.id) || [], out: so === P.soil ? T.soilReport(P) : T.soilReport(P, so) }))
  const bank = P.soils.length > 1 ? { table: B.bankTable(P), plan: B.hasPlan(P) ? (m) => B.planDraw(P, palette(m)) : null, overlay: (m) => B.overlayDraw(P, palette(m)) } : null
  return { soil: { ds, sc: siteClass(ds), out: pts.find((x) => x.so === P.soil).out, pts, used, bank }, seis: { ...seisSite(P), out: G.seisReport(P) }, mods: run.mods, settle: await S.settleReport(P, lng) }
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
  // bab data tanah: ringkasan bank (bila > 1 titik) + lembar data tiap titik (yang dipakai / semua)
  const pts = B.soil.pts.filter((x) => OPT.soils === "all" || B.soil.used.has(x.so.id)), multi = P.soils.length > 1
  const ptSub = (x) => `${x.out.sub}${x.so.id === P.soilRef ? ` · ★ ${L("titik acuan", "reference point")}` : ""}${x.users.length ? ` · ${L("dipakai", "used by")}: ${x.users.join(", ")}` : ""}${x.so.tpl ? ` · ⚠ ${L("data contoh, belum diisi", "sample data, not entered yet")}` : ""}`
  const bankOut = B.soil.bank ? { title: "", metrics: [], checks: [], kv: [], tables: [B.soil.bank.table], steps: [], notes: [], drawings: [...(B.soil.bank.plan ? [{ make: B.soil.bank.plan, cap: L("Denah titik penyelidikan", "Investigation point plan"), maxH: 360 }] : []), { make: B.soil.bank.overlay, cap: L("Perbandingan N60 (bor) dan qc (sondir) semua titik", "N60 (boreholes) and qc (CPT) of all points"), maxH: 340 }] } : null
  const soilCh = [...(bankOut ? [{ title: L("Bank Data Tanah — Ringkasan Titik", "Soil Data Bank — Points Summary"), sub: L(`${P.soils.length} titik penyelidikan · titik acuan ★ ${P.soil.name}`, `${P.soils.length} investigation points · reference point ★ ${P.soil.name}`), out: bankOut, noImg: !OPT.img }] : []),
    ...pts.map((x) => ({ title: multi ? `${L("Data Tanah", "Soil Data")} — ${x.so.name}` : L("Data Tanah", "Soil Data"), sub: ptSub(x), out: x.out, noImg: !OPT.img }))]
  const chapters = [
    ...soilCh,
    { title: L("Parameter Gempa", "Seismic Parameters"), sub: B.seis.out.sub, out: B.seis.out, noImg: !OPT.img },
    { title: L("Ringkasan Desain Pondasi", "Foundation Design Summary"), sub: L("Status semua modul desain yang disertakan", "Status of all included design modules"), out: sumOut, noImg: true },
    ...mods.map(({ m, out }) => ({ title: out.title, sub: out.sub, out: OPT.detail === "sum" ? summaryOf(out) : out, noImg: !OPT.img })),
    { title: L("Penurunan Pondasi", "Foundation Settlement"), sub: B.settle.out.sub, out: { ...B.settle.out, drawings: [] }, noImg: true },
  ]
  const allChecks = mods.flatMap(({ m, out }) => out.checks.map((c) => ({ ...c, grp: `${short(m.title())} · ${c.grp}` })))
  const ok = allChecks.every((c) => c.ok || c.info)
  const g = govern(allChecks)
  return {
    file: "Laporan_Proyek", suite: L("LAPORAN PROYEK", "PROJECT REPORT"), title: `${L("Laporan Proyek", "Project Report")} — ${P.info.name || "Project"}`, sub: `${L("Data tanah", "Soil")} ${multi ? `${P.soils.length} ${L("titik", "points")} · ★ ` : ""}${P.soil.name} · ${L("kelas situs", "site class")} ${B.seis.cls} · SDS ${nf(B.seis.sp.SDS, 3)} · ${mods.length} ${L("modul desain", "design modules")} · ${L("penurunan", "settlement")} ${B.settle.results.length} ${L("pondasi", "foundations")}`,
    refs: edLabel("SNI 8460:2017 · SNI 1726:2019 · SNI 1727:2020 · SNI 2847:2019 · AISC 360-16 · API 650 · API RP 2GEO · ACI 351.3R · PIP · IEEE 980 · IEEE 693"),
    metrics: [{ lab: L("Kelas situs / SDS", "Site class / SDS"), val: `${B.seis.cls} / ${nf(B.seis.sp.SDS, 3)}` }, { lab: L("Modul memenuhi", "Modules passing"), val: `${mods.filter(({ out }) => out.checks.every((c) => c.ok || c.info)).length} / ${mods.length}` }, { lab: L("Pemeriksaan", "Checks"), val: String(allChecks.filter((c) => !c.info).length) }, { lab: L("Penurunan terbesar", "Largest settlement"), val: (() => { const x = B.settle.results.filter((r) => !r.r.error).reduce((a, b) => (!a || b.r.s > a.r.s ? b : a), null); return x ? `${nf(x.r.s, 1)} mm` : "–" })() }],
    checks: allChecks, banner: allChecks.length ? null : undefined, govTxt: "",
    kv: [{ title: L("Proyek", "Project"), rows: [[L("Nama", "Name"), P.info.name], [L("Klien", "Client"), P.info.client || "–"], [L("Lokasi", "Location"), P.info.loc || "–"], [L("No. dokumen", "Doc no."), P.info.doc || "–"], ["Rev.", P.info.rev || "–"]] },
      ...pts.flatMap((x) => x.out.kv.map((k) => (multi ? { ...k, title: `${x.so.name} · ${k.title}` } : k))), ...B.seis.out.kv],
    tables: [...(bankOut ? bankOut.tables : []), ...pts.flatMap((x) => x.out.tables.map((t) => (multi ? { ...t, title: `${x.so.name} · ${t.title}` } : t))), ...B.seis.out.tables, sum, ...B.settle.out.tables],
    steps: [...pts.flatMap((x) => x.out.steps.map((t) => (multi ? { ...t, h: `${x.so.name} · ${t.h}` } : t))), ...B.seis.out.steps, ...mods.flatMap(({ out }) => out.steps || [])],
    notes: [L("Laporan ini disusun otomatis dari data proyek (tab Tanah, Gempa, Desain, Penurunan) pada saat ekspor. Verifikasi oleh engineer yang berwenang tetap diperlukan.", "This report is compiled automatically from the project data (Soil, Seismic, Design, Settlement tabs) at export time. Verification by a responsible engineer is still required.")],
    drawings: [], chapters, combos: [], cases: {}, ok, g,
  }
}
