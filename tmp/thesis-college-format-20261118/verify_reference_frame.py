"""Check that the frame appears on every page and no thesis content shifts."""
from pathlib import Path

import pdfplumber
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parent
preview = root / "qa-box"
preview.mkdir(exist_ok=True)
outside = []
broken = []

with pdfplumber.open(root / "thesis-box.pdf") as pdf, pdfplumber.open(root / "thesis-box-baseline.pdf") as prior:
    assert len(pdf.pages) == len(prior.pages) == 69
    for index, (page, original) in enumerate(zip(pdf.pages, prior.pages), 1):
        final = page.to_image(resolution=120).original.convert("RGB")
        base = original.to_image(resolution=120).original.convert("RGB")
        assert base.size == final.size
        final.save(preview / f"page-{index}.png")

        sx, sy = final.width / float(page.width), final.height / float(page.height)
        def px(x, y):
            return round(x * sx), round(y * sy)

        # Restrict pixel changes to the reference frame and the old divider's
        # slightly lower top edge. The full interior and margins are audited.
        diff = ImageChops.difference(base, final)
        visible = ImageDraw.Draw(diff)
        for x0, y0, x1, y1 in (
                (99, 58, 547, 74),
                (99, 764 - 3, 547, 770),
                (99, 58, 107, 770),
                (539, 58, 547, 770)):
            visible.rectangle((*px(x0, y0), *px(x1, y1)), fill=(0, 0, 0))
        if diff.getbbox() is not None:
            outside.append((index, diff.getbbox()))

        # Sample the solid inner strokes well away from the corners.
        for x, y in ((320, 63.1), (320, 764.65), (103.35, 370), (542.65, 370)):
            if max(final.getpixel(px(x, y))) > 120:
                broken.append((index, x, y, final.getpixel(px(x, y))))

print("Pages with non-frame differences:", outside)
print("Missing sampled strokes:", broken)
assert not outside and not broken
print("All 69 pages have the frame with unchanged content outside the border strips.")
