// Narasi suara Alur Migas.
// 1) Rekaman alami (opsional): MP3 per kalimat di assets/voice/<lang>/<hash>.mp3 + assets/voice/manifest.json,
//    dibuat sekali oleh tools/tts_elevenlabs.mjs (ElevenLabs) lalu disimpan untuk offline.
// 2) Cadangan: Web Speech API (suara bawaan perangkat, tanpa internet). Dipilih suara berkualitas tertinggi
//    (Premium/Enhanced di iPad, "Natural"/"Neural" di Edge/Windows), suara robotik/novelty dihindari.
// Indonesia → suara WANITA, Inggris → suara PRIA. Teks dipecah per kalimat dan dibacakan berurutan:
// jeda = berhenti di kalimat aktif, lanjut = mulai lagi dari kalimat itu (lebih andal di Safari iOS daripada pause()/resume()).
const FEMALE_ID = ["damayanti", "gadis", "ayu", "google bahasa indonesia", "female", "wanita", "perempuan"]
const MALE_ID = ["andika", "ardi", "male", "pria"]
const MALE_EN = ["daniel", "aaron", "arthur", "gordon", "oliver", "rishi", "tom", "evan", "nathan", "alex", "james", "jamie", "malcolm", "stephen",
  "google uk english male", "microsoft guy", "microsoft david", "microsoft mark", "microsoft andrew", "microsoft brian", "microsoft christopher", "microsoft eric", "microsoft ryan", "microsoft thomas", "microsoft william", "male"]
const FEMALE_EN = ["samantha", "karen", "moira", "tessa", "victoria", "susan", "zira", "aria", "jenny", "female", "kate", "serena", "allison", "ava", "nicky", "martha", "catherine", "zoe", "sonia", "libby", "emma", "michelle", "natasha", "fiona", "veena"]
// suara novelty macOS/iOS dan Eloquence (Eddy, Flo, Reed, Rocko, ...) terdengar sangat "mesin": hanya dipakai bila tidak ada pilihan lain
const ROBOTIC = ["albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "good news", "jester", "organ", "superstar", "trinoids", "whisper", "wobble", "zarvox",
  "junior", "ralph", "fred", "kathy", "princess", "deranged", "hysterical", "eddy", "flo", "grandma", "grandpa", "reed", "rocko", "sandy", "shelley", "eloquence"]
const KEY = "ymd.voice"

export const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") } catch (e) { return {} } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch (e) { /* abaikan */ } } }

let voicesCache = []
export function voices() {
  if (!supported()) return []
  const v = speechSynthesis.getVoices()
  if (v && v.length) voicesCache = v
  return voicesCache
}
export function onVoices(fn) {
  if (!supported()) return
  if (voices().length) fn()
  speechSynthesis.addEventListener ? speechSynthesis.addEventListener("voiceschanged", fn) : (speechSynthesis.onvoiceschanged = fn)
}
const has = (name, list) => list.some((k) => name.toLowerCase().includes(k))
const isLang = (v, lang) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(lang === "id" ? "id" : "en")
// kualitas suara dari nama/URI: Premium > Natural/Neural > Enhanced > biasa; robotik sangat dihukum
export function quality(v) {
  const s = `${v.name} ${v.voiceURI}`.toLowerCase()
  let q = 0
  if (s.includes("premium")) q += 40
  if (s.includes("natural") || s.includes("neural")) q += 35
  if (s.includes("enhanced") || s.includes("siri")) q += 25
  if (s.includes("google")) q += 8
  if (s.includes("compact")) q -= 5
  if (has(v.name, ROBOTIC) || s.includes("eloquence")) q -= 100
  return q
}
export const qualityTag = (v) => { const q = quality(v); return q >= 35 ? "★★★" : q >= 20 ? "★★" : q > -50 ? "" : "⚠" }
// pilih suara: Indonesia wanita, Inggris pria; pilihan pengguna diutamakan bila masih tersedia
export function pickVoice(lang) {
  const all = voices(), pref = store.get()[lang]
  const ofLang = all.filter((v) => isLang(v, lang))
  if (pref) { const p = ofLang.find((v) => v.voiceURI === pref || v.name === pref); if (p) return { v: p, gendered: true } }
  const best = (arr, order = () => 0) => arr.slice().sort((a, b) => quality(b) - quality(a) || order(a) - order(b) || (b.localService ? 1 : 0) - (a.localService ? 1 : 0))[0]
  if (lang === "id") {
    const f = best(ofLang.filter((v) => has(v.name, FEMALE_ID))) || best(ofLang.filter((v) => !has(v.name, MALE_ID)))
    return { v: f || best(ofLang) || null, gendered: !!(f && has(f.name, FEMALE_ID)) }
  }
  const order = (v) => ((v.lang || "").startsWith("en-GB") ? 0 : (v.lang || "").startsWith("en-US") ? 1 : 2)
  const males = ofLang.filter((v) => has(v.name, MALE_EN) && !has(v.name, FEMALE_EN) && quality(v) > -50)
  const m = best(males, order)
  return { v: m || best(ofLang.filter((v) => !has(v.name, FEMALE_EN)), order) || best(ofLang, order) || null, gendered: !!m }
}
export function langVoices(lang) { return voices().filter((v) => isLang(v, lang)).sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name)) }
export function setPreferred(lang, voiceURI) { const s = store.get(); s[lang] = voiceURI; store.set(s) }
export const rateGet = () => store.get().rate || 1
export const rateSet = (r) => { const s = store.get(); s.rate = r; store.set(s) }
// sumber suara: "rec" = rekaman alami (bila tersedia), "dev" = suara perangkat
export const srcGet = () => store.get().src || "rec"
export const srcSet = (v) => { const s = store.get(); s.src = v; store.set(s) }

