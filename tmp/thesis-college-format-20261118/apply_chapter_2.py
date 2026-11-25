"""Revise Chapter 2 and transplant the page references calculated in Word."""
from copy import copy, deepcopy
from pathlib import Path
from zipfile import ZipFile
import json
import re
import sys

from lxml import etree as E

root = Path(__file__).resolve().parent
output_dir = root.parents[1] / "output/docx"
source = output_dir / "G_14_ThreatLens_Thesis_Chapter_01_Revised.docx"
final_mode = len(sys.argv) > 1
output = (output_dir / "G_14_ThreatLens_Thesis_Chapter_02_Revised.docx"
          if final_mode else root / "chapter-2-draft.docx")
main_part = "word/document.xml"
w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def text(node):
    return "".join(t.text or "" for t in node.iter(w+"t"))


def bounds(doc):
    body = doc.find(w+"body")
    children = list(body)
    first = next(i for i, p in enumerate(children) if text(p).strip() == "CHAPTER 2LITERATURE REVIEW")
    last = next(i for i, p in enumerate(children) if text(p).strip() == "CHAPTER 3METHODOLOGY")
    return body, first, last


def field_results(doc):
    fields = {}
    for command in doc.iter(w+"instrText"):
        match = re.fullmatch(r"\s*PAGEREF\s+(\w+)\s+\\h\s*", command.text or "")
        if not match:
            continue
        separated = False
        for sibling in command.getparent().itersiblings():
            char = sibling.find(w+"fldChar")
            if char is not None:
                kind = char.get(w+"fldCharType")
                if kind == "end":
                    break
                separated |= kind == "separate"
            elif separated and sibling.find(w+"t") is not None:
                assert match[1] not in fields
                fields[match[1]] = sibling.find(w+"t")
    assert len(fields) == 100
    return fields


def outside_chapter(doc):
    book = deepcopy(doc)
    body, start, stop = bounds(book)
    for child in list(body)[start+1:stop]:
        body.remove(child)
    for result in field_results(book).values():
        result.text = "<page>"
    return E.tostring(book, method="c14n")


def new_run(parent, value, formatting):
    run = E.SubElement(parent, w+"r")
    if formatting is not None:
        run.append(deepcopy(formatting))
    E.SubElement(run, w+"t").text = value


with ZipFile(source) as original:
    doc = E.fromstring(original.read(main_part))
    unaffected = outside_chapter(doc)
    body, start, stop = bounds(doc)
    paragraphs = body.findall(w+"p")
    assert text(paragraphs[239]).strip() == "CHAPTER 2LITERATURE REVIEW"
    assert text(paragraphs[284]).strip() == "CHAPTER 3METHODOLOGY"
    chapter = list(body)[start:stop]
    old_words = sum(len(text(p).split()) for p in chapter)
    untouched = {i: E.tostring(p) for i, p in enumerate(paragraphs)}
    edits = re.split(r"^@(\d+)\s*\n", (root/"chapter-2-revision.txt").read_text(encoding="utf-8"), flags=re.M)[1:]
    replacements = dict(zip(map(int, edits[::2]), edits[1::2], strict=True))
    assert len(replacements) == len(edits) // 2 == 31
    for i, value in replacements.items():
        p = paragraphs[i]
        assert 240 < i < 283 and p in chapter and text(p).strip()
        ppr = p.find(w+"pPr")
        assert ppr is None or ppr.find(w+"pStyle") is None
        for tag in ("hyperlink", "instrText", "drawing", "bookmarkStart", "sectPr"):
            assert p.find(".//"+w+tag) is None
        formatting = next((r.find(w+"rPr") for r in p.findall(w+"r") if text(r).strip()), None)
        for c in tuple(p):
            if c is not ppr:
                p.remove(c)
        for j, paragraph in enumerate(re.split(r"\n\s*\n", value.strip())):
            if j:
                new = E.Element(w+"p")
                if ppr is not None:
                    new.append(deepcopy(ppr))
                p.addnext(new)
                p = new
            new_run(p, paragraph, formatting)
    for i, p in enumerate(paragraphs):
        if i not in replacements:
            assert E.tostring(p) == untouched[i], i

    if final_mode:
        values = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
        results = field_results(doc)
        assert results.keys() == values.keys()
        assert all(re.fullmatch(r"(?:[0-9]+|[ivx]+)", v) for v in values.values())
        for target, result in results.items():
            result.text = values[target]
    assert outside_chapter(doc) == unaffected
    body, start, stop = bounds(doc)
    new_words = sum(len(text(p).split()) for p in list(body)[start:stop])
    assert new_words > old_words
    with ZipFile(output, "w") as updated:
        for item in original.infolist():
            data = (E.tostring(doc, xml_declaration=True, encoding="UTF-8", standalone=True)
                    if item.filename == main_part else original.read(item))
            updated.writestr(copy(item), data)
    with ZipFile(output) as check:
        assert check.testzip() is None
        assert [n for n in check.namelist() if check.read(n) != original.read(n)] == [main_part]

print(f"Chapter 2: revised {len(replacements)} prose paragraphs; {old_words} to {new_words} words.")
print(output)
