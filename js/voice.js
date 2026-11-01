// Narasi suara offline memakai Web Speech API (suara bawaan iPad/perangkat, tanpa internet).
// Indonesia → suara WANITA (mis. Damayanti di iPad), Inggris → suara PRIA (mis. Daniel/Aaron/Arthur di iPad).
// Teks dipecah per kalimat dan diucapkan berurutan: jeda = berhenti di kalimat aktif, lanjut = mulai lagi dari kalimat itu
// (lebih andal di Safari iOS daripada pause()/resume() bawaan).
const FEMALE_ID = ["damayanti", "gadis", "ayu", "google bahasa indonesia", "female", "wanita", "perempuan"]
const MALE_ID = ["andika", "ardi", "male", "pria"]
const MALE_EN = ["daniel", "aaron", "arthur", "fred", "alex", "rishi", "gordon", "oliver", "tom", "evan", "nathan", "reed", "ralph", "eddy", "rocko",
  "google uk english male", "microsoft guy", "microsoft david", "microsoft mark", "microsoft andrew", "microsoft brian", "microsoft christopher", "microsoft eric", "microsoft ryan", "male"]
const FEMALE_EN = ["samantha", "karen", "moira", "tessa", "victoria", "susan", "zira", "aria", "jenny", "female", "kate", "serena", "allison", "ava", "nicky", "martha", "catherine"]
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
// pilih suara: Indonesia wanita, Inggris pria; pilihan pengguna diutamakan bila masih tersedia
export function pickVoice(lang) {
  const all = voices(), pref = store.get()[lang]
  const ofLang = all.filter((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(lang === "id" ? "id" : "en"))
  if (pref) { const p = ofLang.find((v) => v.voiceURI === pref || v.name === pref); if (p) return { v: p, gendered: true } }
  if (lang === "id") {
    const f = ofLang.find((v) => has(v.name, FEMALE_ID)) || ofLang.find((v) => !has(v.name, MALE_ID))
    return { v: f || ofLang[0] || null, gendered: !!f }
  }
  const order = (v) => ((v.lang || "").startsWith("en-GB") ? 0 : (v.lang || "").startsWith("en-US") ? 1 : 2)
  const males = ofLang.filter((v) => has(v.name, MALE_EN) && !has(v.name, FEMALE_EN)).sort((a, b) => order(a) - order(b) || (b.localService ? 1 : 0) - (a.localService ? 1 : 0))
  return { v: males[0] || ofLang.find((v) => !has(v.name, FEMALE_EN)) || ofLang[0] || null, gendered: !!males[0] }
}
export function langVoices(lang) { return voices().filter((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(lang === "id" ? "id" : "en")) }
export function setPreferred(lang, voiceURI) { const s = store.get(); s[lang] = voiceURI; store.set(s) }
export const rateGet = () => store.get().rate || 1
export const rateSet = (r) => { const s = store.get(); s.rate = r; store.set(s) }

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

// Pemutar: segs = [{ text, node? }]; status: idle | playing | paused
export function createPlayer(lang, hooks = {}) {
  const P = { state: "idle", i: 0, segs: [], lang, token: 0 }
  const emit = () => hooks.onState && hooks.onState(P.state, P.i, P.segs.length)
  const mark = (on) => { const s = P.segs[P.i]; if (s && s.node) s.node.classList.toggle("say", on) }
  function speakFrom(i) {
    if (!supported()) return
    const my = ++P.token
    speechSynthesis.cancel()
    P.segs.forEach((s) => s.node && s.node.classList.remove("say"))
    P.i = i
    if (i >= P.segs.length) { P.state = "idle"; P.i = 0; emit(); if (hooks.onEnd) hooks.onEnd(); return }
    const { v, gendered } = pickVoice(P.lang)
    const u = new SpeechSynthesisUtterance(P.segs[i].text)
    u.lang = v ? v.lang : (P.lang === "id" ? "id-ID" : "en-GB")
    if (v) u.voice = v
    u.rate = rateGet()
    // tanpa suara bergender yang cocok: atur nada (pria lebih rendah, wanita lebih tinggi)
    u.pitch = gendered ? 1 : (P.lang === "id" ? 1.15 : 0.8)
    u.onstart = () => { if (my === P.token) mark(true) }
    u.onend = () => { if (my !== P.token || P.state !== "playing") return; mark(false); speakFrom(P.i + 1) }
    u.onerror = (e) => { if (my !== P.token) return; if (e && (e.error === "interrupted" || e.error === "canceled")) return; mark(false); P.state = "idle"; emit() }
    P.state = "playing"; emit()
    speechSynthesis.speak(u)
  }
  return {
    get state() { return P.state },
    load(segs) { this.stop(); P.segs = segs; P.i = 0 },
    play() { if (!P.segs.length) return; speakFrom(P.state === "paused" ? P.i : 0) },
    pause() { if (P.state !== "playing") return; P.token++; speechSynthesis.cancel(); mark(false); P.state = "paused"; emit() },
    toggle() { if (P.state === "playing") this.pause(); else this.play() },
    stop() { P.token++; if (supported()) speechSynthesis.cancel(); P.segs.forEach((s) => s.node && s.node.classList.remove("say")); P.state = "idle"; P.i = 0; emit() },
    setLang(l) { P.lang = l },
  }
}
