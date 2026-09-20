"""Offline checks for strengthening existing flowmeter pages only."""
import json
import re
import unittest
from urllib.parse import urljoin
from html import unescape
from test_existing_product_seo import ROOT, Tags, baseline, visible

SLUGS = ['coriolis-flowmeter']


class CoriolisExistingSEOTests(unittest.TestCase):
    def setUp(self):
        self.pages = {s: (ROOT / f'services/products/{s}.html').read_text() for s in SLUGS}

    def test_identity_and_indexability_preserved(self):
        for slug, text in self.pages.items():
            old = baseline(f'services/products/{slug}.html')
            for pattern in [r'<h1[^>]*>.*?</h1>', r'<link rel="canonical"[^>]*>', r'<meta name="robots"[^>]*>', r'<link rel="alternate"[^>]*>']:
                self.assertEqual(re.findall(pattern, old), re.findall(pattern, text), (slug, pattern))
            self.assertNotIn('noindex', text)
            self.assertEqual(len(re.findall(r'<h1\b', text)), 1)

    def test_visible_faq_and_schema_alignment(self):
        for slug, text in self.pages.items():
            body = visible(text)
            faqs = []
            for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
                data = json.loads(block)
                for node in data.get('@graph', []):
                    self.assertNotIn('offers', node)
                    self.assertNotIn('aggregateRating', node)
                    if node.get('@type') == 'FAQPage':
                        faqs += node['mainEntity']
                    if node.get('@type') == 'Service':
                        self.assertNotIn('brand', node)
                        self.assertEqual(node['provider']['@id'], 'https://pishtaj.ir/#organization')
            self.assertEqual(len(faqs), 4)
            for question in faqs:
                self.assertIn(question['name'], body, slug)
                self.assertIn(question['acceptedAnswer']['text'], body, slug)

    def test_metadata_consistency(self):
        for slug, text in self.pages.items():
            metas = {a.get('name') or a.get('property'): a.get('content') for tag, a in Tags(text).tags if tag == 'meta'}
            self.assertEqual(metas['description'], metas['og:description'])
            if 'twitter:description' in metas:
                self.assertEqual(metas['description'], metas['twitter:description'])
            self.assertEqual(metas['og:title'], unescape(re.search('<title>(.*?)</title>', text)[1]))

    def test_existing_links_ids_and_rfq_preserved(self):
        for slug, text in self.pages.items():
            old = baseline(f'services/products/{slug}.html')
            ids = [a['id'] for _, a in Tags(text).tags if 'id' in a]
            self.assertEqual(len(ids), len(set(ids)), slug)
            self.assertTrue(set(re.findall('id="([^"]+)"', old)).issubset(ids), slug)
            # Header/footer destinations are deliberately unified; preserve all content links.
            content_before = re.sub(r'<header\b.*?</header>|<footer\b.*?</footer>', '', old, flags=re.S)
            old_links = {a['href'] for tag, a in Tags(content_before).tags if tag == 'a' and 'href' in a}
            new_links = {a['href'] for tag, a in Tags(text).tags if tag == 'a' and 'href' in a}
            # Shared shell uses root-relative URLs; compare destinations, not spelling.
            base = 'https://pishtaj.ir/services/products/' + slug + '.html'
            old_destinations = {urljoin(base, href) for href in old_links}
            new_destinations = {urljoin(base, href) for href in new_links}
            self.assertTrue(old_destinations.issubset(new_destinations), (slug, old_destinations - new_destinations))
            self.assertIn('../../rfq/?product=' + slug, new_links)
            self.assertIn('purchase-checklist', ids)

    def test_no_editorial_boilerplate_or_stock_promises(self):
        for slug, text in self.pages.items():
            body = visible(text)
            for phrase in ['خوشه سئو', 'مسیر تبدیل', 'همراه Schema و لینک‌سازی', 'محتوای بازنویسی‌شده و یکتا', 'جهت کابل‌کشی', '(موجود در انبار)', 'عملکرد alarm']:
                self.assertNotIn(phrase, body, slug)
            self.assertEqual(text.count('data-coriolis-seo="2026-09-20"'), 1)
            self.assertIn('قیمت قطعی، موجودی تضمین‌شده', body)
            self.assertIn('مدت اعتبار قیمت', body)
            self.assertIn('مالیات', body)

    def test_specific_technical_corrections_and_sources(self):
        text = self.pages['coriolis-flowmeter']
        for phrase in ['Zero Stability', '۱ کیلوگرم بر ساعت برابر ۱٪', 'افزایش Low-flow Cutoff دقت سنسور را بهتر نمی‌کند', 'بررسی صفر و انجام تنظیم صفر دو کار متفاوت‌اند', 'گواهی عمومی به‌تنهایی مجوز Custody Transfer نیست']:
            self.assertIn(phrase, text)
        for url in ['https://www.endress.com/en/field-instruments-overview/flow-measurement-product-overview/coriolis-mass-flowmeters', 'https://www.emerson.com/documents/automation/product-data-sheet-micro-motion-elite-coriolis-flow-density-meters-en-66748.pdf']:
            self.assertIn(url, text)
        self.assertIn('data-deep-upgrade="coriolis-flowmeter-deep-2026"', text)
        self.assertIn('href="magnetic-flowmeter.html"', text)
        self.assertNotIn('Dual Tube برای دقت بالا', text)
        self.assertNotIn('data-final-stability=', text)
        self.assertNotIn('data-final-lowdepth', text)

    def test_container_balance_and_table_semantics(self):
        for slug, text in self.pages.items():
            text = re.sub(r'<script.*?</script>|<style.*?</style>', '', text, flags=re.S)
            for tag in ['main', 'article', 'section', 'div', 'table', 'thead', 'tbody']:
                self.assertEqual(len(re.findall('<' + tag + r'\b', text)), len(re.findall('</' + tag + '>', text)), (slug, tag))
            tables = re.findall(r'<div class="ptf-coriolis-table">(.*?)</div>', text, re.S)
            self.assertEqual(len(tables), 2)
            for table in tables:
                self.assertIn('<caption>', table)
                self.assertIn('scope="col"', table)
                self.assertIn('scope="row"', table)


if __name__ == '__main__':
    unittest.main()
