#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rewrite the 28 consolidated (noindex) knowledge-center pages back into
independent indexable articles with unique content, and restore their head
(robots index, self-canonical, self-hreflang)."""
import re, os
from kc_rewrite_thin import rewrite

BASE = 'https://pishtaj.ir/knowledge-center/'

def restore_head(f):
    fn = os.path.join(os.path.dirname(__file__), '..', 'knowledge-center', f)
    s = open(fn, encoding='utf-8').read()
    i = s.find('</head>')
    head, rest = s[:i], s[i:]
    self_url = BASE + f
    # 1) robots: noindex -> index
    head = re.sub(r'(<meta\s+name=["\']robots["\']\s+content=["\'])noindex,\s*follow(["\'])',
                  r'\g<1>index, follow\g<2>', head)
    # 2) canonical -> self
    head = re.sub(r'<link\s+rel=["\']canonical["\']\s+href=["\'][^"\']*["\']\s*/?>',
                  f'<link rel="canonical" href="{self_url}"/>', head)
    # 3) hreflang -> self
    for hl in ['fa-IR', 'x-default']:
        head = re.sub(
            r'<link\s+rel=["\']alternate["\']\s+hreflang=["\']' + re.escape(hl) + r'["\']\s+href=["\'][^"\']*["\']\s*/?>',
            f'<link rel="alternate" hreflang="{hl}" href="{self_url}" />', head)
    open(fn, 'w', encoding='utf-8').write(head + rest)

def main():
    import kc_thin_content_c as C
    import kc_thin_content_d as D
    arts = C.ARTICLES + D.ARTICLES
    files = [a['file'] for a in arts]
    assert len(files) == len(set(files)) and len(files) == 28, 'expected 28 unique files'
    for a in arts:
        f, w = rewrite(a)
        restore_head(f)
        print(f"{w:5d} words   {f}")

if __name__ == '__main__':
    main()
