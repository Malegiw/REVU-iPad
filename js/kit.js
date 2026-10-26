// Perangkat tampilan bersama untuk halaman alat (dipakai fondasi_ui.js dan alat berikutnya). Sengaja tanpa teks sendiri: semua label diberikan pemanggil,
// supaya ipad_build.py menemukan teks terjemahannya di js/<alat>_ui.js. (penurunan_ui.js masih memakai salinannya sendiri.)

export const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const svgNS = "http://www.w3.org/2000/svg"
export const sv = (tag, attrs, txt) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e }
export const parseNum = (s) => { const v = parseFloat(String(s).trim().replace(",", ".")); return isFinite(v) ? v : NaN }

const EMO = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u
export function withEmoji(node, txt) {                       // glyph emoji menjorok melewati lebarnya; beri jarak lewat span
  const m = String(txt).match(EMO)
  if (!m) { node.textContent = txt; return node }
  const e = document.createElement("span"); e.className = "emo"; e.textContent = m[1]
  node.append(e, document.createTextNode(m[2]))
  return node
}

export function table(cols, rows) {
  const tb = el("table"), hr = el("tr")
  cols.forEach((c) => hr.append(el("th", null, c)))
  tb.append(hr)
  rows.forEach((r) => { const tr = el("tr"); r.forEach((c) => tr.append(withEmoji(el("td"), c == null ? "" : String(c)))); tb.append(tr) })
  const w = el("div", "tw"); w.append(tb); return w
}

export const metric = (lab, val, tip) => { const c = el("div", "metric"); if (tip) c.title = tip; c.append(el("div", "ml", lab), el("div", "mv", val)); return c }

export function mdToDom(md) {
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

export const bold = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")

export function download(name, text, mime) {
  const a = el("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}

// Tabel markdown dari kepala kolom dan baris
export const mdTable = (cols, rows) => ["| " + cols.join(" | ") + " |", "|" + "---|".repeat(cols.length), ...rows.map((r) => "| " + r.map((v) => (v == null ? "" : String(v))).join(" | ") + " |")]

// CSV (pemisah koma, BOM supaya Excel membaca UTF-8): blocks = [[judul, [[sel, ...], ...]], ...]
export function toCsv(blocks) {
  const q = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return "﻿" + blocks.map(([h, rows]) => [q(h), ...rows.map((r) => r.map(q).join(","))].join("\n")).join("\n\n") + "\n"
}

// Pembuat kolom masukan. t = fungsi terjemah, after(structural) dipanggil setelah nilai berubah: structural = bentuk formulir perlu digambar ulang.
export function makeKit(t, after) {
  const T = (s, ...a) => { let i = 0; return t(s).replace(/\{\}/g, () => (a[i] === undefined ? "{}" : a[i++])) }
  const row = () => el("div", "grid")
  const prop = (o, k) => [() => o[k], (v) => { o[k] = v }]

  // o: lo, hi (batas, nilai dijepit), help (teks bantuan), disabled, struct (true, atau fungsi (lama, baru) → gambar ulang formulir bila berubah)
  function numField(parent, label, o, getSet) {
    const w = el("label", "fld" + (o.disabled ? " dis" : ""))
    w.append(el("span", "lb", label))
    const inp = el("input"); inp.type = "text"; inp.inputMode = o.lo < 0 ? "text" : "decimal"; inp.autocomplete = "off"; inp.disabled = !!o.disabled
    const [get, set] = getSet
    let committed = get()
    inp.value = String(committed)
    inp.addEventListener("input", () => {
      const v = parseNum(inp.value); const okv = !isNaN(v) && v >= o.lo && v <= o.hi
      inp.classList.toggle("bad", !okv)
      if (okv) { set(v); after(false) }                  // bentuk formulir baru digambar ulang saat selesai mengetik, supaya kursor tidak hilang
    })
    inp.addEventListener("change", () => {
      let v = parseNum(inp.value)
      if (isNaN(v)) v = get()
      v = Math.min(o.hi, Math.max(o.lo, v)); inp.value = String(v); inp.classList.remove("bad")
      const was = committed; set(v); committed = v
      after(!!o.struct && (o.struct === true || o.struct(was, v)))
    })
    w.append(inp)
    if (o.help) { w.title = t(o.help); w.append(el("span", "hp", t(o.help))) } else w.append(el("span", "rg", `${rangeText(o.lo)} – ${rangeText(o.hi)}`))
    parent.append(w)
    return inp
  }
  const rangeText = (x) => (Math.abs(x) >= 1e6 ? x.toExponential(0).replace("e+", "e") : String(x))

  function textField(parent, label, cur, onSet) {
    const w = el("label", "fld"); w.append(el("span", "lb", label))
    const i = el("input"); i.type = "text"; i.value = cur; i.oninput = () => onSet(i.value)
    w.append(i); parent.append(w)
    return i
  }
  function selField(parent, label, opts, cur, onSet) {
    const w = el("label", "fld"); w.append(el("span", "lb", label))
    const s = el("select")
    Object.entries(opts).forEach(([k, v]) => { const op = el("option", null, t(v)); op.value = k; if (k === cur) op.selected = true; s.append(op) })
    s.onchange = () => { onSet(s.value); after(true) }
    w.append(s); parent.append(w)
    return s
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
  // pilihan ganda: opts = [[nilai, teks], ...], cur = larik nilai terpilih
  function chipsField(parent, label, opts, cur, onSet) {
    const w = el("div", "fld"); w.append(el("span", "lb", label))
    const g = el("div", "seg")
    opts.forEach(([v, txt]) => {
      const b = el("button", "segb" + (cur.includes(v) ? " on" : ""), txt); b.type = "button"; b.setAttribute("aria-pressed", cur.includes(v))
      b.onclick = () => { onSet(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort((a, b2) => a - b2)); after(true) }
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
  return { T, row, prop, numField, textField, selField, radioField, chipsField, checkField }
}