// pecah teks menjadi kalimat (tetap mempertahankan singkatan angka seperti 0,5 atau 1.5)
// (tanpa lookbehind regex supaya jalan di Safari iOS lama)
export function sentences(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim(), out = []
  let cur = ""
  for (let i = 0; i < t.length; i++) {
    cur += t[i]
    if (/[.!?;:]/.test(t[i]) && t[i + 1] === " " && /[A-ZÀ-Ý0-9"“(]/.test(t[i + 2] || "")) { out.push(cur.trim()); cur = "" }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
// teks yang dibacakan untuk satu tahap Alur Migas (dipakai juga oleh tools/tts_elevenlabs.mjs supaya hash sama persis)
export function stageTexts(s) {
  return [`${s.name}. ${s.fn}`, ...sentences(s.story), ...(s.steps || []).map((t, k) => `${k + 1}. ${t}`)]
}
// hash teks (FNV-1a 32-bit, heksadesimal 8 karakter) → nama berkas rekaman
export function hashText(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  let h = 0x811c9dc5
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, "0")
}

// ---------------------------------------------------------------- rekaman alami (ElevenLabs, opsional)
export const VOICE_DIR = "assets/voice/"
let REC = null, recP = null
export function recLoad() {
  if (recP) return recP
  if (typeof fetch === "undefined") return (recP = Promise.resolve(null))
  recP = fetch(VOICE_DIR + "manifest.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((m) => {
    if (m && m.files) { REC = { ...m, set: {} }; Object.entries(m.files).forEach(([l, arr]) => { REC.set[l] = new Set(arr) }) }
    return REC
  }).catch(() => null)
  return recP
}
export const recInfo = () => REC
export const recCount = (lang) => (REC && REC.set[lang] ? REC.set[lang].size : 0)
export function recUrl(lang, text) {
  if (!REC || srcGet() === "dev" || !REC.set[lang]) return null
  const h = hashText(text)
  return REC.set[lang].has(h) ? `${VOICE_DIR}${lang}/${h}.mp3` : null
}
// unduh semua rekaman satu bahasa supaya tersimpan untuk offline (service worker menyimpannya di cache "ymd-voice")
export async function recDownload(lang, onProg) {
  await recLoad()
  if (!REC || !REC.set[lang]) return { ok: 0, fail: 0, n: 0 }
  const list = [...REC.set[lang]].map((h) => `${VOICE_DIR}${lang}/${h}.mp3`)
  let ok = 0, fail = 0, i = 0
  const worker = async () => { while (i < list.length) { const u = list[i++]; try { const r = await fetch(u); if (!r.ok) throw new Error(r.status); await r.arrayBuffer(); ok++ } catch (e) { fail++ } if (onProg) onProg(ok + fail, list.length) } }
  await Promise.all([worker(), worker(), worker(), worker()])
  return { ok, fail, n: list.length }
}
// MP3 diputar lewat blob: URL (tidak lewat service worker → tidak ada masalah permintaan Range di Safari)
const blobs = new Map(), ready = new Map()
function blobUrl(url) {
  if (!blobs.has(url)) {
    blobs.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob() }).then((b) => { const u = URL.createObjectURL(b); ready.set(url, u); return u }))
    if (blobs.size > 80) { const k = blobs.keys().next().value; const u = ready.get(k); if (u) URL.revokeObjectURL(u); blobs.delete(k); ready.delete(k) }
  }
  return blobs.get(url)
}
const prefetch = (url) => { if (url) blobUrl(url).catch(() => { blobs.delete(url) }) }
// satu elemen audio untuk semua kalimat: setelah sekali diputar lewat sentuhan, iOS mengizinkan kalimat berikutnya diputar otomatis
let audio = null
const SILENT = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=="
const A = () => audio || (audio = typeof Audio !== "undefined" ? new Audio() : null)

