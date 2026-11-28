// Simpan perhitungan: salinan bernama dari seluruh pekerjaan (data proyek "ymd.project.v1" + masukan Desain "ymd.desain.v1"),
// daftar simpanan (buka / unduh / hapus), cadangan otomatis sebelum membuka simpanan lain, serta unduh/buka file .json untuk pindah perangkat.
// Masukan tetap tersimpan otomatis di iPad (localStorage) setiap kali diubah; simpanan bernama adalah titik pulih yang bisa dibuka lagi kapan saja.
import { L, stamp } from "./desain/core.js"
import { el } from "./desain/ui.js"
import { ico } from "./icons.js"

const KEY = "ymd.saved.v1", CUR = "ymd.saved.cur", AUTO = "ymd.saved.auto"
const KP = "ymd.project.v1", KD = "ymd.desain.v1"
const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null") } catch (e) { return null } }
const put = (k, v) => { localStorage.setItem(k, JSON.stringify(v)) }           // dapat melempar QuotaExceededError
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export const isSnap = (o) => !!(o && typeof o === "object" && o.P && typeof o.P === "object" && o.S && typeof o.S === "object")

export const saveList = () => { const a = get(KEY); return Array.isArray(a) ? a.filter(isSnap) : [] }
export const curId = () => { try { return localStorage.getItem(CUR) || "" } catch (e) { return "" } }
const setCur = (id) => { try { if (id) localStorage.setItem(CUR, id); else localStorage.removeItem(CUR) } catch (e) { /* tanpa penyimpanan */ } }
export const curSave = () => saveList().find((x) => x.id === curId()) || null
export const autoBackup = () => { const a = get(AUTO); return isSnap(a) ? a : null }

