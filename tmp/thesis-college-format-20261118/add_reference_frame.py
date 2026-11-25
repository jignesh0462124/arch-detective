"""Replace the auto-colored Word page border with the reference's vector frame."""
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as E

work = Path(__file__).resolve().parents[2]
source = work / "output/docx/G_14_ThreatLens_Thesis_College_Format.docx"
output = work / "output/docx/G_14_ThreatLens_Thesis_Box_Border.docx"

ns = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
}

def q(tag):
    prefix, name = tag.split(":")
    return f"{{{ns[prefix]}}}{name}"

def add(parent, tag, **attrs):
    return E.SubElement(parent, q(tag), **{q(k.replace("_", ":", 1)) if "_" in k else k: str(v)
                                          for k, v in attrs.items()})

def emu(points):
    return str(round(points * 12700))

# The reference cover's border coordinates, measured in PDF points.
left, top, right, bottom = 101.18, 60.96, 544.78, 766.776
width, height = right - left, bottom - top

def frame(paragraph, drawing_id):
    run = add(paragraph, "w:r")
    drawing = add(run, "w:drawing")
    anchor = add(drawing, "wp:anchor", distT=0, distB=0, distL=0, distR=0,
                 simplePos=0, relativeHeight=0, behindDoc=1, locked=1,
                 layoutInCell=0, allowOverlap=1)
    add(anchor, "wp:simplePos", x=0, y=0)
    add(add(anchor, "wp:positionH", relativeFrom="page"), "wp:posOffset").text = emu(left)
    add(add(anchor, "wp:positionV", relativeFrom="page"), "wp:posOffset").text = emu(top)
    add(anchor, "wp:extent", cx=emu(width), cy=emu(height))
    add(anchor, "wp:effectExtent", l=0, t=0, r=0, b=0)
    add(anchor, "wp:wrapNone")
    add(anchor, "wp:docPr", id=drawing_id, name="College page frame")
    add(anchor, "wp:cNvGraphicFramePr")
    graphic_data = add(add(anchor, "a:graphic"), "a:graphicData", uri=ns["wps"])
    shape = add(graphic_data, "wps:wsp")
    add(shape, "wps:cNvSpPr")
    props = add(shape, "wps:spPr")
    transform = add(props, "a:xfrm")
    add(transform, "a:off", x=0, y=0)
    add(transform, "a:ext", cx=emu(width), cy=emu(height))
    geometry = add(props, "a:custGeom")
    for child in ("avLst", "gdLst", "ahLst", "cxnLst"):
        add(geometry, "a:" + child)
    add(geometry, "a:rect", l="l", t="t", r="r", b="b")
    paths = add(geometry, "a:pathLst")

    # Two separate black bands, with an actual transparent gap between them.
    # Filled rectangles have clean, square corners and need no background color.
    def rectangle(x0, y0, x1, y1):
        path = add(paths, "a:path", w=emu(width), h=emu(height),
                   stroke="0", extrusionOk="0")
        for index, (x, y) in enumerate(((x0, y0), (x1, y0), (x1, y1), (x0, y1))):
            add(add(path, "a:moveTo" if index == 0 else "a:lnTo"), "a:pt", x=emu(x), y=emu(y))
        add(path, "a:close")

    for inset, stroke in ((0, 0.72), (1.44, 1.44)):
        x0, y0, x1, y1 = inset, inset, width - inset, height - inset
        rectangle(x0, y0, x1, y0 + stroke)
        rectangle(x0, y1 - stroke, x1, y1)
        rectangle(x0, y0 + stroke, x0 + stroke, y1 - stroke)
        rectangle(x1 - stroke, y0 + stroke, x1, y1 - stroke)
    add(add(props, "a:solidFill"), "a:srgbClr", val="000000")
    add(add(props, "a:ln"), "a:noFill")
    add(shape, "wps:bodyPr")

def serialize(element):
    return E.tostring(element, encoding="UTF-8", xml_declaration=True, standalone=True)

with ZipFile(source) as original:
    parts = {item: original.read(item) for item in original.namelist()}
    main = E.fromstring(parts["word/document.xml"])
    rel_root = E.fromstring(parts["word/_rels/document.xml.rels"])
    relationships = {rel.get("Id"): rel.get("Target") for rel in rel_root}
    frame_part = "word/headerCollegeFrame.xml"
    frame_rid = "rIdCollegeFrame"
    assert frame_part not in parts and frame_rid not in relationships
    E.SubElement(rel_root, rel_root[0].tag, Id=frame_rid,
                 Target="headerCollegeFrame.xml", Type=ns["r"] + "/header")
    content_types = E.fromstring(parts["[Content_Types].xml"])
    E.SubElement(content_types, "{" + E.QName(content_types).namespace + "}Override",
                 PartName="/" + frame_part,
                 ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml")
    sections = main.findall(".//" + q("w:sectPr"))
    header_parts = set()
    for section in sections:
        native = section.find(q("w:pgBorders"))
        assert native is not None and len(native) == 4
        section.remove(native)
        refs = section.findall(q("w:headerReference"))
        default = next(ref for ref in refs if ref.get(q("w:type")) == "default")
        if section.find(q("w:titlePg")) is not None and not any(
                ref.get(q("w:type")) == "first" for ref in refs):
            first = E.Element(q("w:headerReference"), {q("w:type"): "first", q("r:id"): frame_rid})
            section.insert(section.index(default) + 1, first)
        for ref in section.findall(q("w:headerReference")):
            if ref.get(q("r:id")) == frame_rid:
                continue
            target = relationships[ref.get(q("r:id"))]
            header_parts.add(target.lstrip("/") if target.startswith("/") else "word/" + target)
    updates = {"word/document.xml": serialize(main),
               "word/_rels/document.xml.rels": serialize(rel_root),
               "[Content_Types].xml": serialize(content_types)}
    for index, name in enumerate(sorted(header_parts), 1000):
        header = E.fromstring(parts[name])
        paragraph = header.find(q("w:p"))
        assert paragraph is not None, name
        frame(paragraph, index)
        updates[name] = serialize(header)
    first_page_header = E.Element(q("w:hdr"), nsmap=ns)
    paragraph = add(first_page_header, "w:p")
    paragraph_properties = add(paragraph, "w:pPr")
    add(paragraph_properties, "w:spacing", w_before=0, w_after=0, w_line=20, w_lineRule="exact")
    frame(paragraph, 2000)
    with ZipFile(output, "w") as final:
        for item in original.infolist():
            final.writestr(item, updates.get(item.filename, parts[item.filename]))
        final.writestr(frame_part, serialize(first_page_header))

with ZipFile(output) as final:
    assert final.testzip() is None
    assert {name for name, data in parts.items() if final.read(name) != data} == set(updates)
    checked = E.fromstring(final.read("word/document.xml"))
    baseline = E.fromstring(parts["word/document.xml"])
    for root in (checked, baseline):
        for section in root.findall(".//" + q("w:sectPr")):
            for child in tuple(section):
                if child.tag == q("w:pgBorders") or (
                        child.tag == q("w:headerReference") and child.get(q("w:type")) == "first"):
                    section.remove(child)
    assert E.tostring(checked, method="c14n") == E.tostring(baseline, method="c14n")
print(f"Applied the four-sided vector frame in {len(header_parts)} headers, {len(sections)} sections.")
print(output)