// Pemutar: segs = [{ text, node? }]; status: idle | playing | paused
export function createPlayer(lang, hooks = {}) {
  const P = { state: "idle", i: 0, segs: [], lang, token: 0, mode: null }
  const emit = () => hooks.onState && hooks.onState(P.state, P.i, P.segs.length, P.mode)
  const mark = (on) => { const s = P.segs[P.i]; if (s && s.node) s.node.classList.toggle("say", on) }
  const halt = () => { if (supported()) speechSynthesis.cancel(); const a = audio; if (a && !a.paused) a.pause() }
  recLoad()
  function next(my) { if (my !== P.token || P.state !== "playing") return; mark(false); speakFrom(P.i + 1) }
  function speakTTS(i, my) {
    if (!supported()) { P.state = "idle"; emit(); return }
    P.mode = "dev"
    const { v, gendered } = pickVoice(P.lang)
    const u = new SpeechSynthesisUtterance(P.segs[i].text)
    u.lang = v ? v.lang : (P.lang === "id" ? "id-ID" : "en-GB")
    if (v) u.voice = v
    u.rate = rateGet()
    // tanpa suara bergender yang cocok: atur nada (pria lebih rendah, wanita lebih tinggi)
    u.pitch = gendered ? 1 : (P.lang === "id" ? 1.1 : 0.85)
    u.onstart = () => { if (my === P.token) mark(true) }
    u.onend = () => next(my)
    u.onerror = (e) => { if (my !== P.token) return; if (e && (e.error === "interrupted" || e.error === "canceled")) return; mark(false); P.state = "idle"; emit() }
    P.state = "playing"; emit()
    speechSynthesis.speak(u)
  }
  function playRec(i, my, url, resume) {
    const a = A()
    P.mode = "rec"; P.state = "playing"; mark(true); emit()
    const start = (src) => {
      if (my !== P.token) return
      if (a.dataset.k !== url) { a.src = src; a.dataset.k = url } else if (!resume) a.currentTime = 0
      a.playbackRate = rateGet()
      try { a.preservesPitch = true } catch (e) { /* lama */ }
      a.onended = () => next(my)
      a.onerror = () => { if (my === P.token) { a.dataset.k = ""; speakTTS(i, my) } }
      const pr = a.play()
      if (pr && pr.catch) pr.catch((e) => { if (my !== P.token) return; if (e && e.name === "NotAllowedError") { mark(false); P.state = "paused"; emit() } else { a.dataset.k = ""; speakTTS(i, my) } })
    }
    const got = ready.get(url)
    if (got) start(got)
    else {
      // masih diunduh: "buka kunci" audio dalam sentuhan pengguna dengan klip senyap, lalu putar begitu siap
      try { a.src = SILENT; a.dataset.k = ""; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}) } catch (e) { /* abaikan */ }
      blobUrl(url).then(start).catch(() => { blobs.delete(url); if (my === P.token) speakTTS(i, my) })
    }
    // siapkan dua kalimat berikutnya
    for (let k = 1; k <= 2; k++) { const s = P.segs[i + k]; if (s) prefetch(recUrl(P.lang, s.text)) }
  }
  function speakFrom(i, resume) {
    const my = ++P.token
    halt()
    P.segs.forEach((s) => s.node && s.node.classList.remove("say"))
    P.i = i
    if (i >= P.segs.length) { P.state = "idle"; P.i = 0; emit(); if (hooks.onEnd) hooks.onEnd(); return }
    const url = recUrl(P.lang, P.segs[i].text)
    if (url && A()) playRec(i, my, url, resume)
    else speakTTS(i, my)
  }
  return {
    get state() { return P.state },
    get mode() { return P.mode },
    load(segs) {
      this.stop(); P.segs = segs; P.i = 0
      // unduh kalimat pertama lebih awal supaya tombol Putar langsung bersuara
      recLoad().then(() => { if (P.segs === segs) segs.slice(0, 2).forEach((s) => prefetch(recUrl(P.lang, s.text))) })
    },
    play() { if (!P.segs.length) return; const res = P.state === "paused"; speakFrom(res ? P.i : 0, res) },
    pause() { if (P.state !== "playing") return; P.token++; halt(); mark(false); P.state = "paused"; emit() },
    toggle() { if (P.state === "playing") this.pause(); else this.play() },
    stop() { P.token++; halt(); P.segs.forEach((s) => s.node && s.node.classList.remove("say")); P.state = "idle"; P.i = 0; emit() },
    setLang(l) { P.lang = l },
  }
}
