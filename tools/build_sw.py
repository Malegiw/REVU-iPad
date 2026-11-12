#!/usr/bin/env python3
"""Perbarui daftar berkas (FILES) dan VERSION di sw.js.

Dipakai setelah mengubah berkas aplikasi:  python3 tools/build_sw.py
Berkas yang disimpan untuk offline: assets/* (tanpa subfolder; rekaman suara assets/voice/ disimpan saat diputar
atau lewat tombol "Simpan untuk offline"), css/*.css, data/*.json, icons/*, js/*.js, js/desain/*.js, js/vendor/*.mjs (pdf.js untuk impor RTS), index.html, manifest.
VERSION = 10 karakter awal SHA-1 dari isi semua berkas tersebut + kode sw.js sendiri, jadi berubah setiap ada perubahan.
"""
import glob
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATTERNS = ["assets/*", "css/*.css", "data/*.json", "icons/*", "js/*.js", "js/desain/*.js", "js/vendor/*.mjs", "index.html", "manifest.webmanifest"]


def main():
    os.chdir(ROOT)
    files = sorted({f for p in PATTERNS for f in glob.glob(p) if os.path.isfile(f)})
    sw = open("sw.js", encoding="utf-8").read()
    body = re.sub(r'const VERSION = "[0-9a-f]+"', 'const VERSION = ""', sw)
    body = re.sub(r"const FILES = \[[^\]]*\]", "const FILES = []", body, flags=re.S)
    h = hashlib.sha1()
    for f in files:
        h.update(f.encode() + b"\0")
        h.update(open(f, "rb").read())
    h.update(body.encode())
    ver = h.hexdigest()[:10]
    lst = "const FILES = [\n" + "".join(f' "{f}",\n' for f in ["./"] + files) + "]"
    out = re.sub(r'const VERSION = "[0-9a-f]*"', f'const VERSION = "{ver}"', sw, count=1)
    out = re.sub(r"const FILES = \[[^\]]*\]", lambda m: lst, out, count=1, flags=re.S)
    if out != sw:
        open("sw.js", "w", encoding="utf-8").write(out)
    print(f"sw.js: {len(files) + 1} berkas, VERSION {ver}")


if __name__ == "__main__":
    main()
