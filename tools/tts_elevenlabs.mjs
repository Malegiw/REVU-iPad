#!/usr/bin/env node
// Membuat rekaman narasi alami Alur Migas dengan ElevenLabs (sekali saja; hasilnya disimpan di repo dan diputar offline).
//
//   ELEVENLABS_API_KEY=...  node tools/tts_elevenlabs.mjs            # buat rekaman yang belum ada (id + en)
//   node tools/tts_elevenlabs.mjs --dry-run                            # hitung kalimat & karakter (kuota), tanpa API
//   ELEVENLABS_API_KEY=...  node tools/tts_elevenlabs.mjs --list-voices
//   ... --lang id | --lang en | --force (buat ulang semua) | --prune (hapus MP3 yang tidak dipakai lagi)
//
// Variabel lingkungan:
//   ELEVENLABS_API_KEY       kunci API (wajib kecuali --dry-run). Jangan ditulis di kode/commit.
//   ELEVENLABS_VOICE_ID_ID   voice ID Bahasa Indonesia (WANITA). Disarankan pilih suara penutur asli Indonesia di Voice Library.
//   ELEVENLABS_VOICE_ID_EN   voice ID English (PRIA).
//   ELEVENLABS_MODEL         bawaan eleven_multilingual_v2 (mendukung Bahasa Indonesia).
//   ELEVENLABS_FORMAT        bawaan mp3_44100_64 (kecil, cukup jernih untuk suara).
//
// Hasil: assets/voice/<lang>/<hash>.mp3 per kalimat + assets/voice/manifest.json.
// Nama berkas = hashText(kalimat) dari js/voice.js, jadi kalimat yang diubah otomatis dibuat ulang dan aplikasi
// memakai suara perangkat untuk kalimat yang belum punya rekaman.
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const V = await import(pathToFileURL(path.join(ROOT, "js/voice.js")).href)
const OUT = path.join(ROOT, "assets/voice")
const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const API = "https://api.elevenlabs.io/v1"
const KEY = process.env.ELEVENLABS_API_KEY || ""
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2"
const FORMAT = process.env.ELEVENLABS_FORMAT || "mp3_44100_64"
// bawaan: suara premade ElevenLabs (ganti dengan suara pilihan Anda lewat variabel lingkungan)
const VOICE = {
  id: process.env.ELEVENLABS_VOICE_ID_ID || "EXAVITQu4vr4xnSDxMaL", // wanita (Sarah) — multibahasa; lebih natural bila memakai suara penutur asli Indonesia
  en: process.env.ELEVENLABS_VOICE_ID_EN || "JBFqnCBsd6RMkjVDRZzb", // pria (George) — narator Inggris, hangat
}
const SETTINGS = { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
const LANGS = opt("--lang") ? [opt("--lang")] : ["id", "en"]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function api(pathname, init = {}, tries = 5) {
  for (let k = 0; ; k++) {
    const r = await fetch(API + pathname, { ...init, headers: { "xi-api-key": KEY, ...(init.headers || {}) } })
    if (r.ok) return r
    const body = await r.text().catch(() => "")
    if ((r.status === 429 || r.status >= 500) && k < tries - 1) { const w = 2000 * 2 ** k; console.warn(`  ${r.status}, ulang dalam ${w / 1000} s`); await sleep(w); continue }
    throw new Error(`ElevenLabs ${r.status}: ${body.slice(0, 300)}`)
  }
}

// kumpulkan kalimat per bahasa (urutan tahap → kalimat; tetangga dipakai sebagai previous_text/next_text agar intonasi menyambung)
async function collect(lang) {
  const items = new Map()
  for (const theme of ["cloud", "dark"]) {
    const f = path.join(ROOT, `data/flow_${lang}_${theme}.json`)
    if (!existsSync(f)) continue
    const data = JSON.parse(await readFile(f, "utf8"))
    for (const s of data.stages) {
      const t = V.stageTexts(s)
      t.forEach((text, i) => { const h = V.hashText(text); if (!items.has(h)) items.set(h, { h, text, prev: t[i - 1] || "", next: t[i + 1] || "" }) })
    }
  }
  return [...items.values()]
}

async function tts(lang, it) {
  const body = { text: it.text, model_id: MODEL, voice_settings: SETTINGS }
  if (it.prev) body.previous_text = it.prev
  if (it.next) body.next_text = it.next
  if (/v2_5|v3/.test(MODEL)) body.language_code = lang
  const r = await api(`/text-to-speech/${VOICE[lang]}?output_format=${FORMAT}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify(body) })
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 500) throw new Error(`audio terlalu kecil (${buf.length} B) untuk: ${it.text.slice(0, 60)}`)
  await writeFile(path.join(OUT, lang, it.h + ".mp3"), buf)
  return buf.length
}

async function main() {
  if (flag("--list-voices")) {
    if (!KEY) throw new Error("ELEVENLABS_API_KEY belum diatur")
    const r = await (await api("/voices")).json()
    for (const v of r.voices || []) console.log(`${v.voice_id}  ${v.name}  [${Object.values(v.labels || {}).join(", ")}]`)
    return
  }
  const manFile = path.join(OUT, "manifest.json")
  const old = existsSync(manFile) ? JSON.parse(await readFile(manFile, "utf8")) : { files: {}, voices: {} }
  const man = { v: 1, generated: new Date().toISOString(), model: MODEL, format: FORMAT, provider: "ElevenLabs", voices: { ...(old.voices || {}) }, files: { ...(old.files || {}) }, chars: { ...(old.chars || {}) } }
  for (const lang of LANGS) {
    const items = await collect(lang), chars = items.reduce((a, b) => a + b.text.length, 0)
    await mkdir(path.join(OUT, lang), { recursive: true })
    const sameVoice = (old.voices || {})[lang] === VOICE[lang] && old.model === MODEL
    const todo = items.filter((it) => flag("--force") || !sameVoice || !existsSync(path.join(OUT, lang, it.h + ".mp3")))
    const todoChars = todo.reduce((a, b) => a + b.text.length, 0)
    console.log(`[${lang}] ${items.length} kalimat, ${chars} karakter; perlu dibuat ${todo.length} (${todoChars} karakter) · voice ${VOICE[lang]} · ${MODEL}`)
    if (flag("--dry-run")) continue
    if (!KEY) throw new Error("ELEVENLABS_API_KEY belum diatur (atau pakai --dry-run)")
    let done = 0, bytes = 0, i = 0
    const worker = async () => { while (i < todo.length) { const it = todo[i++]; bytes += await tts(lang, it); done++; if (done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`) } }
    await Promise.all([worker(), worker()])
    man.voices[lang] = VOICE[lang]
    man.files[lang] = items.map((it) => it.h).filter((h) => existsSync(path.join(OUT, lang, h + ".mp3")))
    man.chars[lang] = chars
    console.log(`[${lang}] selesai: ${done} berkas baru, ${(bytes / 1048576).toFixed(1)} MB`)
    if (flag("--prune")) {
      const keep = new Set(man.files[lang])
      for (const f of await readdir(path.join(OUT, lang))) if (f.endsWith(".mp3") && !keep.has(f.slice(0, -4))) { await unlink(path.join(OUT, lang, f)); console.log(`  hapus ${lang}/${f}`) }
    }
  }
  if (!flag("--dry-run")) { await writeFile(manFile, JSON.stringify(man, null, 1) + "\n"); console.log("manifest:", path.relative(ROOT, manFile)) }
}
main().catch((e) => { console.error("GAGAL:", e.message); process.exit(1) })
