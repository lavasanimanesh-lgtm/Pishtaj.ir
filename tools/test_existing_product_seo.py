"""Offline regression checks for existing-page-only SEO improvements.
python -m unittest discover -s tools -p 'test_existing_product_seo.py'
"""
import json
import re
import subprocess
import unittest
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = '80672849c487449d6341c41be9bd2da2474aeb7f'
SLUGS = ['rosemount-3051', 'control-valve', 'displacer-level-transmitter']


def baseline(path):
    return subprocess.check_output(['git', 'show', BASE + ':' + path], cwd=ROOT).decode()


def visible(text):
    text = re.sub(r'<(?:script|style)\b.*?</(?:script|style)>', '', text, flags=re.S)
    return unescape(re.sub('<[^>]*>', ' ', text))


class Tags(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class ExistingProductSEOTests(unittest.TestCase):
    def setUp(self):
        self.pages = {s: (ROOT / f'services/products/{s}.html').read_text() for s in SLUGS}

    def test_urls_h1_and_indexability_unchanged(self):
        for slug, text in self.pages.items():
            old = baseline(f'services/products/{slug}.html')
            for pattern in [r'<link rel="canonical"[^>]+>', r'<meta name="robots"[^>]+>', r'<h1[^>]*>.*?</h1>', r'<link rel="alternate"[^>]+>']:
                self.assertEqual(re.findall(pattern, text), re.findall(pattern, old), (slug, pattern))
            self.assertEqual(len(re.findall(r'<h1\b', text)), 1)
            self.assertNotIn('noindex', text)

    def test_public_generated_products_removed(self):
        data = json.loads((ROOT / '_tools/pricing-research/products.json').read_text())
        for p in data['products']:
            self.assertFalse((ROOT / ('products/' + p['slug'] + '.html')).exists())
        self.assertFalse((ROOT / 'products/price-estimates.html').exists())
        self.assertFalse((ROOT / 'tools/build_price_estimates.py').exists())
        self.assertFalse((ROOT / 'assets/data/pricing').exists())

    def test_no_new_sitemap_urls(self):
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        for path in ROOT.glob('sitemap*.xml'):
            old = ET.fromstring(baseline(path.name))
            new = ET.parse(path)
            self.assertEqual([n.text for n in old.findall('.//s:loc', ns)],
                             [n.text for n in new.findall('.//s:loc', ns)], path.name)

    def test_only_modified_service_urls_get_new_dates(self):
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        def entries(tree):
            return {n.find('s:loc', ns).text: n.find('s:lastmod', ns).text for n in tree.findall('s:url', ns)}
        old = entries(ET.fromstring(baseline('sitemap-services.xml')))
        new = entries(ET.parse(ROOT / 'sitemap-services.xml').getroot())
        changed = [k for k in old if old[k] != new[k]]
        self.assertEqual(set(changed), {'https://pishtaj.ir/services/products/' + s + '.html' for s in SLUGS + ['api-5l-pipe', 'seamless-pipe', 'ball-valve', 'gate-valve', 'check-valve', 'welding-flanges', 'butt-weld-fittings', 'forged-fittings', 'pressure-transmitter', 'differential-pressure-transmitter', 'diaphragm-seal', 'temperature-transmitter', 'thermowell', 'pressure-gauge', 'flowmeter', 'magnetic-flowmeter', 'coriolis-flowmeter', 'vortex-flowmeter', 'radar-level-transmitter']})

    def test_faq_schema_matches_visible_text(self):
        for slug, text in self.pages.items():
            body = visible(text)
            blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
            found = []
            for block in blocks:
                data = json.loads(block)
                for node in data.get('@graph', []):
                    if node.get('@type') == 'FAQPage':
                        found += node['mainEntity']
                    self.assertNotIn('offers', node)
                    self.assertNotIn('aggregateRating', node)
                    if node.get('@type') == 'Service':
                        self.assertNotIn('brand', node)
                        self.assertEqual(node['provider']['@id'], 'https://pishtaj.ir/#organization')
            self.assertEqual(len(found), 4, slug)
            for question in found:
                self.assertIn(question['name'], body)
                self.assertIn(question['acceptedAnswer']['text'], body)

    def test_editorial_cleanup_and_cost_clarity(self):
        for slug, text in self.pages.items():
            body = visible(text)
            for phrase in ['خوشه سئو', 'مسیر تبدیل', 'همراه Schema و لینک‌سازی', 'محتوای بازنویسی‌شده و یکتا']:
                self.assertNotIn(phrase, body, slug)
            self.assertEqual(text.count('data-existing-seo="2026-09-19"'), 1)
            self.assertIn('عدد' + 'ی به‌عنوان قیمت قطعی', body)
            self.assertIn('مدت اعتبار قیمت', body)
            self.assertNotIn('۲۳۰٬۹۰۰', body)

    def test_titles_and_descriptions_consistent(self):
        for slug, text in self.pages.items():
            tags = Tags(text).tags
            metas = {a.get('name') or a.get('property'): a.get('content') for tag, a in tags if tag == 'meta'}
            self.assertEqual(metas['description'], metas['og:description'])
            if 'twitter:description' in metas:
                self.assertEqual(metas['description'], metas['twitter:description'])
            self.assertEqual(unescape(re.search('<title>(.*?)</title>', text)[1]), metas['og:title'])

    def test_no_duplicate_ids_and_rfq_preserved(self):
        for slug, text in self.pages.items():
            tags = Tags(text).tags
            ids = [a['id'] for _, a in tags if 'id' in a]
            self.assertEqual(len(ids), len(set(ids)), slug)
            self.assertIn('purchase-checklist', ids)
            self.assertIn('../../rfq/?product=' + slug, text)

    def test_shared_robots_policy_keeps_public_urls_crawlable(self):
        robots = (ROOT / 'robots.txt').read_text()
        self.assertEqual(re.findall(r'^User-agent:\s*(\S+)', robots, re.M), ['*'])
        disallows = re.findall(r'^Disallow:\s*(\S+)', robots, re.M)
        paths = ['/assets/css/style.css', '/assets/js/main.js', '/rfq/']
        for sitemap in ROOT.glob('sitemap*.xml'):
            paths += [urlsplit(n.text).path for n in ET.parse(sitemap).findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        for path in paths:
            for rule in disallows:
                pattern = re.escape(rule).replace(r'\*', '.*').replace(r'\$', '$')
                self.assertFalse(re.match(pattern, path), (rule, path))


if __name__ == '__main__':
    unittest.main()
