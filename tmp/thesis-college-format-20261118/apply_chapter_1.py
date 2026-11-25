"""Apply reviewed prose to Chapter 1 without rebuilding the Word document."""
from collections import Counter
from copy import copy, deepcopy
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as E

root = Path(__file__).resolve().parent
source = root.parents[1] / "output/docx/G_14_ThreatLens_Thesis_Box_Border.docx"
draft_mode = len(sys.argv) == 1
output = (root / "chapter-1-draft.docx" if draft_mode else
          root.parents[1] / "output/docx/G_14_ThreatLens_Thesis_Chapter_01_Revised.docx")
main = "word/document.xml"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"

def text(element):
    return "".join(element.itertext()) if element.tag == W+"t" else "".join(
        t.text or "" for t in element.iter(W+"t"))

def run(parent, contents, formatting):
    child = E.SubElement(parent, W+"r")
    if formatting is not None:
        child.append(deepcopy(formatting))
    node = E.SubElement(child, W+"t")
    node.text = contents
    if contents != contents.strip():
        node.set(XML_SPACE, "preserve")

def cached_fields(document):
    result = {}
    for command in document.iter(W+"instrText"):
        match = re.fullmatch(r"\s*PAGEREF\s+(\w+)\s+\\h\s*", command.text or "")
        if not match:
            continue
        target = match[1]
        outer = command.getparent()
        this = outer.getnext()
        separator = False
        while this is not None:
            marker = this.find(W+"fldChar")
            if marker is not None and marker.get(W+"fldCharType") == "end":
                break
            if marker is not None and marker.get(W+"fldCharType") == "separate":
                separator = True
            elif separator:
                things = this.findall(W+"t")
                if things:
                    assert len(things) == 1 and target not in result
                    result[target] = things[0]
            this = this.getnext()
        assert target in result, target
    return result

data = (root / "chapter-1-revision.txt").read_text(encoding="utf-8")
matches = re.split(r"^@(\d+)\s*\n", data, flags=re.M)[1:]
revisions = dict(zip(map(int, matches[0::2]), matches[1::2], strict=True))
assert len(revisions) == len(matches) // 2

