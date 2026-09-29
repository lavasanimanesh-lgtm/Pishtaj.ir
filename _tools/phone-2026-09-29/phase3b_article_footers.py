# -*- coding: utf-8 -*-
"""Phase 3b — the 17 extensionless knowledge-center/article-0NN pages.

They carry a compact 3-column footer (not the 5-column shell) whose «ارتباط» block
already lists the commercial line and the email. Add the company line beside them.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import *          # noqa

OLD = (f'<div><b>ارتباط</b><a href="tel:{OLD_LOCAL}">{OLD_DASH}</a>'
       f'<a href="mailto:{EMAIL}">{EMAIL}</a></div>')
NEW = (f'<div><b>ارتباط</b><a href="tel:{OLD_LOCAL}">{OLD_DASH}</a>'
       f'<a href="mailto:{EMAIL}">{EMAIL}</a>'
       f'<a href="tel:{NEW_LOCAL}">{NEW_DASH}</a></div>')

n = 0
for p in site_files():
    t = read(p)
    if OLD not in t or NEW in t:
        continue
    write(p, t.replace(OLD, NEW))
    n += 1
    print("  ", os.path.relpath(p, ROOT))
print(f"compact contact block extended in {n} pages")
