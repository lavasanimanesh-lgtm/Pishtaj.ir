#!/usr/bin/env python3
"""Render shared homepage-derived chrome into existing public HTML (no runtime fetch).
Edit _tools/site-shell/header-*.html.inc / footer-*.html.inc, then run this file.
--check fails on stale output. Never changes main content, SEO metadata or redirects.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '_tools/site-shell'
VERSION = '20260919'
ASSETS = ('<!--ptf-shell-assets-->'
          '<link rel="stylesheet" href="/assets/css/site-shell.css?v=' + VERSION + '">'
          '<script src="/assets/js/site-shell.js?v=' + VERSION + '" defer></script>'
          '<noscript><style>@media(max-width:790px){#top[data-ptf-shell="header"]{position:static!important}'
          '#top[data-ptf-shell="header"] .nav-wrap{height:auto;flex-wrap:wrap}'
          '#top[data-ptf-shell="header"] #mainNav{position:static!important;display:flex!important;flex-wrap:wrap;'
          'opacity:1!important;visibility:visible!important;transform:none!important;width:100%}'
          '#top[data-ptf-shell="header"] .menu-toggle{display:none!important}}</style></noscript>'
          '<!--/ptf-shell-assets-->')

ASSET_PATTERN = re.compile(r'((?:src|href)="[^"?]*(?:assets/js/(?:main|ptf-motion|ptf-discover)\.js|assets/css/discover\.css))(?:\?[^" ]*)?("[ />])')


def normalize_asset_versions(text):
    return ASSET_PATTERN.sub(r'\1\2', text)


def strip_shell(text):
    text = re.sub(r'<!--ptf-shell-assets-->.*?<!--/ptf-shell-assets-->', '', text, flags=re.S)
    return normalize_asset_versions(re.sub(r'<header\b.*?</header>|<footer\b.*?</footer>', '', text, flags=re.S))

def render(path, text):
    lang = re.search(r'<html\b[^>]*\blang="([^"]+)"', text)
    lang = lang[1].split('-')[0] if lang else 'fa'
    if not (SOURCE / f'header-{lang}.html.inc').exists():
        raise ValueError(f'No localized shell for {path}: {lang}')
    for tag in ['header', 'footer']:
        template = (SOURCE / f'{tag}-{lang}.html.inc').read_text()
        # Keep the homepage's in-page anchors (scroll spy); elsewhere use root URLs.
        if path == 'index.html':
            template = template.replace('href="/#home"', 'href="#home"').replace('href="/#contact"', 'href="#contact"')
        if re.search('<' + tag + r'\b', text):
            text, count = re.subn('<' + tag + r'\b.*?</' + tag + '>', lambda _: template, text, flags=re.S)
            if count != 1:
                raise ValueError(f'Unexpected {tag} count in {path}: {count}')
        elif tag == 'header':
            text = re.sub(r'<body\b[^>]*>', lambda m: m[0] + template, text, count=1)
        else:
            text = text.replace('</body>', template + '</body>', 1)
    text = re.sub(r'<!--ptf-shell-assets-->.*?<!--/ptf-shell-assets-->', '', text, flags=re.S)
    text = ASSET_PATTERN.sub(lambda m: m[1] + '?v=' + VERSION + m[2], text)
    return text.replace('</head>', ASSETS + '</head>', 1)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    files = json.loads((SOURCE / 'preservation.json').read_text())
    css = (SOURCE / 'home-shell-base.css').read_text() + '\n' + (SOURCE / 'overrides.css').read_text()
    css_path = ROOT / 'assets/css/site-shell.css'
    if args.check:
        if not css_path.exists() or css_path.read_text() != css:
            raise SystemExit('Shared stylesheet is stale')
    else:
        css_path.write_text(css)
    changes = []
    for path in files:
        p = ROOT / path
        before = p.read_text()
        after = render(path, before)
        if strip_shell(before) != strip_shell(after):
            raise ValueError(f'Protected content changed: {path}')
        if after != before:
            changes.append(path)
            if not args.check:
                p.write_text(after)
    print(f'{len(files)} pages checked; {len(changes)} ' + ('stale' if args.check else 'updated'))
    if args.check and changes:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
