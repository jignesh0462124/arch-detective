"""Replace chapter prose without reserialising unrelated package parts."""
from copy import copy, deepcopy
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile

from lxml import etree as E


root = Path(__file__).resolve().parent
output_dir = root.parents[1] / "output/docx"
source = output_dir / "G_14_ThreatLens_Thesis_Chapter_02_Revised.docx"
final_mode = len(sys.argv) == 2
output = (output_dir / "G_14_ThreatLens_Thesis_Chapters_03_to_08_Revised.docx"
          if final_mode else root / "chapters-3-8-draft.docx")
part = "word/document.xml"
w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
chapters = {
    3: (290, "METHODOLOGY"),
    4: (347, "DATA COLLECTION, TOOLS AND COMPUTATIONAL PLATFORM"),
    5: (389, "SYSTEM DESIGN AND IMPLEMENTATION"),
    6: (457, "TESTING AND SUMMARY OF RESULTS"),
    7: (510, "CONCLUSION"),
    8: (527, "FUTURE SCOPE"),
    9: (556, "REFERENCES"),
}


def plain(node):
    return "".join(t.text or "" for t in node.iter(w+"t"))


def title(number):
    return f"CHAPTER {number}{chapters[number][1]}" if number != 9 else "REFERENCES"


def find_heading(body, number):
    return next(p for p in body.findall(w+"p") if plain(p).strip() == title(number))


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


def outside_chapters(doc):
    book = deepcopy(doc)
    body = book.find(w+"body")
    children = list(body)
    start, stop = (children.index(find_heading(body, n)) for n in (3, 9))
    for child in children[start+1:stop]:
        body.remove(child)
    for result in field_results(book).values():
        result.text = "<page>"
    return E.tostring(book, method="c14n")


def replace_paragraph(p, value, eligible_styles):
    assert p.tag == w+"p" and plain(p).strip()
    ppr = p.find(w+"pPr")
    style = None if ppr is None else ppr.find(w+"pStyle")
    assert (None if style is None else style.get(w+"val")) in eligible_styles
    for tag in ("hyperlink", "instrText", "drawing", "bookmarkStart", "sectPr", "commentRangeStart", "commentReference"):
        assert p.find(".//"+w+tag) is None, (tag, plain(p))
    fmt = next((r.find(w+"rPr") for r in p.findall(w+"r") if plain(r).strip()), None)
    if fmt is not None and plain(p).lstrip().startswith("[AUTHOR INPUT"):
        fmt = deepcopy(fmt)
        for tag in ("b", "bCs", "highlight"):
            for item in fmt.findall(w+tag):
                fmt.remove(item)
    for child in tuple(p):
        if child is not ppr:
            p.remove(child)
    for j, passage in enumerate(re.split(r"\n\s*\n", value.strip())):
        assert "\n" not in passage and passage
        if j:
            new = E.Element(w+"p")
            if ppr is not None:
                new.append(deepcopy(ppr))
            p.addnext(new)
            p = new
        run = E.SubElement(p, w+"r")
        if fmt is not None:
            run.append(deepcopy(fmt))
        E.SubElement(run, w+"t").text = passage


def word_count(body, n):
    children = list(body)
    first, last = (children.index(find_heading(body, k)) for k in (n, n+1))
    return sum(len(plain(p).split()) for p in children[first:last])


