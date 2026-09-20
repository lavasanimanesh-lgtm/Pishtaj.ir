"""Regression checks for static, localized, homepage-derived shared chrome."""
import hashlib
import json
import re
import unittest
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from sync_site_shell import ROOT, SOURCE, ASSETS, render, strip_shell


class Attributes(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class SiteShellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hashes = json.loads((SOURCE / 'preservation.json').read_text())
        revisions = SOURCE / 'content-revisions.json'
        cls.revisions = json.loads(revisions.read_text()) if revisions.exists() else {}
        cls.pages = {path: (ROOT / path).read_text() for path in cls.hashes}

    def test_exact_content_and_metadata_preservation(self):
        for path, text in self.pages.items():
            expected = self.revisions.get(path, {}).get('sha256', self.hashes[path])
            self.assertEqual(hashlib.sha256(strip_shell(text).encode()).hexdigest(), expected, path)

    def test_later_content_revisions_are_documented(self):
        for path, revision in self.revisions.items():
            self.assertIn(path, self.hashes)
            self.assertRegex(revision['date'], r'^\d{4}-\d{2}-\d{2}$')
            self.assertTrue(revision['reason'])
            self.assertTrue((ROOT / revision['report']).is_file())
            self.assertRegex(revision['sha256'], r'^[0-9a-f]{64}$')

    def test_static_templates_and_idempotence(self):
        for path, text in self.pages.items():
            self.assertEqual(render(path, text), text, path)
            self.assertEqual(text.count(ASSETS), 1, path)
            self.assertEqual(len(re.findall(r'<header\b', text)), 1, path)
            self.assertEqual(len(re.findall(r'<footer\b', text)), 1, path)

    def test_unique_controls_and_accessibility(self):
        for path, text in self.pages.items():
            tags = Attributes(text).tags
            for identity in ['top', 'ptf-site-footer', 'menuToggle', 'mainNav', 'ptfThemeToggle']:
                self.assertEqual(sum(a.get('id') == identity for _, a in tags), 1, (path, identity))
            button = next(a for _, a in tags if a.get('id') == 'menuToggle')
            self.assertEqual(button['aria-controls'], 'mainNav')
            self.assertEqual(button['aria-expanded'], 'false')
            self.assertTrue(button['aria-label'])
            self.assertIn('<noscript>', text)

    def test_template_links_and_assets_resolve(self):
        for template in SOURCE.glob('*.html.inc'):
            for tag, attrs in Attributes(template.read_text()).tags:
                for attr in ['href', 'src']:
                    url = attrs.get(attr, '')
                    if not url or urlsplit(url).scheme:
                        continue
                    self.assertTrue(url.startswith('/'), (template.name, url))
                    path = ROOT / unquote(urlsplit(url).path).lstrip('/')
                    self.assertTrue(path.is_file() or (path / 'index.html').is_file(), (template.name, url))
        for asset in ['assets/css/site-shell.css', 'assets/js/site-shell.js']:
            self.assertTrue((ROOT / asset).is_file())

    def test_public_coverage_excluding_internal_and_retired_pages(self):
        import sys
        sys.path.insert(0, str(ROOT / '_tools'))
        from seo_redirect_audit import is_redirect_stub
        for path in ROOT.rglob('*.html'):
            relative = path.relative_to(ROOT).as_posix()
            if relative.startswith(('crm/', '_', '.git/', 'docs/', 'docs-deploy/', 'ptf-')):
                continue
            text = path.read_text()
            if '<body' not in text or is_redirect_stub(relative):
                continue
            self.assertIn(relative, self.pages, relative)

    def test_locales_and_css_are_shared(self):
        for lang in ['fa', 'en', 'ar', 'de', 'fr', 'ru', 'tr', 'zh']:
            self.assertTrue((SOURCE / f'header-{lang}.html.inc').is_file())
            self.assertTrue((SOURCE / f'footer-{lang}.html.inc').is_file())
        self.assertEqual((ROOT / 'assets/css/site-shell.css').read_text(),
                         (SOURCE / 'home-shell-base.css').read_text() + '\n' + (SOURCE / 'overrides.css').read_text())


if __name__ == '__main__':
    unittest.main()
