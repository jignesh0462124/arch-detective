"""Verify Chapter 2's Word rendering and isolate all changes to the chapter."""
import json
import re
from pathlib import Path

import pdfplumber
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
prior = root / "qa-chapter1-final"
renders = root / "qa-chapter2-final"
pages = json.loads((renders / "pages.json").read_text(encoding="utf-8"))
assert all(p["text"].strip() and not p["outside_border"] for p in pages)
assert not re.search(r"Error!|Bookmark not defined|Reference source not found",
                     "\n".join(p["text"] for p in pages))


def chapter(pdf, number, name):
    for i, page in enumerate(pdf.pages, 1):
        matches = (page.extract_text() or "").splitlines() == [f"CHAPTER {number}", name]
        page.close()
        if matches:
            return i
    raise AssertionError((number, name))


def body(page):
    return page.crop((0, 0, page.width, 750)).extract_text(x_tolerance=2)


def verify_pixels(new, old, full=True):
    with Image.open(prior/f"page-{old}.png") as a, Image.open(renders/f"page-{new}.png") as b:
        a, b = a.convert("RGB"), b.convert("RGB")
        assert a.size == b.size
        if not full:
            area = (0, 0, a.width, round(747 / 841.92 * a.height))
            a, b = a.crop(area), b.crop(area)
        assert ImageChops.difference(a, b).getbbox() is None, (new, old)


with pdfplumber.open(root/"chapter-1-final.pdf") as old, \
     pdfplumber.open(root/"chapter-2-final.pdf") as final, \
     pdfplumber.open(root/"chapter-2-draft.pdf") as proof:
    start = chapter(final, 2, "LITERATURE REVIEW")
    end = chapter(final, 3, "METHODOLOGY")
    old_start = chapter(old, 2, "LITERATURE REVIEW")
    old_end = chapter(old, 3, "METHODOLOGY")
    offset = end - old_end
    assert start == old_start
    assert len(final.pages) == len(proof.pages) == len(old.pages) + offset == len(pages)
    assert sum(len(p["images"]) for p in pages[start:end-1]) == 1
    touched = {8, 9, 12, 13, 14, 15}
    for i, (render, expected) in enumerate(zip(final.pages, proof.pages), 1):
        # The deliverable's cached field values must render exactly the same as
        # the Word proof with every field freshly updated in memory.
        assert render.extract_text(x_tolerance=2) == expected.extract_text(x_tolerance=2), i
        if i <= start and i not in touched:
            verify_pixels(i, i)
        if i >= end:
            previous = old.pages[i - 1 - offset]
            assert body(render) == body(previous), i
            verify_pixels(i, i-offset, full=False)
            previous.close()
        render.close()
        expected.close()
    lo, hi = start+1, end-1
    print(f"Chapter 2: {hi-lo+1} body pages, physical pages {lo}–{hi}.")
    print(f"Thesis: {len(final.pages)} pages (+{offset}).")
    print("Word page references match the fully refreshed proof; unaffected chapter bodies are pixel-identical.")
