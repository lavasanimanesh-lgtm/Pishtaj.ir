#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Move/remove visible content that was accidentally placed after </footer> in knowledge-center pages.
Goal: after </footer> only technical tags such as scripts and closing body/html may remain.
"""
from pathlib import Path
import re

KC = Path('knowledge-center')

TECH_PATTERNS = [
    r'<script\b[\s\S]*?</script>',
    r'<style\b[\s\S]*?</style>',
    r'<link\b[^>]*>',
    r'<meta\b[^>]*>',
    r'<!--.*?-->',
    r'</?body\b[^>]*>',
    r'</?html\b[^>]*>',
]

def visible_text(fragment: str) -> str:
    s = fragment
    for pat in TECH_PATTERNS:
        s = re.sub(pat, ' ', s, flags=re.I|re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def strip_technical(fragment: str) -> str:
    s = fragment
    for pat in TECH_PATTERNS:
        s = re.sub(pat, ' ', s, flags=re.I|re.S)
    return s.strip()

def collect_scripts_and_closers(fragment: str) -> str:
    scripts = re.findall(r'<script\b[\s\S]*?</script>', fragment, flags=re.I)
    # Keep unique scripts in original order to avoid duplicate ptf-metrics/chat when present.
    seen = set(); ordered = []
    for sc in scripts:
        key = re.sub(r'\s+', ' ', sc).strip()
        if key in seen:
            continue
        seen.add(key); ordered.append(sc.strip())
    return ('\n' + '\n'.join(ordered) if ordered else '') + '\n</body></html>\n'

def insert_before_article_or_footer(before_footer: str, content: str) -> str:
    content = content.strip()
    if not content:
        return before_footer
    # Prefer putting moved content inside the main article if the page has one.
    idx = before_footer.lower().rfind('</article>')
    if idx != -1:
        return before_footer[:idx] + '\n' + content + '\n' + before_footer[idx:]
    return before_footer + '\n' + content + '\n'

changed = []
for p in sorted(KC.glob('*.html')):
    s = p.read_text(encoding='utf-8', errors='ignore')
    lf = s.lower().rfind('</footer>')
    if lf == -1:
        continue
    before = s[:lf]
    footer_and_after = s[lf:]
    m = re.match(r'(</footer>)([\s\S]*)$', footer_and_after, flags=re.I)
    if not m:
        continue
    after = m.group(2)
    if not visible_text(after):
        continue
    moved = strip_technical(after)
    # Remove accidental duplicate stylesheet link that was placed after footer; CSS already loads in head.
    new_before = insert_before_article_or_footer(before, moved)
    new_s = new_before + '</footer>' + collect_scripts_and_closers(after)
    if new_s != s:
        p.write_text(new_s, encoding='utf-8')
        changed.append(str(p))

print(f'fixed={len(changed)}')
for x in changed:
    print(x)
