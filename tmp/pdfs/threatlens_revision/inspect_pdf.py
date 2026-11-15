from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium

root=Path(__file__).resolve().parent
source=Path('C:/Users/jigne/OneDrive/Desktop/ThreatLens (1).pdf')
with pdfplumber.open(source) as pdf:
    text='\n\n'.join(f'PAGE {i+1}\n{p.extract_text(layout=False)}' for i,p in enumerate(pdf.pages))
    (root/'original-text.txt').write_text(text,encoding='utf-8')
doc=pdfium.PdfDocument(str(source))
for i in range(len(doc)):
    page=doc[i]
    page.render(scale=1.6).to_pil().save(root/f'original-page-{i+1}.png')
    page.close()
doc.close()
print(text)