with ZipFile(source) as original:
    doc = E.fromstring(original.read(part))
    unaffected = outside_chapters(doc)
    body = doc.find(w+"body")
    paragraphs = body.findall(w+"p")
    for n, (i, _) in chapters.items():
        assert paragraphs[i] is find_heading(body, n), (n, i)
    original_children = list(body)
    untouched = {p: E.tostring(p) for p in original_children}
    expected_bookmarks = [(b.get(w+"id"), b.get(w+"name")) for b in doc.iter(w+"bookmarkStart")]
    expected_drawings = [E.tostring(b) for b in doc.iter(w+"drawing")]
    changed = set()

    for n in range(3, 9):
        a, b = chapters[n][0], chapters[n+1][0]
        path = root / f"chapter-{n}-revision.txt"
        edits = re.split(r"^@(\d+)[ \t]*\n", path.read_text(encoding="utf-8"), flags=re.M)[1:]
        replacements = dict(zip(map(int, edits[::2]), edits[1::2], strict=True))
        assert len(replacements) == len(edits) // 2
        assert list(replacements) == sorted(replacements)
        count_before = word_count(body, n)
        for i, value in replacements.items():
            assert a < i < b
            if i in (333, 334, 335):
                # These were three independently restarted lists (1., 1., 1.).
                # The expanded text defines each measure as a normal paragraph.
                ppr = paragraphs[i].find(w+"pPr")
                numbering = ppr.find(w+"numPr")
                assert numbering is not None
                ppr.remove(numbering)
            replace_paragraph(paragraphs[i], value, {None, "Normal", "Thesisbullet"})
            changed.add(paragraphs[i])
        count_after = word_count(body, n)
        assert count_after > count_before, n
        print(f"Chapter {n}: {len(replacements)} prose targets, {count_before} -> {count_after} words.")

    # Keep the final interpretation of the results together.
    for i, tags in ((507, ("keepNext", "keepLines")), (508, ("keepLines",))):
        ppr = paragraphs[i].find(w+"pPr")
        for pos, tag in enumerate(tags):
            assert ppr.find(w+tag) is None
            ppr.insert(pos, E.Element(w+tag))

    graph_caption = paragraphs[434]
    assert plain(graph_caption).strip().endswith("exploitability..")
    extra_period = next(t for t in graph_caption.iter(w+"t") if t.text == ".")
    extra_period.text = ""
    changed.add(graph_caption)

    caption = paragraphs[472]
    assert plain(caption).strip() == "Table 6.1: Functional Test Matrix"
    table = caption.getnext()
    assert table.tag == w+"tbl"
    observations = [
        "No linked resume and duplicate-submission trace for this audit.",
        "Figure 5.1 shows the source view and selected finding together.",
        "Not observed in the saved application capture.",
        "Access checks are recorded separately in Section 6.8.",
        "Figure 6.1 shows exported evidence. Full parity was not measured.",
    ]
    rows = table.findall(w+"tr")
    for row, value in zip(rows[1:], observations, strict=True):
        cell = row.findall(w+"tc")[-1]
        p, = cell.findall(w+"p")
        assert plain(p).strip() == "[AUTHOR INPUT]"
        replace_paragraph(p, value, {None, "Normal"})
    changed.add(table)

    for child, expected in untouched.items():
        if child not in changed:
            assert E.tostring(child) == expected
    assert [(b.get(w+"id"), b.get(w+"name")) for b in doc.iter(w+"bookmarkStart")] == expected_bookmarks
    assert [E.tostring(b) for b in doc.iter(w+"drawing")] == expected_drawings
    children = list(body)
    start, stop = (children.index(find_heading(body, n)) for n in (3, 9))
    assert "[AUTHOR INPUT" not in "\n".join(plain(p) for p in children[start:stop])

    if final_mode:
        values = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
        results = field_results(doc)
        assert results.keys() == values.keys()
        assert all(re.fullmatch(r"(?:[0-9]+|[ivx]+)", v) for v in values.values())
        for target, result in results.items():
            result.text = values[target]

    assert outside_chapters(doc) == unaffected
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w") as updated:
        for item in original.infolist():
            data = (E.tostring(doc, xml_declaration=True, encoding="UTF-8", standalone=True)
                    if item.filename == part else original.read(item))
            updated.writestr(copy(item), data)
    with ZipFile(output) as check:
        assert check.testzip() is None
        assert [n for n in check.namelist() if check.read(n) != original.read(n)] == [part]

print(output)
