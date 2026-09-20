"""Checks for the second existing-page SEO batch; no new public URLs."""
import json
import re
import unittest
from html import unescape
from xml.etree import ElementTree as ET
from test_existing_product_seo import ROOT, Tags, baseline, visible

PRODUCTS = ['services/products/api-5l-pipe.html', 'services/products/seamless-pipe.html']
ARTICLES = ['knowledge-center/api-5l-x42.html', 'knowledge-center/kc-astm-a106-gr.html']


def normalize(s):
    return ' '.join(unescape(re.sub('<[^>]*>', ' ', s)).split())


class PipeExistingSEOTests(unittest.TestCase):
    def test_existing_identity_and_anchors_preserved(self):
        for path in PRODUCTS + ARTICLES:
            old, text = baseline(path), (ROOT / path).read_text()
            for pattern in [r'<link rel="canonical"[^>]+>', r'<link rel="alternate"[^>]+>', r'<meta name="robots"[^>]+>', r'<h1[^>]*>.*?</h1>']:
                self.assertEqual(re.findall(pattern, old), re.findall(pattern, text), path)
            self.assertNotIn('noindex', text)
            ids = [attrs['id'] for _, attrs in Tags(text).tags if 'id' in attrs]
            self.assertEqual(len(ids), len(set(ids)), path)
            self.assertTrue(set(re.findall('id="([^"]+)"', old)).issubset(ids), path)
            for tag, attrs in Tags(text).tags:
                href = attrs.get('href', '')
                if href.startswith('#') and len(href) > 1:
                    self.assertIn(href[1:], ids, (path, href))

    def test_retired_alias_unchanged(self):
        path = 'knowledge-center/a106-gr-b.html'
        self.assertEqual((ROOT / path).read_text(), baseline(path))

    def test_visible_faqs_and_schema_match(self):
        for path in PRODUCTS + ARTICLES:
            text = (ROOT / path).read_text()
            body = normalize(visible(text))
            faqs = []
            for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
                obj = json.loads(block)
                for node in obj.get('@graph', [obj]):
                    self.assertNotIn('offers', node)
                    self.assertNotIn('aggregateRating', node)
                    if node.get('@type') == 'FAQPage':
                        faqs += node['mainEntity']
                    if node.get('@type') == 'Article':
                        self.assertEqual(node['datePublished'], '2026-07-01')
                        self.assertEqual(node['dateModified'], '2026-09-19')
                        self.assertIn(node['headline'], body)
                    if node.get('@type') == 'Service':
                        self.assertNotIn('brand', node)
                        self.assertEqual(node['provider']['@id'], 'https://pishtaj.ir/#organization')
            self.assertEqual(len(faqs), 8 if path.endswith('kc-astm-a106-gr.html') else 4)
            for q in faqs:
                self.assertIn(normalize(q['name']), body, path)
                self.assertIn(normalize(q['acceptedAnswer']['text']), body, path)

    def test_metadata_and_dates_consistent(self):
        for path in PRODUCTS + ARTICLES:
            text = (ROOT / path).read_text()
            metas = {a.get('name') or a.get('property'): a.get('content') for tag, a in Tags(text).tags if tag == 'meta'}
            self.assertEqual(metas['description'], metas['og:description'])
            if 'twitter:description' in metas:
                self.assertEqual(metas['description'], metas['twitter:description'])
            self.assertEqual(unescape(re.search('<title>(.*?)</title>', text)[1]), metas['og:title'])
            if path in ARTICLES:
                self.assertIn('<time datetime="2026-09-19">۲۸ شهریور ۱۴۰۵</time>', text)

    def test_technical_and_editorial_regressions(self):
        for path in PRODUCTS:
            text = (ROOT / path).read_text()
            for phrase in ['خوشه سئو', 'مسیر تبدیل', 'همراه Schema و لینک‌سازی', 'جهت کابل‌کشی', 'محتوای بازنویسی‌شده و یکتا']:
                self.assertNotIn(phrase, text)
            self.assertIn('data-pipe-seo="2026-09-19"', text)
            self.assertIn('وزن', text)
            self.assertIn('مالیات', text)
        a106 = (ROOT / ARTICLES[1]).read_text()
        for phrase in ['ضخامت با دما جمع', 'محدوده دمایی ۲۹- تا ۴۲۵', 'SCH 40 معمولاً کفایت', '۴ تا ۱۲ هفته', 'ریسک خرید اشتباه را عملاً حذف', 'فولادِ کِش‌شده']:
            self.assertNotIn(phrase, a106)
        self.assertIn('دما با ضخامت جمع نمی‌شود', a106)
        self.assertIn('فولاد آرام‌شده', a106)
        self.assertIn('فشار کاری لوله نیست', (ROOT / ARTICLES[0]).read_text())

    def test_article_sitemap_changes_limited_to_edited_pages(self):
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        def entries(root):
            return {n.find('s:loc', ns).text: n.find('s:lastmod', ns).text for n in root.findall('s:url', ns)}
        old = entries(ET.fromstring(baseline('sitemap-knowledge-center.xml')))
        new = entries(ET.parse(ROOT / 'sitemap-knowledge-center.xml').getroot())
        self.assertEqual(set(old), set(new))
        self.assertEqual({k for k in new if new[k] != old[k]}, {'https://pishtaj.ir/' + p for p in ARTICLES})

    def test_layout_container_balance(self):
        for path in PRODUCTS + ARTICLES:
            text = re.sub(r'<script.*?</script>|<style.*?</style>', '', (ROOT / path).read_text(), flags=re.S)
            for tag in ['main', 'article', 'section', 'div', 'table', 'thead', 'tbody', 'details']:
                self.assertEqual(len(re.findall('<' + tag + r'\b', text)), len(re.findall('</' + tag + '>', text)), (path, tag))


if __name__ == '__main__':
    unittest.main()
