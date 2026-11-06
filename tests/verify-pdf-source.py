"""로컬 개발용 PDF와 등록 원문을 대조합니다. PDF를 수정하거나 배포하지 않습니다."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
pdf = root / 'references/01_건축물의 에너지절약설계기준(국토교통부고시)(제2025-738호)(20251231).pdf'
reader = PdfReader(pdf)
assert len(reader.pages) == 18
header = reader.pages[0].extract_text()
assert '시행 2025. 12. 31.' in header and '국토교통부고시 제2025-738호' in header
page4, page5 = (reader.pages[index].extract_text() for index in [3, 4])
originals = [
    page4[page4.index('차. ') + 3:page4.index('카. ')].strip(),
    page4[page4.index('카. ') + 3:].strip() + page5[page5.index('한다.'):page5.index('타. ')].strip(),
    page5[page5.index('타. ') + 3:page5.index('파. ')].strip()
]
html = (root / 'index.html').read_text(encoding='utf-8-sig')
terms = json.loads(re.search(r'<script id="fill-study-data"[^>]*>([\s\S]*?)</script>', html)[1])
assert len(terms) == 3
for term, original in zip(terms, originals):
    # PDF의 줄바꿈/쪽 나눔과 본문 공백을 제외한 모든 문자·수치·단위를 대조합니다.
    assert re.sub(r'\s+', '', original) == re.sub(r'\s+', '', term['definition']), term['id']
    for blank in term['blanks']:
        assert term['definition'][blank['start']:blank['end']] == blank['answer']
    print(f"MATCH {term['id']}: {len(term['definition'])} characters, pages {term['source']['pdfPages']}")
print('PDF SHA256:', hashlib.sha256(pdf.read_bytes()).hexdigest())
print('PASS: full definitions including numbers, units, test methods and provisos match the local PDF')
