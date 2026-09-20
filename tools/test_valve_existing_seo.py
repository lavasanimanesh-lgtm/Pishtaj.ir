"""Regression checks for existing valve pages, not generated SKU pages."""
import json
import re
import unittest
from urllib.parse import urljoin
from html import unescape
from test_existing_product_seo import ROOT, Tags, baseline, visible

SLUGS = ['ball-valve', 'gate-valve', 'check-valve']


class ValveExistingSEOTests(unittest.TestCase):
    def setUp(self):
        self.pages = {slug: (ROOT / f'services/products/{slug}.html').read_text() for slug in SLUGS}

    def test_existing_identity_preserved(self):
        for slug, text in self.pages.items():
            old = baseline(f'services/products/{slug}.html')
            for pattern in [r'<h1[^>]*>.*?</h1>', r'<link rel="canonical"[^>]*>', r'<meta name="robots"[^>]*>', r'<link rel="alternate"[^>]*>']:
                self.assertEqual(re.findall(pattern, text), re.findall(pattern, old), (slug, pattern))
            self.assertNotIn('noindex', text)
            self.assertEqual(len(re.findall(r'<h1\b', text)), 1)

    def test_faqs_are_visible_and_service_provider_is_correct(self):
        for slug, text in self.pages.items():
            body = visible(text)
            faqs = []
            for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
                obj = json.loads(block)
                for node in obj.get('@graph', []):
                    self.assertNotIn('offers', node)
                    self.assertNotIn('aggregateRating', node)
                    if node.get('@type') == 'FAQPage':
                        faqs += node['mainEntity']
                    if node.get('@type') == 'Service':
                        self.assertNotIn('brand', node)
                        self.assertEqual(node['provider']['@id'], 'https://pishtaj.ir/#organization')
            self.assertEqual(len(faqs), 4, slug)
            for question in faqs:
                self.assertIn(question['name'], body, slug)
                self.assertIn(question['acceptedAnswer']['text'], body, slug)

    def test_metadata_consistent(self):
        for slug, text in self.pages.items():
            metas = {a.get('name') or a.get('property'): a.get('content') for tag, a in Tags(text).tags if tag == 'meta'}
            self.assertEqual(metas['description'], metas['og:description'])
            if 'twitter:description' in metas:
                self.assertEqual(metas['description'], metas['twitter:description'])
            self.assertEqual(unescape(re.search('<title>(.*?)</title>', text)[1]), metas['og:title'])

    def test_existing_links_and_ids_preserved(self):
        for slug, text in self.pages.items():
            old = baseline(f'services/products/{slug}.html')
            ids = [a['id'] for _, a in Tags(text).tags if 'id' in a]
            self.assertEqual(len(ids), len(set(ids)))
            self.assertTrue(set(re.findall('id="([^"]+)"', old)).issubset(ids))
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

    def test_reader_facing_content_not_seo_boilerplate(self):
        for slug, text in self.pages.items():
            body = visible(text)
            for phrase in ['خوشه سئو', 'مسیر تبدیل', 'همراه Schema و لینک‌سازی', 'محتوای بازنویسی‌شده و یکتا', 'جهت کابل‌کشی', '(موجود در انبار)']:
                self.assertNotIn(phrase, body, slug)
            self.assertEqual(text.count('data-valve-seo="2026-09-19"'), 1)
            self.assertIn('قیمت قطعی یا موجودی تضمین‌شده', body)
            self.assertIn('مدت اعتبار قیمت', body)
            self.assertIn('مالیات', body)

    def test_specific_selection_cautions(self):
        self.assertIn('قابلیت پیگ‌رانی کل مسیر نیست', self.pages['ball-valve'])
        self.assertIn('Backseat را مجوز تعویض پکینگ زیر فشار تلقی نکنید', self.pages['gate-valve'])
        self.assertIn('ارتفاع در حالت باز', self.pages['gate-valve'])
        self.assertIn('جریان رو به بالا و رو به پایین یکسان نیستند', self.pages['check-valve'])
        self.assertIn('Cracking Pressure', self.pages['check-valve'])
        self.assertIn('تضمین حذف ضربه قوچ', self.pages['check-valve'])

    def test_layout_and_table_accessibility(self):
        for slug, text in self.pages.items():
            text = re.sub(r'<script.*?</script>|<style.*?</style>', '', text, flags=re.S)
            for tag in ['main', 'article', 'section', 'div', 'table', 'thead', 'tbody']:
                self.assertEqual(len(re.findall('<' + tag + r'\b', text)), len(re.findall('</' + tag + '>', text)), (slug, tag))
            for table in re.findall(r'<div class="ptf-valve-table">(.*?)</div>', text, re.S):
                self.assertIn('<caption>', table)
                self.assertIn('scope="col"', table)
                self.assertIn('scope="row"', table)


if __name__ == '__main__':
    unittest.main()
