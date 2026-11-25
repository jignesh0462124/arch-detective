from pathlib import Path
from difflib import unified_diff
import re
import pdfplumber

root = Path(__file__).resolve().parent
with pdfplumber.open(root / "thesis-box-baseline.pdf") as base, pdfplumber.open(root / "thesis-box.pdf") as fixed:
    assert len(base.pages) == len(fixed.pages) == 69
    max_movement = 0
    for n, (before, after) in enumerate(zip(base.pages, fixed.pages), 1):
        before_text, after_text = before.extract_text(), after.extract_text()
        if before_text != after_text:
            print("Extraction differs:", n, list(unified_diff(before_text.splitlines(), after_text.splitlines(), n=0))[:24])
        assert re.sub(r"\s+", "", before_text) == re.sub(r"\s+", "", after_text), n
        assert before.width == after.width and before.height == after.height
        original_glyphs = [g for g in before.chars if g["text"].strip()]
        revised_glyphs = [g for g in after.chars if g["text"].strip()]
        assert [g["text"] for g in original_glyphs] == [g["text"] for g in revised_glyphs], n
        assert len(before.images) == len(after.images), n
        movements = [abs(x[key] - y[key]) for x, y in zip(original_glyphs, revised_glyphs)
                     for key in ("x0", "x1", "top", "bottom")]
        images = [abs(x[key] - y[key]) for x, y in zip(before.images, after.images)
                  for key in ("x0", "x1", "top", "bottom")]
        if max(movements + [0]) > .001:
            print("Text movement", n, max(movements))
        max_movement = max([max_movement] + movements + images)
    print("Maximum change in text and image positions:", max_movement, "points")
    assert max_movement < 0.6
