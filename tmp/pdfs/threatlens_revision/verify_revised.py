from pathlib import Path
import json
import pdfplumber
import pypdfium2 as pdfium

root = Path(__file__).resolve().parent
source = root / 'build' / 'ThreatLens_Revised.pdf'
expected = [
    'Jignesh Sonewane', 'Soham Pashine', 'Bhargav Bawane',
    'Professor Pankaj Sonewane',
    'jignesh.sonewane.cyb@ghrce.raisoni.net',
    'soham.pashine.cyb@ghrce.raisoni.net',
    'bhargav.bawane.cyb@ghrce.raisoni.net',
    'pankaj.sonewane@raisoni.net',
]
with pdfplumber.open(source) as pdf:
    page_texts = [page.extract_text() or '' for page in pdf.pages]
    text = '\n\n'.join(f'PAGE {i+1}\n{t}' for i, t in enumerate(page_texts))
    (root / 'revised-text.txt').write_text(text, encoding='utf-8')
    assert all(term in page_texts[0] for term in expected), 'Missing author or email'
    assert page_texts[0].count('DIC Department') == 1
    assert page_texts[0].count('Department of Computer Science and Engineering') == 3
    assert 'Patel' not in text and 'example.edu' not in text
    assert '80.4' in text and '80.7' in text and '0.3-second' in text
    assert 'REFERENCES' in text and '[7]' in text
    pages = []
    for number, page in enumerate(pdf.pages, 1):
        chars = [c for c in page.chars if str(c.get('text', '')).strip()]
        outside = [c for c in chars if c['x0'] < 25 or c['x1'] > page.width-25 or c['top'] < 20 or c['bottom'] > page.height-20]
        assert not outside, f'Text outside safe page bounds: page {number}'
        pages.append({
            'page': number, 'size_pt': [page.width, page.height],
            'characters': len(chars),
            'text_bounds': [round(min(c['x0'] for c in chars), 2), round(min(c['top'] for c in chars), 2),
                            round(max(c['x1'] for c in chars), 2), round(max(c['bottom'] for c in chars), 2)],
        })
    report = {'pdf': str(source), 'page_count': len(pdf.pages), 'authors_and_emails': 'passed',
              'affiliations': 'passed', 'placeholder_removed': 'passed', 'page_bounds': 'passed',
              'metadata': pdf.metadata, 'pages': pages}

doc = pdfium.PdfDocument(str(source))
for i in range(len(doc)):
    page = doc[i]
    page.render(scale=1.7).to_pil().save(root / f'revised-page-{i+1}.png')
    page.close()
doc.close()
(root / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
