from pathlib import Path

import pdfplumber
from docx import Document
from docx.oxml.ns import qn

root = Path(__file__).resolve().parent
downloads = Path("C:/Users/jigne/Downloads")
thesis = root.parents[1] / "output/docx/G_14_ThreatLens_Thesis_College_Format.docx"
for path in (downloads / "G-24 TrueSheild - AI.pdf",
             downloads / "G_14_ThreatLens_Thesis_.pdf",
             root / "thesis-final.pdf", root / "reference.pdf"):
    with pdfplumber.open(path) as doc:
        page = doc.pages[0]
        print(path.name, len(doc.pages), page.width, page.height, page.extract_text().splitlines()[:2])
        bounds = lambda o: tuple(round(o[k], 3) for k in ("x0", "x1", "top", "bottom"))
        print([(o["object_type"], bounds(o), o.get("non_stroking_color"))
               for o in page.rects + page.curves + page.lines
               if o["width"] > 300 or o["height"] > 500][:60])
        print("images", [bounds(o) for o in page.images])

doc = Document(thesis)
for n, section in enumerate(doc.sections, 1):
    border = section._sectPr.find(qn("w:pgBorders"))
    print(n, [(edge.tag.split("}")[-1], edge.get(qn("w:val"))) for edge in border])

from collections import defaultdict
for path in (downloads / "G-24 TrueSheild - AI.pdf", root / "thesis-final.pdf"):
    measured = defaultdict(list)
    with pdfplumber.open(path) as doc:
        for n, page in enumerate(doc.pages, 1):
            strips = [o for o in page.rects
                      if o.get("non_stroking_color") == 0.0
                      and ((425 < o["width"] < 445 and o["height"] < 2
                            and (o["top"] < 90 or o["bottom"] > 750))
                           or (680 < o["height"] < 720 and o["width"] < 2))]
            measured[tuple(sorted(bounds(o) for o in strips))].append(n)
    print(path.name)
    for coords, pages in measured.items():
        print(pages, coords[:20])
