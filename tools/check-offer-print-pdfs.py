"""Check PDFs from test-offer-print.cjs: python tools/check-offer-print-pdfs.py DIR.
Requires PyMuPDF. Tests contact repetition, single-line layout and content clearance.
"""
import sys
from pathlib import Path
import pymupdf

files = list(Path(sys.argv[1]).glob('*.pdf'))
assert len(files) == 45, f'Expected 45 fixtures, got {len(files)}'
page_count = 0
min_gap = float('inf')
for file in files:
    with pymupdf.open(file) as document:
        for index, page in enumerate(document):
            footer, content = [], []
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    text = ''.join(span['text'] for span in line['spans'])
                    if 'Unit 1, 16th' in text or 'WhatsApp:' in text:
                        footer.append(line['bbox'])
                    elif text.strip():
                        content.append(line['bbox'][3])
            assert len(footer) == 1, (file, index, 'missing/wrapped footer')
            gap = footer[0][1] - max(content)
            assert gap > 4 * 72 / 25.4, (file, index, 'less than 4mm clearance', gap)
            min_gap = min(min_gap, gap)
            page_count += 1
print(f'{len(files)} PDFs / {page_count} pages passed; minimum gap {min_gap * 25.4 / 72:.1f}mm')