with ZipFile(source) as origin:
    xml = E.fromstring(origin.read(main))
    body = xml.find(W+"body")
    paragraphs = body.findall(W+"p")
    start, stop = paragraphs[149], paragraphs[233]
    assert text(start).strip() == "CHAPTER 1INTRODUCTION"
    assert text(stop).startswith("CHAPTER 2")
    old = {i: E.tostring(p) for i, p in enumerate(paragraphs)}
    old_words = sum(len(text(p).split()) for p in paragraphs[149:233])
    for index, updated in revisions.items():
        assert 150 < index < 232
        p = paragraphs[index]
        assert all(c.tag in (W+"pPr", W+"r", W+"hyperlink") for c in p)
        assert p.find(".//"+W+"drawing") is None
        assert p.find(".//"+W+"instrText") is None
        ppr = p.find(W+"pPr")
        assert ppr is None or ppr.find(W+"sectPr") is None
        if updated.strip() == "[[REMOVE DRAFT NOTE]]":
            assert text(p).startswith("Add these entries to the main reference list")
            body.remove(p)
            continue
        links = [deepcopy(link) for link in p.findall(W+"hyperlink")]
        lines = re.split(r"\n\s*\n", updated.strip())
        fmt = next((r.find(W+"rPr") for r in p.findall(W+"r") if text(r).strip()), None)
        for c in tuple(p):
            if c.tag != W+"pPr":
                p.remove(c)
        target = p
        for n, line in enumerate(lines):
            if n:
                new = E.Element(W+"p")
                if ppr is not None:
                    new.append(deepcopy(ppr))
                target.addnext(new)
                target = new
            if line.endswith("[[CITES]]"):
                assert links and n == len(lines) - 1
                run(target, line.removesuffix("[[CITES]]"), fmt)
                for link_no, link in enumerate(links):
                    if link_no:
                        run(target, " ", fmt)
                    target.append(link)
            else:
                assert not links
                run(target, line, fmt)

    # The six chapter-local bibliography entries all restart at "1." in Word.
    # Apply labels that match the existing inline links; retain each cited entry.
    bibliography_indices = range(226, 232)
    assert text(paragraphs[224]).strip() == "References Cited in This Chapter"
    assert all(paragraphs[n].find(W+"pPr/"+W+"numPr") is not None
               for n in bibliography_indices)
    for number, index in enumerate(bibliography_indices, 1):
        p = paragraphs[index]
        contents = text(p)
        ppr = p.find(W+"pPr")
        ppr.remove(ppr.find(W+"numPr"))
        jc = ppr.find(W+"jc")
        assert jc is not None
        tabs = E.Element(W+"tabs")
        E.SubElement(tabs, W+"tab", {W+"val":"left", W+"pos":"720"})
        ind = E.Element(W+"ind", {W+"left":"720", W+"hanging":"720"})
        ppr.insert(ppr.index(jc), tabs)
        ppr.insert(ppr.index(jc), ind)
        label = E.Element(W+"r")
        E.SubElement(label, W+"t").text = f"[{number}]"
        E.SubElement(label, W+"tab")
        p.insert(p.index(ppr)+1, label)
        assert text(p) == f"[{number}]" + contents

    # Every original named heading, citation target, figure, and paragraph
    # outside the approved indices must survive byte-for-byte at the XML level.
    for index, p in enumerate(paragraphs):
        if index not in revisions and index not in bibliography_indices:
            assert E.tostring(p) == old[index], index
    assert list(body.iter(W+"hyperlink"))  # Includes the original reference lists.
    keep_order = body.index(start), body.index(stop)
    new_words = sum(len(text(p).split()) for p in list(body)[keep_order[0]:keep_order[1]])
    fields = cached_fields(xml)
    assert len(fields) == 100
    if not draft_mode:
        values = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
        assert values.keys() == fields.keys(), (fields.keys()-values.keys(), values.keys()-fields.keys())
        assert all(re.fullmatch(r"(?:[0-9]+|[ivx]+)", value) for value in values.values())
        changed = 0
        for target, node in fields.items():
            changed += node.text != values[target]
            node.text = values[target]
        print(f"Word-confirmed page references: {len(fields)}; changed: {changed}")

    original_xml = E.fromstring(origin.read(main))
    # This comparison covers tables, drawings, chapter boundaries, hyperlinks
    # and all non-chapter text, except the visible values of page-number fields.
    for candidate in (xml, original_xml):
        frame = candidate.find(W+"body")
        ps = list(frame)
        a = next(i for i, p in enumerate(ps) if text(p).strip() == "CHAPTER 1INTRODUCTION")
        b = next(i for i, p in enumerate(ps) if text(p).strip() == "CHAPTER 2LITERATURE REVIEW")
        external = deepcopy(candidate)
        frame = external.find(W+"body")
        for item in list(frame)[a+1:b]:
            frame.remove(item)
        for node in cached_fields(external).values():
            node.text = "<page>"
        canonical = E.tostring(external, method="c14n")
        if candidate is xml:
            updated_external = canonical
        else:
            assert canonical == updated_external
    assert Counter(h.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                   for h in original_xml.iter(W+"hyperlink")) == Counter(
                       h.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                       for h in xml.iter(W+"hyperlink"))
    assert [E.tostring(n) for n in original_xml.iter(W+"sectPr")] == [
        E.tostring(n) for n in xml.iter(W+"sectPr")]

    with ZipFile(output, "w") as final:
        for item in origin.infolist():
            final.writestr(copy(item), E.tostring(xml, encoding="UTF-8", xml_declaration=True,
                                           standalone=True)
                           if item.filename == main else origin.read(item))
    with ZipFile(output) as final:
        assert final.testzip() is None
        assert [item for item in final.namelist() if origin.read(item) != final.read(item)] == [main]
print(f"Chapter 1: {old_words} to {new_words} words including existing references.")
print(output)
