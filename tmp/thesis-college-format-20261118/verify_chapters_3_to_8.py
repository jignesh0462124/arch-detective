"""Confirm the saved DOCX renders identically to the recalculated Word proof."""
import json
from pathlib import Path
import re

import pdfplumber
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
old_renders = root / "qa-chapter2-final"
new_renders = root / "qa-chapters-3-8-final"
pages = json.loads((new_renders / "pages.json").read_text(encoding="utf-8"))
old_pages = json.loads((old_renders / "pages.json").read_text(encoding="utf-8"))
assert len(pages) == 100 and len(old_pages) == 76
assert all(not p["outside_border"] for p in pages)
assert all(re.search(r"\D", p["text"].strip()) or p["images"] for p in pages)
assert not re.search(r"Bookmark not defined|Reference source not found",
                     "\n".join(page["text"] for page in pages), re.I)


def page_with(data, heading):
    return next(p["page"] for p in data if p["text"].splitlines()[0] == heading)


def verify_pixels(new, old, full=True):
    with Image.open(old_renders/f"page-{old}.png") as a, Image.open(new_renders/f"page-{new}.png") as b:
        a, b = a.convert("RGB"), b.convert("RGB")
        assert a.size == b.size
        if not full:
            area = (0, 0, a.width, round(747 / 841.92 * a.height))
            a, b = a.crop(area), b.crop(area)
        assert ImageChops.difference(a, b).getbbox() is None, (new, old)


start = page_with(pages, "CHAPTER 3")
end = page_with(pages, "REFERENCES")
assert start == page_with(old_pages, "CHAPTER 3") == 41
assert end-page_with(old_pages, "REFERENCES") == len(pages)-len(old_pages) == 24
assert sum(len(p["images"]) for p in pages[start-1:end-1]) == 8
assert sum(len(p["images"]) for p in pages) == sum(len(p["images"]) for p in old_pages)

with pdfplumber.open(root/"chapters-3-8-final.pdf") as final, \
     pdfplumber.open(root/"chapters-3-8-draft.pdf") as proof:
    assert len(final.pages) == len(proof.pages) == 100
    for i, (rendered, expected) in enumerate(zip(final.pages, proof.pages), 1):
        assert rendered.extract_text(x_tolerance=2) == expected.extract_text(x_tolerance=2), i
        if i <= start and i not in {8, 9, 12, 13, 14, 15}:
            verify_pixels(i, i)
        if i >= end:
            verify_pixels(i, i-24, full=False)
        rendered.close()
        expected.close()

for n in range(3, 9):
    a = page_with(pages, f"CHAPTER {n}")
    b = page_with(pages, f"CHAPTER {n+1}") if n < 8 else end
    section = pages[a:b-1]
    print(f"Chapter {n}: body pages {a+1}-{b-1}; figure pages {[p['page'] for p in section if p['images']]}")
    assert "[AUTHOR INPUT" not in "\n".join(p["text"] for p in section)
for p in pages[start:end-1]:
    if re.search(r"\b(?:Figure [3-8]\.\d|Table 6\.1):", p["text"]):
        print("Caption page", p["page"], re.findall(r"(?:Figure [3-8]\.\d|Table 6\.1):[^\n]*", p["text"]))
print("100 pages. All saved page references match the updated proof; unchanged bodies match the previous Word render.")