// simpan (baru atau timpa entri dengan nama sama); snap = { P, S } → mengembalikan entri
export function saveNow(name, mod, snap) {
  const nm = String(name || "").trim() || L("Tanpa nama", "Untitled")
  const list = saveList(), ix = list.findIndex((x) => x.name.toLowerCase() === nm.toLowerCase())
  const e = { id: ix >= 0 ? list[ix].id : uid(), name: nm, mod: mod || "", ts: Date.now(), proj: (snap.P.info && snap.P.info.name) || "", P: JSON.parse(JSON.stringify(snap.P)), S: JSON.parse(JSON.stringify(snap.S)) }
  if (ix >= 0) list.splice(ix, 1)
  list.unshift(e)
  put(KEY, list)
  setCur(e.id)
  return e
}
export function delSave(id) {
  put(KEY, saveList().filter((x) => x.id !== id))
  if (curId() === id) setCur("")
}
// muat simpanan menjadi data kerja (cadangan otomatis dulu); snapNow = isi saat ini untuk cadangan
export function openSave(e, snapNow) {
  if (snapNow) { try { put(AUTO, { id: "auto", name: L("Cadangan otomatis", "Automatic backup"), mod: e.mod || "", ts: Date.now(), before: e.name, proj: (snapNow.P.info && snapNow.P.info.name) || "", P: snapNow.P, S: snapNow.S }) } catch (x) { /* cadangan gagal: tetap buka */ } }
  put(KP, e.P); put(KD, e.S)
  setCur(e.id === "auto" ? "" : e.id)
}
// isi file unduhan
export const fileOf = (e) => JSON.stringify({ app: "YMD-CAL", kind: "save", v: 1, name: e.name, mod: e.mod, ts: e.ts, proj: e.proj, P: e.P, S: e.S }, null, 1)
export const fileName = (e) => {
  const d = new Date(e.ts || Date.now()), p = (x) => String(x).padStart(2, "0")
  return `YMD-CAL_${(e.name || "simpanan").replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "simpanan"}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}
// baca file .json: satu simpanan YMD-CAL (atau cadangan mentah { P, S }) → entri baru di daftar
export function importText(txt, fallbackName) {
  let o
  try { o = JSON.parse(txt) } catch (e) { throw new Error(L("File bukan JSON yang valid.", "The file is not valid JSON.")) }
  if (!isSnap(o)) throw new Error(L("File ini bukan simpanan YMD-CAL (tidak ada data proyek & desain).", "This file is not a YMD-CAL save (no project & design data)."))
  const list = saveList()
  let nm = String(o.name || fallbackName || L("Impor", "Imported")).trim()
  if (list.some((x) => x.name.toLowerCase() === nm.toLowerCase())) nm += " " + L("(impor)", "(imported)")
  const e = { id: uid(), name: nm, mod: typeof o.mod === "string" ? o.mod : "", ts: typeof o.ts === "number" ? o.ts : Date.now(), proj: (o.P.info && o.P.info.name) || "", P: o.P, S: o.S }
  list.unshift(e)
  put(KEY, list)
  return e
}
const dl = (name, text) => {
  const a = el("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500)
}
const when = (ts) => stamp(new Date(ts))
const quota = (e) => /quota|exceed/i.test((e && (e.name + " " + e.message)) || "")

// ---------------------------------------------------------------- antarmuka
// o: { mod, modTitle(id, entri) → judul, defName() → nama awal, snap() → { P, S } data kerja saat ini, onOpen(entry) }
export function saveButton(o) {
  const b = el("button", "dz-save"); b.type = "button"
  const ic = el("span", "dz-save-ic"); ic.append(ico("save"))
  const tx = el("span", "dz-save-tx"), t1 = el("b", null, L("Simpan", "Save")), t2 = el("small")
  tx.append(t1, t2); b.append(ic, tx)
  const sub = () => { const c = curSave(); t2.textContent = c ? `${c.name} · ${when(c.ts).slice(0, 10)}` : L("simpan otomatis aktif", "autosave on") }
  sub()
  b.onclick = () => openPanel({ ...o, after: sub })
  b.setAttribute("aria-label", L("Simpan perhitungan", "Save calculation"))
  return b
}
export function openPanel(o) {
  const prevFocus = document.activeElement
  const sh = el("div", "rt-sheet sv-sheet"), pan = el("div", "rt-pan sm sv-pan")
  pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.tabIndex = -1
  const close = () => { sh.remove(); document.documentElement.classList.remove("rt-lock"); removeEventListener("keydown", onKey); if (o.after) o.after(); if (prevFocus && prevFocus.focus) prevFocus.focus() }
  const onKey = (e) => { if (e.key === "Escape") close() }
  addEventListener("keydown", onKey)
  sh.onclick = (e) => { if (e.target === sh) close() }
  const h = el("div", "rt-pan-h"), hx = el("div")
  hx.append(el("b", null, L("Simpan perhitungan", "Save calculation")), el("small", null, L("Salinan bernama berisi data proyek (tanah, gempa, kode) dan semua masukan Desain.", "A named copy holding the project data (soil, seismic, codes) and all Design inputs.")))
  const x = el("button", "rt-x"); x.type = "button"; x.append(ico("close")); x.setAttribute("aria-label", L("Tutup", "Close")); x.onclick = close
  h.append(hx, x)
  const body = el("div", "rt-pan-b plain sv-body")
  pan.append(h, body)
  sh.append(pan)
  document.body.append(sh); document.documentElement.classList.add("rt-lock")
  const msg = el("p", "sv-msg"); msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite")
  const say = (t, bad) => { msg.textContent = t; msg.className = "sv-msg" + (bad ? " bad" : " ok") }

  function draw() {
    body.textContent = ""
    body.append(el("p", "rt-tip", L("Masukan selalu tersimpan otomatis di iPad ini. Tekan Simpan untuk membuat salinan bernama (mis. “GB-01 Gas Boot”) yang bisa dibuka lagi, atau unduh file .json sebagai cadangan / untuk dipindah ke perangkat lain.",
      "Inputs are always saved automatically on this iPad. Press Save to make a named copy (e.g. “GB-01 Gas Boot”) you can open again, or download a .json file as a backup / to move to another device.")))
    const cur = curSave()
    // nama + simpan
    const row = el("div", "rt-man sv-row")
    const inp = el("input"); inp.type = "text"; inp.value = cur ? cur.name : o.defName(); inp.setAttribute("aria-label", L("Nama simpanan", "Save name")); inp.maxLength = 80
    const sb = el("button", "dz-save on"); sb.type = "button"
    const sbi = el("span", "dz-save-ic"); sbi.append(ico("save")); sb.append(sbi, el("b", null, L("Simpan", "Save")))
    let armed = ""
    const doSave = () => {
      const nm = inp.value.trim() || o.defName()
      const ex = saveList().find((q) => q.name.toLowerCase() === nm.toLowerCase())
      if (ex && (!cur || ex.id !== cur.id) && armed !== nm.toLowerCase()) { armed = nm.toLowerCase(); sb.lastChild.textContent = L("Timpa?", "Overwrite?"); say(L(`“${ex.name}” sudah ada — ketuk lagi untuk menimpa, atau ganti nama.`, `“${ex.name}” already exists — tap again to overwrite, or change the name.`)); return }
      try {
        const e = saveNow(nm, o.mod, o.snap())
        draw(); say(L(`✓ Tersimpan: “${e.name}” · ${when(e.ts)}`, `✓ Saved: “${e.name}” · ${when(e.ts)}`))
      } catch (e) { say(quota(e) ? L("Penyimpanan iPad penuh — hapus simpanan lama atau unduh file lalu hapus.", "iPad storage is full — delete old saves or download them as files and delete.") : L("Gagal menyimpan: ", "Save failed: ") + e.message, true) }
    }
    inp.addEventListener("input", () => { armed = ""; sb.lastChild.textContent = L("Simpan", "Save") })
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSave() } })
    sb.onclick = doSave
    row.append(inp, sb)
    body.append(el("div", "rt-sub", cur ? L(`Sedang dibuka: “${cur.name}” · disimpan ${when(cur.ts)}`, `Currently open: “${cur.name}” · saved ${when(cur.ts)}`) : L("Nama simpanan", "Save name")), row, msg)
    // file
    const fr = el("div", "sv-files")
    const mk = (icn, b1, s1, fn) => { const bt = el("button", "dz-btn sv-fbtn"); bt.type = "button"; const w = el("span", "ic"); w.append(ico(icn)); const t = el("span"); t.append(el("b", null, b1), el("small", null, s1)); bt.append(w, t); bt.onclick = fn; return bt }
    const fin = el("input"); fin.type = "file"; fin.accept = ".json,application/json"; fin.hidden = true
    fin.onchange = () => {
      const f = fin.files && fin.files[0]; if (!f) return
      const rd = new FileReader()
      rd.onload = () => { try { const e = importText(String(rd.result), f.name.replace(/\.json$/i, "")); draw(); say(L(`✓ Diimpor: “${e.name}” — ketuk Buka untuk memuatnya.`, `✓ Imported: “${e.name}” — tap Open to load it.`)) } catch (e) { say(quota(e) ? L("Penyimpanan iPad penuh.", "iPad storage is full.") : e.message, true) } }
      rd.onerror = () => say(L("File tidak dapat dibaca.", "The file could not be read."), true)
      rd.readAsText(f)
    }
    fr.append(mk("download", L("Unduh file (.json)", "Download file (.json)"), L("pekerjaan saat ini → Files / AirDrop / email", "current work → Files / AirDrop / email"), () => {
      const s = o.snap(), nm = inp.value.trim() || o.defName(), e = { name: nm, mod: o.mod, ts: Date.now(), proj: (s.P.info && s.P.info.name) || "", P: s.P, S: s.S }
      dl(fileName(e), fileOf(e)); say(L(`✓ File diunduh: ${fileName(e)}`, `✓ File downloaded: ${fileName(e)}`))
    }), mk("upload", L("Buka file…", "Open file…"), L("muat simpanan .json dari perangkat lain", "load a .json save from another device"), () => fin.click()), fin)
    body.append(fr)
    // daftar
    const list = saveList(), ab = autoBackup()
    body.append(el("div", "rt-sub", `${L("Daftar simpanan", "Saved calculations")} (${list.length})`))
    if (!list.length && !ab) body.append(el("p", "dz-note", L("Belum ada simpanan. Ketik nama lalu tekan Simpan.", "No saves yet. Type a name and press Save.")))
    const ul = el("ul", "sv-list")
    const item = (e, auto) => {
      const li = el("li", "sv-item" + (e.id === curId() ? " on" : "") + (auto ? " auto" : ""))
      const tx = el("div", "sv-tx")
      tx.append(el("b", null, e.name), el("small", null, [o.modTitle(e.mod, e), e.proj, when(e.ts)].filter(Boolean).join(" · ") + (auto && e.before ? ` · ${L("sebelum membuka", "before opening")} “${e.before}”` : "")))
      const acts = el("div", "sv-acts")
      const btn = (cls, icn, lab, fn) => { const bt = el("button", "sv-b " + cls); bt.type = "button"; bt.append(ico(icn), el("span", null, lab)); bt.onclick = () => fn(bt); return bt }
      let armO = false, armD = false
      acts.append(btn("open", "open", L("Buka", "Open"), (bt) => {
        if (!armO) { armO = true; bt.classList.add("arm"); bt.lastChild.textContent = L("Ganti data?", "Replace data?"); say(L("Membuka akan mengganti data proyek & masukan saat ini (disalin dulu ke Cadangan otomatis). Ketuk lagi untuk membuka.", "Opening replaces the current project data & inputs (copied to Automatic backup first). Tap again to open."), false); return }
        try { openSave(e, o.snap()); close(); o.onOpen(e) } catch (x) { say(quota(x) ? L("Penyimpanan iPad penuh.", "iPad storage is full.") : x.message, true) }
      }), btn("", "download", L("Unduh", "Download"), () => dl(fileName(e), fileOf(e))))
      if (!auto) acts.append(btn("del", "trash", L("Hapus", "Delete"), (bt) => {
        if (!armD) { armD = true; bt.classList.add("arm"); bt.lastChild.textContent = L("Yakin?", "Sure?"); return }
        delSave(e.id); draw(); say(L(`Dihapus: “${e.name}”`, `Deleted: “${e.name}”`))
      }))
      li.append(tx, acts)
      return li
    }
    list.forEach((e) => ul.append(item(e, false)))
    if (ab) ul.append(item(ab, true))
    if (list.length || ab) body.append(ul)
    return inp
  }
  const inp = draw()
  requestAnimationFrame(() => { pan.focus(); if (inp && matchMedia("(pointer: fine)").matches) inp.select() })
}
