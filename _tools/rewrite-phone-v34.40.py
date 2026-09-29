#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Company phone-number rollover (021-46087679 -> 021-91099242).

1. Replace every rendering of the old landline (Latin + Persian digits) with the
   new one across the live site files.
2. Retitle the commercial line: "خط ویژه بازرگانی" -> "خط مستقیم بازرگانی".
3. Inject a clickable "خط مستقیم بازرگانی" chip into the footer of every page
   that carries the standard Persian footer.
4. Bump the shared shell asset version so cached bundles are refetched.

Idempotent: re-running produces no further changes.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OLD_LAT = '46087679'
NEW_LAT = '91099242'
OLD_FA = '۴۶۰۸۷۶۷۹'
NEW_FA = '۹۱۰۹۹۲۴۲'

LABEL_OLD = 'خط ویژه بازرگانی'
LABEL_NEW = 'خط مستقیم بازرگانی'
CHAT_LABEL_OLD = 'خط ویژه:'
CHAT_LABEL_NEW = 'خط مستقیم:'

OLD_SHELL_VER = '20260926-5'
NEW_SHELL_VER = '20260929-1'

SKIP_DIRS = {'.git', '_tools', '_audit', '_personas', '_human_test',
             'node_modules', '__pycache__', 'ptf-all-photos', 'ptf-snapshots'}
SKIP_EXTS = {'.md', '.py', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico',
             '.woff', '.woff2', '.ttf', '.pdf', '.zip', '.db', '.sqlite'}

FOOTER_ANCHOR = re.compile(
    r'^([ \t]*)(<p style="font-size:13\.5px; color:#94a3b8; line-height:1\.8;">'
    r'تامین‌کننده تخصصی تجهیزات پایپینگ، برق صنعتی و ابزار دقیق برای پروژه‌های ملی '
    r'نفت، گاز، پتروشیمی، فولاد و نیروگاهی\.</p>)',
    re.MULTILINE)

FOOTER_CHIP = (
    '<a class="ptf-footer-tel" href="tel:02191099242" data-ptf-event="footer_call" '
    'aria-label="خط مستقیم بازرگانی — 021-91099242" style="display:inline-flex; align-items:center; '
    'gap:8px; margin-top:16px; padding:10px 16px; border-radius:999px; '
    'background:rgba(239,75,26,.13); border:1px solid rgba(239,75,26,.38); color:#ffb033; '
    'font-size:14px; font-weight:900; text-decoration:none;">'
    '<svg xmlns="http://www.w3.org/2000/svg" width="1.15em" height="1.15em" viewBox="0 0 24 24" '
    'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.12em">'
    '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 '
    '012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6'
    'l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>'
    '<span>خط مستقیم بازرگانی</span>'
    '<span dir="ltr" style="color:#fff; direction:ltr; unicode-bidi:embed;">021-91099242</span>'
    '</a>'
)


def walk():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext in SKIP_EXTS:
                continue
            yield os.path.join(dirpath, name)


def transform(path, text):
    """Return (new_text, list_of_changes)."""
    changes = []
    out = text

    if OLD_FA in out:
        out = out.replace(OLD_FA, NEW_FA)
        changes.append('phone-fa')
    if OLD_LAT in out:
        out = out.replace(OLD_LAT, NEW_LAT)
        changes.append('phone-latin')
    if LABEL_OLD in out:
        out = out.replace(LABEL_OLD, LABEL_NEW)
        changes.append('label')
    if CHAT_LABEL_OLD in out:
        out = out.replace(CHAT_LABEL_OLD, CHAT_LABEL_NEW)
        changes.append('chat-label')
    if OLD_SHELL_VER in out:
        out = out.replace(OLD_SHELL_VER, NEW_SHELL_VER)
        changes.append('shell-version')
    if 'ptf-footer-tel' not in out and FOOTER_ANCHOR.search(out):
        out = FOOTER_ANCHOR.sub(lambda m: m.group(0) + '\n' + m.group(1) + FOOTER_CHIP, out, count=1)
        changes.append('footer-chip')
    return out, changes


def main():
    if '--check' not in sys.argv and len(sys.argv) > 1 and sys.argv[1] != '--apply':
        print(__doc__)
        return 0

    apply_changes = '--apply' in sys.argv
    touched = 0
    stats = {}
    for path in walk():
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                original = fh.read()
        except (UnicodeDecodeError, OSError):
            continue
        new, changes = transform(path, original)
        if not changes:
            continue
        touched += 1
        for c in changes:
            stats[c] = stats.get(c, 0) + 1
        rel = os.path.relpath(path, ROOT)
        print(('[would patch] ' if not apply_changes else '[patched] ') +
              rel + ' :: ' + ','.join(changes))
        if apply_changes and new != original:
            with open(path, 'w', encoding='utf-8', newline='') as fh:
                fh.write(new)

    print('\nfiles: %d' % touched)
    for k in sorted(stats):
        print('  %-14s %d' % (k, stats[k]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
