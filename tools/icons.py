"""Render the app icon SVG to PNG sizes. Usage: py tools/icons.py app/icons"""
import sys, os, pymupdf as fitz
d = sys.argv[1]
svg = open(os.path.join(d, "icon.svg"), "rb").read()
for size in (192, 512):
    doc = fitz.open(stream=svg, filetype="svg")
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(size / page.rect.width, size / page.rect.width), alpha=True)
    pix.save(os.path.join(d, "icon-%d.png" % size))
# maskable: full-bleed square background
m = svg.replace(b'rx="112"', b'rx="0"')
doc = fitz.open(stream=m, filetype="svg"); page = doc[0]
page.get_pixmap(matrix=fitz.Matrix(512 / page.rect.width, 512 / page.rect.width)).save(os.path.join(d, "icon-maskable-512.png"))
print(os.listdir(d))
