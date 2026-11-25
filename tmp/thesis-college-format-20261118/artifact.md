# College thesis template execution contract

Reference: C:/Users/jigne/Downloads/Project Thesis Guidelines Winter 2026 Format.docx.
SHA256 and package-by-package hashes: template-inventory.json (retained original must remain byte-identical).
Reference rendered in Microsoft Word: reference.pdf, 8 pages; reference-page-1.png through reference-page-8.png.
The packaged render_docx.py was attempted but LibreOffice is not installed. Use Word for layout/field refresh and bundled pdfplumber/pdfium for PNGs. Do not install or use another desktop editor.

## Page system

Use the actual reference section geometry: A4 11907 x 16839 twips, portrait; top 1440, bottom 1800, left 2160, right 1152 twips; header 1296 and footer 1584. This is a binding-margin layout, not a physically symmetric page margin. All text is centered or justified within this text column, not relative to the physical paper edge.
Copy the reference pgBorders: top/left thickThinSmallGap, bottom/right thinThickSmallGap, size 12; spaces top/bottom 1, left/right 4. Preserve edge rules, no generic double border substitution.
Retain reference logo and banner assets without aspect-ratio changes. Covers use reference section 0 header/footer. Declaration and certificate use section 1 header/footer. Other sections use section 2 empty header/footer plus centered PAGE fields where applicable.
Cover and inner cover are separate unnumbered pages, inner cover has the existing copyright text. Declaration, certificate, acknowledgement unnumbered. Abstract through publications use lower Roman numbers starting i. Contents starts Arabic 1; chapter separator pages count but suppress the visible number using first-page footer behavior. Additional sections permitted only for these page-number/header patterns.

## Typography

Calibri throughout. Body 12 normal, line spacing 1.5, justified, 7 pt after. Chapter headings and chapter titles 16 bold uppercase, section headings 14 bold title case, subsection headings 12 bold, figure/table captions 12 bold. Match the reference cover's 18 bold title, 12 bold italic submission statement, 16 bold qualification/authors/guide/month. Front tables and signature entries remain 12 pt; no shrink-to-fit.
Keep headings with following prose, captions with their images, table rows intact where possible. Header rows repeat. No fixed row heights. Source figures retain original bytes and aspect ratio and are constrained to the text column and usable page height.

## Components and slots

Use a working copy of the reference as the base. Remove template sample author/title/instruction paragraphs only. Fill cover/declaration/certificate slots using the supplied thesis, not new facts. Copy editable source body paragraphs, real tables, source figures, citations and hyperlinks with relationship/numbering remapping. Keep author spellings and existing signature/official-name placeholders; do not invent missing details or certificates.
Content authority: G_14_ThreatLens_Thesis_.pdf (65 pages). Existing output/docx/G_14_ThreatLens_Thesis_.docx matches the content; differences are footer text, page numbers, table reading order and four broken word spaces. It is a reuse source, not the design authority. Preserve all substantive prose and all ten body figures. Keep all eight chapters, references and appendices.
Replace stale contents and figure/table navigation metadata with page-reference fields to actual headings and captions. Figure list uses the nine real figure captions (Figure 5.2 comprises two retained images). Table list includes the real functional test table only; do not manufacture the four other tables listed in the source's stale index.
Conclusion/Future Scope prose may receive bullet formatting to match the explicit college instruction, without rewriting sentences. Preserve existing section headings and images.

## Package preservation

Preserve original template image/header/footer/custom opaque parts and relationships unless a specific visible border/logo/banner issue is found. Styles and numbering are editable for the prescribed font hierarchy and incoming source list IDs. Body document, settings, core properties and necessary image relationships are editable. Remove template placeholder data and colored instructional annotations from authored body only; do not copy the guideline pages into the thesis. Source media must survive unchanged by SHA256.

## Fidelity gates

Verify original reference SHA256 before/after. Validate DOCX ZIP and all relationship targets. Audit all section dimensions/fonts. Verify source body paragraphs in order against final paragraphs, excluding only old navigation entries and whitespace. Verify every source body image hash. Refresh PAGE/PAGEREF fields in Word, render every final page to PNG, inspect every page, and check extracted text/image bounds against page border. Inspect cover, inner cover, declaration and certificate individually at readable resolution for logo/banner containment and collisions. No Word repair prompts, missing-field errors, blank overflow pages, clipped tables or distorted figures. Deliver only the corrected DOCX; QA PDFs/PNGs are not requested deliverables.

## Final execution refinements

The completed document uses 15 sections for the required branded pages, front matter and eight independently numbered chapter-separator patterns. Tables use 12 pt text with single spacing and expanding rows, following the reference's form/table rhythm; main prose retains 1.5 spacing. Header/footer paragraph spacing is explicitly frozen before the Normal style changes, preventing the original fixed footer box from clipping the banner. The narrow contact line remains 8 pt, and the inner-cover copyright sits below the banner inside that same box. The original logo/banner artwork, aspect ratios and placement remain intact. The Chapter 1 objectives receive consistent bullet indentation; standalone Contribution headings and the metric-introduction line stay with following text. These are formatting changes, not prose revisions.

Final review uses the 69-page Microsoft Word render, PDFium PNGs of every page and an independent Poppler check of branding/table pages. PDFium produces intermittent hairline gaps in table strokes; Poppler confirms the actual PDF table borders are continuous. All 100 displayed PAGEREF values are checked against the rendered destination pages, not merely against bookmark existence.
