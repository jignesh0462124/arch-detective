from pathlib import Path
import json
import re
import pdfplumber
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
renders = root / "qa-chapter1-final"
new = json.loads((renders / "pages.json").read_text(encoding="utf-8"))
assert len(new) == 71
assert all(p["text"].strip() and not p["outside_border"] for p in new)
assert not re.search(r"Error!|Bookmark not defined|Reference source not found",
                     "\n".join(p["text"] for p in new))

def body(page):
    return page.crop((0, 0, page.width, 750)).extract_text(x_tolerance=2)

with pdfplumber.open(root / "thesis-box.pdf") as old, \
     pdfplumber.open(root / "chapter-1-final.pdf") as final, \
     pdfplumber.open(root / "chapter-1-draft.pdf") as word_calculated:
    assert len(old.pages) == 69
    assert len(final.pages) == len(word_calculated.pages) == 71
    assert final.pages[29].extract_text().splitlines() == ["CHAPTER 2", "LITERATURE REVIEW"]
    for i, (after, calculated) in enumerate(zip(final.pages, word_calculated.pages), 1):
        assert after.extract_text(x_tolerance=2) == calculated.extract_text(x_tolerance=2), i
        if i <= 7 or 10 <= i <= 11 or i == 16:
            with Image.open(root / "qa-box" / f"page-{i}.png") as previous, \
                 Image.open(renders / f"page-{i}.png") as revised:
                assert ImageChops.difference(previous.convert("RGB"), revised.convert("RGB")).getbbox() is None, i
        if i >= 30:
            page = old.pages[i-3]
            assert body(page) == body(after), i
            # Footer page numbers change; use pixels to check the body area.
            with Image.open(root / "qa-box" / f"page-{i-2}.png") as previous, \
                 Image.open(renders / f"page-{i}.png") as revised:
                floor = round(747 / after.height * previous.height)
                a = previous.convert("RGB").crop((0, 0, previous.width, floor))
                b = revised.convert("RGB").crop((0, 0, revised.width, floor))
                assert ImageChops.difference(a, b).getbbox() is None, i
        after.close()
        calculated.close()

assert sum(len(p["images"]) for p in new[15:29]) == 1
print("71 pages; Chapter 1 occupies physical pages 16–29 (including its divider).")
print("All Word-rendered numbers match the field-updated proof.")
print("Cover through abstract and Chapters 2–8, references and appendix bodies match their prior renders.")
